import { ech, sansAccents, formaterDate, nettoyerErreur } from '../commun.js';
import { alerter } from '../dialogue.js';

const LIBELLE = {
  certificat: "Certificat d'authenticité",
  facture_artiste: 'Facture artiste',
};

export async function rendreDocuments(contenu) {
  let docs = await window.api.documentsListe();
  let typeActif = 'tous';
  let filtre = '';

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

      <div class="doc-filtres" id="doc-filtres">
        <button type="button" class="doc-chip actif" data-type="tous">Tous</button>
        <button type="button" class="doc-chip" data-type="certificat">Certificats</button>
        <button type="button" class="doc-chip" data-type="facture_artiste">Factures artiste</button>
        <span class="doc-compteur" id="doc-compteur"></span>
      </div>

      <div id="doc-liste"></div>
    </div>
  `;

  const elListe = contenu.querySelector('#doc-liste');

  async function recharger() {
    docs = await window.api.documentsListe();
    peindre();
  }

  function ligne(d) {
    const estFacture = d.type === 'facture_artiste';
    const meta = [d.oeuvre_titre, d.artiste_nom, d.client_nom].filter(Boolean).map(ech).join(' · ');
    return `
      <div class="doc-ligne" data-type="${d.type}" data-ref="${d.ref_id}">
        <div class="doc-icone ${estFacture ? 'doc-icone-facture' : ''}">${estFacture ? 'A' : 'C'}</div>
        <div class="doc-info">
          <p class="doc-titre">${ech(d.numero || '—')} · ${ech(LIBELLE[d.type] || 'Document')}</p>
          <p class="doc-meta">${meta}${meta ? ' · ' : ''}${formaterDate(d.date)}</p>
        </div>
        <div class="doc-actions">
          <button type="button" class="btn-action btn-secondaire-action" data-act="voir">Voir</button>
          <button type="button" class="btn-action btn-secondaire-action" data-act="dossier" title="Ouvrir le dossier">Dossier</button>
          <button type="button" class="btn-action btn-secondaire-action" data-act="regen">Re-générer</button>
        </div>
      </div>`;
  }

  function peindre() {
    let liste = docs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (typeActif !== 'tous') liste = liste.filter((d) => d.type === typeActif);
    if (filtre) {
      liste = liste.filter((d) => sansAccents(
        [d.numero, d.oeuvre_titre, d.artiste_nom, d.client_nom, LIBELLE[d.type]].filter(Boolean).join(' ')
      ).includes(filtre));
    }

    contenu.querySelector('#doc-compteur').textContent = `${liste.length} document${liste.length > 1 ? 's' : ''}`;

    if (!liste.length) {
      elListe.innerHTML = `<div class="doc-carte"><div class="doc-vide">${
        docs.length === 0
          ? 'Aucun document produit pour l\'instant. Les certificats et factures artiste apparaîtront ici dès leur génération.'
          : 'Aucun document ne correspond à ce filtre.'
      }</div></div>`;
      return;
    }

    // Groupé par année (les PDF sont rangés par année sur le disque)
    const parAnnee = new Map();
    for (const d of liste) {
      const annee = String(d.date || '').slice(0, 4) || '—';
      if (!parAnnee.has(annee)) parAnnee.set(annee, []);
      parAnnee.get(annee).push(d);
    }
    let html = '';
    for (const [annee, items] of parAnnee) {
      html += `<h3 class="doc-annee">${ech(annee)}</h3><div class="doc-carte">${items.map(ligne).join('')}</div>`;
    }
    elListe.innerHTML = html;
    bind();
  }

  function bind() {
    elListe.querySelectorAll('.doc-ligne').forEach((row) => {
      const type = row.dataset.type;
      const ref = Number(row.dataset.ref);
      const d = docs.find((x) => x.type === type && x.ref_id === ref);
      if (!d) return;

      row.querySelector('[data-act="voir"]').addEventListener('click', async () => {
        if (d.pdf_path) { try { await window.api.pdfOuvrir(d.pdf_path); } catch {} }
      });
      row.querySelector('[data-act="dossier"]').addEventListener('click', async () => {
        if (d.pdf_path) { try { await window.api.pdfRevelerDansExplorateur(d.pdf_path); } catch {} }
      });
      row.querySelector('[data-act="regen"]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const libelle = btn.textContent;
        btn.disabled = true;
        btn.textContent = '…';
        try {
          if (type === 'certificat') await window.api.pdfCertificatGenerer(ref);
          else if (type === 'facture_artiste') await window.api.pdfFactureArtisteGenerer(ref);
          await recharger();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = libelle;
          await alerter({ type: 'error', title: 'Re-génération échouée', message: nettoyerErreur(err) });
        }
      });
    });
  }

  contenu.querySelector('#doc-recherche').addEventListener('input', (e) => {
    filtre = sansAccents(e.target.value || '');
    peindre();
  });
  contenu.querySelectorAll('#doc-filtres .doc-chip').forEach((b) => b.addEventListener('click', () => {
    contenu.querySelectorAll('#doc-filtres .doc-chip').forEach((x) => x.classList.remove('actif'));
    b.classList.add('actif');
    typeActif = b.dataset.type;
    peindre();
  }));

  peindre();
}
