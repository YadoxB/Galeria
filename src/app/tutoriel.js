// Tutoriel de bienvenue (#13) — visite hybride : diapo de bienvenue, puis
// coach-marks qui font défiler les sections réelles (via le routeur), puis
// diapo finale. Ouvert automatiquement au premier lancement (marqueur
// config.tutoriel_vu) ; rejouable depuis la section d'aide.

import { remplacer } from './router.js';

// Étapes. centre = diapo centrée ; sinon coach-mark : vue (section du routeur,
// optionnelle), cible (sélecteur), placement, titre, texte.
const ETAPES = [
  { centre: true, logo: true, titre: 'Bienvenue dans Galeria', texte: "Galeria gère votre galerie : artistes, œuvres, clients, ventes, et tous vos documents. Voici une courte visite des sections principales.", btn: 'Commencer la visite' },
  { vue: 'accueil', cible: '.entree-sidebar[data-vue="accueil"]', placement: 'right', titre: "L'accueil", texte: "À l'ouverture, votre <b>tableau de bord</b> : statistiques, ventes récentes, œuvres à préparer ou à relancer." },
  { vue: 'artistes-liste', cible: '.entree-sidebar[data-vue="artistes-liste"]', placement: 'right', titre: 'Les artistes', texte: "Chaque artiste a sa fiche : biographie, <b>cotes</b> (tarifs), fiscalité, et ses documents (présentation, catalogue, annexe)." },
  { vue: 'oeuvres-liste', cible: '.entree-sidebar[data-vue="oeuvres-liste"]', placement: 'right', titre: 'Le catalogue d’œuvres', texte: "Vos œuvres, en <b>grille ou liste</b>, avec recherche, filtres et tri." },
  { vue: 'oeuvres-liste', cible: '#btn-ajouter', placement: 'bottom-left', titre: 'Ajouter une œuvre', texte: "Le bouton <b>+ Ajouter</b> crée une fiche. Le prix peut se calculer tout seul à partir des cotes de l'artiste." },
  { vue: 'clients-liste', cible: '.entree-sidebar[data-vue="clients-liste"]', placement: 'right', titre: 'Les clients', texte: "Vos clients : coordonnées, <b>historique d'achat</b>, et le <b>consentement courriel</b> (Loi 25) pour les invitations aux vernissages." },
  { vue: 'ventes-liste', cible: '.entree-sidebar[data-vue="ventes-liste"]', placement: 'right', titre: 'Les ventes', texte: "Enregistrez une <b>vente</b> : choisissez l'œuvre et le client, ajustez taxes et rabais. L'œuvre passe « vendue » et Galeria propose la <b>pochette de vente</b>." },
  { vue: 'suivi', cible: '.entree-sidebar[data-vue="suivi"]', placement: 'right', titre: 'Le suivi des commandes', texte: "Le <b>Suivi</b> regroupe les œuvres à préparer (Sage, stock, site) et les commandes en cours — <b>paiement, emballage, envoi, livraison</b> — éditables d'un clic." },
  { vue: 'documents', cible: '.doc-vue-bascule', placement: 'bottom', titre: 'Vos documents', texte: "Tous les PDF produits (certificats, factures, pochettes…), en vue <b>liste</b> ou <b>explorateur</b> de dossiers." },
  { vue: 'rapport', cible: '.entree-sidebar[data-vue="rapport"]', placement: 'right', titre: 'Le rapport du jour', texte: "Le <b>Rapport</b> est le journal d'une journée : ventes, œuvres ajoutées ou retirées, et le suivi des commandes en cours. <b>Exportable en PDF</b> — pratique pour faire le point chaque jour ou pour la comptabilité." },
  { vue: 'outils', cible: '.zone-outil-calc', placement: 'top', titre: 'Les outils', texte: "Des <b>calculateurs</b> de prix et de commission (le net versé à l'artiste après les taxes)." },
  { cible: '#btn-profil-galerie', placement: 'right', titre: 'Réglages & profil', texte: "En bas, le <b>profil de la galerie</b> (coordonnées, logo, taxes) qui alimente tous vos documents. Les <b>Réglages</b> sont juste au-dessus." },
  { cible: '#aide-fab', placement: 'top-left', titre: "L'aide, toujours là", texte: "Le bouton <b>?</b> ouvre l'aide cherchable depuis n'importe quelle page — et permet de <b>revoir ce tutoriel</b>." },
  { centre: true, titre: 'Vous êtes prêt !', texte: "Vous pouvez commencer. En cas de doute, le bouton <b>?</b> en bas à droite répond à presque tout.", btn: 'Terminer' },
];
const NB_ETAPES = ETAPES.filter((e) => !e.centre).length;

let racine, spot, bulle, centre, monte = false;
let idx = 0;
let lastVue = null;

function attendreElement(sel, timeout = 2500) {
  return new Promise((res) => {
    const t0 = performance.now();
    (function check() {
      const el = document.querySelector(sel);
      if (el) return res(el);
      if (performance.now() - t0 > timeout) return res(null);
      requestAnimationFrame(check);
    })();
  });
}

function numCoach(i) { return ETAPES.slice(0, i + 1).filter((e) => !e.centre).length; }
function points(i) {
  return `<div class="tuto-points">${ETAPES.map((e, k) => e.centre ? '' : `<span class="tuto-point ${k === i ? 'actif' : ''}"></span>`).join('')}</div>`;
}
function placer(rect, placement) {
  const m = 14, bw = bulle.offsetWidth, bh = bulle.offsetHeight, vw = innerWidth, vh = innerHeight;
  let left, top;
  if (placement === 'right') { left = rect.right + m; top = rect.top; }
  else if (placement === 'bottom-left') { left = rect.right - bw; top = rect.bottom + m; }
  else if (placement === 'bottom') { left = rect.left; top = rect.bottom + m; }
  else if (placement === 'top-left') { left = rect.right - bw; top = rect.top - bh - m; }
  else if (placement === 'top') { left = rect.left; top = rect.top - bh - m; }
  else { left = rect.left; top = rect.bottom + m; }
  left = Math.max(m, Math.min(left, vw - bw - m));
  top = Math.max(m, Math.min(top, vh - bh - m));
  bulle.style.left = left + 'px';
  bulle.style.top = top + 'px';
}

async function montrer(i) {
  idx = i;
  const e = ETAPES[i];
  if (e.centre) {
    spot.hidden = true; bulle.hidden = true; centre.hidden = false;
    centre.innerHTML = `<div class="tuto-carte">
      ${e.logo ? '<div class="logo">Galeria</div>' : ''}
      <h2>${e.titre}</h2><p>${e.texte}</p>
      <div class="actions">
        ${i > 0 ? '<button class="tuto-btn sec" data-prec>Précédent</button>' : ''}
        <button class="tuto-btn pri" data-suiv>${e.btn || 'Suivant'}</button>
      </div></div>`;
    centre.querySelector('[data-suiv]').addEventListener('click', suivant);
    const p = centre.querySelector('[data-prec]'); if (p) p.addEventListener('click', precedent);
    return;
  }
  centre.hidden = true;
  if (e.vue && e.vue !== lastVue) { lastVue = e.vue; try { await remplacer(e.vue); } catch {} }
  const el = await attendreElement(e.cible);
  if (!el) { return suivant(); } // cible introuvable : on passe à la suite
  const r = el.getBoundingClientRect();
  const pad = 6;
  spot.hidden = false;
  spot.style.left = (r.left - pad) + 'px';
  spot.style.top = (r.top - pad) + 'px';
  spot.style.width = (r.width + pad * 2) + 'px';
  spot.style.height = (r.height + pad * 2) + 'px';
  bulle.hidden = false;
  bulle.innerHTML = `<div class="tuto-num">Étape ${numCoach(i)} / ${NB_ETAPES}</div>
    <div class="tuto-titre">${e.titre}</div><div class="tuto-texte">${e.texte}</div>
    <div class="tuto-pied">${points(i)}
      <div class="tuto-actions">
        <button class="tuto-btn sec" data-prec>Précédent</button>
        <button class="tuto-btn pri" data-suiv>${numCoach(i) === NB_ETAPES ? 'Continuer' : 'Suivant'}</button>
      </div>
    </div>`;
  bulle.querySelector('[data-suiv]').addEventListener('click', suivant);
  bulle.querySelector('[data-prec]').addEventListener('click', precedent);
  bulle.style.left = '-9999px';
  bulle.style.top = '0';
  requestAnimationFrame(() => placer(r, e.placement));
}

function suivant() { if (idx < ETAPES.length - 1) montrer(idx + 1); else fermer(); }
function precedent() { if (idx > 0) montrer(idx - 1); }

function construire() {
  if (monte) return;
  monte = true;
  racine = document.createElement('div');
  racine.id = 'tuto';
  racine.innerHTML = `
    <div class="tuto-catch"></div>
    <button class="tuto-passer" id="tuto-passer" type="button">Passer la visite</button>
    <div class="tuto-spot" id="tuto-spot" hidden></div>
    <div class="tuto-bulle" id="tuto-bulle" hidden></div>
    <div class="tuto-centre" id="tuto-centre" hidden></div>`;
  document.body.appendChild(racine);
  spot = racine.querySelector('#tuto-spot');
  bulle = racine.querySelector('#tuto-bulle');
  centre = racine.querySelector('#tuto-centre');
  racine.querySelector('#tuto-passer').addEventListener('click', fermer);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && racine.classList.contains('actif')) fermer(); });
  addEventListener('resize', () => { const e = ETAPES[idx]; if (racine.classList.contains('actif') && e && !e.centre) montrer(idx); });
}

export function lancerTutoriel() {
  construire();
  lastVue = null;
  racine.classList.add('actif');
  montrer(0);
}

function fermer() {
  if (racine) racine.classList.remove('actif');
  // Retour à l'accueil après la visite (on a parcouru plusieurs sections).
  try { remplacer('accueil'); } catch {}
}

export async function initialiserTutoriel() {
  try {
    const cfg = await window.api.configGet();
    if (cfg && cfg.tutoriel_vu) return;            // déjà vu
    await window.api.configSauver({ tutoriel_vu: true }); // ne plus le rouvrir tout seul
    lancerTutoriel();
  } catch {}
}
