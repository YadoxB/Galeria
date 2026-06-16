import { naviguer, remplacerCourant } from '../router.js';
import {
  ech, sansAccents, formaterPrix, badgeStatut, pluriel, STATUTS, urlPhoto,
  gabaritEntetePage, gabaritBoutonFiltres,
} from '../commun.js';
import { confirmer, alerter } from '../dialogue.js';

const CLE_PREF_VUE = 'oeuvres-vue';
const CLE_PREF_TRI = 'oeuvres-tri';

function lirePref(cle, defaut) {
  try { return localStorage.getItem(cle) || defaut; } catch { return defaut; }
}
function ecrirePref(cle, val) {
  try { localStorage.setItem(cle, val); } catch {}
}

function formaterEntier(n) {
  return (Number(n) || 0).toLocaleString('fr-CA');
}

function formaterMontantCourt(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return Math.round(v).toLocaleString('fr-CA') + ' $';
  return v.toFixed(2) + ' $';
}

function gabaritStatsOeuvres(stats) {
  const deltaArtistes = stats.artistesDeltaMois > 0
    ? `+${stats.artistesDeltaMois} ce mois-ci`
    : 'aucun nouveau ce mois';
  const deltaOeuvres = stats.totalDeltaMois > 0
    ? `+${stats.totalDeltaMois} ce mois-ci`
    : 'aucune nouvelle ce mois';
  return `
    <div class="stats-row">
      <div class="stat-carte">
        <div class="stat-tuile tuile-doree" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M21 16l-5-5L5 21"/>
          </svg>
        </div>
        <div class="stat-corps">
          <p class="stat-libelle">Œuvres au total</p>
          <p class="stat-valeur">${formaterEntier(stats.total)}</p>
          <p class="stat-delta ${stats.totalDeltaMois > 0 ? '' : 'neutre'}">${ech(deltaOeuvres)}</p>
        </div>
      </div>
      <div class="stat-carte">
        <div class="stat-tuile tuile-saumon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
          </svg>
        </div>
        <div class="stat-corps">
          <p class="stat-libelle">Artistes représentés</p>
          <p class="stat-valeur">${formaterEntier(stats.artistes)}</p>
          <p class="stat-delta ${stats.artistesDeltaMois > 0 ? '' : 'neutre'}">${ech(deltaArtistes)}</p>
        </div>
      </div>
      <div class="stat-carte">
        <div class="stat-tuile tuile-terracotta" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="3" x2="12" y2="21"/><path d="M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>
          </svg>
        </div>
        <div class="stat-corps">
          <p class="stat-libelle">Ventes ce mois</p>
          <p class="stat-valeur">${formaterEntier(stats.ventesRecentes)}</p>
          <p class="stat-delta neutre">${ech(formaterMontantCourt(stats.ventesRecentesMontant))}</p>
        </div>
      </div>
      <div class="stat-carte">
        <div class="stat-tuile tuile-navy" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="stat-corps">
          <p class="stat-libelle">Disponibles</p>
          <p class="stat-valeur">${formaterEntier(stats.disponibles)}</p>
          <p class="stat-delta neutre">${stats.disponiblesPct}% du total</p>
        </div>
      </div>
    </div>
  `;
}

function trier(oeuvres, tri) {
  const liste = [...oeuvres];
  const cmpStr = (a, b) => sansAccents(a || '').localeCompare(sansAccents(b || ''));
  switch (tri) {
    case 'titre-asc':    liste.sort((a, b) => cmpStr(a.titre, b.titre)); break;
    case 'prix-asc':     liste.sort((a, b) => (a.prix || 0) - (b.prix || 0)); break;
    case 'prix-desc':    liste.sort((a, b) => (b.prix || 0) - (a.prix || 0)); break;
    case 'artiste-asc':  liste.sort((a, b) => cmpStr(a.artiste_nom, b.artiste_nom)); break;
    case 'plus-recentes':
    default:             liste.sort((a, b) => b.id - a.id); break;
  }
  return liste;
}

export async function rendreOeuvresListe(contenu, params = {}) {
  const filtres = {};
  if (params.artiste_id != null) filtres.artiste_id = params.artiste_id;

  const [oeuvres, artistes, types, stats] = await Promise.all([
    window.api.oeuvresListe(filtres),
    window.api.artistesListe(),
    window.api.oeuvresTypes(),
    params.artiste_id == null ? window.api.oeuvresStats() : Promise.resolve(null),
  ]);

  let vueCourante = lirePref(CLE_PREF_VUE, 'grille');
  let triCourant = lirePref(CLE_PREF_TRI, 'plus-recentes');

  const filtreActif = params.artiste_id != null
    ? `<div class="filtre-actif">
         <span>Œuvres de <strong>${ech(params.artiste_nom || 'cet artiste')}</strong></span>
         <button class="btn-lien" id="btn-tout-voir">Voir toutes les œuvres</button>
       </div>`
    : '';

  const titre = params.artiste_id != null
    ? `Œuvres de ${params.artiste_nom || 'cet artiste'}`
    : 'Œuvres';

  contenu.innerHTML = `
    <div class="vue-liste">
      ${gabaritEntetePage({
        titre,
        placeholder: 'Rechercher une œuvre, un artiste, un n° d\'inventaire…',
        boutonAjouterLibelle: '+ Ajouter une œuvre',
      })}
      ${stats ? gabaritStatsOeuvres(stats) : ''}
      ${filtreActif}

      <div class="controles-vue">
        <div class="toggle-vue" role="tablist" aria-label="Mode d'affichage">
          <button id="btn-vue-grille" class="${vueCourante === 'grille' ? 'actif' : ''}" title="Grille" aria-label="Grille">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button id="btn-vue-liste" class="${vueCourante === 'liste' ? 'actif' : ''}" title="Liste" aria-label="Liste">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="controles-vue-droite">
          ${gabaritBoutonFiltres()}
          <div class="tri-deroulant">
            <label for="tri-oeuvres" class="tri-deroulant-libelle">Trier par</label>
            <select id="tri-oeuvres">
              <option value="plus-recentes" ${triCourant === 'plus-recentes' ? 'selected' : ''}>Plus récentes</option>
              <option value="titre-asc"     ${triCourant === 'titre-asc' ? 'selected' : ''}>Titre A→Z</option>
              <option value="artiste-asc"   ${triCourant === 'artiste-asc' ? 'selected' : ''}>Artiste A→Z</option>
              <option value="prix-asc"      ${triCourant === 'prix-asc' ? 'selected' : ''}>Prix croissant</option>
              <option value="prix-desc"     ${triCourant === 'prix-desc' ? 'selected' : ''}>Prix décroissant</option>
            </select>
          </div>
        </div>
      </div>

      <div class="barre-recherche">
        <span class="compteur" id="compteur"></span>
      </div>
      <div id="conteneur-oeuvres"></div>
    </div>
  `;

  // État des filtres
  let statutsActifs = [];
  let artisteIdFiltre = '';
  let typeFiltre = '';

  const recherche = contenu.querySelector('#recherche');
  const conteneur = contenu.querySelector('#conteneur-oeuvres');
  const compteur = contenu.querySelector('#compteur');
  const btnVueGrille = contenu.querySelector('#btn-vue-grille');
  const btnVueListe = contenu.querySelector('#btn-vue-liste');
  const triSelect = contenu.querySelector('#tri-oeuvres');
  const btnToutVoir = contenu.querySelector('#btn-tout-voir');
  if (btnToutVoir) btnToutVoir.addEventListener('click', () => naviguer('oeuvres-liste'));

  // Bouton Filtres → ouvre un panneau déroulant
  const btnFiltres = contenu.querySelector('#btn-filtres');
  let panneauFiltres = null;
  function fermerPanneau() {
    if (panneauFiltres) {
      panneauFiltres.remove();
      panneauFiltres = null;
      btnFiltres.classList.remove('ouvert');
      document.removeEventListener('mousedown', surExtClic);
      document.removeEventListener('keydown', surEchap);
    }
  }
  function surExtClic(e) {
    if (panneauFiltres && !panneauFiltres.contains(e.target) && !btnFiltres.contains(e.target)) {
      fermerPanneau();
    }
  }
  function surEchap(e) { if (e.key === 'Escape') fermerPanneau(); }

  function ouvrirPanneau() {
    if (panneauFiltres) { fermerPanneau(); return; }
    btnFiltres.classList.add('ouvert');
    panneauFiltres = document.createElement('div');
    panneauFiltres.className = 'panneau-filtres';
    panneauFiltres.innerHTML = `
      <div class="groupe-filtre">
        <h4>Statuts</h4>
        <div class="groupe-statuts" id="panneau-statuts" style="margin:0;padding:0;">
          ${Object.entries(STATUTS).map(([k, v]) => `
            <label class="chip-statut">
              <input type="checkbox" value="${k}" ${statutsActifs.includes(k) ? 'checked' : ''}>
              <span class="chip-libelle badge-statut ${v.classe}">${ech(v.libelle)}</span>
            </label>
          `).join('')}
        </div>
      </div>
      ${params.artiste_id == null ? `
        <div class="groupe-filtre">
          <h4>Artiste</h4>
          <select id="panneau-filtre-artiste">
            <option value="">Tous les artistes</option>
            ${artistes.map((a) => `<option value="${a.id}" ${String(a.id) === artisteIdFiltre ? 'selected' : ''}>${ech(a.nom)}</option>`).join('')}
          </select>
        </div>
      ` : ''}
      <div class="groupe-filtre">
        <h4>Type</h4>
        <select id="panneau-filtre-type">
          <option value="">Tous les types</option>
          ${types.map((t) => `<option value="${ech(t)}" ${t === typeFiltre ? 'selected' : ''}>${ech(t)}</option>`).join('')}
        </select>
      </div>
    `;
    contenu.querySelector('.controles-vue-droite').appendChild(panneauFiltres);

    panneauFiltres.querySelectorAll('#panneau-statuts input[type="checkbox"]').forEach((c) => {
      c.addEventListener('change', () => {
        statutsActifs = Array.from(panneauFiltres.querySelectorAll('#panneau-statuts input:checked')).map((x) => x.value);
        dessiner();
      });
    });
    const panneauArt = panneauFiltres.querySelector('#panneau-filtre-artiste');
    if (panneauArt) panneauArt.addEventListener('change', () => { artisteIdFiltre = panneauArt.value; dessiner(); });
    const panneauType = panneauFiltres.querySelector('#panneau-filtre-type');
    if (panneauType) panneauType.addEventListener('change', () => { typeFiltre = panneauType.value; dessiner(); });

    setTimeout(() => {
      document.addEventListener('mousedown', surExtClic);
      document.addEventListener('keydown', surEchap);
    }, 0);
  }
  btnFiltres.addEventListener('click', ouvrirPanneau);

  contenu.querySelector('#btn-ajouter').addEventListener('click', () => {
    const p = { nouveau: true };
    if (params.artiste_id != null) p.artiste_id = params.artiste_id;
    naviguer('oeuvre-fiche', p);
  });

  btnVueGrille.addEventListener('click', () => {
    if (vueCourante === 'grille') return;
    vueCourante = 'grille';
    ecrirePref(CLE_PREF_VUE, vueCourante);
    btnVueGrille.classList.add('actif'); btnVueListe.classList.remove('actif');
    dessiner();
  });
  btnVueListe.addEventListener('click', () => {
    if (vueCourante === 'liste') return;
    vueCourante = 'liste';
    ecrirePref(CLE_PREF_VUE, vueCourante);
    btnVueListe.classList.add('actif'); btnVueGrille.classList.remove('actif');
    dessiner();
  });
  triSelect.addEventListener('change', () => {
    triCourant = triSelect.value;
    ecrirePref(CLE_PREF_TRI, triCourant);
    dessiner();
  });

  function ouvrirMenuOeuvre(oeuvre, btn) {
    const existant = document.querySelector('.menu-popover');
    if (existant) existant.remove();
    const menu = document.createElement('div');
    menu.className = 'menu-popover';
    menu.innerHTML = `
      <button data-action="voir">Voir la fiche</button>
      ${oeuvre.statut !== 'vendu' ? '<button data-action="vendre">Vendre</button>' : ''}
      <button data-action="supprimer" class="danger">Supprimer</button>
    `;
    document.body.appendChild(menu);
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    const menuLargeur = 180;
    menu.style.left = Math.max(8, rect.right - menuLargeur) + 'px';

    function fermer() {
      menu.remove();
      document.removeEventListener('mousedown', surExtClic);
      document.removeEventListener('keydown', surEchap);
    }
    function surExtClic(e) {
      if (!menu.contains(e.target) && e.target !== btn) fermer();
    }
    function surEchap(e) { if (e.key === 'Escape') fermer(); }
    setTimeout(() => {
      document.addEventListener('mousedown', surExtClic);
      document.addEventListener('keydown', surEchap);
    }, 0);

    menu.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      fermer();
      if (action === 'voir') {
        naviguer('oeuvre-fiche', { id: oeuvre.id });
      } else if (action === 'vendre') {
        naviguer('vente-fiche', { nouveau: true, oeuvre_id: oeuvre.id });
      } else if (action === 'supprimer') {
        const r = await confirmer({
          type: 'warning', title: 'Supprimer cette œuvre ?',
          message: `Supprimer définitivement « ${oeuvre.titre} » ?`,
          detail: 'Action irréversible. Refusée si l\'œuvre est liée à une vente.',
          buttons: ['Supprimer', 'Annuler'],
          defaultId: 1, cancelId: 1,
        });
        if (r !== 0) return;
        try {
          await window.api.oeuvreSupprimer(oeuvre.id);
          // Retire l'œuvre de la liste locale et redessine
          const idx = oeuvres.findIndex((o) => o.id === oeuvre.id);
          if (idx >= 0) oeuvres.splice(idx, 1);
          dessiner();
        } catch (err) {
          await alerter({ type: 'error', title: 'Suppression refusée', message: err.message });
        }
      }
    });
  }

  function carteGrille(o) {
    return `
      <article class="oeuvre-carte" data-id="${o.id}">
        <div class="oeuvre-carte-image">
          ${o.image_path
            ? `<img src="${urlPhoto(o.image_path)}" loading="lazy" alt="">`
            : `<span class="oeuvre-carte-image-vide">&#9635;</span>`}
        </div>
        <div class="oeuvre-carte-corps">
          <div class="oeuvre-carte-ligne-titre">
            <h3 class="oeuvre-carte-titre">${ech(o.titre)}</h3>
            ${o.annee ? `<span class="oeuvre-carte-annee">${o.annee}</span>` : ''}
          </div>
          <p class="oeuvre-carte-artiste">${ech(o.artiste_nom)}</p>
          ${o.prix != null ? `<p class="oeuvre-carte-prix">${formaterPrix(o.prix)}</p>` : ''}
          <div class="oeuvre-carte-pied">
            ${badgeStatut(o.statut)}
            <button type="button" class="btn-menu-oeuvre" aria-label="Plus d'actions">⋯</button>
          </div>
        </div>
      </article>
    `;
  }

  function ligneListe(o) {
    return `
      <button class="ligne-liste ligne-oeuvre" data-id="${o.id}">
        ${o.image_path
          ? `<div class="vignette avec-photo"><img src="${urlPhoto(o.image_path)}" loading="lazy" alt=""></div>`
          : `<div class="vignette"><span>&#9635;</span></div>`}
        <div class="info">
          <p class="ligne-titre">${ech(o.titre)}</p>
          <p class="ligne-meta">
            ${ech(o.artiste_nom)}
            ${o.numero_inventaire ? `&nbsp;&middot;&nbsp;${ech(o.numero_inventaire)}` : ''}
            ${o.annee ? `&nbsp;&middot;&nbsp;${o.annee}` : ''}
          </p>
        </div>
        <div class="prix">${formaterPrix(o.prix)}</div>
        ${badgeStatut(o.statut)}
        <span class="chevron">&rsaquo;</span>
      </button>
    `;
  }

  function dessiner() {
    const motRecherche = sansAccents(recherche.value);

    const filtres = oeuvres.filter((o) => {
      if (statutsActifs.length > 0 && !statutsActifs.includes(o.statut)) return false;
      if (artisteIdFiltre && String(o.artiste_id) !== artisteIdFiltre) return false;
      if (typeFiltre && o.type !== typeFiltre) return false;
      if (motRecherche) {
        const cible = sansAccents(
          [o.titre, o.artiste_nom, o.numero_inventaire, o.numero_delivrance].filter(Boolean).join(' ')
        );
        if (!cible.includes(motRecherche)) return false;
      }
      return true;
    });

    const triees = trier(filtres, triCourant);

    compteur.textContent = pluriel(triees.length, 'œuvre');

    if (triees.length === 0) {
      conteneur.innerHTML = `<p class="liste-vide">Aucune œuvre ne correspond.</p>`;
      return;
    }

    if (vueCourante === 'grille') {
      conteneur.className = 'grille-oeuvres';
      conteneur.innerHTML = triees.map(carteGrille).join('');
      conteneur.querySelectorAll('.oeuvre-carte').forEach((carte) => {
        const id = Number(carte.dataset.id);
        carte.addEventListener('click', (e) => {
          if (e.target.closest('.btn-menu-oeuvre')) return;
          naviguer('oeuvre-fiche', { id });
        });
        carte.querySelector('.btn-menu-oeuvre').addEventListener('click', (e) => {
          e.stopPropagation();
          ouvrirMenuOeuvre(triees.find((o) => o.id === id), e.currentTarget);
        });
      });
    } else {
      conteneur.className = 'liste';
      conteneur.innerHTML = triees.map(ligneListe).join('');
      conteneur.querySelectorAll('.ligne-liste').forEach((btn) => {
        btn.addEventListener('click', () => naviguer('oeuvre-fiche', { id: Number(btn.dataset.id) }));
      });
    }
  }

  recherche.addEventListener('input', dessiner);

  dessiner();
  recherche.focus();
}
