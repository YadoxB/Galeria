const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, net, shell, clipboard, nativeImage, screen, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openDatabase, closeDatabase, getStats, lireCatalogueId } = require('./db/database');
const { getPhotosDir, getDataDir, getDocumentsDirAnnee, getDbPath, getSeedPath, getBackupsDir, ensureDirectories } = require('./db/paths');
const { seedPhotosIfNeeded } = require('./db/seedPhotos');
const { choisirPhoto, effacerPhoto, lireFichierImage, lireOriginale, lirePourRecadrage, enregistrerImageRecadree } = require('./photos');
const { obtenirConfig, mettreAJourConfig, infoConfigCorrompue } = require('./config');

protocol.registerSchemesAsPrivileged([
  { scheme: 'galerie', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
const {
  sauvegarder,
  sauvegarderSous,
  sauvegardeAvantMigrationSiNouvelleVersion,
  listerSauvegardes,
  obtenirEtatSauvegardes,
  demarrerSauvegardePeriodique,
  arreterSauvegardePeriodique,
} = require('./db/backup');
const { previewFile, importArtistes, importOeuvres } = require('./import/importer');
const { genererCertificatPdf, genererFactureArtistePdf, genererRapportPdf, genererCataloguePdf, genererAnnexePdf, genererPresentationPdf, genererPresentationPersonnalisee, genererPochette, editerDocument, cheminPochetteSiExiste, infosDossierPochette, supprimerDossierPochette, indexerTousLesDocuments } = require('./pdf');
const {
  listerArtistes,
  obtenirArtiste,
  obtenirFicheArtisteBundle,
  voisinsArtiste,
  listerOeuvres,
  oeuvresDetailArtiste,
  oeuvresParIds,
  obtenirOeuvre,
  obtenirFicheOeuvreBundle,
  voisinsOeuvre,
  listerTypesOeuvre,
  listerMediumsOeuvre,
  listerMediumsArtiste,
  statsOeuvres,
  listerClients,
  obtenirClient,
  obtenirFicheClientBundle,
  voisinsClient,
  listerVentesClient,
  listerVentesOeuvre,
  listerVentes,
  obtenirVente,
  obtenirFicheVenteBundle,
  voisinsVente,
  listerCertificatsParOeuvre,
  listerCertificatsParVente,
  obtenirCertificat,
  oeuvresRecentes,
  ventesRecentes,
  oeuvresReservees,
  commandesNonCompletees,
  oeuvresAPreparer,
  ventesSuivi,
  tousLesDocuments,
  rapportJournalier,
  ventesParMois,
  statsTableauDeBord,
} = require('./db/requetes');
const {
  modifierArtiste, creerArtiste, supprimerArtiste,
  modifierOeuvre, creerOeuvre, modifierOeuvresLot, supprimerOeuvre, majPreparationOeuvre,
  modifierClient, creerClient, supprimerClient,
  creerVente, modifierVente, supprimerVente, majCycleVente,
  apercuProchainNumeroFacture, reserverProchainNumeroFacture,
  creerCertificat, modifierCertificat, supprimerCertificat,
  apercuProchainNumeroCertificat, reserverProchainNumeroCertificat,
  apercuNumeroCertificat,
  apercuProchainNumeroInventaire, reserverProchainNumeroInventaire,
  definirArchive, definirRetraitOeuvre, definirRetraitOeuvresLot,
  reserverOeuvre, libererOeuvre,
  rehausserCompteursSelonBase,
} = require('./db/mutations');

// ===== Journal d'erreurs + filets globaux du processus principal =====
// Toute erreur imprévue est consignée dans Documents\Galeria\erreurs.log et
// signalée en français, au lieu de laisser l'app disparaître ou rester figée
// sans explication.

function journaliserErreur(contexte, err) {
  try {
    const ligne = `[${new Date().toISOString()}] ${contexte} : ${err && err.stack ? err.stack : String(err)}\n`;
    fs.appendFileSync(path.join(getDataDir(), 'erreurs.log'), ligne, 'utf-8');
  } catch {}
}

// Une seule boîte de dialogue par tranche de 10 s, pour qu'une erreur qui se
// répète en boucle ne submerge pas l'utilisateur.
let dernierFiletMs = 0;
function filetErreurProcessus(origine, err) {
  journaliserErreur(origine, err);
  console.error(`${origine} :`, err);
  const maintenant = Date.now();
  if (maintenant - dernierFiletMs < 10000) return;
  dernierFiletMs = maintenant;
  try {
    dialog.showErrorBox(
      'Galeria — erreur imprévue',
      "Une erreur imprévue est survenue. L'opération en cours a peut-être échoué.\n"
      + "Si le problème se répète, fermez puis rouvrez l'application.\n\n"
      + `Détails techniques consignés dans :\n${path.join(getDataDir(), 'erreurs.log')}`
    );
  } catch {}
}

process.on('uncaughtException', (err) => filetErreurProcessus('Erreur non attrapée', err));
process.on('unhandledRejection', (raison) => filetErreurProcessus('Promesse rejetée non gérée', raison));

// Si la base a disparu (ou est un fichier vide) alors que des sauvegardes
// existent, proposer de restaurer la plus récente au lieu de repartir en
// silence sur une base vide — l'utilisateur croirait avoir tout perdu.
function proposerRestaurationSiBaseManquante(splash) {
  const dbPath = getDbPath();
  let taille = 0;
  try {
    if (fs.existsSync(dbPath)) taille = fs.statSync(dbPath).size;
  } catch {}
  if (taille > 0) return;

  const candidates = listerSauvegardes();
  if (!candidates.length) return; // vraie première installation : rien à proposer

  const recente = { p: candidates[0].chemin, quand: candidates[0].quand };
  const quand = new Date(recente.quand).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' });
  const options = {
    type: 'warning',
    title: 'Galeria',
    message: 'La base de données est introuvable.',
    detail:
      `Une sauvegarde du ${quand} a été trouvée.\n\n`
      + 'Voulez-vous la restaurer ?\n\n'
      + 'Si vous continuez sans restaurer, Galeria ouvrira un catalogue vide '
      + '(vos sauvegardes resteront disponibles).',
    buttons: ['Restaurer la sauvegarde', 'Continuer sans restaurer'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };
  const choix = (splash && !splash.isDestroyed())
    ? dialog.showMessageBoxSync(splash, options)
    : dialog.showMessageBoxSync(options);
  if (choix !== 0) return;

  // Mettre de côté un éventuel fichier vide/abîmé et les restes de journal,
  // puis restaurer la copie choisie.
  try {
    if (fs.existsSync(dbPath)) fs.renameSync(dbPath, `${dbPath}.remplace-${Date.now()}`);
  } catch {}
  for (const suffixe of ['-wal', '-shm']) {
    try { fs.rmSync(dbPath + suffixe, { force: true }); } catch {}
  }
  fs.copyFileSync(recente.p, dbPath);
  console.log(`Base restaurée depuis : ${recente.p}`);
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 600,
    height: 338,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0d1c34',
    icon: path.join(__dirname, '..', 'gabarits', 'actifs', 'icon-galeria.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'), {
    search: `v=${encodeURIComponent(app.getVersion())}`,
  });
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

function createWindow(splash) {
  // Adapte la taille à l'écran disponible pour que toute l'interface
  // (barre latérale comprise) reste visible, même sur un écran < 900 px de haut.
  const { width: dispW, height: dispH } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(1600, dispW),
    height: Math.min(900, dispH),
    minWidth: 1024,
    minHeight: 576,
    title: 'Galeria',
    backgroundColor: '#f8f5ef',
    icon: path.join(__dirname, '..', 'gabarits', 'actifs', 'icon-galeria.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  // Activation des DevTools via F12 ou Ctrl+Shift+I (raccourcis standards
  // Chromium désactivés par le menu null). Sert au débogage occasionnel.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.control && input.shift && (input.key === 'I' || input.key === 'i')) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('did-finish-load', () => {
    try {
      const cfg = require('./config').obtenirConfig();
      const zoom = Number(cfg?.affichage?.zoom);
      if (Number.isFinite(zoom) && zoom > 0) {
        win.webContents.setZoomFactor(zoom);
      }
    } catch {}
  });
  const fermerSplashEtAfficher = () => {
    if (splash && !splash.isDestroyed()) splash.destroy();
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  };

  win.once('ready-to-show', () => {
    if (!splash) {
      win.show();
      return;
    }
    const delaiMinSplashMs = 1200;
    const restant = delaiMinSplashMs - (Date.now() - (splash.__ouvertureMs || Date.now()));
    if (restant > 0) setTimeout(fermerSplashEtAfficher, restant);
    else fermerSplashEtAfficher();
  });

  // Filet de sécurité : si ready-to-show tarde (gabarit lourd, cache verrouillé,
  // erreur dans le renderer), on force l'affichage après 8 s pour ne jamais
  // rester coincé sur le splash.
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) fermerSplashEtAfficher();
  }, 8000);

  return win;
}

async function importChoisirFichier(senderWebContents) {
  const win = BrowserWindow.fromWebContents(senderWebContents);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choisir un fichier CSV à importer',
    filters: [{ name: 'Fichiers CSV', extensions: ['csv'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths || !filePaths.length) return { cancelled: true };

  const filePath = filePaths[0];
  let preview;
  try {
    preview = previewFile(filePath);
  } catch (e) {
    return { error: e.message };
  }
  return {
    path: filePath,
    nomFichier: path.basename(filePath),
    type: preview.type,
    count: preview.count,
    headers: preview.headers,
  };
}

function importExecuter(filePath, mode) {
  const preview = previewFile(filePath);
  if (!preview.type) throw new Error('Type de fichier non reconnu.');
  // Copie de sécurité avant d'écrire (promise par l'aide intégrée) : un
  // mauvais CSV en mode « Mettre à jour » devient réversible. Si la copie
  // échoue, l'import est refusé — pas d'écriture sans filet.
  try {
    sauvegarderSous('avant-import');
  } catch (e) {
    throw new Error(
      `La sauvegarde de sécurité avant l'import a échoué (${e.message}) — l'import a été annulé, rien n'a été modifié.`
    );
  }
  const db = openDatabase();
  return preview.type === 'artistes'
    ? importArtistes(db, preview.rows, mode)
    : importOeuvres(db, preview.rows, mode);
}

function sauvegarderEtRetourner() {
  const r = sauvegarder();
  return { path: r.path, nom: path.basename(r.path), dossier: path.dirname(r.path), repli: r.repli };
}

// Réaction aux sauvegardes périodiques : on n'avertit l'utilisateur que sur
// CHANGEMENT d'état (ok → échec, ok → repli, retour à la normale), pour
// qu'un problème durable ne déclenche pas une alerte à chaque heure.
let dernierEtatBackupNotifie = 'ok';
function surEvenementSauvegarde(evt) {
  if (evt.type === 'echec' || evt.type === 'repli') {
    journaliserErreur(
      evt.type === 'echec' ? 'Sauvegarde automatique échouée' : 'Sauvegarde automatique en repli',
      new Error(evt.message || evt.path || '')
    );
  }
  if (evt.type === dernierEtatBackupNotifie) return;
  dernierEtatBackupNotifie = evt.type;
  const messages = {
    echec: {
      niveau: 'error',
      titre: 'Sauvegarde automatique échouée',
      message:
        'La dernière sauvegarde automatique a échoué. Vos données ne sont pas '
        + 'perdues, mais aucune nouvelle copie de sécurité n\'a été créée.\n\n'
        + 'Vérifiez le dossier de sauvegarde dans Réglages → Sauvegardes.',
    },
    repli: {
      niveau: 'warning',
      titre: 'Dossier de sauvegarde inaccessible',
      message:
        'Le dossier de sauvegarde configuré est introuvable (clé USB retirée ?). '
        + 'Les copies vont pour l\'instant dans le dossier par défaut '
        + '(Documents\\Galeria\\Sauvegardes).',
    },
    ok: {
      niveau: 'succes',
      titre: 'Sauvegardes rétablies',
      message: 'Les sauvegardes automatiques fonctionnent de nouveau normalement.',
    },
  };
  const m = messages[evt.type];
  if (!m) return;
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('backup:alerte', m);
  }
}

function assemblerPromptIA({ oeuvre, artiste, config, avecImage = true }) {
  const sections = [];

  // Consignes générales de la galerie : champ éditable de Réglages → IA
  // (rempli par défaut avec le set global du document de consignes).
  const instGalerie = (config?.ia?.instructions_galerie || '').trim();
  if (instGalerie) {
    sections.push(`[Consignes de la galerie]\n${instGalerie}`);
  }

  const instArtiste = (artiste?.instructions_ia || '').trim();
  if (instArtiste) {
    sections.push(`[Consignes pour l'artiste ${artiste?.nom || ''}]\n${instArtiste}`);
  }

  const artisteNom = oeuvre.artiste_nom || artiste?.nom || '';
  const champs = [
    ['Titre', oeuvre.titre],
    ['Artiste', artisteNom],
    ['Type', oeuvre.type],
    ['Médium', oeuvre.medium],
    ['Support', oeuvre.support],
    ['Dimensions', oeuvre.dimensions],
    ['Année', oeuvre.annee],
    ['Sujets', oeuvre.sujets],
    ['Particularité', oeuvre.particularite],
    ['Emplacement de la signature', oeuvre.emplacement_signature],
  ];
  const lignes = champs
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `- ${k} : ${v}`);
  sections.push(`[Œuvre à décrire]\n${lignes.join('\n')}`);

  const descActuelle = (oeuvre.description || '').trim();
  if (descActuelle) {
    sections.push(`[Description actuelle, à retravailler]\n${descActuelle}`);
  }

  const mentionImage = avecImage
    ? "La photo de l'œuvre est jointe à ce message."
    : "(Aucune photo n'a encore été jointe — base-toi uniquement sur les caractéristiques ci-dessus.)";
  sections.push(
    `[Demande]\nRédige la description de cette œuvre pour sa fiche de catalogue, en respectant scrupuleusement les consignes ci-dessus (galerie et artiste), y compris la langue et le format demandés. ${
      descActuelle
        ? 'Retravaille la description actuelle ci-dessus en respectant les consignes.'
        : ''
    } ${mentionImage}`
  );

  return sections.join('\n\n');
}

function chargerImageDepuisChemin(cheminAbs) {
  if (!fs.existsSync(cheminAbs)) return { erreur: 'Fichier image introuvable sur le disque.' };
  const img = nativeImage.createFromPath(cheminAbs);
  if (img.isEmpty()) return { erreur: 'Image vide ou format non reconnu.' };
  const buf = fs.readFileSync(cheminAbs);
  const ext = path.extname(cheminAbs).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'jpeg' : (ext || 'png');
  return { img, dataUrl: `data:image/${mime};base64,${buf.toString('base64')}`, nom: path.basename(cheminAbs) };
}

function chargerImageDepuisDataUrl(dataUrl) {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return { erreur: 'Image en mémoire non reconnue.' };
  const buf = Buffer.from(m[2], 'base64');
  const img = nativeImage.createFromBuffer(buf);
  if (img.isEmpty()) return { erreur: 'Image vide ou format non reconnu.' };
  return { img, dataUrl, nom: `image.${m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()}` };
}

function ecrireDansPressePapier({ texte, image }) {
  let imageOk = false;
  if (image?.img) {
    try {
      clipboard.write({ text: texte, image: image.img });
      imageOk = true;
    } catch (err) {
      imageOk = false;
    }
  }
  if (!imageOk) clipboard.writeText(texte);
  return imageOk;
}

function determinerLien({ artiste, config }) {
  return (
    (artiste?.lien_chatgpt && String(artiste.lien_chatgpt).trim()) ||
    (config?.ia?.lien_chatgpt_defaut || 'https://chat.openai.com/')
  );
}

function preparerCopiePourChatGPT(oeuvreId) {
  const oeuvre = require('./db/requetes').obtenirOeuvre(oeuvreId);
  if (!oeuvre) throw new Error('Œuvre introuvable.');
  const artiste = require('./db/requetes').obtenirArtiste(oeuvre.artiste_id);
  const config = require('./config').obtenirConfig();

  let image = null;
  let imageErreur = null;
  if (oeuvre.image_path) {
    const cheminAbs = path.join(getPhotosDir(), oeuvre.image_path);
    const r = chargerImageDepuisChemin(cheminAbs);
    if (r.erreur) imageErreur = r.erreur;
    else image = r;
  }

  const texte = assemblerPromptIA({ oeuvre, artiste, config, avecImage: !!image });
  const imageOk = ecrireDansPressePapier({ texte, image });

  return {
    texte,
    image_ok: imageOk,
    image_erreur: imageErreur,
    image_data_url: image?.dataUrl || null,
    image_nom: image?.nom || null,
    lien_chatgpt: determinerLien({ artiste, config }),
  };
}

// Variante inline : utilisée en mode création, quand l'œuvre n'existe pas encore
// en base. Les caractéristiques viennent du formulaire et l'image vient d'un
// data URL en mémoire (image choisie mais pas encore enregistrée sur disque).
function preparerCopiePourChatGPTInline({ donneesOeuvre, artisteId, imageDataUrl }) {
  if (!donneesOeuvre) throw new Error('Données de l\'œuvre manquantes.');
  const artiste = artisteId ? require('./db/requetes').obtenirArtiste(artisteId) : null;
  const config = require('./config').obtenirConfig();

  const oeuvreVirtuelle = {
    ...donneesOeuvre,
    artiste_nom: artiste
      ? [artiste.prenom, artiste.nom].filter(Boolean).join(' ')
      : (donneesOeuvre.artiste_nom || ''),
  };

  let image = null;
  let imageErreur = null;
  if (imageDataUrl) {
    const r = chargerImageDepuisDataUrl(imageDataUrl);
    if (r.erreur) imageErreur = r.erreur;
    else image = r;
  }

  const texte = assemblerPromptIA({ oeuvre: oeuvreVirtuelle, artiste, config, avecImage: !!image });
  const imageOk = ecrireDansPressePapier({ texte, image });

  return {
    texte,
    image_ok: imageOk,
    image_erreur: imageErreur,
    image_data_url: image?.dataUrl || null,
    image_nom: image?.nom || null,
    lien_chatgpt: determinerLien({ artiste, config }),
  };
}

// ====== Génération directe de descriptions via Claude (Anthropic) ======
// La clé API est rangée CHIFFRÉE (safeStorage / coffre Windows) dans la config.
// On ne la déchiffre qu'au moment d'appeler l'API.

function definirCleAnthropic(cle) {
  const c = String(cle || '').trim();
  if (!c) throw new Error('Clé vide.');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Le coffre de chiffrement n'est pas disponible sur cet ordinateur.");
  }
  const chiffre = safeStorage.encryptString(c).toString('base64');
  require('./config').mettreAJourConfig({ ia: { cle_anthropic: chiffre } });
  return { ok: true };
}

function effacerCleAnthropic() {
  require('./config').mettreAJourConfig({ ia: { cle_anthropic: '' } });
  return { ok: true };
}

function obtenirCleAnthropic() {
  const cfg = require('./config').obtenirConfig();
  const chiffre = cfg?.ia?.cle_anthropic;
  if (!chiffre) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(chiffre, 'base64'));
  } catch {
    return null;
  }
}

function exigerCle() {
  const apiKey = obtenirCleAnthropic();
  if (!apiKey) {
    const e = new Error('Aucune clé API configurée. Ajoute ta clé Anthropic dans Réglages → IA.');
    e.code = 'NO_KEY';
    throw e;
  }
  return apiKey;
}

async function genererDescriptionPourOeuvre(oeuvreId) {
  const apiKey = exigerCle();
  const oeuvre = require('./db/requetes').obtenirOeuvre(oeuvreId);
  if (!oeuvre) throw new Error('Œuvre introuvable.');
  const artiste = require('./db/requetes').obtenirArtiste(oeuvre.artiste_id);
  const config = require('./config').obtenirConfig();

  let image = null;
  if (oeuvre.image_path) {
    const r = chargerImageDepuisChemin(path.join(getPhotosDir(), oeuvre.image_path));
    if (!r.erreur) image = r;
  }
  const prompt = assemblerPromptIA({ oeuvre, artiste, config, avecImage: !!image });
  const texte = await require('./ia').genererDescription({
    apiKey, prompt, imageDataUrl: image?.dataUrl || null,
  });
  return { texte };
}

async function genererDescriptionInline({ donneesOeuvre, artisteId, imageDataUrl }) {
  const apiKey = exigerCle();
  if (!donneesOeuvre) throw new Error("Données de l'œuvre manquantes.");
  const artiste = artisteId ? require('./db/requetes').obtenirArtiste(artisteId) : null;
  const config = require('./config').obtenirConfig();
  const oeuvreVirtuelle = {
    ...donneesOeuvre,
    artiste_nom: artiste
      ? [artiste.prenom, artiste.nom].filter(Boolean).join(' ')
      : (donneesOeuvre.artiste_nom || ''),
  };

  let image = null;
  if (imageDataUrl) {
    const r = chargerImageDepuisDataUrl(imageDataUrl);
    if (!r.erreur) image = r;
  }
  const prompt = assemblerPromptIA({ oeuvre: oeuvreVirtuelle, artiste, config, avecImage: !!image });
  const texte = await require('./ia').genererDescription({
    apiKey, prompt, imageDataUrl: image?.dataUrl || null,
  });
  return { texte };
}

// ====== Auto-update via electron-updater + GitHub Releases ======
// Comportement : aucun téléchargement ni installation automatique. L'utilisateur
// est notifié quand une mise à jour est disponible et décide quand télécharger
// puis quand redémarrer.

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowDowngrade = false;

let etatUpdater = { phase: 'idle', info: null, erreur: null, progress: null };

function envoyerEtatUpdater() {
  etatUpdater = { ...etatUpdater };
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('updater:etat', etatUpdater);
  }
}

autoUpdater.on('checking-for-update', () => {
  etatUpdater = { phase: 'checking', info: null, erreur: null, progress: null };
  envoyerEtatUpdater();
});
autoUpdater.on('update-available', (info) => {
  etatUpdater = { phase: 'available', info, erreur: null, progress: null };
  envoyerEtatUpdater();
});
autoUpdater.on('update-not-available', (info) => {
  etatUpdater = { phase: 'up-to-date', info, erreur: null, progress: null };
  envoyerEtatUpdater();
});
autoUpdater.on('download-progress', (progress) => {
  etatUpdater = { phase: 'downloading', info: etatUpdater.info, erreur: null, progress };
  envoyerEtatUpdater();
});
autoUpdater.on('update-downloaded', (info) => {
  etatUpdater = { phase: 'downloaded', info, erreur: null, progress: null };
  envoyerEtatUpdater();
});
autoUpdater.on('error', (err) => {
  etatUpdater = { phase: 'error', info: etatUpdater.info, erreur: String(err?.message || err), progress: null };
  envoyerEtatUpdater();
});

async function verifierMisesAJour({ silencieux = false } = {}) {
  if (!app.isPackaged) {
    // En dev, electron-updater n'a rien à faire ; on simule un état pour pas
    // bloquer les tests UI.
    etatUpdater = { phase: 'dev', info: null, erreur: null, progress: null };
    envoyerEtatUpdater();
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    if (!silencieux) {
      etatUpdater = { phase: 'error', info: null, erreur: String(err?.message || err), progress: null };
      envoyerEtatUpdater();
    }
  }
}

// Démarrage protégé : si une étape échoue (base illisible, dossier
// inaccessible, migration impossible…), on affiche un message clair en
// français et on quitte proprement — plutôt que de rester figé sur le
// splash (non fermable) sans explication.
app.whenReady().then(async () => {
  try {
    await demarrerApplication();
  } catch (err) {
    journaliserErreur('Échec du démarrage', err);
    console.error('Échec du démarrage :', err);
    for (const w of BrowserWindow.getAllWindows()) {
      try { w.destroy(); } catch {}
    }
    try {
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'Galeria',
        message: "Galeria n'a pas pu démarrer.",
        detail:
          'Le plus souvent, la base de données n\'a pas pu être ouverte : '
          + 'fichier ouvert dans un autre programme, dossier Documents inaccessible, '
          + 'ou fichier endommagé.\n\n'
          + 'Que faire : redémarrez l\'ordinateur, puis rouvrez Galeria. '
          + 'Si le problème persiste, contactez Dave — vos sauvegardes se trouvent '
          + 'dans Documents\\Galeria\\Sauvegardes.\n\n'
          + `Détail technique (consigné dans erreurs.log) :\n${String((err && err.message) || err)}`,
        buttons: ['Fermer'],
        noLink: true,
      });
    } catch {}
    app.exit(1);
  }
});

async function demarrerApplication() {
  protocol.handle('galerie', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'photos') return new Response('Not Found', { status: 404 });
    let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
    rel = path.posix.normalize(rel);
    if (rel.startsWith('..') || rel.startsWith('/') || rel.includes('\0')) {
      return new Response('Forbidden', { status: 403 });
    }
    const abs = path.join(getPhotosDir(), rel);
    return net.fetch(pathToFileURL(abs).toString());
  });

  // Splash affiché AVANT les étapes longues (copie des photos au 1er lancement)
  // pour montrer la progression — sinon il n'apparaîtrait qu'après.
  const splash = createSplashWindow();
  splash.__ouvertureMs = Date.now();
  await new Promise((res) => {
    splash.webContents.once('did-finish-load', res);
    setTimeout(res, 1500); // filet de sécurité si l'événement est manqué
  });
  const progres = (pct, texte) => {
    if (!splash || splash.isDestroyed()) return Promise.resolve();
    return splash.webContents
      .executeJavaScript(`window.majProgres && window.majProgres(${pct}, ${JSON.stringify(texte)})`)
      .catch(() => {});
  };

  await progres(12, 'Ouverture de la base de données…');
  ensureDirectories();
  proposerRestaurationSiBaseManquante(splash);

  // Copie de la base AVANT les migrations de schéma quand la version de
  // l'app a changé (galerie-avant-migration-…, conservées : 3 dernières).
  try {
    const copieMigration = sauvegardeAvantMigrationSiNouvelleVersion(app.getVersion());
    if (copieMigration) console.log(`Copie avant migration : ${copieMigration}`);
  } catch (err) {
    journaliserErreur('Copie avant migration échouée', err);
  }

  openDatabase();
  try {
    if ((obtenirConfig().derniere_version_app || '') !== app.getVersion()) {
      mettreAJourConfig({ derniere_version_app: app.getVersion() });
    }
  } catch (err) {
    journaliserErreur('Enregistrement de la version échoué', err);
  }

  // Garde-fou anti-doublons : recale les compteurs de numéros de documents
  // sur ce qui existe déjà en base (protège même si config.json a été perdu).
  try {
    rehausserCompteursSelonBase();
  } catch (err) {
    journaliserErreur('Rehaussement des compteurs échoué', err);
  }

  // Si le fichier des réglages était illisible, on a redémarré sur les
  // défauts : prévenir clairement (l'ancien fichier a été conservé).
  const cfgCorrompue = infoConfigCorrompue();
  if (cfgCorrompue) {
    journaliserErreur(
      'Configuration illisible au chargement',
      new Error(`config.json illisible ; copie conservée : ${cfgCorrompue.copie || 'aucune'}`)
    );
    const optionsCfg = {
      type: 'warning',
      title: 'Galeria',
      message: "Les réglages n'ont pas pu être lus.",
      detail:
        'Le fichier des réglages (config.json) était illisible — probablement '
        + 'abîmé lors d\'un arrêt brutal de l\'ordinateur. Galeria repart sur '
        + 'les réglages par défaut.\n\n'
        + (cfgCorrompue.copie
          ? `L'ancien fichier a été conservé ici :\n${cfgCorrompue.copie}\n\n`
          : '')
        + 'À faire : revérifiez vos Réglages et le Profil de la galerie. '
        + 'Les compteurs de numéros de factures se réajustent automatiquement '
        + 'selon les documents déjà créés.',
      buttons: ['Continuer'],
      noLink: true,
    };
    if (splash && !splash.isDestroyed()) dialog.showMessageBoxSync(splash, optionsCfg);
    else dialog.showMessageBoxSync(optionsCfg);
  }

  await progres(20, 'Préparation des photos…');
  try {
    const forcer = !!obtenirConfig().forcer_photos_catalogue;
    const r = await seedPhotosIfNeeded(({ nbFichiers, total, pct }) => {
      progres(20 + Math.floor(pct * 0.6), `Préparation des photos… ${nbFichiers} / ${total}`);
    }, { forcer });
    if (forcer) mettreAJourConfig({ forcer_photos_catalogue: false });
    if (r) {
      const mo = (r.tailleTotale / (1024 * 1024)).toFixed(1);
      console.log(`Photos préparées : ${r.nbFichiers} fichiers, ${mo} Mo, en ${r.dureeMs} ms.`);
    }
  } catch (err) {
    console.error('Échec de la préparation des photos :', err);
  }

  await progres(85, 'Chargement de l’interface…');
  ipcMain.handle('db:stats', () => getStats());
  ipcMain.handle('updater:etat', () => etatUpdater);
  ipcMain.handle('updater:verifier', () => verifierMisesAJour({ silencieux: false }));
  ipcMain.handle('updater:telecharger', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return { ok: false, erreur: String(err?.message || err) };
    }
  });
  ipcMain.handle('updater:installer-redemarrer', () => {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });
  ipcMain.handle('accueil:donnees', () => ({
    stats: statsTableauDeBord(),
    oeuvresRecentes: oeuvresRecentes(6),
    ventesRecentes: ventesRecentes(6),
    oeuvresReservees: oeuvresReservees(8),
    commandesNonCompletees: commandesNonCompletees(10),
    oeuvresEnPreparation: oeuvresAPreparer().slice(0, 12),
    ventesParMois: ventesParMois(12),
  }));
  ipcMain.handle('documents:liste', () => indexerTousLesDocuments());
  ipcMain.handle('rapport:journalier', (_e, dateISO) => rapportJournalier(dateISO));
  // Génère le PDF du rapport (format Lettre) via un gabarit autonome rendu
  // dans une fenêtre isolée (polices système, aucun @font-face) — même
  // mécanisme que les certificats, pour éviter le crash « Font Capture ».
  ipcMain.handle('rapport:pdf', async (_e, dateISO) => {
    const chemin = await genererRapportPdf(dateISO);
    await shell.openPath(chemin);
    return { path: chemin };
  });
  ipcMain.handle('oeuvres:retrait', (_e, id, data) => definirRetraitOeuvre(id, data));
  ipcMain.handle('oeuvres:retrait-lot', (_e, ids, data) => definirRetraitOeuvresLot(ids, data));
  ipcMain.handle('oeuvres:reserver', (_e, id, data) => reserverOeuvre(id, data));
  ipcMain.handle('oeuvres:liberer', (_e, id) => libererOeuvre(id));
  ipcMain.handle('suivi:donnees', () => ({
    preparation: oeuvresAPreparer(),
    ventes: ventesSuivi(),
  }));
  ipcMain.handle('ia:copier-pour-chatgpt', (_e, oeuvreId) => preparerCopiePourChatGPT(oeuvreId));
  ipcMain.handle('ia:copier-pour-chatgpt-inline', (_e, params) => preparerCopiePourChatGPTInline(params || {}));
  ipcMain.handle('ia:generer-description', (_e, oeuvreId) => genererDescriptionPourOeuvre(oeuvreId));
  ipcMain.handle('ia:generer-description-inline', (_e, params) => genererDescriptionInline(params || {}));
  ipcMain.handle('ia:definir-cle', (_e, cle) => definirCleAnthropic(cle));
  ipcMain.handle('ia:effacer-cle', () => effacerCleAnthropic());
  ipcMain.handle('ia:cle-definie', () => {
    const cfg = require('./config').obtenirConfig();
    return { definie: !!(cfg?.ia?.cle_anthropic), chiffrement: safeStorage.isEncryptionAvailable() };
  });
  ipcMain.handle('ia:copier-image-seulement', (_e, imageDataUrl) => {
    const r = chargerImageDepuisDataUrl(imageDataUrl);
    if (r.erreur || !r.img) return { ok: false, erreur: r.erreur || 'Image non chargée' };
    try {
      clipboard.writeImage(r.img);
      return { ok: true };
    } catch (err) {
      return { ok: false, erreur: err.message };
    }
  });
  ipcMain.handle('app:ouvrir-url', (_e, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, erreur: 'URL invalide' };
    }
    shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle('app:ouvrir-dossier', async (_e, dossier) => {
    if (typeof dossier !== 'string' || !dossier) {
      return { ok: false, erreur: 'Chemin invalide' };
    }
    const erreur = await shell.openPath(dossier);
    return erreur ? { ok: false, erreur } : { ok: true };
  });
  ipcMain.handle('app:infos', () => ({
    nom: app.getName(),
    version: app.getVersion(),
    dataDir: getDataDir(),
    plateforme: process.platform,
    electron: process.versions.electron,
  }));
  ipcMain.handle('app:zoom', (event, facteur) => {
    const f = Number(facteur);
    if (!Number.isFinite(f)) return { ok: false };
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.webContents.setZoomFactor(f);
    return { ok: true };
  });
  ipcMain.handle('import:choisir-fichier', (event) => importChoisirFichier(event.sender));
  ipcMain.handle('import:executer', (_e, filePath, mode) => importExecuter(filePath, mode));
  ipcMain.handle('backup:now', () => sauvegarderEtRetourner());
  ipcMain.handle('backup:etat', () => obtenirEtatSauvegardes());
  ipcMain.handle('backup:liste', () => listerSauvegardes());
  // Restauration d'une sauvegarde choisie dans les Réglages. Étapes :
  // 1. valider que le chemin vient bien de la liste (pas un chemin arbitraire) ;
  // 2. vérifier l'intégrité de la copie choisie AVANT de toucher à la base ;
  // 3. mettre la base actuelle de côté (galerie-avant-restauration-…) ;
  // 4. remplacer, répondre au renderer, PUIS redémarrer (la réponse part
  //    avant le relaunch — contrairement au chargement de catalogue).
  ipcMain.handle('backup:restaurer', (_e, chemin) => {
    const candidates = listerSauvegardes();
    const choisie = candidates.find((c) => c.chemin === chemin);
    if (!choisie) return { ok: false, erreur: 'Cette sauvegarde est introuvable. Rouvre la liste et réessaie.' };

    let d = null;
    try {
      d = new (require('node:sqlite').DatabaseSync)(choisie.chemin, { readOnly: true });
      const r = d.prepare('PRAGMA quick_check').get();
      if (!r || r.quick_check !== 'ok') {
        return { ok: false, erreur: 'Cette sauvegarde est abîmée et ne peut pas être restaurée. Choisis-en une autre.' };
      }
    } catch (err) {
      return { ok: false, erreur: 'Cette sauvegarde n\'a pas pu être lue. Choisis-en une autre.' };
    } finally {
      try { if (d) d.close(); } catch {}
    }

    const dbPath = getDbPath();
    try {
      if (fs.existsSync(dbPath)) sauvegarderSous('avant-restauration');
      closeDatabase();
      for (const suffixe of ['', '-wal', '-shm']) {
        try { fs.rmSync(dbPath + suffixe, { force: true }); } catch {}
      }
      fs.copyFileSync(choisie.chemin, dbPath);
    } catch (err) {
      journaliserErreur('Restauration échouée', err);
      return {
        ok: false,
        erreur: 'La restauration a échoué en cours de route. Ne ferme pas l\'app et réessaie ; '
          + 'en cas de doute, contacte Dave (une copie de secours a été faite avant).',
      };
    }
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 400);
    return { ok: true };
  });
  ipcMain.handle('artistes:liste', (_e, filtres) => listerArtistes(filtres));
  ipcMain.handle('fiche:archiver', (_e, table, id, archive) => definirArchive(table, id, archive));
  ipcMain.handle('artistes:get', (_e, id) => obtenirArtiste(id));
  ipcMain.handle('artistes:fiche-bundle', (_e, id) => obtenirFicheArtisteBundle(id));
  ipcMain.handle('artistes:voisins', (_e, id) => voisinsArtiste(id));
  ipcMain.handle('artistes:modifier', (_e, id, data) => modifierArtiste(id, data));
  ipcMain.handle('artistes:creer', (_e, data) => creerArtiste(data));
  ipcMain.handle('artistes:supprimer', (_e, id) => supprimerArtiste(id));
  ipcMain.handle('oeuvres:liste', (_e, filtres) => listerOeuvres(filtres));
  ipcMain.handle('oeuvres:get', (_e, id) => obtenirOeuvre(id));
  ipcMain.handle('oeuvres:detail-artiste', (_e, artisteId) => oeuvresDetailArtiste(artisteId));
  ipcMain.handle('oeuvres:par-ids', (_e, ids) => oeuvresParIds(ids));
  ipcMain.handle('oeuvres:fiche-bundle', (_e, id) => obtenirFicheOeuvreBundle(id));
  ipcMain.handle('oeuvres:voisins', (_e, id) => voisinsOeuvre(id));
  ipcMain.handle('oeuvres:modifier', (_e, id, data) => modifierOeuvre(id, data));
  ipcMain.handle('oeuvres:modifier-lot', (_e, modifs) => modifierOeuvresLot(modifs));
  ipcMain.handle('oeuvres:creer', (_e, data) => creerOeuvre(data));
  ipcMain.handle('oeuvres:supprimer', (_e, id) => supprimerOeuvre(id));
  ipcMain.handle('oeuvres:maj-preparation', (_e, id, data) => majPreparationOeuvre(id, data));
  ipcMain.handle('oeuvres:nom-fichier', (_e, id) => {
    const { construireNomFichier } = require('./db/nomenclature');
    return construireNomFichier(obtenirOeuvre(id));
  });
  ipcMain.handle('photo:choisir', (e, opts) => choisirPhoto(e.sender, opts));
  ipcMain.handle('photo:effacer', (_e, opts) => effacerPhoto(opts));
  ipcMain.handle('photo:lire-fichier', (e) => lireFichierImage(e.sender));
  ipcMain.handle('photo:lire-originale', (_e, opts) => lireOriginale(opts));
  ipcMain.handle('photo:lire-pour-recadrage', (_e, opts) => lirePourRecadrage(opts));
  ipcMain.handle('photo:enregistrer-recadree', (_e, opts) => enregistrerImageRecadree(opts));
  ipcMain.handle('config:get', () => obtenirConfig());
  ipcMain.handle('config:sauver', (_e, partiel) => mettreAJourConfig(partiel));

  // --- Catalogue livré : proposer de charger un nouveau catalogue embarqué ---
  // Ne propose que si un catalogue est embarqué (seed non vide) ET différent de
  // celui de la base de l'utilisateur ET pas déjà refusé. Le build public
  // (auto-update) n'a pas de catalogue → jamais de proposition.
  ipcMain.handle('catalogue:verifier', () => {
    const seedId = lireCatalogueId(getSeedPath());
    if (!seedId) return { offrir: false };
    if (seedId === lireCatalogueId(getDbPath())) return { offrir: false };
    if (seedId === (obtenirConfig().catalogue_refuse || '')) return { offrir: false };
    return { offrir: true, id: seedId };
  });
  ipcMain.handle('catalogue:refuser', (_e, id) => {
    mettreAJourConfig({ catalogue_refuse: String(id || '') });
    return { ok: true };
  });
  ipcMain.handle('catalogue:charger', () => {
    const seedPath = getSeedPath();
    const dbPath = getDbPath();
    if (!lireCatalogueId(seedPath)) throw new Error('Aucun catalogue à charger.');
    // 1. Sauvegarder la base actuelle.
    if (fs.existsSync(dbPath)) {
      const n = new Date();
      const p = (x) => String(x).padStart(2, '0');
      const stamp = `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
      fs.mkdirSync(getBackupsDir(), { recursive: true });
      fs.copyFileSync(dbPath, path.join(getBackupsDir(), `galerie-avant-catalogue-${stamp}.db`));
    }
    // 2. Fermer la base et la remplacer par le catalogue livré.
    closeDatabase();
    fs.copyFileSync(seedPath, dbPath);
    // 3. Forcer le re-déballage des photos au prochain démarrage ; oublier un refus.
    mettreAJourConfig({ forcer_photos_catalogue: true, catalogue_refuse: '' });
    // 4. Redémarrer sur le nouveau catalogue.
    app.relaunch();
    app.exit(0);
  });
  ipcMain.handle('config:choisir-dossier', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choisir le dossier des sauvegardes',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || !filePaths.length) return { cancelled: true };
    return { path: filePaths[0] };
  });
  ipcMain.handle('backup:redemarrer', () => {
    arreterSauvegardePeriodique();
    demarrerSauvegardePeriodique(surEvenementSauvegarde);
  });
  ipcMain.handle('oeuvres:types', () => listerTypesOeuvre());
  ipcMain.handle('oeuvres:mediums', () => listerMediumsOeuvre());
  ipcMain.handle('oeuvres:mediums-artiste', (_e, artisteId) => listerMediumsArtiste(artisteId));
  ipcMain.handle('oeuvres:stats', () => statsOeuvres());
  ipcMain.handle('clients:liste', (_e, filtres) => listerClients(filtres));
  ipcMain.handle('clients:get', (_e, id) => obtenirClient(id));
  ipcMain.handle('clients:fiche-bundle', (_e, id) => obtenirFicheClientBundle(id));
  ipcMain.handle('clients:voisins', (_e, id) => voisinsClient(id));
  ipcMain.handle('clients:modifier', (_e, id, data) => modifierClient(id, data));
  ipcMain.handle('clients:creer', (_e, data) => creerClient(data));
  ipcMain.handle('clients:supprimer', (_e, id) => supprimerClient(id));
  ipcMain.handle('clients:ventes', (_e, id) => listerVentesClient(id));
  ipcMain.handle('oeuvres:ventes', (_e, id) => listerVentesOeuvre(id));
  ipcMain.handle('ventes:liste', () => listerVentes());
  ipcMain.handle('ventes:get', (_e, id) => obtenirVente(id));
  ipcMain.handle('ventes:fiche-bundle', (_e, id) => obtenirFicheVenteBundle(id));
  ipcMain.handle('ventes:voisins', (_e, id) => voisinsVente(id));
  ipcMain.handle('ventes:creer', (_e, data) => creerVente(data));
  ipcMain.handle('ventes:modifier', (_e, id, data) => modifierVente(id, data));
  ipcMain.handle('ventes:maj-cycle', (_e, id, data) => majCycleVente(id, data));
  ipcMain.handle('ventes:supprimer', (_e, id) => supprimerVente(id));
  ipcMain.handle('ventes:apercu-numero-facture', () => apercuProchainNumeroFacture());
  ipcMain.handle('oeuvres:apercu-numero-inventaire', (_e, artisteId) => apercuProchainNumeroInventaire(artisteId));
  ipcMain.handle('oeuvres:reserver-numero-inventaire', (_e, artisteId) => reserverProchainNumeroInventaire(artisteId));
  ipcMain.handle('ventes:reserver-numero-facture', () => reserverProchainNumeroFacture());
  ipcMain.handle('certificats:liste-oeuvre', (_e, oeuvreId) => listerCertificatsParOeuvre(oeuvreId));
  ipcMain.handle('certificats:liste-vente', (_e, venteId) => listerCertificatsParVente(venteId));
  ipcMain.handle('certificats:get', (_e, id) => obtenirCertificat(id));
  ipcMain.handle('certificats:creer', (_e, data) => creerCertificat(data));
  ipcMain.handle('certificats:modifier', (_e, id, data) => modifierCertificat(id, data));
  ipcMain.handle('certificats:supprimer', (_e, id) => supprimerCertificat(id));
  ipcMain.handle('certificats:apercu-numero', () => apercuProchainNumeroCertificat());
  ipcMain.handle('certificats:reserver-numero', () => reserverProchainNumeroCertificat());
  ipcMain.handle('certificats:apercu', (_e, oeuvreId) => apercuNumeroCertificat(oeuvreId));
  ipcMain.handle('pdf:certificat-generer', (_e, id) => genererCertificatPdf(id));
  ipcMain.handle('pdf:facture-artiste-generer', (_e, venteId) => genererFactureArtistePdf(venteId));
  ipcMain.handle('pdf:catalogue-generer', (_e, artisteId) => genererCataloguePdf(artisteId));
  ipcMain.handle('pdf:annexe-generer', (_e, payload) => genererAnnexePdf(payload));
  ipcMain.handle('pdf:presentation-generer', (_e, artisteId) => genererPresentationPdf(artisteId));
  ipcMain.handle('pdf:presentation-personnalisee', (_e, artisteId, overrides) => genererPresentationPersonnalisee(artisteId, overrides));
  ipcMain.handle('pdf:pochette-generer', (_e, venteId) => genererPochette(venteId));
  ipcMain.handle('pdf:editer-document', (_e, spec) => editerDocument(spec));
  ipcMain.handle('pdf:pochette-fichier', (_e, venteId, type) => cheminPochetteSiExiste(venteId, type));
  ipcMain.handle('pdf:pochette-dossier-infos', (_e, venteId) => infosDossierPochette(venteId));
  ipcMain.handle('pdf:pochette-dossier-supprimer', (_e, chemin) => supprimerDossierPochette(chemin));
  ipcMain.handle('pdf:ouvrir', async (_e, cheminPdf) => {
    const erreur = await shell.openPath(cheminPdf);
    if (erreur) throw new Error(erreur);
    return { ok: true };
  });
  ipcMain.handle('pdf:reveler-dans-explorateur', (_e, cheminPdf) => {
    shell.showItemInFolder(cheminPdf);
    return { ok: true };
  });
  createWindow(splash);
  progres(100, 'Prêt');
  demarrerSauvegardePeriodique(surEvenementSauvegarde);

  // Vérification silencieuse des mises à jour ~5 s après le démarrage,
  // pour laisser l'app finir de se charger.
  setTimeout(() => { verifierMisesAJour({ silencieux: true }); }, 5000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  arreterSauvegardePeriodique();
  try {
    sauvegarder();
  } catch (e) {
    // Dernier filet avant la fermeture : un échec ici doit être vu, sinon
    // l'utilisateur peut vivre des mois sans aucune copie de sécurité.
    console.error('Sauvegarde à la fermeture échouée :', e);
    journaliserErreur('Sauvegarde à la fermeture échouée', e);
    try {
      dialog.showErrorBox(
        'Galeria — sauvegarde échouée',
        'La copie de sécurité faite à la fermeture a échoué.\n\n'
        + 'Vos données restent intactes, mais aucune nouvelle sauvegarde '
        + 'n\'a été créée. Vérifiez le dossier de sauvegarde dans '
        + 'Réglages → Sauvegardes à la prochaine ouverture.\n\n'
        + `Détail : ${String(e && e.message || e)}`
      );
    } catch {}
  }
  closeDatabase();
});
