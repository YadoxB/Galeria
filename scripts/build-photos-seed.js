const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Copie le dossier Photos\ du dossier utilisateur courant vers seed-photos/
// à la racine du projet, pour être embarqué dans l'installateur.

const SRC = path.join(os.homedir(), 'Documents', 'GalerieApp', 'Photos');
const DEST = path.join(__dirname, '..', 'seed-photos');

function tailleEnMo(octets) {
  return (octets / (1024 * 1024)).toFixed(1) + ' Mo';
}

function copierDossier(src, dst) {
  let nbFichiers = 0;
  let tailleTotale = 0;
  fs.mkdirSync(dst, { recursive: true });
  for (const entree of fs.readdirSync(src, { withFileTypes: true })) {
    const cheminSrc = path.join(src, entree.name);
    const cheminDst = path.join(dst, entree.name);
    if (entree.isDirectory()) {
      const stats = copierDossier(cheminSrc, cheminDst);
      nbFichiers += stats.nbFichiers;
      tailleTotale += stats.tailleTotale;
    } else if (entree.isFile()) {
      // Ignorer les marqueurs internes éventuels (commence par un point)
      if (entree.name.startsWith('.')) continue;
      fs.copyFileSync(cheminSrc, cheminDst);
      const st = fs.statSync(cheminDst);
      nbFichiers++;
      tailleTotale += st.size;
    }
  }
  return { nbFichiers, tailleTotale };
}

(() => {
  if (!fs.existsSync(SRC)) {
    console.error(`Dossier Photos introuvable : ${SRC}`);
    console.error('Aucune photo à embarquer. seed-photos/ ne sera pas créé.');
    process.exit(0); // Pas une erreur fatale : on peut builder sans photos.
  }

  // Nettoyer la destination pour partir au propre
  if (fs.existsSync(DEST)) {
    fs.rmSync(DEST, { recursive: true, force: true });
  }

  console.log(`Source : ${SRC}`);
  const { nbFichiers, tailleTotale } = copierDossier(SRC, DEST);
  console.log(`Seed photos copié : ${DEST} (${nbFichiers} fichier${nbFichiers > 1 ? 's' : ''}, ${tailleEnMo(tailleTotale)})`);
})();
