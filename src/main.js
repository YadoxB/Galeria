const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, net, shell, clipboard, nativeImage, screen, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openDatabase, closeDatabase, lireCatalogueId } = require('./db/database');
const { migrerPhotos } = require('./db/migrer-photos');
const { apercuCopieSoutien, produireCopieSoutien } = require('./db/copie-soutien');
const { construireRapport, rapportEnTexte } = require('./soutien-rapport');
const { rangerPhotos, renommerDossierArtiste, preparerDossiers } = require('./db/photos-ranger');
const { dossierArtiste } = require('./photos-chemins');
const { listerPhotosArtiste, ajouterPhotosDivers, copierPhoto, exporterPhotos, ouvrirDossierArtiste } = require('./photos-artiste');
const { getPhotosDir, getDataDir, getDocumentsDirAnnee, getDbPath, getSeedPath, getBackupsDir, ensureDirectories, ecrireEmplacementConfigure, lireDeplacementEnAttente, ecrireDeplacementEnAttente, effacerDeplacementEnAttente } = require('./db/paths');
const { deplacerDossierDonnees, verifierDestination, estDossierGaleriaValide, estSousOneDrive } = require('./db/deplacer-donnees');
const { recupererTauxChange, tauxMemorises } = require('./taux-change');
const { seedPhotosIfNeeded } = require('./db/seedPhotos');
const { choisirPhoto, effacerPhoto, lireFichierImage, lirePourRecadrage, enregistrerImageRecadree } = require('./photos');
const { obtenirConfig, mettreAJourConfig, infoConfigCorrompue } = require('./config');
const { brancherMenuContextuel } = require('./menu-contextuel');

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
const { analyserTypeOeuvre, genererCartelsPdf, genererCertificatPdf, genererFactureArtistePdf, genererRapportPdf, genererCataloguePdf, genererAnnexePdf, genererPresentationPdf, genererPochette, editerDocument, cheminPochetteSiExiste, infosDossierPochette, supprimerDossierPochette, indexerTousLesDocuments } = require('./pdf');
const {
  listerArtistes,
  obtenirArtiste,
  obtenirFicheArtisteBundle,
  listerOeuvres,
  oeuvresDetailArtiste,
  oeuvresParIds,
  obtenirOeuvre,
  obtenirFicheOeuvreBundle,
  listerExpositions,
  obtenirExposition,
  oeuvresEligiblesExposition,
  listerTypesOeuvre,
  listerSupportsOeuvre,
  listerStylesOeuvre,
  listerTypesArtiste,
  listerMediumsOeuvre,
  listerMediumsArtiste,
  listerClients,
  obtenirClient,
  obtenirFicheClientBundle,
  listerVentes,
  obtenirFicheVenteBundle,
  listerCertificatsParOeuvre,
  listerCertificatsParVente,
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
  modifierArtiste, creerArtiste, supprimerArtiste, relierArtisteAuSite, delierArtisteDuSite,
  formaterDimensionsTexte,
  modifierOeuvre, majChampOeuvre, majStatutOeuvre, corrigerNumeroInventaire, ignorerDiffWeb, retirerIgnoreWeb, creerOeuvre, modifierOeuvresLot, supprimerOeuvre, majPreparationOeuvre,
  majChampArtiste, ignorerDiffArtisteWeb, retirerIgnoreArtisteWeb,
  modifierClient, creerClient, supprimerClient,
  creerVente, modifierVente, supprimerVente, majCycleVente,
  apercuProchainNumeroFacture, reserverProchainNumeroFacture,
  creerCertificat, supprimerCertificat,
  apercuNumeroCertificat,
  apercuProchainNumeroInventaire, reserverProchainNumeroInventaire,
  definirArchive, definirRetraitOeuvre, definirRetraitOeuvresLot,
  majUrlsSiteDepuisSite,
  creerExposition, modifierExposition, supprimerExposition,
  ajouterOeuvresExposition, retirerOeuvreExposition, terminerExposition,
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
  // (barre latérale comprise) reste visible sans défilement. Hauteur par défaut
  // portée à 1000 px (barre latérale plus longue), toujours plafonnée à l'écran.
  const { width: dispW, height: dispH } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(1600, dispW),
    height: Math.min(1000, dispH),
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

  // Menu contextuel (clic droit) : rend « Coller » à la souris, absent depuis
  // que le menu applicatif est désactivé. Voir src/menu-contextuel.js.
  brancherMenuContextuel(win);

  // Verrou léger : verrouiller quand la fenêtre perd le focus, si l'option est
  // active (l'état réel est relu à chaque blur dans le processus principal).
  win.on('blur', () => {
    try {
      const s = require('./securite').etatSecurite();
      if (s.verrou_actif && s.verrouiller_au_blur && !win.isDestroyed()) {
        win.webContents.send('securite:verrouiller');
      }
    } catch {}
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

// ====== Site web (WooCommerce) — clés chiffrées dans le coffre Windows ======
// L'adresse est en clair ; la clé et le secret sont chiffrés (safeStorage) et
// ne sont déchiffrés qu'au moment d'appeler le site. On ne renvoie JAMAIS les
// clés à l'interface (seulement « définies : oui/non »).

function chiffrerSecret(valeur) {
  return safeStorage.encryptString(String(valeur)).toString('base64');
}
function dechiffrerSecret(base64) {
  if (!base64) return '';
  try { return safeStorage.decryptString(Buffer.from(base64, 'base64')); }
  catch { return ''; }
}

function definirClesWoo({ url, consumerKey, consumerSecret } = {}) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Le coffre de chiffrement n'est pas disponible sur cet ordinateur.");
  }
  const cfgActuel = require('./config').obtenirConfig();
  const web = { url: String(url == null ? '' : url).trim() };
  // Clé/secret : si fournis, on (re)chiffre ; si laissés vides, on conserve
  // ce qui est déjà enregistré (comme pour la clé Anthropic).
  const ck = String(consumerKey == null ? '' : consumerKey).trim();
  const cs = String(consumerSecret == null ? '' : consumerSecret).trim();
  if (ck) web.consumer_key = chiffrerSecret(ck);
  else if (cfgActuel?.web?.consumer_key) web.consumer_key = cfgActuel.web.consumer_key;
  else web.consumer_key = '';
  if (cs) web.consumer_secret = chiffrerSecret(cs);
  else if (cfgActuel?.web?.consumer_secret) web.consumer_secret = cfgActuel.web.consumer_secret;
  else web.consumer_secret = '';
  require('./config').mettreAJourConfig({ web });
  return { ok: true };
}

function effacerClesWoo() {
  require('./config').mettreAJourConfig({ web: { url: '', consumer_key: '', consumer_secret: '' } });
  return { ok: true };
}

// Renvoie les identifiants déchiffrés — USAGE INTERNE au processus principal.
function obtenirClesWoo() {
  const cfg = require('./config').obtenirConfig();
  const w = cfg?.web || {};
  return {
    url: w.url || '',
    consumerKey: dechiffrerSecret(w.consumer_key),
    consumerSecret: dechiffrerSecret(w.consumer_secret),
  };
}

// Clé de comparaison pour DÉTECTER une vraie différence, en ignorant les
// variantes purement cosmétiques (casse, espaces multiples ou insécables,
// apostrophes/guillemets courbes vs droits, tirets, points de suspension,
// espace avant ponctuation double). La valeur affichée/importée, elle, reste
// l'originale. Évite de signaler « différentes » des descriptions identiques à
// l'œil (ex. « l'artiste » avec apostrophe courbe côté site).
function clefComparaison(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[‘’‛`´]/g, "'")   // ‘ ’ ‛ ` ´ → '
    .replace(/[“”«»]/g, '"')          // “ ” « » → "
    .replace(/[–—]/g, '-')                       // – — → -
    .replace(/…/g, '...')                             // … → ...
    .replace(/\s+/g, ' ')                                  // tout blanc (incl. insécables) → espace
    .replace(/\s+([!?;:,.)\]»])/g, '$1')                   // pas d'espace avant ponctuation
    .replace(/([(\[«])\s+/g, '$1')                         // pas d'espace après ouvrante
    .trim();
}

// Clé normalisée de la valeur du site pour un champ (sert à mémoriser un
// « garder » : tant que le site montre la même valeur, on ne represente pas la
// différence). Pour le statut, un jeton 'vendu' / 'dispo'.
function siteCleChamp(champ, valeur) {
  if (champ === 'statut') return valeur; // déjà un jeton
  if (champ === 'prix') return valeur == null ? '' : clefComparaison(String(valeur));
  return clefComparaison(valeur);
}

// Compare les produits du site (SKU) aux œuvres de l'app (numéro d'inventaire).
// Ne fait AUCUNE écriture. `ignores` = Map `${oeuvreId}:${champ}` → site_cle des
// différences que l'utilisateur a choisi de garder. Retourne résumé + lignes.
// `produitsEn` : la MÊME boutique relue en anglais (WPML, `?lang=en`), vide si
// la comparaison des textes anglais n'a pas été demandée. Le rapprochement se
// fait par SKU, qui est partagé entre les traductions d'un même produit.
function comparerSiteEtApp(produits, oeuvres, ignores = new Map(), produitsEn = []) {
  const parSku = new Map();
  for (const p of produits) if (p.sku) parSku.set(p.sku.toUpperCase(), p);
  const parSkuEn = new Map();
  for (const p of produitsEn) if (p.sku) parSkuEn.set(p.sku.toUpperCase(), p);

  const skuAppparies = new Set();
  const lignes = [];
  const appSeul = [];

  for (const o of oeuvres) {
    const inv = (o.numero_inventaire || '').trim();
    const p = inv ? parSku.get(inv.toUpperCase()) : null;
    if (!p) { appSeul.push({ id: o.id, inv, titre: o.titre || '', artiste: o.artiste_nom || '' }); continue; }
    skuAppparies.add(p.sku.toUpperCase());
    const pEn = inv ? parSkuEn.get(inv.toUpperCase()) : null;

    const ignoreDe = (champ) => ignores.get(`${o.id}:${champ}`);
    // `manquant` : la case est VIDE dans l'app. C'est la distinction qui
    // justifiait le bouton « Importer les textes anglais » — remplir le vide
    // sans jamais écraser. Devenue une propriété de chaque écart, elle donne
    // un filtre, et « tout cocher » cesse d'être un pari.
    const ajouter = (arr, champ, libelle, app, site) => {
      const site_cle = siteCleChamp(champ, site);
      const manquant = app == null || String(app).trim() === '';
      arr.push({ champ, libelle, app, site, site_cle, manquant, ignore: ignoreDe(champ) === site_cle });
    };

    const champs = [];
    if (clefComparaison(o.titre) !== clefComparaison(p.name)) {
      ajouter(champs, 'titre', 'Titre', o.titre || '', p.name || '');
    }
    if (clefComparaison(o.description) !== clefComparaison(p.description)) {
      ajouter(champs, 'description', 'Description', o.description || '', p.description || '');
    }
    const pa = (o.prix == null || o.prix === '') ? null : Number(o.prix);
    const ps = (p.prix == null) ? null : Number(p.prix);
    if ((Number.isFinite(pa) ? pa : null) !== (Number.isFinite(ps) ? ps : null)) {
      ajouter(champs, 'prix', 'Prix', Number.isFinite(pa) ? pa : null, Number.isFinite(ps) ? ps : null);
    }

    // Description anglaise. Le titre et le prix n'ont pas de version anglaise
    // dans l'app (`description_en` est la seule colonne _en des œuvres) : il
    // n'y a donc rien d'autre à comparer de ce côté.
    if (pEn && (pEn.description || '').trim()
        && clefComparaison(o.description_en) !== clefComparaison(pEn.description)) {
      ajouter(champs, 'description_en', 'Description (EN)', o.description_en || '', pEn.description || '');
    }

    // Réconciliation de statut : le site marque « épuisé » (outofstock) une œuvre
    // vendue. On signale un écart quand l'un dit vendu et pas l'autre, et on
    // suggère un statut — mais l'utilisateur choisira (outofstock est ambigu).
    const siteVendu = p.stock_status === 'outofstock';
    const appVendu = o.statut === 'vendu';
    let statutReconcilier = null;
    if (siteVendu !== appVendu) {
      const site_cle = siteVendu ? 'vendu' : 'dispo';
      statutReconcilier = {
        app: o.statut || 'disponible',
        site_indication: siteVendu ? 'Vendu / épuisé' : 'En vente / en stock',
        suggere: siteVendu ? 'vendu' : 'disponible',
        site_cle,
        ignore: ignoreDe('statut') === site_cle,
      };
    }

    lignes.push({
      oeuvre_id: o.id, sku: inv, titre: o.titre || '', artiste: o.artiste_nom || '',
      statut_app: o.statut || '', stock_site: p.stock_status || '', statut_site: p.status || '',
      image_app: !!o.image_path, image_site: !!p.image,
      champs,
      statut_reconcilier: statutReconcilier,
    });
  }

  // Œuvres de l'app sans produit relié → candidates à une correction de SKU.
  const appSeulClef = appSeul.map((o) => ({ ...o, clef: clefComparaison(o.titre) }));
  const siteSeul = produits
    .filter((p) => p.sku && !skuAppparies.has(p.sku.toUpperCase()))
    .map((p) => {
      const cs = clefComparaison(p.name);
      // Candidats : même titre normalisé (probable coquille de SKU), ou œuvre
      // sans numéro d'inventaire. Le titre exact d'abord.
      const candidats = appSeulClef
        .filter((o) => (cs && o.clef === cs) || !o.inv)
        .sort((a, b) => Number(cs && b.clef === cs) - Number(cs && a.clef === cs))
        .slice(0, 8)
        .map((o) => ({ id: o.id, inv: o.inv, titre: o.titre, artiste: o.artiste, match: !!cs && o.clef === cs }));
      return {
        sku: p.sku,
        name: p.name || '',
        description: p.description || '',
        prix: (p.prix == null) ? null : Number(p.prix),
        image: p.image || '',
        candidats,
      };
    });

  const estActif = (l) => l.champs.some((c) => !c.ignore) || (l.statut_reconcilier && !l.statut_reconcilier.ignore);
  const ignorees = lignes.reduce((n, l) =>
    n + l.champs.filter((c) => c.ignore).length + (l.statut_reconcilier && l.statut_reconcilier.ignore ? 1 : 0), 0);

  return {
    resume: {
      relies: lignes.length,
      avec_diff: lignes.filter(estActif).length,
      ignorees,
      app_seul: appSeul.length,
      site_seul: siteSeul.length,
      total_site: produits.length,
    },
    lignes,
    appSeul,
    siteSeul,
  };
}

// ===== Comparer UN artiste =====
//
// « Comparer les œuvres d'un artiste seulement » (Dave, 2026-09-11). Lire toute
// la boutique prend une dizaine de secondes (517 produits), le double avec
// l'anglais ; un artiste, 1 à 2 secondes. Deux lectures, dans cet ordre :
//   1. ses NUMÉROS D'INVENTAIRE, en SKU : aucune œuvre reliée ne peut manquer,
//      quelle que soit la catégorie où le produit est rangé ;
//   2. la CATÉGORIE que portent ces produits : elle fait apparaître ceux qui ne
//      sont QUE sur le site. Elle se DÉDUIT des produits plutôt que du nom —
//      le site range « PAMCOMEAU (Pamela Comeau) » sous « Pam Comeau
//      (Pamela) », qu'aucun nom de l'app ne donne. Par le nom seulement à
//      défaut (artiste sans aucune œuvre reliée).
// Les résultats sont ceux de la comparaison complète, restreints à l'artiste.
// Pour qu'ils le restent, un produit de sa catégorie dont le SKU appartient à
// une œuvre d'un AUTRE artiste est écarté : la comparaison complète l'apparie
// à cette œuvre-là, il n'est pas « seulement sur le site ».
const platNom = (s) => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

async function lireProduitsArtiste(woo, creds, artiste, oeuvresTout) {
  const maj = (s) => String(s || '').trim().toUpperCase();
  const siens = oeuvresTout.filter((o) => o.artiste_id === artiste.id);
  const skus = [...new Set(siens.map((o) => maj(o.numero_inventaire)).filter(Boolean))];
  const voulus = new Set(skus);

  // 1. Par SKU. Le filtre après coup est un garde-fou : une API qui ignorerait
  //    la liste renverrait toute la boutique, et la catégorie majoritaire
  //    serait alors celle d'un autre artiste.
  let parSku = (await woo.listerProduits(creds, { skus })).filter((p) => voulus.has(maj(p.sku)));
  // Rien du tout : soit aucune de ses œuvres n'est en ligne, soit l'API n'a
  // pas compris la liste séparée par des virgules. Une sonde de cinq œuvres,
  // lues une à une, tranche ; si l'une existe, on lit le reste de même.
  if (skus.length && !parSku.length) {
    const unParUn = async (liste) => {
      for (const s of liste) {
        const p = await woo.produitParSku(creds, s);
        if (p && voulus.has(maj(p.sku))) parSku.push(p);
      }
    };
    await unParUn(skus.slice(0, 5));
    if (parSku.length) await unParUn(skus.slice(5, 150));
  }

  // 2. La catégorie la plus portée par ses produits, sinon celle à son nom.
  const compte = new Map();
  for (const p of parSku) for (const c of p.categories || []) {
    const e = compte.get(c.id) || { c, n: 0 };
    e.n += 1;
    compte.set(c.id, e);
  }
  let categorie = [...compte.values()].sort((a, b) => b.n - a.n)[0]?.c || null;
  let source = categorie ? 'oeuvres' : null;
  if (!categorie) {
    const noms = new Set([platNom([artiste.prenom, artiste.nom].filter(Boolean).join(' ')), platNom(artiste.nom_site)].filter(Boolean));
    categorie = (await woo.listerCategoriesProduits(creds)).find((c) => noms.has(platNom(c.name))) || null;
    if (categorie) source = 'nom';
  }
  const parCat = categorie
    ? (await woo.listerProduits(creds, { category: categorie.id }))
      .filter((p) => (p.categories || []).some((c) => c.id === categorie.id))
    : [];

  // Union, sans les produits appariés à l'œuvre d'un autre artiste.
  const autres = new Set(oeuvresTout.filter((o) => o.artiste_id !== artiste.id)
    .map((o) => maj(o.numero_inventaire)).filter(Boolean));
  const parId = new Map();
  for (const p of [...parSku, ...parCat]) {
    if (!voulus.has(maj(p.sku)) && autres.has(maj(p.sku))) continue;
    parId.set(p.id, p);
  }
  return { produits: [...parId.values()], oeuvres: siens, categorie, source };
}

// Retire d'une biographie le bloc (paragraphe ou ligne) qui correspond EXACTEMENT
// à la citation connue (peu importe les guillemets/espaces). Sert à ranger la
// citation dans son champ dédié sans réécrire toute la bio. Si la citation n'est
// pas trouvée comme bloc distinct, la bio est laissée telle quelle.
function retirerCitationDeBio(bio, citation) {
  const b = String(bio == null ? '' : bio);
  if (!b.trim() || !citation) return b;
  const cible = clefComparaison(citation);
  const sansGuillemets = (bloc) => clefComparaison(bloc.replace(/^[«»"'“”\s]+|[«»"'“”\s]+$/g, ''));
  const correspond = (bloc) => sansGuillemets(bloc) === cible || clefComparaison(bloc) === cible;
  // 1) blocs séparés par une ligne vide (cas le plus courant : citation en exergue)
  let blocs = b.split(/\n{2,}/);
  let pleins = blocs.filter((bl) => bl.trim());
  let restes = pleins.filter((bl) => !correspond(bl));
  if (restes.length !== pleins.length) return restes.join('\n\n').trim();
  // 2) sinon, lignes simples
  blocs = b.split(/\n/);
  pleins = blocs.filter((bl) => bl.trim());
  restes = pleins.filter((bl) => !correspond(bl));
  if (restes.length !== pleins.length) return restes.join('\n').trim();
  return b;
}

// Compare les artistes du site (type `portfolio`) aux artistes de l'app, par NOM.
// Champs : biographie (le site combine parfois bio + curriculum → on tolère les
// deux) et photo (proposée seulement si le site en a une et pas l'app). Lecture
// seule. `ignores` = Map `${artisteId}:${champ}` → site_cle.
//
// Deux artistes de la galerie signent d'un NOM D'ARTISTE : le site les appelle
// « PAMCOMEAU (Pamela Comeau) » et « Sofia (Sophie Lebeuf) » là où l'app dit
// « Pam Comeau » et « Sophie Lebeuf ». Le rapprochement par le seul nom complet
// ne les voyait pas et proposait de créer des fiches en double. On essaie donc
// d'abord `nom_site`, le nom que l'artiste porte sur le site, posé à la main par
// « Relier à une fiche existante » (voir ipcMain 'web:relier-artiste').
//
// `portfoliosEn` : les MÊMES pages relues en anglais (WPML, `?lang=en`), vides
// si la comparaison des textes anglais n'a pas été demandée. Rapprochement par
// NOM, comme le faisait l'ancien import en masse : les noms d'artistes ne se
// traduisent pas, et ce rapprochement a rempli 22 biographies sur 22.
function comparerArtistesEtSite(portfolios, artistes, ignores = new Map(), portfoliosEn = []) {
  const parNom = new Map();
  for (const p of portfolios) { const k = clefComparaison(p.nom); if (k) parNom.set(k, p); }
  const parNomEn = new Map();
  for (const p of portfoliosEn) {
    const k = clefComparaison(p.nom);
    if (k) parNomEn.set(k, p);
    if (p.slug) parNomEn.set('slug:' + p.slug, p);
  }

  const nomsVus = new Set();
  const lignes = [];
  const appSeul = [];

  for (const a of artistes) {
    const nomApp = [a.prenom, a.nom].filter(Boolean).join(' ').trim();
    // Le lien posé à la main prime : c'est un jugement humain, il ne doit pas
    // être contredit par une coïncidence de noms.
    const kLien = clefComparaison(a.nom_site || '');
    const k = clefComparaison(nomApp);
    const p = (kLien && parNom.get(kLien)) || (k ? parNom.get(k) : null);
    if (!p) { appSeul.push({ id: a.id, nom: nomApp, nom_site: a.nom_site || null }); continue; }
    nomsVus.add(clefComparaison(p.nom));
    // Le pendant anglais : même slug de préférence (WPML le conserve souvent),
    // sinon même nom.
    const pEn = (p.slug && parNomEn.get('slug:' + p.slug))
      || parNomEn.get(clefComparaison(p.nom))
      || (kLien && parNomEn.get(kLien))
      || (k ? parNomEn.get(k) : null);

    const ignoreDe = (champ) => ignores.get(`${a.id}:${champ}`);
    const champs = [];
    // `manquant` : la case est VIDE dans l'app. C'est la règle qui justifiait le
    // bouton « Importer les textes anglais » — remplir le vide sans jamais
    // écraser. Devenue une propriété de chaque écart, elle se filtre, et
    // « tout cocher » cesse d'être un pari sur ce qu'on a déjà corrigé.
    const pousser = (champ, libelle, app, site, site_cle) => {
      champs.push({
        champ, libelle, app, site, site_cle,
        manquant: String(app || '').trim() === '',
        ignore: ignoreDe(champ) === site_cle,
      });
    };

    // Le contenu du site est découpé par section (voir woocommerce.js) et mappé
    // sur les champs de l'app. On compare chacun indépendamment ; on propose le
    // champ quand le site a du contenu ET qu'il diffère (le « garder » mémorisé
    // évite qu'un texte gardé revienne). Ces infos évoluent → comparaison utile.
    for (const f of [
      { champ: 'demarche', libelle: 'Démarche', app: a.demarche || '', site: p.demarche || '' },
      { champ: 'curriculum', libelle: 'Curriculum (C.V.)', app: a.curriculum || '', site: p.curriculum || '' },
    ]) {
      if (f.site.trim() && clefComparaison(f.site) !== clefComparaison(f.app)) {
        pousser(f.champ, f.libelle, f.app, f.site, clefComparaison(f.site));
      }
    }

    // ---- Textes ANGLAIS ----
    // Le site est bilingue (WPML) et les mêmes pages y existent en anglais,
    // rédigées à la main. Les quatre colonnes _en de l'app leur correspondent
    // une à une. ⚠ La CITATION anglaise n'a jamais été couverte par l'ancien
    // import en masse — d'où 22 citations françaises et 0 anglaise dans la base
    // au 2026-09-09. Un comparateur, lui, ne peut pas oublier un champ.
    if (pEn) {
      const citationEn = (pEn.excerpt || '').replace(/\s*(\[[…\.]+\]|…|\.\.\.)\s*$/u, '').trim();
      for (const f of [
        { champ: 'citation_en', libelle: 'Citation (EN)', app: a.citation_en || '', site: citationEn },
        { champ: 'biographie_en', libelle: 'Biographie (EN)', app: a.biographie_en || '', site: (pEn.biographie || '').trim() },
        { champ: 'demarche_en', libelle: 'Démarche (EN)', app: a.demarche_en || '', site: (pEn.demarche || '').trim() },
        { champ: 'curriculum_en', libelle: 'C.V. (EN)', app: a.curriculum_en || '', site: (pEn.curriculum || '').trim() },
      ]) {
        if (f.site && clefComparaison(f.site) !== clefComparaison(f.app)) {
          pousser(f.champ, f.libelle, f.app, f.site, clefComparaison(f.site));
        }
      }
    }

    // Citation : le site la garde dans l'« extrait » (zone dédiée). L'app a
    // désormais son propre champ « citation ». On les compare directement.
    const citation = (p.excerpt || '').replace(/\s*(\[[…\.]+\]|…|\.\.\.)\s*$/u, '').trim();
    if (citation && clefComparaison(citation) !== clefComparaison(a.citation || '')) {
      pousser('citation', 'Citation', a.citation || '', citation, clefComparaison(citation));
    }

    // Biographie : comparaison directe. Tolérance de transition — tant que la
    // citation est encore incluse DANS la bio de l'app (données existantes), on
    // ne signale pas la bio comme différente juste à cause d'elle (on tolère la
    // citation en début ou en fin).
    const bioSite = (p.biographie || '').trim();
    const clefApp = clefComparaison(a.biographie || '');
    const candidatsBio = [
      bioSite,
      citation ? `${citation}\n\n${bioSite}` : bioSite,
      citation ? `${bioSite}\n\n${citation}` : bioSite,
    ];
    if (bioSite && !candidatsBio.some((cand) => clefComparaison(cand) === clefApp)) {
      pousser('biographie', 'Biographie', a.biographie || '', bioSite, clefComparaison(bioSite));
    }

    if (p.image && !a.photo_path) {
      const site_cle = 'presente';
      // La photo est toujours « manquante » par construction : on ne la propose
      // que si l'app n'en a pas.
      champs.push({ champ: 'photo', libelle: 'Photo', app: '(aucune photo dans l\'app)', site: '(photo sur le site)', site_image: p.image, site_cle, manquant: true, ignore: ignoreDe('photo') === site_cle });
    }

    // `nom_site` remonte à l'écran pour que le lien posé à la main soit VISIBLE
    // là où il agit — et défaisable. Un rapprochement invisible qu'on ne peut
    // pas corriger vaut moins qu'un rapprochement manquant.
    lignes.push({ artiste_id: a.id, nom: nomApp, nom_site: a.nom_site || null, champs });
  }

  const siteSeul = portfolios
    .filter((p) => { const k = clefComparaison(p.nom); return k && !nomsVus.has(k); })
    .map((p) => ({
      nom: p.nom,
      citation: (p.excerpt || '').replace(/\s*(\[[…\.]+\]|…|\.\.\.)\s*$/u, '').trim(),
      biographie: p.biographie, demarche: p.demarche, curriculum: p.curriculum,
      excerpt: p.excerpt, image: p.image, link: p.link,
    }));

  const estActif = (l) => l.champs.some((c) => !c.ignore);
  const ignorees = lignes.reduce((n, l) => n + l.champs.filter((c) => c.ignore).length, 0);

  return {
    resume: {
      relies: lignes.length,
      avec_diff: lignes.filter(estActif).length,
      ignorees,
      app_seul: appSeul.length,
      site_seul: siteSeul.length,
      total_site: portfolios.length,
    },
    lignes, appSeul, siteSeul,
  };
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

// Traduit un champ vers l'anglais. Ne touche PAS à la base : renvoie la
// proposition, que l'utilisateur relit et corrige avant d'enregistrer.
async function traduireChamp({ champ, texte, contexte }) {
  const apiKey = exigerCle();
  return {
    texte: await require('./ia').traduireVersAnglais({ apiKey, texte, champ, contexte }),
    modele: require('./ia').MODELE_TRADUCTION,
  };
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

// Exécute une demande de déplacement du dossier de données déposée par les
// Réglages avant le redémarrage. La demande est CONSOMMÉE d'abord (le fichier est
// effacé) pour ne jamais reboucler indéfiniment si le déplacement échoue. En cas
// d'échec, message clair et poursuite du démarrage sur l'ancien emplacement
// (données intactes, papier d'adresse non modifié).
async function executerDeplacementEnAttente(progres) {
  const destination = lireDeplacementEnAttente();
  if (!destination) return;
  effacerDeplacementEnAttente();
  const source = getDataDir();
  try {
    await progres(6, 'Préparation du déplacement du dossier de données…');
    // La copie est synchrone : sur un autre disque, le splash ne se rafraîchit
    // pas pendant l'opération. On pose donc un message rassurant AVANT.
    await progres(10, 'Déplacement de vos fichiers… un instant, ne fermez pas Galeria.');
    const r = deplacerDossierDonnees(source, destination);
    await progres(55, 'Déplacement terminé.');
    if (r && r.avertissement) {
      dialog.showMessageBoxSync({
        type: 'info', title: 'Galeria',
        message: 'Le dossier de données a été déplacé.',
        detail: r.avertissement,
        buttons: ['Continuer'], noLink: true,
      });
    }
  } catch (err) {
    journaliserErreur('Déplacement du dossier de données échoué', err);
    dialog.showMessageBoxSync({
      type: 'warning', title: 'Galeria',
      message: "Le dossier de données n'a pas pu être déplacé.",
      detail: String((err && err.message) || err)
        + '\n\nGaleria continue avec l\'emplacement actuel. Vos données n\'ont pas été touchées.',
      buttons: ['Continuer'], noLink: true,
    });
  }
}

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

  // Déplacement du dossier de données demandé depuis les Réglages : exécuté ici,
  // au tout début, base FERMÉE et avant que ensureDirectories ne recrée quoi que
  // ce soit à l'ancien emplacement.
  await executerDeplacementEnAttente(progres);

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

  // Rangement du dossier Photos par artiste — une seule fois par base.
  // Placé APRÈS la copie de sauvegarde ci-dessus et après les migrations de
  // schéma. Il déplace de vrais fichiers : copie, vérification par empreinte,
  // puis suppression, et la base n'est réécrite qu'une fois tous les fichiers
  // arrivés. Voir src/db/migrer-photos.js.
  try {
    await progres(16, 'Rangement des photos…');
    const rangement = migrerPhotos(openDatabase());
    if (rangement.fait) {
      console.log(`Photos rangées par artiste : ${rangement.deplaces} déplacées, `
        + `${rangement.orphelins} non rattachées. Journal : ${rangement.journal}`);
    } else if (rangement.problemes) {
      journaliserErreur('Rangement des photos reporté',
        new Error(rangement.problemes.slice(0, 5).join(' | ')));
    }
    // Filet de sécurité : à chaque démarrage, on repasse tout le catalogue et
    // on remet à leur place les photos dont l'emplacement ne correspond plus
    // au statut. C'est ce qui rend inoffensif un rangement qui aurait échoué
    // (fichier verrouillé) ou une action dont on aurait oublié de le déclencher.
    const suivi = rangerPhotos(openDatabase());
    if (suivi.deplacees || suivi.echecs) {
      console.log(`Photos remises à leur place : ${suivi.deplacees} déplacée(s), ${suivi.echecs} échec(s) sur ${suivi.verifiees} vérifiée(s).`);
    }
  } catch (err) {
    // Jamais bloquant : l'app doit démarrer même si le rangement échoue, et
    // les fichiers sont alors restés en place.
    journaliserErreur('Rangement des photos échoué', err);
  }

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
  // Après toute action qui peut changer le statut d'une œuvre, on remet sa
  // photo dans le bon dossier — c'est la méthode de suivi des parents, qui
  // lisent l'emplacement d'un fichier pour savoir où en est une toile.
  //
  // Appelé ICI, dans les gestionnaires, et non dans les mutations : on est
  // alors HORS TRANSACTION. Un déplacement de fichier n'est pas annulable par
  // un ROLLBACK ; le faire à l'intérieur laisserait une photo déplacée pour
  // une vente qui n'a finalement pas eu lieu.
  //
  // `ids` limite la vérification aux œuvres touchées ; sans lui, tout le
  // catalogue est repassé — une comparaison de chaîne par œuvre, imperceptible.
  // Jamais bloquant : un fichier verrouillé ne doit pas faire échouer une
  // vente, et le rangement du prochain démarrage rattrapera.
  const rangerApres = (resultat, ids = null) => {
    try { rangerPhotos(openDatabase(), ids ? { ids } : {}); } catch { /* silencieux */ }
    return resultat;
  };

  ipcMain.handle('oeuvres:retrait', (_e, id, data) => rangerApres(definirRetraitOeuvre(id, data), [id]));
  ipcMain.handle('oeuvres:retrait-lot', (_e, ids, data) => rangerApres(definirRetraitOeuvresLot(ids, data)));
  ipcMain.handle('oeuvres:reserver', (_e, id, data) => rangerApres(reserverOeuvre(id, data), [id]));
  ipcMain.handle('oeuvres:liberer', (_e, id) => rangerApres(libererOeuvre(id), [id]));
  ipcMain.handle('suivi:donnees', () => ({
    preparation: oeuvresAPreparer(),
    ventes: ventesSuivi(),
  }));
  ipcMain.handle('ia:copier-pour-chatgpt', (_e, oeuvreId) => preparerCopiePourChatGPT(oeuvreId));
  ipcMain.handle('ia:copier-pour-chatgpt-inline', (_e, params) => preparerCopiePourChatGPTInline(params || {}));
  ipcMain.handle('ia:generer-description', (_e, oeuvreId) => genererDescriptionPourOeuvre(oeuvreId));
  ipcMain.handle('ia:traduire', (_e, params) => traduireChamp(params || {}));
  ipcMain.handle('ia:generer-description-inline', (_e, params) => genererDescriptionInline(params || {}));
  ipcMain.handle('ia:definir-cle', (_e, cle) => definirCleAnthropic(cle));
  ipcMain.handle('ia:effacer-cle', () => effacerCleAnthropic());
  ipcMain.handle('ia:cle-definie', () => {
    const cfg = require('./config').obtenirConfig();
    return { definie: !!(cfg?.ia?.cle_anthropic), chiffrement: safeStorage.isEncryptionAvailable() };
  });

  // ---- Site web (WooCommerce) ----
  ipcMain.handle('web:etat', () => {
    const cfg = require('./config').obtenirConfig();
    const w = cfg?.web || {};
    return {
      url: w.url || '',
      cles_definies: !!(w.consumer_key && w.consumer_secret),
      chiffrement: safeStorage.isEncryptionAvailable(),
    };
  });
  ipcMain.handle('web:definir-cles', (_e, data) => definirClesWoo(data || {}));
  ipcMain.handle('web:effacer-cles', () => effacerClesWoo());
  ipcMain.handle('web:tester-connexion', async () => {
    const { url, consumerKey, consumerSecret } = obtenirClesWoo();
    if (!url) throw new Error("Aucune adresse de site enregistrée. Renseigne l'adresse et les clés, puis Enregistrer.");
    if (!consumerKey || !consumerSecret) throw new Error('Aucune clé enregistrée. Renseigne la clé et le secret, puis Enregistrer.');
    return require('./web/woocommerce').testerConnexion({ url, consumerKey, consumerSecret });
  });
  // Comparer (lecture seule) : lit les produits du site et les confronte aux
  // œuvres de l'app par SKU = numéro d'inventaire. N'écrit rien.
  // `avecAnglais` : relit la boutique en anglais pour comparer aussi
  // `description_en`. Débrayable parce que ça DOUBLE la lecture du site — plus
  // de 500 produits paginés — et qu'on ne travaille pas toujours l'anglais.
  // `artisteId` : ne comparer que les œuvres de cet artiste (voir
  // lireProduitsArtiste). Absent : toute la boutique, comme avant.
  ipcMain.handle('web:comparer', async (_e, options) => {
    const avecAnglais = !!(options && options.avecAnglais);
    const artisteId = Number(options && options.artisteId) || null;
    const creds = obtenirClesWoo();
    if (!creds.url || !creds.consumerKey || !creds.consumerSecret) {
      throw new Error("Configure d'abord l'adresse et les clés dans Réglages → Site web.");
    }
    const woo = require('./web/woocommerce');
    const req = require('./db/requetes');
    const debut = Date.now();
    let oeuvres = req.oeuvresPourComparaisonWeb();
    let produits;
    let portee = null;
    if (artisteId) {
      const artiste = req.obtenirArtiste(artisteId);
      if (!artiste) throw new Error('Artiste introuvable.');
      const lu = await lireProduitsArtiste(woo, creds, artiste, oeuvres);
      produits = lu.produits;
      oeuvres = lu.oeuvres;
      portee = {
        artiste_id: artiste.id,
        artiste_nom: [artiste.prenom, artiste.nom].filter(Boolean).join(' ') || artiste.nom || '',
        categorie: lu.categorie ? lu.categorie.name : null,
        source: lu.source,
      };
    } else {
      produits = await woo.listerProduits(creds);
    }
    // La version anglaise passe par l'API PUBLIQUE : elle n'a pas besoin des
    // clés, et un échec de ce côté ne doit pas emporter toute la comparaison.
    let produitsEn = [];
    if (avecAnglais) {
      try {
        produitsEn = await woo.listerProduitsPublics({
          url: creds.url, langue: 'en',
          ...(artisteId ? { skus: produits.map((p) => p.sku) } : {}),
        });
      } catch (err) { journaliserErreur('Lecture des textes anglais (œuvres)', err); }
    }
    const ignores = new Map(req.listerWebSyncIgnore().map((r) => [`${r.oeuvre_id}:${r.champ}`, r.site_cle]));
    const res = comparerSiteEtApp(produits, oeuvres, ignores, produitsEn);
    res.anglais_lu = avecAnglais && produitsEn.length > 0;
    // Les adresses des œuvres sur le site (code QR des cartels, « Voir sur le
    // site ») se tiennent à jour ICI, avec ce qui vient d'être lu. Il fallait
    // un bouton, « Récupérer les adresses du site », qu'on oubliait — et
    // chaque œuvre publiée restait sans adresse. Produits publiés seulement :
    // l'adresse d'un brouillon ne mène nulle part.
    res.adresses_mises_a_jour = 0;
    try {
      res.adresses_mises_a_jour = majUrlsSiteDepuisSite(
        produits.filter((p) => p.status === 'publish' && p.permalink)
      ).remplies;
    } catch (err) { journaliserErreur('Adresses des œuvres sur le site', err); }
    res.portee = portee;
    res.duree_ms = Date.now() - debut;
    return res;
  });
  // « Garder la version de l'app » pour un champ : mémorise la clé du site.
  ipcMain.handle('web:ignorer-diff', (_e, oeuvreId, champ, siteCle) => ignorerDiffWeb(oeuvreId, champ, siteCle));
  // Annuler un « garder » (la différence pourra de nouveau être proposée).
  ipcMain.handle('web:retirer-ignore', (_e, oeuvreId, champ) => retirerIgnoreWeb(oeuvreId, champ));
  // Réconciliation « un seul côté ».
  // Télécharger l'image d'un produit (URL publique) → data URL pour le recadrage.
  ipcMain.handle('web:telecharger-image', (_e, url) => require('./web/woocommerce').telechargerImage(url));
  // Créer une fiche d'œuvre à partir d'un produit du site (l'artiste est choisi
  // dans l'app). Le SKU devient le numéro d'inventaire. Image gérée ensuite côté
  // renderer (téléchargement + recadrage habituel).
  // Caractéristiques d'un produit du site, prêtes à entrer dans une fiche, et
  // l'artiste suggéré d'après la CATÉGORIE du produit (vraie pour 494 œuvres
  // sur 510 au 2026-09-10). Lu par l'API publique : aucune clé nécessaire.
  // Voir caracteristiquesProduit() dans woocommerce.js pour la table de
  // correspondance, déduite des données réelles.
  ipcMain.handle('web:caracteristiques-produit', async (_e, sku) => {
    const { url } = obtenirClesWoo();
    if (!url) throw new Error("Configure d'abord l'adresse du site dans Réglages → Site web.");
    const woo = require('./web/woocommerce');
    const p = await woo.produitPublicParSku({ url, sku });
    if (!p) return { trouve: false };
    const db = openDatabase();
    // Supports déjà employés dans l'app, dans la graphie la plus fréquente :
    // ce sont eux qui décident où couper « Acrylique sur toile ».
    const supportsConnus = db.prepare(`SELECT support, COUNT(*) n FROM oeuvres
      WHERE trim(coalesce(support,'')) <> '' GROUP BY support ORDER BY n DESC`).all()
      .map((r) => r.support)
      .filter((s, i, t) => t.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
    const c = woo.caracteristiquesProduit(p, { supportsConnus });
    // Artiste suggéré : catégorie du produit = nom complet de l'artiste, ou le
    // nom qu'il porte sur le site (nom_site, posé par « Relier »).
    const plat = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const cats = new Set(c.categories.map(plat));
    const artiste = db.prepare('SELECT id, prenom, nom, nom_site FROM artistes WHERE archive = 0').all()
      .find((a) => cats.has(plat([a.prenom, a.nom].filter(Boolean).join(' '))) || (a.nom_site && cats.has(plat(a.nom_site))));
    return { trouve: true, caracteristiques: c, artiste_id_suggere: artiste ? artiste.id : null };
  });
  ipcMain.handle('web:creer-oeuvre-depuis-site', (_e, data) => {
    const d = data || {};
    // Les caractéristiques reprises du site (voir 'web:caracteristiques-produit').
    // Liste blanche : seuls ces champs peuvent entrer par ce chemin.
    const c = (d.caracteristiques && typeof d.caracteristiques === 'object') ? d.caracteristiques : {};
    const CARAC = ['type', 'format', 'medium', 'support', 'orientation', 'sujets', 'style', 'hauteur', 'largeur', 'profondeur'];
    const reprises = {};
    for (const k of CARAC) if (c[k] != null && c[k] !== '') reprises[k] = c[k];
    // Le texte des dimensions se compose ailleurs à l'enregistrement de la
    // fiche ; la création ne passe pas par là, on le fournit donc ici.
    const dims = formaterDimensionsTexte(reprises.hauteur, reprises.largeur, reprises.profondeur);
    if (dims) reprises.dimensions = dims;
    const oeuvre = creerOeuvre({
      ...reprises,
      titre: d.titre,
      artiste_id: d.artiste_id,
      numero_inventaire: d.sku,
      description: d.description,
      prix: d.prix,
      statut: 'disponible',
    });
    return { ok: true, oeuvre, reprises: Object.keys(reprises) };
  });
  // Corriger le SKU d'une œuvre existante (coquille) = aligner son numéro
  // d'inventaire sur le SKU du site, au lieu de créer un doublon.
  ipcMain.handle('web:corriger-sku', (_e, oeuvreId, sku) => {
    const oeuvre = corrigerNumeroInventaire(oeuvreId, sku);
    return { ok: true, oeuvre };
  });

  // --- Synchro des ARTISTES (type site `portfolio`, API WordPress publique) ---
  ipcMain.handle('web:comparer-artistes', async (_e, options) => {
    const debut = Date.now();
    const avecAnglais = !!(options && options.avecAnglais);
    const { url } = obtenirClesWoo();
    if (!url) throw new Error("Configure d'abord l'adresse du site dans Réglages → Site web.");
    const woo = require('./web/woocommerce');
    const portfolios = await woo.listerArtistesSite({ url });
    let portfoliosEn = [];
    if (avecAnglais) {
      try { portfoliosEn = await woo.listerArtistesSite({ url, langue: 'en' }); }
      catch (err) { journaliserErreur('Lecture des textes anglais (artistes)', err); }
    }
    const req = require('./db/requetes');
    const artistes = req.artistesPourComparaisonWeb();
    const ignores = new Map(req.listerWebSyncIgnoreArtiste().map((r) => [`${r.artiste_id}:${r.champ}`, r.site_cle]));
    const res = comparerArtistesEtSite(portfolios, artistes, ignores, portfoliosEn);
    res.anglais_lu = avecAnglais && portfoliosEn.length > 0;
    res.duree_ms = Date.now() - debut;
    return res;
  });
  // Une citation qui arrive dans une case VIDE était souvent recopiée dans la
  // biographie des vieilles fiches : on l'en retire dans le même geste. C'était
  // le travail de « Séparer les citations », retiré le 2026-09-11 — il ne
  // traitait, lui aussi, que les citations vides.
  ipcMain.handle('web:importer-champ-artiste', (_e, artisteId, champ, valeur) => {
    const avant = (champ === 'citation' || champ === 'citation_en') ? obtenirArtiste(artisteId) : null;
    let artiste = majChampArtiste(artisteId, champ, valeur);
    let bioNettoyee = false;
    if (avant && !String(avant[champ] || '').trim() && String(valeur || '').trim()) {
      const champBio = champ === 'citation' ? 'biographie' : 'biographie_en';
      const bio = avant[champBio] || '';
      const nouvelle = retirerCitationDeBio(bio, valeur);
      if (nouvelle !== bio) { artiste = majChampArtiste(artisteId, champBio, nouvelle); bioNettoyee = true; }
    }
    return { ok: true, artiste, bio_nettoyee: bioNettoyee };
  });
  ipcMain.handle('web:ignorer-diff-artiste', (_e, artisteId, champ, siteCle) => ignorerDiffArtisteWeb(artisteId, champ, siteCle));
  ipcMain.handle('web:retirer-ignore-artiste', (_e, artisteId, champ) => retirerIgnoreArtisteWeb(artisteId, champ));
  ipcMain.handle('web:creer-artiste-depuis-site', (_e, data) => {
    const d = data || {};
    const artiste = creerArtiste({ nom: d.nom, citation: d.citation, biographie: d.biographie, demarche: d.demarche, curriculum: d.curriculum });
    return { ok: true, artiste };
  });
  // Relier un artiste du site à une fiche EXISTANTE, au lieu d'en créer une en
  // double. Le renommage est facultatif et passe par le même soin que
  // 'artistes:modifier' : un artiste renommé emporte son dossier de photos,
  // sinon la méthode de suivi des parents se casse en silence.
  ipcMain.handle('web:relier-artiste', (_e, artisteId, options) => {
    const o = options || {};
    let ancienDossier = null;
    try { ancienDossier = dossierArtiste(obtenirArtiste(artisteId)); } catch {}
    const artiste = relierArtisteAuSite(artisteId, o);
    try {
      if (ancienDossier) renommerDossierArtiste(openDatabase(), artisteId, ancienDossier);
    } catch { /* silencieux : la base reste juste, le prochain rangement suivra */ }
    return { ok: true, artiste };
  });
  // Défaire le lien. Ne restaure PAS le nom : le renommage était un choix
  // distinct, et l'annuler à l'aveugle en écraserait peut-être un autre.
  ipcMain.handle('web:delier-artiste', (_e, artisteId) => ({ ok: true, artiste: delierArtisteDuSite(artisteId) }));
  // Transition assistée (parents) : pour chaque artiste relié dont la citation est
  // encore VIDE, remplir le champ « Citation » depuis le site et — si la citation
  // figure comme bloc distinct dans la bio — l'en retirer. Ne réécrit jamais toute
  // la bio ; ne touche pas aux artistes qui ont déjà une citation.
  // Remplit l'adresse de la fiche de chaque œuvre sur le site. Passe par l'API
  // « Store » de WooCommerce, qui est PUBLIQUE : aucune clé REST nécessaire.
  // ---- Expositions ----
  ipcMain.handle('expos:liste', (_e, filtres) => listerExpositions(filtres || {}));
  ipcMain.handle('expos:get', (_e, id) => obtenirExposition(id));
  ipcMain.handle('expos:creer', (_e, data) => creerExposition(data || {}));
  ipcMain.handle('expos:modifier', (_e, id, data) => modifierExposition(id, data || {}));
  ipcMain.handle('expos:supprimer', (_e, id) => supprimerExposition(id));
  ipcMain.handle('expos:eligibles', () => oeuvresEligiblesExposition());
  ipcMain.handle('expos:ajouter-oeuvres', (_e, id, ids) => rangerApres(ajouterOeuvresExposition(id, ids)));
  ipcMain.handle('expos:retirer-oeuvre', (_e, id, oeuvreId) => rangerApres(retirerOeuvreExposition(id, oeuvreId), [oeuvreId]));
  ipcMain.handle('expos:terminer', (_e, id) => rangerApres(terminerExposition(id)));
  // Juste avant d'imprimer, les œuvres sans adresse sur le site vont la
  // chercher (une seule lecture, par leurs numéros d'inventaire) : sinon leur
  // cartel sortirait sans code QR. Sans réseau ou sans site, on imprime quand
  // même — c'est le cartel sans code, comme avant.
  ipcMain.handle('expos:cartels', async (_e, id, options) => {
    const opts = options || {};
    let adressesTrouvees = 0;
    if (opts.afficherQr !== false) {
      try {
        const { url } = obtenirClesWoo();
        const expo = require('./db/requetes').obtenirExposition(id);
        const skus = ((expo && expo.oeuvres) || [])
          .filter((o) => !o.retire_le && !String(o.url_site || '').trim() && String(o.numero_inventaire || '').trim())
          .map((o) => o.numero_inventaire);
        if (url && skus.length) {
          const produits = await require('./web/woocommerce').listerProduitsPublics({ url, skus });
          adressesTrouvees = majUrlsSiteDepuisSite(produits.filter((p) => p.permalink)).remplies;
        }
      } catch (err) { journaliserErreur('Adresses des cartels', err); }
    }
    const r = await genererCartelsPdf(id, opts);
    return { ...r, adresses_trouvees: adressesTrouvees };
  });

  // (L'import en masse des textes anglais a été RETIRÉ le 2026-09-09. Sa règle
  //  — remplir les champs anglais vides, ne jamais écraser — est devenue le
  //  filtre « Manquants » du comparateur, qui couvre les mêmes champs PLUS la
  //  citation anglaise, que cet import n'a jamais traitée : d'où 22 citations
  //  françaises et 0 anglaise dans la base. Deux boutons qui se ressemblaient
  //  à ce point étaient un piège ; il n'en reste qu'un.)


  // Comparaison d'un SEUL élément, depuis sa fiche.
  ipcMain.handle('web:comparer-oeuvre', async (_e, oeuvreId) => {
    const creds = obtenirClesWoo();
    if (!creds.url || !creds.consumerKey || !creds.consumerSecret) throw new Error("Configure d'abord l'adresse et les clés dans Réglages → Site web.");
    const oeuvre = require('./db/requetes').obtenirOeuvre(oeuvreId);
    if (!oeuvre) throw new Error('Œuvre introuvable.');
    const sku = (oeuvre.numero_inventaire || '').trim();
    const produit = sku ? await require('./web/woocommerce').produitParSku(creds, sku) : null;
    if (!produit) return { relie: false, sku };
    const ignores = new Map(require('./db/requetes').listerWebSyncIgnore()
      .filter((r) => r.oeuvre_id === oeuvre.id).map((r) => [`${r.oeuvre_id}:${r.champ}`, r.site_cle]));
    const res = comparerSiteEtApp([produit], [oeuvre], ignores);
    return { relie: true, sku, ligne: res.lignes[0] || null };
  });
  ipcMain.handle('web:comparer-artiste', async (_e, artisteId) => {
    const creds = obtenirClesWoo();
    if (!creds.url) throw new Error("Configure d'abord l'adresse du site dans Réglages → Site web.");
    const artiste = require('./db/requetes').artistesPourComparaisonWeb().find((a) => a.id === artisteId);
    if (!artiste) throw new Error('Artiste introuvable.');
    const portfolios = await require('./web/woocommerce').listerArtistesSite({ url: creds.url });
    const ignores = new Map(require('./db/requetes').listerWebSyncIgnoreArtiste()
      .filter((r) => r.artiste_id === artiste.id).map((r) => [`${r.artiste_id}:${r.champ}`, r.site_cle]));
    const res = comparerArtistesEtSite(portfolios, [artiste], ignores);
    return { relie: res.lignes.length > 0, ligne: res.lignes[0] || null };
  });
  // Importer UN champ du site vers l'app (écrit dans la base locale seulement,
  // jamais sur le site). Liste blanche stricte des champs.
  ipcMain.handle('web:importer-champ', (_e, oeuvreId, champ, valeur) => {
    // Écrit UNIQUEMENT le champ visé dans la base locale (jamais sur le site).
    // La validation et la liste blanche vivent dans majChampOeuvre.
    const oeuvre = majChampOeuvre(oeuvreId, champ, valeur);
    return { ok: true, oeuvre };
  });
  // Import en lot : liste d'items { oeuvreId, champ, valeur }. Chaque item est
  // validé indépendamment ; on renvoie le compte de réussites et les erreurs.
  ipcMain.handle('web:importer-lot', (_e, items) => {
    const liste = Array.isArray(items) ? items : [];
    let reussis = 0;
    const erreurs = [];
    for (const it of liste) {
      try {
        majChampOeuvre(it.oeuvreId, it.champ, it.valeur);
        reussis += 1;
      } catch (err) {
        erreurs.push({ oeuvreId: it.oeuvreId, champ: it.champ, message: err && err.message ? err.message : String(err) });
      }
    }
    return { ok: true, reussis, total: liste.length, erreurs };
  });
  // Mettre à jour l'étiquette de statut d'une œuvre depuis la réconciliation.
  ipcMain.handle('web:definir-statut', (_e, oeuvreId, statut) => {
    const oeuvre = majStatutOeuvre(oeuvreId, statut);
    return { ok: true, oeuvre };
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
  ipcMain.handle('app:ouvrir-url', async (_e, url) => {
    // http(s) pour les liens web, mailto: pour « Écrire au soutien ».
    if (typeof url !== 'string' || !/^(https?:\/\/|mailto:)/i.test(url)) {
      return { ok: false, erreur: 'URL invalide' };
    }
    // ⚠ ATTENDRE le résultat. Sans le `await`, un échec de Windows — adresse
    // trop longue, aucun logiciel de courriel associé — passait inaperçu : la
    // fonction répondait « ok » et l'utilisateur voyait simplement qu'il ne se
    // passait rien. Corrigé le 2026-09-06.
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (err) {
      journaliserErreur('Ouverture de lien échouée', err);
      return { ok: false, erreur: err && err.message ? err.message : String(err) };
    }
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
  // Erreurs de l'INTERFACE (processus de rendu). Sans ce canal, elles ne
  // laissaient aucune trace : le filet global de src/app/app.js affiche
  // « Erreur imprévue » et écrit la pile dans la console de développement, que
  // personne n'ouvre. Un signalement de problème ne contenait donc rien
  // d'exploitable — c'est ce qui a rendu invisible le défaut de « Reprendre la
  // valeur du site » (2026-09-07).
  //
  // `on` et non `handle` : consigner ne doit jamais faire attendre l'interface
  // ni pouvoir échouer chez elle. Une erreur ici ne doit surtout pas en
  // provoquer une autre — d'où le try/catch qui avale tout.
  ipcMain.on('app:journaliser-erreur', (_e, info) => {
    try {
      const i = info && typeof info === 'object' ? info : {};
      const ou = i.ecran ? `écran « ${String(i.ecran).slice(0, 80)} »` : 'écran inconnu';
      const trace = String(i.pile || i.message || 'erreur sans détail').slice(0, 4000);
      journaliserErreur(`Erreur d'interface (${ou})`, { stack: trace });
    } catch {}
  });
  ipcMain.handle('import:choisir-fichier', (event) => importChoisirFichier(event.sender));
  ipcMain.handle('import:executer', (_e, filePath, mode) => importExecuter(filePath, mode));
  // ---- Copie pour le soutien technique -------------------------------
  // Un exemplaire du catalogue à envoyer à Dave, SANS aucune donnée de
  // client. Ce qui est gardé et ce qui est vidé se décide dans
  // src/db/copie-soutien.js — pas ici.
  ipcMain.handle('soutien:apercu', () => apercuCopieSoutien());
  // Rapport de problème : on CONSTRUIT et on RENVOIE le texte, on n envoie
  // rien. L envoi reste un geste des parents, dans leur logiciel de courriel.
  ipcMain.handle('soutien:rapport', (_e, opts) => {
    const r = construireRapport(opts || {});
    return { rapport: r, texte: rapportEnTexte(r) };
  });
  ipcMain.handle('soutien:enregistrer-rapport', async (e, texte) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const d = new Date();
    const q = (x) => String(x).padStart(2, '0');
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Enregistrer le signalement',
      defaultPath: `signalement-${d.getFullYear()}-${q(d.getMonth()+1)}-${q(d.getDate())}.txt`,
      filters: [{ name: 'Texte', extensions: ['txt'] }],
    });
    if (canceled || !filePath) return { cancelled: true };
    fs.writeFileSync(filePath, String(texte || ''), 'utf-8');
    shell.showItemInFolder(filePath);
    return { chemin: filePath };
  });
  ipcMain.handle('soutien:produire', async (e, opts) => {
    const avecPhotos = !!(opts && opts.avecPhotos);
    const win = BrowserWindow.fromWebContents(e.sender);
    const d = new Date();
    const p2 = (x) => String(x).padStart(2, '0');
    const jour = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

    // Sans photos : un seul fichier, qu'on peut joindre à un courriel.
    // Avec photos : un dossier — 200 Mo ne passent pas par courriel de toute
    // façon, autant assumer la copie sur clé USB.
    if (!avecPhotos) {
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Enregistrer la copie pour le soutien',
        defaultPath: `Galeria-soutien-${jour}.db`,
        filters: [{ name: 'Base Galeria', extensions: ['db'] }],
      });
      if (canceled || !filePath) return { cancelled: true };
      return { ...produireCopieSoutien(filePath), avecPhotos: false };
    }

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choisir où déposer le dossier de la copie',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || !filePaths.length) return { cancelled: true };
    const dossier = path.join(filePaths[0], `Galeria-soutien-${jour}`);
    fs.mkdirSync(dossier, { recursive: true });
    const r = produireCopieSoutien(path.join(dossier, 'galerie.db'));
    let photos = 0;
    const srcPhotos = getPhotosDir();
    if (fs.existsSync(srcPhotos)) {
      fs.cpSync(srcPhotos, path.join(dossier, 'Photos'), { recursive: true });
      const compter = (abs) => {
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
          if (ent.isDirectory()) compter(path.join(abs, ent.name)); else photos++;
        }
      };
      compter(path.join(dossier, 'Photos'));
    }
    return { ...r, chemin: dossier, avecPhotos: true, photos };
  });

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
  // Un artiste renommé emporte son dossier de photos. Sans ça, corriger une
  // faute de frappe créerait un SECOND dossier et séparerait ses photos en
  // deux endroits — l'app continuerait de fonctionner, mais la méthode de
  // suivi des parents, elle, serait cassée.
  ipcMain.handle('artistes:modifier', (_e, id, data) => {
    let ancienDossier = null;
    try { ancienDossier = dossierArtiste(obtenirArtiste(id)); } catch {}
    const resultat = modifierArtiste(id, data);
    try {
      if (ancienDossier) renommerDossierArtiste(openDatabase(), id, ancienDossier);
    } catch { /* silencieux : la base reste juste, le prochain rangement suivra */ }
    return resultat;
  });
  ipcMain.handle('artistes:creer', (_e, data) => creerArtiste(data));
  ipcMain.handle('artistes:supprimer', (_e, id) => supprimerArtiste(id));
  ipcMain.handle('oeuvres:liste', (_e, filtres) => listerOeuvres(filtres));
  ipcMain.handle('oeuvres:get', (_e, id) => obtenirOeuvre(id));
  ipcMain.handle('oeuvres:detail-artiste', (_e, artisteId) => oeuvresDetailArtiste(artisteId));
  ipcMain.handle('oeuvres:par-ids', (_e, ids) => oeuvresParIds(ids));
  ipcMain.handle('oeuvres:fiche-bundle', (_e, id) => obtenirFicheOeuvreBundle(id));
  ipcMain.handle('oeuvres:modifier', (_e, id, data) => rangerApres(modifierOeuvre(id, data), [id]));
  ipcMain.handle('oeuvres:modifier-lot', (_e, modifs) => rangerApres(modifierOeuvresLot(modifs)));
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
  ipcMain.handle('photo:lire-pour-recadrage', (_e, opts) => lirePourRecadrage(opts));
  ipcMain.handle('photo:enregistrer-recadree', (_e, opts) => enregistrerImageRecadree(opts));

  // Section « Photos » de la fiche d'artiste (lot 3 du chantier photos).
  ipcMain.handle('photos-artiste:liste', (_e, artisteId) => listerPhotosArtiste(artisteId));
  ipcMain.handle('photos-artiste:ajouter', (e, artisteId) => ajouterPhotosDivers(e.sender, artisteId));
  ipcMain.handle('photos-artiste:copier', (_e, chemin) => copierPhoto(chemin));
  ipcMain.handle('photos-artiste:exporter', (e, chemins) => exporterPhotos(e.sender, chemins));
  ipcMain.handle('photos-artiste:ouvrir-dossier', (_e, artisteId) => ouvrirDossierArtiste(artisteId));
  ipcMain.handle('config:get', () => {
    // Ne jamais exposer l'empreinte du code de verrouillage au renderer.
    // Ni l'empreinte du code, ni celle de la réponse de secours.
    const cfg = JSON.parse(JSON.stringify(obtenirConfig()));
    if (cfg.securite) {
      delete cfg.securite.code_hash; delete cfg.securite.code_sel;
      delete cfg.securite.reponse_hash; delete cfg.securite.reponse_sel;
    }
    return cfg;
  });
  ipcMain.handle('config:sauver', (_e, partiel) => mettreAJourConfig(partiel));

  // --- Verrou léger de l'application (src/securite.js) ---
  const securite = require('./securite');
  ipcMain.handle('securite:etat', () => securite.etatSecurite());
  ipcMain.handle('securite:definir-code', (_e, code) => securite.definirCode(code));
  ipcMain.handle('securite:retirer-code', () => securite.retirerCode());
  ipcMain.handle('securite:verifier-code', (_e, code) => securite.verifierCode(code));
  ipcMain.handle('securite:definir-options', (_e, opts) => securite.definirOptions(opts));
  ipcMain.handle('securite:definir-question', (_e, q, r) => securite.definirQuestion(q, r));
  ipcMain.handle('securite:retirer-question', () => securite.retirerQuestion());
  ipcMain.handle('securite:verifier-reponse', (_e, r) => securite.verifierReponse(r));
  ipcMain.handle('securite:reinitialiser-code', (_e, r, code) => securite.reinitialiserCodeParSecours(r, code));

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
  // Sélecteur de fichier pour le logo de la galerie (Réglages → La galerie).
  // Renvoie le chemin choisi ; le fichier n'est pas copié — c'est ce chemin
  // qui est lu à la génération des documents (logoGalerieEnDataUrl).
  ipcMain.handle('config:choisir-logo', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choisir le logo de la galerie',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (canceled || !filePaths.length) return { cancelled: true };
    return { path: filePaths[0] };
  });
  ipcMain.handle('backup:redemarrer', () => {
    arreterSauvegardePeriodique();
    demarrerSauvegardePeriodique(surEvenementSauvegarde);
  });

  // ===== Emplacement du dossier de données (déplacement / adoption) =====
  ipcMain.handle('donnees:emplacement', () => {
    const chemin = getDataDir();
    const defaut = path.join(app.getPath('documents'), 'Galeria');
    return {
      chemin,
      sousOneDrive: estSousOneDrive(chemin),
      parDefaut: path.resolve(chemin).toLowerCase() === path.resolve(defaut).toLowerCase(),
      // Dossier personnel de l'utilisateur (C:\Users\<nom>\Galeria) : écriture
      // garantie et HORS du Documents redirigé par OneDrive.
      defautSuggere: path.join(app.getPath('home'), 'Galeria'),
    };
  });

  // Choisir OÙ placer le dossier : l'utilisateur choisit un dossier parent, et
  // Galeria y crée un sous-dossier « Galeria ».
  ipcMain.handle('donnees:choisir-destination', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choisir où placer le dossier Galeria',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || !filePaths.length) return { cancelled: true };
    return { parent: filePaths[0], destination: path.join(filePaths[0], 'Galeria') };
  });

  // Validation instantanée d'une destination, sans rien déplacer.
  ipcMain.handle('donnees:valider-destination', (_e, destination) => {
    try {
      verifierDestination(getDataDir(), destination);
      return { ok: true };
    } catch (e) {
      return { ok: false, erreur: e.message };
    }
  });

  // Enregistre la demande de déplacement puis redémarre : le déplacement a lieu
  // au prochain démarrage, base fermée.
  ipcMain.handle('donnees:deplacer', (_e, destination) => {
    try {
      verifierDestination(getDataDir(), destination);
    } catch (e) {
      return { ok: false, erreur: e.message };
    }
    ecrireDeplacementEnAttente(destination);
    setTimeout(() => { app.relaunch(); app.exit(0); }, 250);
    return { ok: true };
  });

  // Choisir un dossier Galeria déjà existant (cas « mes données sont ailleurs »).
  ipcMain.handle('donnees:choisir-dossier-existant', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Indiquer le dossier Galeria existant',
      properties: ['openDirectory'],
    });
    if (canceled || !filePaths.length) return { cancelled: true };
    return { dossier: filePaths[0], valide: estDossierGaleriaValide(filePaths[0]) };
  });

  // Pointe Galeria vers un dossier existant (aucun déplacement) puis redémarre.
  ipcMain.handle('donnees:adopter', (_e, dossier) => {
    if (!estDossierGaleriaValide(dossier)) {
      return { ok: false, erreur: 'Ce dossier ne contient pas de base Galeria (galerie.db). Choisissez le dossier « Galeria » lui-même.' };
    }
    if (path.resolve(dossier).toLowerCase() === path.resolve(getDataDir()).toLowerCase()) {
      return { ok: false, erreur: "C'est déjà l'emplacement utilisé actuellement." };
    }
    ecrireEmplacementConfigure(dossier);
    setTimeout(() => { app.relaunch(); app.exit(0); }, 250);
    return { ok: true };
  });
  // Taux de change du convertisseur (page Outils) : lecture du cache et
  // récupération meilleur effort à la Banque du Canada. Aucune donnée ne sort.
  ipcMain.handle('outils:taux-change', () => tauxMemorises());
  ipcMain.handle('outils:taux-change-recuperer', () => recupererTauxChange());
  // Copie de texte dans le presse-papier (bouton « Copier le tableau » du plan
  // de versements). Passe par le processus principal pour éviter les contraintes
  // de permission du renderer.
  ipcMain.handle('outils:copier-texte', (_e, texte) => {
    clipboard.writeText(texte == null ? '' : String(texte));
    return { ok: true };
  });
  ipcMain.handle('certificat:analyser-type', (_e, type) => analyserTypeOeuvre(type));
  ipcMain.handle('oeuvres:types', () => listerTypesOeuvre());
  ipcMain.handle('oeuvres:supports', () => listerSupportsOeuvre());
  ipcMain.handle('oeuvres:styles', () => listerStylesOeuvre());
  ipcMain.handle('artistes:types', () => listerTypesArtiste());
  ipcMain.handle('oeuvres:mediums', () => listerMediumsOeuvre());
  ipcMain.handle('oeuvres:mediums-artiste', (_e, artisteId) => listerMediumsArtiste(artisteId));
  ipcMain.handle('clients:liste', (_e, filtres) => listerClients(filtres));
  ipcMain.handle('clients:get', (_e, id) => obtenirClient(id));
  ipcMain.handle('clients:fiche-bundle', (_e, id) => obtenirFicheClientBundle(id));
  ipcMain.handle('clients:modifier', (_e, id, data) => modifierClient(id, data));
  ipcMain.handle('clients:creer', (_e, data) => creerClient(data));
  ipcMain.handle('clients:supprimer', (_e, id) => supprimerClient(id));
  ipcMain.handle('ventes:liste', () => listerVentes());
  ipcMain.handle('ventes:fiche-bundle', (_e, id) => obtenirFicheVenteBundle(id));
  ipcMain.handle('ventes:creer', (_e, data) => rangerApres(creerVente(data)));
  ipcMain.handle('ventes:modifier', (_e, id, data) => rangerApres(modifierVente(id, data)));
  ipcMain.handle('ventes:maj-cycle', (_e, id, data) => rangerApres(majCycleVente(id, data)));
  ipcMain.handle('ventes:supprimer', (_e, id) => rangerApres(supprimerVente(id)));
  ipcMain.handle('ventes:apercu-numero-facture', () => apercuProchainNumeroFacture());
  ipcMain.handle('oeuvres:apercu-numero-inventaire', (_e, artisteId) => apercuProchainNumeroInventaire(artisteId));
  ipcMain.handle('oeuvres:reserver-numero-inventaire', (_e, artisteId) => reserverProchainNumeroInventaire(artisteId));
  ipcMain.handle('ventes:reserver-numero-facture', () => reserverProchainNumeroFacture());
  ipcMain.handle('certificats:liste-oeuvre', (_e, oeuvreId) => listerCertificatsParOeuvre(oeuvreId));
  ipcMain.handle('certificats:liste-vente', (_e, venteId) => listerCertificatsParVente(venteId));
  ipcMain.handle('certificats:creer', (_e, data) => creerCertificat(data));
  ipcMain.handle('certificats:supprimer', (_e, id) => supprimerCertificat(id));
  ipcMain.handle('certificats:apercu', (_e, oeuvreId) => apercuNumeroCertificat(oeuvreId));
  ipcMain.handle('pdf:certificat-generer', (_e, id) => genererCertificatPdf(id));
  ipcMain.handle('pdf:facture-artiste-generer', (_e, venteId) => genererFactureArtistePdf(venteId));
  ipcMain.handle('pdf:catalogue-generer', (_e, artisteId, options) => genererCataloguePdf(artisteId, options || {}));
  ipcMain.handle('pdf:annexe-generer', (_e, payload) => genererAnnexePdf(payload));
  ipcMain.handle('pdf:presentation-generer', (_e, artisteId, options) => genererPresentationPdf(artisteId, options || {}));
  ipcMain.handle('pdf:pochette-generer', (_e, venteId, options) => genererPochette(venteId, options || {}));
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
