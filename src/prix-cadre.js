// Supplément d'encadrement : les 2 $ par unité que la galerie ajoute à la cote
// de l'artiste pour afficher le prix COURANT, encadré (voir prix_courant dans
// src/app/calcul-prix.js).
//
// L'encadrement est le travail de la galerie, pas celui de l'artiste : sa
// facture se fait au tarif PRÉFÉRENTIEL (décision de Dave, 2026-09-28). Ce
// module dit combien retirer ; la facture (src/pdf.js) le retire sans
// l'écrire sur le document — l'artiste voit directement le bon montant, pas
// une soustraction à expliquer.
//
// ⚠ COPIE MIROIR (partielle) de `src/app/calcul-prix.js` (interface, ESM) :
// même recherche de cote applicable et même base (H + L, ou H × L). Le
// processus principal (CommonJS) et l'interface ne partagent pas de module ;
// toute modification de la formule doit être reportée dans les DEUX fichiers.

const SUPPLEMENT_CADRE_PAR_UNITE = 2;

const norm = (s) => String(s || '').normalize('NFD').replace(/\p{Mn}/gu, '').trim().toLowerCase();
const eq = (a, b) => norm(a) === norm(b);

function parserCotes(brut) {
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

// Du plus précis au plus général, comme le calculateur de prix de l'interface.
function coteApplicable(cotesBrut, { medium, taille } = {}) {
  const cotes = parserCotes(cotesBrut);
  if (!cotes.length) return null;
  const m = (medium || '').trim();
  const t = (taille || '').trim();
  const ordres = [
    (c) => m && eq(c.medium, m) && t && eq(c.taille, t),
    (c) => eq(c.medium, 'Tous') && t && eq(c.taille, t),
    (c) => m && eq(c.medium, m) && eq(c.taille, 'Tous'),
    (c) => eq(c.medium, 'Tous') && eq(c.taille, 'Tous'),
  ];
  for (const test of ordres) {
    const trouve = cotes.find(test);
    if (trouve) return trouve;
  }
  return null;
}

// Sculptures et reproductions : la galerie ne les encadre pas, leur prix ne
// porte pas le supplément (choix de Dave, 2026-09-28).
function estEncadrable(typeOeuvre) {
  const t = String(typeOeuvre || '').toLowerCase();
  return !t.includes('sculpt') && !/reprod|gicl/.test(t);
}

// 0 dès qu'on ne peut rien affirmer : type non encadrable, dimensions
// absentes, artiste sans cote. Mieux vaut la facture d'avant qu'une déduction
// inventée.
function supplementEncadrement(oeuvre, artiste) {
  if (!oeuvre || !artiste || !estEncadrable(oeuvre.type)) return 0;
  const h = Number(oeuvre.hauteur) || 0;
  const l = Number(oeuvre.largeur) || 0;
  if (h <= 0 || l <= 0) return 0;
  const cote = coteApplicable(artiste.cotes, { medium: oeuvre.medium, taille: oeuvre.format });
  if (!cote) return 0;
  const base = cote.unite === 'carre' ? h * l : h + l;
  return Math.round(SUPPLEMENT_CADRE_PAR_UNITE * base);
}

// Le montant sur lequel l'artiste est payé. Un supplément qui atteindrait le
// prix lui-même signale un prix bâti autrement (saisi à la main, cote changée
// depuis) : on ne déduit alors rien plutôt que de produire une facture absurde.
function prixRegulierPreferentiel(prixRegulierPaye, oeuvre, artiste) {
  const paye = Number(prixRegulierPaye) || 0;
  const cadre = supplementEncadrement(oeuvre, artiste);
  return cadre > 0 && cadre < paye ? paye - cadre : paye;
}

module.exports = {
  SUPPLEMENT_CADRE_PAR_UNITE,
  coteApplicable,
  estEncadrable,
  supplementEncadrement,
  prixRegulierPreferentiel,
};
