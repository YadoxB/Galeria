import { naviguer, retour, poserGardien, leverGardien, modifierParamsCourants, remplacerCourant } from '../router.js';
import {
  ech, initiales, pluriel,
  champTexte, champTextarea, champCheckbox,
  champPays, champSubdivision, brancherChangementPays,
  formaterPrix, formaterDate, formaterTelephone, nomComplet, urlPhoto,
} from '../commun.js';
import { confirmer } from '../dialogue.js';

const GABARIT_VIDE = {
  id: null,
  nom: '', prenom: null,
  numero_civique: null, rue: null, appartement: null,
  ville: null, province: null, code_postal: null, pays: 'Canada',
  adresse: null,
  courriel: null, telephone: null,
  consentement_courriel: 0, consentement_date: null,
  notes: null,
  nb_ventes: 0,
};

function dateAujourdhui() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function rendreClientFiche(contenu, params) {
  const estNouveau = !!params.nouveau;
  let c;
  let voisins = { precedent: null, suivant: null, position: null, total: 0 };

  let ventes = [];
  if (estNouveau) {
    c = { ...GABARIT_VIDE };
  } else {
    [c, voisins, ventes] = await Promise.all([
      window.api.clientGet(params.id),
      window.api.clientVoisins(params.id),
      window.api.clientVentes(params.id),
    ]);
    if (!c) {
      contenu.innerHTML = `<p class="erreur">Client introuvable.</p>`;
      return;
    }
  }

  let mode = estNouveau ? 'edition' : 'lecture';
  let modifie = false;
  let nouveau = estNouveau;

  if (nouveau) poserGardien(gardienChangements);

  async function gardienChangements() {
    if (!modifie && !nouveau) return true;
    const reponse = await confirmer({
      type: 'warning',
      title: nouveau ? 'Abandonner ce client ?' : 'Modifications non sauvegardées',
      message: nouveau
        ? "Ce client n'a pas été enregistré. Voulez-vous l'abandonner ?"
        : 'Voulez-vous abandonner les modifications en cours ?',
      buttons: ['Abandonner', nouveau ? 'Continuer la saisie' : 'Rester sur la fiche'],
      defaultId: 1, cancelId: 1,
    });
    return reponse === 0;
  }

  function entrerEdition() {
    mode = 'edition';
    modifie = false;
    poserGardien(gardienChangements);
    dessiner();
  }

  function sortirEdition() {
    mode = 'lecture';
    modifie = false;
    nouveau = false;
    leverGardien();
    dessiner();
  }

  async function supprimer() {
    if (c.nb_ventes > 0) {
      await confirmer({
        type: 'error', title: 'Impossible de supprimer',
        message: `« ${c.nom} » est lié à ${pluriel(c.nb_ventes, 'vente')} enregistrée(s).`,
        detail: 'Pour des raisons comptables, on ne supprime pas un client qui a un historique de ventes. Tu peux le faire directement en base si nécessaire (avec sauvegarde au préalable).',
        buttons: ['OK'],
      });
      return;
    }
    const reponse = await confirmer({
      type: 'warning', title: 'Supprimer ce client ?',
      message: `Supprimer définitivement « ${c.nom} » ?`,
      detail: 'Cette action est irréversible. Conforme à la Loi 25 — tu peux restaurer depuis une sauvegarde si besoin.',
      buttons: ['Supprimer', 'Annuler'],
      defaultId: 1, cancelId: 1,
    });
    if (reponse !== 0) return;
    try {
      await window.api.clientSupprimer(c.id);
      leverGardien();
      retour();
    } catch (err) {
      await confirmer({
        type: 'error', title: 'Suppression échouée',
        message: err.message, buttons: ['OK'],
      });
    }
  }

  function dessiner() {
    mode === 'lecture' ? dessinerLecture() : dessinerEdition();
  }

  function dessinerLecture() {
    const champ = (libelle, valeur) =>
      valeur != null && valeur !== ''
        ? `<div class="champ"><dt>${ech(libelle)}</dt><dd>${ech(valeur).replace(/\n/g, '<br>')}</dd></div>`
        : '';

    const blocPliable = (titre, contenuInterne, ouvertParDefaut = true) =>
      `<details class="bloc pliable" ${ouvertParDefaut ? 'open' : ''}>
         <summary><h3>${ech(titre)}</h3><span class="chevron-bloc">&rsaquo;</span></summary>
         <div class="bloc-corps">${contenuInterne}</div>
       </details>`;

    const adresseAffichee = (() => {
      const ligne1 = [
        [c.numero_civique, c.rue].filter(Boolean).join(' '),
        c.appartement ? `app. ${c.appartement}` : '',
      ].filter(Boolean).join(', ');
      const ligne2 = [c.ville, c.province, c.code_postal].filter(Boolean).join(', ');
      const ligne3 = c.pays;
      const lignes = [ligne1, ligne2, ligne3].filter((x) => x && x.trim());
      if (lignes.length > 0) return lignes.join('<br>');
      return c.adresse ? ech(c.adresse).replace(/\n/g, '<br>') : '';
    })();

    const lignesContact = [
      champ('Courriel', c.courriel),
      champ('Téléphone', c.telephone),
      adresseAffichee ? `<div class="champ"><dt>Adresse</dt><dd>${adresseAffichee}</dd></div>` : '',
    ].join('');

    const lignesConsentement = [
      champ('Consentement courriel', c.consentement_courriel ? 'Oui' : 'Non'),
      c.consentement_courriel ? champ('Date du consentement', formaterDate(c.consentement_date)) : '',
    ].join('');

    const totalAchats = ventes.reduce(
      (s, v) => s + (Number(v.prix_vente) || 0) + (Number(v.tps) || 0) + (Number(v.tvq) || 0),
      0,
    );

    const historiqueContenu = ventes.length === 0
      ? `<p class="liste-vide">Aucune vente enregistrée pour ce client. L'historique se remplira automatiquement quand tu enregistreras des ventes (Phase&nbsp;3B) ou que tu importeras les ventes depuis Sage&nbsp;50 (Phase&nbsp;4).</p>`
      : `
        <div class="historique-ventes">
          ${ventes.map((v) => `
            <button class="ligne-vente" data-oeuvre-id="${v.oeuvre_id}">
              ${v.image_path
                ? `<div class="vignette avec-photo"><img src="${urlPhoto(v.image_path)}" loading="lazy" alt=""></div>`
                : `<div class="vignette"><span>&#9635;</span></div>`}
              <div class="info">
                <p class="ligne-titre">${ech(v.oeuvre_titre)}</p>
                <p class="ligne-meta">
                  ${ech(v.artiste_nom)}
                  ${v.numero_inventaire ? `&nbsp;&middot;&nbsp;${ech(v.numero_inventaire)}` : ''}
                  &nbsp;&middot;&nbsp;${formaterDate(v.date_vente)}
                  ${v.mode_paiement ? `&nbsp;&middot;&nbsp;${ech(v.mode_paiement)}` : ''}
                  ${v.numero_facture ? `&nbsp;&middot;&nbsp;Facture ${ech(v.numero_facture)}` : ''}
                </p>
              </div>
              <div class="prix">${formaterPrix((Number(v.prix_vente) || 0) + (Number(v.tps) || 0) + (Number(v.tvq) || 0))}</div>
              <span class="chevron">&rsaquo;</span>
            </button>
          `).join('')}
        </div>
        <p class="total-achats">Total des achats : <strong>${formaterPrix(totalAchats)}</strong> (${pluriel(ventes.length, 'vente')})</p>
      `;

    const navVoisins = voisins.total > 1 ? `
      <nav class="nav-voisins" aria-label="Navigation entre clients">
        <button class="btn-voisin btn-voisin-prec" ${voisins.precedent ? '' : 'disabled'} title="${voisins.precedent ? ech(voisins.precedent.nom) : ''}">
          <span class="fleche">&larr;</span>
          <span class="libelle-voisin">
            <span class="libelle-mini">Précédent</span>
            <span class="nom-voisin">${voisins.precedent ? ech(voisins.precedent.nom) : '—'}</span>
          </span>
        </button>
        <span class="position-voisin">${voisins.position} / ${voisins.total}</span>
        <button class="btn-voisin btn-voisin-suiv" ${voisins.suivant ? '' : 'disabled'} title="${voisins.suivant ? ech(voisins.suivant.nom) : ''}">
          <span class="libelle-voisin libelle-droite">
            <span class="libelle-mini">Suivant</span>
            <span class="nom-voisin">${voisins.suivant ? ech(voisins.suivant.nom) : '—'}</span>
          </span>
          <span class="fleche">&rarr;</span>
        </button>
      </nav>
    ` : '';

    contenu.innerHTML = `
      <div class="vue-fiche">
        <div class="entete-fiche">
          <div class="avatar grand"><span>${ech(initiales(nomComplet(c)))}</span></div>
          <div class="entete-fiche-info">
            <h2>${ech(nomComplet(c))}</h2>
            <p class="meta">
              ${c.nb_ventes > 0 ? pluriel(c.nb_ventes, 'vente') + ' enregistrée(s)' : '<em>aucune vente enregistrée</em>'}
            </p>
          </div>
          <div class="entete-fiche-actions">
            <button class="btn-action btn-danger" id="btn-supprimer">Supprimer</button>
            <button class="btn-action" id="btn-modifier">Modifier</button>
          </div>
        </div>

        ${navVoisins}

        ${lignesContact ? blocPliable('Coordonnées', `<dl class="champs">${lignesContact}</dl>`) : ''}
        ${blocPliable("Historique d'achat", historiqueContenu, ventes.length > 0)}
        ${lignesConsentement ? blocPliable('Consentement courriel (Loi 25)', `<dl class="champs">${lignesConsentement}</dl>`) : ''}
        ${c.notes ? blocPliable('Notes', `<p class="texte-long">${ech(c.notes).replace(/\n/g, '<br>')}</p>`) : ''}
      </div>
    `;

    contenu.querySelector('#btn-modifier').addEventListener('click', entrerEdition);
    contenu.querySelector('#btn-supprimer').addEventListener('click', supprimer);
    contenu.querySelectorAll('.ligne-vente').forEach((btn) => {
      btn.addEventListener('click', () =>
        naviguer('oeuvre-fiche', { id: Number(btn.dataset.oeuvreId) })
      );
    });
    contenu.querySelectorAll('.btn-voisin-prec').forEach((btn) => {
      if (voisins.precedent) {
        btn.addEventListener('click', () =>
          remplacerCourant('client-fiche', { id: voisins.precedent.id })
        );
      }
    });
    contenu.querySelectorAll('.btn-voisin-suiv').forEach((btn) => {
      if (voisins.suivant) {
        btn.addEventListener('click', () =>
          remplacerCourant('client-fiche', { id: voisins.suivant.id })
        );
      }
    });
  }

  function dessinerEdition() {
    const titrePage = nouveau ? 'Nouveau client' : `Modifier « ${ech(nomComplet(c))} »`;

    contenu.innerHTML = `
      <div class="vue-fiche">
        <h2 class="titre-formulaire">${titrePage}</h2>
        <form id="formulaire" class="formulaire" novalidate>
          <section class="bloc">
            <h3>Identité</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'prenom', libelle: 'Prénom', valeur: c.prenom })}
              ${champTexte({ nom: 'nom', libelle: 'Nom de famille', valeur: c.nom, requis: true })}
            </div>
          </section>

          <section class="bloc">
            <h3>Coordonnées</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'courriel', libelle: 'Courriel', valeur: c.courriel, type: 'email' })}
              ${champTexte({ nom: 'telephone', libelle: 'Téléphone', valeur: c.telephone, type: 'tel', attributs: 'inputmode="tel" placeholder="(xxx) xxx-xxxx"' })}
            </div>
          </section>

          <section class="bloc">
            <h3>Adresse</h3>
            <div class="grille-form grille-adresse-1">
              ${champTexte({ nom: 'numero_civique', libelle: 'Numéro civique', valeur: c.numero_civique })}
              ${champTexte({ nom: 'rue', libelle: 'Rue', valeur: c.rue })}
              ${champTexte({ nom: 'appartement', libelle: 'Appartement / unité', valeur: c.appartement })}
            </div>
            <div class="grille-form">
              ${champTexte({ nom: 'ville', libelle: 'Ville', valeur: c.ville })}
              ${champPays({ nom: 'pays', valeur: c.pays || 'Canada' })}
              <div id="zone-province-client">
                ${champSubdivision({ nom: 'province', pays: c.pays || 'Canada', valeur: c.province })}
              </div>
              ${champTexte({ nom: 'code_postal', libelle: 'Code postal', valeur: c.code_postal, attributs: 'maxlength="10" placeholder="H0H 0H0"' })}
            </div>
            ${c.adresse ? `<p class="aide-champ">Adresse héritée (texte libre, non séparée) : <em>${ech(c.adresse)}</em>. Tu peux la copier dans les champs ci-dessus et l'effacer après en éditant le champ caché.</p>` : ''}
          </section>

          <section class="bloc">
            <h3>Consentement courriel (Loi 25)</h3>
            <p class="aide-champ">Coche seulement si le client a explicitement consenti à recevoir des courriels (invitations vernissages, etc.). La date se remplit automatiquement à aujourd'hui si tu la laisses vide.</p>
            ${champCheckbox({ nom: 'consentement_courriel', libelle: 'Le client consent à recevoir des courriels', valeur: !!c.consentement_courriel })}
            ${champTexte({ nom: 'consentement_date', libelle: 'Date du consentement', valeur: c.consentement_date, type: 'date' })}
          </section>

          <section class="bloc">
            <h3>Notes</h3>
            ${champTextarea({ nom: 'notes', libelle: 'Notes internes', valeur: c.notes, lignes: 3 })}
          </section>

          <div class="form-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler">Annuler</button>
            <button type="submit" class="btn-action btn-principal">${nouveau ? 'Créer' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    `;

    const form = contenu.querySelector('#formulaire');
    form.addEventListener('input', () => { modifie = true; });
    form.addEventListener('change', () => { modifie = true; });

    // Reformater la valeur héritée (le listener délégué d'app.js gère la frappe)
    const telInput = form.elements.telephone;
    if (telInput) telInput.value = formaterTelephone(telInput.value);

    brancherChangementPays(form, { paysNom: 'pays', subNom: 'province', subZoneId: 'zone-province-client' });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);
      data.consentement_courriel = form.elements.consentement_courriel.checked;
      if (data.consentement_courriel && !data.consentement_date) {
        data.consentement_date = dateAujourdhui();
      }
      data.adresse = c.adresse;

      try {
        if (nouveau) {
          c = await window.api.clientCreer(data);
          modifierParamsCourants({ id: c.id, nouveau: false });
        } else {
          c = await window.api.clientModifier(c.id, data);
        }
        sortirEdition();
      } catch (err) {
        await confirmer({
          type: 'error', title: "Impossible d'enregistrer",
          message: err.message, buttons: ['OK'],
        });
      }
    });

    contenu.querySelector('#btn-annuler').addEventListener('click', async () => {
      if (modifie || nouveau) {
        const reponse = await confirmer({
          type: 'warning',
          title: nouveau ? 'Abandonner ce nouveau client ?' : 'Abandonner les modifications ?',
          message: nouveau ? 'Les informations saisies seront perdues.' : 'Les modifications en cours seront perdues.',
          buttons: ['Abandonner', nouveau ? 'Continuer la saisie' : 'Continuer à modifier'],
          defaultId: 1, cancelId: 1,
        });
        if (reponse !== 0) return;
      }
      leverGardien();
      if (nouveau) {
        retour();
      } else {
        sortirEdition();
      }
    });
  }

  dessiner();
}
