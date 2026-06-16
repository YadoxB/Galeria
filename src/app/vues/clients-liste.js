import { naviguer } from '../router.js';
import { ech, sansAccents, initiales, pluriel, nomComplet } from '../commun.js';

export async function rendreClientsListe(contenu) {
  const clients = await window.api.clientsListe();

  contenu.innerHTML = `
    <div class="vue-liste">
      <div class="entete-liste">
        <h2>Clients</h2>
        <button class="btn-action btn-principal" id="btn-nouveau">+ Nouveau client</button>
      </div>
      <div class="barre-recherche">
        <input type="search" id="recherche" placeholder="Rechercher un client (nom, courriel, téléphone)..." autocomplete="off">
        <span class="compteur" id="compteur"></span>
      </div>
      <div class="liste" id="liste-clients"></div>
    </div>
  `;

  contenu.querySelector('#btn-nouveau').addEventListener('click', () =>
    naviguer('client-fiche', { nouveau: true })
  );

  const recherche = contenu.querySelector('#recherche');
  const liste = contenu.querySelector('#liste-clients');
  const compteur = contenu.querySelector('#compteur');

  function dessiner(filtre = '') {
    const f = sansAccents(filtre);
    const filtres = f
      ? clients.filter((c) =>
          sansAccents([c.prenom, c.nom, c.courriel, c.telephone, c.ville].filter(Boolean).join(' ')).includes(f)
        )
      : clients;

    compteur.textContent = pluriel(filtres.length, 'client');

    if (filtres.length === 0) {
      liste.innerHTML = `<p class="liste-vide">${clients.length === 0 ? 'Aucun client encore enregistré. Crée le premier avec « + Nouveau client ».' : 'Aucun client ne correspond.'}</p>`;
      return;
    }

    liste.innerHTML = filtres
      .map((c) => {
        const nom = nomComplet(c);
        return `
      <button class="ligne-liste" data-id="${c.id}">
        <div class="avatar"><span>${ech(initiales(nom))}</span></div>
        <div class="info">
          <p class="ligne-titre">${ech(nom)}</p>
          <p class="ligne-meta">
            ${c.courriel ? ech(c.courriel) : '<em>aucun courriel</em>'}
            ${c.telephone ? `&nbsp;&middot;&nbsp;${ech(c.telephone)}` : ''}
            ${c.ville ? `&nbsp;&middot;&nbsp;${ech(c.ville)}` : ''}
            ${c.nb_ventes > 0 ? `&nbsp;&middot;&nbsp;${pluriel(c.nb_ventes, 'vente')}` : ''}
          </p>
        </div>
        ${c.consentement_courriel ? `<span class="badge-statut statut-disponible" title="Consentement courriel">✉ OK</span>` : ''}
        <span class="chevron">&rsaquo;</span>
      </button>
    `;
      })
      .join('');

    liste.querySelectorAll('.ligne-liste').forEach((btn) => {
      btn.addEventListener('click', () => naviguer('client-fiche', { id: Number(btn.dataset.id) }));
    });
  }

  recherche.addEventListener('input', (e) => dessiner(e.target.value));
  dessiner('');
  recherche.focus();
}
