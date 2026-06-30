// Seed « catalogue » : base SANS les données transactionnelles ni les documents
// + photos d'œuvres réorganisées par artiste et renommées selon la nomenclature.
//
// - Base : copie de la base utilisateur, puis on VIDE clients / ventes /
//   certificats / annexes et on efface le cache de présentation des artistes.
//   Le STATUT des œuvres est CONSERVÉ (disponible / vendu / …) ainsi que tout
//   le reste du catalogue (artistes + œuvres).
// - Photos d'œuvres : copiées dans seed-photos/oeuvres/<Artiste>/<nom-nomenclature>.<ext>
//   (construireNomFichier), et oeuvres.image_path mis à jour en conséquence.
//   Portraits d'artistes copiés tels quels. Photos non référencées ignorées.
//
// Lit la base et les photos du dossier utilisateur en LECTURE SEULE ; n'écrit
// que dans seed/ et seed-photos/. Les données live ne sont jamais modifiées.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { construireNomFichier } = require('../src/db/nomenclature.js');

const ROOT = path.join(__dirname, '..');
const SRC_DB = [
  path.join(os.homedir(), 'Documents', 'Galeria', 'galerie.db'),
  path.join(os.homedir(), 'Documents', 'GalerieApp', 'galerie.db'),
].find((p) => fs.existsSync(p));
const SRC_PHOTOS = [
  path.join(os.homedir(), 'Documents', 'Galeria', 'Photos'),
  path.join(os.homedir(), 'Documents', 'GalerieApp', 'Photos'),
].find((p) => fs.existsSync(p));
const SEED_DIR = path.join(ROOT, 'seed');
const SEED_DB = path.join(SEED_DIR, 'galerie.db');
const SEED_PHOTOS = path.join(ROOT, 'seed-photos');

if (!SRC_DB) { console.error('Base introuvable dans Documents\\Galeria\\.'); process.exit(1); }
if (!SRC_PHOTOS) { console.error('Dossier Photos introuvable.'); process.exit(1); }

// Retire les caractères interdits par Windows, garde accents / espaces / parenthèses.
function nomFsSur(s) {
  return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function copierDossier(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copierDossier(s, d);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}
function moOctets(o) { return (o / (1024 * 1024)).toFixed(1) + ' Mo'; }

// 1. Copier la base puis la nettoyer (documents + transactions).
fs.mkdirSync(SEED_DIR, { recursive: true });
fs.copyFileSync(SRC_DB, SEED_DB);
const db = new DatabaseSync(SEED_DB);
db.exec('PRAGMA foreign_keys = OFF');
const avant = {};
for (const t of ['clients', 'ventes', 'certificats', 'annexes']) {
  try { avant[t] = db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; db.exec(`DELETE FROM ${t}`); }
  catch (e) { console.warn(`(table ${t} : ${e.message})`); }
}
try { db.exec('UPDATE artistes SET presentation_path = NULL, presentation_sig = NULL'); } catch {}

// 2. seed-photos : repartir au propre, copier les portraits d'artistes tels quels.
if (fs.existsSync(SEED_PHOTOS)) fs.rmSync(SEED_PHOTOS, { recursive: true, force: true });
fs.mkdirSync(SEED_PHOTOS, { recursive: true });
const artistesSrc = path.join(SRC_PHOTOS, 'artistes');
if (fs.existsSync(artistesSrc)) copierDossier(artistesSrc, path.join(SEED_PHOTOS, 'artistes'));

// 3. Photos d'œuvres : réorganiser par artiste + renommer, mettre à jour image_path.
const oeuvres = db.prepare(`
  SELECT o.*, TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste
  FROM oeuvres o JOIN artistes a ON a.id = o.artiste_id
  WHERE o.image_path IS NOT NULL AND o.image_path <> ''
`).all();
const majImage = db.prepare('UPDATE oeuvres SET image_path = ? WHERE id = ?');
let copiees = 0, manquantes = 0, tailleTotale = 0;
const exemples = [];
const dejaVus = new Set();

for (const o of oeuvres) {
  const src = path.join(SRC_PHOTOS, o.image_path);
  if (!fs.existsSync(src)) { manquantes++; console.warn(`  ⚠ photo manquante : ${o.image_path} (œuvre ${o.numero_inventaire})`); continue; }
  const ext = path.extname(o.image_path) || '.jpg';
  const dossierArtiste = nomFsSur(o.artiste) || 'Sans artiste';
  const base = construireNomFichier(o);
  let rel = `oeuvres/${dossierArtiste}/${base}${ext}`;
  let i = 2;
  while (dejaVus.has(rel.toLowerCase())) { rel = `oeuvres/${dossierArtiste}/${base}_${i}${ext}`; i++; }
  dejaVus.add(rel.toLowerCase());

  const dst = path.join(SEED_PHOTOS, rel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  tailleTotale += fs.statSync(dst).size;
  majImage.run(rel, o.id);
  copiees++;
  if (exemples.length < 8) exemples.push(rel);
}

// Tampon du catalogue : identifiant unique de ce build. L'app le compare à celui
// de la base de l'utilisateur pour proposer le chargement de ce catalogue.
const catalogueId = new Date().toISOString();
db.exec('CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT)');
db.prepare("INSERT INTO meta (cle, valeur) VALUES ('catalogue_id', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur").run(catalogueId);

db.exec('VACUUM');
db.close();

// 4. Rapport.
const tailleDb = (fs.statSync(SEED_DB).size / 1024).toFixed(1);
console.log('\n=== Seed catalogue ===');
console.log(`Base nettoyée : ${SEED_DB} (${tailleDb} Ko)`);
console.log(`  Vidés : ${JSON.stringify(avant)} ; cache de présentation artiste effacé ; statut des œuvres conservé.`);
console.log(`Photos d'œuvres réorganisées : ${copiees} copiées (${moOctets(tailleTotale)})` + (manquantes ? `, ${manquantes} manquantes` : ''));
console.log('Portraits d\'artistes : copiés tels quels.');
console.log('Exemples de chemins :');
exemples.forEach((e) => console.log('   ' + e));
