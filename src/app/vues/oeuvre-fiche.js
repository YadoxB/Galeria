import { naviguer, retour, poserGardien, leverGardien, modifierParamsCourants, remplacerCourant } from '../router.js';
import {
  ech, formaterPrix, badgeStatut, STATUTS,
  champTexte, champTextarea, champSelect, datalist, urlPhoto,
  formaterDate, nomComplet, sansAccents,
  badgeArchive, boutonArchive, basculerArchive,
} from '../commun.js';
import { visionner } from '../visionneuse.js';
import { confirmer, alerter } from '../dialogue.js';
import { ouvrirCreationCertificat } from './certificat-creation.js';

const TYPES_OEUVRE = ['Peinture', 'Sculpture', 'Reproduction', 'Photographie', 'Dessin', 'Estampe', 'Mixte'];
const ORIENTATIONS = ['Horizontale', 'Verticale', 'Carrée'];
const FORMATS = ['Petit', 'Moyen', 'Grand', 'Très grand'];

const GABARIT_VIDE = {
  id: null,
  artiste_id: null,
  artiste_nom: '',
  titre: '',
  type: null, numero_inventaire: null, numero_delivrance: null,
  annee: null, medium: null, support: null, dimensions: null,
  hauteur: null, largeur: null, profondeur: null,
  format: null, orientation: null, sujets: null,
  emplacement_signature: null, particularite: null, description: null,
  prix: null, statut: 'disponible',
  emplacement: null, exposition_actuelle: null,
  image_path: null,
};

// Seuils en pouces, sur la moyenne géométrique √(H × L). Ce critère a été
// dérivé empiriquement du catalogue existant : il classe correctement 93,7 %
// des 476 œuvres déjà étiquetées par la galerie, contre 85,5 % pour le max
// et 78,2 % pour le min. Intuition : la moyenne géométrique = côté équivalent
// d'un carré ayant la même surface, ce qui colle au « ressenti » de format
// pour les œuvres très allongées (ex. 12 × 72 → 29" → Moyen).
// La profondeur (P) est ignorée : c'est l'épaisseur du châssis, pas la taille
// perçue de l'œuvre.
const SEUILS_FORMAT = [
  { max: 16, libelle: 'Petit' },
  { max: 30, libelle: 'Moyen' },
  { max: 42, libelle: 'Grand' },
  { max: Infinity, libelle: 'Très grand' },
];

function calculerFormat(h, l, _p) {
  const H = Number(h) || 0;
  const L = Number(l) || 0;
  if (H <= 0 || L <= 0) return '';
  const equivalent = Math.sqrt(H * L);
  for (const seuil of SEUILS_FORMAT) {
    if (equivalent <= seuil.max) return seuil.libelle;
  }
  return '';
}

function calculerOrientation(h, l) {
  const H = Number(h) || 0;
  const L = Number(l) || 0;
  if (H <= 0 || L <= 0) return '';
  if (L > H * 1.05) return 'Horizontale';
  if (H > L * 1.05) return 'Verticale';
  return 'Carrée';
}

function formaterDimensionsTexte(h, l, p) {
  const arr = [h, l, p].map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  // On garde au moins H et L si présents ; on inclut P seulement s'il y a une valeur.
  const visibles = arr[2] != null ? arr : arr.slice(0, 2);
  if (!visibles.some((v) => v != null)) return '';
  return visibles.map((v) => (v != null ? String(v) : '?')).join(' × ') + ' po';
}

function ouvrirModaleEnvoyerChatGPT(r) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale';
    const aImage = !!r.image_data_url;
    overlay.innerHTML = `
      <div class="modale-recadrage modale-chatgpt">
        <h3>Envoyer à ChatGPT</h3>
        <div class="chatgpt-etapes">
          <div class="chatgpt-etape">
            <span class="chatgpt-etape-num">1</span>
            <div class="chatgpt-etape-corps">
              <p class="chatgpt-etape-titre"><strong>Texte copié</strong> <span class="check-vert">✓</span></p>
              <p class="chatgpt-etape-aide">Colle-le directement dans la zone de saisie de ChatGPT (Ctrl+V).</p>
            </div>
          </div>
          ${aImage ? `
          <div class="chatgpt-etape">
            <span class="chatgpt-etape-num">2</span>
            <div class="chatgpt-etape-corps">
              <p class="chatgpt-etape-titre"><strong>Image à joindre</strong></p>
              <p class="chatgpt-etape-aide">Glisse l'image ci-dessous dans ChatGPT, <em>ou</em> clique sur « Copier l'image » puis colle-la (Ctrl+V) après le texte.</p>
              <img src="${r.image_data_url}" alt="" class="modale-img-grande" draggable="true" id="modale-img">
              <button type="button" class="btn-action btn-secondaire-action" id="btn-copier-image">
                Copier l'image
              </button>
              <span id="image-statut" class="chatgpt-image-statut"></span>
            </div>
          </div>
          ` : `
          <div class="chatgpt-etape">
            <span class="chatgpt-etape-num">2</span>
            <div class="chatgpt-etape-corps">
              <p class="chatgpt-etape-titre"><strong>Image</strong></p>
              <p class="chatgpt-etape-aide">Aucune image n'est encore attachée à cette œuvre. ChatGPT travaillera uniquement à partir du texte.</p>
            </div>
          </div>
          `}
        </div>
        <div class="form-actions" style="justify-content: flex-end;">
          <button type="button" class="btn-action btn-secondaire-action" id="modale-fermer">Fermer</button>
          <button type="button" class="btn-action btn-principal" id="modale-ouvrir-chatgpt">Ouvrir ChatGPT</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const fermer = () => {
      overlay.remove();
      resolve();
    };
    overlay.querySelector('#modale-fermer').addEventListener('click', fermer);
    overlay.querySelector('#modale-ouvrir-chatgpt').addEventListener('click', async () => {
      await window.api.ouvrirUrl(r.lien_chatgpt);
    });

    const btnCopierImage = overlay.querySelector('#btn-copier-image');
    if (btnCopierImage && aImage) {
      btnCopierImage.addEventListener('click', async () => {
        btnCopierImage.disabled = true;
        const statut = overlay.querySelector('#image-statut');
        try {
          const res = await window.api.iaCopierImageSeulement(r.image_data_url);
          if (res?.ok) {
            statut.textContent = '✓ Image copiée — colle-la (Ctrl+V) dans ChatGPT.';
            statut.className = 'chatgpt-image-statut succes';
          } else {
            statut.textContent = `Échec : ${res?.erreur || 'inconnu'}`;
            statut.className = 'chatgpt-image-statut erreur';
          }
        } catch (err) {
          statut.textContent = `Échec : ${err.message}`;
          statut.className = 'chatgpt-image-statut erreur';
        } finally {
          btnCopierImage.disabled = false;
        }
      });
    }
  });
}

export async function rendreOeuvreFiche(contenu, params) {
  const estNouveau = !!params.nouveau;
  let o;
  let artistes = null;
  let voisins = { precedent: null, suivant: null, position: null, total: 0 };

  let ventes = [];
  let certificats = [];

  if (estNouveau) {
    o = { ...GABARIT_VIDE };
    if (params.artiste_id != null) {
      o.artiste_id = params.artiste_id;
    }
    artistes = await window.api.artistesListe();
  } else {
    [o, voisins, ventes, certificats] = await Promise.all([
      window.api.oeuvreGet(params.id),
      window.api.oeuvreVoisins(params.id),
      window.api.oeuvreVentes(params.id),
      window.api.certificatsListeOeuvre(params.id),
    ]);
    if (!o) {
      contenu.innerHTML = `<p class="erreur">&OElig;uvre introuvable.</p>`;
      return;
    }
  }

  let mode = estNouveau ? 'edition' : 'lecture';
  let modifie = false;
  let nouveau = estNouveau;
  let imagePendingDataUrl = null; // pour nouvelle œuvre : image choisie avant le save

  if (nouveau) poserGardien(gardienChangements);

  async function gardienChangements() {
    if (!modifie && !nouveau) return true;
    const reponse = await confirmer({
      type: 'warning',
      title: nouveau ? 'Abandonner cette œuvre ?' : 'Modifications non sauvegardées',
      message: nouveau
        ? "Cette œuvre n'a pas été enregistrée. Voulez-vous l'abandonner ?"
        : 'Voulez-vous abandonner les modifications en cours ?',
      buttons: ['Abandonner', nouveau ? 'Continuer la saisie' : 'Rester sur la fiche'],
      defaultId: 1,
      cancelId: 1,
    });
    return reponse === 0;
  }

  async function entrerEdition() {
    if (!artistes) artistes = await window.api.artistesListe();
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
    const reponse = await confirmer({
      type: 'warning',
      title: 'Supprimer cette œuvre ?',
      message: `Supprimer définitivement « ${o.titre} » ?`,
      detail: 'Cette action est irréversible. Tu peux retrouver une version antérieure dans les sauvegardes si besoin.',
      buttons: ['Supprimer', 'Annuler'],
      defaultId: 1,
      cancelId: 1,
    });
    if (reponse !== 0) return;
    try {
      await window.api.oeuvreSupprimer(o.id);
      leverGardien();
      retour();
    } catch (err) {
      await confirmer({
        type: 'error',
        title: 'Suppression échouée',
        message: err.message,
        buttons: ['OK'],
      });
    }
  }

  function dessiner() {
    mode === 'lecture' ? dessinerLecture() : dessinerEdition();
  }

  function dessinerListeCertificats(liste) {
    if (!liste || liste.length === 0) {
      return `<p class="liste-vide">Aucun certificat émis pour cette œuvre.</p>`;
    }
    return `
      <div class="historique-ventes">
        ${liste.map((c) => `
          <div class="ligne-certificat" data-id="${c.id}">
            <div class="info">
              <p class="ligne-titre">${ech(c.numero_delivrance || '—')}</p>
              <p class="ligne-meta">
                ${formaterDate(c.date_delivrance)}
                ${c.valeur != null ? `&nbsp;&middot;&nbsp;${formaterPrix(c.valeur)}` : ''}
                ${c.numero_facture ? `&nbsp;&middot;&nbsp;Vente ${ech(c.numero_facture)}` : ''}
                ${c.signataire ? `&nbsp;&middot;&nbsp;${ech(c.signataire)}` : ''}
              </p>
              ${c.particularite ? `<p class="ligne-meta"><em>${ech(c.particularite)}</em></p>` : ''}
            </div>
            <div class="actions-certif">
              ${c.pdf_path
                ? `<button type="button" class="btn-action btn-secondaire-action btn-voir-pdf-certif">Voir le PDF</button>
                   <button type="button" class="btn-action btn-secondaire-action btn-ouvrir-dossier-certif" title="Ouvrir le dossier dans l'Explorateur">Ouvrir le dossier</button>
                   <button type="button" class="btn-action btn-secondaire-action btn-regen-pdf-certif">Re-générer</button>`
                : `<button type="button" class="btn-action btn-principal btn-gen-pdf-certif">Générer le PDF</button>`}
              <button type="button" class="btn-action btn-danger btn-suppr-certif">Supprimer</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function rafraichirCertificats() {
    certificats = await window.api.certificatsListeOeuvre(o.id);
    const zone = contenu.querySelector('#liste-certificats');
    if (zone) zone.innerHTML = dessinerListeCertificats(certificats);
    brancherActionsCertificats();
    const compteur = contenu.querySelector('.compteur-inline');
    if (compteur) compteur.textContent = certificats.length > 0 ? `(${certificats.length})` : '';
  }

  function brancherActionsCertificats() {
    const idDeLigne = (e) => Number(e.currentTarget.closest('.ligne-certificat')?.dataset.id);

    contenu.querySelectorAll('.btn-suppr-certif').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = idDeLigne(e);
        if (!id) return;
        const r = await confirmer({
          type: 'warning', title: 'Supprimer ce certificat ?',
          message: 'Le certificat sera retiré de l\'historique. Cette action est irréversible.',
          buttons: ['Supprimer', 'Annuler'],
          defaultId: 1, cancelId: 1,
        });
        if (r !== 0) return;
        try {
          await window.api.certificatSupprimer(id);
          await rafraichirCertificats();
        } catch (err) {
          await alerter({ type: 'error', title: 'Suppression échouée', message: err.message });
        }
      });
    });

    contenu.querySelectorAll('.btn-voir-pdf-certif').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = idDeLigne(e);
        const cert = certificats.find((c) => c.id === id);
        if (!cert?.pdf_path) return;
        try {
          await window.api.pdfOuvrir(cert.pdf_path);
        } catch (err) {
          await alerter({ type: 'error', title: 'Impossible d\'ouvrir le PDF', message: err.message });
        }
      });
    });

    contenu.querySelectorAll('.btn-ouvrir-dossier-certif').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = idDeLigne(e);
        const cert = certificats.find((c) => c.id === id);
        if (!cert?.pdf_path) return;
        try {
          await window.api.pdfRevelerDansExplorateur(cert.pdf_path);
        } catch (err) {
          await alerter({ type: 'error', title: 'Impossible d\'ouvrir le dossier', message: err.message });
        }
      });
    });

    const genererCertif = async (e) => {
      const id = idDeLigne(e);
      const btn = e.currentTarget;
      const ancien = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Génération…';
      try {
        await window.api.pdfCertificatGenerer(id);
        await rafraichirCertificats();
      } catch (err) {
        await alerter({ type: 'error', title: 'Génération échouée', message: err.message });
        btn.disabled = false;
        btn.textContent = ancien;
      }
    };
    contenu.querySelectorAll('.btn-gen-pdf-certif').forEach((btn) => btn.addEventListener('click', genererCertif));
    contenu.querySelectorAll('.btn-regen-pdf-certif').forEach((btn) => btn.addEventListener('click', genererCertif));
  }

  function dessinerLecture() {
    const champ = (libelle, valeur) =>
      valeur != null && valeur !== ''
        ? `<div class="champ"><dt>${ech(libelle)}</dt><dd>${ech(valeur).replace(/\n/g, '<br>')}</dd></div>`
        : '';

    const lignesIdent = [
      champ('Type', o.type),
      champ("Numéro d'inventaire", o.numero_inventaire),
      champ('Numéro de délivrance', o.numero_delivrance),
      champ('Année', o.annee),
    ].join('');

    const lignesMateriel = [
      champ('Médium', o.medium),
      champ('Support', o.support),
      champ('Dimensions', o.dimensions),
      champ('Format', o.format),
      champ('Orientation', o.orientation),
      champ('Emplacement de la signature', o.emplacement_signature),
      champ('Particularité', o.particularite),
    ].join('');

    const lignesSujets = o.sujets
      ? `<div class="champ"><dt>Sujets</dt><dd>${o.sujets
          .split(',')
          .map((s) => `<span class="puce">${ech(s.trim())}</span>`)
          .join(' ')}</dd></div>`
      : '';

    const lignesCommerce = [
      champ('Prix régulier', o.prix != null ? formaterPrix(o.prix) : null),
      champ('Emplacement (gallerie)', o.emplacement),
      champ('Exposition actuelle', o.exposition_actuelle),
    ].join('');

    const imageHtml = o.image_path
      ? `<div class="oeuvre-image avec-photo cliquable" id="image-vision" title="Voir en grand"><img src="${urlPhoto(o.image_path)}" alt="${ech(o.titre)}"></div>`
      : `<div class="oeuvre-image"><span>&#9635;</span></div>`;

    const navVoisins = voisins.total > 1 ? `
      <nav class="nav-voisins" aria-label="Navigation entre œuvres">
        <button class="btn-voisin btn-voisin-prec" ${voisins.precedent ? '' : 'disabled'} title="${voisins.precedent ? ech(voisins.precedent.titre) : ''}">
          <span class="fleche">&larr;</span>
          <span class="libelle-voisin">
            <span class="libelle-mini">Précédente</span>
            <span class="nom-voisin">${voisins.precedent ? ech(voisins.precedent.titre) : '—'}</span>
          </span>
        </button>
        <span class="position-voisin">${voisins.position} / ${voisins.total}</span>
        <button class="btn-voisin btn-voisin-suiv" ${voisins.suivant ? '' : 'disabled'} title="${voisins.suivant ? ech(voisins.suivant.titre) : ''}">
          <span class="libelle-voisin libelle-droite">
            <span class="libelle-mini">Suivante</span>
            <span class="nom-voisin">${voisins.suivant ? ech(voisins.suivant.titre) : '—'}</span>
          </span>
          <span class="fleche">&rarr;</span>
        </button>
      </nav>
    ` : '';

    contenu.innerHTML = `
      <div class="vue-fiche">
        <div class="oeuvre-fiche-entete">
          ${imageHtml}
          <div class="oeuvre-info">
            <h2>${ech(o.titre)} ${o.archive ? badgeArchive() : ''}</h2>
            <p class="meta">par <button class="btn-lien" id="lien-artiste">${ech(o.artiste_nom)}</button></p>
            <div class="bloc-statut-prix">
              ${badgeStatut(o.statut)}
              ${o.prix != null ? `<span class="prix-grand">${formaterPrix(o.prix)}</span>` : ''}
            </div>
          </div>
          <div class="entete-fiche-actions">
            <button class="btn-action btn-danger" id="btn-supprimer">Supprimer</button>
            ${boutonArchive({ archive: o.archive })}
            <button class="btn-action" id="btn-modifier">Modifier</button>
            ${o.statut !== 'vendu'
              ? `<button class="btn-action btn-principal" id="btn-vendre">Vendre</button>`
              : (ventes.length > 0
                  ? `<button class="btn-action" id="btn-voir-vente">Voir la vente${ventes[0].numero_facture ? ' ' + ech(ventes[0].numero_facture) : ''} &rsaquo;</button>`
                  : '')}
          </div>
        </div>

        ${navVoisins}

        <div class="actions-fiche">
          <button class="btn-action" id="btn-voir-oeuvres-artiste">
            Voir toutes les &oelig;uvres de ${ech(o.artiste_nom)} &rsaquo;
          </button>
        </div>

        ${lignesIdent ? `<section class="bloc"><h3>Identification</h3><dl class="champs">${lignesIdent}</dl></section>` : ''}
        ${lignesMateriel ? `<section class="bloc"><h3>Matériel et facture</h3><dl class="champs">${lignesMateriel}</dl></section>` : ''}
        ${lignesSujets ? `<section class="bloc"><h3>Sujets</h3><dl class="champs">${lignesSujets}</dl></section>` : ''}
        ${lignesCommerce ? `<section class="bloc"><h3>Commerce et localisation</h3><dl class="champs">${lignesCommerce}</dl></section>` : ''}
        ${o.description ? `<section class="bloc"><h3>Description</h3><p class="texte-long">${ech(o.description).replace(/\n/g, '<br>')}</p></section>` : ''}

        <section class="bloc">
          <h3>Certificats d'authenticité ${certificats.length > 0 ? `<span class="compteur-inline">(${certificats.length})</span>` : ''}</h3>
          <div class="form-champ">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-produire-certificat">+ Produire un certificat</button>
          </div>
          <div id="liste-certificats">
            ${dessinerListeCertificats(certificats)}
          </div>
        </section>
      </div>
    `;

    contenu.querySelector('#btn-modifier').addEventListener('click', entrerEdition);
    contenu.querySelector('#btn-supprimer').addEventListener('click', supprimer);
    contenu.querySelector('#btn-archiver').addEventListener('click', async () => {
      await basculerArchive({
        table: 'oeuvres',
        fiche: o,
        libelleFiche: o.titre,
        confirmer,
        surFait: () => dessiner(),
      });
    });
    contenu.querySelector('#lien-artiste').addEventListener('click', () =>
      naviguer('artiste-fiche', { id: o.artiste_id })
    );
    contenu.querySelector('#btn-voir-oeuvres-artiste').addEventListener('click', () =>
      naviguer('oeuvres-liste', { artiste_id: o.artiste_id, artiste_nom: o.artiste_nom })
    );
    const btnVendre = contenu.querySelector('#btn-vendre');
    if (btnVendre) {
      btnVendre.addEventListener('click', () =>
        naviguer('vente-fiche', { nouveau: true, oeuvre_id: o.id })
      );
    }
    const btnVoirVente = contenu.querySelector('#btn-voir-vente');
    if (btnVoirVente) {
      btnVoirVente.addEventListener('click', () =>
        naviguer('vente-fiche', { id: ventes[0].id })
      );
    }
    const imageVision = contenu.querySelector('#image-vision');
    if (imageVision && o.image_path) {
      imageVision.addEventListener('click', () => visionner(urlPhoto(o.image_path)));
    }

    contenu.querySelector('#btn-produire-certificat').addEventListener('click', async () => {
      const cree = await ouvrirCreationCertificat({ oeuvre: o, vente: ventes[0] || null });
      if (cree) {
        // Génération auto du PDF immédiatement après création
        try {
          await window.api.pdfCertificatGenerer(cree.id);
        } catch (err) {
          await alerter({
            type: 'warning',
            title: 'Certificat enregistré, PDF non généré',
            message: `Le certificat ${cree.numero_delivrance} est enregistré mais le PDF n'a pas pu être généré.`,
            detail: err.message + "\n\nTu peux ré-essayer avec le bouton « Générer le PDF » dans la liste.",
          });
        }
        await rafraichirCertificats();
      }
    });

    brancherActionsCertificats();
    contenu.querySelectorAll('.btn-voisin-prec').forEach((btn) => {
      if (voisins.precedent) {
        btn.addEventListener('click', () =>
          remplacerCourant('oeuvre-fiche', { id: voisins.precedent.id })
        );
      }
    });
    contenu.querySelectorAll('.btn-voisin-suiv').forEach((btn) => {
      if (voisins.suivant) {
        btn.addEventListener('click', () =>
          remplacerCourant('oeuvre-fiche', { id: voisins.suivant.id })
        );
      }
    });
  }

  function dessinerEdition() {
    const artistesOptions = artistes
      .map((ar) => ({ valeur: ar.id, libelle: nomComplet(ar) || ar.nom || '' }))
      .sort((a, b) => sansAccents(a.libelle).localeCompare(sansAccents(b.libelle)));
    if (nouveau && o.artiste_id == null) {
      artistesOptions.unshift({ valeur: '', libelle: '— Choisir un artiste —' });
    }
    const statutsOptions = Object.entries(STATUTS).map(([k, v]) => ({ valeur: k, libelle: v.libelle }));
    const enchainement = !!params.enchainement;
    const enchainementCompte = Number(params.enchainement_compte) || 0;
    const enchainementNom = params.enchainement_artiste_nom || '';
    const titrePage = nouveau
      ? (enchainement
          ? `Ajouter une œuvre pour « ${ech(enchainementNom)} »`
          : 'Nouvelle œuvre')
      : `Modifier « ${ech(o.titre)} »`;

    const banniere = enchainement
      ? `<div class="banniere-enchainement">
           <strong>${enchainementCompte > 0
             ? `${enchainementCompte} œuvre${enchainementCompte > 1 ? 's' : ''} déjà ajoutée${enchainementCompte > 1 ? 's' : ''} pour ${ech(enchainementNom)}.`
             : `Ajout des œuvres pour ${ech(enchainementNom)}.`}</strong>
           <span class="aide-champ">Tu peux en ajouter autant que tu veux. Termine quand tu as fini.</span>
         </div>`
      : '';

    contenu.innerHTML = `
      <div class="vue-fiche">
        <h2 class="titre-formulaire">${titrePage}</h2>
        ${banniere}
        ${datalist('types-oeuvre', TYPES_OEUVRE)}
        ${datalist('formats', FORMATS)}
        ${datalist('orientations', ORIENTATIONS)}
        <form id="formulaire" class="formulaire" novalidate>
          <section class="bloc">
            <h3>Identité</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'titre', libelle: 'Titre', valeur: o.titre, requis: true })}
              ${champSelect({ nom: 'artiste_id', libelle: 'Artiste', valeur: o.artiste_id, options: artistesOptions })}
              ${champTexte({ nom: 'type', libelle: 'Type', valeur: o.type, liste: 'types-oeuvre' })}
              ${champTexte({ nom: 'annee', libelle: 'Année', valeur: o.annee, type: 'number', attributs: 'min="1000" max="2999"' })}
              ${champTexte({ nom: 'numero_inventaire', libelle: "Numéro d'inventaire", valeur: o.numero_inventaire })}
              ${champTexte({ nom: 'numero_delivrance', libelle: 'Numéro de délivrance', valeur: o.numero_delivrance })}
            </div>
          </section>

          <section class="bloc">
            <h3>Matériel et facture</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'medium', libelle: 'Médium', valeur: o.medium })}
              ${champTexte({ nom: 'support', libelle: 'Support', valeur: o.support })}
              ${champTexte({ nom: 'emplacement_signature', libelle: 'Emplacement de la signature', valeur: o.emplacement_signature })}
            </div>

            <div class="form-champ">
              <label>Dimensions (pouces)</label>
              <div class="dim-trio">
                <div class="dim-champ">
                  <input type="number" id="f-hauteur" name="hauteur" value="${o.hauteur ?? ''}" min="0" step="0.1" placeholder="0">
                  <span class="dim-libelle">Hauteur</span>
                </div>
                <span class="dim-mult">×</span>
                <div class="dim-champ">
                  <input type="number" id="f-largeur" name="largeur" value="${o.largeur ?? ''}" min="0" step="0.1" placeholder="0">
                  <span class="dim-libelle">Largeur</span>
                </div>
                <span class="dim-mult">×</span>
                <div class="dim-champ">
                  <input type="number" id="f-profondeur" name="profondeur" value="${o.profondeur ?? ''}" min="0" step="0.1" placeholder="0">
                  <span class="dim-libelle">Profondeur</span>
                </div>
                <span class="dim-unite">pouces</span>
              </div>
              <p class="aide-champ" id="dim-apercu">${o.dimensions ? `Saisie héritée : <em>${ech(o.dimensions)}</em>` : 'La profondeur est facultative.'}</p>
            </div>

            <div class="grille-form">
              ${champTexte({ nom: 'format', libelle: 'Format', valeur: o.format, liste: 'formats' })}
              ${champTexte({ nom: 'orientation', libelle: 'Orientation', valeur: o.orientation, liste: 'orientations' })}
            </div>
            <p class="aide-champ">Format et orientation se calculent automatiquement à partir des dimensions. Tu peux les modifier à la main.</p>

            ${champTexte({ nom: 'particularite', libelle: 'Particularité', valeur: o.particularite })}
            ${champTexte({ nom: 'sujets', libelle: 'Sujets (séparés par des virgules)', valeur: o.sujets })}
          </section>

          <!-- dimensions texte synchronisé en coulisse -->
          <input type="hidden" name="dimensions" id="f-dimensions" value="${ech(o.dimensions || '')}">

          <section class="bloc">
            <h3>Image</h3>
            <div class="zone-photo-edition">
              <div class="apercu-photo apercu-oeuvre">
                ${imagePendingDataUrl
                  ? `<img src="${imagePendingDataUrl}" alt="">`
                  : (o.image_path
                      ? `<img src="${urlPhoto(o.image_path)}" alt="">`
                      : '<span class="apercu-vide">Aucune image</span>')}
              </div>
              <div class="actions-photo">
                <button type="button" class="btn-action" id="btn-choisir-photo">${(o.image_path || imagePendingDataUrl) ? "Remplacer l'image…" : 'Choisir une image…'}</button>
                <button type="button" class="btn-action btn-danger" id="btn-effacer-photo" style="${(o.image_path || imagePendingDataUrl) ? '' : 'display:none'}">Retirer l'image</button>
              </div>
            </div>
            <p class="aide-champ">${nouveau
              ? "L'image sera enregistrée dans <code>Documents\\Galeria\\Photos\\oeuvres\\</code> lors de la création de l'œuvre."
              : "Le fichier est copié dans <code>Documents\\Galeria\\Photos\\oeuvres\\</code>. Ton original reste intact."}</p>
          </section>

          <section class="bloc">
            <h3>Description</h3>
            ${champTextarea({ nom: 'description', libelle: 'Description', valeur: o.description, lignes: 5 })}
            <div class="actions-ia">
              <button type="button" class="btn-action btn-secondaire-action" id="btn-copier-chatgpt">
                <span class="ia-icone" aria-hidden="true">✦</span>
                Copier pour ChatGPT
              </button>
              <p class="aide-champ">Copie le prompt assemblé (instructions galerie + instructions artiste + caractéristiques de l'œuvre) et la photo dans le presse-papier, puis ouvre ChatGPT. Tu colles, tu obtiens la suggestion, tu colles dans Description ci-dessus.</p>
            </div>
          </section>

          <section class="bloc">
            <h3>Commerce et localisation</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'prix', libelle: 'Prix régulier ($)', valeur: o.prix, type: 'number', attributs: 'step="0.01" min="0"' })}
              ${champSelect({ nom: 'statut', libelle: 'Statut', valeur: o.statut, options: statutsOptions })}
              ${champTexte({ nom: 'emplacement', libelle: 'Emplacement (gallerie)', valeur: o.emplacement })}
              ${champTexte({ nom: 'exposition_actuelle', libelle: 'Exposition actuelle', valeur: o.exposition_actuelle })}
            </div>
          </section>

          <div class="form-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler">Annuler</button>
            ${enchainement
              ? `<button type="submit" class="btn-action btn-secondaire-action" id="btn-terminer-enchainement">Terminer</button>
                 <button type="submit" class="btn-action btn-principal" id="btn-enregistrer-et-suivante">Enregistrer + ajouter une autre</button>`
              : `<button type="submit" class="btn-action btn-principal">${nouveau ? 'Créer' : 'Enregistrer'}</button>`}
          </div>
        </form>
      </div>
    `;

    const form = contenu.querySelector('#formulaire');

    function majPreviewPhoto() {
      const apercu = contenu.querySelector('.apercu-photo');
      if (apercu) {
        apercu.innerHTML = imagePendingDataUrl
          ? `<img src="${imagePendingDataUrl}" alt="">`
          : (o.image_path
              ? `<img src="${urlPhoto(o.image_path)}" alt="">`
              : '<span class="apercu-vide">Aucune image</span>');
      }
      const aImg = !!(o.image_path || imagePendingDataUrl);
      const btnChoisir = contenu.querySelector('#btn-choisir-photo');
      if (btnChoisir) btnChoisir.textContent = aImg ? "Remplacer l'image…" : 'Choisir une image…';
      const btnEffacer = contenu.querySelector('#btn-effacer-photo');
      if (btnEffacer) btnEffacer.style.display = aImg ? '' : 'none';
    }

    const btnChoisirPhoto = contenu.querySelector('#btn-choisir-photo');
    if (btnChoisirPhoto) {
      btnChoisirPhoto.addEventListener('click', async () => {
        btnChoisirPhoto.disabled = true;
        try {
          if (nouveau) {
            // Œuvre pas encore créée : on garde l'image en mémoire jusqu'au save
            const r = await window.api.photoLireFichier();
            if (r && !r.cancelled && r.dataUrl) {
              imagePendingDataUrl = r.dataUrl;
              modifie = true;
              majPreviewPhoto();
            }
          } else {
            const result = await window.api.photoChoisir('oeuvres', o.id);
            if (result && result.path !== undefined) {
              o.image_path = result.path;
              majPreviewPhoto();
            }
          }
        } catch (err) {
          await confirmer({
            type: 'error', title: 'Image non chargée',
            message: err.message, buttons: ['OK'],
          });
        } finally {
          btnChoisirPhoto.disabled = false;
        }
      });
    }

    const btnEffacerPhoto = contenu.querySelector('#btn-effacer-photo');
    if (btnEffacerPhoto) {
      btnEffacerPhoto.addEventListener('click', async () => {
        if (nouveau) {
          // Annule simplement la sélection en mémoire, pas d'opération disque
          imagePendingDataUrl = null;
          modifie = true;
          majPreviewPhoto();
          return;
        }
        const reponse = await confirmer({
          type: 'warning', title: 'Retirer cette image ?',
          message: "L'image sera effacée définitivement du dossier de la galerie.",
          buttons: ['Retirer', 'Annuler'],
          defaultId: 1, cancelId: 1,
        });
        if (reponse !== 0) return;
        try {
          await window.api.photoEffacer('oeuvres', o.id);
          o.image_path = null;
          majPreviewPhoto();
        } catch (err) {
          await confirmer({
            type: 'error', title: 'Suppression échouée',
            message: err.message, buttons: ['OK'],
          });
        }
      });
    }

    form.addEventListener('input', () => { modifie = true; });
    form.addEventListener('change', () => { modifie = true; });

    async function collecterEtCopierInline() {
      // Récupère ce que l'utilisateur a saisi dans le form (pas encore enregistré)
      // + l'image en mémoire (imagePendingDataUrl) ou la version sauvegardée.
      const fd = new FormData(form);
      const lire = (k) => {
        const v = fd.get(k);
        return v == null ? null : String(v).trim() || null;
      };
      const artisteId = Number(lire('artiste_id')) || null;
      const donneesOeuvre = {
        titre: lire('titre'),
        type: lire('type'),
        numero_inventaire: lire('numero_inventaire'),
        medium: lire('medium'),
        support: lire('support'),
        dimensions: lire('dimensions'),
        annee: lire('annee'),
        sujets: lire('sujets'),
        particularite: lire('particularite'),
        emplacement_signature: lire('emplacement_signature'),
        description: lire('description'),
      };

      // En mode création, l'image vient toujours du data URL en mémoire (choix
      // de l'utilisateur, pas encore enregistré sur disque).
      const imageDataUrl = imagePendingDataUrl || null;

      return window.api.iaCopierPourChatGPTInline({
        donneesOeuvre,
        artisteId,
        imageDataUrl,
      });
    }

    // ---- Bouton « Copier pour ChatGPT » ----
    const btnCopierChatGPT = contenu.querySelector('#btn-copier-chatgpt');
    if (btnCopierChatGPT) {
      btnCopierChatGPT.addEventListener('click', async () => {
        btnCopierChatGPT.disabled = true;
        const libelleOrigine = btnCopierChatGPT.innerHTML;
        try {
          // En mode création : on assemble depuis les champs du formulaire +
          // l'image en mémoire (data URL). Aucun enregistrement en base requis.
          // En mode édition : on utilise l'ID existant pour aller chercher
          // l'image sur le disque et tout assembler côté main.
          const r = nouveau
            ? await collecterEtCopierInline()
            : await window.api.iaCopierPourChatGPT(o.id);

          // Le presse-papier multi-format (texte + image) n'est pas toujours
          // accepté par les navigateurs lors d'un collage dans une zone de
          // saisie : Chrome ne garde que le texte. On ouvre donc systématiquement
          // une modale qui permet à l'utilisateur de copier ou glisser l'image
          // séparément, en plus de coller le texte.
          await ouvrirModaleEnvoyerChatGPT(r);
        } catch (err) {
          await alerter({
            type: 'error',
            title: 'Préparation du presse-papier échouée',
            message: err.message,
          });
        } finally {
          btnCopierChatGPT.disabled = false;
        }
      });
    }

    // ---- Calcul auto format / orientation / dimensions texte ----
    const elHauteur = form.elements.hauteur;
    const elLargeur = form.elements.largeur;
    const elProfondeur = form.elements.profondeur;
    const elFormat = form.elements.format;
    const elOrientation = form.elements.orientation;
    const elDimensions = form.elements.dimensions;
    const elApercu = contenu.querySelector('#dim-apercu');

    // L'utilisateur peut écraser format/orientation à la main ; on cesse alors
    // de les auto-remplir tant qu'il est dans cette session d'édition.
    let formatAuto = !o.format
      || o.format === calculerFormat(o.hauteur, o.largeur, o.profondeur);
    let orientationAuto = !o.orientation
      || o.orientation === calculerOrientation(o.hauteur, o.largeur);

    elFormat.addEventListener('input', () => { formatAuto = false; });
    elOrientation.addEventListener('input', () => { orientationAuto = false; });

    const majDimensions = () => {
      const h = elHauteur.value;
      const l = elLargeur.value;
      const p = elProfondeur.value;
      const texte = formaterDimensionsTexte(h, l, p);
      if (texte) {
        elDimensions.value = texte;
        if (elApercu) {
          elApercu.innerHTML = `Dimensions enregistrées : <strong>${ech(texte)}</strong>${(elProfondeur.value ? '' : ' <span style="color:var(--stone);">(profondeur facultative)</span>')}`;
        }
      } else if (o.dimensions && !h && !l && !p) {
        // Aucune nouvelle saisie : on garde l'ancienne valeur texte intacte.
        elDimensions.value = o.dimensions;
        if (elApercu) {
          elApercu.innerHTML = `Saisie héritée : <em>${ech(o.dimensions)}</em>`;
        }
      } else {
        elDimensions.value = '';
        if (elApercu) elApercu.textContent = 'La profondeur est facultative.';
      }

      if (formatAuto) {
        const f = calculerFormat(h, l, p);
        if (f) elFormat.value = f;
      }
      if (orientationAuto) {
        const ori = calculerOrientation(h, l);
        if (ori) elOrientation.value = ori;
      }
    };

    [elHauteur, elLargeur, elProfondeur].forEach((el) => {
      el.addEventListener('input', majDimensions);
    });
    majDimensions();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);

      const enchainerSuivante = enchainement && e.submitter?.id === 'btn-enregistrer-et-suivante';
      const terminerEnchainement = enchainement && e.submitter?.id === 'btn-terminer-enchainement';

      try {
        if (nouveau) {
          o = await window.api.oeuvreCreer(data);
          modifierParamsCourants({ id: o.id, nouveau: false });
          // Si une image a été choisie en amont, l'enregistrer maintenant que l'ID existe
          if (imagePendingDataUrl) {
            try {
              const r = await window.api.photoEnregistrerRecadree('oeuvres', o.id, imagePendingDataUrl, null);
              if (r?.path) o.image_path = r.path;
            } catch (errImg) {
              await alerter({
                type: 'warning',
                title: 'Œuvre créée, image non enregistrée',
                message: "L'œuvre a été créée mais l'image n'a pas pu être enregistrée.",
                detail: errImg.message + "\n\nTu peux ré-essayer depuis la fiche de l'œuvre.",
              });
            }
            imagePendingDataUrl = null;
          }
        } else {
          o = await window.api.oeuvreModifier(o.id, data);
        }
        if (enchainerSuivante) {
          leverGardien();
          remplacerCourant('oeuvre-fiche', {
            nouveau: true,
            artiste_id: params.artiste_id,
            enchainement: true,
            enchainement_compte: enchainementCompte + 1,
            enchainement_artiste_nom: enchainementNom,
          });
          return;
        }
        if (terminerEnchainement) {
          leverGardien();
          remplacerCourant('artiste-fiche', { id: params.artiste_id });
          return;
        }
        sortirEdition();
      } catch (err) {
        await confirmer({
          type: 'error',
          title: "Impossible d'enregistrer",
          message: err.message,
          buttons: ['OK'],
        });
      }
    });

    contenu.querySelector('#btn-annuler').addEventListener('click', async () => {
      if (modifie || nouveau) {
        const reponse = await confirmer({
          type: 'warning',
          title: nouveau ? 'Abandonner cette nouvelle œuvre ?' : 'Abandonner les modifications ?',
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
        if (enchainement) {
          remplacerCourant('artiste-fiche', { id: params.artiste_id });
        } else {
          retour();
        }
      } else {
        sortirEdition();
      }
    });
  }

  dessiner();
}
