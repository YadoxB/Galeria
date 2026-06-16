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

module.exports = { openDatabase, closeDatabase, getStats };
