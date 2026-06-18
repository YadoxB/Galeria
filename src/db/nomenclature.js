// Génération du nom de fichier normalisé d'une œuvre selon la nomenclature de
// la galerie. Réutilisé par le message du garde-fou Sage (pour indiquer le nom
// exact à utiliser) et, plus tard, par le renommage physique des photos
// (Jalon 5).
//
// Forme : (code)-(titre slug)-(formatL)(HxLxP)-(médiumL)(supportL)-(signatureL)(année)
// Exemple : CLD1992-Entre-le-vent-et-la-mer-M30x30x0.75-AT-BD2023
//
// Règle des codes-lettres : première lettre de CHAQUE mot, sans accent, en
// majuscule. « Très grand » → TG, « Bas Droite » → BD, « Acrylique » → A.

function sansAccents(s) {
  return (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Première lettre de chaque mot, en majuscules, sans accent.
function lettresCode(valeur) {
  return sansAccents(valeur)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((mot) => mot[0].toUpperCase())
    .join('');
}

// Titre → slug : sans accents, tout ce qui n'est pas alphanumérique devient un
// tiret, pas de tiret en début/fin.
function slugTitre(titre) {
  const s = sansAccents(titre)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'sans-titre';
}

// Formate un nombre de dimension : entier tel quel, décimal avec le 0 devant
// (0.75) et sans zéros inutiles. Retourne null si absent/invalide.
function formaterNombreDim(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  // Arrondi à 3 décimales pour éviter les artefacts de flottant, puis toString
  // (qui donne « 0.75 » et non « .75 », et « 30 » pour un entier).
  return (Math.round(v * 1000) / 1000).toString();
}

// Dimensions H × L × P. Profondeur omise si absente. Si H ou L manque, on met
// 0 à sa place pour garder la structure ; si les deux manquent, chaîne vide.
function formaterDimensions(h, l, p) {
  const H = formaterNombreDim(h);
  const L = formaterNombreDim(l);
  const P = formaterNombreDim(p);
  if (!H && !L) return '';
  const base = `${H || '0'}x${L || '0'}`;
  return P ? `${base}x${P}` : base;
}

// Construit le nom de fichier (sans extension) à partir d'un objet œuvre qui
// expose : numero_inventaire, titre, format, hauteur, largeur, profondeur,
// medium, support, emplacement_signature, annee.
function construireNomFichier(o) {
  if (!o) return '';
  const code = (o.numero_inventaire || '').toString().trim();
  const slug = slugTitre(o.titre);
  const segFormat = `${lettresCode(o.format)}${formaterDimensions(o.hauteur, o.largeur, o.profondeur)}`;
  const segMatiere = `${lettresCode(o.medium)}${lettresCode(o.support)}`;
  const segSignature = `${lettresCode(o.emplacement_signature)}${(o.annee != null && o.annee !== '') ? String(o.annee) : ''}`;

  return [code, slug, segFormat, segMatiere, segSignature]
    .filter((s) => s !== '')
    .join('-');
}

module.exports = {
  construireNomFichier,
  lettresCode,
  slugTitre,
  formaterDimensions,
};
