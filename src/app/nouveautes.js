// « Quoi de neuf » — petite fenêtre de nouveautés montrée UNE fois après une mise
// à jour, aux utilisateurs qui reviennent (pas au tout premier lancement, où le
// tutoriel de bienvenue couvre déjà tout). Mémorisé par `config.nouveautes_vue_id`.
//
// Pour une future mise à jour : changer NOUVEAUTES_ID et remplacer les diapos.

const NOUVEAUTES_ID = 'sync-web-2026-08';

const DIAPOS = [
  {
    titre: 'Quoi de neuf',
    texte: "Voici les principales nouveautés ajoutées depuis la version 0.11.0. Vous pourrez tout revoir tranquillement plus tard.",
    intro: true,
  },
  {
    titre: 'Clic droit : couper, copier, coller',
    texte: "Vous pouvez maintenant faire un <b>clic droit</b> dans n'importe quelle case de texte pour <b>Coller</b> (ou Couper, Copier). Pratique quand la souris est plus rapide que le clavier.",
  },
  {
    titre: "Numéro d'inventaire sur les cartes",
    texte: "Dans la page <b>Œuvres</b> (affichage en grille), le <b>numéro d'inventaire</b> apparaît maintenant sous le nom de l'artiste.",
  },
  {
    titre: 'Annexe A de retrait',
    texte: "Quand vous produisez une <b>Annexe A de retrait</b> pour un artiste, l'application vous propose ensuite de <b>retirer ces œuvres du catalogue</b> (elles sont rendues à l'artiste). Elle demande toujours confirmation.",
  },
  {
    titre: 'Synchronisation avec le site web',
    texte: "La grande nouveauté : dans <b>Réglages → Site web</b>, Galeria peut <b>comparer vos fiches</b> (œuvres <i>et</i> artistes) avec votre site et vous proposer d'en <b>reprendre les valeurs à jour</b> — en <b>lecture seule</b>, rien n'est modifié sur le site. Vous pouvez aussi créer les fiches manquantes et séparer les citations des biographies.",
  },
  {
    titre: 'Comparer depuis une fiche',
    texte: "Pas besoin de tout comparer d'un coup : sur <b>chaque fiche</b> d'œuvre ou d'artiste, le bouton <b>« Comparer avec le site »</b> vérifie <b>cet élément seul</b> et vous laisse reprendre ce qui a changé, en un clic.",
  },
  {
    titre: 'C\'est tout !',
    texte: "Bonne exploration. En cas de doute, le bouton <b>?</b> en bas à droite répond à presque tout.",
    fin: true,
  },
];

let racine = null;
let idx = 0;

function pointsHtml(i) {
  return `<div class="tuto-points">${DIAPOS.map((_, k) => `<span class="tuto-point ${k === i ? 'actif' : ''}"></span>`).join('')}</div>`;
}

function montrer(i) {
  idx = Math.max(0, Math.min(i, DIAPOS.length - 1));
  const d = DIAPOS[idx];
  const carte = racine.querySelector('.nouv-carte');
  const dernier = idx === DIAPOS.length - 1;
  carte.innerHTML = `
    <div class="nouv-badge">Nouveautés</div>
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

export function lancerNouveautes() {
  if (racine) return;
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
    if (!cfg || cfg.nouveautes_vue_id === NOUVEAUTES_ID) return; // déjà vu
    await window.api.configSauver({ nouveautes_vue_id: NOUVEAUTES_ID }); // ne plus rouvrir
    if (premierLancement) return; // tout est nouveau : le tutoriel de bienvenue suffit
    lancerNouveautes();
  } catch { /* silencieux */ }
}
