// Sépare les dimensions des œuvres rédigées en texte libre vers les colonnes
// numériques hauteur / largeur / profondeur (en pouces), puis régénère le
// champ texte `dimensions` au format canonique de l'app (« H × L × P po »).
//
// Usage :
//   node scripts/separer-dimensions.js              → aperçu (dry-run, défaut)
//   node scripts/separer-dimensions.js --execute    → écrit en base
//
// Règles (décidées avec Dave, 2026-06-17) :
//   - Ne touche que les œuvres où H, L et P sont tous NULL et où `dimensions`
//     contient du texte.
//   - Profondeur absente (notée « - » dans le texte) → reste NULL (la
//     profondeur est facultative ; « inconnu » ≠ « zéro »).
//   - Une œuvre est migrée seulement si H ET L sont tous deux exploitables.
//     Sinon elle est listée comme « à traiter manuellement » et n'est pas
//     touchée.
//   - Format et orientation NE sont PAS modifiés (déjà remplis depuis Airtable).
//   - Le texte `dimensions` est régénéré au format de l'app via la même
//     logique que `formaterDimensionsTexte` (oeuvre-fiche.js).
//
// Sécurités :
//   - En dry-run, n'écrit rien.
//   - En --execute, fait une sauvegarde de la base avant toute écriture.

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ARGS = new Set(process.argv.slice(2));
const EXECUTE = ARGS.has('--execute');

const dbPath = path.join(os.homedir(), 'Documents', 'Galeria', 'galerie.db');

// --- Parsing d'un jeton numérique : « .75 », « 30 », « 19,5 » → nombre, sinon null
function parseNombre(jeton) {
  if (jeton == null) return null;
  const t = String(jeton).trim().replace(',', '.');
  if (t === '' || t === '-' || t === "'-" || t === '?') return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// --- Découpe « 30 × 36 × .75 po (H × L × P) » → { h, l, p }
function decouperDimensions(texte) {
  if (!texte) return null;
  // On retire le suffixe explicatif entre parenthèses, puis l'unité « po ».
  let s = String(texte).split('(')[0];
  s = s.replace(/\bpo\b/gi, '');
  // Séparateurs possibles : × (U+00D7) ou x/X minuscule.
  const jetons = s.split(/[×xX]/).map((j) => j.trim());
  if (jetons.length < 2) return null;
  const h = parseNombre(jetons[0]);
  const l = parseNombre(jetons[1]);
  const p = jetons.length >= 3 ? parseNombre(jetons[2]) : null;
  return { h, l, p };
}

// --- Réplique exacte de formaterDimensionsTexte (oeuvre-fiche.js)
function formaterDimensionsTexte(h, l, p) {
  const arr = [h, l, p].map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const visibles = arr[2] != null ? arr : arr.slice(0, 2);
  if (!visibles.some((v) => v != null)) return '';
  return visibles.map((v) => (v != null ? String(v) : '?')).join(' × ') + ' po';
}

if (!fs.existsSync(dbPath)) {
  console.error(`Base introuvable : ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const rows = db.prepare(`
  SELECT id, titre, dimensions
  FROM oeuvres
  WHERE dimensions IS NOT NULL AND TRIM(dimensions) <> ''
    AND hauteur IS NULL AND largeur IS NULL AND profondeur IS NULL
  ORDER BY id
`).all();

if (!rows.length) {
  console.log('Aucune œuvre à migrer. Tout est déjà séparé.');
  db.close();
  process.exit(0);
}

console.log(`Mode : ${EXECUTE ? 'EXÉCUTION' : 'DRY-RUN (aperçu uniquement)'}`);
console.log(`${rows.length} œuvre(s) candidate(s).\n`);

const aTraiter = [];
const manuels = []; // H ou L manquant / non exploitable

for (const r of rows) {
  const d = decouperDimensions(r.dimensions);
  if (!d || d.h == null || d.l == null) {
    manuels.push({ id: r.id, titre: r.titre, avant: r.dimensions, parse: d });
    continue;
  }
  aTraiter.push({
    id: r.id,
    titre: r.titre,
    avant: r.dimensions,
    h: d.h,
    l: d.l,
    p: d.p,
    texte: formaterDimensionsTexte(d.h, d.l, d.p),
  });
}

console.log(`À migrer : ${aTraiter.length}   |   À traiter manuellement : ${manuels.length}\n`);

console.log('Migration proposée (15 premiers + tout cas profondeur nulle) :');
console.log('-'.repeat(90));
let affiches = 0;
for (const l of aTraiter) {
  const sansP = l.p == null;
  if (affiches < 15 || sansP) {
    console.log(
      `  #${String(l.id).padStart(4)} | "${l.avant}" → H=${l.h} L=${l.l} P=${l.p ?? '∅'} | texte: "${l.texte}"`
    );
    affiches++;
  }
}
console.log('-'.repeat(90));
console.log(`(${aTraiter.length} au total ; affichage tronqué)\n`);

if (manuels.length) {
  console.log('⚠ À traiter manuellement dans l\'app (H ou L manquant / illisible) :');
  for (const m of manuels) {
    console.log(`  #${String(m.id).padStart(4)} | "${m.avant}" — "${m.titre}"`);
  }
  console.log('');
}

if (!EXECUTE) {
  console.log('Dry-run terminé. Pour appliquer ces changements :');
  console.log('  node scripts/separer-dimensions.js --execute');
  db.close();
  process.exit(0);
}

// Sauvegarde de la base avant écriture
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const sauvegardePath = path.join(path.dirname(dbPath), `galerie-avant-separation-dimensions-${stamp}.db`);
fs.copyFileSync(dbPath, sauvegardePath);
console.log(`\nSauvegarde créée : ${sauvegardePath}`);

const upd = db.prepare(`
  UPDATE oeuvres
  SET hauteur = ?, largeur = ?, profondeur = ?, dimensions = ?, modifie_le = datetime('now')
  WHERE id = ?
`);
let n = 0;
db.exec('BEGIN');
try {
  for (const l of aTraiter) {
    upd.run(l.h, l.l, l.p, l.texte, l.id);
    n++;
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Échec, rollback effectué.', e);
  db.close();
  process.exit(2);
}

console.log(`\n✓ ${n} œuvre(s) migrée(s).`);
if (manuels.length) {
  console.log(`${manuels.length} à traiter à la main dans l'app (voir liste ci-dessus).`);
}

db.close();
