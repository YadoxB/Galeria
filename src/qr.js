// Codes QR pour les cartels d'exposition.
//
// `qrcode-generator` : JavaScript pur, aucune dépendance, aucun outil de
// compilation à installer — même contrainte que celle qui avait fait écarter
// better-sqlite3 au profit de node:sqlite.
//
// On produit du SVG (vectoriel) et non une image : le code reste net quelle
// que soit la taille d'impression, ce qui compte pour un code à scanner.
// Tout se fait hors ligne : rien n'est envoyé à un service web.

const qrcode = require('qrcode-generator');

// Correction d'erreur « M » (~15 % de tolérance) : le bon compromis pour un
// cartel qui peut se salir ou se corner un peu.
const NIVEAU_CORRECTION = 'M';

// Renvoie un <svg> prêt à insérer, ou '' si l'adresse est absente ou invalide.
// Une adresse vide n'est PAS une erreur : beaucoup d'œuvres n'ont pas encore
// de fiche sur le site. Le cartel s'imprime alors sans code, plutôt qu'avec un
// code menant nulle part.
function qrSvg(url) {
  const texte = (url == null ? '' : String(url)).trim();
  if (!texte) return '';
  try {
    // Type 0 = version choisie automatiquement selon la longueur du texte.
    const qr = qrcode(0, NIVEAU_CORRECTION);
    qr.addData(texte);
    qr.make();
    // scalable : le SVG porte un viewBox et s'adapte à la taille du cadre CSS.
    return qr.createSvgTag({ cellSize: 1, margin: 0, scalable: true });
  } catch (err) {
    // Adresse trop longue pour un code QR, ou caractère non encodable :
    // on préfère un cartel sans code à une génération qui échoue.
    return '';
  }
}

module.exports = { qrSvg };
