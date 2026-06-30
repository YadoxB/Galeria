// Crée un seed-photos/ vide pour la release publique. Aucune image embarquée.
// L'utilisateur d'une install fraîche ajoute ses propres images via l'app.

const fs = require('node:fs');
const path = require('node:path');

const DEST_DIR = path.join(__dirname, '..', 'seed-photos');

// Tout effacer s'il y a des restes d'un build précédent, puis recréer un
// dossier vide avec un .gitkeep pour qu'electron-builder accepte le filter.
if (fs.existsSync(DEST_DIR)) {
  fs.rmSync(DEST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DEST_DIR, { recursive: true });
fs.writeFileSync(path.join(DEST_DIR, '.gitkeep'), '');

// Effacer un éventuel paquet de photos d'un build catalogue/complet précédent,
// pour que la release publique ne contienne aucune image.
try { fs.unlinkSync(path.join(__dirname, '..', 'seed', 'photos.pack')); } catch {}

console.log(`Seed-photos vide créé : ${DEST_DIR}`);
