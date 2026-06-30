// Applique les consignes IA par artiste du document
// gabarits/Consignes-IA-descriptions-oeuvres.md dans la base : remplit
// artistes.instructions_ia avec la « Consigne IA prête à l'emploi » de chaque
// artiste. Le set GLOBAL de la galerie, lui, vit dans le code (prompt de
// génération), pas dans la base — il s'applique donc toujours et suit dans le
// build, contrairement à config.json.
//
// - Sauvegarde la base avant toute écriture.
// - Associe les artistes par nom complet (insensible accents/casse), avec
//   repli sur le nom de famille. Signale les non-appariés des deux côtés.
// - Idempotent : relançable (réécrit la même valeur).
//
// Usage : node scripts/appliquer-consignes-ia.js [--dry]

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const DRY = process.argv.includes('--dry');
const ROOT = path.join(__dirname, '..');
const DOC = path.join(ROOT, 'gabarits', 'Consignes-IA-descriptions-oeuvres.md');

const DB_PATH = [
  path.join(os.homedir(), 'Documents', 'Galeria', 'galerie.db'),
  path.join(os.homedir(), 'Documents', 'GalerieApp', 'galerie.db'),
].find((p) => fs.existsSync(p));

if (!DB_PATH) { console.error('Base introuvable dans Documents\\Galeria\\.'); process.exit(1); }
if (!fs.existsSync(DOC)) { console.error('Document introuvable :', DOC); process.exit(1); }

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// ----- 1. Parser le document : nom d'artiste -> consigne prête à l'emploi -----
const texte = fs.readFileSync(DOC, 'utf-8');
const apres = texte.split(/^##\s+SETS PAR ARTISTE\s*$/m)[1] || '';
const blocs = apres.split(/\n##\s+/).slice(1); // chaque bloc commence par "Nom\n..."

const parDoc = new Map(); // norm(nom) -> { nom, consigne }
for (const bloc of blocs) {
  const nom = bloc.split('\n', 1)[0].trim();
  if (!nom) continue;
  const m = bloc.match(/\*\*Consigne IA prête à l'emploi\*\*\s*:\s*([\s\S]+?)(?:\n\n|$)/);
  if (!m) { console.warn(`(pas de consigne trouvée pour « ${nom} »)`); continue; }
  parDoc.set(norm(nom), { nom, consigne: m[1].trim() });
}
console.log(`Document : ${parDoc.size} artiste(s) avec consigne.`);

// ----- 2. Sauvegarde de la base -----
if (!DRY) {
  const dossierBackup = path.join(path.dirname(DB_PATH), 'Sauvegardes');
  fs.mkdirSync(dossierBackup, { recursive: true });
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const dest = path.join(dossierBackup, `galerie-avant-consignes-ia-${stamp}.db`);
  fs.copyFileSync(DB_PATH, dest);
  console.log('Sauvegarde :', dest);
}

// ----- 3. Apparier et écrire -----
const db = new DatabaseSync(DB_PATH);
const artistes = db.prepare('SELECT id, prenom, nom FROM artistes').all();
const upd = db.prepare("UPDATE artistes SET instructions_ia = ?, modifie_le = datetime('now') WHERE id = ?");

const utilises = new Set();
let n = 0;
const nonApparies = [];

if (!DRY) db.exec('BEGIN');
try {
  for (const a of artistes) {
    const complet = `${a.prenom || ''} ${a.nom || ''}`.trim();
    const cle = parDoc.has(norm(complet)) ? norm(complet)
      : (parDoc.has(norm(a.nom)) ? norm(a.nom) : null);
    if (!cle) { nonApparies.push(complet); continue; }
    const { nom, consigne } = parDoc.get(cle);
    utilises.add(cle);
    console.log(`  ✓ ${complet}  ←  « ${nom} »  (${consigne.length} car.)`);
    if (!DRY) { upd.run(consigne, a.id); n++; }
  }
  if (!DRY) db.exec('COMMIT');
} catch (e) {
  if (!DRY) db.exec('ROLLBACK');
  console.error('Échec, annulé :', e.message);
  process.exit(1);
}

console.log(`\n${DRY ? '(DRY) ' : ''}${n} artiste(s) mis à jour.`);
if (nonApparies.length) console.log('Artistes de la base sans consigne (laissés tels quels) :', nonApparies.join(', '));
const inutilises = [...parDoc.values()].filter((v) => !utilises.has(norm(v.nom))).map((v) => v.nom);
if (inutilises.length) console.log('Consignes du document non appariées :', inutilises.join(', '));
