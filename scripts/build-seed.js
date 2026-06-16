const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Cherche d'abord Documents\Galeria\, retombe sur GalerieApp\ pour les machines
// pas encore migrées.
const candidats = [
  path.join(os.homedir(), 'Documents', 'Galeria', 'galerie.db'),
  path.join(os.homedir(), 'Documents', 'GalerieApp', 'galerie.db'),
];
const SRC = candidats.find((p) => fs.existsSync(p));
const DEST_DIR = path.join(__dirname, '..', 'seed');
const DEST = path.join(DEST_DIR, 'galerie.db');

if (!SRC) {
  console.error(`Aucune base trouvée à :\n  ${candidats.join('\n  ')}`);
  console.error('Lance d\'abord l\'app et importe ton catalogue avant de bâtir l\'installateur.');
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);
const taille = (fs.statSync(DEST).size / 1024).toFixed(1);
console.log(`Seed copié : ${DEST} (${taille} Ko)`);
