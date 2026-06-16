const fs = require('node:fs');
const path = require('node:path');
const { getDbPath, getBackupsDir, ensureDirectories } = require('./paths');
const { openDatabase } = require('./database');
const { obtenirConfig } = require('../config');

function dossierBackupActif() {
  const c = obtenirConfig().sauvegardes;
  if (c.dossier && c.dossier.trim()) {
    fs.mkdirSync(c.dossier, { recursive: true });
    return c.dossier;
  }
  return getBackupsDir();
}
function retentionActive() { return obtenirConfig().sauvegardes.retention || 50; }
function intervalActif() {
  const min = obtenirConfig().sauvegardes.frequence_minutes || 60;
  return Math.max(1, min) * 60 * 1000;
}

function horodatage() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

function rotation(keep = retentionActive()) {
  const dir = dossierBackupActif();
  if (!fs.existsSync(dir)) return;
  const fichiers = fs
    .readdirSync(dir)
    .filter((f) => /^galerie-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(f))
    .map((f) => {
      const p = path.join(dir, f);
      return { p, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  for (const f of fichiers.slice(keep)) {
    try {
      fs.unlinkSync(f.p);
    } catch {}
  }
}

function sauvegarder() {
  ensureDirectories();
  const dir = dossierBackupActif();
  fs.mkdirSync(dir, { recursive: true });
  const db = openDatabase();
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const dest = path.join(dir, `galerie-${horodatage()}.db`);
  fs.copyFileSync(getDbPath(), dest);
  rotation();
  return dest;
}

let intervalHandle = null;
function demarrerSauvegardePeriodique() {
  arreterSauvegardePeriodique();
  intervalHandle = setInterval(() => {
    try {
      sauvegarder();
    } catch (e) {
      console.error('Sauvegarde automatique échouée :', e);
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
  demarrerSauvegardePeriodique,
  arreterSauvegardePeriodique,
};
