import { naviguer } from '../router.js';
import { ech, sansAccents, formaterPrix, badgeStatut, pluriel, STATUTS, urlPhoto } from '../commun.js';

export async function rendreOeuvresListe(contenu, params = {}) {
  const filtres = {};
  if (params.artiste_id != null) filtres.artiste_id = params.artiste_id;

  const [oeuvres, artistes, types] = await Promise.all([
    window.api.oeuvresListe(filtres),
    window.api.artistesListe(),
    window.api.oeuvresTypes(),
  ]);

  const filtreActif = params.artiste_id != null
    ? `<div class="filtre-actif">
         <span>Œuvres de <strong>${ech(params.artiste_nom || 'cet artiste')}</strong></span>
         <button class="btn-lien" id="btn-tout-voir">Voir toutes les œuvres</button>
       </div>`
    : '';

  contenu.innerHTML = `
    <div class="vue-liste">
      <div class="entete-liste">
        <h2>${params.artiste_id != null ? `Œuvres de ${ech(params.artiste_nom || 'cet artiste')}` : 'Œuvres'}</h2>
        <button class="btn-action btn-principal" id="btn-nouveau">+ Nouvelle œuvre</button>
      </div>
      ${filtreActif}
      <div class="barre-recherche">
        <input type="search" id="recherche" placeholder="Rechercher (titre, artiste, inventaire)..." autocomplete="off">
        ${params.artiste_id == null ? `
          <select id="filtre-artiste">
            <option value="">Tous les artistes</option>
            ${artistes.map((a) => `<option value="${a.id}">${ech(a.nom)}</option>`).join('')}
          </select>
        ` : ''}
        <select id="filtre-type">
          <option value="">Tous les types</option>
          ${types.map((t) => `<option value="${ech(t)}">${ech(t)}</option>`).join('')}
        </select>
        <span class="compteur" id="compteur"></span>
      </div>
      <div class="groupe-statuts" id="filtres-statut" role="group" aria-label="Filtrer par statut">
        <span class="etiquette-groupe">Statuts :</span>
        ${Object.entries(STATUTS).map(([k, v]) => `
          <label class="chip-statut">
            <input type="checkbox" value="${k}">
            <span class="chip-libelle badge-statut ${v.classe}">${ech(v.libelle)}</span>
          </label>
        `).join('')}
      </div>
      <div class="liste" id="liste-oeuvres"></div>
    </div>
  `;

  const recherche = contenu.querySelector('#recherche');
  const cochesStatut = Array.from(contenu.querySelectorAll('#filtres-statut input[type="checkbox"]'));
  const filtreArtiste = contenu.querySelector('#filtre-artiste');
  const filtreType = contenu.querySelector('#filtre-type');
  const liste = contenu.querySelector('#liste-oeuvres');
  const compteur = contenu.querySelector('#compteur');
  const btnToutVoir = contenu.querySelector('#btn-tout-voir');
  if (btnToutVoir) btnToutVoir.addEventListener('click', () => naviguer('oeuvres-liste'));

  contenu.querySelector('#btn-nouveau').addEventListener('click', () => {
    const p = { nouveau: true };
    if (params.artiste_id != null) p.artiste_id = params.artiste_id;
    naviguer('oeuvre-fiche', p);
  });

  function dessiner() {
    const motRecherche = sansAccents(recherche.value);
    const statutsActifs = cochesStatut.filter((c) => c.checked).map((c) => c.value);
    const artisteId = filtreArtiste ? filtreArtiste.value : '';
    const type = filtreType.value;

    const filtres = oeuvres.filter((o) => {
      if (statutsActifs.length > 0 && !statutsActifs.includes(o.statut)) return false;
      if (artisteId && String(o.artiste_id) !== artisteId) return false;
      if (type && o.type !== type) return false;
      if (motRecherche) {
        const cible = sansAccents(
          [o.titre, o.artiste_nom, o.numero_inventaire, o.numero_delivrance].filter(Boolean).join(' ')
        );
        if (!cible.includes(motRecherche)) return false;
      }
      return true;
    });

    compteur.textContent = pluriel(filtres.length, 'œuvre');

    if (filtres.length === 0) {
      liste.innerHTML = `<p class="liste-vide">Aucune œuvre ne correspond.</p>`;
      return;
    }

    liste.innerHTML = filtres
      .map(
        (o) => `
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
    `,
      )
      .join('');

    liste.querySelectorAll('.ligne-liste').forEach((btn) => {
      btn.addEventListener('click', () => naviguer('oeuvre-fiche', { id: Number(btn.dataset.id) }));
    });
  }

  [recherche, filtreType].forEach((el) =>
    el.addEventListener('input', dessiner)
  );
  if (filtreArtiste) filtreArtiste.addEventListener('input', dessiner);
  cochesStatut.forEach((c) => c.addEventListener('change', dessiner));

  dessiner();
  recherche.focus();
}
