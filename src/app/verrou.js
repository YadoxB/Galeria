// ===== Verrou léger de l'application (renderer) =====
// Affiche un écran de verrouillage plein cadre avec pavé numérique. La
// vérification du code se fait dans le processus principal (jamais d'empreinte
// côté renderer). Gère aussi le verrouillage automatique sur inactivité et, si
// activé, à la perte de focus de la fenêtre (notifié par le processus principal).

const LONG_MIN = 4;
const LONG_MAX = 6;

let etat = { verrou_actif: false, inactivite_minutes: 10, verrouiller_au_demarrage: true };
let overlay = null;
let saisie = '';
let verrouille = false;
let minuterie = null;
let verifEnCours = false;

// --- Construction de l'écran (une seule fois) ---
function construireOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'verrou-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="verrou-carte" id="verrou-carte">
      <div class="verrou-marque">Galeria</div>
      <div class="verrou-cadenas" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="11" width="16" height="9" rx="2"/>
          <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
        </svg>
      </div>
      <h2 class="verrou-titre">Application verrouillée</h2>
      <p class="verrou-sous">Entrez le code pour accéder à la galerie</p>
      <div class="verrou-points" id="verrou-points" aria-hidden="true"></div>
      <div class="verrou-erreur" id="verrou-erreur" role="alert"></div>
      <div class="verrou-pave" id="verrou-pave"></div>
      <p class="verrou-aide"><button type="button" id="verrou-oubli">Code oublié ?</button></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const pave = overlay.querySelector('#verrou-pave');
  const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'effacer', '0', 'valider'];
  pave.innerHTML = TOUCHES.map((t) => {
    if (t === 'effacer') return '<button type="button" class="verrou-touche utilitaire" data-t="effacer" aria-label="Effacer">⌫</button>';
    if (t === 'valider') return '<button type="button" class="verrou-touche valider" data-t="valider" aria-label="Valider">✓</button>';
    return `<button type="button" class="verrou-touche" data-t="${t}">${t}</button>`;
  }).join('');
  pave.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) appui(b.dataset.t);
  });
  overlay.querySelector('#verrou-oubli').addEventListener('click', () => {
    montrerErreur('Communiquez avec la personne qui gère l’application pour réinitialiser le code.');
  });
  return overlay;
}

function dessinerPoints() {
  const box = overlay.querySelector('#verrou-points');
  const n = Math.max(saisie.length, LONG_MIN);
  box.innerHTML = Array.from({ length: Math.min(n, LONG_MAX) }, (_, i) =>
    `<span class="verrou-point ${i < saisie.length ? 'plein' : ''}"></span>`).join('');
}

function montrerErreur(msg) {
  overlay.querySelector('#verrou-erreur').textContent = msg || '';
}

function secouer() {
  const carte = overlay.querySelector('#verrou-carte');
  carte.classList.remove('secousse');
  void carte.offsetWidth; // relance l'animation
  carte.classList.add('secousse');
}

async function tenter({ definitif }) {
  // definitif = la saisie ne peut plus grandir (longueur max ou bouton ✓) →
  // on affiche l'erreur si le code est mauvais. Sinon échec silencieux (la
  // personne tape peut-être encore un code plus long).
  if (saisie.length < LONG_MIN) {
    if (definitif) { secouer(); montrerErreur('Le code comporte au moins 4 chiffres.'); }
    return;
  }
  if (verifEnCours) return;
  verifEnCours = true;
  const tentee = saisie;
  let ok = false;
  try {
    const r = await window.api.securiteVerifierCode(tentee);
    ok = !!(r && r.ok);
  } catch { ok = false; }
  verifEnCours = false;
  if (ok) { deverrouiller(); return; }
  if (definitif) {
    secouer();
    montrerErreur('Code incorrect. Réessayez.');
    saisie = '';
    dessinerPoints();
    return;
  }
  // La saisie a grandi pendant la vérification (frappe rapide) : on réessaie
  // avec la valeur courante pour ne pas rester bloqué sans nouvelle tentative.
  if (saisie !== tentee && saisie.length >= LONG_MIN) {
    tenter({ definitif: saisie.length >= LONG_MAX });
  }
}

function appui(t) {
  if (t === 'effacer') { saisie = saisie.slice(0, -1); montrerErreur(''); dessinerPoints(); return; }
  if (t === 'valider') { tenter({ definitif: true }); return; }
  if (saisie.length >= LONG_MAX) return;
  saisie += t;
  montrerErreur('');
  dessinerPoints();
  // Vérification silencieuse dès 4 chiffres (la longueur réelle du code n'est
  // pas connue du renderer) ; erreur seulement à 6 chiffres.
  if (saisie.length >= LONG_MIN) tenter({ definitif: saisie.length >= LONG_MAX });
}

function clavier(e) {
  if (!verrouille) return;
  if (/^[0-9]$/.test(e.key)) { appui(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { appui('effacer'); e.preventDefault(); }
  else if (e.key === 'Enter') { appui('valider'); e.preventDefault(); }
  else if (e.key === 'Tab') { e.preventDefault(); } // ne pas laisser le focus filer derrière
}

function verrouiller() {
  if (verrouille) return;
  construireOverlay();
  verrouille = true;
  saisie = '';
  montrerErreur('');
  dessinerPoints();
  overlay.hidden = false;
  // Empêche l'interaction et la navigation au clavier dans l'app derrière.
  const appli = document.getElementById('appli');
  if (appli) appli.setAttribute('inert', '');
  arreterMinuterie();
}

function deverrouiller() {
  verrouille = false;
  saisie = '';
  if (overlay) overlay.hidden = true;
  const appli = document.getElementById('appli');
  if (appli) appli.removeAttribute('inert');
  rearmerMinuterie();
}

// --- Minuterie d'inactivité ---
function arreterMinuterie() {
  if (minuterie) { clearTimeout(minuterie); minuterie = null; }
}
function rearmerMinuterie() {
  arreterMinuterie();
  if (verrouille) return;
  if (!etat.verrou_actif) return;
  const min = Number(etat.inactivite_minutes) || 0;
  if (min <= 0) return;
  minuterie = setTimeout(verrouiller, min * 60 * 1000);
}
function surActivite() {
  if (verrouille) return;
  rearmerMinuterie();
}

// --- Initialisation / réapplication ---
export async function initialiserVerrou() {
  try {
    etat = await window.api.securiteEtat();
  } catch {
    etat = { verrou_actif: false, inactivite_minutes: 0, verrouiller_au_demarrage: false };
  }
  construireOverlay();

  // Écouteurs d'activité (réarment la minuterie). Posés une seule fois.
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, surActivite, { passive: true }));
  document.addEventListener('keydown', clavier, true);

  // Verrouillage au blur (notifié par le processus principal).
  if (window.api.onSecuriteVerrouiller) {
    window.api.onSecuriteVerrouiller(() => { if (etat.verrou_actif) verrouiller(); });
  }

  if (etat.verrou_actif && etat.verrouiller_au_demarrage) verrouiller();
  else rearmerMinuterie();
}

// Appelée par la page Réglages après modification des options de sécurité :
// met à jour la minuterie sans verrouiller brutalement l'utilisateur.
export async function reappliquerVerrou() {
  try {
    etat = await window.api.securiteEtat();
  } catch { return; }
  if (!etat.verrou_actif && verrouille) deverrouiller();
  rearmerMinuterie();
}
