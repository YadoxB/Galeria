// Garder les photos à leur place, pour toujours.
//
// La migration (migrer-photos.js) range le dossier UNE fois. Ce module le
// garde rangé : dès qu'une œuvre change de statut, sa photo doit suivre —
// c'est le cœur de la méthode de suivi des parents, qui lisent l'emplacement
// d'un fichier pour savoir où en est une toile.
//
// ─────────────────────────────────────────────────────────────────────────
// POURQUOI UNE RÉCONCILIATION PLUTÔT QUE DES CROCHETS
//
// Le statut d'une œuvre change à une quinzaine d'endroits : vente, annulation
// de vente, réservation, retrait, réintégration, départ et retour
// d'exposition, modification simple, modification par lot… Brancher un
// déplacement sur chacun, c'est en oublier un — et un oubli ne se voit pas :
// la photo reste simplement au mauvais endroit pendant des mois.
//
// On compare donc, pour chaque œuvre, l'emplacement RÉEL de sa photo à
// l'emplacement ATTENDU d'après son statut, et on ne bouge que l'écart. Cette
// comparaison coûte une chaîne de caractères par œuvre : on peut la lancer à
// chaque démarrage sur les 506 œuvres sans que personne ne s'en aperçoive.
//
// JAMAIS BLOQUANT. Un fichier verrouillé par l'Explorateur, une
// synchronisation OneDrive en cours, un antivirus : aucune de ces situations
// ne doit faire échouer une VENTE. On note l'échec, la base reste juste, et le
// prochain démarrage réessaiera.
// ─────────────────────────────────────────────────────────────────────────

const fs = require('node:fs');
const path = require('node:path');
const { getPhotosDir } = require('./paths');
const C = require('../photos-chemins');

const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');

// Déplace un fichier en évitant d'écraser quoi que ce soit. Renvoie le chemin
// relatif final, ou null si le déplacement n'a pas pu se faire.
function deplacer(deRel, versRel) {
  const racine = getPhotosDir();
  const source = path.join(racine, deRel);
  if (!fs.existsSync(source)) return null;

  // Un homonyme à destination : on suffixe plutôt que d'écraser. Deux photos
  // d'artistes différents peuvent porter le même nom de fichier.
  let finalRel = versRel;
  let dest = path.join(racine, finalRel);
  if (fs.existsSync(dest)) {
    const ext = path.extname(versRel);
    const base = versRel.slice(0, -ext.length || undefined);
    let n = 2;
    while (fs.existsSync(path.join(racine, `${base} (${n})${ext}`)) && n < 100) n++;
    finalRel = `${base} (${n})${ext}`;
    dest = path.join(racine, finalRel);
    if (fs.existsSync(dest)) return null;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    // Même volume : renommage instantané, et atomique.
    fs.renameSync(source, dest);
  } catch {
    // Volumes différents, ou verrou : copie puis suppression.
    try {
      fs.copyFileSync(source, dest);
      if (fs.statSync(source).size !== fs.statSync(dest).size) {
        try { fs.unlinkSync(dest); } catch {}
        return null;
      }
      fs.unlinkSync(source);
    } catch {
      return null;
    }
  }
  return finalRel;
}

// Crée les sept sous-dossiers d'un artiste. Sans bruit s'ils existent déjà.
function preparerDossiers(artiste) {
  const racine = getPhotosDir();
  for (const d of C.sousDossiersArtiste(artiste)) {
    try { fs.mkdirSync(path.join(racine, d), { recursive: true }); } catch {}
  }
}

// Range les photos des œuvres dont l'emplacement ne correspond plus au statut.
// `ids` : se limiter à ces œuvres (après une vente, par exemple). Sans `ids`,
// tout le catalogue est passé en revue.
function rangerPhotos(db, { ids = null } = {}) {
  const resultat = { verifiees: 0, deplacees: 0, echecs: 0, details: [] };
  let lignes;
  try {
    const where = Array.isArray(ids) && ids.length
      ? `AND o.id IN (${ids.map(() => '?').join(',')})`
      : '';
    lignes = db.prepare(`
      SELECT o.id, o.statut, o.archive, o.image_path,
             a.prenom, a.nom
      FROM oeuvres o JOIN artistes a ON a.id = o.artiste_id
      WHERE o.image_path IS NOT NULL AND TRIM(o.image_path) <> '' ${where}
    `).all(...(where ? ids : []));
  } catch {
    return resultat;
  }

  for (const o of lignes) {
    resultat.verifiees++;
    const attendu = C.cheminOeuvre(o, o, C.nomFichier(o.image_path));
    if (norm(o.image_path) === norm(attendu)) continue;

    const arrive = deplacer(o.image_path, attendu);
    if (!arrive) {
      resultat.echecs++;
      resultat.details.push(`${o.image_path} → ${attendu}`);
      continue;
    }
    try {
      db.prepare('UPDATE oeuvres SET image_path = ? WHERE id = ?').run(arrive, o.id);
      resultat.deplacees++;
    } catch {
      // La base n'a pas pris : on remet le fichier d'où il vient, sinon elle
      // pointerait dans le vide.
      deplacer(arrive, o.image_path);
      resultat.echecs++;
    }
  }
  return resultat;
}

// Une seule œuvre — après une vente, un retrait, un départ en exposition.
function rangerPhotoOeuvre(db, oeuvreId) {
  const id = Number(oeuvreId);
  if (!Number.isFinite(id)) return { verifiees: 0, deplacees: 0, echecs: 0, details: [] };
  return rangerPhotos(db, { ids: [id] });
}

// Un artiste renommé : son dossier doit suivre, sinon la correction d'une
// faute de frappe créerait un deuxième dossier et séparerait ses photos en
// deux endroits.
function renommerDossierArtiste(db, artisteId, ancienNomDossier) {
  const resultat = { deplacees: 0, echecs: 0 };
  const a = db.prepare('SELECT id, prenom, nom FROM artistes WHERE id = ?').get(Number(artisteId));
  if (!a) return resultat;
  const nouveau = C.dossierArtiste(a);
  const ancien = C.assainirNomDossier(ancienNomDossier || '');
  if (!ancien || !nouveau || ancien === nouveau) return resultat;

  preparerDossiers(a);

  // On déplace en suivant la BASE, pas le disque : chaque chemin qui commence
  // par l'ancien dossier est réécrit avec le nouveau, en gardant la structure
  // interne (Oeuvres/<statut>/, Portraits/…).
  const cibles = [
    ['oeuvres', 'image_path'],
    ['artistes', 'photo_path'],
    ['artistes', 'photo_originale_path'],
  ];
  for (const [table, col] of cibles) {
    let lignes = [];
    try {
      lignes = db.prepare(
        `SELECT id, ${col} AS chemin FROM ${table} WHERE ${col} IS NOT NULL AND TRIM(${col}) <> ''`
      ).all();
    } catch { continue; }
    for (const l of lignes) {
      const c = norm(l.chemin);
      if (!c.toLowerCase().startsWith(ancien.toLowerCase() + '/')) continue;
      const suite = c.slice(ancien.length + 1);
      const arrive = deplacer(c, `${nouveau}/${suite}`);
      if (!arrive) { resultat.echecs++; continue; }
      try {
        db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`).run(arrive, l.id);
        resultat.deplacees++;
      } catch {
        deplacer(arrive, c);
        resultat.echecs++;
      }
    }
  }

  // L'ancien dossier, une fois vidé (les sous-dossiers d'abord).
  const racine = getPhotosDir();
  const viderRecursif = (rel) => {
    const abs = path.join(racine, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) viderRecursif(`${rel}/${e.name}`);
    }
    try { if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs); } catch {}
  };
  viderRecursif(ancien);

  return resultat;
}

module.exports = { rangerPhotos, rangerPhotoOeuvre, renommerDossierArtiste, preparerDossiers };
