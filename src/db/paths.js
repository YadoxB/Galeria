const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const NOM_DOSSIER = 'Galeria';
const ANCIEN_NOM_DOSSIER = 'GalerieApp';

function getDataDir() {
  return path.join(app.getPath('documents'), NOM_DOSSIER);
}

// Migration unique : si l'ancien dossier existe et le nouveau pas,
// renomme. Préserve DB, photos, sauvegardes, config et PDFs.
function migrerAncienDossierSiPresent() {
  const ancien = path.join(app.getPath('documents'), ANCIEN_NOM_DOSSIER);
  const nouveau = getDataDir();
  if (fs.existsSync(ancien) && !fs.existsSync(nouveau)) {
    fs.renameSync(ancien, nouveau);
    console.log(`Dossier migré : ${ANCIEN_NOM_DOSSIER} → ${NOM_DOSSIER}`);
    return true;
  }
  return false;
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

function getSeedPhotosPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'seed-photos')
    : path.join(app.getAppPath(), 'seed-photos');
}

function ensureDirectories() {
  // Migration de l'ancien dossier avant de créer les nouveaux (no-op si déjà migré)
  migrerAncienDossierSiPresent();
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
  getSeedPhotosPath,
  ensureDirectories,
};
