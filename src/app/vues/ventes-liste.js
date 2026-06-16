import { naviguer } from '../router.js';
import { ech, sansAccents, pluriel, formaterPrix, formaterDate, nomComplet, urlPhoto } from '../commun.js';

export async function rendreVentesListe(contenu) {
  const ventes = await window.api.ventesListe();

  contenu.innerHTML = `
    <div class="vue-liste">
      <div class="entete-liste">
        <h2>Ventes</h2>
        <button class="btn-action btn-principal" id="btn-nouvelle">+ Nouvelle vente</button>
      </div>
      <div class="barre-recherche">
        <input type="search" id="recherche" placeholder="Rechercher (œuvre, artiste, client, n° facture)..." autocomplete="off">
        <span class="compteur" id="compteur"></span>
      </div>
      <div class="liste" id="liste-ventes"></div>
    </div>
  `;

  contenu.querySelector('#btn-nouvelle').addEventListener('click', () =>
    naviguer('vente-fiche', { nouveau: true })
  );

  const recherche = contenu.querySelector('#recherche');
  const liste = contenu.querySelector('#liste-ventes');
  const compteur = contenu.querySelector('#compteur');

  function dessiner(filtre = '') {
    const f = sansAccents(filtre);
    const filtres = f
      ? ventes.filter((v) => {
          const client = nomComplet({ prenom: v.client_prenom, nom: v.client_nom });
          return sansAccents([
            v.oeuvre_titre, v.artiste_nom, client,
            v.numero_facture, v.numero_inventaire, v.mode_paiement,
          ].filter(Boolean).join(' ')).includes(f);
        })
      : ventes;

    compteur.textContent = pluriel(filtres.length, 'vente');

    if (filtres.length === 0) {
      liste.innerHTML = `<p class="liste-vide">${
        ventes.length === 0
          ? 'Aucune vente enregistrée. Crée la première avec « + Nouvelle vente ».'
          : 'Aucune vente ne correspond à la recherche.'
      }</p>`;
      return;
    }

    liste.innerHTML = filtres
      .map((v) => {
        const client = nomComplet({ prenom: v.client_prenom, nom: v.client_nom });
        const total = (Number(v.prix_vente) || 0) + (Number(v.tps) || 0) + (Number(v.tvq) || 0);
        return `
          <button class="ligne-vente" data-id="${v.id}">
            ${v.image_path
              ? `<div class="vignette avec-photo"><img src="${urlPhoto(v.image_path)}" loading="lazy" alt=""></div>`
              : `<div class="vignette"><span>&#9635;</span></div>`}
            <div class="info">
              <p class="ligne-titre">${ech(v.oeuvre_titre)}</p>
              <p class="ligne-meta">
                ${ech(v.artiste_nom)}
                ${v.numero_inventaire ? `&nbsp;&middot;&nbsp;${ech(v.numero_inventaire)}` : ''}
                &nbsp;&middot;&nbsp;${ech(client)}
                &nbsp;&middot;&nbsp;${formaterDate(v.date_vente)}
                ${v.numero_facture ? `&nbsp;&middot;&nbsp;Facture ${ech(v.numero_facture)}` : ''}
              </p>
            </div>
            <div class="prix">${formaterPrix(total)}</div>
            <span class="chevron">&rsaquo;</span>
          </button>
        `;
      })
      .join('');

    liste.querySelectorAll('.ligne-vente').forEach((btn) => {
      btn.addEventListener('click', () => naviguer('vente-fiche', { id: Number(btn.dataset.id) }));
    });
  }

  recherche.addEventListener('input', (e) => dessiner(e.target.value));
  dessiner('');
  recherche.focus();
}
