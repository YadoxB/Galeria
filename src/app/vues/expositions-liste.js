// Vue « Expositions » — liste des expositions, en cours d'abord.
// Une exposition = une sortie d'œuvres hors de la galerie (salon, exposition
// ailleurs, prêt). Les œuvres parties passent au statut « En exposition » et
// retrouvent leur statut d'origine à la clôture (voir exposition-fiche.js).

import { naviguer } from '../router.js';
import { ech, sansAccents, pluriel, formaterDate, gabaritEntetePage } from '../commun.js';
import { alerter } from '../dialogue.js';
import { nettoyerErreur } from '../commun.js';

export async function rendreExpositionsListe(contenu) {
  let expos = [];
  try {
    expos = await window.api.exposListe();
  } catch (err) {
    contenu.innerHTML = `<div class="vue-liste"><p class="liste-vide">${ech(nettoyerErreur(err))}</p></div>`;
    return;
  }

  contenu.innerHTML = `
    <div class="vue-liste">
      ${gabaritEntetePage({
        titre: 'Expositions',
        placeholder: 'Rechercher (nom, lieu)…',
        boutonAjouterLibelle: '+ Nouvelle exposition',
      })}
      <div class="barre-recherche">
        <span class="compteur" id="compteur"></span>
      </div>
      <div class="liste" id="liste-expos"></div>
    </div>
  `;

  contenu.querySelector('#btn-ajouter').addEventListener('click', () => nouvelleExposition());

  const recherche = contenu.querySelector('#recherche');
  const liste = contenu.querySelector('#liste-expos');
  const compteur = contenu.querySelector('#compteur');

  function periode(e) {
    const d = e.date_debut ? formaterDate(e.date_debut) : null;
    const f = e.date_fin_reelle || e.date_fin_prevue;
    const ff = f ? formaterDate(f) : null;
    if (d && ff) return `du ${d} au ${ff}`;
    if (d) return `depuis le ${d}`;
    if (ff) return `jusqu'au ${ff}`;
    return 'dates non précisées';
  }

  function carte(e) {
    const enCours = e.statut === 'en_cours';
    return `
      <button class="ligne-liste expo-ligne${enCours ? '' : ' expo-terminee'}" data-id="${e.id}">
        <div class="expo-compte">
          <span class="expo-compte-n">${e.nb_oeuvres}</span>
          <span class="expo-compte-l">${e.nb_oeuvres === 1 ? 'œuvre' : 'œuvres'}</span>
        </div>
        <div class="info">
          <p class="ligne-titre">${ech(e.nom)}
            <span class="badge-expo ${enCours ? 'badge-expo-encours' : 'badge-expo-terminee'}">${enCours ? 'En cours' : 'Terminée'}</span>
          </p>
          <p class="ligne-meta">
            ${e.lieu ? ech(e.lieu) : '<em>lieu non précisé</em>'}
            &nbsp;&middot;&nbsp; ${ech(periode(e))}
          </p>
        </div>
        <span class="chevron">&rsaquo;</span>
      </button>
    `;
  }

  function dessiner(filtre = '') {
    const f = sansAccents(filtre);
    const vues = expos.filter((e) =>
      !f || sansAccents([e.nom, e.lieu].filter(Boolean).join(' ')).includes(f));
    compteur.textContent = pluriel(vues.length, 'exposition');
    liste.innerHTML = vues.length
      ? vues.map(carte).join('')
      : `<p class="liste-vide">${expos.length
          ? 'Aucune exposition ne correspond à cette recherche.'
          : "Aucune exposition pour l'instant. Utilise « + Nouvelle exposition » pour en préparer une."}</p>`;
    liste.querySelectorAll('[data-id]').forEach((b) =>
      b.addEventListener('click', () => naviguer('exposition-fiche', { id: Number(b.dataset.id) })));
  }

  recherche.addEventListener('input', () => dessiner(recherche.value));
  dessiner();
}

// Création : une petite fenêtre plutôt qu'une page, car il n'y a que quatre
// champs et on enchaîne aussitôt sur le choix des œuvres.
export function nouvelleExposition() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay-modale overlay-dialogue';
  const aujourdHui = new Date().toISOString().slice(0, 10);
  overlay.innerHTML = `
    <div class="dialogue" role="dialog" aria-modal="true">
      <div class="dialogue-entete"><h3 class="dialogue-titre">Nouvelle exposition</h3></div>
      <p class="aide-champ">Le nom apparaîtra sur la fiche des œuvres parties, dans le champ « Exposition actuelle ».</p>
      <div class="form-champ">
        <label for="expo-nom">Nom <span class="requis">*</span></label>
        <input type="text" id="expo-nom" placeholder="Ex. Salon du printemps" autocomplete="off">
      </div>
      <div class="form-champ">
        <label for="expo-lieu">Lieu</label>
        <input type="text" id="expo-lieu" placeholder="Ex. Centre culturel Le Parvis, Sherbrooke" autocomplete="off">
      </div>
      <div class="grille-form">
        <div class="form-champ">
          <label for="expo-debut">Début</label>
          <input type="date" id="expo-debut" value="${aujourdHui}">
        </div>
        <div class="form-champ">
          <label for="expo-fin">Fin prévue</label>
          <input type="date" id="expo-fin">
        </div>
      </div>
      <div class="dialogue-actions">
        <button type="button" class="btn-action btn-secondaire-action" id="expo-annuler">Annuler</button>
        <button type="button" class="btn-action btn-principal" id="expo-creer">Créer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const fermer = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('#expo-annuler').addEventListener('click', fermer);

  const btn = overlay.querySelector('#expo-creer');
  btn.addEventListener('click', async () => {
    const nom = overlay.querySelector('#expo-nom').value.trim();
    if (!nom) {
      await alerter({ type: 'warning', title: 'Nom requis', message: "Donne un nom à l'exposition." });
      overlay.querySelector('#expo-nom').focus();
      return;
    }
    btn.disabled = true;
    try {
      const expo = await window.api.exposCreer({
        nom,
        lieu: overlay.querySelector('#expo-lieu').value.trim(),
        date_debut: overlay.querySelector('#expo-debut').value || null,
        date_fin_prevue: overlay.querySelector('#expo-fin').value || null,
      });
      fermer();
      naviguer('exposition-fiche', { id: expo.id });
    } catch (err) {
      btn.disabled = false;
      await alerter({ type: 'error', title: 'Création impossible', message: nettoyerErreur(err) });
    }
  });
  overlay.querySelector('#expo-nom').focus();
}
