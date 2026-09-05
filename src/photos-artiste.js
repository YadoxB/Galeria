// La section « Photos » de la fiche d'artiste : lister, ajouter, copier,
// exporter. Demande des parents (2026-08-24) : « ajouter une section photos à
// la fiche des artistes dans lequel ces images pourront être ajoutées,
// copiées, téléchargées ».
//
// Rien ici ne SUPPRIME de fichier. Les photos d'œuvres appartiennent aux
// fiches d'œuvres, et le dossier Divers s'ouvre d'un clic dans l'Explorateur :
// c'est là qu'on retire ce qu'on a déposé par erreur. Effacer une photo depuis
// cette liste demanderait une confirmation qu'on n'a pas envie de voir passer
// à côté d'un clic de copie.

const fs = require('node:fs');
const path = require('node:path');
const { dialog, BrowserWindow, clipboard, nativeImage, shell } = require('electron');
const { openDatabase } = require('./db/database');
const { getPhotosDir } = require('./db/paths');
const C = require('./photos-chemins');

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

function artisteOuErreur(id) {
  const a = openDatabase()
    .prepare('SELECT id, prenom, nom, photo_path, photo_originale_path FROM artistes WHERE id = ?')
    .get(Number(id));
  if (!a) throw new Error('Artiste introuvable.');
  return a;
}

function tailleDe(rel) {
  try { return fs.statSync(path.join(getPhotosDir(), rel)).size; } catch { return 0; }
}

// Tout ce qui concerne un artiste, groupé comme sur le disque.
//   - les œuvres, avec leur statut (elles mènent à la fiche de l'œuvre) ;
//   - son portrait ;
//   - le contenu de Divers, lu directement sur le disque puisque ces
//     fichiers-là ne sont dans aucune table.
function listerPhotosArtiste(artisteId) {
  const a = artisteOuErreur(artisteId);
  const db = openDatabase();
  const racine = getPhotosDir();

  const oeuvres = db.prepare(`
    SELECT id, titre, numero_inventaire, statut, archive, image_path
    FROM oeuvres
    WHERE artiste_id = ? AND image_path IS NOT NULL AND TRIM(image_path) <> ''
    ORDER BY numero_inventaire COLLATE NOCASE, titre COLLATE NOCASE
  `).all(a.id);

  const groupes = {};
  for (const d of C.DOSSIERS_STATUT) groupes[d] = [];
  for (const o of oeuvres) {
    const d = C.dossierStatut(o);
    (groupes[d] || (groupes[d] = [])).push({
      type: 'oeuvre',
      oeuvre_id: o.id,
      titre: o.titre || '',
      inventaire: o.numero_inventaire || '',
      chemin: o.image_path,
      octets: tailleDe(o.image_path),
    });
  }

  const portraits = [];
  if (a.photo_path) {
    portraits.push({ type: 'portrait', titre: 'Portrait', chemin: a.photo_path, octets: tailleDe(a.photo_path) });
  }

  // Divers : lu sur le disque. Ces fichiers sont déposés à la main et n'ont
  // aucune trace en base — c'est justement leur raison d'être.
  const divers = [];
  const dossierDivers = C.dossierDivers(a);
  try {
    for (const e of fs.readdirSync(path.join(racine, dossierDivers), { withFileTypes: true })) {
      if (!e.isFile() || e.name.startsWith('.')) continue;
      const ext = path.extname(e.name).slice(1).toLowerCase();
      if (!EXTENSIONS.includes(ext)) continue;
      const rel = `${dossierDivers}/${e.name}`;
      divers.push({ type: 'divers', titre: e.name, chemin: rel, octets: tailleDe(rel) });
    }
  } catch { /* dossier pas encore créé : liste vide */ }
  divers.sort((x, y) => x.titre.localeCompare(y.titre, 'fr'));

  const tout = [...Object.values(groupes).flat(), ...portraits, ...divers];
  return {
    artiste_id: a.id,
    dossier: C.dossierArtiste(a),
    groupes,
    portraits,
    divers,
    total: tout.length,
    octets: tout.reduce((n, p) => n + p.octets, 0),
  };
}

// Ajoute une ou plusieurs images dans le dossier Divers de l'artiste.
async function ajouterPhotosDivers(senderWebContents, artisteId) {
  const a = artisteOuErreur(artisteId);
  const win = BrowserWindow.fromWebContents(senderWebContents);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: `Ajouter des photos — ${C.dossierArtiste(a)}`,
    filters: [{ name: 'Images', extensions: EXTENSIONS }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || !filePaths.length) return { cancelled: true };

  const dossier = C.dossierDivers(a);
  const abs = path.join(getPhotosDir(), dossier);
  fs.mkdirSync(abs, { recursive: true });

  const ajoutes = [];
  const refuses = [];
  for (const source of filePaths) {
    const ext = path.extname(source).slice(1).toLowerCase();
    if (!EXTENSIONS.includes(ext)) { refuses.push(`${path.basename(source)} (format .${ext})`); continue; }
    // On garde le nom d'origine : c'est ce qui permet de s'y retrouver dans
    // l'Explorateur. En cas d'homonyme, on suffixe plutôt que d'écraser.
    let nom = path.basename(source);
    let cible = path.join(abs, nom);
    if (fs.existsSync(cible)) {
      const base = nom.slice(0, -(ext.length + 1));
      let n = 2;
      while (fs.existsSync(path.join(abs, `${base} (${n}).${ext}`)) && n < 100) n++;
      nom = `${base} (${n}).${ext}`;
      cible = path.join(abs, nom);
    }
    try {
      fs.copyFileSync(source, cible);
      ajoutes.push(`${dossier}/${nom}`);
    } catch (e) {
      refuses.push(`${path.basename(source)} (${e.message})`);
    }
  }
  return { ajoutes, refuses };
}

// Copie l'image dans le presse-papier, pour la coller dans un courriel ou un
// document. On passe par nativeImage : coller un CHEMIN de fichier ne servirait
// à rien dans la plupart des applications.
function copierPhoto(cheminRelatif) {
  const abs = path.join(getPhotosDir(), String(cheminRelatif || ''));
  if (!fs.existsSync(abs)) throw new Error('Fichier introuvable.');
  const img = nativeImage.createFromPath(abs);
  if (img.isEmpty()) throw new Error("Cette image n'a pas pu être lue.");
  clipboard.writeImage(img);
  return { copie: true };
}

// « Télécharger » : enregistrer une copie ailleurs. Un seul fichier → boîte
// « Enregistrer sous ». Plusieurs → on demande un dossier de destination.
async function exporterPhotos(senderWebContents, chemins) {
  const liste = (Array.isArray(chemins) ? chemins : [chemins]).filter(Boolean);
  if (!liste.length) return { cancelled: true };
  const win = BrowserWindow.fromWebContents(senderWebContents);
  const racine = getPhotosDir();

  if (liste.length === 1) {
    const abs = path.join(racine, liste[0]);
    if (!fs.existsSync(abs)) throw new Error('Fichier introuvable.');
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Enregistrer la photo',
      defaultPath: path.basename(abs),
      filters: [{ name: 'Images', extensions: EXTENSIONS }],
    });
    if (canceled || !filePath) return { cancelled: true };
    fs.copyFileSync(abs, filePath);
    return { exportes: 1, destination: filePath };
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choisir le dossier de destination',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths.length) return { cancelled: true };
  const dest = filePaths[0];

  let exportes = 0;
  const refuses = [];
  for (const rel of liste) {
    const abs = path.join(racine, rel);
    if (!fs.existsSync(abs)) { refuses.push(path.basename(rel)); continue; }
    let nom = path.basename(abs);
    if (fs.existsSync(path.join(dest, nom))) {
      const ext = path.extname(nom);
      const base = nom.slice(0, -ext.length || undefined);
      let n = 2;
      while (fs.existsSync(path.join(dest, `${base} (${n})${ext}`)) && n < 100) n++;
      nom = `${base} (${n})${ext}`;
    }
    try { fs.copyFileSync(abs, path.join(dest, nom)); exportes++; }
    catch { refuses.push(path.basename(rel)); }
  }
  return { exportes, refuses, destination: dest };
}

// Ouvre le dossier de l'artiste dans l'Explorateur : c'est là que vit leur
// méthode de suivi, et le plus court chemin pour y déposer ou en retirer.
async function ouvrirDossierArtiste(artisteId) {
  const a = artisteOuErreur(artisteId);
  const abs = path.join(getPhotosDir(), C.dossierArtiste(a));
  fs.mkdirSync(abs, { recursive: true });
  const err = await shell.openPath(abs);
  if (err) throw new Error(err);
  return { dossier: abs };
}

module.exports = {
  listerPhotosArtiste,
  ajouterPhotosDivers,
  copierPhoto,
  exporterPhotos,
  ouvrirDossierArtiste,
};
