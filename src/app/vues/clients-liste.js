import { naviguer } from '../router.js';
import { ech, initiales, nomComplet, gabaritEntetePage, badgeArchive } from '../commun.js';
import {
  gabaritOutilsClients, monterOutilsClients, lignesAvecReperes, nomLigneClient, metaLigneClient,
} from '../clients-tri.js';

const CLE_PREF_ARCHIVES = 'clients-inclure-archives';

function lirePref(cle, defaut) {
  try { return localStorage.getItem(cle) || defaut; } catch { return defaut; }
}
function ecrirePref(cle, val) {
  try { localStorage.setItem(cle, val); } catch {}
}

export async function rendreClientsListe(contenu) {
  let inclureArchives = lirePref(CLE_PREF_ARCHIVES, '0') === '1';
  let clients = await window.api.clientsListe({ inclureArchives });

  contenu.innerHTML = `
    <div class="vue-liste">
      ${gabaritEntetePage({
        titre: 'Clients',
        placeholder: 'Rechercher un client (nom, courriel, téléphone)…',
        boutonAjouterLibelle: '+ Ajouter un client',
      })}
      ${gabaritOutilsClients()}
      <div class="liste" id="liste-clients"></div>
    </div>
  `;

  contenu.querySelector('#btn-ajouter').addEventListener('click', () =>
    naviguer('client-fiche', { nouveau: true })
  );

  const recherche = contenu.querySelector('#recherche');
  const liste = contenu.querySelector('#liste-clients');

  const outils = monterOutilsClients(contenu, {
    clients,
    archives: {
      coche: inclureArchives,
      surChange: async (coche) => {
        inclureArchives = coche;
        ecrirePref(CLE_PREF_ARCHIVES, inclureArchives ? '1' : '0');
        clients = await window.api.clientsListe({ inclureArchives });
        outils.remplacerClients(clients);
        dessiner();
      },
    },
    surChange: () => dessiner(),
  });

  function dessiner() {
    const { liste: filtres, tri } = outils.appliquer(recherche.value);

    if (filtres.length === 0) {
      outils.afficherAucun(liste, clients.length === 0 ? 'Aucun client encore enregistré. Crée le premier avec « + Ajouter un client ».' : 'Aucun client ne correspond.');
      return;
    }

    liste.innerHTML = lignesAvecReperes(filtres, tri, (c) => `
      <button class="ligne-liste${c.archive ? ' ligne-archivee' : ''}" data-id="${c.id}">
        <div class="avatar"><span>${ech(initiales(nomComplet(c)))}</span></div>
        <div class="info">
          <p class="ligne-titre">${nomLigneClient(c, tri)} ${c.archive ? badgeArchive() : ''}</p>
          <p class="ligne-meta">${metaLigneClient(c, tri, { avecVentes: true })}</p>
        </div>
        ${c.consentement_courriel ? `<span class="badge-statut statut-disponible" title="Consentement courriel">✉ OK</span>` : ''}
        <span class="chevron">&rsaquo;</span>
      </button>
    `);

    liste.querySelectorAll('.ligne-liste').forEach((btn) => {
      btn.addEventListener('click', () => naviguer('client-fiche', { id: Number(btn.dataset.id) }));
    });
  }

  recherche.addEventListener('input', () => dessiner());
  dessiner();
  recherche.focus();
}
