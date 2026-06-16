const fs = require('node:fs');
const path = require('node:path');
const pngToIco = require('png-to-ico');

const SRC = path.join(__dirname, '..', 'gabarits', 'actifs', 'icon-galeria.png');
const DEST_DIR = path.join(__dirname, '..', 'build');
const DEST = path.join(DEST_DIR, 'icon.ico');

(async () => {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  const buf = await pngToIco([SRC]);
  fs.writeFileSync(DEST, buf);
  console.log(`Icône Windows générée : ${DEST}`);
})().catch((e) => {
  console.error('Erreur lors de la génération de l\'icône :', e);
  process.exit(1);
});
