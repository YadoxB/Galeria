const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PNG } = require('pngjs');
const pngToIco = require('png-to-ico');

const SRC = path.join(__dirname, '..', 'gabarits', 'actifs', 'icon-galeria.png');
const DEST_DIR = path.join(__dirname, '..', 'build');
const DEST = path.join(DEST_DIR, 'icon.ico');
const TAILLES = [16, 32, 48, 64, 128, 256];

function lirePng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

// Redimensionnement bilinéaire RGBA. Pour les icônes c'est suffisant et propre.
function redimensionner(src, larg, haut) {
  const dst = new PNG({ width: larg, height: haut });
  const echX = src.width / larg;
  const echY = src.height / haut;
  for (let y = 0; y < haut; y++) {
    for (let x = 0; x < larg; x++) {
      const sx = x * echX;
      const sy = y * echY;
      const x0 = Math.floor(sx), x1 = Math.min(x0 + 1, src.width - 1);
      const y0 = Math.floor(sy), y1 = Math.min(y0 + 1, src.height - 1);
      const fx = sx - x0, fy = sy - y0;
      for (let c = 0; c < 4; c++) {
        const v00 = src.data[((y0 * src.width) + x0) * 4 + c];
        const v01 = src.data[((y0 * src.width) + x1) * 4 + c];
        const v10 = src.data[((y1 * src.width) + x0) * 4 + c];
        const v11 = src.data[((y1 * src.width) + x1) * 4 + c];
        const top = v00 * (1 - fx) + v01 * fx;
        const bot = v10 * (1 - fx) + v11 * fx;
        dst.data[((y * larg) + x) * 4 + c] = Math.round(top * (1 - fy) + bot * fy);
      }
    }
  }
  return dst;
}

(async () => {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  const src = lirePng(SRC);
  console.log(`Source : ${src.width}x${src.height}`);

  const dossierTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'galeria-icon-'));
  const cheminsPng = [];
  try {
    for (const taille of TAILLES) {
      const cible = taille === src.width ? src : redimensionner(src, taille, taille);
      const buf = PNG.sync.write(cible);
      const chemin = path.join(dossierTmp, `${taille}.png`);
      fs.writeFileSync(chemin, buf);
      cheminsPng.push(chemin);
      console.log(`  ${taille}x${taille}  ->  ${buf.length} octets`);
    }
    const icoBuf = await pngToIco(cheminsPng);
    fs.writeFileSync(DEST, icoBuf);
    console.log(`Icône Windows générée : ${DEST} (${icoBuf.length} octets)`);
  } finally {
    for (const p of cheminsPng) {
      try { fs.unlinkSync(p); } catch {}
    }
    try { fs.rmdirSync(dossierTmp); } catch {}
  }
})().catch((e) => {
  console.error('Erreur lors de la génération de l\'icône :', e);
  process.exit(1);
});
