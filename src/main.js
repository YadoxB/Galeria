const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { openDatabase, closeDatabase, getStats } = require('./db/database');
const { getPhotosDir } = require('./db/paths');
const { choisirPhoto, effacerPhoto, lireFichierImage, lireOriginale, lirePourRecadrage, enregistrerImageRecadree } = require('./photos');
const { obtenirConfig, mettreAJourConfig } = require('./config');

protocol.registerSchemesAsPrivileged([
  { scheme: 'galerie', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
const {
  sauvegarder,
  demarrerSauvegardePeriodique,
  arreterSauvegardePeriodique,
} = require('./db/backup');
const { previewFile, importArtistes, importOeuvres } = require('./import/importer');
const { genererCertificatPdf, genererFactureArtistePdf } = require('./pdf');
const {
  listerArtistes,
  obtenirArtiste,
  voisinsArtiste,
  listerOeuvres,
  obtenirOeuvre,
  voisinsOeuvre,
  listerTypesOeuvre,
  listerClients,
  obtenirClient,
  voisinsClient,
  listerVentesClient,
  listerVentesOeuvre,
  listerVentes,
  obtenirVente,
  voisinsVente,
  listerCertificatsParOeuvre,
  listerCertificatsParVente,
  obtenirCertificat,
} = require('./db/requetes');
const {
  modifierArtiste, creerArtiste, supprimerArtiste,
  modifierOeuvre, creerOeuvre, supprimerOeuvre,
  modifierClient, creerClient, supprimerClient,
  creerVente, modifierVente, supprimerVente,
  apercuProchainNumeroFacture, reserverProchainNumeroFacture,
  creerCertificat, modifierCertificat, supprimerCertificat,
  apercuProchainNumeroCertificat, reserverProchainNumeroCertificat,
} = require('./db/mutations');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
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
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => win.show());
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
  const db = openDatabase();
  return preview.type === 'artistes'
    ? importArtistes(db, preview.rows, mode)
    : importOeuvres(db, preview.rows, mode);
}

function sauvegarderEtRetourner() {
  const dest = sauvegarder();
  return { path: dest, nom: path.basename(dest), dossier: path.dirname(dest) };
}

app.whenReady().then(() => {
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

  openDatabase();
  ipcMain.handle('db:stats', () => getStats());
  ipcMain.handle('import:choisir-fichier', (event) => importChoisirFichier(event.sender));
  ipcMain.handle('import:executer', (_e, filePath, mode) => importExecuter(filePath, mode));
  ipcMain.handle('backup:now', () => sauvegarderEtRetourner());
  ipcMain.handle('artistes:liste', () => listerArtistes());
  ipcMain.handle('artistes:get', (_e, id) => obtenirArtiste(id));
  ipcMain.handle('artistes:voisins', (_e, id) => voisinsArtiste(id));
  ipcMain.handle('artistes:modifier', (_e, id, data) => modifierArtiste(id, data));
  ipcMain.handle('artistes:creer', (_e, data) => creerArtiste(data));
  ipcMain.handle('artistes:supprimer', (_e, id) => supprimerArtiste(id));
  ipcMain.handle('oeuvres:liste', (_e, filtres) => listerOeuvres(filtres));
  ipcMain.handle('oeuvres:get', (_e, id) => obtenirOeuvre(id));
  ipcMain.handle('oeuvres:voisins', (_e, id) => voisinsOeuvre(id));
  ipcMain.handle('oeuvres:modifier', (_e, id, data) => modifierOeuvre(id, data));
  ipcMain.handle('oeuvres:creer', (_e, data) => creerOeuvre(data));
  ipcMain.handle('oeuvres:supprimer', (_e, id) => supprimerOeuvre(id));
  ipcMain.handle('photo:choisir', (e, opts) => choisirPhoto(e.sender, opts));
  ipcMain.handle('photo:effacer', (_e, opts) => effacerPhoto(opts));
  ipcMain.handle('photo:lire-fichier', (e) => lireFichierImage(e.sender));
  ipcMain.handle('photo:lire-originale', (_e, opts) => lireOriginale(opts));
  ipcMain.handle('photo:lire-pour-recadrage', (_e, opts) => lirePourRecadrage(opts));
  ipcMain.handle('photo:enregistrer-recadree', (_e, opts) => enregistrerImageRecadree(opts));
  ipcMain.handle('config:get', () => obtenirConfig());
  ipcMain.handle('config:sauver', (_e, partiel) => mettreAJourConfig(partiel));
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
    demarrerSauvegardePeriodique();
  });
  ipcMain.handle('oeuvres:types', () => listerTypesOeuvre());
  ipcMain.handle('clients:liste', () => listerClients());
  ipcMain.handle('clients:get', (_e, id) => obtenirClient(id));
  ipcMain.handle('clients:voisins', (_e, id) => voisinsClient(id));
  ipcMain.handle('clients:modifier', (_e, id, data) => modifierClient(id, data));
  ipcMain.handle('clients:creer', (_e, data) => creerClient(data));
  ipcMain.handle('clients:supprimer', (_e, id) => supprimerClient(id));
  ipcMain.handle('clients:ventes', (_e, id) => listerVentesClient(id));
  ipcMain.handle('oeuvres:ventes', (_e, id) => listerVentesOeuvre(id));
  ipcMain.handle('ventes:liste', () => listerVentes());
  ipcMain.handle('ventes:get', (_e, id) => obtenirVente(id));
  ipcMain.handle('ventes:voisins', (_e, id) => voisinsVente(id));
  ipcMain.handle('ventes:creer', (_e, data) => creerVente(data));
  ipcMain.handle('ventes:modifier', (_e, id, data) => modifierVente(id, data));
  ipcMain.handle('ventes:supprimer', (_e, id) => supprimerVente(id));
  ipcMain.handle('ventes:apercu-numero-facture', () => apercuProchainNumeroFacture());
  ipcMain.handle('ventes:reserver-numero-facture', () => reserverProchainNumeroFacture());
  ipcMain.handle('certificats:liste-oeuvre', (_e, oeuvreId) => listerCertificatsParOeuvre(oeuvreId));
  ipcMain.handle('certificats:liste-vente', (_e, venteId) => listerCertificatsParVente(venteId));
  ipcMain.handle('certificats:get', (_e, id) => obtenirCertificat(id));
  ipcMain.handle('certificats:creer', (_e, data) => creerCertificat(data));
  ipcMain.handle('certificats:modifier', (_e, id, data) => modifierCertificat(id, data));
  ipcMain.handle('certificats:supprimer', (_e, id) => supprimerCertificat(id));
  ipcMain.handle('certificats:apercu-numero', () => apercuProchainNumeroCertificat());
  ipcMain.handle('certificats:reserver-numero', () => reserverProchainNumeroCertificat());
  ipcMain.handle('pdf:certificat-generer', (_e, id) => genererCertificatPdf(id));
  ipcMain.handle('pdf:facture-artiste-generer', (_e, venteId) => genererFactureArtistePdf(venteId));
  ipcMain.handle('pdf:ouvrir', async (_e, cheminPdf) => {
    const erreur = await shell.openPath(cheminPdf);
    if (erreur) throw new Error(erreur);
    return { ok: true };
  });
  createWindow();
  demarrerSauvegardePeriodique();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  arreterSauvegardePeriodique();
  try {
    sauvegarder();
  } catch (e) {
    console.error('Sauvegarde à la fermeture échouée :', e);
  }
  closeDatabase();
});
