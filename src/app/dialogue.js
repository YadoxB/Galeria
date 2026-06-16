import { ech } from './commun.js';

const ICONES = {
  info: {
    fond: '#3678c7',
    svg: `<circle cx="12" cy="12" r="9.5" stroke-width="1.6"/>
          <line x1="12" y1="11" x2="12" y2="17" stroke-width="2"/>
          <circle cx="12" cy="7.5" r="1" fill="white" stroke="none"/>`,
  },
  warning: {
    fond: '#c98a1f',
    svg: `<path d="M12 3 L22 21 L2 21 Z" stroke-width="1.6"/>
          <line x1="12" y1="10" x2="12" y2="15" stroke-width="2"/>
          <circle cx="12" cy="18.2" r="1" fill="white" stroke="none"/>`,
  },
  error: {
    fond: '#a83232',
    svg: `<circle cx="12" cy="12" r="9.5" stroke-width="1.6"/>
          <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" stroke-width="2"/>
          <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" stroke-width="2"/>`,
  },
  question: {
    fond: '#b8943a',
    svg: `<circle cx="12" cy="12" r="9.5" stroke-width="1.6"/>
          <path d="M9 9.5c0-1.8 1.4-3 3-3s3 1.2 3 3-3 2-3 4.5" stroke-width="2"/>
          <circle cx="12" cy="17.2" r="1" fill="white" stroke="none"/>`,
  },
  succes: {
    fond: '#3e7d3a',
    svg: `<circle cx="12" cy="12" r="9.5" stroke-width="1.6"/>
          <polyline points="8 12.5 11 15.5 16 9.5" stroke-width="2"/>`,
  },
};

function variantePour(label, type, isDefault) {
  if (!isDefault) return 'btn-secondaire-action';
  const danger = /supprimer|effacer|abandonner|retirer/i;
  if (type === 'error') return 'btn-danger';
  if (type === 'warning' && danger.test(label)) return 'btn-danger';
  return 'btn-principal';
}

export function confirmer(opts) {
  return new Promise((resolve) => {
    const type = opts.type || 'question';
    const titre = opts.title || '';
    const message = opts.message || '';
    const detail = opts.detail || '';
    const boutons = (opts.buttons && opts.buttons.length) ? opts.buttons : ['OK'];
    const defaultId = Math.max(0, Math.min(boutons.length - 1, opts.defaultId ?? 0));
    const cancelId = opts.cancelId == null
      ? (boutons.length > 1 ? boutons.length - 1 : -1)
      : opts.cancelId;

    const icone = ICONES[type] || ICONES.question;

    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue" role="alertdialog" aria-modal="true">
        <div class="dialogue-entete">
          <div class="dialogue-icone" style="background:${icone.fond}">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">${icone.svg}</svg>
          </div>
          ${titre ? `<h3 class="dialogue-titre">${ech(titre)}</h3>` : ''}
        </div>
        ${message ? `<p class="dialogue-message">${ech(message).replace(/\n/g, '<br>')}</p>` : ''}
        ${detail ? `<p class="dialogue-detail">${ech(detail).replace(/\n/g, '<br>')}</p>` : ''}
        <div class="dialogue-actions">
          ${boutons.map((b, i) => `
            <button type="button" class="btn-action ${variantePour(b, type, i === defaultId)}" data-i="${i}">${ech(b)}</button>
          `).join('')}
        </div>
      </div>
    `;

    function fermer(i) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(i);
    }

    function onKey(e) {
      if (e.key === 'Escape' && cancelId >= 0) {
        e.preventDefault();
        fermer(cancelId);
      } else if (e.key === 'Enter' && !e.target.matches('textarea, input')) {
        e.preventDefault();
        fermer(defaultId);
      }
    }

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay && cancelId >= 0) fermer(cancelId);
    });
    overlay.querySelectorAll('button[data-i]').forEach((btn) => {
      btn.addEventListener('click', () => fermer(Number(btn.dataset.i)));
    });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    const defaultBtn = overlay.querySelectorAll('button[data-i]')[defaultId];
    if (defaultBtn) defaultBtn.focus();
  });
}

export function alerter(opts) {
  return confirmer({ ...opts, buttons: ['OK'], defaultId: 0, cancelId: 0 });
}
