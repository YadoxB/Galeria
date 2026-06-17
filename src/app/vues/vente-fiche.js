import { naviguer, retour, poserGardien, leverGardien, remplacerCourant } from '../router.js';
import {
  ech, sansAccents, pluriel,
  champTexte, champTextarea, champCheckbox,
  champPays, champSubdivision, brancherChangementPays,
  formaterPrix, formaterDate, nomComplet, urlPhoto,
} from '../commun.js';
import { confirmer, alerter } from '../dialogue.js';
import { chargerConfig } from '../marque.js';
import { ouvrirCreationCertificat } from './certificat-creation.js';

const MODES_PAIEMENT = ['Comptant', 'Chèque', 'Carte de crédit', 'Interac', 'Virement bancaire'];

function dateAujourdhui() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function calculerTaxe(prix, actif, taux) {
  if (!actif) return 0;
  const t = Number(taux);
  const p = Number(prix);
  if (!Number.isFinite(t) || !Number.isFinite(p)) return 0;
  return Math.round(p * t) / 100;
}

export async function rendreVenteFiche(contenu, params) {
  const estNouveau = !!params.nouveau;

  let v;
  let voisins = { precedent: null, suivant: null, position: null, total: 0 };
  let certificats = [];
  const config = await chargerConfig();
  const docs = config.documents;

  if (estNouveau) {
    const oeuvrePrechoisie = params.oeuvre_id ? await window.api.oeuvreGet(params.oeuvre_id) : null;
    const numeroFactureAuto = await window.api.venteApercuNumeroFacture();
    v = {
      id: null,
      oeuvre_id: oeuvrePrechoisie ? oeuvrePrechoisie.id : null,
      oeuvre_titre: oeuvrePrechoisie ? oeuvrePrechoisie.titre : null,
      oeuvre_prix: oeuvrePrechoisie ? oeuvrePrechoisie.prix : null,
      numero_inventaire: oeuvrePrechoisie ? oeuvrePrechoisie.numero_inventaire : null,
      image_path: oeuvrePrechoisie ? oeuvrePrechoisie.image_path : null,
      artiste_id: oeuvrePrechoisie ? oeuvrePrechoisie.artiste_id : null,
      artiste_nom: oeuvrePrechoisie ? oeuvrePrechoisie.artiste_nom : null,
      client_id: null, client_nom: null, client_prenom: null,
      date_vente: dateAujourdhui(),
      prix_vente: oeuvrePrechoisie?.prix ?? null,
      tps: oeuvrePrechoisie?.prix != null ? calculerTaxe(oeuvrePrechoisie.prix, docs.tps_actif, docs.tps_taux) : 0,
      tvq: oeuvrePrechoisie?.prix != null ? calculerTaxe(oeuvrePrechoisie.prix, docs.tvq_actif, docs.tvq_taux) : 0,
      mode_paiement: null,
      numero_facture: numeroFactureAuto,
      rabais_artiste: 0,
      rabais_galerie: 0,
      notes: null,
    };
  } else {
    const bundle = await window.api.venteFicheBundle(params.id);
    if (!bundle || !bundle.vente) {
      contenu.innerHTML = `<p class="erreur">Vente introuvable.</p>`;
      return;
    }
    v = bundle.vente;
    voisins = bundle.voisins;
    certificats = bundle.certificats;
  }

  async function rechargerBundle() {
    if (!v || !v.id) return;
    const bundle = await window.api.venteFicheBundle(v.id);
    if (bundle && bundle.vente) {
      v = bundle.vente;
      voisins = bundle.voisins;
      certificats = bundle.certificats;
    }
  }

  let mode = estNouveau ? 'edition' : 'lecture';
  let modifie = false;
  let nouveau = estNouveau;
  // Pour l'édition : taux mémorisés (puisque taxes sont stockées en montants $, pas en %)
  let tpsActifLocal = v.tps > 0 || (nouveau && docs.tps_actif);
  let tvqActifLocal = v.tvq > 0 || (nouveau && docs.tvq_actif);
  let tpsTauxLocal = docs.tps_taux;
  let tvqTauxLocal = docs.tvq_taux;
  if (!nouveau && v.prix_vente > 0) {
    if (v.tps > 0) tpsTauxLocal = Math.round((v.tps / v.prix_vente) * 10000) / 100;
    if (v.tvq > 0) tvqTauxLocal = Math.round((v.tvq / v.prix_vente) * 10000) / 100;
  }

  if (nouveau) poserGardien(gardienChangements);

  async function gardienChangements() {
    if (!modifie && !nouveau) return true;
    const reponse = await confirmer({
      type: 'warning',
      title: nouveau ? 'Abandonner cette vente ?' : 'Modifications non sauvegardées',
      message: nouveau
        ? "Cette vente n'a pas été enregistrée. Voulez-vous l'abandonner ?"
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
    const reponse = await confirmer({
      type: 'warning', title: 'Supprimer cette vente ?',
      message: v.numero_facture
        ? `Supprimer définitivement la vente ${v.numero_facture} ?`
        : 'Supprimer définitivement cette vente ?',
      detail: "L'œuvre redeviendra automatiquement disponible si aucune autre vente ne la lie. Cette action est irréversible.",
      buttons: ['Supprimer', 'Annuler'],
      defaultId: 1, cancelId: 1,
    });
    if (reponse !== 0) return;
    try {
      await window.api.venteSupprimer(v.id);
      leverGardien();
      retour();
    } catch (err) {
      await alerter({ type: 'error', title: 'Suppression échouée', message: err.message });
    }
  }

  function dessiner() {
    mode === 'lecture' ? dessinerLecture() : dessinerEdition();
  }

  function dessinerListeCertificatsVente(liste) {
    if (!liste || liste.length === 0) {
      return `<p class="liste-vide">Aucun certificat émis pour cette vente.</p>`;
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
                ${c.signataire ? `&nbsp;&middot;&nbsp;${ech(c.signataire)}` : ''}
              </p>
              ${c.particularite ? `<p class="ligne-meta"><em>${ech(c.particularite)}</em></p>` : ''}
            </div>
            <div class="actions-certif">
              ${c.pdf_path
                ? `<button type="button" class="btn-action btn-secondaire-action btn-voir-pdf-vente">Voir le PDF</button>
                   <button type="button" class="btn-action btn-secondaire-action btn-ouvrir-dossier-vente" title="Ouvrir le dossier">Ouvrir le dossier</button>
                   <button type="button" class="btn-action btn-secondaire-action btn-regen-pdf-vente">Re-générer</button>`
                : `<button type="button" class="btn-action btn-principal btn-gen-pdf-vente">Générer le PDF</button>`}
              <button type="button" class="btn-action btn-danger btn-suppr-certif-vente">Supprimer</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function rafraichirCertificatsVente() {
    certificats = await window.api.certificatsListeVente(v.id);
    const zone = contenu.querySelector('#liste-certificats-vente');
    if (zone) zone.innerHTML = dessinerListeCertificatsVente(certificats);
    brancherActionsCertificatsVente();
  }

  function brancherActionsCertificatsVente() {
    const idDeLigne = (e) => Number(e.currentTarget.closest('.ligne-certificat')?.dataset.id);

    contenu.querySelectorAll('.btn-suppr-certif-vente').forEach((btn) => {
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
          await rafraichirCertificatsVente();
        } catch (err) {
          await alerter({ type: 'error', title: 'Suppression échouée', message: err.message });
        }
      });
    });

    contenu.querySelectorAll('.btn-voir-pdf-vente').forEach((btn) => {
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

    contenu.querySelectorAll('.btn-ouvrir-dossier-vente').forEach((btn) => {
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
        await rafraichirCertificatsVente();
      } catch (err) {
        await alerter({ type: 'error', title: 'Génération échouée', message: err.message });
        btn.disabled = false;
        btn.textContent = ancien;
      }
    };
    contenu.querySelectorAll('.btn-gen-pdf-vente').forEach((btn) => btn.addEventListener('click', genererCertif));
    contenu.querySelectorAll('.btn-regen-pdf-vente').forEach((btn) => btn.addEventListener('click', genererCertif));
  }

  function dessinerLecture() {
    const client = nomComplet({ prenom: v.client_prenom, nom: v.client_nom });
    const sousTotal = Number(v.prix_vente) || 0;
    const rabArt = Number(v.rabais_artiste) || 0;
    const rabGal = Number(v.rabais_galerie) || 0;
    const prixRegulier = sousTotal + rabArt + rabGal;
    const tps = Number(v.tps) || 0;
    const tvq = Number(v.tvq) || 0;
    const total = sousTotal + tps + tvq;
    const aDesRabais = rabArt > 0 || rabGal > 0;

    // === Identité (N° facture + date + mode) ===
    const zoneIdentite = `
      <div class="carte zone-identite-vente">
        <div>
          <h1>${v.numero_facture ? ech(v.numero_facture) : 'Vente'}</h1>
          <p class="zone-identite-vente-meta">Vente du ${ech(formaterDate(v.date_vente))}</p>
          ${v.mode_paiement ? `<span class="zone-identite-vente-mode">${ech(v.mode_paiement)}</span>` : ''}
        </div>
        <div class="zone-identite-actions">
          <button class="btn-action btn-danger" id="btn-supprimer">Supprimer</button>
          <button class="btn-action btn-principal" id="btn-modifier">Modifier</button>
        </div>
      </div>
    `;

    // === Total (tuile navy plein) ===
    const zoneTotal = `
      <div class="zone-total">
        <span class="zone-total-label">Total</span>
        <span class="zone-total-montant">${formaterPrix(total)}</span>
        <div class="zone-total-recap">
          <div class="ligne"><span>Sous-total</span><strong>${formaterPrix(sousTotal)}</strong></div>
          ${tps > 0 ? `<div class="ligne"><span>TPS</span><span>${formaterPrix(tps)}</span></div>` : ''}
          ${tvq > 0 ? `<div class="ligne"><span>TVQ</span><span>${formaterPrix(tvq)}</span></div>` : ''}
        </div>
      </div>
    `;

    // === Œuvre + Client (côte à côte) ===
    const zoneOeuvre = `
      <div class="carte zone-oeuvre-vente">
        <h3>Œuvre vendue</h3>
        <button class="ligne-vente" id="aller-oeuvre" data-id="${v.oeuvre_id}">
          ${v.image_path
            ? `<div class="vignette avec-photo"><img src="${urlPhoto(v.image_path)}" loading="lazy" alt=""></div>`
            : `<div class="vignette"><span>&#9635;</span></div>`}
          <div class="info">
            <p class="ligne-titre">${ech(v.oeuvre_titre)}</p>
            <p class="ligne-meta">
              ${ech(v.artiste_nom)}
              ${v.numero_inventaire ? `&nbsp;&middot;&nbsp;${ech(v.numero_inventaire)}` : ''}
              ${v.dimensions ? `&nbsp;&middot;&nbsp;${ech(v.dimensions)}` : ''}
            </p>
          </div>
          <span class="chevron">&rsaquo;</span>
        </button>
      </div>
    `;

    const zoneClient = `
      <div class="carte zone-client-vente">
        <h3>Client</h3>
        <button class="ligne-vente" id="aller-client" data-id="${v.client_id}">
          <div class="vignette vignette-client"><span>&#128100;</span></div>
          <div class="info">
            <p class="ligne-titre">${ech(client)}</p>
            <p class="ligne-meta">
              ${v.client_courriel ? ech(v.client_courriel) : ''}
              ${v.client_telephone ? `&nbsp;&middot;&nbsp;${ech(v.client_telephone)}` : ''}
            </p>
          </div>
          <span class="chevron">&rsaquo;</span>
        </button>
      </div>
    `;

    // === Détails financiers (table type facture) ===
    const zoneDetails = `
      <div class="carte zone-details-vente">
        <h3>Détails financiers</h3>
        <table class="table-facture">
          <tbody>
            ${aDesRabais ? `<tr><td>Prix régulier</td><td>${formaterPrix(prixRegulier)}</td></tr>` : ''}
            ${rabArt > 0 ? `<tr class="ligne-rabais"><td>Rabais artiste</td><td>− ${formaterPrix(rabArt)}</td></tr>` : ''}
            ${rabGal > 0 ? `<tr class="ligne-rabais"><td>Rabais galerie</td><td>− ${formaterPrix(rabGal)}</td></tr>` : ''}
            <tr class="ligne-soustotal"><td>Sous-total</td><td>${formaterPrix(sousTotal)}</td></tr>
            ${tps > 0 ? `<tr><td>TPS</td><td>${formaterPrix(tps)}</td></tr>` : ''}
            ${tvq > 0 ? `<tr><td>TVQ</td><td>${formaterPrix(tvq)}</td></tr>` : ''}
            <tr class="ligne-total"><td>Total</td><td>${formaterPrix(total)}</td></tr>
          </tbody>
        </table>
      </div>
    `;

    // === Documents (actions + liste de docs générés) ===
    const factureArtisteHTML = v.facture_artiste_path ? `
      <div class="doc-ligne">
        <div class="doc-icone doc-icone-facture">A</div>
        <div class="doc-info">
          <p class="doc-titre">Facture artiste</p>
          <p class="doc-meta">PDF généré</p>
        </div>
        <div class="doc-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="btn-voir-facture-artiste">Voir le PDF</button>
          <button type="button" class="btn-action btn-secondaire-action" id="btn-ouvrir-dossier-facture-artiste" title="Ouvrir le dossier">Dossier</button>
          <button type="button" class="btn-action btn-secondaire-action" id="btn-regen-facture-artiste">Re-générer</button>
        </div>
      </div>
    ` : '';

    const zoneDocuments = `
      <div class="carte zone-documents-vente">
        <div class="entete-bloc-bento">
          <h3>Documents ${certificats.length > 0 ? `<span class="compteur-inline">(${certificats.length} certificat${certificats.length > 1 ? 's' : ''})</span>` : ''}</h3>
        </div>
        <div class="documents-actions">
          <button type="button" class="btn-action" id="btn-produire-certificat-vente">+ Produire un certificat</button>
          ${!v.facture_artiste_path ? '<button type="button" class="btn-action btn-principal" id="btn-gen-facture-artiste">+ Produire la facture artiste</button>' : ''}
        </div>
        <div class="documents-liste">
          ${factureArtisteHTML}
          <div id="liste-certificats-vente">
            ${dessinerListeCertificatsVente(certificats)}
          </div>
        </div>
      </div>
    `;

    // === Notes ===
    const zoneNotes = v.notes ? `
      <div class="carte zone-notes-bento">
        <h3>Notes internes</h3>
        <div class="texte-long">${ech(v.notes).replace(/\n/g, '<br>')}</div>
      </div>
    ` : '';

    // === Nav voisins ===
    const navVoisins = voisins.total > 1 ? `
      <nav class="nav-voisins" aria-label="Navigation entre ventes">
        <button class="btn-voisin btn-voisin-prec" ${voisins.precedent ? '' : 'disabled'} title="${voisins.precedent ? ech(voisins.precedent.nom) : ''}">
          <span class="fleche">&larr;</span>
          <span class="libelle-voisin">
            <span class="libelle-mini">Précédente</span>
            <span class="nom-voisin">${voisins.precedent ? ech(voisins.precedent.nom) : '—'}</span>
          </span>
        </button>
        <span class="position-voisin">${voisins.position} / ${voisins.total}</span>
        <button class="btn-voisin btn-voisin-suiv" ${voisins.suivant ? '' : 'disabled'} title="${voisins.suivant ? ech(voisins.suivant.nom) : ''}">
          <span class="libelle-voisin libelle-droite">
            <span class="libelle-mini">Suivante</span>
            <span class="nom-voisin">${voisins.suivant ? ech(voisins.suivant.nom) : '—'}</span>
          </span>
          <span class="fleche">&rarr;</span>
        </button>
      </nav>
    ` : '';

    contenu.innerHTML = `
      <div class="vue-fiche vue-fiche-bento">
        ${navVoisins}
        <div class="grille-bento">
          ${zoneIdentite}
          ${zoneTotal}
          ${zoneOeuvre}
          ${zoneClient}
          ${zoneDetails}
          ${zoneDocuments}
          ${zoneNotes}
        </div>
      </div>
    `;

    contenu.querySelector('#btn-modifier').addEventListener('click', entrerEdition);
    contenu.querySelector('#btn-supprimer').addEventListener('click', supprimer);
    contenu.querySelector('#aller-oeuvre').addEventListener('click', () =>
      naviguer('oeuvre-fiche', { id: v.oeuvre_id })
    );
    contenu.querySelector('#aller-client').addEventListener('click', () =>
      naviguer('client-fiche', { id: v.client_id })
    );
    const btnProduireCertif = contenu.querySelector('#btn-produire-certificat-vente');
    if (btnProduireCertif) {
      btnProduireCertif.addEventListener('click', async () => {
        const oeuvreCtx = {
          id: v.oeuvre_id,
          titre: v.oeuvre_titre,
          artiste_nom: v.artiste_nom,
          prix: v.oeuvre_prix,
        };
        const cree = await ouvrirCreationCertificat({ oeuvre: oeuvreCtx, vente: v });
        if (cree) {
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
          await rafraichirCertificatsVente();
        }
      });
    }
    brancherActionsCertificatsVente();

    const genererFactureArtiste = async (e) => {
      const btn = e.currentTarget;
      const ancien = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Génération…';
      try {
        const r = await window.api.pdfFactureArtisteGenerer(v.id);
        v.facture_artiste_path = r.pdf_path;
        // Re-rendre pour exposer Voir/Re-générer
        dessiner();
      } catch (err) {
        await alerter({ type: 'error', title: 'Génération échouée', message: err.message });
        btn.disabled = false;
        btn.textContent = ancien;
      }
    };
    contenu.querySelectorAll('#btn-gen-facture-artiste, #btn-regen-facture-artiste').forEach((btn) =>
      btn.addEventListener('click', genererFactureArtiste)
    );
    const btnVoirFacture = contenu.querySelector('#btn-voir-facture-artiste');
    if (btnVoirFacture && v.facture_artiste_path) {
      btnVoirFacture.addEventListener('click', async () => {
        try {
          await window.api.pdfOuvrir(v.facture_artiste_path);
        } catch (err) {
          await alerter({ type: 'error', title: 'Impossible d\'ouvrir le PDF', message: err.message });
        }
      });
    }
    const btnOuvrirDossierFa = contenu.querySelector('#btn-ouvrir-dossier-facture-artiste');
    if (btnOuvrirDossierFa && v.facture_artiste_path) {
      btnOuvrirDossierFa.addEventListener('click', async () => {
        try {
          await window.api.pdfRevelerDansExplorateur(v.facture_artiste_path);
        } catch (err) {
          await alerter({ type: 'error', title: 'Impossible d\'ouvrir le dossier', message: err.message });
        }
      });
    }

    contenu.querySelectorAll('.btn-voisin-prec').forEach((btn) => {
      if (voisins.precedent) {
        btn.addEventListener('click', () => remplacerCourant('vente-fiche', { id: voisins.precedent.id }));
      }
    });
    contenu.querySelectorAll('.btn-voisin-suiv').forEach((btn) => {
      if (voisins.suivant) {
        btn.addEventListener('click', () => remplacerCourant('vente-fiche', { id: voisins.suivant.id }));
      }
    });
  }

  function dessinerEdition() {
    const titrePage = nouveau ? 'Nouvelle vente' : `Modifier la vente ${v.numero_facture || ''}`;
    const dlModes = `<datalist id="modes-paiement">${MODES_PAIEMENT.map((m) => `<option value="${ech(m)}">`).join('')}</datalist>`;

    contenu.innerHTML = `
      <div class="vue-fiche">
        <h2 class="titre-formulaire">${titrePage}</h2>
        ${dlModes}
        <form id="formulaire" class="formulaire" novalidate>

          <section class="bloc">
            <h3>Œuvre vendue <span class="requis">*</span></h3>
            <div id="zone-oeuvre"></div>
          </section>

          <section class="bloc">
            <h3>Client <span class="requis">*</span></h3>
            <div id="zone-client"></div>
          </section>

          <section class="bloc">
            <h3>Date et numéro</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'date_vente', libelle: 'Date de vente', valeur: v.date_vente, type: 'date', requis: true })}
              ${champTexte({ nom: 'numero_facture', libelle: 'Numéro de facture', valeur: v.numero_facture || '' })}
            </div>
            ${nouveau ? '<p class="aide-champ">Le numéro est généré automatiquement depuis les réglages. Modifiable au besoin.</p>' : ''}
          </section>

          <section class="bloc">
            <h3>Montants</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'prix_vente', libelle: 'Prix de vente (sous-total)', valeur: v.prix_vente ?? '', type: 'number', attributs: 'min="0" step="0.01"', requis: true })}
            </div>
            <div class="bloc-secondaire">
              <h4 class="sous-titre">Rabais (optionnels)</h4>
              <div class="grille-form">
                ${champTexte({ nom: 'rabais_artiste', libelle: 'Rabais artiste ($)', valeur: v.rabais_artiste ?? 0, type: 'number', attributs: 'min="0" step="0.01"' })}
                ${champTexte({ nom: 'rabais_galerie', libelle: 'Rabais galerie ($)', valeur: v.rabais_galerie ?? 0, type: 'number', attributs: 'min="0" step="0.01"' })}
              </div>
              <p class="aide-champ">Apparaissent sur la facture artiste. Le prix régulier (avant rabais) est calculé automatiquement à partir du prix de vente et des rabais.</p>
            </div>
            <div class="bloc-secondaire">
              <h4 class="sous-titre">TPS</h4>
              <div class="grille-form">
                ${champCheckbox({ nom: 'tps_actif', libelle: 'Appliquer la TPS', valeur: tpsActifLocal })}
                ${champTexte({ nom: 'tps_taux', libelle: 'Taux (%)', valeur: tpsTauxLocal, type: 'number', attributs: 'min="0" max="100" step="0.001"' })}
              </div>
            </div>
            <div class="bloc-secondaire">
              <h4 class="sous-titre">TVQ</h4>
              <div class="grille-form">
                ${champCheckbox({ nom: 'tvq_actif', libelle: 'Appliquer la TVQ', valeur: tvqActifLocal })}
                ${champTexte({ nom: 'tvq_taux', libelle: 'Taux (%)', valeur: tvqTauxLocal, type: 'number', attributs: 'min="0" max="100" step="0.001"' })}
              </div>
            </div>
            <div id="recap-total" class="total-achats" aria-live="polite"></div>
          </section>

          <section class="bloc">
            <h3>Paiement</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'mode_paiement', libelle: 'Mode de paiement', valeur: v.mode_paiement, liste: 'modes-paiement' })}
            </div>
          </section>

          <section class="bloc">
            ${champTextarea({ nom: 'notes', libelle: 'Notes', valeur: v.notes, lignes: 3 })}
          </section>

          <div class="form-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler">Annuler</button>
            <button type="submit" class="btn-action btn-principal">${nouveau ? 'Enregistrer la vente' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    `;

    const form = contenu.querySelector('#formulaire');
    form.addEventListener('input', () => { modifie = true; recalculerTotal(); });
    form.addEventListener('change', () => { modifie = true; recalculerTotal(); });

    dessinerSelecteurOeuvre();
    dessinerSelecteurClient();
    recalculerTotal();

    contenu.querySelector('#btn-annuler').addEventListener('click', async () => {
      if (modifie || nouveau) {
        const r = await confirmer({
          type: 'warning',
          title: nouveau ? 'Abandonner la saisie ?' : 'Abandonner les modifications ?',
          message: nouveau
            ? 'La vente ne sera pas enregistrée.'
            : 'Les modifications en cours seront perdues.',
          buttons: ['Abandonner', 'Continuer la saisie'],
          defaultId: 1, cancelId: 1,
        });
        if (r !== 0) return;
      }
      leverGardien();
      if (nouveau) retour();
      else sortirEdition();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const val = (k) => (fd.get(k) ?? '').toString().trim();
      const numVal = (k) => {
        const x = Number(val(k));
        return Number.isFinite(x) ? x : null;
      };

      if (!v.oeuvre_id) {
        await alerter({ type: 'warning', title: 'Œuvre manquante', message: 'Choisis une œuvre avant d\'enregistrer.' });
        return;
      }
      if (!v.client_id) {
        await alerter({ type: 'warning', title: 'Client manquant', message: 'Choisis un client (ou crées-en un) avant d\'enregistrer.' });
        return;
      }

      const prix = numVal('prix_vente') ?? 0;
      const tpsActif = form.elements.tps_actif.checked;
      const tvqActif = form.elements.tvq_actif.checked;
      const tpsTaux = numVal('tps_taux') ?? 0;
      const tvqTaux = numVal('tvq_taux') ?? 0;
      const tps = calculerTaxe(prix, tpsActif, tpsTaux);
      const tvq = calculerTaxe(prix, tvqActif, tvqTaux);

      const data = {
        oeuvre_id: v.oeuvre_id,
        client_id: v.client_id,
        date_vente: val('date_vente') || dateAujourdhui(),
        prix_vente: prix,
        rabais_artiste: Math.max(0, numVal('rabais_artiste') ?? 0),
        rabais_galerie: Math.max(0, numVal('rabais_galerie') ?? 0),
        tps, tvq,
        mode_paiement: val('mode_paiement'),
        numero_facture: val('numero_facture'),
        notes: val('notes'),
      };

      try {
        let resultat;
        if (nouveau) {
          // Réserver le numéro de facture si on a utilisé le numéro auto
          const apercu = await window.api.venteApercuNumeroFacture();
          if (data.numero_facture === apercu) {
            data.numero_facture = await window.api.venteReserverNumeroFacture();
          }
          resultat = await window.api.venteCreer(data);
        } else {
          resultat = await window.api.venteModifier(v.id, data);
        }
        leverGardien();
        modifie = false;
        if (nouveau) {
          await alerter({
            type: 'succes', title: 'Vente enregistrée',
            message: `La vente ${resultat.numero_facture || ''} a été enregistrée.`,
            detail: "L'œuvre est maintenant marquée comme vendue.",
          });
          // Remplacer la pile par la fiche en lecture
          await remplacerCourant('vente-fiche', { id: resultat.id });
        } else {
          v = resultat;
          await rechargerBundle();
          sortirEdition();
        }
      } catch (err) {
        await alerter({ type: 'error', title: 'Enregistrement échoué', message: err.message });
      }
    });
  }

  // ===== Sélecteur d'œuvre =====

  async function dessinerSelecteurOeuvre() {
    const zone = contenu.querySelector('#zone-oeuvre');
    if (!zone) return;

    if (v.oeuvre_id && v.oeuvre_titre) {
      zone.innerHTML = `
        <div class="carte-selection">
          ${v.image_path
            ? `<div class="vignette avec-photo"><img src="${urlPhoto(v.image_path)}" alt=""></div>`
            : `<div class="vignette"><span>&#9635;</span></div>`}
          <div class="info">
            <p class="ligne-titre">${ech(v.oeuvre_titre)}</p>
            <p class="ligne-meta">
              ${v.artiste_nom ? ech(v.artiste_nom) : ''}
              ${v.numero_inventaire ? `&nbsp;&middot;&nbsp;${ech(v.numero_inventaire)}` : ''}
              ${v.oeuvre_prix != null ? `&nbsp;&middot;&nbsp;${formaterPrix(v.oeuvre_prix)}` : ''}
            </p>
          </div>
          <button type="button" class="btn-action btn-secondaire-action" id="btn-changer-oeuvre">Changer</button>
        </div>
      `;
      contenu.querySelector('#btn-changer-oeuvre').addEventListener('click', () => {
        v.oeuvre_id = null;
        v.oeuvre_titre = null;
        v.image_path = null;
        v.artiste_nom = null;
        v.numero_inventaire = null;
        v.oeuvre_prix = null;
        modifie = true;
        dessinerSelecteurOeuvre();
      });
      return;
    }

    // Mode recherche
    zone.innerHTML = `
      <div class="bloc-recherche">
        <input type="search" id="rech-oeuvre" class="rech-inline" placeholder="Rechercher une œuvre disponible (titre, artiste, numéro)..." autocomplete="off">
        <div class="resultats-recherche" id="res-oeuvre"></div>
      </div>
    `;

    const oeuvres = await window.api.oeuvresListe({ statut: 'disponible' });
    const input = contenu.querySelector('#rech-oeuvre');
    const res = contenu.querySelector('#res-oeuvre');

    function afficher(filtre) {
      const f = sansAccents(filtre);
      const listFiltree = f
        ? oeuvres.filter((o) =>
            sansAccents([o.titre, o.artiste_nom, o.numero_inventaire].filter(Boolean).join(' ')).includes(f)
          ).slice(0, 30)
        : oeuvres.slice(0, 30);

      if (listFiltree.length === 0) {
        res.innerHTML = `<p class="liste-vide">${oeuvres.length === 0 ? 'Aucune œuvre disponible.' : 'Aucune œuvre ne correspond.'}</p>`;
        return;
      }

      res.innerHTML = listFiltree
        .map((o) => `
          <button type="button" class="ligne-vente" data-id="${o.id}">
            ${o.image_path
              ? `<div class="vignette avec-photo"><img src="${urlPhoto(o.image_path)}" loading="lazy" alt=""></div>`
              : `<div class="vignette"><span>&#9635;</span></div>`}
            <div class="info">
              <p class="ligne-titre">${ech(o.titre)}</p>
              <p class="ligne-meta">
                ${ech(o.artiste_nom)}
                ${o.numero_inventaire ? `&nbsp;&middot;&nbsp;${ech(o.numero_inventaire)}` : ''}
                ${o.prix != null ? `&nbsp;&middot;&nbsp;${formaterPrix(o.prix)}` : ''}
              </p>
            </div>
            <span class="chevron">&rsaquo;</span>
          </button>
        `).join('');

      res.querySelectorAll('.ligne-vente').forEach((btn) => {
        btn.addEventListener('click', () => {
          const o = oeuvres.find((x) => x.id === Number(btn.dataset.id));
          if (!o) return;
          v.oeuvre_id = o.id;
          v.oeuvre_titre = o.titre;
          v.image_path = o.image_path;
          v.artiste_nom = o.artiste_nom;
          v.numero_inventaire = o.numero_inventaire;
          v.oeuvre_prix = o.prix;
          // Pré-remplir le prix de vente s'il était vide
          const champPrix = contenu.querySelector('#f-prix_vente');
          if (champPrix && (!champPrix.value || Number(champPrix.value) === 0) && o.prix != null) {
            champPrix.value = o.prix;
          }
          modifie = true;
          dessinerSelecteurOeuvre();
          recalculerTotal();
        });
      });
    }

    input.addEventListener('input', (e) => afficher(e.target.value));
    afficher('');
  }

  // ===== Sélecteur de client =====

  async function dessinerSelecteurClient() {
    const zone = contenu.querySelector('#zone-client');
    if (!zone) return;

    if (v.client_id) {
      const nom = nomComplet({ prenom: v.client_prenom, nom: v.client_nom });
      zone.innerHTML = `
        <div class="carte-selection">
          <div class="vignette"><span>&#128100;</span></div>
          <div class="info">
            <p class="ligne-titre">${ech(nom)}</p>
            <p class="ligne-meta">
              ${v.client_courriel ? ech(v.client_courriel) : ''}
              ${v.client_telephone ? `&nbsp;&middot;&nbsp;${ech(v.client_telephone)}` : ''}
            </p>
          </div>
          <button type="button" class="btn-action btn-secondaire-action" id="btn-changer-client">Changer</button>
        </div>
      `;
      contenu.querySelector('#btn-changer-client').addEventListener('click', () => {
        v.client_id = null;
        v.client_nom = null;
        v.client_prenom = null;
        v.client_courriel = null;
        v.client_telephone = null;
        modifie = true;
        dessinerSelecteurClient();
      });
      return;
    }

    zone.innerHTML = `
      <div class="bloc-recherche">
        <div class="ligne-dossier">
          <input type="search" id="rech-client" class="rech-inline" placeholder="Rechercher un client (nom, courriel, téléphone)..." autocomplete="off">
          <button type="button" class="btn-action btn-secondaire-action" id="btn-nouveau-client">+ Nouveau client</button>
        </div>
        <div class="resultats-recherche" id="res-client"></div>
      </div>
    `;

    const clients = await window.api.clientsListe();
    const input = contenu.querySelector('#rech-client');
    const res = contenu.querySelector('#res-client');

    function afficher(filtre) {
      const f = sansAccents(filtre);
      const listFiltree = f
        ? clients.filter((c) =>
            sansAccents([c.prenom, c.nom, c.courriel, c.telephone, c.ville].filter(Boolean).join(' ')).includes(f)
          ).slice(0, 30)
        : clients.slice(0, 30);

      if (listFiltree.length === 0) {
        res.innerHTML = `<p class="liste-vide">${clients.length === 0 ? "Aucun client enregistré. Crée-en un avec le bouton ci-dessus." : "Aucun client ne correspond. Tu peux en créer un avec « + Nouveau client »."}</p>`;
        return;
      }

      res.innerHTML = listFiltree
        .map((c) => {
          const nom = nomComplet(c);
          return `
            <button type="button" class="ligne-vente" data-id="${c.id}">
              <div class="vignette"><span>&#128100;</span></div>
              <div class="info">
                <p class="ligne-titre">${ech(nom)}</p>
                <p class="ligne-meta">
                  ${c.courriel ? ech(c.courriel) : '<em>aucun courriel</em>'}
                  ${c.telephone ? `&nbsp;&middot;&nbsp;${ech(c.telephone)}` : ''}
                  ${c.ville ? `&nbsp;&middot;&nbsp;${ech(c.ville)}` : ''}
                </p>
              </div>
              <span class="chevron">&rsaquo;</span>
            </button>
          `;
        }).join('');

      res.querySelectorAll('.ligne-vente').forEach((btn) => {
        btn.addEventListener('click', () => {
          const c = clients.find((x) => x.id === Number(btn.dataset.id));
          if (!c) return;
          v.client_id = c.id;
          v.client_nom = c.nom;
          v.client_prenom = c.prenom;
          v.client_courriel = c.courriel;
          v.client_telephone = c.telephone;
          modifie = true;
          dessinerSelecteurClient();
        });
      });
    }

    input.addEventListener('input', (e) => afficher(e.target.value));
    afficher('');

    contenu.querySelector('#btn-nouveau-client').addEventListener('click', async () => {
      const cree = await ouvrirCreationClient();
      if (cree) {
        v.client_id = cree.id;
        v.client_nom = cree.nom;
        v.client_prenom = cree.prenom;
        v.client_courriel = cree.courriel;
        v.client_telephone = cree.telephone;
        modifie = true;
        dessinerSelecteurClient();
      }
    });
  }

  function recalculerTotal() {
    const zone = contenu.querySelector('#recap-total');
    if (!zone) return;
    const form = contenu.querySelector('#formulaire');
    if (!form) return;
    const prix = Number(form.elements.prix_vente?.value) || 0;
    const tpsActif = !!form.elements.tps_actif?.checked;
    const tvqActif = !!form.elements.tvq_actif?.checked;
    const tpsTaux = Number(form.elements.tps_taux?.value) || 0;
    const tvqTaux = Number(form.elements.tvq_taux?.value) || 0;
    const tps = calculerTaxe(prix, tpsActif, tpsTaux);
    const tvq = calculerTaxe(prix, tvqActif, tvqTaux);
    const total = prix + tps + tvq;
    zone.innerHTML = `
      Sous-total ${formaterPrix(prix)}
      ${tps > 0 ? ` &middot; TPS ${formaterPrix(tps)}` : ''}
      ${tvq > 0 ? ` &middot; TVQ ${formaterPrix(tvq)}` : ''}
      &nbsp;&rArr;&nbsp;<strong>Total ${formaterPrix(total)}</strong>
    `;
  }

  dessiner();
}

// ===== Overlay de création complète de client (formulaire identique à la fiche client) =====

function dateAujourdhuiCli() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ouvrirCreationClient() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue" role="dialog" aria-modal="true" style="max-width: 720px; max-height: 90vh; overflow-y: auto;">
        <div class="dialogue-entete">
          <h3 class="dialogue-titre">Nouveau client</h3>
        </div>
        <p class="dialogue-message">Saisis les coordonnées du client. Tu pourras y revenir et compléter depuis la liste des clients.</p>
        <form id="form-client-complet" class="formulaire" novalidate>
          <section class="bloc">
            <h3>Identité</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'prenom', libelle: 'Prénom', valeur: '' })}
              ${champTexte({ nom: 'nom', libelle: 'Nom de famille', valeur: '', requis: true })}
            </div>
          </section>

          <section class="bloc">
            <h3>Coordonnées</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'courriel', libelle: 'Courriel', valeur: '', type: 'email' })}
              ${champTexte({ nom: 'telephone', libelle: 'Téléphone', valeur: '', type: 'tel', attributs: 'inputmode="tel" placeholder="(xxx) xxx-xxxx"' })}
            </div>
          </section>

          <section class="bloc">
            <h3>Adresse</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'numero_civique', libelle: 'Numéro civique', valeur: '' })}
              ${champTexte({ nom: 'rue', libelle: 'Rue', valeur: '' })}
              ${champTexte({ nom: 'appartement', libelle: 'Appartement / unité', valeur: '' })}
            </div>
            <div class="grille-form">
              ${champTexte({ nom: 'ville', libelle: 'Ville', valeur: '' })}
              ${champPays({ nom: 'pays', valeur: 'Canada' })}
              <div id="zone-province-client-rapide">
                ${champSubdivision({ nom: 'province', pays: 'Canada', valeur: '' })}
              </div>
              ${champTexte({ nom: 'code_postal', libelle: 'Code postal', valeur: '', attributs: 'maxlength="10" placeholder="H0H 0H0"' })}
            </div>
          </section>

          <section class="bloc">
            <h3>Consentement courriel (Loi 25)</h3>
            <p class="aide-champ">Coche seulement si le client a explicitement consenti à recevoir des courriels.</p>
            ${champCheckbox({ nom: 'consentement_courriel', libelle: 'Le client consent à recevoir des courriels', valeur: false })}
          </section>

          ${champTextarea({ nom: 'notes', libelle: 'Notes', valeur: '', lignes: 2 })}

          <div class="dialogue-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler-cli">Annuler</button>
            <button type="submit" class="btn-action btn-principal">Créer le client</button>
          </div>
        </form>
      </div>
    `;

    function fermer(resultat) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(resultat);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); fermer(null); }
    }

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) fermer(null);
    });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#form-client-complet');
    brancherChangementPays(form, { paysNom: 'pays', subNom: 'province', subZoneId: 'zone-province-client-rapide' });

    overlay.querySelector('#btn-annuler-cli').addEventListener('click', () => fermer(null));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const val = (k) => (fd.get(k) ?? '').toString().trim();
      const data = {
        prenom: val('prenom'),
        nom: val('nom'),
        courriel: val('courriel'),
        telephone: val('telephone'),
        numero_civique: val('numero_civique'),
        rue: val('rue'),
        appartement: val('appartement'),
        ville: val('ville'),
        province: val('province'),
        pays: val('pays') || 'Canada',
        code_postal: val('code_postal'),
        notes: val('notes'),
        consentement_courriel: form.elements.consentement_courriel.checked ? 1 : 0,
        consentement_date: form.elements.consentement_courriel.checked ? dateAujourdhuiCli() : null,
      };
      if (!data.nom) {
        await alerter({ type: 'warning', title: 'Nom requis', message: 'Le nom de famille du client est requis.' });
        return;
      }
      try {
        const cree = await window.api.clientCreer(data);
        fermer(cree);
      } catch (err) {
        await alerter({ type: 'error', title: 'Création échouée', message: err.message });
      }
    });

    overlay.querySelector('#f-prenom')?.focus();
  });
}
