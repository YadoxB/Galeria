// Génère les images BMP de l'installateur NSIS aux couleurs de la galerie, à
// partir du logo (gabarits/actifs/logo-gvsj.png). electron-builder les utilise
// automatiquement si présentes :
//   build/installerHeader.bmp   150 x 57   (bandeau d'en-tête des pages)
//   build/installerSidebar.bmp  164 x 314  (grande image Accueil / Terminé)
// Remplace le « graphisme bleu » par défaut de NSIS. Tu peux remplacer ces deux
// BMP par tes propres designs (mêmes dimensions, BMP 24 bits) si tu préfères.

const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'gabarits', 'actifs', 'logo-gvsj.png');
const OUT_HEADER = path.join(ROOT, 'build', 'installerHeader.bmp');
const OUT_SIDEBAR = path.join(ROOT, 'build', 'installerSidebar.bmp');

const IVORY = [252, 250, 244]; // Soft Ivory (#FCFAF4) — fond de l'app
const WHITE = [255, 255, 255];

const logo = PNG.sync.read(fs.readFileSync(LOGO)); // RGBA

// Redimensionnement par moyenne de zone (qualité correcte en réduction).
function downscale(src, tw, th) {
  const out = { width: tw, height: th, data: Buffer.alloc(tw * th * 4) };
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
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = a / n;
    }
  }
  return out;
}

// Crée un canvas RGB rempli du fond, avec le logo alpha-composité à (ox, oy).
function composer(w, h, bg, logoImg, ox, oy) {
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { rgb[i * 3] = bg[0]; rgb[i * 3 + 1] = bg[1]; rgb[i * 3 + 2] = bg[2]; }
  for (let y = 0; y < logoImg.height; y++) {
    for (let x = 0; x < logoImg.width; x++) {
      const cx = ox + x, cy = oy + y;
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const li = (y * logoImg.width + x) * 4;
      const a = logoImg.data[li + 3] / 255;
      if (a <= 0) continue;
      const o = (cy * w + cx) * 3;
      rgb[o] = Math.round(logoImg.data[li] * a + rgb[o] * (1 - a));
      rgb[o + 1] = Math.round(logoImg.data[li + 1] * a + rgb[o + 1] * (1 - a));
      rgb[o + 2] = Math.round(logoImg.data[li + 2] * a + rgb[o + 2] * (1 - a));
    }
  }
  return rgb;
}

// Écrit un BMP 24 bits (BGR, lignes de bas en haut, padding 4 octets).
function ecrireBMP24(fichier, rgb, w, h) {
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
    const srcY = h - 1 - y; // bas en haut
    let off = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const o = (srcY * w + x) * 3;
      buf[off++] = rgb[o + 2]; // B
      buf[off++] = rgb[o + 1]; // G
      buf[off++] = rgb[o];     // R
    }
  }
  fs.writeFileSync(fichier, buf);
}

// --- Bandeau d'en-tête 150x57 : petit logo à gauche, fond blanc.
{
  const w = 150, h = 57, marge = 6;
  const taille = h - marge * 2; // ~45
  const l = downscale(logo, taille, taille);
  const rgb = composer(w, h, WHITE, l, marge, marge);
  ecrireBMP24(OUT_HEADER, rgb, w, h);
  console.log(`En-tête : ${OUT_HEADER} (${w}x${h})`);
}

// --- Grande image latérale 164x314 : logo centré, fond Soft Ivory.
{
  const w = 164, h = 314;
  const taille = 120;
  const l = downscale(logo, taille, taille);
  const ox = Math.round((w - taille) / 2);
  const oy = Math.round(h * 0.30 - taille / 2); // un peu au-dessus du centre
  const rgb = composer(w, h, IVORY, l, ox, oy);
  ecrireBMP24(OUT_SIDEBAR, rgb, w, h);
  console.log(`Latérale : ${OUT_SIDEBAR} (${w}x${h})`);
}
