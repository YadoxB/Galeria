// Module client de mise à jour. Écoute l'état envoyé par main.js et affiche :
//   - un toast en bas à droite quand une mise à jour devient disponible
//   - une modale détaillée au clic sur le toast
//   - un statut + bouton « Vérifier maintenant » dans la section « À propos »
//     de Réglages (alimenté par cette même source de vérité)

import { ech } from './commun.js';

let etatCourant = { phase: 'idle' };
const ecouteurs = new Set();
let toastActif = null;
let modaleActive = null;

function notifier() {
  for (const ec of ecouteurs) {
    try { ec(etatCourant); } catch {}
  }
  majToast();
  majModale();
}

export function abonnerEtatUpdater(callback) {
  ecouteurs.add(callback);
  callback(etatCourant);
  return () => ecouteurs.delete(callback);
}

export function etatUpdater() { return etatCourant; }

export async function initialiserUpdater() {
  const etatInitial = await window.api.updaterEtat();
  if (etatInitial) {
    etatCourant = etatInitial;
    notifier();
  }
  window.api.onUpdaterEtat((etat) => {
    etatCourant = etat;
    notifier();
  });
}

// ====== Actions ======

export function verifierManuellement() {
  return window.api.updaterVerifier();
}

export function lancerTelechargement() {
  return window.api.updaterTelecharger();
}

export function redemarrerEtInstaller() {
  return window.api.updaterInstallerRedemarrer();
}

// ====== Helpers d'affichage ======

export function libelleEtat(etat = etatCourant) {
  switch (etat.phase) {
    case 'idle':       return "Aucune vérification effectuée.";
    case 'checking':   return "Vérification en cours…";
    case 'available':  return `Mise à jour disponible : ${etat.info?.version || ''}`;
    case 'downloading':{
      const p = etat.progress;
      const pc = p?.percent != null ? Math.round(p.percent) : null;
      return pc != null ? `Téléchargement : ${pc} %` : "Téléchargement en cours…";
    }
    case 'downloaded': return `Mise à jour téléchargée : ${etat.info?.version || ''}. Prête à installer.`;
    case 'up-to-date': return "Tu utilises déjà la version la plus récente.";
    case 'error':      return `Erreur : ${etat.erreur || 'inconnue'}`;
    case 'dev':        return "Mises à jour désactivées en mode développement.";
    default:           return etat.phase;
  }
}

// ====== Toast ======

function majToast() {
  // On affiche le toast seulement quand une mise à jour devient disponible ou
  // a été téléchargée. Les autres phases sont silencieuses (pour ne pas
  // déranger lors des vérifications de fond).
  const phasesVisibles = new Set(['available', 'downloaded']);
  if (!phasesVisibles.has(etatCourant.phase)) {
    if (toastActif) { toastActif.remove(); toastActif = null; }
    return;
  }
  if (modaleActive) return; // pas de toast pendant que la modale est ouverte

  if (!toastActif) {
    toastActif = document.createElement('div');
    toastActif.className = 'updater-toast';
    document.body.appendChild(toastActif);
    toastActif.addEventListener('click', () => ouvrirModale());
  }
  const v = etatCourant.info?.version || '';
  const titre = etatCourant.phase === 'available'
    ? `Mise à jour ${v} disponible`
    : `Mise à jour ${v} prête à installer`;
  const sous = etatCourant.phase === 'available'
    ? 'Cliquer pour voir les détails'
    : 'Cliquer pour redémarrer';
  toastActif.innerHTML = `
    <div class="updater-toast-icone" aria-hidden="true">↑</div>
    <div class="updater-toast-corps">
      <p class="updater-toast-titre">${ech(titre)}</p>
      <p class="updater-toast-sous">${ech(sous)}</p>
    </div>
  `;
}

// ====== Modale ======

export function ouvrirModale() {
  if (modaleActive) return;
  if (toastActif) { toastActif.remove(); toastActif = null; }

  const overlay = document.createElement('div');
  overlay.className = 'overlay-modale';
  overlay.innerHTML = `
    <div class="modale-recadrage modale-updater">
      <h3 id="updater-titre">Mise à jour</h3>
      <p id="updater-version" class="updater-version"></p>
      <div id="updater-notes" class="updater-notes" hidden></div>
      <div id="updater-progress-wrap" class="updater-progress-wrap" hidden>
        <div class="updater-progress"><div id="updater-progress-bar" class="updater-progress-bar"></div></div>
        <p id="updater-progress-texte" class="updater-progress-texte"></p>
      </div>
      <p id="updater-erreur" class="updater-erreur" hidden></p>
      <div class="form-actions" style="justify-content: flex-end;">
        <button type="button" class="btn-action btn-secondaire-action" id="updater-fermer">Plus tard</button>
        <button type="button" class="btn-action btn-principal" id="updater-action"></button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  modaleActive = overlay;

  overlay.querySelector('#updater-fermer').addEventListener('click', fermerModale);
  overlay.querySelector('#updater-action').addEventListener('click', async () => {
    if (etatCourant.phase === 'available') await lancerTelechargement();
    else if (etatCourant.phase === 'downloaded') await redemarrerEtInstaller();
    else if (etatCourant.phase === 'error' || etatCourant.phase === 'up-to-date') await verifierManuellement();
  });

  majModale();
}

function fermerModale() {
  if (modaleActive) {
    modaleActive.remove();
    modaleActive = null;
    majToast();
  }
}

function majModale() {
  if (!modaleActive) return;
  const titre = modaleActive.querySelector('#updater-titre');
  const version = modaleActive.querySelector('#updater-version');
  const notes = modaleActive.querySelector('#updater-notes');
  const progressWrap = modaleActive.querySelector('#updater-progress-wrap');
  const progressBar = modaleActive.querySelector('#updater-progress-bar');
  const progressTexte = modaleActive.querySelector('#updater-progress-texte');
  const erreur = modaleActive.querySelector('#updater-erreur');
  const btnAction = modaleActive.querySelector('#updater-action');
  const btnFermer = modaleActive.querySelector('#updater-fermer');

  notes.hidden = true;
  progressWrap.hidden = true;
  erreur.hidden = true;
  btnAction.disabled = false;

  switch (etatCourant.phase) {
    case 'available': {
      const v = etatCourant.info?.version || '';
      titre.textContent = 'Mise à jour disponible';
      version.textContent = `Version ${v} prête à être téléchargée.`;
      const releaseNotes = etatCourant.info?.releaseNotes;
      if (releaseNotes) {
        notes.hidden = false;
        const html = typeof releaseNotes === 'string'
          ? releaseNotes
          : releaseNotes.map((n) => n.note || '').join('<br>');
        notes.innerHTML = html;
      }
      btnAction.textContent = 'Télécharger';
      btnFermer.textContent = 'Plus tard';
      break;
    }
    case 'downloading': {
      const v = etatCourant.info?.version || '';
      titre.textContent = 'Téléchargement en cours';
      version.textContent = `Version ${v}`;
      progressWrap.hidden = false;
      const p = etatCourant.progress;
      const pc = p?.percent != null ? Math.round(p.percent) : 0;
      progressBar.style.width = `${pc}%`;
      const transferred = p?.transferred ? (p.transferred / (1024 * 1024)).toFixed(1) : '0';
      const total = p?.total ? (p.total / (1024 * 1024)).toFixed(1) : '?';
      progressTexte.textContent = `${pc} % — ${transferred} / ${total} Mo`;
      btnAction.disabled = true;
      btnAction.textContent = 'Téléchargement…';
      btnFermer.textContent = 'Masquer';
      break;
    }
    case 'downloaded': {
      const v = etatCourant.info?.version || '';
      titre.textContent = 'Prête à installer';
      version.textContent = `Version ${v} téléchargée. L'app va se fermer, s'installer et redémarrer.`;
      btnAction.textContent = 'Redémarrer maintenant';
      btnFermer.textContent = 'Plus tard';
      break;
    }
    case 'up-to-date': {
      titre.textContent = 'À jour';
      version.textContent = libelleEtat();
      btnAction.textContent = 'Vérifier à nouveau';
      btnFermer.textContent = 'Fermer';
      break;
    }
    case 'checking': {
      titre.textContent = 'Vérification…';
      version.textContent = libelleEtat();
      btnAction.disabled = true;
      btnAction.textContent = 'Vérification…';
      btnFermer.textContent = 'Masquer';
      break;
    }
    case 'error': {
      titre.textContent = 'Erreur';
      version.textContent = '';
      erreur.hidden = false;
      erreur.textContent = etatCourant.erreur || 'Une erreur inconnue est survenue.';
      btnAction.textContent = 'Réessayer';
      btnFermer.textContent = 'Fermer';
      break;
    }
    case 'dev': {
      titre.textContent = 'Mode développement';
      version.textContent = libelleEtat();
      btnAction.disabled = true;
      btnAction.textContent = 'Indisponible en dev';
      btnFermer.textContent = 'Fermer';
      break;
    }
    default: {
      titre.textContent = 'Mise à jour';
      version.textContent = libelleEtat();
      btnAction.textContent = 'Vérifier';
      btnFermer.textContent = 'Fermer';
    }
  }
}
