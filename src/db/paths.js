const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const NOM_DOSSIER = 'Galeria';
const ANCIEN_NOM_DOSSIER = 'GalerieApp';

// Nom du « papier d'adresse » qui indique OÙ se trouve le dossier de données.
// Rangé HORS du dossier de données (voir cheminFichierEmplacement) — sinon on
// perdrait l'adresse en déplaçant le dossier.
const NOM_FICHIER_EMPLACEMENT = 'emplacement.json';
const NOM_FICHIER_DEPLACEMENT = 'deplacement-en-attente.json';

// Emplacement résolu pour la session (mémorisé au premier appel de getDataDir).
// Sources, dans l'ordre : (1) valeur posée par une migration de dossier ci-
// dessous, (2) emplacement personnalisé configuré (papier d'adresse), (3) défaut
// Documents\Galeria. Si le renommage GalerieApp → Galeria échoue (dossier
// verrouillé par l'Explorateur, OneDrive en cours de synchronisation…), on
// continue avec l'ancien dossier plutôt que de bloquer le démarrage ou de
// repartir sur un dossier vide.
let dossierDonneesResolu = null;

// Le papier d'adresse vit dans userData (AppData\Roaming\Galeria), un dossier
// technique de l'app que OneDrive NE redirige jamais — donc une ancre stable,
// contrairement à Documents. Il ne peut pas vivre dans le dossier de données
// lui-même : ce serait l'adresse rangée à l'intérieur de ce qu'elle localise.
function cheminFichierEmplacement() {
  return path.join(app.getPath('userData'), NOM_FICHIER_EMPLACEMENT);
}

// Demande de déplacement du dossier de données, déposée par l'écran Réglages
// juste avant un redémarrage. Rangée dans userData (comme le papier d'adresse)
// pour être lisible au tout début du démarrage, avant l'ouverture de la base et
// avant que le dossier ne bouge. Le déplacement est ensuite exécuté au démarrage.
function cheminDeplacementEnAttente() {
  return path.join(app.getPath('userData'), NOM_FICHIER_DEPLACEMENT);
}

function lireDeplacementEnAttente() {
  try {
    const p = cheminDeplacementEnAttente();
    if (!fs.existsSync(p)) return null;
    const obj = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const dest = obj && typeof obj.destination === 'string' ? obj.destination.trim() : '';
    return dest && path.isAbsolute(dest) ? dest : null;
  } catch (e) {
    console.error('Demande de déplacement illisible, ignorée :', e);
    return null;
  }
}

function ecrireDeplacementEnAttente(destination) {
  const p = cheminDeplacementEnAttente();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ destination: String(destination).trim() }, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}

function effacerDeplacementEnAttente() {
  try { fs.unlinkSync(cheminDeplacementEnAttente()); } catch {}
}

// Lit l'emplacement personnalisé configuré, ou null s'il n'y en a pas.
// NE LANCE JAMAIS d'exception (appelé au tout début du démarrage) : un papier
// illisible ⇒ on repart sur le défaut. NE VÉRIFIE PAS l'existence du dossier
// pointé : si le papier existe mais le dossier est absent (lecteur USB
// débranché, par exemple), on renvoie quand même le chemin configuré — le
// démarrage protégé affichera alors une erreur claire, plutôt que de repartir
// silencieusement sur Documents et d'y recréer une base vide.
function lireEmplacementConfigure() {
  try {
    const p = cheminFichierEmplacement();
    if (!fs.existsSync(p)) return null;
    const obj = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const dir = obj && typeof obj.dossierDonnees === 'string' ? obj.dossierDonnees.trim() : '';
    if (dir && path.isAbsolute(dir)) return dir;
    return null;
  } catch (e) {
    console.error("Fichier d'emplacement illisible, dossier par défaut utilisé :", e);
    return null;
  }
}

// Écrit (ou efface) le papier d'adresse de façon atomique (fichier temporaire
// puis rename), comme le fait config.js. Un chemin vide efface le pointeur (=
// retour au dossier par défaut). Utilisé par le déplacement de dossier (à venir
// au Pas C) ; aucun code de l'app ne l'appelle encore. Met à jour la valeur
// mémorisée pour la session.
function ecrireEmplacementConfigure(dir) {
  const p = cheminFichierEmplacement();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const propre = dir && String(dir).trim();
  if (!propre) {
    try { fs.unlinkSync(p); } catch {}
    dossierDonneesResolu = null;
    return;
  }
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ dossierDonnees: propre }, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
  dossierDonneesResolu = propre;
}

function getDataDir() {
  if (!dossierDonneesResolu) {
    dossierDonneesResolu =
      lireEmplacementConfigure() || path.join(app.getPath('documents'), NOM_DOSSIER);
  }
  return dossierDonneesResolu;
}

// Migration unique : si l'ancien dossier existe et le nouveau pas,
// renomme. Préserve DB, photos, sauvegardes, config et PDFs.
function migrerAncienDossierSiPresent() {
  // Ce renommage hérité ne concerne que l'emplacement PAR DÉFAUT (Documents).
  // Si l'utilisateur a configuré un emplacement personnalisé, on n'y touche pas.
  if (lireEmplacementConfigure()) return false;
  const ancien = path.join(app.getPath('documents'), ANCIEN_NOM_DOSSIER);
  const nouveau = path.join(app.getPath('documents'), NOM_DOSSIER);
  if (fs.existsSync(ancien) && !fs.existsSync(nouveau)) {
    try {
      fs.renameSync(ancien, nouveau);
      console.log(`Dossier migré : ${ANCIEN_NOM_DOSSIER} → ${NOM_DOSSIER}`);
    } catch (e) {
      console.error(
        `Renommage ${ANCIEN_NOM_DOSSIER} → ${NOM_DOSSIER} impossible, on continue avec l'ancien dossier :`,
        e
      );
      dossierDonneesResolu = ancien;
      return false;
    }
    dossierDonneesResolu = nouveau;
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

// Paquet unique des photos (toutes les images en un seul fichier). Embarqué via
// le dossier seed/. Préféré au dossier seed-photos/ : l'installateur ne pose
// qu'un fichier (rapide), et le déballage des centaines d'images se fait au 1er
// lancement avec la barre de progression du splash.
function getSeedPackPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'seed', 'photos.pack')
    : path.join(app.getAppPath(), 'seed', 'photos.pack');
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
  getSeedPackPath,
  ensureDirectories,
  cheminFichierEmplacement,
  lireEmplacementConfigure,
  ecrireEmplacementConfigure,
  cheminDeplacementEnAttente,
  lireDeplacementEnAttente,
  ecrireDeplacementEnAttente,
  effacerDeplacementEnAttente,
};
