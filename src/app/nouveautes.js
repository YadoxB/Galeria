// « Quoi de neuf » — fenêtre de nouveautés montrée UNE fois après une mise à
// jour, aux utilisateurs qui reviennent (pas au tout premier lancement, où le
// tutoriel de bienvenue couvre déjà tout).
//
// Une mise à jour peut en sauter plusieurs : si les parents passent de la
// 0.13.0 à la 0.15.0 sans être passés par la 0.14.0, ils voient les nouveautés
// des DEUX versions, à la suite. C'est pourquoi les diapos sont rangées PAR
// VERSION plutôt qu'en une liste unique.
//
// ⚠ OBLIGATOIRE À CHAQUE VERSION (règle de la galerie, 2026-08-27) :
//    ajouter une entrée EN TÊTE de VERSIONS, avec le numéro de la version
//    publiée et ses diapos. Ne pas supprimer les entrées précédentes : elles
//    servent à ceux qui ont sauté une mise à jour.
//    `npm run release` REFUSE de publier si la version en tête de VERSIONS ne
//    correspond pas à celle de package.json (voir scripts/release.js).

// La plus récente EN PREMIER.
export const VERSIONS = [
  {
    version: '0.15.0',
    diapos: [
      {
        titre: 'Préparer une exposition',
        texte: "La grande nouveauté : une section <b>Expositions</b> dans le menu de gauche. Vous créez une exposition, vous <b>cochez les œuvres qui partent</b>, et Galeria s'occupe du reste.",
      },
      {
        titre: 'Les œuvres reviennent comme elles étaient',
        texte: "Les œuvres parties passent au statut <b>En exposition</b>. À la fin, un seul clic sur <b>« Mettre fin à l'exposition »</b> les ramène toutes — chacune retrouve exactement le statut qu'elle avait avant. Une œuvre <b>vendue</b> pendant l'exposition reste vendue.",
      },
      {
        titre: 'Imprimer les cartels',
        texte: "Galeria produit vos <b>cartels</b> en PDF, dix par page, prêts à découper : artiste, titre, médium, dimensions, numéro d'inventaire et un <b>code QR</b> qui mène à la fiche de l'œuvre sur votre site. Une case permet <b>d'afficher ou non le prix</b>.",
      },
      {
        titre: 'Certificats en anglais',
        texte: "La fenêtre de création d'un certificat propose maintenant sa <b>langue</b> : français ou anglais. Tout le document suit — les libellés, la date et le texte d'attestation. La langue est conservée, donc régénérer le certificat plus tard le refait à l'identique.",
      },
      {
        titre: 'Les adresses de votre site',
        texte: "Pour que les codes QR fonctionnent, un bouton <b>« Récupérer les adresses du site »</b> relie chaque œuvre à sa fiche en ligne, d'un seul coup. Il ne demande aucune configuration, et le bouton <b>« Voir sur le site »</b> de vos fiches se met à fonctionner du même coup.",
      },
    ],
  },
  {
    version: '0.14.0',
    diapos: [
      {
        titre: "Le nombre d'œuvres était faux",
        texte: "Le nombre affiché sur la carte d'un artiste comptait aussi les œuvres <b>retirées</b> et <b>vendues</b>. C'est corrigé : c'est désormais le nombre d'<b>œuvres disponibles</b>. Sa fiche indique aussi combien ont été retirées.",
      },
      {
        titre: 'Écrire ce que vous voulez dans les menus',
        texte: "Les champs <b>Style</b>, <b>Type</b> et <b>Support</b> d'une œuvre, et le <b>Type</b> d'un artiste, acceptent maintenant n'importe quelle valeur. Ce que vous tapez revient dans les suggestions la fois suivante.",
      },
      {
        titre: 'Une cote « Hors normes »',
        texte: "Pour une œuvre exceptionnelle, vous pouvez fixer un <b>tarif d'exception</b> : ajoutez une cote de taille <b>Hors normes</b> sur la fiche de l'artiste, puis choisissez <b>Hors normes</b> dans le champ <i>Format</i> de l'œuvre concernée.",
      },
      {
        titre: 'Les C.V. collés depuis le site',
        texte: "Quand vous colliez un C.V. à la main, certaines lignes ressortaient en rouge comme des titres de section. C'est réglé, et les points d'une même année s'alignent maintenant sous elle.",
      },
    ],
  },
];

// Repère enregistré dans la configuration une fois les nouveautés vues.
const VERSION_COURANTE = VERSIONS.length ? VERSIONS[0].version : '0.0.0';

// Comparaison « x.y.z » → -1, 0, 1. Tout ce qui n'a pas cette forme (dont les
// anciens repères comme « sync-web-2026-08 ») est traité comme « rien vu » :
// c'est le bon comportement, on montre alors toutes les nouveautés connues.
function comparerVersions(a, b) {
  const decouper = (v) => String(v == null ? '' : v).split('.').map((n) => parseInt(n, 10));
  const A = decouper(a), B = decouper(b);
  const okA = A.length === 3 && A.every((n) => Number.isFinite(n));
  const okB = B.length === 3 && B.every((n) => Number.isFinite(n));
  if (!okA && !okB) return 0;
  if (!okA) return -1;
  if (!okB) return 1;
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1;
  }
  return 0;
}

// Diapos à montrer à quelqu'un qui en était resté à la version `vue` : toutes
// les versions strictement plus récentes, de la plus ancienne à la plus
// récente — on raconte les choses dans l'ordre où elles sont arrivées.
export function construireDiapos(vue) {
  const aMontrer = VERSIONS
    .filter((v) => comparerVersions(vue, v.version) < 0)
    .sort((x, y) => comparerVersions(x.version, y.version));
  if (!aMontrer.length) return [];

  const plusieurs = aMontrer.length > 1;
  const premiere = aMontrer[0].version;
  const derniere = aMontrer[aMontrer.length - 1].version;
  const diapos = [{
    titre: 'Quoi de neuf',
    texte: plusieurs
      ? `Plusieurs mises à jour se sont accumulées : voici les nouveautés des versions <b>${premiere}</b> à <b>${derniere}</b>, dans l'ordre. Vous pourrez tout revoir tranquillement plus tard.`
      : `Voici les principales nouveautés de la version <b>${premiere}</b>. Vous pourrez tout revoir tranquillement plus tard.`,
    intro: true,
  }];
  for (const v of aMontrer) {
    for (const d of v.diapos) {
      // Le numéro de version n'apparaît que s'il y en a plusieurs : sinon
      // c'est du bruit.
      diapos.push(plusieurs ? { ...d, version: v.version } : { ...d });
    }
  }
  diapos.push({
    titre: "C'est tout !",
    texte: "Bonne exploration. En cas de doute, le bouton <b>?</b> en bas à droite répond à presque tout.",
    fin: true,
  });
  return diapos;
}

let racine = null;
let idx = 0;
let DIAPOS = [];

function pointsHtml(i) {
  return `<div class="tuto-points">${DIAPOS.map((_, k) => `<span class="tuto-point ${k === i ? 'actif' : ''}"></span>`).join('')}</div>`;
}

function montrer(i) {
  idx = Math.max(0, Math.min(i, DIAPOS.length - 1));
  const d = DIAPOS[idx];
  const carte = racine.querySelector('.nouv-carte');
  const dernier = idx === DIAPOS.length - 1;
  carte.innerHTML = `
    <div class="nouv-badge">Nouveautés${d.version ? ` &middot; ${d.version}` : ''}</div>
    <h2>${d.titre}</h2>
    <p>${d.texte}</p>
    ${pointsHtml(idx)}
    <div class="nouv-actions">
      ${idx > 0 ? '<button type="button" class="tuto-btn sec" data-prec>Précédent</button>' : '<span></span>'}
      <button type="button" class="tuto-btn pri" data-suiv>${dernier ? 'Terminer' : 'Suivant'}</button>
    </div>`;
  carte.querySelector('[data-suiv]').addEventListener('click', () => { if (dernier) fermer(); else montrer(idx + 1); });
  const p = carte.querySelector('[data-prec]'); if (p) p.addEventListener('click', () => montrer(idx - 1));
}

function fermer() {
  if (!racine) return;
  window.removeEventListener('keydown', onKey);
  racine.remove();
  racine = null;
}
function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); fermer(); } }

// `vue` = la version que l'utilisateur avait déjà vue. Sans argument, on
// montre tout (utile pour revoir les nouveautés depuis un bouton).
export function lancerNouveautes(vue = null) {
  if (racine) return;
  DIAPOS = construireDiapos(vue);
  if (!DIAPOS.length) return;
  racine = document.createElement('div');
  racine.className = 'overlay-modale nouv-overlay';
  racine.innerHTML = `
    <div class="tuto-carte nouv-carte" role="dialog" aria-modal="true" aria-label="Nouveautés"></div>
    <button type="button" class="nouv-passer" data-passer>Passer</button>`;
  racine.addEventListener('mousedown', (e) => { if (e.target === racine) fermer(); });
  racine.querySelector('[data-passer]').addEventListener('click', fermer);
  window.addEventListener('keydown', onKey);
  document.body.appendChild(racine);
  montrer(0);
}

// Affiché une fois pour les utilisateurs qui reviennent. `premierLancement` =
// première installation (tutoriel de bienvenue) → on marque « vu » sans afficher.
export async function initialiserNouveautes({ premierLancement } = {}) {
  try {
    const cfg = await window.api.configGet();
    if (!cfg) return;
    const vue = cfg.nouveautes_vue_id;
    if (comparerVersions(vue, VERSION_COURANTE) >= 0) return; // déjà à jour
    // On note la version courante AVANT d'afficher : même fermée d'un
    // « Passer », la fenêtre ne revient pas au prochain démarrage.
    await window.api.configSauver({ nouveautes_vue_id: VERSION_COURANTE });
    if (premierLancement) return; // tout est nouveau : le tutoriel suffit
    lancerNouveautes(vue);
  } catch { /* silencieux */ }
}
