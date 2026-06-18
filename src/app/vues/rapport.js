import { ech, formaterPrix, nettoyerErreur } from '../commun.js';
import { chargerConfig } from '../marque.js';
import { alerter } from '../dialogue.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function aujourdHuiISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dateLongue(iso) {
  const [y, m, j] = iso.split('-').map(Number);
  return new Date(y, m - 1, j).toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function dateCourte(val) {
  if (!val) return '—';
  const [y, m, j] = String(val).slice(0, 10).split('-').map(Number);
  if (!y) return ech(String(val));
  return `${j} ${MOIS[m - 1]} ${y}`;
}
const totalVente = (v) => (Number(v.prix_vente) || 0) + (Number(v.tps) || 0) + (Number(v.tvq) || 0);

export async function rendreRapport(contenu) {
  let date = aujourdHuiISO();
  const config = await chargerConfig();
  const nomGalerie = config.galerie?.nom || 'La Galerie du Vieux Saint-Jean';

  contenu.innerHTML = `
    <div class="vue-rapport">
      <div class="rap-controls rap-noprint">
        <h2 class="entete-page-titre">Rapport journalier</h2>
        <div class="rap-date">
          <label for="rap-d">Journée</label>
          <input type="date" id="rap-d" value="${date}">
        </div>
        <button type="button" class="btn-action btn-principal" id="rap-imprimer" style="margin-left:auto;">Imprimer / PDF</button>
      </div>
      <p class="rap-date-titre rap-noprint" id="rap-date-titre"></p>
      <div class="rapport-ecran" id="rapport-ecran"></div>
      <div class="rapport-doc rapport-impression" id="rapport-impression"></div>
    </div>
  `;

  const ecran = contenu.querySelector('#rapport-ecran');
  const impression = contenu.querySelector('#rapport-impression');
  const titreDate = contenu.querySelector('#rap-date-titre');

  function totaux(r) {
    const sousTotal = r.ventes.reduce((s, v) => s + (Number(v.prix_vente) || 0), 0);
    const tps = r.ventes.reduce((s, v) => s + (Number(v.tps) || 0), 0);
    const tvq = r.ventes.reduce((s, v) => s + (Number(v.tvq) || 0), 0);
    return { sousTotal, tps, tvq, total: sousTotal + tps + tvq, nbIntrants: r.oeuvresAjoutees.length + r.artistesAjoutes.length };
  }

  // ===== Vue écran : le journal =====
  function peindreEcran(r) {
    const t = totaux(r);
    const tuile = (cls, val, lbl) => `<div class="rap-tuile ${cls}"><div class="v">${val}</div><div class="l">${lbl}</div></div>`;
    const ligne = (icone, titre, meta, montant) => `
      <div class="rap-row"><div class="pre">${icone}</div>
        <div class="corps"><p class="t">${ech(titre)}</p>${meta ? `<p class="m">${ech(meta)}</p>` : ''}</div>
        ${montant != null ? `<div class="montant">${formaterPrix(montant)}</div>` : ''}</div>`;

    const ventesHTML = r.ventes.length
      ? `<table class="rap-table">
          <thead><tr><th>Œuvre</th><th>Client</th><th class="num">Sous-total</th><th class="num">TPS</th><th class="num">TVQ</th><th class="num">Total</th></tr></thead>
          <tbody>${r.ventes.map((v) => `<tr>
            <td><strong>${ech(v.oeuvre_titre)}</strong>${v.numero_facture ? `<span class="rap-fact">${ech(v.numero_facture)}</span>` : ''}</td>
            <td>${ech(v.client_nom || '—')}</td>
            <td class="num">${formaterPrix(v.prix_vente)}</td><td class="num">${formaterPrix(v.tps)}</td><td class="num">${formaterPrix(v.tvq)}</td>
            <td class="num"><strong>${formaterPrix(totalVente(v))}</strong></td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2">Totaux</td><td class="num">${formaterPrix(t.sousTotal)}</td><td class="num">${formaterPrix(t.tps)}</td><td class="num">${formaterPrix(t.tvq)}</td><td class="num">${formaterPrix(t.total)}</td></tr></tfoot>
        </table>`
      : '<p class="rap-vide">Aucune vente ce jour.</p>';

    const intrantsHTML = `
      <div class="rap-sous">Œuvres ajoutées</div>
      ${r.oeuvresAjoutees.length ? r.oeuvresAjoutees.map((o) => ligne('&#9635;', o.titre, [o.artiste_nom, o.numero_inventaire].filter(Boolean).join(' · '))).join('') : '<p class="rap-vide">Aucune œuvre ajoutée.</p>'}
      <div class="rap-sous">Artistes ajoutés</div>
      ${r.artistesAjoutes.length ? r.artistesAjoutes.map((a) => ligne('&#128100;', a.nom, a.type || '')).join('') : '<p class="rap-vide">Aucun artiste ajouté.</p>'}`;

    const extrantsHTML = `
      <div class="rap-sous">Œuvres retirées de la galerie</div>
      ${r.oeuvresRetirees.length ? r.oeuvresRetirees.map((o) => ligne('&#9635;', o.titre, [o.artiste_nom, o.numero_inventaire, o.retrait_motif].filter(Boolean).join(' · '))).join('') : '<p class="rap-vide">Aucune œuvre retirée.</p>'}`;

    const a = r.activite || {};
    const blocAct = (titre, items, rendu) => `<div class="rap-act"><div class="rap-act-tete"><span>${titre}</span><span class="rap-act-n">${items.length}</span></div>${items.length ? items.map(rendu).join('') : '<p class="rap-vide">—</p>'}</div>`;
    const itemV = (v) => ligne('&#9635;', v.oeuvre_titre, v.client_nom || '');
    const activiteHTML = `<div class="rap-act-grid">
      ${blocAct('Paiements reçus', a.paiementsRecus || [], (v) => ligne('&#9635;', v.oeuvre_titre, v.client_nom || '', totalVente(v)))}
      ${blocAct('Emballées', a.emballages || [], itemV)}
      ${blocAct('Expédiées', a.envois || [], itemV)}
      ${blocAct('Livrées', a.livraisons || [], itemV)}
      ${blocAct('Certificats produits', a.certificats || [], (c) => ligne('C', c.numero || '—', c.oeuvre_titre))}
    </div>`;

    // ----- Suivi opérationnel (état en cours, indépendant de la date) -----
    const caseE = (ok) => `<span class="etat-case ${ok ? 'oui' : 'non'}">${ok ? '✓' : '✗'}</span>`;
    const su = r.suivi || { admissionsEnCours: [], ventesEnCours: [] };
    const admissionsHTML = su.admissionsEnCours.length
      ? `<table class="rap-table">
          <thead><tr><th>Œuvre</th><th>Artiste</th><th>Admission</th><th class="c">Sage</th><th class="c">Stock</th><th class="c">Web</th></tr></thead>
          <tbody>${su.admissionsEnCours.map((o) => `<tr>
            <td><strong>${ech(o.titre)}</strong></td><td>${ech(o.artiste_nom || '')}</td><td>${dateCourte(o.cree_le)}</td>
            <td class="c">${caseE(o.sage_cree)}</td><td class="c">${caseE(o.stock_fait)}</td><td class="c">${caseE(o.site_publie)}</td>
          </tr>`).join('')}</tbody>
        </table>`
      : '<p class="rap-vide">Aucune admission en cours.</p>';
    const ventesCoursHTML = su.ventesEnCours.length
      ? `<table class="rap-table">
          <thead><tr><th>Œuvre</th><th>Artiste</th><th>Client</th><th class="num">Prix</th><th class="c">Paie.</th><th class="c">Emb.</th><th class="c">Exp.</th><th class="c">Livr.</th></tr></thead>
          <tbody>${su.ventesEnCours.map((v) => `<tr>
            <td><strong>${ech(v.oeuvre_titre)}</strong></td><td>${ech(v.artiste_nom || '')}</td><td>${ech(v.client_nom || '—')}</td>
            <td class="num">${formaterPrix(v.prix_vente)}</td>
            <td class="c">${caseE(v.paiement_statut === 'recu')}</td><td class="c">${caseE(!!v.emballage_date)}</td><td class="c">${caseE(!!v.envoi_date)}</td><td class="c">${caseE(!!v.livraison_date)}</td>
          </tr>`).join('')}</tbody>
        </table>`
      : '<p class="rap-vide">Aucune vente ou livraison en cours.</p>';

    ecran.innerHTML = `
      <div class="rap-tuiles">
        ${tuile('intrants', t.nbIntrants, 'Intrants (ajouts)')}
        ${tuile('extrants', r.oeuvresRetirees.length, 'Extrants (retraits)')}
        ${tuile('ventes', r.ventes.length, 'Ventes')}
        ${tuile('total', formaterPrix(t.total), 'Total des ventes')}
      </div>
      <div class="rap-section"><h3>Ventes du jour</h3>${ventesHTML}</div>
      <div class="rap-grid2">
        <div class="rap-section"><h3>Intrants</h3>${intrantsHTML}</div>
        <div class="rap-section"><h3>Extrants</h3>${extrantsHTML}</div>
      </div>
      <div class="rap-section"><h3>Activité opérationnelle</h3>${activiteHTML}</div>
      <p class="rap-bloc-titre">Suivi opérationnel — état en cours</p>
      <div class="rap-section"><h3>Admissions en cours</h3>${admissionsHTML}</div>
      <div class="rap-section"><h3>Ventes &amp; livraisons en cours</h3>${ventesCoursHTML}</div>`;
  }

  // ===== Version imprimable : document (inspiré du template fourni) =====
  function peindreImpression(r) {
    const t = totaux(r);
    const now = new Date();
    const heure = `${now.getHours()} h ${String(now.getMinutes()).padStart(2, '0')}`;

    const tableau = (entetes, lignes) => lignes.length
      ? `<table><thead><tr>${entetes.map((h) => `<th${h.w ? ` style="width:${h.w}"` : ''}${h.num ? ' class="num"' : ''}>${h.t}</th>`).join('')}</tr></thead><tbody>${lignes.join('')}</tbody></table>`
      : '<p class="vide">Aucune entrée.</p>';

    const intrantsT = tableau(
      [{ t: 'Titre', w: '40%' }, { t: 'Artiste', w: '35%' }, { t: 'N° inventaire', w: '25%' }],
      r.oeuvresAjoutees.map((o) => `<tr><td><strong>${ech(o.titre)}</strong></td><td>${ech(o.artiste_nom || '')}</td><td>${ech(o.numero_inventaire || '—')}</td></tr>`)
    );
    const artistesLigne = r.artistesAjoutes.length
      ? `<p class="sous-liste"><strong>Artistes ajoutés :</strong> ${r.artistesAjoutes.map((a) => ech(a.nom)).join(', ')}</p>` : '';

    const ventesT = r.ventes.length
      ? `<table>
          <thead><tr><th style="width:26%">Titre</th><th style="width:18%">Artiste</th><th style="width:18%">Client</th><th class="num">Sous-total</th><th class="num">TPS</th><th class="num">TVQ</th><th class="num">Total</th></tr></thead>
          <tbody>${r.ventes.map((v) => `<tr><td><strong>${ech(v.oeuvre_titre)}</strong></td><td>${ech(v.artiste_nom || '')}</td><td>${ech(v.client_nom || '—')}</td><td class="num">${formaterPrix(v.prix_vente)}</td><td class="num">${formaterPrix(v.tps)}</td><td class="num">${formaterPrix(v.tvq)}</td><td class="num"><strong>${formaterPrix(totalVente(v))}</strong></td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Totaux</td><td class="num">${formaterPrix(t.sousTotal)}</td><td class="num">${formaterPrix(t.tps)}</td><td class="num">${formaterPrix(t.tvq)}</td><td class="num">${formaterPrix(t.total)}</td></tr></tfoot>
        </table>`
      : '<p class="vide">Aucune vente ce jour.</p>';

    const extrantsT = tableau(
      [{ t: 'Titre', w: '35%' }, { t: 'Artiste', w: '25%' }, { t: 'N° inventaire', w: '15%' }, { t: 'Raison', w: '25%' }],
      r.oeuvresRetirees.map((o) => `<tr><td><strong>${ech(o.titre)}</strong></td><td>${ech(o.artiste_nom || '')}</td><td>${ech(o.numero_inventaire || '—')}</td><td>${ech(o.retrait_motif || '—')}</td></tr>`)
    );

    // Suivi opérationnel (état en cours) — style template (cases ✓/✗)
    const caseP = (ok) => `<span class="case ${ok ? 'ok' : 'nok'}">${ok ? '✓' : '✗'}</span>`;
    const su = r.suivi || { admissionsEnCours: [], ventesEnCours: [] };
    const admissionsP = su.admissionsEnCours.length
      ? `<table>
          <thead><tr><th style="width:28%">Titre</th><th style="width:18%">Artiste</th><th style="width:14%">Date d'admission</th><th style="width:13%">Sage</th><th style="width:13%">Stock</th><th style="width:14%">Page web</th></tr></thead>
          <tbody>${su.admissionsEnCours.map((o) => `<tr><td><strong>${ech(o.titre)}</strong></td><td>${ech(o.artiste_nom || '')}</td><td>${dateCourte(o.cree_le)}</td><td>${caseP(o.sage_cree)}</td><td>${caseP(o.stock_fait)}</td><td>${caseP(o.site_publie)}</td></tr>`).join('')}</tbody>
        </table>`
      : '<p class="vide">Aucune admission en cours.</p>';
    const ventesCoursP = su.ventesEnCours.length
      ? `<table>
          <thead><tr><th style="width:22%">Titre</th><th style="width:14%">Artiste</th><th style="width:16%">Client</th><th style="width:10%">Prix</th><th style="width:7%">Paiement</th><th style="width:7%">Emballée</th><th style="width:7%">Expédiée</th><th style="width:7%">Livrée</th></tr></thead>
          <tbody>${su.ventesEnCours.map((v) => `<tr><td><strong>${ech(v.oeuvre_titre)}</strong></td><td>${ech(v.artiste_nom || '')}</td><td>${ech(v.client_nom || '—')}</td><td>${formaterPrix(v.prix_vente)}</td><td>${caseP(v.paiement_statut === 'recu')}</td><td>${caseP(!!v.emballage_date)}</td><td>${caseP(!!v.envoi_date)}</td><td>${caseP(!!v.livraison_date)}</td></tr>`).join('')}</tbody>
        </table>`
      : '<p class="vide">Aucune vente ou livraison en cours.</p>';

    const stat = (n, l) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`;

    impression.innerHTML = `
      <div class="entete">
        <img src="../gabarits/actifs/logo-gvsj.png" alt="">
        <div class="entete-texte">
          <div class="titre-rap">Rapport journalier</div>
          <div class="sous-titre">${ech(nomGalerie)}</div>
          <div class="date-rap">${ech(dateLongue(date))}</div>
        </div>
      </div>
      <div class="section"><div class="section-titre">Intrants — Ajouts du jour</div>${intrantsT}${artistesLigne}</div>
      <div class="section"><div class="section-titre">Ventes du jour</div>${ventesT}</div>
      <div class="section"><div class="section-titre">Extrants — Retraits du jour</div>${extrantsT}</div>

      <div class="section"><div class="section-titre">Suivi — Admissions en cours</div>${admissionsP}</div>
      <div class="section"><div class="section-titre">Suivi — Ventes &amp; livraisons en cours</div>${ventesCoursP}</div>

      <div class="spacer"></div>
      <div class="resume">
        <div class="stats">
          ${stat(t.nbIntrants, 'Intrant(s)')}
          ${stat(r.oeuvresRetirees.length, 'Extrant(s)')}
          ${stat(r.ventes.length, 'Vente(s)')}
          ${stat(formaterPrix(t.total), 'Total des ventes')}
          ${stat(su.admissionsEnCours.length, 'Admission(s)<br>en cours')}
          ${stat(su.ventesEnCours.length, 'Livraison(s)<br>en cours')}
        </div>
        <div class="gen">Rapport généré par Galeria · ${ech(dateCourte(date))} à ${heure}</div>
      </div>`;
  }

  async function charger() {
    titreDate.textContent = dateLongue(date);
    ecran.innerHTML = '<p class="chargement">Chargement…</p>';
    try {
      const r = await window.api.rapportJournalier(date);
      peindreEcran(r);
      peindreImpression(r);
    } catch (err) {
      ecran.innerHTML = `<p class="erreur">Erreur : ${ech(err.message)}</p>`;
    }
  }

  contenu.querySelector('#rap-d').addEventListener('change', (e) => {
    date = e.target.value || aujourdHuiISO();
    charger();
  });
  contenu.querySelector('#rap-imprimer').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const libelle = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Génération…';
    try {
      await window.api.rapportPdf(date);
    } catch (err) {
      await alerter({ type: 'error', title: 'Génération du PDF échouée', message: nettoyerErreur(err) });
    } finally {
      btn.disabled = false;
      btn.textContent = libelle;
    }
  });

  charger();
}
