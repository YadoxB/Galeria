const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = path.join(os.homedir(), 'Documents', 'GalerieApp');
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
