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
function seedPhotosIfNeeded() {
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

  // Copie récursive du seed vers le dossier utilisateur.
  let nbFichiers = 0;
  let tailleTotale = 0;
  const tStart = Date.now();
  (function copier(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entree of fs.readdirSync(src, { withFileTypes: true })) {
      const cSrc = path.join(src, entree.name);
      const cDst = path.join(dst, entree.name);
      if (entree.isDirectory()) {
        copier(cSrc, cDst);
      } else if (entree.isFile()) {
        fs.copyFileSync(cSrc, cDst);
        try {
          const st = fs.statSync(cDst);
          tailleTotale += st.size;
        } catch {}
        nbFichiers++;
      }
    }
  })(seedDir, userDir);

  fs.writeFileSync(marqueur, new Date().toISOString());
  const dureeMs = Date.now() - tStart;
  return { nbFichiers, tailleTotale, dureeMs };
}

module.exports = { seedPhotosIfNeeded };
