// Met à jour la colonne `url_site` des œuvres existantes à partir d'un CSV
// d'Airtable. Matching par « Numéro d'inventaire » exact.
//
// Usage :
//   node scripts/import-urls-oeuvres.js <chemin-csv>           → aperçu (dry-run)
//   node scripts/import-urls-oeuvres.js <chemin-csv> --execute → écriture
//
// Sécurité :
//   - Ne touche QUE la colonne url_site. Tout le reste est intact.
//   - En --execute, fait une sauvegarde de la base avant écriture.

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse } = require('csv-parse/sync');

const ARGS = process.argv.slice(2);
const cheminCsv = ARGS.find((a) => !a.startsWith('--'));
const EXECUTE = ARGS.includes('--execute');

if (!cheminCsv) {
  console.error('Usage : node scripts/import-urls-oeuvres.js <chemin-csv> [--execute]');
  process.exit(1);
}
if (!fs.existsSync(cheminCsv)) {
  console.error(`CSV introuvable : ${cheminCsv}`);
  process.exit(1);
}

const dbPath = path.join(os.homedir(), 'Documents', 'Galeria', 'galerie.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Base introuvable : ${dbPath}`);
  process.exit(1);
}

// Colonnes possibles pour le numéro d'inventaire et l'URL
const CLES_INVENTAIRE = ["Numéro d'inventaire", "Numero d'inventaire", 'Inventaire'];
const CLES_URL = ['Lien sur le site', 'URL', 'URL site', 'URL site web', 'Lien produit', 'Site web'];

function premiereClePresente(row, cles) {
  for (const c of cles) {
    if (Object.prototype.hasOwnProperty.call(row, c)) return c;
  }
  return null;
}

const contenu = fs.readFileSync(cheminCsv, 'utf-8');
const rows = parse(contenu, {
  columns: true,
  bom: true,
  skip_empty_lines: true,
  trim: true,
  cast: false,
  relax_quotes: true,
});

if (!rows.length) {
  console.error('CSV vide.');
  process.exit(1);
}

const cleInv = premiereClePresente(rows[0], CLES_INVENTAIRE);
const cleUrl = premiereClePresente(rows[0], CLES_URL);

if (!cleInv) {
  console.error(`Colonne d'inventaire introuvable. Attendu : ${CLES_INVENTAIRE.join(' ou ')}.`);
  console.error(`Colonnes trouvées : ${Object.keys(rows[0]).join(', ')}`);
  process.exit(1);
}
if (!cleUrl) {
  console.error(`Colonne d'URL introuvable. Attendu : ${CLES_URL.join(' ou ')}.`);
  console.error(`Colonnes trouvées : ${Object.keys(rows[0]).join(', ')}`);
  process.exit(1);
}

console.log(`Mode : ${EXECUTE ? 'EXÉCUTION' : 'DRY-RUN (aperçu uniquement)'}`);
console.log(`Colonne inventaire : « ${cleInv} »`);
console.log(`Colonne URL : « ${cleUrl} »`);
console.log(`Lignes CSV : ${rows.length}`);
console.log('');

const db = new DatabaseSync(dbPath);
const findStmt = db.prepare(`SELECT id, titre, url_site FROM oeuvres WHERE numero_inventaire = ?`);
const updStmt = db.prepare(`UPDATE oeuvres SET url_site = ?, modifie_le = datetime('now') WHERE id = ?`);

const aMettreAJour = [];
const sansInventaire = [];
const sansUrl = [];
const introuvables = [];
const dejaIdentiques = [];

for (const row of rows) {
  const inv = (row[cleInv] || '').trim();
  const url = (row[cleUrl] || '').trim();
  if (!inv) { sansInventaire.push({ titre: row["Titre de l'œuvre"] || '?' }); continue; }
  if (!url) { sansUrl.push({ inv, titre: row["Titre de l'œuvre"] || '?' }); continue; }

  const oeuvre = findStmt.get(inv);
  if (!oeuvre) {
    introuvables.push({ inv, titre: row["Titre de l'œuvre"] || '?', url });
    continue;
  }
  if ((oeuvre.url_site || '').trim() === url) {
    dejaIdentiques.push({ id: oeuvre.id, inv, titre: oeuvre.titre });
    continue;
  }
  aMettreAJour.push({ id: oeuvre.id, inv, titre: oeuvre.titre, ancien: oeuvre.url_site || '', nouveau: url });
}

console.log(`À mettre à jour : ${aMettreAJour.length}`);
console.log(`Déjà identiques : ${dejaIdentiques.length}`);
console.log(`Sans URL dans le CSV : ${sansUrl.length}`);
console.log(`Sans numéro d'inventaire dans le CSV : ${sansInventaire.length}`);
console.log(`Œuvres introuvables en base (numéro non matché) : ${introuvables.length}`);
console.log('');

if (aMettreAJour.length) {
  console.log('Exemples (5 premières) :');
  for (const m of aMettreAJour.slice(0, 5)) {
    console.log(`  #${String(m.id).padStart(4)} | ${m.inv} | "${m.titre}"`);
    console.log(`    ancien : ${m.ancien || '(vide)'}`);
    console.log(`    nouveau : ${m.nouveau}`);
  }
  if (aMettreAJour.length > 5) console.log(`  … et ${aMettreAJour.length - 5} de plus.`);
}

if (introuvables.length) {
  console.log('');
  console.log(`Numéros d'inventaire introuvables en base (premiers 10) :`);
  for (const m of introuvables.slice(0, 10)) {
    console.log(`  ${m.inv} | "${m.titre}"`);
  }
  if (introuvables.length > 10) console.log(`  … et ${introuvables.length - 10} de plus.`);
}

if (!EXECUTE) {
  console.log('');
  console.log(`Dry-run terminé. Pour appliquer :`);
  console.log(`  node scripts/import-urls-oeuvres.js "${cheminCsv}" --execute`);
  db.close();
  process.exit(0);
}

// Sauvegarde de la base avant écriture
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const sauvegardePath = path.join(path.dirname(dbPath), `galerie-avant-import-urls-${stamp}.db`);
fs.copyFileSync(dbPath, sauvegardePath);
console.log('');
console.log(`Sauvegarde créée : ${sauvegardePath}`);

db.exec('BEGIN');
let n = 0;
try {
  for (const m of aMettreAJour) {
    updStmt.run(m.nouveau, m.id);
    n++;
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Échec, rollback effectué.', e);
  db.close();
  process.exit(2);
}

console.log(`✓ ${n} œuvre(s) mise(s) à jour.`);
db.close();
