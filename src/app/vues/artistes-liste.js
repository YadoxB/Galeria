import { naviguer } from '../router.js';
import { ech, sansAccents, initiales, pluriel, urlPhoto, nomComplet } from '../commun.js';

export async function rendreArtistesListe(contenu) {
  const artistes = await window.api.artistesListe();

  contenu.innerHTML = `
    <div class="vue-liste">
      <div class="entete-liste">
        <h2>Artistes</h2>
        <button class="btn-action btn-principal" id="btn-nouveau">+ Nouvel artiste</button>
      </div>
      <div class="barre-recherche">
        <input type="search" id="recherche" placeholder="Rechercher un artiste..." autocomplete="off">
        <span class="compteur" id="compteur"></span>
      </div>
      <div class="liste" id="liste-artistes"></div>
    </div>
  `;

  contenu.querySelector('#btn-nouveau').addEventListener('click', () =>
    naviguer('artiste-fiche', { nouveau: true })
  );

  const recherche = contenu.querySelector('#recherche');
  const liste = contenu.querySelector('#liste-artistes');
  const compteur = contenu.querySelector('#compteur');

  function dessiner(filtre = '') {
    const f = sansAccents(filtre);
    const filtres = f
      ? artistes.filter((a) => sansAccents([a.prenom, a.nom].filter(Boolean).join(' ')).includes(f))
      : artistes;
    compteur.textContent = pluriel(filtres.length, 'artiste');
    if (filtres.length === 0) {
      liste.innerHTML = `<p class="liste-vide">Aucun artiste ne correspond.</p>`;
      return;
    }
    liste.innerHTML = filtres
      .map((a) => {
        const nom = nomComplet(a) || a.nom || '';
        return `
      <button class="ligne-liste" data-id="${a.id}">
        ${a.photo_path
          ? `<div class="avatar avec-photo"><img src="${urlPhoto(a.photo_path)}" loading="lazy" alt=""></div>`
          : `<div class="avatar"><span>${ech(initiales(nom))}</span></div>`}
        <div class="info">
          <p class="ligne-titre">${ech(nom)}</p>
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
      })
      .join('');

    liste.querySelectorAll('.ligne-liste').forEach((btn) => {
      btn.addEventListener('click', () => naviguer('artiste-fiche', { id: Number(btn.dataset.id) }));
    });
  }

  recherche.addEventListener('input', (e) => dessiner(e.target.value));
  dessiner('');
  recherche.focus();
}
