import { naviguer } from './router.js';

let cacheConfig = null;

export async function chargerConfig() {
  if (cacheConfig) return cacheConfig;
  cacheConfig = await window.api.configGet();
  return cacheConfig;
}

export function invaliderCacheConfig() {
  cacheConfig = null;
}

export async function rafraichirEntete() {
  const c = await chargerConfig();
  const elNom = document.getElementById('nom-entete');
  if (elNom) elNom.textContent = c.galerie.nom || 'Galerie';
}

// ===== Navigation rapide entre sections depuis le header =====

const SECTIONS_NAV = [
  {
    id: 'artistes', vue: 'artistes-liste', label: 'Artistes',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
          </svg>`,
  },
  {
    id: 'oeuvres', vue: 'oeuvres-liste', label: 'Œuvres',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="9" cy="9" r="1.5"/>
            <path d="M21 16l-5-5L5 21"/>
          </svg>`,
  },
  {
    id: 'clients', vue: 'clients-liste', label: 'Clients',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="8" r="3.5"/>
            <path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
            <circle cx="17" cy="9" r="3"/>
            <path d="M22 20c0-2.5-2-4.5-4.5-4.5"/>
          </svg>`,
  },
  {
    id: 'ventes', vue: 'ventes-liste', label: 'Ventes',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="3" x2="12" y2="21"/>
            <path d="M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>
          </svg>`,
  },
];

function sectionDe(nomVue) {
  if (!nomVue) return '';
  if (nomVue === 'accueil') return 'accueil';
  if (nomVue.startsWith('artiste')) return 'artistes';
  if (nomVue.startsWith('oeuvre'))  return 'oeuvres';
  if (nomVue.startsWith('client'))  return 'clients';
  if (nomVue.startsWith('vente'))   return 'ventes';
  return '';
}

export function majActionsEntete(nomVue) {
  const sectionActuelle = sectionDe(nomVue);
  const zone = document.getElementById('actions-entete');
  if (!zone) return;
  if (sectionActuelle === 'accueil' || sectionActuelle === '') {
    zone.innerHTML = '';
    return;
  }
  const autres = SECTIONS_NAV.filter((s) => s.id !== sectionActuelle);
  zone.innerHTML = autres
    .map((s) => `
      <button class="btn-section-entete" data-vue="${s.vue}" title="${s.label}" aria-label="${s.label}">
        <span class="icone-section-entete">${s.svg}</span>
        <span class="libelle-section-entete">${s.label}</span>
      </button>
    `).join('');
  zone.querySelectorAll('button[data-vue]').forEach((btn) => {
    btn.addEventListener('click', () => naviguer(btn.dataset.vue));
  });
}
