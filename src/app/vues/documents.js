import { ech, sansAccents, formaterDate, nettoyerErreur } from '../commun.js';
import { alerter } from '../dialogue.js';
import { lancerEditionDocument } from '../editer-document.js';

const CLE_VUE = 'documents-vue'; // 'liste' | 'explorateur'

// Documents éditables (« Modifier ce document ») depuis la section Documents,
// avec le ref_id de la base traduit en identifiant attendu par l'éditeur.
// Certificat/présentation/facture proviennent de la base (ref_id fiable) ;
// les entrées scannées sur disque (catalogues, versions modifiées) n'en ont pas.
function specEdition(d) {
  if (!d || d.ref_id == null) return null;
  if (d.type === 'certificat') return { type: 'certificat', certificat_id: d.ref_id };
  if (d.type === 'facture_artiste') return { type: 'facture-artiste', vente_id: d.ref_id };
  if (d.type === 'presentation') return { type: 'presentation', artiste_id: d.ref_id };
  return null;
}

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
// Type → nom du dossier disque (pour la vue explorateur).
const TYPE_DOSSIER = {
  certificat: 'Certificats', facture_artiste: 'Factures artiste', facture_client: 'Factures client',
  catalogue: 'Catalogues', annexe: 'Annexes', presentation: 'Présentations', rapport: 'Rapports', lettre: 'Lettres',
};
// Nom de dossier de type → icône (pour utiliser les icônes de documents comme icônes de dossiers).
const DOSSIER_ICONE = {
  'Certificats': 'certificat', 'Factures artiste': 'facture', 'Factures client': 'facture',
  'Catalogues': 'catalogue', 'Annexes': 'annexe', 'Présentations': 'presentation',
  'Rapports': 'rapport', 'Lettres': 'lettre', 'Pochettes': 'pochette',
};
const REGEN = { certificat: true, facture_artiste: true };

const SVG = {
  certificat: '<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5"/>',
  facture: '<path d="M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21z"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="10" y1="12" x2="14" y2="12"/>',
  catalogue: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="13" width="7" height="7" rx="1"/><rect x="14" y="13" width="7" height="7" rx="1"/>',
  annexe: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3.2A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2V4"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="13.5" x2="15" y2="13.5"/><line x1="9" y1="17" x2="13" y2="17"/>',
  presentation: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5 16c.6-1.6 6-1.6 6.6 0"/><line x1="14" y1="10" x2="18" y2="10"/><line x1="14" y1="14" x2="18" y2="14"/>',
  rapport: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
  lettre: '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>',
  guide: '<path d="M5 4h9l5 5v11H5z"/><polyline points="14 4 14 9 19 9"/>',
  pochette: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
};
const DOSSIER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
function svgWrap(inner) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner || ''}</svg>`; }
function svgPourKind(kind) { const m = { facture: 'facture', annexeRetrait: 'annexe' }; return SVG[m[kind] || kind] || SVG.lettre; }
function classePourKind(kind) {
  switch (kind) {
    case 'certificat': return 'doc-icone-cert';
    case 'facture': return 'doc-icone-facture';
    case 'catalogue': return 'doc-icone-catalogue';
    case 'annexe': return 'doc-icone-annexe';
    case 'annexeRetrait': return 'doc-icone-annexe-retr';
    case 'presentation': return 'doc-icone-presentation';
    case 'rapport': return 'doc-icone-rapport';
    case 'lettre': return 'doc-icone-lettre';
    case 'guide': return 'doc-icone-guide';
    case 'pochette': return 'doc-icone-pochette';
    default: return '';
  }
}
function kindDeDoc(d) {
  if (d.type === 'facture_artiste' || d.type === 'facture_client') return 'facture';
  if (d.type === 'annexe') return d.sousType === 'retrait' ? 'annexeRetrait' : 'annexe';
  return d.type;
}
function classeIconeLigne(d) { return classePourKind(kindDeDoc(d)); }
function classeIconeType(type) { return type === 'annexe' ? 'doc-icone-annexe' : classePourKind(kindDeDoc({ type })); }
const annee = (d) => String(d.date || '').slice(0, 4) || '—';
const distinct = (arr) => [...new Set(arr.filter(Boolean))];

// Icône de la barre latérale par type (réutilise SVG existant).
function svgSidebarType(type) {
  const kind = type === 'facture_artiste' || type === 'facture_client' ? 'facture' : type;
  return svgWrap(SVG[kind] || SVG.lettre);
}

export async function rendreDocuments(contenu) {
  let docs = await window.api.documentsListe();
  let vue = (localStorage.getItem(CLE_VUE) === 'explorateur') ? 'explorateur' : 'liste';
  let fType = 'tous', fAnnee = 'tous', fArtiste = 'tous', fClient = 'tous', recherche = '';
  let chemin = []; // vue explorateur

  contenu.innerHTML = `
    <div class="vue-documents">
      <div class="reglages-entete">
        <h1>Documents</h1>
        <p class="reglages-entete-meta">Tous les PDF produits, rangés par type. Choisis un type à gauche.</p>
      </div>

      <div class="reglages-layout">
        <nav class="cat-nav" id="doc-cat-nav" aria-label="Types de documents"></nav>

        <div class="cat-zone">
          <div class="doc-panneau-tete">
            <div class="recherche-pillule">
              <svg class="recherche-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
              </svg>
              <input type="search" id="doc-recherche" placeholder="Rechercher (numéro, œuvre, artiste, client)…" autocomplete="off">
            </div>
            <select id="f-annee" class="doc-filtre-select"></select>
            <select id="f-artiste" class="doc-filtre-select"></select>
            <select id="f-client" class="doc-filtre-select"></select>
            <button type="button" class="doc-reset" id="f-reset" hidden>Réinitialiser</button>
            <span class="doc-compteur-barre" id="doc-compteur"></span>
            <div class="doc-vue-bascule" role="group" aria-label="Mode d'affichage">
              <button type="button" data-vue="liste">Liste</button>
              <button type="button" data-vue="explorateur">Explorateur</button>
            </div>
          </div>
          <div id="doc-zone"></div>
        </div>
      </div>
    </div>
  `;

  const zone = contenu.querySelector('#doc-zone');
  const inputRecherche = contenu.querySelector('#doc-recherche');
  const navTypes = contenu.querySelector('#doc-cat-nav');

  function majBascule() {
    contenu.querySelectorAll('.doc-vue-bascule button').forEach((b) => b.classList.toggle('actif', b.dataset.vue === vue));
  }

  // Barre latérale des types (Tous + types présents avec compteurs). Dépend de
  // `docs` : reconstruite au chargement et après une recharge, pas à chaque
  // peinture. L'état actif suit fType via majSidebarActif().
  function construireSidebar() {
    const typesPresents = TYPE_ORDER.filter((t) => docs.some((d) => d.type === t));
    const compte = (t) => docs.filter((d) => d.type === t).length;
    const item = (cat, libelle, svg, n) =>
      `<button type="button" class="cat-item" data-cat="${cat}">
         <span class="cat-ic">${svg}</span>
         <span class="cat-item-libelle">${ech(libelle)}</span>
         ${n != null ? `<span class="cat-compte">${n}</span>` : ''}
       </button>`;
    const svgTous = svgWrap('<rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/>');
    navTypes.innerHTML = item('tous', 'Tous les documents', svgTous, docs.length)
      + typesPresents.map((t) => item(t, LIBELLE_PLURIEL[t], svgSidebarType(t), compte(t))).join('');
    majSidebarActif();
  }
  function majSidebarActif() {
    navTypes.querySelectorAll('.cat-item').forEach((b) => b.classList.toggle('actif', b.dataset.cat === fType));
  }

  // Options des filtres secondaires (Année, Artiste, Client). Dépendent de
  // `docs` ; les valeurs choisies (fAnnee…) sont préservées.
  function construireFiltres() {
    const opt = (v, l, sel) => `<option value="${ech(v)}"${sel ? ' selected' : ''}>${ech(l)}</option>`;
    contenu.querySelector('#f-annee').innerHTML = opt('tous', 'Toutes les années', fAnnee === 'tous')
      + distinct(docs.map(annee)).sort((a, b) => b.localeCompare(a)).map((y) => opt(y, y, fAnnee === y)).join('');
    contenu.querySelector('#f-artiste').innerHTML = opt('tous', 'Tous les artistes', fArtiste === 'tous')
      + distinct(docs.map((d) => d.artiste_nom)).sort((a, b) => sansAccents(a).localeCompare(sansAccents(b))).map((a) => opt(a, a, fArtiste === a)).join('');
    contenu.querySelector('#f-client').innerHTML = opt('tous', 'Tous les clients', fClient === 'tous')
      + distinct(docs.map((d) => d.client_nom)).sort((a, b) => sansAccents(a).localeCompare(sansAccents(b))).map((c) => opt(c, c, fClient === c)).join('');
    majReset();
  }
  function majReset() {
    const actif = !(fType === 'tous' && fAnnee === 'tous' && fArtiste === 'tous' && fClient === 'tous' && !recherche);
    contenu.querySelector('#f-reset').hidden = !actif;
  }

  // Filtre commun aux deux vues : type (barre latérale), année, artiste, client.
  // La recherche est appliquée à part (liste : ici ; explorateur : à plat).
  function passeFiltres(d, avecRecherche) {
    if (fType !== 'tous' && d.type !== fType) return false;
    if (fAnnee !== 'tous' && annee(d) !== fAnnee) return false;
    if (fArtiste !== 'tous' && d.artiste_nom !== fArtiste) return false;
    if (fClient !== 'tous' && d.client_nom !== fClient) return false;
    if (avecRecherche && recherche && !sansAccents([d.numero, d.oeuvre_titre, d.artiste_nom, d.client_nom, LIBELLE[d.type]].filter(Boolean).join(' ')).includes(recherche)) return false;
    return true;
  }

  async function recharger() { docs = await window.api.documentsListe(); construireSidebar(); construireFiltres(); peindre(); }

  function peindre() {
    majBascule();
    majSidebarActif();
    majReset();
    if (vue === 'explorateur') peindreExplorateur();
    else peindreListe();
  }

  // ───────────────────────── Vue LISTE ─────────────────────────
  function ligneListe(d, i) {
    const typeLib = d.type === 'annexe' ? `Annexe A — ${d.sousType === 'retrait' ? 'retrait' : 'dépôt'}` : (LIBELLE[d.type] || 'Document');
    const meta = [d.oeuvre_titre, d.artiste_nom, d.client_nom].filter(Boolean).map(ech).join(' · ');
    const badge = d.modifiee ? '<span class="doc-badge">version modifiée</span>' : '';
    const icone = `<div class="doc-icone ${classeIconeLigne(d)}">${svgWrap(svgPourKind(kindDeDoc(d)))}</div>`;

    if (d.type === 'pochette') {
      const contenuHtml = (d.contenu || []).map((c) => `
        <div class="pochette-doc">
          <span class="nom">${ech(c.nom)}</span>
          <button type="button" class="btn-action btn-secondaire-action mini-voir" data-voir-pochette="${ech(c.pdf_path)}">Voir</button>
        </div>`).join('');
      return `
        <div class="doc-ligne pochette" data-i="${i}">
          <svg class="doc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>${icone}
          <div class="doc-info">
            <p class="doc-titre">${ech(d.numero)} · ${ech(typeLib)}</p>
            <p class="doc-meta">${meta}${meta ? ' · ' : ''}${formaterDate(d.date)} · ${(d.contenu || []).length} document(s)</p>
          </div>
          <div class="doc-actions"><button type="button" class="btn-action btn-secondaire-action" data-act="dossier">Ouvrir le dossier</button></div>
        </div>
        <div class="pochette-contenu" data-contenu="${i}" hidden>${contenuHtml}</div>`;
    }

    const actRegen = REGEN[d.type] && d.ref_id != null ? '<button type="button" class="btn-action btn-secondaire-action" data-act="regen">Re-générer</button>' : '';
    const actEdit = specEdition(d) ? '<button type="button" class="btn-action btn-secondaire-action" data-act="modifier" title="Ouvrir le document dans une fenêtre éditable">Modifier ce document…</button>' : '';
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
          ${actEdit}
          ${actRegen}
        </div>
      </div>`;
  }

  function peindreListe() {
    zone.innerHTML = `<div id="doc-liste"></div>`;

    const liste = docs.map((d, i) => ({ d, i })).filter(({ d }) => passeFiltres(d, true));

    contenu.querySelector('#doc-compteur').textContent = `${liste.length} document${liste.length > 1 ? 's' : ''}`;
    const elListe = zone.querySelector('#doc-liste');

    if (!liste.length) {
      elListe.innerHTML = `<div class="doc-vide-global">${docs.length === 0
        ? 'Aucun document produit pour l\'instant. Les documents apparaîtront ici dès leur génération.'
        : 'Aucun document ne correspond à ces filtres.'}</div>`;
      return;
    }

    // Quand un type précis est choisi dans la barre latérale, on n'affiche pas
    // le titre de type au-dessus de la carte (redondant avec la sélection).
    const typeUnique = fType !== 'tous';
    let html = '';
    for (const type of TYPE_ORDER) {
      const items = liste.filter(({ d }) => d.type === type).sort((a, b) => String(b.d.date).localeCompare(String(a.d.date)));
      if (!items.length) continue;
      const annees = distinct(items.map(({ d }) => annee(d)));
      let corps = '';
      if (annees.length > 1) {
        for (const an of annees.sort((a, b) => b.localeCompare(a))) {
          corps += `<div class="doc-annee-sep">${ech(an)}</div>` + items.filter(({ d }) => annee(d) === an).map(({ d, i }) => ligneListe(d, i)).join('');
        }
      } else { corps = items.map(({ d, i }) => ligneListe(d, i)).join(''); }
      const entete = typeUnique ? '' :
        `<div class="doc-type-titre"><span class="doc-type-ic ${classeIconeType(type)}">${svgWrap(svgPourKind(kindDeDoc({ type })))}</span><span class="doc-type-nom">${ech(LIBELLE_PLURIEL[type])}</span><span class="doc-type-compte">${items.length}</span></div>`;
      html += `<section class="doc-type-bloc">${entete}<div class="doc-carte">${corps}</div></section>`;
    }
    elListe.innerHTML = html;
    bindListe(elListe);
  }

  function bindListe(elListe) {
    elListe.querySelectorAll('.doc-ligne').forEach((row) => {
      const i = Number(row.dataset.i);
      const d = docs[i];
      if (!d) return;
      if (d.type === 'pochette') {
        row.addEventListener('click', (e) => {
          if (e.target.closest('[data-act]')) return;
          const c = elListe.querySelector(`[data-contenu="${i}"]`);
          row.classList.toggle('ouvert'); if (c) c.hidden = !c.hidden;
        });
        const bd = row.querySelector('[data-act="dossier"]');
        if (bd) bd.addEventListener('click', async (e) => { e.stopPropagation(); try { await window.api.ouvrirDossier(d.pdf_path); } catch {} });
        return;
      }
      const bv = row.querySelector('[data-act="voir"]');
      if (bv) bv.addEventListener('click', async () => { try { await window.api.pdfOuvrir(d.pdf_path); } catch {} });
      const bd = row.querySelector('[data-act="dossier"]');
      if (bd) bd.addEventListener('click', async () => { try { await window.api.pdfRevelerDansExplorateur(d.pdf_path); } catch {} });
      const br = row.querySelector('[data-act="regen"]');
      if (br) br.addEventListener('click', (e) => regenerer(e.currentTarget, d));
      const be = row.querySelector('[data-act="modifier"]');
      if (be) be.addEventListener('click', async (e) => {
        const btn = e.currentTarget; btn.disabled = true;
        try { await lancerEditionDocument(specEdition(d)); }
        finally { btn.disabled = false; }
      });
    });
    elListe.querySelectorAll('[data-voir-pochette]').forEach((b) => b.addEventListener('click', async (e) => {
      e.stopPropagation(); try { await window.api.pdfOuvrir(b.dataset.voirPochette); } catch {}
    }));
  }

  // ──────────────────────── Vue EXPLORATEUR ────────────────────────
  function construireArbre() {
    // L'arbre respecte la barre latérale et les filtres (sauf la recherche,
    // gérée à plat). Quand un type précis est choisi, on saute le niveau
    // « Type » (Année → fichiers directement), la barre latérale le portant déjà.
    const sauterType = fType !== 'tous' && fType !== 'pochette';
    const tree = {};
    for (const d of docs) {
      if (!passeFiltres(d, false)) continue;
      const an = annee(d);
      const A = tree[an] || (tree[an] = {});
      if (d.type === 'pochette') {
        const P = A['Pochettes'] || (A['Pochettes'] = {});
        const client = d.client || '(sans client)';
        const C = P[client] || (P[client] = {});
        const arr = (d.contenu || []).map((c) => entreeContenu(c, d.date));
        arr._dossier = d.pdf_path; // pour « Ouvrir le dossier »
        C[d.numero] = arr;
      } else if (sauterType) {
        // Année → fichiers (le tableau est directement sous l'année).
        if (!Array.isArray(A._fichiers)) A._fichiers = [];
        A._fichiers.push(entreeDoc(d));
      } else {
        const lbl = TYPE_DOSSIER[d.type] || 'Autres';
        (A[lbl] || (A[lbl] = [])).push(entreeDoc(d));
      }
    }
    // Quand on saute le niveau type, remplacer chaque nœud année {_fichiers:[...]}
    // par le tableau lui-même : Année → [fichiers].
    if (sauterType) {
      for (const an of Object.keys(tree)) {
        const node = tree[an];
        if (Array.isArray(node._fichiers)) tree[an] = node._fichiers;
      }
    }
    return tree;
  }
  function entreeDoc(d) {
    return { kind: kindDeDoc(d), label: d.numero || '—', date: d.date, pdf_path: d.pdf_path, modifiee: !!d.modifiee, regenType: REGEN[d.type] ? d.type : null, ref_id: d.ref_id, meta: [d.oeuvre_titre, d.artiste_nom, d.client_nom].filter(Boolean).join(' · ') };
  }
  function entreeContenu(c, dateParent) {
    const n = sansAccents(c.nom || '');
    let kind = 'lettre';
    if (n.includes('certificat')) kind = 'certificat';
    else if (n.includes('presentation')) kind = 'presentation';
    else if (n.includes('guide')) kind = 'guide';
    else if (n.includes('facture')) kind = 'facture';
    else if (n.includes('lettre')) kind = 'lettre';
    return { kind, label: c.nom, date: dateParent, pdf_path: c.pdf_path, modifiee: false, regenType: null, meta: '' };
  }
  const estDossier = (n) => n && typeof n === 'object' && !Array.isArray(n);
  function noeudA(tree, ch) { let n = tree; for (const k of ch) { n = n && n[k]; if (!n) return null; } return n; }
  function compte(n) { if (Array.isArray(n)) return `${n.length} fichier${n.length > 1 ? 's' : ''}`; const k = Object.keys(n).length; return `${k} dossier${k > 1 ? 's' : ''}`; }
  function iconeDossier(nom) {
    const kind = DOSSIER_ICONE[nom];
    if (kind) return `<span class="doc-icone ${classePourKind(kind)}">${svgWrap(svgPourKind(kind))}</span>`;
    return `<span class="exp-ic-doss">${DOSSIER_SVG}</span>`;
  }
  function ligneFichier(f, loc) {
    const badge = f.modifiee ? '<span class="doc-badge">version modifiée</span>' : '';
    const locHtml = loc ? `<div class="exp-loc">${ech(loc)}</div>` : (f.meta ? `<div class="exp-loc">${ech(f.meta)}</div>` : '');
    const regen = f.regenType ? `<button type="button" class="btn-action btn-secondaire-action" data-act="regen">Re-générer</button>` : '';
    return `<div class="exp-fichier" data-pdf="${ech(f.pdf_path)}" data-regen="${f.regenType || ''}" data-ref="${f.ref_id != null ? f.ref_id : ''}">
      <div class="doc-icone ${classePourKind(f.kind)}">${svgWrap(svgPourKind(f.kind))}</div>
      <div class="info"><div class="nom">${ech(f.label)}${badge}</div><div class="meta">${formaterDate(f.date)}</div>${locHtml}</div>
      <div class="actions">
        <button type="button" class="btn-action btn-secondaire-action" data-act="voir">Voir</button>
        <button type="button" class="btn-action btn-secondaire-action" data-act="dossier">Dossier</button>
        ${regen}
      </div>
    </div>`;
  }

  // Compte récursif des fichiers d'un arbre (feuilles = tableaux).
  function compterFichiers(node) {
    if (Array.isArray(node)) return node.length;
    return Object.keys(node).reduce((s, k) => s + compterFichiers(node[k]), 0);
  }

  function peindreExplorateur() {
    const tree = construireArbre();
    const nTotal = compterFichiers(tree);
    contenu.querySelector('#doc-compteur').textContent = `${nTotal} document${nTotal > 1 ? 's' : ''}`;

    // Recherche globale → résultats à plat
    if (recherche) {
      const acc = [];
      (function parcourir(node, ch) {
        if (Array.isArray(node)) { for (const f of node) acc.push({ f, loc: ch.join(' › ') }); return; }
        for (const k of Object.keys(node)) parcourir(node[k], [...ch, k]);
      })(tree, []);
      const res = acc.filter(({ f, loc }) => sansAccents(f.label + ' ' + loc + ' ' + (f.meta || '')).includes(recherche));
      zone.innerHTML = `
        <div class="exp-barre"><button class="exp-remonter" disabled aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/></svg></button><div class="fil"><span class="fil-seg actuel">Résultats de recherche</span></div></div>
        <div id="exp-contenu">${res.length
          ? `<div class="exp-section-label">${res.length} résultat${res.length > 1 ? 's' : ''}</div><div class="exp-fichiers">${res.map(({ f, loc }) => ligneFichier(f, 'Documents › ' + loc)).join('')}</div>`
          : `<div class="exp-vide">Aucun fichier ne correspond.</div>`}</div>`;
      bindExplorateur(tree);
      return;
    }

    let segs = `<button class="fil-seg ${chemin.length === 0 ? 'actuel' : ''}" data-i="-1">Documents</button>`;
    chemin.forEach((k, i) => { segs += `<span class="fil-sep">›</span><button class="fil-seg ${i === chemin.length - 1 ? 'actuel' : ''}" data-i="${i}">${ech(k)}</button>`; });

    const node = noeudA(tree, chemin) || tree;
    let corps;
    if (Array.isArray(node)) {
      const ouvrirDossierBtn = node._dossier ? `<button type="button" class="btn-action btn-secondaire-action" id="exp-ouvrir-dossier" data-dossier="${ech(node._dossier)}">Ouvrir ce dossier</button>` : '';
      corps = node.length
        ? `<div class="exp-section-label">${node.length} fichier${node.length > 1 ? 's' : ''} ${ouvrirDossierBtn}</div><div class="exp-fichiers">${node.map((f) => ligneFichier(f)).join('')}</div>`
        : `<div class="exp-vide">Dossier vide.</div>`;
    } else {
      const cles = Object.keys(node).sort((a, b) => {
        if (/^\d{4}$/.test(a) && /^\d{4}$/.test(b)) return b.localeCompare(a); // années récentes d'abord
        return sansAccents(a).localeCompare(sansAccents(b));
      });
      corps = cles.length
        ? `<div class="exp-section-label">${cles.length} dossier${cles.length > 1 ? 's' : ''}</div><div class="exp-dossiers">${cles.map((k) => `<button class="exp-dossier" data-k="${ech(k)}">${iconeDossier(k)}<span><span class="nom">${ech(k)}</span><span class="meta">${compte(node[k])}</span></span></button>`).join('')}</div>`
        : `<div class="exp-vide">Vide.</div>`;
    }

    zone.innerHTML = `
      <div class="exp-barre">
        <button class="exp-remonter" id="exp-remonter" title="Remonter" aria-label="Remonter" ${chemin.length === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/></svg></button>
        <div class="fil" id="exp-fil">${segs}</div>
      </div>
      <div id="exp-contenu">${corps}</div>`;
    bindExplorateur(tree);
  }

  function bindExplorateur(tree) {
    const rem = zone.querySelector('#exp-remonter');
    if (rem) rem.addEventListener('click', () => { if (chemin.length) { chemin.pop(); peindreExplorateur(); } });
    zone.querySelectorAll('#exp-fil .fil-seg').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.i); chemin = i < 0 ? [] : chemin.slice(0, i + 1); peindreExplorateur(); }));
    zone.querySelectorAll('.exp-dossier').forEach((b) => b.addEventListener('click', () => { chemin = [...chemin, b.dataset.k]; peindreExplorateur(); }));
    const od = zone.querySelector('#exp-ouvrir-dossier');
    if (od) od.addEventListener('click', async () => { try { await window.api.ouvrirDossier(od.dataset.dossier); } catch {} });
    zone.querySelectorAll('.exp-fichier').forEach((row) => {
      const pdf = row.dataset.pdf;
      row.querySelector('[data-act="voir"]').addEventListener('click', async () => { try { await window.api.pdfOuvrir(pdf); } catch {} });
      row.querySelector('[data-act="dossier"]').addEventListener('click', async () => { try { await window.api.pdfRevelerDansExplorateur(pdf); } catch {} });
      const br = row.querySelector('[data-act="regen"]');
      if (br) br.addEventListener('click', (e) => regenerer(e.currentTarget, { type: row.dataset.regen, ref_id: Number(row.dataset.ref) }));
    });
  }

  // ──────────────────────── Commun ────────────────────────
  async function regenerer(btn, d) {
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
  }

  // Barre latérale des types : pilote fType pour les DEUX vues.
  navTypes.addEventListener('click', (e) => {
    const b = e.target.closest('.cat-item');
    if (!b || b.dataset.cat === fType) return;
    fType = b.dataset.cat;
    chemin = []; // repartir de la racine de l'explorateur pour le nouveau type
    peindre();
  });

  // Filtres secondaires permanents (Année, Artiste, Client).
  contenu.querySelector('#f-annee').addEventListener('change', (e) => { fAnnee = e.target.value; peindre(); });
  contenu.querySelector('#f-artiste').addEventListener('change', (e) => { fArtiste = e.target.value; peindre(); });
  contenu.querySelector('#f-client').addEventListener('change', (e) => { fClient = e.target.value; peindre(); });
  contenu.querySelector('#f-reset').addEventListener('click', () => {
    fType = fAnnee = fArtiste = fClient = 'tous'; recherche = ''; inputRecherche.value = ''; chemin = [];
    peindre();
  });

  inputRecherche.addEventListener('input', (e) => { recherche = sansAccents(e.target.value || ''); peindre(); });
  contenu.querySelectorAll('.doc-vue-bascule button').forEach((b) => b.addEventListener('click', () => {
    if (vue === b.dataset.vue) return;
    vue = b.dataset.vue; localStorage.setItem(CLE_VUE, vue);
    if (vue === 'explorateur') chemin = [];
    peindre();
  }));

  construireSidebar();
  construireFiltres();
  peindre();
}
