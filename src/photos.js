const fs = require('node:fs');
const path = require('node:path');
const { dialog, BrowserWindow } = require('electron');
const { openDatabase } = require('./db/database');
const { getPhotosDir } = require('./db/paths');

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const DOSSIER_ORIGINAUX = 'originaux';

const TABLES = {
  artistes: {
    colonne: 'photo_path',
    colonneOriginale: 'photo_originale_path',
    singulier: 'artiste',
  },
  oeuvres: {
    colonne: 'image_path',
    colonneOriginale: null,
    singulier: 'oeuvre',
  },
};

function dataUrlVersBuffer(dataUrl) {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl ?? '');
  if (!m) throw new Error('Image invalide');
  return {
    ext: m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase(),
    buf: Buffer.from(m[2], 'base64'),
  };
}

function bufferVersDataUrl(buf, ext) {
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${buf.toString('base64')}`;
}

async function choisirPhoto(senderWebContents, { table, id }) {
  // Conservé pour les œuvres (copie simple sans recadrage)
  const meta = TABLES[table];
  if (!meta) throw new Error('Type invalide');
  if (!Number.isInteger(id)) throw new Error('Identifiant invalide');

  const win = BrowserWindow.fromWebContents(senderWebContents);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choisir une image',
    filters: [{ name: 'Images', extensions: EXTENSIONS }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { cancelled: true };

  const source = filePaths[0];
  const ext = path.extname(source).slice(1).toLowerCase();
  if (!EXTENSIONS.includes(ext)) {
    throw new Error(`Format non supporté : .${ext}. Utilise JPG, PNG, GIF, WebP ou BMP.`);
  }

  const dirCible = path.join(getPhotosDir(), table);
  fs.mkdirSync(dirCible, { recursive: true });
  const nom = `${meta.singulier}-${id}-${Date.now()}.${ext}`;
  const destAbsolu = path.join(dirCible, nom);
  const cheminRelatif = `${table}/${nom}`;

  fs.copyFileSync(source, destAbsolu);

  const db = openDatabase();
  const ancien = db.prepare(`SELECT ${meta.colonne} AS chemin FROM ${table} WHERE id = ?`).get(id);
  if (ancien?.chemin) {
    try { fs.unlinkSync(path.join(getPhotosDir(), ancien.chemin)); } catch {}
  }
  db.prepare(
    `UPDATE ${table} SET ${meta.colonne} = ?, modifie_le = datetime('now') WHERE id = ?`
  ).run(cheminRelatif, id);

  return { path: cheminRelatif };
}

async function lireFichierImage(senderWebContents) {
  const win = BrowserWindow.fromWebContents(senderWebContents);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choisir une image',
    filters: [{ name: 'Images', extensions: EXTENSIONS }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { cancelled: true };

  const source = filePaths[0];
  const ext = path.extname(source).slice(1).toLowerCase();
  if (!EXTENSIONS.includes(ext)) {
    throw new Error(`Format non supporté : .${ext}. Utilise JPG, PNG, GIF, WebP ou BMP.`);
  }
  const buf = fs.readFileSync(source);
  return { dataUrl: bufferVersDataUrl(buf, ext) };
}

function lireOriginale({ table, id }) {
  const meta = TABLES[table];
  if (!meta?.colonneOriginale) throw new Error("Pas d'original conservé pour cette table.");
  if (!Number.isInteger(id)) throw new Error('Identifiant invalide');

  const db = openDatabase();
  const row = db.prepare(
    `SELECT ${meta.colonneOriginale} AS chemin FROM ${table} WHERE id = ?`
  ).get(id);
  if (!row?.chemin) throw new Error("Aucune image originale conservée pour ce membre.");

  const abs = path.join(getPhotosDir(), row.chemin);
  if (!fs.existsSync(abs)) throw new Error('Fichier original introuvable sur le disque.');

  const ext = path.extname(abs).slice(1).toLowerCase();
  const buf = fs.readFileSync(abs);
  return { dataUrl: bufferVersDataUrl(buf, ext) };
}

function enregistrerImageRecadree({ table, id, cropDataUrl, originaleDataUrl }) {
  const meta = TABLES[table];
  if (!meta) throw new Error('Type invalide');
  if (!Number.isInteger(id)) throw new Error('Identifiant invalide');

  const { buf: cropBuf, ext: cropExt } = dataUrlVersBuffer(cropDataUrl);

  const dirCible = path.join(getPhotosDir(), table);
  fs.mkdirSync(dirCible, { recursive: true });
  const ts = Date.now();
  const nomCrop = `${meta.singulier}-${id}-${ts}.${cropExt}`;
  const cheminCropRel = `${table}/${nomCrop}`;
  fs.writeFileSync(path.join(dirCible, nomCrop), cropBuf);

  let cheminOrigRel = null;
  if (originaleDataUrl && meta.colonneOriginale) {
    const { buf: origBuf, ext: origExt } = dataUrlVersBuffer(originaleDataUrl);
    const dirOrig = path.join(getPhotosDir(), table, DOSSIER_ORIGINAUX);
    fs.mkdirSync(dirOrig, { recursive: true });
    const nomOrig = `${meta.singulier}-${id}-${ts}-orig.${origExt}`;
    cheminOrigRel = `${table}/${DOSSIER_ORIGINAUX}/${nomOrig}`;
    fs.writeFileSync(path.join(dirOrig, nomOrig), origBuf);
  }

  const db = openDatabase();
  const selOrig = meta.colonneOriginale ? `, ${meta.colonneOriginale} AS cheminOrig` : '';
  const ancien = db.prepare(
    `SELECT ${meta.colonne} AS chemin${selOrig} FROM ${table} WHERE id = ?`
  ).get(id);
  if (ancien?.chemin) {
    try { fs.unlinkSync(path.join(getPhotosDir(), ancien.chemin)); } catch {}
  }
  if (originaleDataUrl && ancien?.cheminOrig) {
    try { fs.unlinkSync(path.join(getPhotosDir(), ancien.cheminOrig)); } catch {}
  }

  if (originaleDataUrl && meta.colonneOriginale) {
    db.prepare(
      `UPDATE ${table} SET ${meta.colonne} = ?, ${meta.colonneOriginale} = ?, modifie_le = datetime('now') WHERE id = ?`
    ).run(cheminCropRel, cheminOrigRel, id);
  } else {
    db.prepare(
      `UPDATE ${table} SET ${meta.colonne} = ?, modifie_le = datetime('now') WHERE id = ?`
    ).run(cheminCropRel, id);
  }

  return { path: cheminCropRel };
}

function effacerPhoto({ table, id }) {
  const meta = TABLES[table];
  if (!meta) throw new Error('Type invalide');
  if (!Number.isInteger(id)) throw new Error('Identifiant invalide');

  const db = openDatabase();
  const selOrig = meta.colonneOriginale ? `, ${meta.colonneOriginale} AS cheminOrig` : '';
  const ancien = db.prepare(
    `SELECT ${meta.colonne} AS chemin${selOrig} FROM ${table} WHERE id = ?`
  ).get(id);
  if (ancien?.chemin) {
    try { fs.unlinkSync(path.join(getPhotosDir(), ancien.chemin)); } catch {}
  }
  if (ancien?.cheminOrig) {
    try { fs.unlinkSync(path.join(getPhotosDir(), ancien.cheminOrig)); } catch {}
  }
  if (meta.colonneOriginale) {
    db.prepare(
      `UPDATE ${table} SET ${meta.colonne} = NULL, ${meta.colonneOriginale} = NULL, modifie_le = datetime('now') WHERE id = ?`
    ).run(id);
  } else {
    db.prepare(
      `UPDATE ${table} SET ${meta.colonne} = NULL, modifie_le = datetime('now') WHERE id = ?`
    ).run(id);
  }
  return { path: null };
}

function lirePourRecadrage({ table, id }) {
  const meta = TABLES[table];
  if (!meta) throw new Error('Type invalide');
  if (!Number.isInteger(id)) throw new Error('Identifiant invalide');

  const db = openDatabase();

  if (meta.colonneOriginale) {
    const rowOrig = db.prepare(
      `SELECT ${meta.colonneOriginale} AS chemin FROM ${table} WHERE id = ?`
    ).get(id);
    if (rowOrig?.chemin) {
      const abs = path.join(getPhotosDir(), rowOrig.chemin);
      if (fs.existsSync(abs)) {
        const ext = path.extname(abs).slice(1).toLowerCase();
        return {
          dataUrl: bufferVersDataUrl(fs.readFileSync(abs), ext),
          depuisOriginale: true,
        };
      }
    }
  }

  const row = db.prepare(`SELECT ${meta.colonne} AS chemin FROM ${table} WHERE id = ?`).get(id);
  if (row?.chemin) {
    const abs = path.join(getPhotosDir(), row.chemin);
    if (fs.existsSync(abs)) {
      const ext = path.extname(abs).slice(1).toLowerCase();
      return {
        dataUrl: bufferVersDataUrl(fs.readFileSync(abs), ext),
        depuisOriginale: false,
      };
    }
  }
  throw new Error('Aucune photo à recadrer.');
}

module.exports = {
  choisirPhoto,
  effacerPhoto,
  lireFichierImage,
  lireOriginale,
  lirePourRecadrage,
  enregistrerImageRecadree,
};
