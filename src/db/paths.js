const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

function getDataDir() {
  return path.join(app.getPath('documents'), 'GalerieApp');
}

function getBackupsDir() {
  return path.join(getDataDir(), 'Sauvegardes');
}

function getPhotosDir() {
  return path.join(getDataDir(), 'Photos');
}

function getDocumentsDir() {
  return path.join(getDataDir(), 'Documents');
}

function getDocumentsDirAnnee(annee) {
  return path.join(getDocumentsDir(), String(annee));
}

function getDbPath() {
  return path.join(getDataDir(), 'galerie.db');
}

function getSeedPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'seed', 'galerie.db')
    : path.join(app.getAppPath(), 'seed', 'galerie.db');
}

function ensureDirectories() {
  for (const dir of [getDataDir(), getBackupsDir(), getPhotosDir(), getDocumentsDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  getDataDir,
  getBackupsDir,
  getPhotosDir,
  getDocumentsDir,
  getDocumentsDirAnnee,
  getDbPath,
  getSeedPath,
  ensureDirectories,
};
