// Remplace les polices base64 embarquées dans gabarit-certificat.html par
// des références aux fichiers externes dans actifs/. Acrobat crashe à la
// fermeture quand les polices sont embarquées en data URL et ré-embarquées
// par printToPDF — connu sur Chromium.

const fs = require('node:fs');
const path = require('node:path');

const FICHIER = path.join(__dirname, '..', 'gabarits', 'gabarit-certificat.html');

// Map (weight, style) -> nom du fichier
const VARIANTES = [
  { weight: '400', style: 'normal',  fichier: 'garamond-regular.woff2' },
  { weight: '600', style: 'normal',  fichier: 'garamond-semibold.woff2' },
  { weight: '400', style: 'italic',  fichier: 'garamond-italic.woff2' },
];

let html = fs.readFileSync(FICHIER, 'utf-8');

let remplaces = 0;
for (const v of VARIANTES) {
  // Regex pour matcher : @font-face{font-family:'G';font-weight:WEIGHT;font-style:STYLE;src:url(data:font/woff2;base64,...);...}
  const re = new RegExp(
    `(@font-face\\{font-family:'G';font-weight:${v.weight};font-style:${v.style};src:url\\()data:font/woff2;base64,[^)]+(\\)[^}]*\\})`
  );
  const avant = html;
  html = html.replace(re, `$1actifs/${v.fichier}$2`);
  if (html !== avant) {
    remplaces++;
    console.log(`Remplacé : ${v.fichier}`);
  } else {
    console.log(`Non trouvé : ${v.fichier} (regex weight=${v.weight} style=${v.style})`);
  }
}

if (remplaces === 0) {
  console.error('Aucun remplacement effectué — vérifier le format des @font-face dans le fichier.');
  process.exit(1);
}

fs.writeFileSync(FICHIER, html, 'utf-8');
const tailleApres = (fs.statSync(FICHIER).size / 1024).toFixed(1);
console.log(`${remplaces} polices externalisées. Taille du fichier : ${tailleApres} Ko.`);
