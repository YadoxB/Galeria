// Crée un seed/galerie.db VIDE pour la release publique : juste le schéma,
// aucune donnée. Une galerie qui installe la version publique de Galeria
// démarre sur un catalogue blanc.

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
const DEST_DIR = path.join(__dirname, '..', 'seed');
const DEST = path.join(DEST_DIR, 'galerie.db');

if (!fs.existsSync(SCHEMA)) {
  console.error(`Schéma introuvable : ${SCHEMA}`);
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
// Repart de zéro
try { fs.unlinkSync(DEST); } catch {}

const db = new DatabaseSync(DEST);
db.exec(fs.readFileSync(SCHEMA, 'utf-8'));
db.close();

const taille = (fs.statSync(DEST).size / 1024).toFixed(1);
console.log(`Seed vide créé : ${DEST} (${taille} Ko, schéma seul)`);
