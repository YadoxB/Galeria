const fs = require('node:fs');
const path = require('node:path');
const { getPhotosDir, getSeedPhotosPath } = require('./paths');

const NOM_MARQUEUR = '.seed-applique';

// Copie le contenu de seed-photos/ vers Documents\GalerieApp\Photos\ au premier
// lancement seulement. Garde-fous :
//   1. Skip si aucun seed-photos n'est embarqué (dev sans build).
//   2. Skip si un marqueur indique que la copie a déjà été faite.
//   3. Skip si le dossier Photos contient déjà des fichiers (utilisateur a déjà
//      des photos qu'on ne veut pas écraser).
// Renvoie un compte sommaire des fichiers copiés (ou null si rien fait).
// `onProgress({ nbFichiers, total, pct })` est appelé pendant la copie (au plus
// une fois par incrément de % entier) pour alimenter le splash. La copie est
// asynchrone et cède la main entre les lots, pour que le splash se repeigne et
// que la barre avance réellement (sinon une copie synchrone fige tout).
async function seedPhotosIfNeeded(onProgress) {
  const seedDir = getSeedPhotosPath();
  if (!fs.existsSync(seedDir)) {
    return null; // Pas de seed dispo (mode dev, ou installateur sans photos)
  }

  const userDir = getPhotosDir();
  const marqueur = path.join(userDir, NOM_MARQUEUR);
  if (fs.existsSync(marqueur)) {
    return null; // Déjà copié une fois
  }

  // Si le dossier utilisateur contient déjà des photos non-marqueurs, on ne touche pas.
  if (fs.existsSync(userDir)) {
    const entrees = fs.readdirSync(userDir).filter((n) => !n.startsWith('.'));
    if (entrees.length > 0) {
      // L'utilisateur a déjà des photos. On dépose quand même un marqueur pour
      // ne pas re-vérifier à chaque démarrage.
      try { fs.writeFileSync(marqueur, new Date().toISOString()); } catch {}
      return null;
    }
  } else {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // 1. Lister les fichiers à copier (en créant les sous-dossiers au passage).
  const taches = [];
  (function lister(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entree of fs.readdirSync(src, { withFileTypes: true })) {
      const cSrc = path.join(src, entree.name);
      const cDst = path.join(dst, entree.name);
      if (entree.isDirectory()) lister(cSrc, cDst);
      else if (entree.isFile()) taches.push([cSrc, cDst]);
    }
  })(seedDir, userDir);

  // 2. Copier de façon asynchrone, en remontant la progression.
  const total = taches.length;
  let nbFichiers = 0;
  let tailleTotale = 0;
  let dernierPct = -1;
  const tStart = Date.now();
  for (const [cSrc, cDst] of taches) {
    await fs.promises.copyFile(cSrc, cDst);
    try { tailleTotale += fs.statSync(cDst).size; } catch {}
    nbFichiers++;
    const pct = total ? Math.floor((nbFichiers / total) * 100) : 100;
    if (onProgress && pct !== dernierPct) {
      dernierPct = pct;
      onProgress({ nbFichiers, total, pct });
      // Céder la main pour laisser l'IPC partir et le splash se repeindre.
      await new Promise((r) => setImmediate(r));
    }
  }

  fs.writeFileSync(marqueur, new Date().toISOString());
  const dureeMs = Date.now() - tStart;
  return { nbFichiers, tailleTotale, dureeMs };
}

module.exports = { seedPhotosIfNeeded };
