import { naviguer } from '../router.js';
import {
  ech, sansAccents, initiales, pluriel, urlPhoto, nomComplet,
  gabaritEntetePage, badgeArchive,
} from '../commun.js';

const CLE_PREF_VUE = 'artistes-vue';
const CLE_PREF_TRI = 'artistes-tri';
const CLE_PREF_ARCHIVES = 'artistes-inclure-archives';

function lirePref(cle, defaut) {
  try { return localStorage.getItem(cle) || defaut; } catch { return defaut; }
}
function ecrirePref(cle, val) {
  try { localStorage.setItem(cle, val); } catch {}
}

function trier(artistes, tri) {
  const liste = [...artistes];
  const cmpStr = (a, b) => sansAccents(a || '').localeCompare(sansAccents(b || ''));
  switch (tri) {
    case 'nom-asc':       liste.sort((a, b) => cmpStr(nomComplet(a), nomComplet(b))); break;
    case 'oeuvres-desc':  liste.sort((a, b) => (b.nb_oeuvres || 0) - (a.nb_oeuvres || 0)); break;
    case 'oeuvres-asc':   liste.sort((a, b) => (a.nb_oeuvres || 0) - (b.nb_oeuvres || 0)); break;
    case 'plus-recentes':
    default:              liste.sort((a, b) => b.id - a.id); break;
  }
  return liste;
}

export async function rendreArtistesListe(contenu) {
  let inclureArchives = lirePref(CLE_PREF_ARCHIVES, '0') === '1';
  let artistes = await window.api.artistesListe({ inclureArchives });
  let vueCourante = lirePref(CLE_PREF_VUE, 'grille');
  let triCourant = lirePref(CLE_PREF_TRI, 'nom-asc');

  contenu.innerHTML = `
    <div class="vue-liste">
      ${gabaritEntetePage({
        titre: 'Artistes',
        placeholder: 'Rechercher un artiste…',
        boutonAjouterLibelle: '+ Ajouter un artiste',
      })}

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
        <div class="tri-deroulant">
          <label for="tri-artistes" class="tri-deroulant-libelle">Trier par</label>
          <select id="tri-artistes">
            <option value="nom-asc"       ${triCourant === 'nom-asc' ? 'selected' : ''}>Nom A→Z</option>
            <option value="plus-recentes" ${triCourant === 'plus-recentes' ? 'selected' : ''}>Plus récents</option>
            <option value="oeuvres-desc"  ${triCourant === 'oeuvres-desc' ? 'selected' : ''}>Plus d'œuvres</option>
            <option value="oeuvres-asc"   ${triCourant === 'oeuvres-asc' ? 'selected' : ''}>Moins d'œuvres</option>
          </select>
        </div>
        <label class="case-archives">
          <input type="checkbox" id="case-archives" ${inclureArchives ? 'checked' : ''}>
          <span>Inclure les archivés</span>
        </label>
      </div>

      <div class="barre-recherche">
        <span class="compteur" id="compteur"></span>
      </div>
      <div id="conteneur-artistes"></div>
    </div>
  `;

  const recherche = contenu.querySelector('#recherche');
  const conteneur = contenu.querySelector('#conteneur-artistes');
  const compteur = contenu.querySelector('#compteur');
  const btnVueGrille = contenu.querySelector('#btn-vue-grille');
  const btnVueListe = contenu.querySelector('#btn-vue-liste');
  const triSelect = contenu.querySelector('#tri-artistes');

  contenu.querySelector('#btn-ajouter').addEventListener('click', () =>
    naviguer('artiste-fiche', { nouveau: true })
  );

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
  contenu.querySelector('#case-archives').addEventListener('change', async (e) => {
    inclureArchives = e.target.checked;
    ecrirePref(CLE_PREF_ARCHIVES, inclureArchives ? '1' : '0');
    artistes = await window.api.artistesListe({ inclureArchives });
    dessiner();
  });

  function carteGrille(a) {
    const nom = nomComplet(a) || a.nom || '';
    return `
      <article class="oeuvre-carte artiste-carte${a.archive ? ' carte-archivee' : ''}" data-id="${a.id}">
        <div class="oeuvre-carte-image artiste-carte-image">
          ${a.photo_path
            ? `<img src="${urlPhoto(a.photo_path)}" loading="lazy" alt="">`
            : `<div class="artiste-carte-initiales"><span>${ech(initiales(nom))}</span></div>`}
        </div>
        <div class="oeuvre-carte-corps">
          <div class="oeuvre-carte-ligne-titre">
            <h3 class="oeuvre-carte-titre">${ech(nom)} ${a.archive ? badgeArchive() : ''}</h3>
          </div>
          <p class="oeuvre-carte-artiste">${a.type ? ech(a.type) : '<em>type non précisé</em>'}</p>
          <p class="oeuvre-carte-prix">${pluriel(a.nb_oeuvres, 'œuvre')}</p>
          ${a.prefixe_inventaire ? `<p class="oeuvre-carte-artiste">Préfixe ${ech(a.prefixe_inventaire)}</p>` : ''}
        </div>
      </article>
    `;
  }

  function ligneListe(a) {
    const nom = nomComplet(a) || a.nom || '';
    return `
      <button class="ligne-liste${a.archive ? ' ligne-archivee' : ''}" data-id="${a.id}">
        ${a.photo_path
          ? `<div class="avatar avec-photo"><img src="${urlPhoto(a.photo_path)}" loading="lazy" alt=""></div>`
          : `<div class="avatar"><span>${ech(initiales(nom))}</span></div>`}
        <div class="info">
          <p class="ligne-titre">${ech(nom)} ${a.archive ? badgeArchive() : ''}</p>
          <p class="ligne-meta">
            ${a.type ? ech(a.type) : '<em>type non précisé</em>'}
            &nbsp;&middot;&nbsp;
            ${pluriel(a.nb_oeuvres, 'œuvre')}
            ${a.prefixe_inventaire ? `&nbsp;&middot;&nbsp;Préfixe ${ech(a.prefixe_inventaire)}` : ''}
          </p>
        </div>
        <span class="chevron">&rsaquo;</span>
      </button>
    `;
  }

  function dessiner() {
    const f = sansAccents(recherche.value);
    const filtres = f
      ? artistes.filter((a) => sansAccents([a.prenom, a.nom, a.type, a.prefixe_inventaire].filter(Boolean).join(' ')).includes(f))
      : artistes;
    const triees = trier(filtres, triCourant);

    compteur.textContent = pluriel(triees.length, 'artiste');

    if (triees.length === 0) {
      conteneur.className = '';
      conteneur.innerHTML = `<p class="liste-vide">${artistes.length === 0 ? 'Aucun artiste encore enregistré. Crée le premier avec « + Ajouter un artiste ».' : 'Aucun artiste ne correspond.'}</p>`;
      return;
    }

    if (vueCourante === 'grille') {
      conteneur.className = 'grille-oeuvres';
      conteneur.innerHTML = triees.map(carteGrille).join('');
      conteneur.querySelectorAll('.artiste-carte').forEach((carte) => {
        carte.addEventListener('click', () => naviguer('artiste-fiche', { id: Number(carte.dataset.id) }));
      });
    } else {
      conteneur.className = 'liste';
      conteneur.innerHTML = triees.map(ligneListe).join('');
      conteneur.querySelectorAll('.ligne-liste').forEach((btn) => {
        btn.addEventListener('click', () => naviguer('artiste-fiche', { id: Number(btn.dataset.id) }));
      });
    }
  }

  recherche.addEventListener('input', dessiner);
  dessiner();
  recherche.focus();
}
