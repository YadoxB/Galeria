import { naviguer } from '../router.js';
import { ech, sansAccents, initiales, pluriel, nomComplet, gabaritEntetePage, badgeArchive } from '../commun.js';

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
      <div class="controles-vue">
        <label class="case-archives">
          <input type="checkbox" id="case-archives" ${inclureArchives ? 'checked' : ''}>
          <span>Inclure les archivés</span>
        </label>
      </div>
      <div class="barre-recherche">
        <span class="compteur" id="compteur"></span>
      </div>
      <div class="liste" id="liste-clients"></div>
    </div>
  `;

  contenu.querySelector('#btn-ajouter').addEventListener('click', () =>
    naviguer('client-fiche', { nouveau: true })
  );

  const recherche = contenu.querySelector('#recherche');
  const liste = contenu.querySelector('#liste-clients');
  const compteur = contenu.querySelector('#compteur');

  contenu.querySelector('#case-archives').addEventListener('change', async (e) => {
    inclureArchives = e.target.checked;
    ecrirePref(CLE_PREF_ARCHIVES, inclureArchives ? '1' : '0');
    clients = await window.api.clientsListe({ inclureArchives });
    dessiner(recherche.value);
  });

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
      <button class="ligne-liste${c.archive ? ' ligne-archivee' : ''}" data-id="${c.id}">
        <div class="avatar"><span>${ech(initiales(nom))}</span></div>
        <div class="info">
          <p class="ligne-titre">${ech(nom)} ${c.archive ? badgeArchive() : ''}</p>
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
