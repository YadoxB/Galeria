// Empaquette toutes les photos de seed-photos/ en UN seul fichier seed/photos.pack,
// puis vide seed-photos/. But : l'installateur ne pose qu'un gros fichier (écriture
// séquentielle rapide, pas de gel) au lieu de centaines de petits fichiers. Le
// déballage vers le dossier de l'utilisateur se fait au 1er lancement (src/db/
// seedPhotos.js), avec la barre de progression du splash.
//
// Format du paquet : « GALPACK1 » (8 o) + longueur d'index uint32 LE (4 o) +
// index JSON [[cheminRelatif, taille], …] + données concaténées dans l'ordre.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'seed-photos');
const SEED_DIR = path.join(ROOT, 'seed');
const OUT = path.join(SEED_DIR, 'photos.pack');

if (!fs.existsSync(SRC)) { console.error(`Dossier introuvable : ${SRC}`); process.exit(1); }

// Liste récursive des fichiers (chemins relatifs en avant-slash).
const fichiers = [];
(function lister(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) lister(full, r);
    else if (e.isFile()) fichiers.push([r, full]);
  }
})(SRC, '');

if (!fichiers.length) { console.error(`Aucune photo à empaqueter dans ${SRC}.`); process.exit(1); }

const index = fichiers.map(([r, full]) => [r, fs.statSync(full).size]);
const indexBuf = Buffer.from(JSON.stringify(index), 'utf-8');
const entete = Buffer.alloc(12);
entete.write('GALPACK1', 0, 'ascii');
entete.writeUInt32LE(indexBuf.length, 8);

fs.mkdirSync(SEED_DIR, { recursive: true });
const fd = fs.openSync(OUT, 'w');
fs.writeSync(fd, entete);
fs.writeSync(fd, indexBuf);
let total = 0;
for (const [, full] of fichiers) { const d = fs.readFileSync(full); fs.writeSync(fd, d); total += d.length; }
fs.closeSync(fd);

// Vider seed-photos/ : ses fichiers sont maintenant dans le paquet et ne doivent
// plus être posés un par un par l'installateur. On garde un dossier vide (.gitkeep)
// pour qu'electron-builder accepte l'extraResource.
fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(SRC, { recursive: true });
fs.writeFileSync(path.join(SRC, '.gitkeep'), '');

console.log(`Paquet créé : ${OUT} (${fichiers.length} fichiers, ${(total / 1048576).toFixed(1)} Mo). seed-photos/ vidé.`);
