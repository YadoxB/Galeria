const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { getDbPath, getBackupsDir, ensureDirectories } = require('./paths');
const { openDatabase } = require('./database');
const { obtenirConfig } = require('../config');

// ===== État des sauvegardes (depuis le démarrage de l'app) =====
// Consulté par les Réglages et par le processus principal pour avertir
// l'utilisateur : plus aucun échec de sauvegarde ne doit passer inaperçu.
const etat = {
  derniere_reussite: null,   // ISO
  dernier_fichier: null,     // chemin de la dernière copie réussie
  dernier_echec: null,       // ISO
  dernier_message: null,     // message du dernier échec
  repli: false,              // true si la dernière copie est allée au dossier par défaut
};

function obtenirEtatSauvegardes() {
  return { ...etat };
}

// Dossier de destination : le dossier personnalisé s'il est utilisable, sinon
// repli sur le dossier par défaut (Documents\Galeria\Sauvegardes) — une clé
// USB retirée ne doit pas priver l'utilisateur de sauvegardes.
function dossierBackupActif() {
  const c = obtenirConfig().sauvegardes;
  if (c.dossier && c.dossier.trim()) {
    try {
      fs.mkdirSync(c.dossier, { recursive: true });
      return { dir: c.dossier, repli: false };
    } catch (e) {
      console.error('Dossier de sauvegarde configuré inaccessible, repli sur le dossier par défaut :', e);
      return { dir: getBackupsDir(), repli: true };
    }
  }
  return { dir: getBackupsDir(), repli: false };
}

function retentionActive() { return obtenirConfig().sauvegardes.retention || 50; }
function intervalActif() {
  const min = obtenirConfig().sauvegardes.frequence_minutes || 60;
  return Math.max(1, min) * 60 * 1000;
}

function horodatage(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

function horodatageCompact(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Date réelle d'une sauvegarde : l'horodatage encodé dans son nom de fichier.
// On ne se fie PAS à la date de modification : Windows la préserve lors d'une
// copie, donc elle reflète le contenu de la base, pas le moment de la copie.
// Reconnaît `galerie-AAAA-MM-JJ_HH-MM-SS.db` et `galerie-…-AAAAMMJJ-HHMMSS.db`,
// avec ou sans suffixe d'unicité `-2` (deux copies dans la même seconde) ;
// repli sur la date de modification pour un nom inattendu.
function dateDeSauvegarde(nomFichier, mtimeMs) {
  let m = nomFichier.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-\d+)?\.db$/);
  if (!m) m = nomFichier.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-\d+)?\.db$/);
  if (m) {
    const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    if (Number.isFinite(t)) return t;
  }
  return mtimeMs;
}

// Toutes les sauvegardes disponibles (dossier par défaut + dossier
// personnalisé), triées de la plus récente à la plus ancienne.
function listerSauvegardes() {
  const dossiers = [getBackupsDir()];
  try {
    const perso = obtenirConfig()?.sauvegardes?.dossier;
    if (perso && perso.trim() && path.resolve(perso.trim()) !== path.resolve(getBackupsDir())) {
      dossiers.push(perso.trim());
    }
  } catch {}
  const resultat = [];
  for (const dir of dossiers) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!/^galerie-.*\.db$/.test(f)) continue;
        const chemin = path.join(dir, f);
        const st = fs.statSync(chemin);
        resultat.push({
          chemin,
          nom: f,
          quand: dateDeSauvegarde(f, st.mtimeMs),
          taille: st.size,
          dossier: dir,
          personnalise: dir !== getBackupsDir(),
        });
      }
    } catch {}
  }
  resultat.sort((a, b) => b.quand - a.quand);
  return resultat;
}

// Vérification d'une copie : taille non nulle + test d'intégrité rapide en
// lecture seule. Une copie invalide est supprimée (une fausse assurance est
// pire que pas de copie) et l'erreur est remontée.
function verifierCopie(dest) {
  let raison = null;
  try {
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      raison = 'le fichier est vide ou absent';
    } else {
      let d = null;
      try {
        d = new DatabaseSync(dest, { readOnly: true });
        const r = d.prepare('PRAGMA quick_check').get();
        if (!r || r.quick_check !== 'ok') raison = `test d'intégrité : ${r ? r.quick_check : 'aucun résultat'}`;
      } finally {
        try { if (d) d.close(); } catch {}
      }
    }
  } catch (e) {
    raison = e.message;
  }
  if (raison) {
    try { fs.rmSync(dest, { force: true }); } catch {}
    throw new Error(`La copie de sauvegarde n'a pas pu être vérifiée (${raison}).`);
  }
}

// Copie via VACUUM INTO : snapshot cohérent produit par SQLite lui-même
// (indépendant de l'état du journal WAL), compacté au passage. Synchrone —
// requis pour la sauvegarde à la fermeture (before-quit).
function copierBaseVers(dest) {
  const db = openDatabase();
  if (fs.existsSync(dest)) throw new Error(`Le fichier de sauvegarde existe déjà : ${dest}`);
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  verifierCopie(dest);
}

function rotation(dir, keep = retentionActive()) {
  if (!fs.existsSync(dir)) return;
  const fichiers = fs
    .readdirSync(dir)
    .filter((f) => /^galerie-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-\d+)?\.db$/.test(f))
    .map((f) => ({ p: path.join(dir, f), quand: dateDeSauvegarde(f, 0) }))
    .sort((a, b) => b.quand - a.quand);
  for (const f of fichiers.slice(keep)) {
    try {
      fs.unlinkSync(f.p);
    } catch {}
  }
}

// Limite les copies spéciales d'une même famille (avant-import, avant-migration…)
// aux `keep` plus récentes — elles ne passent pas par la rotation normale.
function purgerFamille(dir, prefixe, keep) {
  try {
    const fichiers = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(prefixe) && /\.db$/.test(f))
      .map((f) => ({ f, quand: dateDeSauvegarde(f, 0) }))
      .sort((a, b) => b.quand - a.quand);
    for (const { f } of fichiers.slice(keep)) {
      try { fs.rmSync(path.join(dir, f), { force: true }); } catch {}
      for (const suffixe of ['-wal', '-shm']) {
        try { fs.rmSync(path.join(dir, f + suffixe), { force: true }); } catch {}
      }
    }
  } catch {}
}

function sauvegarder() {
  ensureDirectories();
  const { dir, repli } = dossierBackupActif();
  try {
    const dest = cheminLibre(path.join(dir, `galerie-${horodatage()}.db`));
    copierBaseVers(dest);
    rotation(dir);
    etat.derniere_reussite = new Date().toISOString();
    etat.dernier_fichier = dest;
    etat.repli = repli;
    return { path: dest, repli };
  } catch (e) {
    etat.dernier_echec = new Date().toISOString();
    etat.dernier_message = e.message;
    throw e;
  }
}

// Chemin libre : ajoute -2, -3… au besoin (deux copies dans la même seconde).
function cheminLibre(dest) {
  if (!fs.existsSync(dest)) return dest;
  for (let i = 2; i < 100; i++) {
    const variante = dest.replace(/\.db$/, `-${i}.db`);
    if (!fs.existsSync(variante)) return variante;
  }
  throw new Error('Impossible de trouver un nom de fichier libre pour la sauvegarde.');
}

// Copie spéciale nommée (avant-import, avant-restauration…), toujours dans le
// dossier par défaut, hors rotation normale, limitée aux 5 plus récentes.
function sauvegarderSous(prefixe) {
  ensureDirectories();
  const dir = getBackupsDir();
  const dest = cheminLibre(path.join(dir, `galerie-${prefixe}-${horodatageCompact()}.db`));
  copierBaseVers(dest);
  purgerFamille(dir, `galerie-${prefixe}-`, 5);
  return dest;
}

// Copie brute AVANT l'ouverture de la base (donc avant toute migration de
// schéma), quand la version de l'app a changé depuis le dernier démarrage.
// La base a normalement été fermée proprement (journal WAL vidé) ; par
// prudence après un arrêt brutal, les restes -wal/-shm sont copiés à côté
// sous les noms attendus par SQLite. Limité aux 3 plus récentes.
function sauvegardeAvantMigrationSiNouvelleVersion(versionCourante) {
  const cfg = obtenirConfig();
  const derniere = cfg.derniere_version_app || '';
  if (derniere === versionCourante) return null;
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return null;
  ensureDirectories();
  const dir = getBackupsDir();
  const nom = `galerie-avant-migration-${horodatageCompact()}.db`;
  const dest = path.join(dir, nom);
  fs.copyFileSync(dbPath, dest);
  for (const suffixe of ['-wal', '-shm']) {
    try {
      if (fs.existsSync(dbPath + suffixe) && fs.statSync(dbPath + suffixe).size > 0) {
        fs.copyFileSync(dbPath + suffixe, dest + suffixe);
      }
    } catch {}
  }
  purgerFamille(dir, 'galerie-avant-migration-', 3);
  return dest;
}

let intervalHandle = null;
function demarrerSauvegardePeriodique(onEvenement = null) {
  arreterSauvegardePeriodique();
  intervalHandle = setInterval(() => {
    try {
      const r = sauvegarder();
      if (onEvenement) onEvenement({ type: r.repli ? 'repli' : 'ok', path: r.path });
    } catch (e) {
      console.error('Sauvegarde automatique échouée :', e);
      if (onEvenement) onEvenement({ type: 'echec', message: e.message });
    }
  }, intervalActif());
}
function arreterSauvegardePeriodique() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  sauvegarder,
  sauvegarderSous,
  sauvegardeAvantMigrationSiNouvelleVersion,
  listerSauvegardes,
  dateDeSauvegarde,
  obtenirEtatSauvegardes,
  demarrerSauvegardePeriodique,
  arreterSauvegardePeriodique,
};
