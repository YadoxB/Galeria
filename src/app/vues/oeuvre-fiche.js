import { naviguer, retour, poserGardien, leverGardien, modifierParamsCourants, remplacerCourant } from '../router.js';
import {
  ech, formaterPrix, badgeStatut, STATUTS,
  champTexte, champTextarea, champSelect, champCheckbox, datalist, urlPhoto,
  champMedium, brancherDropdownMedium, chargerMediumsConnus,
  formaterDate, nomComplet, sansAccents, nettoyerErreur,
  badgeArchive, boutonArchive, basculerArchive,
} from '../commun.js';
import { calculerPrixSuggere } from '../calcul-prix.js';
import { visionner } from '../visionneuse.js';
import { confirmer, alerter } from '../dialogue.js';
import { ouvrirCreationCertificat } from './certificat-creation.js';

const TYPES_OEUVRE = ['Peinture', 'Sculpture', 'Reproduction', 'Photographie', 'Dessin', 'Estampe', 'Mixte'];
const ORIENTATIONS = ['Horizontale', 'Verticale', 'Carrée'];
const FORMATS = ['Petit', 'Moyen', 'Grand', 'Très grand'];
const STYLES = ['Figuratif', 'Abstrait', 'Mi-Figuratif'];
const SUJETS_PREDEFINIS = ['Marine', 'Portrait', 'Paysage', 'Nature morte', 'Abstraction', 'Coucher de soleil', 'Forêt', 'Côte', 'Urbain', 'Fleurs', 'Animaux', 'Symbolique', 'Argentique', 'Bois', 'Métal', 'Verre'];

function parserSujets(brut) {
  if (!brut) return [];
  return String(brut).split(',').map((s) => s.trim()).filter(Boolean);
}

const GABARIT_VIDE = {
  id: null,
  artiste_id: null,
  artiste_nom: '',
  titre: '',
  type: null, numero_inventaire: null, numero_delivrance: null,
  annee: null, medium: null, support: null, dimensions: null,
  hauteur: null, largeur: null, profondeur: null,
  format: null, orientation: null, style: null, sujets: null,
  cote_hors_normes: 0,
  emplacement_signature: null, particularite: null, description: null,
  prix: null, statut: 'disponible',
  emplacement: null, exposition_actuelle: null,
  url_site: null,
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
  let artiste = null;

  if (estNouveau) {
    o = { ...GABARIT_VIDE };
    if (params.artiste_id != null) {
      o.artiste_id = params.artiste_id;
    }
    artistes = await window.api.artistesListe();
    // Pré-remplir le numéro d'inventaire à partir du compteur global + préfixe artiste
    try {
      o.numero_inventaire = await window.api.oeuvreApercuNumeroInventaire(o.artiste_id || null);
    } catch {}
  } else {
    const bundle = await window.api.oeuvreFicheBundle(params.id);
    if (!bundle || !bundle.oeuvre) {
      contenu.innerHTML = `<p class="erreur">&OElig;uvre introuvable.</p>`;
      return;
    }
    o = bundle.oeuvre;
    voisins = bundle.voisins;
    ventes = bundle.ventes;
    certificats = bundle.certificats;
    artiste = bundle.artiste;
  }

  async function rechargerBundle() {
    if (!o || !o.id) return;
    const bundle = await window.api.oeuvreFicheBundle(o.id);
    if (bundle && bundle.oeuvre) {
      o = bundle.oeuvre;
      voisins = bundle.voisins;
      ventes = bundle.ventes;
      certificats = bundle.certificats;
      artiste = bundle.artiste;
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
        message: nettoyerErreur(err),
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
          await alerter({ type: 'error', title: 'Suppression échouée', message: nettoyerErreur(err) });
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
          await alerter({ type: 'error', title: 'Impossible d\'ouvrir le PDF', message: nettoyerErreur(err) });
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
          await alerter({ type: 'error', title: 'Impossible d\'ouvrir le dossier', message: nettoyerErreur(err) });
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
        await alerter({ type: 'error', title: 'Génération échouée', message: nettoyerErreur(err) });
        btn.disabled = false;
        btn.textContent = ancien;
      }
    };
    contenu.querySelectorAll('.btn-gen-pdf-certif').forEach((btn) => btn.addEventListener('click', genererCertif));
    contenu.querySelectorAll('.btn-regen-pdf-certif').forEach((btn) => btn.addEventListener('click', genererCertif));
  }

  function dessinerLecture() {
    // Helper champ (label + value) pour les sous-sections du bento.
    const champ = (libelle, valeur) => {
      const v = (valeur == null || valeur === '') ? '<span class="champ-vide">—</span>' : ech(valeur);
      return `<div class="champ"><span class="champ-lib">${ech(libelle)}</span><span class="champ-val">${v}</span></div>`;
    };

    // Calcul du prix préférentiel (depuis les cotes de l'artiste).
    let prixPreferentiel = null;
    if (artiste && !o.cote_hors_normes) {
      const suggere = calculerPrixSuggere({ artiste, oeuvre: o });
      if (suggere) prixPreferentiel = suggere.prix_preferentiel;
    }

    // === Image (carte porcelain avec object-fit: contain) ===
    const imageHtml = o.image_path
      ? `<div class="zone-image-bento avec-photo cliquable" id="image-vision" title="Voir en grand">
           ${o.archive ? `<span class="badge-archive-photo">Archivée</span>` : ''}
           <img src="${urlPhoto(o.image_path)}" alt="${ech(o.titre)}">
         </div>`
      : `<div class="zone-image-bento">
           ${o.archive ? `<span class="badge-archive-photo">Archivée</span>` : ''}
           <span class="zone-image-placeholder">&#9635;</span>
         </div>`;

    // === Carte Identité ===
    const prixBloc = `
      <div class="prix-paire">
        <div class="prix-item">
          <span class="prix-label">Courant</span>
          <span class="prix-val">${o.prix != null ? formaterPrix(o.prix) : '<span class="champ-vide">—</span>'}</span>
        </div>
        ${prixPreferentiel != null ? `
          <div class="prix-item prix-item-pref">
            <span class="prix-label">Préférentiel</span>
            <span class="prix-val">${formaterPrix(prixPreferentiel)}</span>
          </div>
        ` : ''}
        ${o.cote_hors_normes ? `<span class="pastille-bento">Hors normes</span>` : ''}
      </div>
    `;

    const venteLiee = (o.statut === 'vendu' || o.statut === 'vendue') && ventes.length > 0 ? ventes[0] : null;
    const clientNom = venteLiee ? [venteLiee.client_prenom, venteLiee.client_nom].filter(Boolean).join(' ') : '';

    const zoneIdentite = `
      <div class="carte zone-identite-bento">
        <div>
          <h1>${ech(o.titre)}</h1>
          <p class="zone-identite-artiste">par <button type="button" class="btn-lien" id="lien-artiste">${ech(o.artiste_nom)}</button></p>
          <div class="prix-statut-bloc">
            ${prixBloc}
            ${badgeStatut(o.statut)}
            ${o.archive ? '<span class="badge-archive">Retirée</span>' : ''}
          </div>
          ${o.url_site ? `<p class="zone-identite-lien"><button type="button" class="btn-lien" id="btn-voir-sur-site">Voir sur le site &rsaquo;</button></p>` : ''}
          ${venteLiee ? `<p class="zone-identite-lien"><button type="button" class="btn-lien" id="btn-voir-vente">Voir la vente ${venteLiee.numero_facture ? ech(venteLiee.numero_facture) + ' ' : ''}${clientNom ? '(' + ech(clientNom) + ') ' : ''}&rsaquo;</button></p>` : ''}
        </div>
        <div class="zone-identite-actions">
          <button class="btn-action btn-danger" id="btn-supprimer">Supprimer</button>
          ${o.archive
            ? `<button class="btn-action" id="btn-reintegrer">Réintégrer</button>`
            : (o.statut !== 'vendu' && o.statut !== 'vendue'
                ? `<button class="btn-action" id="btn-retirer">Retirer</button>`
                : '')}
          <button class="btn-action" id="btn-modifier">Modifier</button>
          ${o.statut !== 'vendu' && o.statut !== 'vendue'
            ? `<button class="btn-action btn-principal" id="btn-vendre">Vendre</button>`
            : ''}
        </div>
      </div>
    `;

    // === Caractéristiques ===
    const particulariteHtml = o.particularite
      ? `<div class="carac-particularite"><strong>Particularité.</strong> ${ech(o.particularite).replace(/\n/g, '<br>')}</div>`
      : '';

    const zoneCarac = `
      <div class="carte zone-carac-bento">
        <h3>Caractéristiques</h3>
        <div class="sous-section">
          <h4>Identification</h4>
          <div class="champs-grille-bento">
            ${champ('Type', o.type)}
            ${champ("N° d'inventaire", o.numero_inventaire)}
            ${champ('N° de délivrance', o.numero_delivrance)}
            ${champ('Année', o.annee)}
          </div>
        </div>
        <div class="sous-section">
          <h4>Matériel et facture</h4>
          <div class="champs-grille-bento">
            ${champ('Médium', o.medium)}
            ${champ('Support', o.support)}
            ${champ('Dimensions', o.dimensions)}
            ${champ('Format', o.format)}
            ${champ('Orientation', o.orientation)}
            ${champ('Style', o.style)}
            ${champ('Empl. signature', o.emplacement_signature)}
          </div>
          ${particulariteHtml}
        </div>
      </div>
    `;

    // === Localisation et sujets ===
    const sujets = (o.sujets || '').split(',').map((s) => s.trim()).filter(Boolean);
    const sujetsHtml = sujets.length
      ? sujets.map((s) => `<span class="puce">${ech(s)}</span>`).join('')
      : '<span class="champ-vide">Aucun sujet renseigné</span>';

    const zoneLocalisation = `
      <div class="carte zone-localisation-bento">
        <h3>Localisation et sujets</h3>
        <div class="sous-section">
          <h4>Emplacement et exposition</h4>
          <div class="champs-grille-bento">
            ${champ('Emplacement (galerie)', o.emplacement)}
            ${champ('Exposition actuelle', o.exposition_actuelle)}
          </div>
        </div>
        <div class="sous-section">
          <h4>Sujets</h4>
          <div class="sujets-zone">${sujetsHtml}</div>
        </div>
      </div>
    `;

    // === Préparation (Jalon 3 — Sage + site) ===
    const formaterDateLecture = (d) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return ech(d);
        return dt.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch { return ech(d); }
    };
    const blocPrep = (cle, titre, fait, dateVal, libelleFait, libelleAFaire, aideAFaire) => {
      if (fait) {
        return `
          <div class="sous-section">
            <h4>${titre}</h4>
            <div class="inline-prep">
              <span class="pastille-bento pastille-bento-positive">✓ ${libelleFait}</span>
              <input type="date" class="inline-date" data-prep-date="${cle}" value="${ech(dateVal || '')}">
              <button type="button" class="inline-annuler" data-prep-toggle="${cle}" data-prep-fait="0" title="Annuler">Annuler</button>
            </div>
          </div>`;
      }
      return `
        <div class="sous-section">
          <h4>${titre}</h4>
          <div class="inline-prep">
            <span class="pastille-bento ${cle === 'sage' ? 'pastille-bento-warn' : ''}">${libelleAFaire}</span>
            <button type="button" class="inline-marquer" data-prep-toggle="${cle}" data-prep-fait="1">✓ Marquer fait</button>
          </div>
          <div class="sous-section-ligne sous-section-libelle">${aideAFaire}</div>
        </div>`;
    };
    const zonePreparation = `
      <div class="carte zone-preparation">
        <h3>Préparation</h3>
        ${blocPrep('sage', 'Sage 50', o.sage_cree, o.sage_cree_date, 'Créée dans Sage', 'À créer dans Sage', 'Obligatoire avant la vente.')}
        ${blocPrep('stock', 'Stock', o.stock_fait, o.stock_fait_date, 'Mise en stock', 'À mettre en stock', "Une fois l'œuvre reçue et inventoriée.")}
        ${blocPrep('site', 'Site web', o.site_publie, o.site_publie_date, 'Publiée sur le site', 'Non publiée', 'Facultatif.')}
      </div>
    `;

    // === Description ===
    const zoneDescription = `
      <div class="carte zone-description-bento">
        <h3>Description</h3>
        ${o.description
          ? `<div class="texte-long">${ech(o.description).replace(/\n/g, '<br>')}</div>`
          : `<div class="description-vide">Aucune description renseignée.</div>`}
      </div>
    `;

    // === Certificats ===
    const zoneCertificats = `
      <div class="carte zone-certificats-bento">
        <div class="entete-bloc-bento">
          <h3>Certificats d'authenticité ${certificats.length > 0 ? `<span class="compteur-inline">(${certificats.length})</span>` : ''}</h3>
          <button type="button" class="btn-action" id="btn-produire-certificat">+ Produire un certificat</button>
        </div>
        <div id="liste-certificats">
          ${dessinerListeCertificats(certificats)}
        </div>
      </div>
    `;

    // === Nav voisins ===
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

    // === Assemblage ===
    contenu.innerHTML = `
      <div class="vue-fiche vue-fiche-bento">
        ${navVoisins}
        <div class="grille-bento">
          ${imageHtml}
          ${zoneIdentite}
          ${zoneCarac}
          ${zoneLocalisation}
          ${zonePreparation}
          ${zoneDescription}
          ${zoneCertificats}
        </div>
      </div>
    `;

    contenu.querySelector('#btn-modifier').addEventListener('click', entrerEdition);
    contenu.querySelector('#btn-supprimer').addEventListener('click', supprimer);
    const btnRetirer = contenu.querySelector('#btn-retirer');
    if (btnRetirer) {
      btnRetirer.addEventListener('click', () => demanderRetrait());
    }
    const btnReintegrer = contenu.querySelector('#btn-reintegrer');
    if (btnReintegrer) {
      btnReintegrer.addEventListener('click', async () => {
        const rep = await confirmer({
          type: 'question',
          title: "Réintégrer l'œuvre ?",
          message: `Remettre « ${o.titre} » dans le catalogue actif ?`,
          buttons: ['Réintégrer', 'Annuler'], defaultId: 0, cancelId: 1,
        });
        if (rep !== 0) return;
        try {
          o = await window.api.oeuvreRetrait(o.id, { retire: false });
          await rechargerBundle();
          dessiner();
        } catch (err) {
          await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) });
        }
      });
    }

    // Modale de retrait : date (défaut aujourd'hui) + motif optionnel.
    function demanderRetrait() {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      const aujourdHui = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const overlay = document.createElement('div');
      overlay.className = 'overlay-modale overlay-dialogue';
      overlay.innerHTML = `
        <div class="dialogue" role="dialog" aria-modal="true">
          <div class="dialogue-entete">
            <h3 class="dialogue-titre">Retirer l'œuvre de la galerie</h3>
          </div>
          <p class="dialogue-message">« ${ech(o.titre)} » sera retirée du catalogue actif (rendue à l'artiste). Réversible plus tard via « Réintégrer ».</p>
          <div class="form-champ">
            <label for="retrait-date">Date du retrait</label>
            <input type="date" id="retrait-date" value="${aujourdHui}">
          </div>
          <div class="form-champ">
            <label for="retrait-motif">Motif (optionnel)</label>
            <input type="text" id="retrait-motif" placeholder="Ex. reprise par l'artiste, fin d'exposition…" autocomplete="off">
          </div>
          <div class="dialogue-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="retrait-annuler">Annuler</button>
            <button type="button" class="btn-action btn-principal" id="retrait-ok">Retirer</button>
          </div>
        </div>`;
      const fermer = () => overlay.remove();
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(); });
      overlay.querySelector('#retrait-annuler').addEventListener('click', fermer);
      overlay.querySelector('#retrait-ok').addEventListener('click', async () => {
        const date = overlay.querySelector('#retrait-date').value || aujourdHui;
        const motif = overlay.querySelector('#retrait-motif').value.trim();
        fermer();
        try {
          o = await window.api.oeuvreRetrait(o.id, { retire: true, date, motif });
          await rechargerBundle();
          dessiner();
        } catch (err) {
          await alerter({ type: 'error', title: 'Échec du retrait', message: nettoyerErreur(err) });
        }
      });
      document.body.appendChild(overlay);
      overlay.querySelector('#retrait-date').focus();
    }
    contenu.querySelector('#lien-artiste').addEventListener('click', () =>
      naviguer('artiste-fiche', { id: o.artiste_id })
    );
    const btnVoirSite = contenu.querySelector('#btn-voir-sur-site');
    if (btnVoirSite && o.url_site) {
      btnVoirSite.addEventListener('click', () => window.api.ouvrirUrl(o.url_site));
    }
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

    // === Préparation inline-éditable (sans passer par Modifier) ===
    async function sauverPreparation() {
      try {
        o = await window.api.oeuvreMajPreparation(o.id, {
          sage_cree: o.sage_cree,
          sage_cree_date: o.sage_cree_date,
          stock_fait: o.stock_fait,
          stock_fait_date: o.stock_fait_date,
          site_publie: o.site_publie,
          site_publie_date: o.site_publie_date,
        });
        await rechargerBundle();
        dessiner();
      } catch (err) {
        await alerter({ type: 'error', title: 'Mise à jour échouée', message: nettoyerErreur(err) });
      }
    }
    const aujourdHuiISO = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    contenu.querySelectorAll('[data-prep-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cle = btn.dataset.prepToggle;
        const fait = btn.dataset.prepFait === '1';
        if (cle === 'sage') {
          o.sage_cree = fait ? 1 : 0;
          o.sage_cree_date = fait ? (o.sage_cree_date || aujourdHuiISO()) : null;
        } else if (cle === 'stock') {
          o.stock_fait = fait ? 1 : 0;
          o.stock_fait_date = fait ? (o.stock_fait_date || aujourdHuiISO()) : null;
        } else {
          o.site_publie = fait ? 1 : 0;
          o.site_publie_date = fait ? (o.site_publie_date || aujourdHuiISO()) : null;
        }
        sauverPreparation();
      });
    });
    contenu.querySelectorAll('[data-prep-date]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const cle = inp.dataset.prepDate;
        if (cle === 'sage') o.sage_cree_date = inp.value || null;
        else if (cle === 'stock') o.stock_fait_date = inp.value || null;
        else o.site_publie_date = inp.value || null;
        sauverPreparation();
      });
    });

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

    // === SVG des icônes overlay sur l'image ===
    const svgRemplacer = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
    const svgSupprimer = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
    const svgImageVide = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5L5 21"/></svg>`;

    const aImageInitiale = !!(o.image_path || imagePendingDataUrl);
    const urlImageInitiale = imagePendingDataUrl || (o.image_path ? urlPhoto(o.image_path) : '');
    const imageHtmlInitial = aImageInitiale
      ? `<img src="${urlImageInitiale}" alt="">
         <div class="image-actions-overlay">
           <button type="button" class="image-action-btn" id="btn-choisir-photo" title="Remplacer l'image">${svgRemplacer}</button>
           <button type="button" class="image-action-btn btn-supprimer" id="btn-effacer-photo" title="Retirer l'image">${svgSupprimer}</button>
         </div>`
      : `<button type="button" class="image-choisir" id="btn-choisir-photo">${svgImageVide}Choisir une image…</button>`;

    // === Sujets en chips ===
    const sujetsActuels = parserSujets(o.sujets);
    const tousSujets = Array.from(new Set([...SUJETS_PREDEFINIS, ...sujetsActuels])).sort((a, b) => sansAccents(a).localeCompare(sansAccents(b)));
    const sujetsActifsInit = new Set(sujetsActuels.map((s) => s));
    const chipsHtml = tousSujets.map((s) => `
      <button type="button" class="chip ${sujetsActifsInit.has(s) ? 'chip-actif' : ''}" data-sujet="${ech(s)}">${ech(s)}</button>
    `).join('') + `<button type="button" class="chip chip-ajouter" id="btn-sujet-ajouter">+ Ajouter un sujet</button>`;

    contenu.innerHTML = `
      <div class="vue-fiche vue-fiche-bento">
        <h2 class="titre-formulaire">${titrePage}</h2>
        ${banniere}
        ${datalist('types-oeuvre', TYPES_OEUVRE)}
        ${datalist('formats', FORMATS)}
        ${datalist('orientations', ORIENTATIONS)}
        <form id="formulaire" class="formulaire" novalidate>
          <div class="grille-bento">

            <!-- Image (3 col) -->
            <div class="carte zone-image-edition">
              <div class="image-edition-bento ${aImageInitiale ? 'avec-image' : ''}" id="zone-image-overlay">
                ${imageHtmlInitial}
              </div>
            </div>

            <!-- Identité (9 col) -->
            <div class="carte span-9">
              <h3>Identité</h3>
              <div class="grille-form">
                ${champTexte({ nom: 'titre', libelle: 'Titre', valeur: o.titre, requis: true })}
                ${champSelect({ nom: 'artiste_id', libelle: 'Artiste', valeur: o.artiste_id, options: artistesOptions })}
                ${champTexte({ nom: 'type', libelle: 'Type', valeur: o.type, liste: 'types-oeuvre' })}
                ${champTexte({ nom: 'annee', libelle: 'Année', valeur: o.annee, type: 'number', attributs: 'min="1000" max="2999"' })}
                ${champTexte({ nom: 'numero_inventaire', libelle: "Numéro d'inventaire", valeur: o.numero_inventaire })}
                ${champTexte({ nom: 'numero_delivrance', libelle: 'Numéro de délivrance', valeur: o.numero_delivrance })}
              </div>
            </div>

            <!-- Caractéristiques (8 col) -->
            <div class="carte span-8">
              <h3>Caractéristiques</h3>
              <div class="sous-section">
                <h4>Matériel et facture</h4>
                <div class="grille-form">
                  ${champMedium({ nom: 'medium', libelle: 'Médium', valeur: o.medium })}
                  ${champTexte({ nom: 'support', libelle: 'Support', valeur: o.support })}
                  ${champTexte({ nom: 'emplacement_signature', libelle: 'Emplacement de la signature', valeur: o.emplacement_signature })}
                </div>
              </div>
              <div class="sous-section">
                <div class="dim-entete">
                  <h4>Dimensions</h4>
                  <div class="taille-vue" role="group" aria-label="Unité de mesure">
                    <button type="button" data-unite-dim="po" class="actif">pouces</button>
                    <button type="button" data-unite-dim="cm">cm</button>
                  </div>
                </div>
                <div class="form-champ">
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
                    <span class="dim-unite" id="f-dim-unite">pouces</span>
                  </div>
                  <p class="aide-champ" id="dim-apercu">${o.dimensions ? `Saisie héritée : <em>${ech(o.dimensions)}</em>` : 'La profondeur est facultative.'}</p>
                </div>
                <div class="grille-form">
                  ${champTexte({ nom: 'format', libelle: 'Format', valeur: o.format, liste: 'formats' })}
                  ${champTexte({ nom: 'orientation', libelle: 'Orientation', valeur: o.orientation, liste: 'orientations' })}
                  ${champSelect({ nom: 'style', libelle: 'Style', valeur: o.style, options: [
                    { valeur: '', libelle: '— Non précisé —' },
                    ...STYLES.map((s) => ({ valeur: s, libelle: s })),
                  ]})}
                </div>
                <p class="aide-champ">Format et orientation se calculent automatiquement à partir des dimensions. Le style est à saisir à la main.</p>
              </div>
              <div class="sous-section">
                <h4>Particularité</h4>
                ${champTexte({ nom: 'particularite', libelle: '', valeur: o.particularite, attributs: 'placeholder="Ex. signée au verso, dédicacée à…"' })}
              </div>
            </div>

            <!-- Commerce et localisation (4 col) -->
            <div class="carte span-4">
              <h3>Commerce et localisation</h3>
              <div class="grille-form">
                ${champTexte({ nom: 'prix', libelle: 'Prix régulier ($)', valeur: o.prix, type: 'number', attributs: 'step="0.01" min="0"' })}
                ${champSelect({ nom: 'statut', libelle: 'Statut', valeur: o.statut, options: statutsOptions })}
                ${champTexte({ nom: 'emplacement', libelle: 'Emplacement (galerie)', valeur: o.emplacement })}
                ${champTexte({ nom: 'exposition_actuelle', libelle: 'Exposition actuelle', valeur: o.exposition_actuelle })}
              </div>
              <div id="zone-prix-suggere"></div>
              ${champCheckbox({ nom: 'cote_hors_normes', libelle: 'Cote hors-normes (œuvre exceptionnelle, prix saisi à la main)', valeur: !!o.cote_hors_normes })}
              ${champTexte({ nom: 'url_site', libelle: "URL de la fiche sur le site web", valeur: o.url_site, type: 'url', attributs: 'placeholder="https://galerievieuxstjean.com/produit/…"' })}
            </div>

            <!-- Préparation (6 col) -->
            <div class="carte span-6">
              <h3>Préparation</h3>
              <p class="aide-champ" style="margin-top:0;"><strong>Sage est obligatoire</strong> avant la vente. Le site est facultatif.</p>
              <div class="sous-section">
                <h4>Sage 50</h4>
                <div class="grille-form">
                  ${champCheckbox({ nom: 'sage_cree', libelle: 'Créée dans Sage 50', valeur: !!o.sage_cree })}
                  ${champTexte({ nom: 'sage_cree_date', libelle: 'Date Sage', valeur: o.sage_cree_date, type: 'date' })}
                </div>
              </div>
              <div class="sous-section">
                <h4>Stock</h4>
                <div class="grille-form">
                  ${champCheckbox({ nom: 'stock_fait', libelle: 'Mise en stock', valeur: !!o.stock_fait })}
                  ${champTexte({ nom: 'stock_fait_date', libelle: 'Date stock', valeur: o.stock_fait_date, type: 'date' })}
                </div>
              </div>
              <div class="sous-section">
                <h4>Site web</h4>
                <div class="grille-form">
                  ${champCheckbox({ nom: 'site_publie', libelle: 'Publiée sur le site', valeur: !!o.site_publie })}
                  ${champTexte({ nom: 'site_publie_date', libelle: 'Date site', valeur: o.site_publie_date, type: 'date' })}
                </div>
              </div>
              <p class="aide-champ">Les dates s'auto-remplissent à aujourd'hui à la coche si vides.</p>
            </div>

            <!-- Sujets en chips (6 col) -->
            <div class="carte span-6">
              <h3>Sujets</h3>
              <p class="aide-champ" style="margin-top:0;">Clique pour activer ou désactiver. Alimentent les filtres et la recherche.</p>
              <div class="chip-zone" id="zone-sujets">${chipsHtml}</div>
              <input type="hidden" name="sujets" id="f-sujets" value="${ech(o.sujets || '')}">
            </div>

            <!-- Description (12 col) -->
            <div class="carte span-12">
              <h3>Description</h3>
              ${champTextarea({ nom: 'description', libelle: '', valeur: o.description, lignes: 5 })}
              <div class="actions-ia">
                <button type="button" class="btn-action btn-secondaire-action" id="btn-copier-chatgpt">
                  <span class="ia-icone" aria-hidden="true">✦</span>
                  Copier pour ChatGPT
                </button>
                <p class="aide-champ">Copie le prompt assemblé (consignes galerie + consignes artiste + caractéristiques) et la photo dans le presse-papier, puis ouvre ChatGPT.</p>
              </div>
            </div>

          </div>

          <!-- dimensions texte synchronisé en coulisse -->
          <input type="hidden" name="dimensions" id="f-dimensions" value="${ech(o.dimensions || '')}">

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

    function rendreImageZone() {
      const zone = contenu.querySelector('#zone-image-overlay');
      if (!zone) return;
      const aImg = !!(o.image_path || imagePendingDataUrl);
      const urlImg = imagePendingDataUrl || (o.image_path ? urlPhoto(o.image_path) : '');
      zone.classList.toggle('avec-image', aImg);
      zone.innerHTML = aImg
        ? `<img src="${urlImg}" alt="">
           <div class="image-actions-overlay">
             <button type="button" class="image-action-btn" id="btn-choisir-photo" title="Remplacer l'image">${svgRemplacer}</button>
             <button type="button" class="image-action-btn btn-supprimer" id="btn-effacer-photo" title="Retirer l'image">${svgSupprimer}</button>
           </div>`
        : `<button type="button" class="image-choisir" id="btn-choisir-photo">${svgImageVide}Choisir une image…</button>`;
      brancherBoutonsImage();
    }
    const majPreviewPhoto = rendreImageZone;

    function brancherBoutonsImage() {
      const btnChoisirPhoto = contenu.querySelector('#btn-choisir-photo');
      if (btnChoisirPhoto) {
        btnChoisirPhoto.addEventListener('click', async () => {
          btnChoisirPhoto.disabled = true;
          try {
            if (nouveau) {
              const r = await window.api.photoLireFichier();
              if (r && !r.cancelled && r.dataUrl) {
                imagePendingDataUrl = r.dataUrl;
                modifie = true;
                rendreImageZone();
              }
            } else {
              const result = await window.api.photoChoisir('oeuvres', o.id);
              if (result && result.path !== undefined) {
                o.image_path = result.path;
                rendreImageZone();
              }
            }
          } catch (err) {
            await confirmer({
              type: 'error', title: 'Image non chargée',
              message: nettoyerErreur(err), buttons: ['OK'],
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
            imagePendingDataUrl = null;
            modifie = true;
            rendreImageZone();
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
            rendreImageZone();
          } catch (err) {
            await confirmer({
              type: 'error', title: 'Suppression échouée',
              message: nettoyerErreur(err), buttons: ['OK'],
            });
          }
        });
      }
    }
    brancherBoutonsImage();

    // === Sujets en chips (toggle + ajouter) ===
    const sujetsActifs = new Set(sujetsActifsInit);
    function majChampSujets() {
      const champ = contenu.querySelector('#f-sujets');
      if (champ) champ.value = Array.from(sujetsActifs).join(', ');
    }
    function rendreChips() {
      const zone = contenu.querySelector('#zone-sujets');
      if (!zone) return;
      const liste = Array.from(new Set([...SUJETS_PREDEFINIS, ...sujetsActifs])).sort((a, b) => sansAccents(a).localeCompare(sansAccents(b)));
      zone.innerHTML = liste.map((s) => `
        <button type="button" class="chip ${sujetsActifs.has(s) ? 'chip-actif' : ''}" data-sujet="${ech(s)}">${ech(s)}</button>
      `).join('') + `<button type="button" class="chip chip-ajouter" id="btn-sujet-ajouter">+ Ajouter un sujet</button>`;
      brancherChips();
    }
    function brancherChips() {
      contenu.querySelectorAll('[data-sujet]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.sujet;
          if (sujetsActifs.has(s)) sujetsActifs.delete(s);
          else sujetsActifs.add(s);
          majChampSujets();
          modifie = true;
          btn.classList.toggle('chip-actif');
        });
      });
      const btnAjouter = contenu.querySelector('#btn-sujet-ajouter');
      if (btnAjouter) {
        btnAjouter.addEventListener('click', async () => {
          const nv = (window.prompt('Nouveau sujet :') || '').trim();
          if (!nv) return;
          sujetsActifs.add(nv);
          majChampSujets();
          modifie = true;
          rendreChips();
        });
      }
    }
    brancherChips();

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
            message: nettoyerErreur(err),
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
    const elArtiste = form.elements.artiste_id;
    const elInventaire = form.elements.numero_inventaire;

    // ---- Dropdown médium (composant partagé, même que les cotes) ----
    // dessinerEdition() n'est pas async : on remplit les listes via des
    // promesses ; le dropdown les lit à l'ouverture (getMediums).
    const wrapMedium = contenu.querySelector('[data-medium-wrap]');
    if (wrapMedium) {
      let mediumsConnus = [];
      let mediumsArtiste = [];
      chargerMediumsConnus().then((m) => { mediumsConnus = m; });
      const majMediumsArtiste = (id) => {
        if (!id) { mediumsArtiste = []; return; }
        window.api.oeuvresMediumsArtiste(Number(id))
          .then((m) => { mediumsArtiste = m; })
          .catch(() => { mediumsArtiste = []; });
      };
      majMediumsArtiste(elArtiste && elArtiste.value);
      brancherDropdownMedium(wrapMedium, {
        getMediums: () => ({ mediumsArtiste, mediumsConnus }),
        inclureTous: false,
      });
      if (elArtiste) elArtiste.addEventListener('change', () => { majMediumsArtiste(elArtiste.value); });
    }
    // Auto-rafraîchir le numéro d'inventaire quand l'artiste change, à condition
    // que l'utilisateur n'ait pas déjà modifié manuellement le champ.
    if (nouveau && elArtiste && elInventaire) {
      let derniereSuggestion = elInventaire.value;
      elInventaire.addEventListener('input', () => { derniereSuggestion = null; });
      elArtiste.addEventListener('change', async () => {
        if (derniereSuggestion === null) return;
        try {
          const sug = await window.api.oeuvreApercuNumeroInventaire(elArtiste.value ? Number(elArtiste.value) : null);
          if (sug) { elInventaire.value = sug; derniereSuggestion = sug; }
        } catch {}
      });
    }
    const elOrientation = form.elements.orientation;
    const elDimensions = form.elements.dimensions;
    const elApercu = contenu.querySelector('#dim-apercu');

    // ---- Unité de mesure des dimensions (pouces ⇄ cm) ----
    // La source de vérité reste toujours en pouces (dimPo) ; l'affichage est
    // converti à la volée. Texte des dimensions, format, orientation et
    // sauvegarde utilisent les pouces, quelle que soit l'unité affichée.
    const PO_EN_CM = 2.54;
    let uniteDim = 'po';
    const dimPo = { h: null, l: null, p: null };
    const labelUniteDim = contenu.querySelector('#f-dim-unite');
    const arrondi2Dim = (n) => Math.round(n * 100) / 100;
    function lireSaisieDim() {
      const f = uniteDim === 'cm' ? PO_EN_CM : 1;
      const conv = (el) => { const v = parseFloat(el.value); return Number.isFinite(v) ? arrondi2Dim(v / f) : null; };
      dimPo.h = conv(elHauteur);
      dimPo.l = conv(elLargeur);
      dimPo.p = conv(elProfondeur);
    }
    function afficherUniteDim() {
      const f = uniteDim === 'cm' ? PO_EN_CM : 1;
      const show = (el, v) => { el.value = v != null ? arrondi2Dim(v * f) : ''; };
      show(elHauteur, dimPo.h);
      show(elLargeur, dimPo.l);
      show(elProfondeur, dimPo.p);
      if (labelUniteDim) labelUniteDim.textContent = uniteDim === 'cm' ? 'cm' : 'pouces';
    }
    contenu.querySelectorAll('[data-unite-dim]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.uniteDim === uniteDim) return;
        contenu.querySelectorAll('[data-unite-dim]').forEach((x) => x.classList.toggle('actif', x === b));
        uniteDim = b.dataset.uniteDim;
        afficherUniteDim();
      });
    });

    // L'utilisateur peut écraser format/orientation à la main ; on cesse alors
    // de les auto-remplir tant qu'il est dans cette session d'édition.
    let formatAuto = !o.format
      || o.format === calculerFormat(o.hauteur, o.largeur, o.profondeur);
    let orientationAuto = !o.orientation
      || o.orientation === calculerOrientation(o.hauteur, o.largeur);

    elFormat.addEventListener('input', () => { formatAuto = false; });
    elOrientation.addEventListener('input', () => { orientationAuto = false; });

    const majDimensions = () => {
      lireSaisieDim();
      const h = dimPo.h ?? '';
      const l = dimPo.l ?? '';
      const p = dimPo.p ?? '';
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

    // ====== Auto-date pour Sage et site (Jalon 3 — préparation) ======
    function aujourdhuiISO() {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    function brancherAutoDate(nomCase, nomDate) {
      const elCase = form.elements[nomCase];
      const elDate = form.elements[nomDate];
      if (!elCase || !elDate) return;
      elCase.addEventListener('change', () => {
        if (elCase.checked && !elDate.value) {
          elDate.value = aujourdhuiISO();
        }
      });
    }
    brancherAutoDate('sage_cree', 'sage_cree_date');
    brancherAutoDate('stock_fait', 'stock_fait_date');
    brancherAutoDate('site_publie', 'site_publie_date');

    // ====== Prix suggéré à partir des cotes de l'artiste ======
    const zonePrixSuggere = contenu.querySelector('#zone-prix-suggere');
    const elPrix = form.elements.prix;
    const elMedium = form.elements.medium;
    const elHorsNormes = form.elements.cote_hors_normes;
    let artisteCote = null;          // cache de l'artiste avec ses cotes
    let dernierPrixAuto = null;      // dernière valeur auto-appliquée
    let prixModifieManuellement = false;

    async function chargerArtisteCote(artisteId) {
      if (!artisteId) { artisteCote = null; return; }
      try { artisteCote = await window.api.artisteGet(Number(artisteId)); }
      catch { artisteCote = null; }
    }

    // L'utilisateur a tapé une valeur dans le champ Prix. Si elle diffère de
    // la dernière valeur auto-appliquée, on considère qu'il l'a écrasée
    // volontairement et on cesse l'auto-fill jusqu'à un reset (ou bouton).
    if (elPrix) {
      elPrix.addEventListener('input', () => {
        if (dernierPrixAuto != null && String(elPrix.value) !== String(dernierPrixAuto)) {
          prixModifieManuellement = true;
        }
      });
    }

    function rendrePrixSuggere() {
      if (!zonePrixSuggere) return;
      if (elHorsNormes?.checked) {
        zonePrixSuggere.innerHTML = `<p class="prix-suggere prix-suggere-horsnorm">Œuvre marquée <strong>hors-normes</strong>. Le prix est saisi à la main.</p>`;
        return;
      }
      if (!artisteCote || !artisteCote.cotes) {
        zonePrixSuggere.innerHTML = '';
        return;
      }
      const oeuvreVirt = {
        hauteur: dimPo.h || 0,
        largeur: dimPo.l || 0,
        medium: elMedium?.value || '',
        format: elFormat?.value || '',
      };
      const res = calculerPrixSuggere({ artiste: artisteCote, oeuvre: oeuvreVirt });
      if (!res) {
        zonePrixSuggere.innerHTML = `<p class="prix-suggere prix-suggere-aucun">Aucune cote applicable (vérifie médium, format, dimensions).</p>`;
        return;
      }

      // Auto-application du prix si l'utilisateur n'a pas tapé sa propre valeur.
      const prixCourantValeur = String(res.prix_courant);
      const valeurActuelle = String(elPrix?.value || '').trim();
      const peutAutoAppliquer = elPrix && !prixModifieManuellement && (
        valeurActuelle === '' ||
        valeurActuelle === String(dernierPrixAuto)
      );
      if (peutAutoAppliquer) {
        elPrix.value = prixCourantValeur;
        dernierPrixAuto = res.prix_courant;
        modifie = true;
      }

      const marqueEcrase = prixModifieManuellement
        ? '<span class="prix-suggere-note">Prix actuel saisi à la main · </span>'
        : '<span class="prix-suggere-note">Appliqué automatiquement · </span>';
      const libelleBouton = prixModifieManuellement ? 'Réappliquer' : 'Réappliquer';

      zonePrixSuggere.innerHTML = `
        <div class="prix-suggere prix-suggere-actif">
          <div class="prix-suggere-entete">
            <span class="prix-suggere-libelle">${marqueEcrase}Prix courant (encadré)</span>
            <span class="prix-suggere-valeur">${res.prix_courant.toLocaleString('fr-CA')} $</span>
            <button type="button" class="btn-action btn-secondaire-action" id="btn-utiliser-prix-suggere">${ech(libelleBouton)}</button>
          </div>
          <p class="prix-suggere-formule">${ech(res.formule_preferentiel)}<br>${ech(res.formule_courant)}</p>
          <p class="prix-suggere-formule">Préférentiel (sans cadre) : <strong>${res.prix_preferentiel.toLocaleString('fr-CA')} $</strong></p>
        </div>
      `;
      const btnUtiliser = zonePrixSuggere.querySelector('#btn-utiliser-prix-suggere');
      if (btnUtiliser) {
        btnUtiliser.addEventListener('click', () => {
          if (!elPrix) return;
          elPrix.value = res.prix_courant;
          dernierPrixAuto = res.prix_courant;
          prixModifieManuellement = false;
          modifie = true;
          rendrePrixSuggere();
        });
      }
    }

    // Chargement initial (artiste éventuellement déjà sélectionné)
    if (form.elements.artiste_id?.value) {
      // Si l'œuvre existe déjà avec un prix saisi, on présume qu'il est manuel.
      if (!nouveau && elPrix && elPrix.value) {
        prixModifieManuellement = true;
      }
      chargerArtisteCote(form.elements.artiste_id.value).then(rendrePrixSuggere);
    }
    if (form.elements.artiste_id) {
      form.elements.artiste_id.addEventListener('change', async () => {
        await chargerArtisteCote(form.elements.artiste_id.value);
        // Changement d'artiste → on réinitialise pour permettre une nouvelle
        // auto-application si le prix n'a pas encore été touché.
        rendrePrixSuggere();
      });
    }
    [elHauteur, elLargeur, elFormat, elMedium].forEach((el) => {
      if (el) el.addEventListener('input', rendrePrixSuggere);
      if (el && el.tagName === 'SELECT') el.addEventListener('change', rendrePrixSuggere);
    });
    if (elHorsNormes) {
      elHorsNormes.addEventListener('change', () => {
        if (elHorsNormes.checked && elPrix) {
          elPrix.value = '';
          dernierPrixAuto = null;
          prixModifieManuellement = true;
        } else if (!elHorsNormes.checked) {
          // On laisse l'utilisateur ré-enclencher l'auto-fill manuellement
          // en cliquant « Réappliquer » ; on n'écrase pas un prix déjà saisi.
          prixModifieManuellement = !!(elPrix && elPrix.value);
        }
        rendrePrixSuggere();
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);

      // Les dimensions sont toujours stockées en pouces, quelle que soit
      // l'unité affichée au moment de la saisie.
      lireSaisieDim();
      data.hauteur = dimPo.h != null ? dimPo.h : '';
      data.largeur = dimPo.l != null ? dimPo.l : '';
      data.profondeur = dimPo.p != null ? dimPo.p : '';

      const enchainerSuivante = enchainement && e.submitter?.id === 'btn-enregistrer-et-suivante';
      const terminerEnchainement = enchainement && e.submitter?.id === 'btn-terminer-enchainement';

      try {
        if (nouveau) {
          // Si l'utilisateur a gardé la valeur pré-remplie pour le numéro
          // d'inventaire, on réserve (= incrémente le compteur global).
          // Sinon (saisie manuelle), on laisse le compteur tel quel.
          const numAttendu = await window.api.oeuvreApercuNumeroInventaire(data.artiste_id ? Number(data.artiste_id) : null);
          if ((data.numero_inventaire || '').trim() === numAttendu && numAttendu) {
            try { await window.api.oeuvreReserverNumeroInventaire(data.artiste_id ? Number(data.artiste_id) : null); } catch {}
          }
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
