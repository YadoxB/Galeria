// Analyse empirique des seuils de format à partir du catalogue existant.
// Lit chaque œuvre qui a déjà un `format` et un `dimensions` texte, extrait la
// plus grande dimension parsée, et sort la distribution par format.

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const os = require('node:os');

const dbPath = path.join(os.homedir(), 'Documents', 'Galeria', 'galerie.db');
const db = new DatabaseSync(dbPath);

const rows = db.prepare(`
  SELECT id, titre, format, dimensions
  FROM oeuvres
  WHERE format IS NOT NULL AND format != ''
    AND dimensions IS NOT NULL AND dimensions != ''
`).all();

function parseDimensions(texte) {
  if (!texte) return null;
  const t = String(texte).toLowerCase();

  // Unité : on cherche cm en premier ; sinon on assume pouces (po, ", inch).
  let unite = 'po';
  if (/\bcm\b|centim/.test(t)) unite = 'cm';

  // Extraction des nombres (avec décimales virgule ou point ; accepte ".75" comme 0.75)
  const nums = (t.match(/(?:\d+(?:[.,]\d+)?|[.,]\d+)/g) || [])
    .map((s) => parseFloat(s.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!nums.length) return null;

  // On garde max 3 dimensions
  const dims = nums.slice(0, 3);
  return { dims, unite };
}

const enPouces = (val, unite) => unite === 'cm' ? val / 2.54 : val;

const parFormat = new Map();
const sansParse = [];

for (const r of rows) {
  const parsed = parseDimensions(r.dimensions);
  if (!parsed) {
    sansParse.push(r);
    continue;
  }
  // On ignore la profondeur (3e valeur) pour le classement : c'est l'épaisseur du
  // cadre/châssis, presque toujours 0.75-1.5", non pertinente pour le format.
  const hl = parsed.dims.slice(0, 2).map((v) => enPouces(v, parsed.unite));
  if (hl.length < 1) continue;

  const maxPouces = Math.max(...hl);
  const minPouces = hl.length >= 2 ? Math.min(...hl) : hl[0];
  const moyPouces = hl.length >= 2 ? Math.sqrt(hl[0] * hl[1]) : hl[0]; // moyenne géométrique = côté équivalent
  const surfacePouces = hl.length >= 2 ? hl[0] * hl[1] : hl[0] * hl[0];

  if (!parFormat.has(r.format)) parFormat.set(r.format, []);
  parFormat.get(r.format).push({
    id: r.id, titre: r.titre, dimensions: r.dimensions, unite: parsed.unite,
    maxPouces, minPouces, moyPouces, surfacePouces,
  });
}

function quantile(sortedArr, q) {
  if (!sortedArr.length) return null;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  return sortedArr[base];
}

console.log(`Total œuvres avec format + dimensions parsables : ${rows.length - sansParse.length} / ${rows.length}`);
console.log(`Non parsables : ${sansParse.length}`);
console.log('');

const ordre = ['Petit', 'Moyen', 'Grand', 'Très grand'];
const tous = Array.from(parFormat.keys()).sort((a, b) => {
  const ia = ordre.indexOf(a), ib = ordre.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b);
});

// Pour chaque critère candidat, on calcule la distribution par format et
// on mesure le taux de chevauchement entre catégories adjacentes.
const CRITERES = [
  { cle: 'maxPouces',     libelle: 'Max (H, L)' },
  { cle: 'minPouces',     libelle: 'Min (H, L)' },
  { cle: 'moyPouces',     libelle: 'Moyenne géométrique √(H × L)' },
  { cle: 'surfacePouces', libelle: 'Surface (H × L) — en po²' },
];

function statistiques(liste) {
  const tri = [...liste].sort((a, b) => a - b);
  return {
    n: tri.length,
    min: tri[0],
    max: tri[tri.length - 1],
    q25: quantile(tri, 0.25),
    med: quantile(tri, 0.5),
    q75: quantile(tri, 0.75),
    q90: quantile(tri, 0.9),
  };
}

// Seuils proposés par critère = Q90 de chaque format
function proposerSeuils(critere) {
  const seuils = [];
  for (let i = 0; i < tous.length - 1; i++) {
    const liste = parFormat.get(tous[i]).map((x) => x[critere]);
    if (!liste.length) continue;
    const tri = [...liste].sort((a, b) => a - b);
    seuils.push({ nom: tous[i], seuil: quantile(tri, 0.9) });
  }
  return seuils;
}

// Classification d'une œuvre avec des seuils donnés
function classerAvecSeuils(valeur, seuilsOrdonnes) {
  for (const { nom, seuil } of seuilsOrdonnes) {
    if (valeur <= seuil) return nom;
  }
  return tous[tous.length - 1];
}

// Compter les œuvres correctement classées
function evaluerCritere(critere) {
  const seuils = proposerSeuils(critere);
  let correct = 0;
  let total = 0;
  const erreursParFormat = new Map();
  for (const f of tous) {
    erreursParFormat.set(f, { correct: 0, erreur: 0, exemplesErreur: [] });
  }
  for (const f of tous) {
    for (const o of parFormat.get(f)) {
      total++;
      const predit = classerAvecSeuils(o[critere], seuils);
      const stat = erreursParFormat.get(f);
      if (predit === f) {
        correct++;
        stat.correct++;
      } else {
        stat.erreur++;
        if (stat.exemplesErreur.length < 3) {
          stat.exemplesErreur.push({ ...o, predit });
        }
      }
    }
  }
  return { critere, seuils, correct, total, taux: (correct / total) * 100, erreursParFormat };
}

console.log('=====================================================');
console.log('COMPARAISON DES CRITÈRES DE CLASSIFICATION');
console.log('=====================================================\n');

const resultats = [];
for (const { cle, libelle } of CRITERES) {
  console.log(`\n>>> Critère : ${libelle} <<<\n`);
  console.log('Distribution par format :');
  for (const f of tous) {
    const s = statistiques(parFormat.get(f).map((x) => x[cle]));
    const unite = cle === 'surfacePouces' ? ' po²' : '"';
    console.log(`  ${f.padEnd(12)} n=${String(s.n).padStart(3)} | min ${s.min.toFixed(1)}${unite} | médiane ${s.med.toFixed(1)}${unite} | Q90 ${s.q90.toFixed(1)}${unite} | max ${s.max.toFixed(1)}${unite}`);
  }

  const eval_ = evaluerCritere(cle);
  resultats.push({ libelle, ...eval_ });
  console.log(`\nSeuils proposés (Q90) :`);
  for (const { nom, seuil } of eval_.seuils) {
    const unite = cle === 'surfacePouces' ? ' po²' : '"';
    console.log(`  ${nom} ≤ ${seuil.toFixed(1)}${unite}`);
  }
  console.log(`\nTaux de bonne classification : ${eval_.correct}/${eval_.total} (${eval_.taux.toFixed(1)} %)`);
}

console.log('\n=====================================================');
console.log('CLASSEMENT DES CRITÈRES');
console.log('=====================================================\n');
resultats.sort((a, b) => b.taux - a.taux);
for (const r of resultats) {
  console.log(`  ${r.taux.toFixed(1).padStart(5)} % — ${r.libelle}`);
}

console.log('\n=====================================================');
console.log('EXEMPLES D\'ERREURS DU MEILLEUR CRITÈRE');
console.log('=====================================================');
const meilleur = resultats[0];
for (const f of tous) {
  const stat = meilleur.erreursParFormat.get(f);
  if (!stat || stat.erreur === 0) continue;
  console.log(`\n${f} (${stat.correct} bons, ${stat.erreur} erreurs) — exemples :`);
  for (const o of stat.exemplesErreur) {
    console.log(`  Réel: ${f}, prédit: ${o.predit} | ${o.dimensions} | "${o.titre}"`);
  }
}

db.close();
