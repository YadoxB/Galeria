const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Cherche Galeria d'abord (nouveau), GalerieApp en repli
const candidats = [
  path.join(os.homedir(), 'Documents', 'Galeria'),
  path.join(os.homedir(), 'Documents', 'GalerieApp'),
];
const dir = candidats.find((p) => fs.existsSync(p)) || candidats[0];
const fichiers = ['galerie.db', 'galerie.db-wal', 'galerie.db-shm'];

let efface = 0;
for (const f of fichiers) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`Effacé : ${p}`);
    efface++;
  }
}

if (efface === 0) {
  console.log('Aucun fichier de base à effacer.');
} else {
  console.log(`${efface} fichier(s) effacé(s). Le prochain démarrage recréera une base vide depuis schema.sql.`);
}
