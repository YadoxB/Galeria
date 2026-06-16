// Sépare prénom / nom de famille des artistes dont le nom complet est encore
// dans la seule colonne `nom`. Approche : split sur le dernier groupe de mots,
// en gardant les particules ("de", "du", "von", etc.) avec le nom de famille.
//
// Usage :
//   node scripts/migrer-prenoms-noms.js              → aperçu (dry-run, défaut)
//   node scripts/migrer-prenoms-noms.js --execute    → écrit en base
//
// Sécurités :
//   - Ne touche que les artistes où prenom est vide ET nom contient un espace.
//   - En dry-run, n'écrit rien et affiche le plan.
//   - En --execute, fait une sauvegarde de la base avant toute écriture.

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ARGS = new Set(process.argv.slice(2));
const EXECUTE = ARGS.has('--execute');

const dbPath = path.join(os.homedir(), 'Documents', 'Galeria', 'galerie.db');

const PARTICULES = new Set([
  'de', 'du', 'des', 'la', 'le', 'les',
  'von', 'van', 'der', 'den',
  'di', 'da', 'do', 'dos', 'das',
  'al', 'el',
  "d'", 'l', // pour les apostrophes mangées
]);

function decouper(nomComplet) {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return null;

  // On commence par le dernier mot comme nom, et on remonte en absorbant les
  // particules. On s'arrête au premier mot non-particule en remontant.
  let idxDebutNom = mots.length - 1;
  while (idxDebutNom > 1) {
    const motPrecedent = mots[idxDebutNom - 1].toLowerCase().replace(/[.,;]+$/, '');
    if (PARTICULES.has(motPrecedent) || PARTICULES.has(motPrecedent.replace(/'$/, ''))) {
      idxDebutNom--;
    } else {
      break;
    }
  }

  const prenom = mots.slice(0, idxDebutNom).join(' ');
  const nom = mots.slice(idxDebutNom).join(' ');
  return { prenom, nom };
}

if (!fs.existsSync(dbPath)) {
  console.error(`Base introuvable : ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const rows = db.prepare(`
  SELECT id, nom, prenom
  FROM artistes
  WHERE (prenom IS NULL OR TRIM(prenom) = '')
    AND nom LIKE '% %'
  ORDER BY nom COLLATE NOCASE
`).all();

if (!rows.length) {
  console.log('Aucun artiste à migrer. Tout est déjà au bon format.');
  db.close();
  process.exit(0);
}

console.log(`Mode : ${EXECUTE ? 'EXÉCUTION' : 'DRY-RUN (aperçu uniquement)'}`);
console.log(`${rows.length} artiste(s) à séparer.\n`);

const aTraiter = [];
const ambigus = [];
const sautes = [];

for (const r of rows) {
  // Skipper les noms d'artiste à pseudonyme avec parenthèses ou guillemets — trop
  // varié pour un découpage automatique fiable.
  if (/[()«»"]/.test(r.nom)) {
    sautes.push({ id: r.id, avant: r.nom, raison: 'parenthèses/guillemets (pseudonyme)' });
    continue;
  }
  const d = decouper(r.nom);
  if (!d) continue;
  const ligne = {
    id: r.id,
    avant: r.nom,
    prenom: d.prenom,
    nom: d.nom,
  };
  // Cas considéré ambigu : 3+ mots, sans particule entre les deux derniers.
  // L'utilisateur devrait revérifier après.
  const mots = r.nom.trim().split(/\s+/);
  if (mots.length >= 3 && d.nom.split(/\s+/).length === 1) {
    ambigus.push(ligne);
  }
  aTraiter.push(ligne);
}

console.log('Découpage proposé :');
console.log('-'.repeat(80));
for (const l of aTraiter) {
  const marque = ambigus.find((a) => a.id === l.id) ? ' ⚠' : '  ';
  console.log(`${marque} #${String(l.id).padStart(4)} | "${l.avant}" → prénom: "${l.prenom}" | nom: "${l.nom}"`);
}
console.log('-'.repeat(80));

if (ambigus.length) {
  console.log(`\n⚠  ${ambigus.length} cas potentiellement ambigus (3+ mots sans particule). À revérifier après la migration en ouvrant chaque fiche dans l'app.`);
}

if (sautes.length) {
  console.log(`\nIgnoré(s) — à traiter manuellement dans l'app :`);
  for (const s of sautes) {
    console.log(`  #${String(s.id).padStart(4)} | "${s.avant}" — ${s.raison}`);
  }
}

if (!EXECUTE) {
  console.log(`\nDry-run terminé. Pour appliquer ces changements :`);
  console.log(`  node scripts/migrer-prenoms-noms.js --execute`);
  db.close();
  process.exit(0);
}

// Sauvegarde de la base avant écriture
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const sauvegardePath = path.join(path.dirname(dbPath), `galerie-avant-migration-prenoms-${stamp}.db`);
fs.copyFileSync(dbPath, sauvegardePath);
console.log(`\nSauvegarde créée : ${sauvegardePath}`);

const upd = db.prepare(`UPDATE artistes SET prenom = ?, nom = ?, modifie_le = datetime('now') WHERE id = ?`);
let n = 0;
db.exec('BEGIN');
try {
  for (const l of aTraiter) {
    upd.run(l.prenom, l.nom, l.id);
    n++;
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Échec, rollback effectué.', e);
  db.close();
  process.exit(2);
}

console.log(`\n✓ ${n} artiste(s) migré(s).`);
if (ambigus.length) {
  console.log(`Revois les ${ambigus.length} cas ambigus dans l'app pour confirmer.`);
}

db.close();
