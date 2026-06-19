import { naviguer, retour, poserGardien, leverGardien, modifierParamsCourants, remplacerCourant } from '../router.js';
import {
  ech, initiales, pluriel,
  champTexte, champTextarea, champCheckbox, datalist,
  brancherDropdownMedium, chargerMediumsConnus,
  champPays, champSubdivision, brancherChangementPays,
  parserNumerosTaxes, urlPhoto, sansAccents, nomComplet,
  badgeArchive, boutonArchive, basculerArchive, nettoyerErreur,
} from '../commun.js';
import { parserCotes, TAILLES_COTES, formaterMontant } from '../calcul-prix.js';
import { ouvrirAnnexeModale } from '../annexe.js';
import { recadrerCarre } from '../recadrage.js';
import { visionner } from '../visionneuse.js';
import { confirmer } from '../dialogue.js';

const TYPES_ARTISTE = ['Peintre', 'Sculpteur', 'Photographe', 'Graveur', 'Illustrateur'];
const LANGUES = ['Français', 'Anglais', 'Bilingue'];
const ETIQUETTES_TAXES_COURANTES = ['TPS', 'TVQ', 'TVH', 'TPS/TVH'];

const GABARIT_VIDE = {
  id: null,
  nom: '',
  type: null, prefixe_inventaire: null,
  biographie: null, demarche: null, curriculum: null,
  courriel: null, telephone: null, adresse: null,
  pays: 'Canada', province: null, langue: null,
  percoit_taxes: 0, numeros_taxes: null,
  photo_path: null,
  photo_originale_path: null,
  notes: null,
  instructions_ia: null,
  lien_chatgpt: null,
  cotes: null,
  nb_oeuvres: 0,
};

export async function rendreArtisteFiche(contenu, params) {
  const estNouveau = !!params.nouveau;
  let a;
  let voisins = { precedent: null, suivant: null, position: null, total: 0 };

  // Liste des médiums : fusion de la base existante et de la liste par défaut.
  // On charge en plus les médiums propres à CET artiste pour les mettre en
  // tête du dropdown (très visible).
  const mediumsConnus = await chargerMediumsConnus();
  let mediumsArtiste = [];
  if (!estNouveau) {
    try {
      mediumsArtiste = await window.api.oeuvresMediumsArtiste(params.id);
    } catch { mediumsArtiste = []; }
  }

  let stats = { catalogue: 0, disponibles: 0, valeurDispo: 0, ventes: 0 };
  let apercu = [];

  if (estNouveau) {
    a = { ...GABARIT_VIDE };
  } else {
    const bundle = await window.api.artisteFicheBundle(params.id);
    if (!bundle) {
      contenu.innerHTML = `<p class="erreur">Artiste introuvable.</p>`;
      return;
    }
    a = bundle.artiste;
    voisins = bundle.voisins;
    stats = bundle.stats;
    apercu = bundle.apercu;
  }

  async function rechargerBundle() {
    if (!a || !a.id) return;
    const bundle = await window.api.artisteFicheBundle(a.id);
    if (bundle) {
      a = bundle.artiste;
      voisins = bundle.voisins;
      stats = bundle.stats;
      apercu = bundle.apercu;
    }
  }

  let mode = estNouveau ? 'edition' : 'lecture';
  let modifie = false;
  let nouveau = estNouveau;
  let photoPendingDataUrl = null;        // dataUrl déjà recadrée carrée
  let photoPendingOriginaleDataUrl = null; // dataUrl originale pleine résolution

  if (nouveau) poserGardien(gardienChangements);

  async function gardienChangements() {
    if (!modifie && !nouveau) return true;
    const reponse = await confirmer({
      type: 'warning',
      title: nouveau ? 'Abandonner cet artiste ?' : 'Modifications non sauvegardées',
      message: nouveau
        ? 'Cet artiste n\'a pas été enregistré. Voulez-vous l\'abandonner ?'
        : 'Voulez-vous abandonner les modifications en cours ?',
      buttons: ['Abandonner', nouveau ? 'Continuer la saisie' : 'Rester sur la fiche'],
      defaultId: 1,
      cancelId: 1,
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
    const nomA = nomComplet(a) || a.nom || '';
    if (a.nb_oeuvres > 0) {
      await confirmer({
        type: 'error',
        title: 'Impossible de supprimer',
        message: `« ${nomA} » est lié à ${pluriel(a.nb_oeuvres, 'œuvre')} dans le catalogue.`,
        detail: "Tu dois d'abord supprimer ou réattribuer ces œuvres avant de pouvoir supprimer l'artiste.",
        buttons: ['OK'],
      });
      return;
    }
    const reponse = await confirmer({
      type: 'warning',
      title: 'Supprimer cet artiste ?',
      message: `Supprimer définitivement « ${nomA} » ?`,
      detail: 'Cette action est irréversible. Tu peux retrouver une version antérieure dans les sauvegardes si besoin.',
      buttons: ['Supprimer', 'Annuler'],
      defaultId: 1,
      cancelId: 1,
    });
    if (reponse !== 0) return;
    try {
      await window.api.artisteSupprimer(a.id);
      leverGardien();
      retour();
    } catch (err) {
      await confirmer({
        type: 'error',
        title: 'Suppression échouée',
        message: nettoyerErreur(err),
        buttons: ['OK'],
      });
    }
  }

  function dessiner() {
    mode === 'lecture' ? dessinerLecture() : dessinerEdition();
  }

  function dessinerLecture() {
    const nomCompletA = nomComplet(a) || a.nom || '';

    // === Photo (carrée, grande) ===
    const photoHtml = a.photo_path
      ? `<div class="zone-photo avec-photo cliquable" id="avatar-vision" title="Voir en grand">
           ${a.archive ? `<span class="badge-archive-photo">Archivée</span>` : ''}
           <img src="${urlPhoto(a.photo_path)}" alt="${ech(nomCompletA)}">
         </div>`
      : `<div class="zone-photo">
           ${a.archive ? `<span class="badge-archive-photo">Archivée</span>` : ''}
           <span class="zone-photo-initiales">${ech(initiales(nomCompletA))}</span>
         </div>`;

    // === Identité (titre + meta + actions) ===
    const zoneIdentite = `
      <div class="carte zone-identite">
        <div class="zone-identite-titre">
          <h1>${ech(nomCompletA)}</h1>
          <p class="zone-identite-meta">
            ${a.type ? ech(a.type) : '<em>type non précisé</em>'}
            ${a.prefixe_inventaire ? ` &middot; Préfixe ${ech(a.prefixe_inventaire)}` : ''}
            &middot; ${pluriel(a.nb_oeuvres, 'œuvre')} au catalogue
          </p>
        </div>
        <div class="zone-identite-bas">
          <div class="zone-identite-actions">
            <button class="btn-action btn-danger" id="btn-supprimer">Supprimer</button>
            ${boutonArchive({ archive: a.archive })}
            <button class="btn-action btn-principal" id="btn-modifier">Modifier</button>
          </div>
          <div class="zone-identite-docs">
            <span class="zone-docs-label">Documents</span>
            <button class="btn-action btn-secondaire" id="btn-presentation-pdf">Présentation PDF</button>
            <button class="btn-action btn-secondaire" id="btn-catalogue-pdf">Catalogue PDF</button>
            <button class="btn-action btn-secondaire" id="btn-annexe">Annexe A…</button>
          </div>
        </div>
      </div>
    `;

    // === Stats (4 mini-cartes, dont 1 navy pour Disponibles) ===
    const zoneStats = `
      <div class="zone-stats">
        <div class="stat-bento">
          <span class="stat-bento-label">Au catalogue</span>
          <span class="stat-bento-val">${stats.catalogue}</span>
        </div>
        <div class="stat-bento stat-bento-navy">
          <span class="stat-bento-label">Disponibles</span>
          <span class="stat-bento-val">${stats.disponibles}</span>
        </div>
        <div class="stat-bento">
          <span class="stat-bento-label">Ventes</span>
          <span class="stat-bento-val">${stats.ventes}</span>
        </div>
        <div class="stat-bento">
          <span class="stat-bento-label">Valeur dispo</span>
          <span class="stat-bento-val stat-bento-val-money">${formaterMontant(stats.valeurDispo)}</span>
        </div>
      </div>
    `;

    // === Présentation (onglets Biographie / Démarche / Curriculum) ===
    const onglets = [
      { cle: 'bio', titre: 'Biographie', contenu: a.biographie },
      { cle: 'dem', titre: 'Démarche',  contenu: a.demarche },
      { cle: 'cur', titre: 'Curriculum', contenu: a.curriculum },
    ];
    const cleActive = (onglets.find((o) => o.contenu) || onglets[0]).cle;
    const tetes = onglets.map((o) =>
      `<button type="button" class="onglet-bento ${o.cle === cleActive ? 'actif' : ''}" data-onglet="${o.cle}">${o.titre}</button>`
    ).join('');
    const corpsOnglets = onglets.map((o) => {
      const cache = o.cle !== cleActive ? 'style="display:none;"' : '';
      if (o.contenu) {
        return `<div class="onglet-corps" data-corps="${o.cle}" ${cache}>${ech(o.contenu).replace(/\n/g, '<br>')}</div>`;
      }
      return `<div class="onglet-corps onglet-corps-vide" data-corps="${o.cle}" ${cache}>Aucune ${o.titre.toLowerCase()} renseignée.</div>`;
    }).join('');
    const zonePresentation = `
      <div class="carte carte-presentation">
        <div class="onglets-bento">${tetes}</div>
        ${corpsOnglets}
      </div>
    `;

    // === Conditions galerie (Cotes + Fiscalité) ===
    const cotesA = parserCotes(a.cotes);
    let sousCotes;
    if (cotesA.length === 0) {
      sousCotes = `<div class="sous-section-ligne sous-section-vide">Pas de cote configurée</div>`;
    } else {
      const lignesCotes = cotesA.map((c) => {
        const cible = (c.medium === 'Tous' && c.taille === 'Tous')
          ? 'Toutes œuvres'
          : `${ech(c.medium)}${c.taille !== 'Tous' ? ` &middot; ${ech(c.taille)}` : ''}`;
        const uniteLib = c.unite === 'carre' ? '$/po²' : '$/po lin';
        return `
          <tr>
            <td class="cote-cible">${cible}</td>
            <td class="cote-prix">${formaterMontant(c.prix_pref)}</td>
            <td class="cote-unite">${uniteLib}</td>
          </tr>
        `;
      }).join('');
      sousCotes = `
        <table class="cotes-table">
          <thead><tr><th>Cible</th><th>Préférentiel</th><th>Unité</th></tr></thead>
          <tbody>${lignesCotes}</tbody>
        </table>
        <p class="cotes-note">Le prix courant ajoute automatiquement <strong>+2 $/unité</strong> (encadrement).</p>
      `;
    }

    const taxes = parserNumerosTaxes(a.numeros_taxes);
    let sousFisc;
    if (!a.percoit_taxes) {
      sousFisc = `<span class="pastille-bento">Ne perçoit pas</span>`;
    } else {
      const lignesTaxes = taxes.map((t) =>
        `<div class="sous-section-ligne"><span class="sous-section-libelle">${ech(t.etiquette)}</span> ${ech(t.numero)}</div>`
      ).join('');
      sousFisc = `<span class="pastille-bento pastille-bento-positive">Perçoit</span>${lignesTaxes}`;
    }

    const zoneConditions = `
      <div class="carte carte-conditions">
        <h3>Conditions galerie</h3>
        <div class="conditions-corps">
          <div class="sous-section">
            <h4>Cotes (calcul de prix)</h4>
            ${sousCotes}
          </div>
          <div class="sous-section">
            <h4>Fiscalité</h4>
            ${sousFisc}
          </div>
        </div>
      </div>
    `;

    // === Contact ===
    const lignesContact = [];
    if (a.courriel) lignesContact.push(`<div class="carte-op-ligne">${ech(a.courriel)}</div>`);
    if (a.telephone) lignesContact.push(`<div class="carte-op-ligne">${ech(a.telephone)}</div>`);
    if (a.adresse) lignesContact.push(`<div class="carte-op-ligne carte-op-libelle">${ech(a.adresse).replace(/\n/g, '<br>')}</div>`);
    const villePays = [a.province, a.pays].filter(Boolean).join(', ');
    if (villePays) lignesContact.push(`<div class="carte-op-ligne carte-op-libelle">${ech(villePays)}</div>`);
    if (a.langue) lignesContact.push(`<div class="carte-op-ligne carte-op-libelle">Langue : ${ech(a.langue)}</div>`);
    const zoneContact = `
      <div class="carte carte-op">
        <h3>Contact</h3>
        ${lignesContact.length ? lignesContact.join('') : '<div class="carte-op-ligne carte-op-libelle" style="font-style:italic;">Pas de coordonnées</div>'}
      </div>
    `;

    // === Aide IA ===
    const aDesConsignes = !!(a.instructions_ia && a.instructions_ia.trim());
    const zoneIA = `
      <div class="carte carte-op">
        <h3>Aide à la description IA</h3>
        <div class="carte-op-ligne">${aDesConsignes ? 'Consignes configurées' : 'Aucune consigne'}</div>
        ${a.lien_chatgpt ? `<div class="carte-op-ligne carte-op-libelle">GPT personnalisé lié</div>` : ''}
      </div>
    `;

    // === Catalogue (aperçu de 8 vignettes) ===
    const vignettes = (apercu || []).map((o) => {
      const titre = ech(o.titre || '');
      const img = o.image_path
        ? `<img src="${urlPhoto(o.image_path)}" alt="${titre}">`
        : `<span class="vignette-bento-placeholder">${ech(initiales(o.titre || '?'))}</span>`;
      const statut = o.statut === 'vendue' ? 'vendue' : (o.statut === 'reserve' ? 'reservee' : '');
      const badge = statut ? `<span class="vignette-bento-statut vignette-bento-statut-${statut}"></span>` : '';
      return `<button type="button" class="vignette-bento" data-oeuvre-id="${o.id}" title="${titre}">${img}${badge}</button>`;
    }).join('');

    const zoneCatalogue = a.nb_oeuvres > 0 ? `
      <div class="carte zone-catalogue-bento">
        <div class="entete-bloc-bento">
          <h3>Aperçu du catalogue</h3>
          <div class="entete-bloc-actions">
            <button class="btn-action" id="btn-voir-oeuvres">Voir ${pluriel(a.nb_oeuvres, 'œuvre')} &rsaquo;</button>
            <button class="btn-action btn-principal" id="btn-ajouter-oeuvres">+ Ajouter</button>
          </div>
        </div>
        ${vignettes ? `<div class="vignettes-bento">${vignettes}</div>` : ''}
      </div>
    ` : `
      <div class="carte zone-catalogue-bento zone-catalogue-bento-vide">
        <div class="entete-bloc-bento">
          <h3>Aperçu du catalogue</h3>
          <button class="btn-action btn-principal" id="btn-ajouter-oeuvres">+ Ajouter des œuvres</button>
        </div>
        <p class="zone-catalogue-bento-message">Aucune œuvre au catalogue pour cet artiste.</p>
      </div>
    `;

    // === Notes internes (si présentes) ===
    const zoneNotes = a.notes ? `
      <div class="carte zone-notes-bento">
        <h3>Notes internes</h3>
        <div class="texte-long">${ech(a.notes).replace(/\n/g, '<br>')}</div>
      </div>
    ` : '';

    // === Nav voisins (conservée telle quelle au-dessus de la grille) ===
    const navVoisins = voisins.total > 1 ? `
      <nav class="nav-voisins" aria-label="Navigation entre artistes">
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

    // === Assemblage ===
    contenu.innerHTML = `
      <div class="vue-fiche vue-fiche-bento">
        ${navVoisins}
        <div class="grille-bento">
          ${photoHtml}
          ${zoneIdentite}
          ${zoneStats}
          ${zoneConditions}
          ${zoneContact}
          ${zoneIA}
          ${zonePresentation}
          ${zoneCatalogue}
          ${zoneNotes}
        </div>
      </div>
    `;

    // === Handlers ===
    contenu.querySelector('#btn-modifier').addEventListener('click', entrerEdition);
    contenu.querySelector('#btn-supprimer').addEventListener('click', supprimer);
    contenu.querySelector('#btn-archiver').addEventListener('click', async () => {
      const fait = await basculerArchive({
        table: 'artistes',
        fiche: a,
        libelleFiche: nomCompletA,
        confirmer,
        surFait: async () => { await rechargerBundle(); dessiner(); },
      });
      if (!fait) return;
    });

    const btnCatalogue = contenu.querySelector('#btn-catalogue-pdf');
    if (btnCatalogue) {
      btnCatalogue.addEventListener('click', async () => {
        if (!a.nb_oeuvres) {
          await confirmer({
            type: 'info',
            title: 'Aucune œuvre',
            message: "Cet artiste n'a aucune œuvre à mettre au catalogue.",
            buttons: ['OK'],
          });
          return;
        }
        const libelle = btnCatalogue.textContent;
        btnCatalogue.disabled = true;
        btnCatalogue.textContent = 'Génération…';
        try {
          const res = await window.api.pdfCatalogueGenerer(a.id);
          const rep = await confirmer({
            type: 'succes',
            title: 'Catalogue produit',
            message: `Catalogue de ${res.nb_oeuvres} œuvre(s) généré en PDF.`,
            buttons: ['Ouvrir le PDF', 'Fermer'],
            defaultId: 0,
            cancelId: 1,
          });
          if (rep === 0) { try { await window.api.pdfOuvrir(res.pdf_path); } catch {} }
        } catch (err) {
          await confirmer({
            type: 'error',
            title: 'Échec de la génération',
            message: nettoyerErreur(err),
            buttons: ['OK'],
          });
        } finally {
          btnCatalogue.disabled = false;
          btnCatalogue.textContent = libelle;
        }
      });
    }

    const btnPresentation = contenu.querySelector('#btn-presentation-pdf');
    if (btnPresentation) {
      btnPresentation.addEventListener('click', async () => {
        const libelle = btnPresentation.textContent;
        btnPresentation.disabled = true;
        btnPresentation.textContent = 'Génération…';
        try {
          const res = await window.api.pdfPresentationGenerer(a.id);
          const rep = await confirmer({
            type: 'succes',
            title: 'Présentation produite',
            message: res.reutilise
              ? 'Profil inchangé — la dernière présentation a été réutilisée.'
              : 'Présentation générée en PDF.',
            buttons: ['Ouvrir le PDF', 'Fermer'],
            defaultId: 0,
            cancelId: 1,
          });
          if (rep === 0) { try { await window.api.pdfOuvrir(res.pdf_path); } catch {} }
        } catch (err) {
          await confirmer({ type: 'error', title: 'Échec de la génération', message: nettoyerErreur(err), buttons: ['OK'] });
        } finally {
          btnPresentation.disabled = false;
          btnPresentation.textContent = libelle;
        }
      });
    }

    const btnAnnexe = contenu.querySelector('#btn-annexe');
    if (btnAnnexe) {
      btnAnnexe.addEventListener('click', async () => {
        let oeuvres = [];
        try {
          oeuvres = await window.api.oeuvresDetailArtiste(a.id);
        } catch (err) {
          await confirmer({ type: 'error', title: 'Erreur', message: nettoyerErreur(err), buttons: ['OK'] });
          return;
        }
        if (!oeuvres.length) {
          await confirmer({ type: 'info', title: 'Aucune œuvre', message: "Cet artiste n'a aucune œuvre.", buttons: ['OK'] });
          return;
        }
        await ouvrirAnnexeModale({ artiste: a, oeuvres, type: 'depot' });
      });
    }

    const avatarVision = contenu.querySelector('#avatar-vision');
    if (avatarVision && a.photo_path) {
      avatarVision.addEventListener('click', () => {
        const source = a.photo_originale_path || a.photo_path;
        visionner(urlPhoto(source));
      });
    }

    contenu.querySelectorAll('.btn-voisin-prec').forEach((btn) => {
      if (voisins.precedent) {
        btn.addEventListener('click', () =>
          remplacerCourant('artiste-fiche', { id: voisins.precedent.id })
        );
      }
    });
    contenu.querySelectorAll('.btn-voisin-suiv').forEach((btn) => {
      if (voisins.suivant) {
        btn.addEventListener('click', () =>
          remplacerCourant('artiste-fiche', { id: voisins.suivant.id })
        );
      }
    });

    const btnVoir = contenu.querySelector('#btn-voir-oeuvres');
    if (btnVoir) {
      btnVoir.addEventListener('click', () =>
        naviguer('oeuvres-liste', { artiste_id: a.id, artiste_nom: nomCompletA })
      );
    }
    const btnAjouterOeuvres = contenu.querySelector('#btn-ajouter-oeuvres');
    if (btnAjouterOeuvres) {
      btnAjouterOeuvres.addEventListener('click', () => {
        naviguer('oeuvre-fiche', {
          nouveau: true,
          artiste_id: a.id,
          enchainement: true,
          enchainement_compte: 0,
          enchainement_artiste_nom: nomCompletA,
        });
      });
    }

    // Onglets de la carte Présentation : bascule sans re-render.
    contenu.querySelectorAll('.onglet-bento').forEach((tete) => {
      tete.addEventListener('click', () => {
        const cle = tete.dataset.onglet;
        contenu.querySelectorAll('.onglet-bento').forEach((t) => t.classList.toggle('actif', t === tete));
        contenu.querySelectorAll('[data-corps]').forEach((c) => {
          c.style.display = (c.dataset.corps === cle) ? '' : 'none';
        });
      });
    });

    // Vignettes du catalogue : clic = ouvrir la fiche d'œuvre.
    contenu.querySelectorAll('.vignette-bento').forEach((v) => {
      v.addEventListener('click', () => {
        const id = Number(v.dataset.oeuvreId);
        if (Number.isFinite(id) && id > 0) naviguer('oeuvre-fiche', { id });
      });
    });
  }

  function gabaritLigneTaxe(etiquette = '', numero = '') {
    return `
      <div class="ligne-taxe">
        <input type="text" class="champ-etiquette" placeholder="Étiquette (ex. TPS)" list="etiquettes-taxes" value="${ech(etiquette)}">
        <input type="text" class="champ-numero" placeholder="Numéro" value="${ech(numero)}">
        <button type="button" class="btn-supprimer-ligne" title="Retirer cette ligne" aria-label="Retirer">&times;</button>
      </div>
    `;
  }

  function dessinerEdition() {
    const taxes = parserNumerosTaxes(a.numeros_taxes);
    const lignesTaxesHtml = taxes.length
      ? taxes.map((t) => gabaritLigneTaxe(t.etiquette, t.numero)).join('')
      : (nouveau
          ? gabaritLigneTaxe('TPS', '') + gabaritLigneTaxe('TVQ', '')
          : gabaritLigneTaxe('TPS', ''));

    const nomAffichage = nomComplet(a) || a.nom || '';
    const titrePage = nouveau ? 'Nouvel artiste' : `Modifier « ${ech(nomAffichage)} »`;

    // === SVG des icônes overlay ===
    const svgRemplacer = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
    const svgRecadrer = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>`;
    const svgSupprimer = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
    const svgPersonne = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>`;

    const aPhotoInitiale = !!(a.photo_path || photoPendingDataUrl);
    const urlPhotoInitiale = photoPendingDataUrl || (a.photo_path ? urlPhoto(a.photo_path) : '');
    const photoOverlayInit = aPhotoInitiale
      ? `<img src="${urlPhotoInitiale}" alt="">
         <div class="photo-actions-overlay">
           <button type="button" class="photo-action-btn" id="btn-choisir-photo" title="Remplacer la photo">${svgRemplacer}</button>
           ${nouveau ? '' : `<button type="button" class="photo-action-btn" id="btn-recadrer-photo" title="Recadrer">${svgRecadrer}</button>`}
           <button type="button" class="photo-action-btn btn-supprimer" id="btn-effacer-photo" title="Retirer la photo">${svgSupprimer}</button>
         </div>`
      : `<button type="button" class="photo-choisir" id="btn-choisir-photo">${svgPersonne}Choisir une photo</button>`;

    contenu.innerHTML = `
      <div class="vue-fiche vue-fiche-bento">
        <h2 class="titre-formulaire">${titrePage}</h2>
        ${datalist('types-artiste', TYPES_ARTISTE)}
        ${datalist('langues', LANGUES)}
        ${datalist('etiquettes-taxes', ETIQUETTES_TAXES_COURANTES)}
        <form id="formulaire" class="formulaire" novalidate>
          <div class="grille-bento">

            <!-- Photo (3 col) -->
            <div class="carte zone-photo-edition">
              <div class="photo-edition-bento" id="zone-photo-overlay">
                ${photoOverlayInit}
              </div>
            </div>

            <!-- Identité (9 col) -->
            <div class="carte span-9">
              <h3>Identité</h3>
              <div class="grille-form">
                ${champTexte({ nom: 'prenom', libelle: 'Prénom', valeur: a.prenom })}
                ${champTexte({ nom: 'nom', libelle: 'Nom de famille', valeur: a.nom, requis: true })}
              </div>
              <div class="grille-form">
                ${champTexte({ nom: 'type', libelle: 'Type', valeur: a.type, liste: 'types-artiste' })}
                ${champTexte({ nom: 'prefixe_inventaire', libelle: "Préfixe d'inventaire", valeur: a.prefixe_inventaire, attributs: 'maxlength="10"' })}
                ${champTexte({ nom: 'langue', libelle: 'Langue', valeur: a.langue, liste: 'langues' })}
              </div>
              ${nouveau ? '<p class="aide-champ">Le préfixe se calcule automatiquement à partir des deux premières lettres du prénom et de la première du nom de famille (ex. Joe Untel → JOU). Tu peux le modifier au besoin.</p>' : ''}
            </div>

            <!-- Contact (6 col) -->
            <div class="carte span-6">
              <h3>Contact</h3>
              <div class="grille-form">
                ${champTexte({ nom: 'courriel', libelle: 'Courriel', valeur: a.courriel, type: 'email' })}
                ${champTexte({ nom: 'telephone', libelle: 'Téléphone', valeur: a.telephone, type: 'tel' })}
              </div>
              ${champTextarea({ nom: 'adresse', libelle: 'Adresse', valeur: a.adresse, lignes: 2 })}
              <div class="grille-form">
                ${champPays({ nom: 'pays', valeur: a.pays || 'Canada' })}
                <div id="zone-province-artiste">
                  ${champSubdivision({ nom: 'province', pays: a.pays || 'Canada', valeur: a.province })}
                </div>
              </div>
            </div>

            <!-- Présentation (6 col) -->
            <div class="carte span-6">
              <h3>Présentation</h3>
              ${champTextarea({ nom: 'biographie', libelle: 'Biographie', valeur: a.biographie, lignes: 4 })}
              ${champTextarea({ nom: 'demarche', libelle: 'Démarche', valeur: a.demarche, lignes: 4 })}
              ${champTextarea({ nom: 'curriculum', libelle: 'Curriculum', valeur: a.curriculum, lignes: 4 })}
            </div>

            <!-- Cotes (12 col) -->
            <div class="carte span-12">
              <h3>Cotes (calcul de prix)</h3>
              <p class="aide-champ">Tarif <strong>préférentiel</strong> (sans encadrement) appliqué selon le médium et la taille de l'œuvre. La version <strong>courante</strong> ajoute automatiquement 2 $ à la cote.</p>
              <div id="zone-cotes"></div>
              <button type="button" id="btn-ajouter-cote" class="btn-ajouter">+ Ajouter une cote</button>
              <details class="aide-priorite-cotes" style="margin-top:12px;">
                <summary>Ordre de priorité (cliquer pour déplier)</summary>
                <p class="aide-champ" style="margin-top:8px;">Quand plusieurs cotes pourraient s'appliquer à une œuvre, Galeria prend toujours la <strong>plus précise</strong> :</p>
                <ol class="aide-champ" style="margin:6px 0 8px 1.4em; padding:0;">
                  <li>Médium <em>exact</em> + taille <em>exacte</em></li>
                  <li>Médium « Tous » + taille <em>exacte</em></li>
                  <li>Médium <em>exact</em> + taille « Tous »</li>
                  <li>Médium « Tous » + taille « Tous » (fallback général)</li>
                </ol>
                <p class="aide-champ" style="margin-top:8px;"><strong>Exemple.</strong> Tu veux 30 $ partout sauf 35 $ en très grand : 1 cote « Tous / Tous = 30 » + 1 cote « Tous / Très grand = 35 » suffit.</p>
                <p class="aide-champ"><strong>À noter.</strong> Le médium est insensible à la casse et aux accents.</p>
              </details>
            </div>

            <!-- Fiscalité (6 col) -->
            <div class="carte span-6">
              <h3>Fiscalité</h3>
              ${champCheckbox({ nom: 'percoit_taxes', libelle: 'Perçoit les taxes', valeur: !!a.percoit_taxes })}
              <div class="form-champ">
                <label>Numéros de taxes</label>
                <div id="zone-taxes">${lignesTaxesHtml}</div>
                <button type="button" id="btn-ajouter-taxe" class="btn-ajouter">+ Ajouter un numéro de taxe</button>
                <p class="aide-champ">Une ligne par numéro. Étiquettes courantes : TPS, TVQ, TVH.</p>
              </div>
            </div>

            <!-- Aide IA (6 col) -->
            <div class="carte span-6">
              <h3>Aide à la description IA</h3>
              ${champTextarea({ nom: 'instructions_ia', libelle: "Consignes pour ChatGPT spécifiques", valeur: a.instructions_ia, lignes: 4 })}
              <p class="aide-champ">Inclus dans le prompt assemblé par « Copier pour ChatGPT » sur les œuvres de cet artiste.</p>
              ${champTexte({ nom: 'lien_chatgpt', libelle: 'Lien vers son GPT personnalisé', valeur: a.lien_chatgpt, attributs: 'placeholder="https://chatgpt.com/g/g-xxx-mon-artiste"' })}
            </div>

            <!-- Notes (12 col) -->
            <div class="carte span-12">
              <h3>Notes</h3>
              ${champTextarea({ nom: 'notes', libelle: '', valeur: a.notes, lignes: 3 })}
            </div>

          </div>

          <div class="form-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler">Annuler</button>
            ${nouveau
              ? `<button type="submit" class="btn-action btn-secondaire-action" id="btn-creer-seul">Créer seulement</button>
                 <button type="submit" class="btn-action btn-principal" id="btn-creer-et-oeuvres">Créer + ajouter les œuvres</button>`
              : `<button type="submit" class="btn-action btn-principal">Enregistrer</button>`}
          </div>
        </form>
      </div>
    `;

    const form = contenu.querySelector('#formulaire');
    const zoneTaxes = contenu.querySelector('#zone-taxes');

    function rendrePhotoZone() {
      const zone = contenu.querySelector('#zone-photo-overlay');
      if (!zone) return;
      const aPhoto = !!(a.photo_path || photoPendingDataUrl);
      const urlImg = photoPendingDataUrl || (a.photo_path ? urlPhoto(a.photo_path) : '');
      zone.innerHTML = aPhoto
        ? `<img src="${urlImg}" alt="">
           <div class="photo-actions-overlay">
             <button type="button" class="photo-action-btn" id="btn-choisir-photo" title="Remplacer la photo">${svgRemplacer}</button>
             ${nouveau ? '' : `<button type="button" class="photo-action-btn" id="btn-recadrer-photo" title="Recadrer">${svgRecadrer}</button>`}
             <button type="button" class="photo-action-btn btn-supprimer" id="btn-effacer-photo" title="Retirer la photo">${svgSupprimer}</button>
           </div>`
        : `<button type="button" class="photo-choisir" id="btn-choisir-photo">${svgPersonne}Choisir une photo</button>`;
      brancherBoutonsPhoto();
    }
    const majPreviewPhoto = rendrePhotoZone;

    function brancherBoutonsPhoto() {
      const btnChoisirPhoto = contenu.querySelector('#btn-choisir-photo');
      if (btnChoisirPhoto) {
        btnChoisirPhoto.addEventListener('click', async () => {
          btnChoisirPhoto.disabled = true;
          try {
            const lecture = await window.api.photoLireFichier();
            if (!lecture || lecture.cancelled) return;
            const dataUrlRecadree = await recadrerCarre(lecture.dataUrl);
            if (!dataUrlRecadree) return;
            if (nouveau) {
              photoPendingDataUrl = dataUrlRecadree;
              photoPendingOriginaleDataUrl = lecture.dataUrl;
              modifie = true;
              rendrePhotoZone();
            } else {
              const result = await window.api.photoEnregistrerRecadree(
                'artistes', a.id, dataUrlRecadree, lecture.dataUrl
              );
              if (result && result.path !== undefined) {
                a.photo_path = result.path;
                a.photo_originale_path = (await window.api.artisteGet(a.id)).photo_originale_path;
                rendrePhotoZone();
              }
            }
          } catch (err) {
            await confirmer({
              type: 'error', title: 'Photo non chargée',
              message: nettoyerErreur(err), buttons: ['OK'],
            });
          } finally {
            btnChoisirPhoto.disabled = false;
          }
        });
      }

      const btnRecadrerPhoto = contenu.querySelector('#btn-recadrer-photo');
      if (btnRecadrerPhoto) {
        btnRecadrerPhoto.addEventListener('click', async () => {
          btnRecadrerPhoto.disabled = true;
          try {
            const lecture = await window.api.photoLirePourRecadrage('artistes', a.id);
            if (!lecture || !lecture.dataUrl) return;
            if (!lecture.depuisOriginale) {
              const reponse = await confirmer({
                type: 'info',
                title: 'Pas d\'original conservé',
                message: 'Cette photo a été ajoutée avant que la conservation des originaux ne soit en place. Le recadrage partira de la version déjà recadrée (résolution moindre).',
                detail: 'Pour partir d\'une pleine résolution, utilise plutôt « Remplacer la photo » avec le fichier d\'origine.',
                buttons: ['Continuer quand même', 'Annuler'],
                defaultId: 0, cancelId: 1,
              });
              if (reponse !== 0) return;
            }
            const dataUrlRecadree = await recadrerCarre(lecture.dataUrl);
            if (!dataUrlRecadree) return;
            const result = await window.api.photoEnregistrerRecadree(
              'artistes', a.id, dataUrlRecadree, null
            );
            if (result && result.path !== undefined) {
              a.photo_path = result.path;
              rendrePhotoZone();
            }
          } catch (err) {
            await confirmer({
              type: 'error', title: 'Recadrage impossible',
              message: nettoyerErreur(err), buttons: ['OK'],
            });
          } finally {
            btnRecadrerPhoto.disabled = false;
          }
        });
      }

      const btnEffacerPhoto = contenu.querySelector('#btn-effacer-photo');
      if (btnEffacerPhoto) {
        btnEffacerPhoto.addEventListener('click', async () => {
          if (nouveau) {
            photoPendingDataUrl = null;
            photoPendingOriginaleDataUrl = null;
            modifie = true;
            rendrePhotoZone();
            return;
          }
          const reponse = await confirmer({
            type: 'warning', title: 'Retirer la photo ?',
            message: 'La photo (recadrée et originale) sera effacée définitivement du dossier de la galerie.',
            buttons: ['Retirer', 'Annuler'],
            defaultId: 1, cancelId: 1,
          });
          if (reponse !== 0) return;
          try {
            await window.api.photoEffacer('artistes', a.id);
            a.photo_path = null;
            a.photo_originale_path = null;
            rendrePhotoZone();
          } catch (err) {
            await confirmer({
              type: 'error', title: 'Suppression échouée',
              message: nettoyerErreur(err), buttons: ['OK'],
            });
          }
        });
      }
    }
    brancherBoutonsPhoto();

    function brancherSuppressions() {
      zoneTaxes.querySelectorAll('.btn-supprimer-ligne').forEach((btn) => {
        btn.onclick = () => {
          btn.closest('.ligne-taxe').remove();
          modifie = true;
        };
      });
    }
    brancherSuppressions();

    contenu.querySelector('#btn-ajouter-taxe').addEventListener('click', () => {
      zoneTaxes.insertAdjacentHTML('beforeend', gabaritLigneTaxe());
      brancherSuppressions();
      modifie = true;
      const dernierEtiq = zoneTaxes.querySelector('.ligne-taxe:last-child .champ-etiquette');
      if (dernierEtiq) dernierEtiq.focus();
    });

    // ====== Éditeur de cotes ======
    const zoneCotes = contenu.querySelector('#zone-cotes');
    function gabaritLigneCote(c = {}) {
      const medium = (c.medium || 'Tous').replace(/"/g, '&quot;');
      const taille = c.taille || 'Tous';
      const unite = c.unite || 'lineaire';
      const prix = c.prix_pref ?? '';
      const optionsTailles = ['Tous', ...TAILLES_COTES]
        .map((t) => `<option value="${t}" ${t === taille ? 'selected' : ''}>${ech(t)}</option>`).join('');
      return `
        <div class="ligne-cote">
          <div class="select-edit-wrap" data-medium-wrap>
            <input type="text" class="cote-medium" placeholder="Médium (ou Tous)" value="${medium}" autocomplete="off">
            <button type="button" class="select-edit-toggle" aria-label="Voir les options" tabindex="-1">▾</button>
          </div>
          <select class="cote-taille">${optionsTailles}</select>
          <select class="cote-unite">
            <option value="lineaire" ${unite === 'lineaire' ? 'selected' : ''}>$/po linéaire</option>
            <option value="carre" ${unite === 'carre' ? 'selected' : ''}>$/po²</option>
          </select>
          <input type="number" class="cote-prix" placeholder="Prix" value="${prix}" min="0" step="0.01">
          <button type="button" class="btn-supprimer-ligne" title="Retirer cette cote" aria-label="Retirer">&times;</button>
        </div>
      `;
    }
    // Dropdown des médiums (composant partagé, même que la fiche œuvre et le
    // calculateur). « Tous » épinglé en tête, propre aux cotes.
    const brancherMedium = (wrap) => brancherDropdownMedium(wrap, {
      mediumsArtiste, mediumsConnus, inclureTous: true,
      onChange: () => { modifie = true; },
    });

    function rendreCotes(cotesArr) {
      const liste = Array.isArray(cotesArr) && cotesArr.length ? cotesArr : [];
      zoneCotes.innerHTML = liste.map(gabaritLigneCote).join('') ||
        '<p class="aide-champ" style="margin:0 0 8px;">Aucune cote définie. Ajoute-en une pour activer le calcul automatique du prix.</p>';
      zoneCotes.querySelectorAll('.btn-supprimer-ligne').forEach((btn) => {
        btn.onclick = () => { btn.closest('.ligne-cote').remove(); modifie = true; };
      });
      zoneCotes.querySelectorAll('[data-medium-wrap]').forEach(brancherMedium);
    }
    rendreCotes(parserCotes(a.cotes));
    contenu.querySelector('#btn-ajouter-cote').addEventListener('click', () => {
      // Si message « Aucune cote… » présent, on le remplace par une vraie ligne.
      const aucune = zoneCotes.querySelector('.aide-champ');
      if (aucune) zoneCotes.innerHTML = '';
      zoneCotes.insertAdjacentHTML('beforeend', gabaritLigneCote());
      const nouvelle = zoneCotes.querySelector('.ligne-cote:last-child');
      if (nouvelle) {
        nouvelle.querySelectorAll('.btn-supprimer-ligne').forEach((btn) => {
          btn.onclick = () => { btn.closest('.ligne-cote').remove(); modifie = true; };
        });
        nouvelle.querySelectorAll('[data-medium-wrap]').forEach(brancherMedium);
      }
      modifie = true;
      const dernierPrix = zoneCotes.querySelector('.ligne-cote:last-child .cote-prix');
      if (dernierPrix) dernierPrix.focus();
    });

    form.addEventListener('input', () => { modifie = true; });
    form.addEventListener('change', () => { modifie = true; });

    brancherChangementPays(form, { paysNom: 'pays', subNom: 'province', subZoneId: 'zone-province-artiste' });

    // Auto-préfixe d'inventaire : 2 premières lettres du prénom + 1 du nom, en majuscules sans accents.
    // S'applique seulement tant que l'utilisateur n'a pas modifié le préfixe à la main.
    const elPrenom = form.elements.prenom;
    const elNom = form.elements.nom;
    const elPrefixe = form.elements.prefixe_inventaire;
    const calculerPrefixe = () => {
      const p = sansAccents(elPrenom?.value || '').toUpperCase();
      const n = sansAccents(elNom?.value || '').toUpperCase();
      const letters = (p.replace(/[^A-Z]/g, '').slice(0, 2)) + (n.replace(/[^A-Z]/g, '').slice(0, 1));
      return letters;
    };
    let prefixeAuto = !elPrefixe?.value || elPrefixe.value === calculerPrefixe();
    if (elPrefixe) {
      elPrefixe.addEventListener('input', () => {
        prefixeAuto = false;
      });
    }
    const majPrefixe = () => {
      if (!elPrefixe || !prefixeAuto) return;
      const nv = calculerPrefixe();
      if (nv !== elPrefixe.value) elPrefixe.value = nv;
    };
    if (elPrenom) elPrenom.addEventListener('input', majPrefixe);
    if (elNom)    elNom.addEventListener('input', majPrefixe);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);
      data.percoit_taxes = form.elements.percoit_taxes.checked;

      const lignesTaxes = Array.from(zoneTaxes.querySelectorAll('.ligne-taxe'))
        .map((l) => ({
          etiquette: l.querySelector('.champ-etiquette').value.trim(),
          numero: l.querySelector('.champ-numero').value.trim(),
        }))
        .filter((t) => t.numero);
      data.numeros_taxes = lignesTaxes.length ? JSON.stringify(lignesTaxes) : null;

      // Validation bloquante du format des numéros TPS et TVQ (espaces ignorés).
      // On ne valide que les lignes TPS/TVQ remplies ; les autres étiquettes et
      // les champs laissés vides ne bloquent pas.
      const FORMATS_TAXES = {
        TPS: { regex: /^\d{9}RT\d{4}$/, exemple: '123456789 RT 0001' },
        TVQ: { regex: /^\d{10}TQ\d{4}$/, exemple: '1234567890 TQ 0001' },
      };
      const erreursTaxes = [];
      zoneTaxes.querySelectorAll('.ligne-taxe').forEach((l) => {
        const inNum = l.querySelector('.champ-numero');
        inNum.classList.remove('erreur');
        const etiquette = l.querySelector('.champ-etiquette').value.trim().toUpperCase();
        const numeroBrut = inNum.value.trim();
        const fmt = FORMATS_TAXES[etiquette];
        if (!fmt || !numeroBrut) return;
        const numeroNormalise = numeroBrut.replace(/\s+/g, '').toUpperCase();
        if (!fmt.regex.test(numeroNormalise)) {
          inNum.classList.add('erreur');
          erreursTaxes.push(`${etiquette} : « ${numeroBrut} » — format attendu : ${fmt.exemple}`);
        }
      });
      if (erreursTaxes.length) {
        await confirmer({
          type: 'error',
          title: 'Numéro de taxe invalide',
          message: 'Le format de certains numéros de taxes ne correspond pas :',
          detail: erreursTaxes.join('\n')
            + '\n\nTPS : 9 chiffres + RT + 4 chiffres.\nTVQ : 10 chiffres + TQ + 4 chiffres.\n(Les espaces ne sont pas pris en compte.)',
          buttons: ['OK'],
        });
        return;
      }

      const lignesCotes = Array.from(zoneCotes.querySelectorAll('.ligne-cote'))
        .map((l) => ({
          medium: l.querySelector('.cote-medium').value.trim() || 'Tous',
          taille: l.querySelector('.cote-taille').value,
          unite: l.querySelector('.cote-unite').value,
          prix_pref: Number(l.querySelector('.cote-prix').value) || 0,
        }))
        .filter((c) => c.prix_pref > 0);
      data.cotes = lignesCotes.length ? JSON.stringify(lignesCotes) : null;

      const enchainerApresCreation = nouveau && e.submitter?.id === 'btn-creer-et-oeuvres';

      try {
        if (nouveau) {
          a = await window.api.artisteCreer(data);
          modifierParamsCourants({ id: a.id, nouveau: false });
          // Photo choisie en amont (mode nouveau) : on l'enregistre maintenant que l'ID existe
          if (photoPendingDataUrl) {
            try {
              const r = await window.api.photoEnregistrerRecadree(
                'artistes', a.id, photoPendingDataUrl, photoPendingOriginaleDataUrl
              );
              if (r && r.path) a.photo_path = r.path;
            } catch (errPhoto) {
              await confirmer({
                type: 'warning',
                title: 'Artiste créé, photo non enregistrée',
                message: "L'artiste a été créé mais la photo n'a pas pu être enregistrée.",
                detail: errPhoto.message + "\n\nTu peux ré-essayer depuis la fiche de l'artiste.",
                buttons: ['OK'],
              });
            }
            photoPendingDataUrl = null;
            photoPendingOriginaleDataUrl = null;
          }
        } else {
          a = await window.api.artisteModifier(a.id, data);
        }
        if (enchainerApresCreation) {
          leverGardien();
          remplacerCourant('oeuvre-fiche', {
            nouveau: true,
            artiste_id: a.id,
            enchainement: true,
            enchainement_compte: 0,
            enchainement_artiste_nom: nomComplet(a) || a.nom || '',
          });
          return;
        }
        await rechargerBundle();
        sortirEdition();
      } catch (err) {
        await confirmer({
          type: 'error',
          title: "Impossible d'enregistrer",
          message: nettoyerErreur(err),
          buttons: ['OK'],
        });
      }
    });

    contenu.querySelector('#btn-annuler').addEventListener('click', async () => {
      if (modifie || nouveau) {
        const reponse = await confirmer({
          type: 'warning',
          title: nouveau ? 'Abandonner ce nouvel artiste ?' : 'Abandonner les modifications ?',
          message: nouveau
            ? 'Les informations saisies seront perdues.'
            : 'Les modifications en cours seront perdues.',
          buttons: ['Abandonner', nouveau ? 'Continuer la saisie' : 'Continuer à modifier'],
          defaultId: 1,
          cancelId: 1,
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
