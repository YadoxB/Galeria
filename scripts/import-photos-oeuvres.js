const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SOURCE_DIR = process.env.PHOTOS_OEUVRES_SRC ||
  path.join('F:', 'Galerie', 'Automatisation', 'Galerie', 'photos_oeuvres');
const candidatsData = [
  path.join(os.homedir(), 'Documents', 'Galeria'),
  path.join(os.homedir(), 'Documents', 'GalerieApp'),
];
const DATA_DIR = candidatsData.find((p) => fs.existsSync(p)) || candidatsData[0];
const DB_PATH = path.join(DATA_DIR, 'galerie.db');
const CIBLE_DIR = path.join(DATA_DIR, 'Photos', 'oeuvres');

const EXTENSIONS_OK = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Dossier source introuvable : ${SOURCE_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Base introuvable : ${DB_PATH}`);
    console.error("Lance l'app au moins une fois avant l'import.");
    process.exit(1);
  }

  fs.mkdirSync(CIBLE_DIR, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  const oeuvres = db.prepare(
    'SELECT id, numero_inventaire, titre, image_path FROM oeuvres'
  ).all();
  const parInv = new Map();
  for (const o of oeuvres) {
    if (o.numero_inventaire) {
      parInv.set(o.numero_inventaire.trim(), o);
    }
  }

  const fichiers = fs.readdirSync(SOURCE_DIR).filter((f) => EXTENSIONS_OK.test(f));
  console.log(`Source     : ${SOURCE_DIR}`);
  console.log(`Cible      : ${CIBLE_DIR}`);
  console.log(`Œuvres     : ${oeuvres.length} en base`);
  console.log(`Fichiers   : ${fichiers.length} à traiter`);
  console.log('');

  const updateStmt = db.prepare(
    "UPDATE oeuvres SET image_path = ?, modifie_le = datetime('now') WHERE id = ?"
  );

  let copiees = 0, dejaPresentes = 0;
  const orphelins = [];
  let ts = Date.now();

  db.exec('BEGIN');
  try {
    for (const fichier of fichiers) {
      const m = fichier.match(/^(.+?)\s+-\s+/);
      if (!m) {
        orphelins.push({ fichier, raison: 'Format de nom non reconnu' });
        continue;
      }
      const num = m[1].trim();
      const oeuvre = parInv.get(num);
      if (!oeuvre) {
        orphelins.push({ fichier, raison: `Numéro ${num} non trouvé en base` });
        continue;
      }
      if (oeuvre.image_path) {
        dejaPresentes++;
        continue;
      }
      const ext = path.extname(fichier).slice(1).toLowerCase();
      const nomCible = `oeuvre-${oeuvre.id}-${ts++}.${ext}`;
      const destAbs = path.join(CIBLE_DIR, nomCible);
      const cheminRelatif = `oeuvres/${nomCible}`;
      fs.copyFileSync(path.join(SOURCE_DIR, fichier), destAbs);
      updateStmt.run(cheminRelatif, oeuvre.id);
      copiees++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    db.close();
    throw e;
  }
  db.close();

  console.log(`Résultat :`);
  console.log(`  ${copiees} photo(s) copiée(s) et rattachée(s)`);
  console.log(`  ${dejaPresentes} œuvre(s) avait(ent) déjà une image (sautée)`);
  console.log(`  ${orphelins.length} fichier(s) sans correspondance`);

  if (orphelins.length > 0) {
    console.log('');
    console.log('Fichiers orphelins :');
    const limite = Math.min(orphelins.length, 30);
    for (let i = 0; i < limite; i++) {
      console.log(`  • ${orphelins[i].fichier}  (${orphelins[i].raison})`);
    }
    if (orphelins.length > 30) {
      console.log(`  … et ${orphelins.length - 30} autre(s).`);
    }
  }
}

main();
