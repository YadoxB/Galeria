// Convertit les visuels de l'installateur (designs Galeria fournis par Dave) en
// BMP 24 bits aux dimensions exactes attendues par NSIS. electron-builder les
// détecte automatiquement :
//   build/installerHeader.bmp   150 x 57   (bandeau d'en-tête des pages)
//   build/installerSidebar.bmp  164 x 314  (grande image Accueil / Terminé)
// Sources PNG dans gabarits/actifs/ (remplace le « graphisme bleu » par défaut).
// Si une source n'est pas exactement à la bonne taille, elle est réduite par
// moyenne de zone. La transparence éventuelle est aplatie sur blanc.

const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const SOURCES = [
  ['gabarits/actifs/installer-galeria-bandeau.png', 'build/installerHeader.bmp', 150, 57],
  ['gabarits/actifs/installer-galeria-grande.png', 'build/installerSidebar.bmp', 164, 314],
];

// Réduction par moyenne de zone vers (tw, th). Retourne un buffer RGBA.
function downscale(src, tw, th) {
  const data = Buffer.alloc(tw * th * 4);
  const sx = src.width / tw, sy = src.height / th;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.min(src.width, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.min(src.height, Math.ceil((y + 1) * sy));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * src.width + xx) * 4;
        r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; a += src.data[i + 3]; n++;
      }
      const o = (y * tw + x) * 4;
      data[o] = r / n; data[o + 1] = g / n; data[o + 2] = b / n; data[o + 3] = a / n;
    }
  }
  return { width: tw, height: th, data };
}

// Écrit un BMP 24 bits (BGR, lignes de bas en haut, padding 4 octets), en
// aplatissant l'alpha sur blanc.
function ecrireBMP24(fichier, img) {
  const { width: w, height: h, data } = img;
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const dataSize = rowSize * h;
  const buf = Buffer.alloc(54 + dataSize);
  buf.write('BM', 0);
  buf.writeUInt32LE(54 + dataSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);
  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y;
    let off = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (srcY * w + x) * 4;
      const a = data[i + 3] / 255;
      buf[off++] = Math.round(data[i + 2] * a + 255 * (1 - a)); // B
      buf[off++] = Math.round(data[i + 1] * a + 255 * (1 - a)); // G
      buf[off++] = Math.round(data[i] * a + 255 * (1 - a));     // R
    }
  }
  fs.writeFileSync(fichier, buf);
}

for (const [src, dst, w, h] of SOURCES) {
  const srcPath = path.join(ROOT, src);
  if (!fs.existsSync(srcPath)) { console.error(`Source manquante : ${src}`); process.exit(1); }
  let img = PNG.sync.read(fs.readFileSync(srcPath));
  if (img.width !== w || img.height !== h) {
    console.log(`  redimensionnement ${img.width}x${img.height} → ${w}x${h}`);
    img = downscale(img, w, h);
  }
  ecrireBMP24(path.join(ROOT, dst), img);
  console.log(`${path.basename(dst)} ← ${path.basename(src)} (${w}x${h})`);
}
