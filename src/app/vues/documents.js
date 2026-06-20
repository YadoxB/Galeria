import { ech, sansAccents, formaterDate, nettoyerErreur } from '../commun.js';
import { alerter } from '../dialogue.js';

const TYPE_ORDER = ['certificat', 'facture_artiste', 'facture_client', 'catalogue', 'annexe', 'presentation', 'rapport', 'lettre', 'pochette'];
const LIBELLE_PLURIEL = {
  certificat: 'Certificats', facture_artiste: 'Factures artiste', facture_client: 'Factures client',
  catalogue: 'Catalogues', annexe: 'Annexes', presentation: 'Présentations', rapport: 'Rapports',
  lettre: 'Lettres', pochette: 'Pochettes de vente',
};
const LIBELLE = {
  certificat: "Certificat d'authenticité", facture_artiste: 'Facture artiste', facture_client: 'Facture client',
  catalogue: 'Catalogue', annexe: 'Annexe A', presentation: 'Présentation', rapport: 'Rapport',
  lettre: 'Lettre', pochette: 'Pochette de vente',
};
// Types dont la re-génération est branchée (depuis la base).
const REGEN = { certificat: true, facture_artiste: true };

const SVG = {
  certificat: '<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/>',
  facture_artiste: '<path d="M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21z"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="10" y1="12" x2="14" y2="12"/>',
  facture_client: '<path d="M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21z"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="10" y1="12" x2="14" y2="12"/>',
  catalogue: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="13" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/>',
  annexe: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2V4"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="13.5" x2="15" y2="13.5"/><line x1="9" y1="17" x2="13" y2="17"/>',
  presentation: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5 16c.6-1.6 6-1.6 6.6 0"/><line x1="14" y1="10" x2="18" y2="10"/><line x1="14" y1="14" x2="18" y2="14"/>',
  rapport: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
  lettre: '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>',
  pochette: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
};
function svgWrap(inner) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner || ''}</svg>`; }
function classeIconeLigne(d) {
  if (d.type === 'annexe') return d.sousType === 'retrait' ? 'doc-icone-annexe-retr' : 'doc-icone-annexe-depot';
  if (d.type === 'facture_artiste' || d.type === 'facture_client') return 'doc-icone-facture';
  if (d.type === 'pochette') return 'doc-icone-pochette';
  if (d.type === 'certificat') return 'doc-icone-cert';
  if (d.type === 'presentation') return 'doc-icone-presentation';
  if (d.type === 'catalogue') return 'doc-icone-catalogue';
  if (d.type === 'rapport') return 'doc-icone-rapport';
  if (d.type === 'lettre') return 'doc-icone-lettre';
  return '';
}
function classeIconeType(type) { return type === 'annexe' ? 'doc-icone-annexe' : classeIconeLigne({ type }); }
const annee = (d) => String(d.date || '').slice(0, 4) || '—';
const distinct = (arr) => [...new Set(arr.filter(Boolean))];

export async function rendreDocuments(contenu) {
  let docs = await window.api.documentsListe();
  let fType = 'tous', fAnnee = 'tous', fArtiste = 'tous', fClient = 'tous', recherche = '';

  contenu.innerHTML = `
    <div class="vue-documents">
      <div class="entete-page entete-page--simple">
        <h2 class="entete-page-titre">Documents</h2>
        <div class="entete-page-recherche-wrap">
          <div class="recherche-pillule">
            <svg class="recherche-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
            </svg>
            <input type="search" id="doc-recherche" placeholder="Rechercher (numéro, œuvre, artiste, client)…" autocomplete="off">
          </div>
        </div>
      </div>

      <div class="doc-filtres-barre">
        <div class="groupe-filtre"><label for="f-type">Type</label><select id="f-type"></select></div>
        <div class="groupe-filtre"><label for="f-annee">Année</label><select id="f-annee"></select></div>
        <div class="groupe-filtre"><label for="f-artiste">Artiste</label><select id="f-artiste"></select></div>
        <div class="groupe-filtre"><label for="f-client">Client</label><select id="f-client"></select></div>
        <button type="button" class="doc-reset" id="f-reset" hidden>Réinitialiser</button>
        <span class="doc-compteur-barre" id="doc-compteur"></span>
      </div>

      <div id="doc-liste"></div>
    </div>
  `;

  const elListe = contenu.querySelector('#doc-liste');
  const selType = contenu.querySelector('#f-type');
  const selAnnee = contenu.querySelector('#f-annee');
  const selArtiste = contenu.querySelector('#f-artiste');
  const selClient = contenu.querySelector('#f-client');
  const btnReset = contenu.querySelector('#f-reset');

  function remplirFiltres() {
    const opt = (v, l, sel) => `<option value="${ech(v)}"${sel ? ' selected' : ''}>${ech(l)}</option>`;
    const typesPresents = TYPE_ORDER.filter((t) => docs.some((d) => d.type === t));
    selType.innerHTML = opt('tous', 'Tous les types', fType === 'tous') + typesPresents.map((t) => opt(t, LIBELLE_PLURIEL[t], fType === t)).join('');
    selAnnee.innerHTML = opt('tous', 'Toutes les années', fAnnee === 'tous') + distinct(docs.map(annee)).sort((a, b) => b.localeCompare(a)).map((y) => opt(y, y, fAnnee === y)).join('');
    selArtiste.innerHTML = opt('tous', 'Tous les artistes', fArtiste === 'tous') + distinct(docs.map((d) => d.artiste_nom)).sort((a, b) => sansAccents(a).localeCompare(sansAccents(b))).map((a) => opt(a, a, fArtiste === a)).join('');
    selClient.innerHTML = opt('tous', 'Tous les clients', fClient === 'tous') + distinct(docs.map((d) => d.client_nom)).sort((a, b) => sansAccents(a).localeCompare(sansAccents(b))).map((c) => opt(c, c, fClient === c)).join('');
  }

  async function recharger() { docs = await window.api.documentsListe(); remplirFiltres(); peindre(); }

  function filtrer() {
    return docs.map((d, i) => ({ d, i })).filter(({ d }) => {
      if (fType !== 'tous' && d.type !== fType) return false;
      if (fAnnee !== 'tous' && annee(d) !== fAnnee) return false;
      if (fArtiste !== 'tous' && d.artiste_nom !== fArtiste) return false;
      if (fClient !== 'tous' && d.client_nom !== fClient) return false;
      if (recherche) {
        const foin = sansAccents([d.numero, d.oeuvre_titre, d.artiste_nom, d.client_nom, LIBELLE[d.type]].filter(Boolean).join(' '));
        if (!foin.includes(recherche)) return false;
      }
      return true;
    });
  }

  const chevron = '<svg class="doc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

  function ligne(d, i) {
    const typeLib = d.type === 'annexe' ? `Annexe A — ${d.sousType === 'retrait' ? 'retrait' : 'dépôt'}` : (LIBELLE[d.type] || 'Document');
    const meta = [d.oeuvre_titre, d.artiste_nom, d.client_nom].filter(Boolean).map(ech).join(' · ');
    const badge = d.modifiee ? '<span class="doc-badge">version modifiée</span>' : '';
    const icone = `<div class="doc-icone ${classeIconeLigne(d)}">${svgWrap(SVG[d.type])}</div>`;

    if (d.type === 'pochette') {
      const contenuHtml = (d.contenu || []).map((c) => `
        <div class="pochette-doc">
          <span class="nom">${ech(c.nom)}</span>
          <button type="button" class="btn-action btn-secondaire-action mini-voir" data-voir-pochette="${ech(c.pdf_path)}">Voir</button>
        </div>`).join('');
      return `
        <div class="doc-ligne pochette" data-i="${i}">
          ${chevron}${icone}
          <div class="doc-info">
            <p class="doc-titre">${ech(d.numero)} · ${ech(typeLib)}</p>
            <p class="doc-meta">${meta}${meta ? ' · ' : ''}${formaterDate(d.date)} · ${(d.contenu || []).length} document(s)</p>
          </div>
          <div class="doc-actions">
            <button type="button" class="btn-action btn-secondaire-action" data-act="dossier">Ouvrir le dossier</button>
          </div>
        </div>
        <div class="pochette-contenu" data-contenu="${i}" hidden>${contenuHtml}</div>`;
    }

    const actRegen = REGEN[d.type] && d.ref_id != null ? '<button type="button" class="btn-action btn-secondaire-action" data-act="regen">Re-générer</button>' : '';
    return `
      <div class="doc-ligne" data-i="${i}">
        ${icone}
        <div class="doc-info">
          <p class="doc-titre">${ech(d.numero || '—')} · ${ech(typeLib)}${badge}</p>
          <p class="doc-meta">${meta}${meta ? ' · ' : ''}${formaterDate(d.date)}</p>
        </div>
        <div class="doc-actions">
          <button type="button" class="btn-action btn-secondaire-action" data-act="voir">Voir</button>
          <button type="button" class="btn-action btn-secondaire-action" data-act="dossier">Dossier</button>
          ${actRegen}
        </div>
      </div>`;
  }

  function peindre() {
    const liste = filtrer();
    const actif = fType !== 'tous' || fAnnee !== 'tous' || fArtiste !== 'tous' || fClient !== 'tous' || !!recherche;
    btnReset.hidden = !actif;
    contenu.querySelector('#doc-compteur').textContent = `${liste.length} document${liste.length > 1 ? 's' : ''}`;

    if (!liste.length) {
      elListe.innerHTML = `<div class="doc-vide-global">${docs.length === 0
        ? 'Aucun document produit pour l\'instant. Les certificats, factures, catalogues, annexes, présentations, rapports et pochettes apparaîtront ici dès leur génération.'
        : 'Aucun document ne correspond à ces filtres.'}</div>`;
      return;
    }

    let html = '';
    for (const type of TYPE_ORDER) {
      const items = liste.filter(({ d }) => d.type === type).sort((a, b) => String(b.d.date).localeCompare(String(a.d.date)));
      if (!items.length) continue;
      const annees = distinct(items.map(({ d }) => annee(d)));
      let corps = '';
      if (annees.length > 1) {
        for (const an of annees.sort((a, b) => b.localeCompare(a))) {
          corps += `<div class="doc-annee-sep">${ech(an)}</div>` + items.filter(({ d }) => annee(d) === an).map(({ d, i }) => ligne(d, i)).join('');
        }
      } else {
        corps = items.map(({ d, i }) => ligne(d, i)).join('');
      }
      html += `
        <section class="doc-type-bloc">
          <div class="doc-type-titre">
            <span class="doc-type-ic ${classeIconeType(type)}">${svgWrap(SVG[type])}</span>
            <span class="doc-type-nom">${ech(LIBELLE_PLURIEL[type])}</span>
            <span class="doc-type-compte">${items.length}</span>
          </div>
          <div class="doc-carte">${corps}</div>
        </section>`;
    }
    elListe.innerHTML = html;
    bind();
  }

  function bind() {
    elListe.querySelectorAll('.doc-ligne').forEach((row) => {
      const i = Number(row.dataset.i);
      const d = docs[i];
      if (!d) return;

      if (d.type === 'pochette') {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-act]')) return;
          const c = elListe.querySelector(`[data-contenu="${i}"]`);
          row.classList.toggle('ouvert');
          if (c) c.hidden = !c.hidden;
        });
        const btnDossier = row.querySelector('[data-act="dossier"]');
        if (btnDossier) btnDossier.addEventListener('click', async (e) => {
          e.stopPropagation();
          try { await window.api.ouvrirDossier(d.pdf_path); } catch {}
        });
        return;
      }

      const btnVoir = row.querySelector('[data-act="voir"]');
      if (btnVoir) btnVoir.addEventListener('click', async () => { try { await window.api.pdfOuvrir(d.pdf_path); } catch {} });
      const btnDossier = row.querySelector('[data-act="dossier"]');
      if (btnDossier) btnDossier.addEventListener('click', async () => { try { await window.api.pdfRevelerDansExplorateur(d.pdf_path); } catch {} });
      const btnRegen = row.querySelector('[data-act="regen"]');
      if (btnRegen) btnRegen.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const libelle = btn.textContent;
        btn.disabled = true; btn.textContent = '…';
        try {
          if (d.type === 'certificat') await window.api.pdfCertificatGenerer(d.ref_id);
          else if (d.type === 'facture_artiste') await window.api.pdfFactureArtisteGenerer(d.ref_id);
          await recharger();
        } catch (err) {
          btn.disabled = false; btn.textContent = libelle;
          await alerter({ type: 'error', title: 'Re-génération échouée', message: nettoyerErreur(err) });
        }
      });
    });

    // « Voir » sur un document de pochette (contenu déplié)
    elListe.querySelectorAll('[data-voir-pochette]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      try { await window.api.pdfOuvrir(b.dataset.voirPochette); } catch {}
    }));
  }

  contenu.querySelector('#doc-recherche').addEventListener('input', (e) => { recherche = sansAccents(e.target.value || ''); peindre(); });
  selType.addEventListener('change', () => { fType = selType.value; peindre(); });
  selAnnee.addEventListener('change', () => { fAnnee = selAnnee.value; peindre(); });
  selArtiste.addEventListener('change', () => { fArtiste = selArtiste.value; peindre(); });
  selClient.addEventListener('change', () => { fClient = selClient.value; peindre(); });
  btnReset.addEventListener('click', () => {
    fType = 'tous'; fAnnee = 'tous'; fArtiste = 'tous'; fClient = 'tous'; recherche = '';
    contenu.querySelector('#doc-recherche').value = '';
    remplirFiltres(); peindre();
  });

  remplirFiltres();
  peindre();
}
