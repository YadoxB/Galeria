// Module de calcul des prix suggérés à partir des cotes d'un artiste et des
// dimensions d'une œuvre. Utilisé par la fiche d'œuvre (affichage du prix
// suggéré + bouton « Utiliser ») et par le calculateur autonome (Outils).
//
// Modèle :
//   artiste.cotes (JSON, peut être null) = [
//     { medium, taille, unite, prix_pref }, …
//   ]
//   - medium : 'Tous' ou un médium spécifique (ex. 'Acrylique')
//   - taille : 'Tous' ou 'Petit' / 'Moyen' / 'Grand' / 'Très grand'
//   - unite  : 'lineaire' (H + L) ou 'carre' (H × L)
//   - prix_pref : tarif préférentiel par unité, en $/po (linéaire) ou $/po²
//
// Formule :
//   base              = (unite === 'carre' ? H × L : H + L)
//   prix_preferentiel = prix_pref × base
//   prix_courant      = (prix_pref + 2) × base
//                       Le supplément de 2 $ s'ajoute à la cote (par unité),
//                       pas au prix final. Sur une cote en $/po linéaire avec
//                       H+L = 70, ça revient au même qu'un supplément de
//                       2 × (H+L) ; sur une cote en $/po², c'est différent.
//
// Si plusieurs cotes matchent, on prend la plus spécifique :
//   1. medium === oeuvre.medium ET taille === oeuvre.taille
//   2. medium === 'Tous'        ET taille === oeuvre.taille
//   3. medium === oeuvre.medium ET taille === 'Tous'
//   4. medium === 'Tous'        ET taille === 'Tous'

export function parserCotes(brut) {
  if (!brut) return [];
  let arr;
  try {
    arr = typeof brut === 'string' ? JSON.parse(brut) : brut;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((c) => ({
      medium: (c?.medium || 'Tous').trim() || 'Tous',
      taille: (c?.taille || 'Tous').trim() || 'Tous',
      unite: c?.unite === 'carre' ? 'carre' : 'lineaire',
      prix_pref: Number(c?.prix_pref) || 0,
    }))
    .filter((c) => c.prix_pref > 0);
}

// Comparaison normalisée (insensible à la casse, aux accents et aux espaces
// autour). Le matching « Tous » reste exact (la chaîne « Tous » n'est pas
// confondue avec un médium ou une taille saisis par l'utilisateur).
function normMatch(s) {
  return (s || '').toString().normalize('NFD').replace(/\p{Mn}/gu, '').trim().toLowerCase();
}
function eq(a, b) {
  return normMatch(a) === normMatch(b);
}

export function trouverCoteApplicable(cotes, { medium, taille } = {}) {
  if (!Array.isArray(cotes) || cotes.length === 0) return null;
  const mediumNorm = (medium || '').trim();
  const tailleNorm = (taille || '').trim();

  // Priorités : exact medium + exact taille > 'Tous' + exact taille >
  //             exact medium + 'Tous' taille > 'Tous' + 'Tous'.
  const ordres = [
    (c) => mediumNorm && eq(c.medium, mediumNorm) && tailleNorm && eq(c.taille, tailleNorm),
    (c) => eq(c.medium, 'Tous') && tailleNorm && eq(c.taille, tailleNorm),
    (c) => mediumNorm && eq(c.medium, mediumNorm) && eq(c.taille, 'Tous'),
    (c) => eq(c.medium, 'Tous') && eq(c.taille, 'Tous'),
  ];
  for (const test of ordres) {
    const trouve = cotes.find(test);
    if (trouve) return trouve;
  }
  return null;
}

export function calculerPrixSuggere({ artiste, oeuvre } = {}) {
  if (!artiste || !oeuvre) return null;

  const h = Number(oeuvre.hauteur) || 0;
  const l = Number(oeuvre.largeur) || 0;
  if (h <= 0 || l <= 0) return null;

  const cotes = parserCotes(artiste.cotes);
  if (!cotes.length) return null;

  const cote = trouverCoteApplicable(cotes, {
    medium: oeuvre.medium,
    taille: oeuvre.format,
  });
  if (!cote) return null;

  const base = cote.unite === 'carre' ? h * l : h + l;
  const prix_preferentiel = cote.prix_pref * base;
  const cote_courante = cote.prix_pref + 2;
  const prix_courant = cote_courante * base;

  const uniteLib = cote.unite === 'carre' ? 'po²' : 'po lin';
  const baseLib = cote.unite === 'carre' ? `${h} × ${l} = ${base.toFixed(1)} ${uniteLib}` : `${h} + ${l} = ${base.toFixed(1)} ${uniteLib}`;

  return {
    cote,
    cote_courante,
    prix_preferentiel: arrondiPrix(prix_preferentiel),
    prix_courant: arrondiPrix(prix_courant),
    base,
    formule_preferentiel: `${cote.prix_pref} $/${uniteLib} × ${baseLib} = ${formaterMontant(prix_preferentiel)}`,
    formule_courant: `${cote_courante} $/${uniteLib} (cote courante = préf + 2 $) × ${baseLib} = ${formaterMontant(prix_courant)}`,
  };
}

function arrondiPrix(n) {
  return Math.round(Number(n) || 0);
}

export function formaterMontant(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

// Helpers pour l'UI éditeur de cotes : générer une grille par défaut.
export const TAILLES_COTES = ['Petit', 'Moyen', 'Grand', 'Très grand'];

export function cotesParDefaut() {
  // Mode simplifié : une seule cote « Tous médiums + Toutes tailles ».
  return [{ medium: 'Tous', taille: 'Tous', unite: 'lineaire', prix_pref: 0 }];
}
