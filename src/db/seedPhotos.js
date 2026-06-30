const fs = require('node:fs');
const path = require('node:path');
const { getPhotosDir, getSeedPhotosPath, getSeedPackPath } = require('./paths');

const NOM_MARQUEUR = '.seed-applique';

// Place les photos initiales dans Documents\Galeria\Photos\ au premier lancement.
// Deux sources possibles (par ordre de préférence) :
//   1. seed/photos.pack — un paquet unique (toutes les images concaténées). On
//      le DÉBALLE ici, avec progression. L'installateur n'a posé qu'un fichier,
//      donc l'install est rapide ; le travail (des centaines d'images) se fait
//      ici, visible sur le splash.
//   2. seed-photos\ — l'ancien dossier d'images (compat / autres builds) : copie.
// Garde-fous : ne rien faire si déjà appliqué (marqueur) ou si l'utilisateur a
// déjà des photos. `onProgress({ nbFichiers, total, pct })` alimente le splash.

// Lit l'en-tête du paquet : magie « GALPACK1 », longueur d'index, index JSON.
function lireIndexPaquet(fd) {
  const entete = Buffer.alloc(12);
  if (fs.readSync(fd, entete, 0, 12, 0) < 12 || entete.toString('ascii', 0, 8) !== 'GALPACK1') {
    throw new Error('Paquet de photos invalide.');
  }
  const longueurIndex = entete.readUInt32LE(8);
  const indexBuf = Buffer.alloc(longueurIndex);
  fs.readSync(fd, indexBuf, 0, longueurIndex, 12);
  return { index: JSON.parse(indexBuf.toString('utf-8')), debutDonnees: 12 + longueurIndex };
}

async function deballerPaquet(packPath, userDir, onProgress) {
  const fd = fs.openSync(packPath, 'r');
  try {
    const { index, debutDonnees } = lireIndexPaquet(fd);
    const total = index.length;
    let offset = debutDonnees, nbFichiers = 0, tailleTotale = 0, dernierPct = -1;
    const tStart = Date.now();
    for (const [rel, taille] of index) {
      const dest = path.join(userDir, rel.replace(/\//g, path.sep));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const data = Buffer.alloc(taille);
      fs.readSync(fd, data, 0, taille, offset);
      fs.writeFileSync(dest, data);
      offset += taille;
      tailleTotale += taille;
      nbFichiers++;
      const pct = total ? Math.floor((nbFichiers / total) * 100) : 100;
      if (onProgress && pct !== dernierPct) {
        dernierPct = pct;
        onProgress({ nbFichiers, total, pct });
        await new Promise((r) => setImmediate(r)); // laisser le splash se repeindre
      }
    }
    return { nbFichiers, tailleTotale, dureeMs: Date.now() - tStart };
  } finally {
    fs.closeSync(fd);
  }
}

async function copierDossier(seedDir, userDir, onProgress) {
  const taches = [];
  (function lister(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const cSrc = path.join(src, e.name), cDst = path.join(dst, e.name);
      if (e.isDirectory()) lister(cSrc, cDst);
      else if (e.isFile()) taches.push([cSrc, cDst]);
    }
  })(seedDir, userDir);

  const total = taches.length;
  let nbFichiers = 0, tailleTotale = 0, dernierPct = -1;
  const tStart = Date.now();
  for (const [cSrc, cDst] of taches) {
    await fs.promises.copyFile(cSrc, cDst);
    try { tailleTotale += fs.statSync(cDst).size; } catch {}
    nbFichiers++;
    const pct = total ? Math.floor((nbFichiers / total) * 100) : 100;
    if (onProgress && pct !== dernierPct) {
      dernierPct = pct;
      onProgress({ nbFichiers, total, pct });
      await new Promise((r) => setImmediate(r));
    }
  }
  return { nbFichiers, tailleTotale, dureeMs: Date.now() - tStart };
}

async function seedPhotosIfNeeded(onProgress) {
  const userDir = getPhotosDir();
  const marqueur = path.join(userDir, NOM_MARQUEUR);
  if (fs.existsSync(marqueur)) return null; // déjà appliqué

  // L'utilisateur a déjà des photos → on ne touche à rien (on pose le marqueur).
  if (fs.existsSync(userDir)) {
    const entrees = fs.readdirSync(userDir).filter((n) => !n.startsWith('.'));
    if (entrees.length > 0) {
      try { fs.writeFileSync(marqueur, new Date().toISOString()); } catch {}
      return null;
    }
  } else {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // 1. Paquet unique (préféré).
  const packPath = getSeedPackPath();
  if (packPath && fs.existsSync(packPath)) {
    const r = await deballerPaquet(packPath, userDir, onProgress);
    fs.writeFileSync(marqueur, new Date().toISOString());
    return r;
  }

  // 2. Ancien dossier seed-photos/ (compat / build sans paquet).
  const seedDir = getSeedPhotosPath();
  if (!fs.existsSync(seedDir)) return null;
  const r = await copierDossier(seedDir, userDir, onProgress);
  fs.writeFileSync(marqueur, new Date().toISOString());
  return r;
}

module.exports = { seedPhotosIfNeeded };
