import { naviguer } from '../router.js';
import { ech, pluriel } from '../commun.js';
import { chargerConfig } from '../marque.js';

export async function rendreAccueil(contenu) {
  const config = await chargerConfig();
  const nomGalerie = config.galerie.nom || 'Galerie';
  contenu.innerHTML = `
    <div class="vue-accueil">
      <img src="../gabarits/actifs/logo-gvsj.png" alt="${ech(nomGalerie)}" class="logo">
      <h1>${ech(nomGalerie)}</h1>
      <p class="tagline">Logiciel de gestion</p>

      <nav class="grille-boutons" aria-label="Menu principal">
        <button class="btn-accueil" data-vue="artistes-liste">
          <span class="icone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
            </svg>
          </span>
          <span class="libelle">Artistes</span>
        </button>
        <button class="btn-accueil" data-vue="oeuvres-liste">
          <span class="icone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="9" cy="9" r="1.5"/>
              <path d="M21 16l-5-5L5 21"/>
            </svg>
          </span>
          <span class="libelle">&OElig;uvres</span>
        </button>
        <button class="btn-accueil" data-vue="clients-liste">
          <span class="icone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="8" r="3.5"/>
              <path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
              <circle cx="17" cy="9" r="3"/>
              <path d="M22 20c0-2.5-2-4.5-4.5-4.5"/>
            </svg>
          </span>
          <span class="libelle">Clients</span>
        </button>
        <button class="btn-accueil" data-vue="ventes-liste">
          <span class="icone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="3" x2="12" y2="21"/>
              <path d="M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>
            </svg>
          </span>
          <span class="libelle">Ventes</span>
        </button>
        <button class="btn-accueil btn-secondaire" data-vue="reglages">
          <span class="icone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span class="libelle">R&eacute;glages</span>
        </button>
      </nav>
      <p class="info-phase">Phase 3B &mdash; Enregistrement des ventes. G&eacute;n&eacute;ration des documents PDF &agrave; venir.</p>

      <section class="statut-base" id="statut-base" aria-live="polite">
        <p class="emplacement">Lecture de la base&hellip;</p>
      </section>
    </div>
  `;

  contenu.querySelectorAll('[data-vue]').forEach((btn) => {
    btn.addEventListener('click', () => naviguer(btn.dataset.vue));
  });

  await rafraichirStatut();
}

async function rafraichirStatut() {
  const zone = document.getElementById('statut-base');
  if (!zone) return;
  try {
    const s = await window.api.dbStats();
    zone.innerHTML = `
      <p class="emplacement"><strong>Base de donn&eacute;es :</strong> <code>${ech(s.dbPath)}</code></p>
      <p class="compteurs">
        ${pluriel(s.artistes, 'artiste')} &middot;
        ${pluriel(s.oeuvres, 'œuvre')} &middot;
        ${pluriel(s.clients, 'client')} &middot;
        ${pluriel(s.ventes, 'vente')}
      </p>
    `;
  } catch (err) {
    zone.innerHTML = `<p class="erreur">Impossible de lire la base : ${ech(err.message)}</p>`;
  }
}
