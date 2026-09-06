// Migration UNIQUE du dossier Photos vers l'arborescence par artiste.
//
//   AVANT : Photos\artistes\<fichier>            (portraits, à plat)
//           Photos\artistes\originaux\<fichier>
//           Photos\oeuvres\<Artiste>\<fichier>
//
//   APRÈS : Photos\<Artiste>\Oeuvres\<statut>\<fichier>
//           Photos\<Artiste>\Portraits\<fichier>
//           Photos\<Artiste>\Portraits\originaux\<fichier>
//           Photos\<Artiste>\Divers\
//           Photos\_non-rattachés\               (fichiers sans artiste)
//
// Pourquoi ce classement : la méthode de suivi des parents repose sur
// l'EMPLACEMENT des photos. Voir src/photos-chemins.js.
//
// ─────────────────────────────────────────────────────────────────────────
// LES GARDE-FOUS, dans l'ordre où ils s'appliquent :
//
//   1. Ne s'exécute qu'UNE FOIS (PRAGMA user_version), et seulement si
//      l'ancienne arborescence est reconnue.
//   2. Un ESSAI À BLANC calcule tout le plan avant de toucher au disque. Si
//      deux photos veulent le MÊME chemin, on s'arrête sans rien modifier :
//      une collision ferait perdre une photo. En revanche un fichier ABSENT
//      du disque n'arrête rien — c'est un état déjà cassé, que la migration
//      ne peut ni réparer ni aggraver ; on le saute et on le compte.
//   3. COPIE, puis VÉRIFICATION (taille + empreinte), puis seulement
//      suppression de l'original. Jamais un déplacement sec.
//   4. La base n'est réécrite qu'APRÈS que tous les fichiers sont arrivés, en
//      une seule transaction. Un échec à mi-chemin laisse une base cohérente
//      qui pointe encore sur les anciens fichiers — lesquels sont toujours là.
//   5. Un JOURNAL est écrit à côté (photos-migration-<horodatage>.json) : il
//      permet de tout remettre en place (voir annulerMigrationPhotos).
// ─────────────────────────────────────────────────────────────────────────

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getPhotosDir, getDataDir } = require('./paths');
const C = require('../photos-chemins');

// Version de schéma à partir de laquelle la migration est faite.
const VERSION_PHOTOS = 4;

function empreinte(fichier) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(fichier));
  return h.digest('hex');
}

function horodatage() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');

// ---------------------------------------------------------------------------
// 1. LE PLAN — calculé entièrement avant de toucher au disque.
// ---------------------------------------------------------------------------
function construirePlan(db) {
  const racine = getPhotosDir();
  const artistes = db.prepare('SELECT id, prenom, nom, photo_path, photo_originale_path FROM artistes').all();
  const oeuvres = db.prepare('SELECT id, artiste_id, statut, archive, image_path FROM oeuvres').all();
  const parId = new Map(artistes.map((a) => [a.id, a]));

  const deplacements = []; // { de, vers, table, id, colonne }
  const problemes = []; // BLOQUANTS : la migration n'aura pas lieu
  const absents = [];   // signalés seulement : rien à déplacer, rien à casser
  const cibles = new Map(); // vers → source, pour détecter les collisions

  const ajouter = (de, vers, table, id, colonne) => {
    const source = path.join(racine, de);
    if (!fs.existsSync(source)) {
      // ⚠ NON BLOQUANT — corrigé le 2026-09-06 après un signalement des
      // parents. Leur base référençait des portraits d'artistes absents du
      // disque : la migration se refusait à CHAQUE démarrage, donc leurs
      // photos n'ont jamais été rangées, et l'erreur s'empilait dans le
      // journal sans que personne la voie.
      //
      // Un fichier manquant est un état DÉJÀ cassé, que la migration ne peut
      // ni réparer ni aggraver : on le saute et on le signale. Seules les
      // COLLISIONS restent bloquantes, parce qu'elles, elles feraient perdre
      // une photo.
      absents.push(de);
      return;
    }
    // Déjà à la bonne place (migration relancée après un échec partiel).
    if (norm(de) === norm(vers)) return;
    if (cibles.has(vers)) {
      problemes.push(`Deux photos se disputent ${vers} : ${cibles.get(vers)} et ${de}`);
      return;
    }
    cibles.set(vers, de);
    deplacements.push({ de, vers, table, id, colonne });
  };

  for (const a of artistes) {
    if (a.photo_path) {
      ajouter(a.photo_path, C.cheminPortrait(a, C.nomFichier(a.photo_path)), 'artistes', a.id, 'photo_path');
    }
    if (a.photo_originale_path) {
      ajouter(a.photo_originale_path, C.cheminPortraitOriginal(a, C.nomFichier(a.photo_originale_path)), 'artistes', a.id, 'photo_originale_path');
    }
  }
  for (const o of oeuvres) {
    if (!o.image_path) continue;
    const a = parId.get(o.artiste_id);
    if (!a) { problemes.push(`Œuvre ${o.id} sans artiste : ${o.image_path}`); continue; }
    ajouter(o.image_path, C.cheminOeuvre(a, o, C.nomFichier(o.image_path)), 'oeuvres', o.id, 'image_path');
  }

  // Fichiers présents sur le disque mais référencés par personne.
  const referencés = new Set();
  for (const a of artistes) {
    if (a.photo_path) referencés.add(norm(a.photo_path).toLowerCase());
    if (a.photo_originale_path) referencés.add(norm(a.photo_originale_path).toLowerCase());
  }
  for (const o of oeuvres) if (o.image_path) referencés.add(norm(o.image_path).toLowerCase());

  const orphelins = [];
  const parcourir = (rel) => {
    const abs = path.join(racine, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) parcourir(r);
      else if (!e.name.startsWith('.') && !referencés.has(norm(r).toLowerCase())) orphelins.push(r);
    }
  };
  parcourir('artistes');
  parcourir('oeuvres');

  return { deplacements, orphelins, problemes, absents, artistes };
}

// ---------------------------------------------------------------------------
// 2. L'EXÉCUTION
// ---------------------------------------------------------------------------
function migrerPhotos(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version >= VERSION_PHOTOS) return { fait: false, raison: 'déjà migré' };

  const racine = getPhotosDir();
  if (!fs.existsSync(racine)) {
    db.exec(`PRAGMA user_version = ${VERSION_PHOTOS}`);
    return { fait: false, raison: 'aucun dossier Photos' };
  }

  const plan = construirePlan(db);
  if (plan.problemes.length) {
    // On ne marque PAS la migration comme faite : elle sera retentée au
    // prochain démarrage, une fois le problème corrigé.
    console.error('[photos] migration annulée avant toute modification :');
    plan.problemes.slice(0, 10).forEach((p) => console.error('  ' + p));
    return { fait: false, raison: 'plan invalide', problemes: plan.problemes };
  }

  if (!plan.deplacements.length && !plan.orphelins.length) {
    db.exec(`PRAGMA user_version = ${VERSION_PHOTOS}`);
    return { fait: false, raison: 'rien à déplacer' };
  }

  const ts = horodatage();
  const journal = { horodatage: ts, deplacements: [], orphelins: [] };
  const faits = [];

  try {
    // Les dossiers d'abord, tous, même ceux qui resteront vides.
    for (const a of plan.artistes) {
      for (const d of C.sousDossiersArtiste(a)) {
        fs.mkdirSync(path.join(racine, d), { recursive: true });
      }
    }

    // Copie → vérification → suppression, fichier par fichier.
    for (const m of plan.deplacements) {
      const source = path.join(racine, m.de);
      const dest = path.join(racine, m.vers);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(source, dest);

      const tailleOk = fs.statSync(source).size === fs.statSync(dest).size;
      if (!tailleOk || empreinte(source) !== empreinte(dest)) {
        try { fs.unlinkSync(dest); } catch {}
        throw new Error(`Copie non conforme : ${m.de}`);
      }
      fs.unlinkSync(source);
      faits.push(m);
      journal.deplacements.push({ de: m.de, vers: m.vers });
    }

    // Les orphelins vont dans _non-rattachés, en gardant leur nom.
    if (plan.orphelins.length) {
      const dossierOrph = path.join(racine, C.DOSSIER_ORPHELINS);
      fs.mkdirSync(dossierOrph, { recursive: true });
      for (const rel of plan.orphelins) {
        const source = path.join(racine, rel);
        if (!fs.existsSync(source)) continue;
        const dest = path.join(dossierOrph, C.nomFichier(rel));
        if (fs.existsSync(dest)) continue; // homonyme : on laisse l'original
        fs.copyFileSync(source, dest);
        if (empreinte(source) === empreinte(dest)) {
          fs.unlinkSync(source);
          journal.orphelins.push({ de: rel, vers: `${C.DOSSIER_ORPHELINS}/${C.nomFichier(rel)}` });
        } else {
          try { fs.unlinkSync(dest); } catch {}
        }
      }
    }

    // LA BASE EN DERNIER, en une seule transaction.
    db.exec('BEGIN');
    try {
      for (const m of plan.deplacements) {
        db.prepare(`UPDATE ${m.table} SET ${m.colonne} = ? WHERE id = ?`).run(m.vers, m.id);
      }
      db.exec(`PRAGMA user_version = ${VERSION_PHOTOS}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    // Les anciens dossiers, une fois vides.
    for (const d of ['artistes/originaux', 'artistes', 'oeuvres']) {
      supprimerSiVide(path.join(racine, d));
    }

    const cheminJournal = path.join(getDataDir(), `photos-migration-${ts}.json`);
    try { fs.writeFileSync(cheminJournal, JSON.stringify(journal, null, 2)); } catch {}

    return {
      fait: true,
      deplaces: journal.deplacements.length,
      orphelins: journal.orphelins.length,
      absents: plan.absents.length,
      journal: cheminJournal,
    };
  } catch (err) {
    // Remise en place de ce qui avait bougé : la base n'a pas encore été
    // touchée, elle pointe donc toujours sur les anciens chemins.
    for (const m of faits.reverse()) {
      const source = path.join(racine, m.vers);
      const dest = path.join(racine, m.de);
      try {
        if (fs.existsSync(source) && !fs.existsSync(dest)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(source, dest);
          fs.unlinkSync(source);
        }
      } catch { /* on continue : mieux vaut restaurer le reste */ }
    }
    console.error('[photos] migration échouée, fichiers remis en place :', err.message);
    return { fait: false, raison: 'échec', erreur: err.message };
  }
}

function supprimerSiVide(dir) {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch { /* pas grave : un dossier vide qui reste ne gêne personne */ }
}

// ---------------------------------------------------------------------------
// 3. LE CHEMIN DE RETOUR — remet la structure d'avant à partir du journal.
//     Appelé à la main (outil de dépannage), jamais au démarrage.
// ---------------------------------------------------------------------------
function annulerMigrationPhotos(db, cheminJournal) {
  const racine = getPhotosDir();
  const journal = JSON.parse(fs.readFileSync(cheminJournal, 'utf8'));
  let remis = 0;
  const tous = [...journal.deplacements, ...journal.orphelins];
  for (const m of tous.reverse()) {
    const source = path.join(racine, m.vers);
    const dest = path.join(racine, m.de);
    if (!fs.existsSync(source) || fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
    if (empreinte(source) === empreinte(dest)) { fs.unlinkSync(source); remis++; }
  }
  db.exec('BEGIN');
  try {
    for (const m of journal.deplacements) {
      for (const [table, colonnes] of [['artistes', ['photo_path', 'photo_originale_path']], ['oeuvres', ['image_path']]]) {
        for (const col of colonnes) {
          db.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`).run(m.de, m.vers);
        }
      }
    }
    db.exec(`PRAGMA user_version = ${VERSION_PHOTOS - 1}`);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { remis };
}

module.exports = { migrerPhotos, annulerMigrationPhotos, construirePlan, VERSION_PHOTOS };
