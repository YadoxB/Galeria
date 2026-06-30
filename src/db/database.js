const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { getDbPath, getSeedPath, ensureDirectories } = require('./paths');
const { migrer } = require('./migrations');

let db = null;

function openDatabase() {
  if (db) return db;

  ensureDirectories();

  if (!fs.existsSync(getDbPath()) && fs.existsSync(getSeedPath())) {
    fs.copyFileSync(getSeedPath(), getDbPath());
  }

  db = new DatabaseSync(getDbPath());
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  migrer(db);

  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Lit meta.catalogue_id d'un fichier de base (lecture seule), ou null si absent
// (table meta inexistante, pas de ligne, base illisible). Sert à comparer le
// catalogue embarqué (seed) et celui de la base de l'utilisateur.
function lireCatalogueId(dbFilePath) {
  if (!dbFilePath || !fs.existsSync(dbFilePath)) return null;
  let d = null;
  try {
    d = new DatabaseSync(dbFilePath, { readOnly: true });
    const row = d.prepare("SELECT valeur FROM meta WHERE cle = 'catalogue_id'").get();
    return row && row.valeur ? row.valeur : null;
  } catch {
    return null;
  } finally {
    try { if (d) d.close(); } catch {}
  }
}

// Inspecte un fichier de base candidat (lecture seule) sans toucher à la base
// courante. Sert à valider une sauvegarde avant restauration et à montrer son
// contenu. Renvoie { ok:true, artistes, oeuvres, clients, ventes } ou
// { ok:false, erreur }. Un fichier chiffré (.enc) ou corrompu échoue ici.
function inspecterFichierBase(dbFilePath) {
  if (!dbFilePath || !fs.existsSync(dbFilePath)) return { ok: false, erreur: 'Fichier introuvable.' };
  let d = null;
  try {
    d = new DatabaseSync(dbFilePath, { readOnly: true });
    const n = (table) => d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    return { ok: true, artistes: n('artistes'), oeuvres: n('oeuvres'), clients: n('clients'), ventes: n('ventes') };
  } catch (e) {
    return { ok: false, erreur: "Ce fichier n'est pas une base de données Galeria valide (ou il est chiffré)." };
  } finally {
    try { if (d) d.close(); } catch {}
  }
}

function getStats() {
  const d = openDatabase();
  const count = (table) => d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  return {
    dbPath: getDbPath(),
    artistes: count('artistes'),
    oeuvres: count('oeuvres'),
    clients: count('clients'),
    ventes: count('ventes'),
  };
}

module.exports = { openDatabase, closeDatabase, getStats, lireCatalogueId, inspecterFichierBase };
