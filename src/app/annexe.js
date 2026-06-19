// Annexe A — dépôt / retrait d'œuvres.
// Construit les lignes du document (codes médium/support/signature + prix
// préférentiel/courant via les cotes) et fournit une modale de sélection pour
// la génération manuelle « hors flux ». La numérotation et le rendu PDF se font
// côté main (IPC pdf:annexe-generer).

import { ech, nomComplet } from './commun.js';
import { confirmer } from './dialogue.js';
import { calculerPrixSuggere } from './calcul-prix.js';

// Première lettre de chaque mot, sans accent, en majuscule (même règle que
// src/db/nomenclature.js, répliquée ici car ce module est côté renderer).
function codeLettres(v) {
  return (v == null ? '' : String(v))
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .split(/[\s-]+/).filter(Boolean)
    .map((m) => m[0].toUpperCase())
    .join('');
}

function fmtPrix(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v).toLocaleString('fr-CA') + ' $' : '';
}

// Construit les lignes d'œuvres pour le gabarit d'annexe.
export function construireLignesAnnexe(artiste, oeuvres) {
  return oeuvres.map((o) => {
    const calc = calculerPrixSuggere({
      artiste,
      oeuvre: { hauteur: o.hauteur, largeur: o.largeur, medium: o.medium, format: o.format },
    });
    const prixSansCadre = calc ? calc.prix_preferentiel : null;
    // À défaut de cote applicable, on retombe sur le prix enregistré pour la
    // colonne « cadre inclus » ; « sans cadre » reste vide (à remplir à la main).
    const prixCadre = calc ? calc.prix_courant : (Number(o.prix) || null);
    return {
      id: o.id,
      inv: o.numero_inventaire || '',
      titre: o.titre || '',
      format: codeLettres(o.format),
      h: o.hauteur != null ? o.hauteur : '',
      l: o.largeur != null ? o.largeur : '',
      p: o.profondeur != null ? o.profondeur : '',
      medium: codeLettres(o.medium),
      support: codeLettres(o.support),
      signature: codeLettres(o.emplacement_signature),
      annee: o.annee != null ? String(o.annee) : '',
      prix_sans_cadre: fmtPrix(prixSansCadre),
      prix_cadre: fmtPrix(prixCadre),
      remarque: '',
    };
  });
}

// Génère l'annexe (IPC) puis propose d'ouvrir le PDF. Retourne le résultat IPC.
export async function produireAnnexe({ artiste, oeuvres, type, editer = false }) {
  const rows = construireLignesAnnexe(artiste, oeuvres);
  const res = await window.api.pdfAnnexeGenerer({
    type,
    artiste_id: artiste.id,
    oeuvres: rows,
    oeuvreIds: rows.map((r) => r.id),
    editer,
  });
  if (!res || !res.pdf_path) return null; // édition annulée
  const rep = await confirmer({
    type: 'succes',
    title: 'Annexe produite',
    message: `Annexe ${res.numero} générée (${rows.length} œuvre(s)).`,
    buttons: ['Ouvrir le PDF', 'Fermer'],
    defaultId: 0,
    cancelId: 1,
  });
  if (rep === 0) { try { await window.api.pdfOuvrir(res.pdf_path); } catch {} }
  return res;
}

// Proposé dans les flux (après ajout d'œuvres → dépôt ; après retrait → retrait).
// Demande confirmation, puis génère l'annexe pour les œuvres données d'un artiste.
export async function proposerAnnexeApres({ type, artisteId, oeuvreIds }) {
  if (!artisteId || !Array.isArray(oeuvreIds) || !oeuvreIds.length) return null;
  const estRetrait = type === 'retrait';
  const rep = await confirmer({
    type: 'question',
    title: estRetrait ? 'Annexe A — retrait' : 'Annexe A — dépôt',
    message: `Produire l'annexe A de ${estRetrait ? 'retrait' : 'dépôt'} pour ${oeuvreIds.length} œuvre(s) ?`,
    buttons: ['Produire l’annexe', 'Plus tard'],
    defaultId: 0,
    cancelId: 1,
  });
  if (rep !== 0) return null;
  try {
    const [artiste, oeuvres] = await Promise.all([
      window.api.artisteGet(artisteId),
      window.api.oeuvresParIds(oeuvreIds),
    ]);
    if (!artiste || !oeuvres || !oeuvres.length) return null;
    return await produireAnnexe({ artiste, oeuvres, type });
  } catch (err) {
    await confirmer({ type: 'error', title: 'Échec', message: (err && err.message) || String(err), buttons: ['OK'] });
    return null;
  }
}

// Modale de sélection pour la génération manuelle depuis la fiche artiste.
// `oeuvres` = liste détaillée (oeuvresDetailArtiste). Retourne le résultat ou null.
export function ouvrirAnnexeModale({ artiste, oeuvres, type = 'depot' }) {
  return new Promise((resolve) => {
    let typeCourant = type;
    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';

    const lignesHtml = oeuvres.map((o) => `
      <label class="annexe-ligne">
        <input type="checkbox" value="${o.id}" checked>
        <span class="annexe-inv">${ech(o.numero_inventaire || '—')}</span>
        <span class="annexe-titre">${ech(o.titre || 'Sans titre')}</span>
        ${o.retrait_date ? '<span class="annexe-tag">retirée</span>' : ''}
      </label>`).join('');

    overlay.innerHTML = `
      <div class="dialogue" role="dialog" aria-modal="true" style="max-width: 660px;">
        <div class="dialogue-entete"><h3 class="dialogue-titre">Produire une Annexe A</h3></div>
        <p class="dialogue-message">Pour <strong>${ech(nomComplet(artiste) || artiste.nom || 'cet artiste')}</strong></p>
        <div class="taille-vue" id="annexe-type" role="group" aria-label="Type d'annexe" style="margin-bottom:12px;">
          <button type="button" data-type="depot" class="${typeCourant === 'depot' ? 'actif' : ''}">Dépôt</button>
          <button type="button" data-type="retrait" class="${typeCourant === 'retrait' ? 'actif' : ''}">Retrait</button>
        </div>
        <div class="annexe-barre">
          <span id="annexe-compte"></span>
          <button type="button" class="btn-lien" id="annexe-tout">Tout cocher / décocher</button>
        </div>
        <div class="annexe-liste">${lignesHtml || '<p class="aide-champ" style="margin:0;">Aucune œuvre pour cet artiste.</p>'}</div>
        <div class="dialogue-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="annexe-annuler">Annuler</button>
          <button type="button" class="btn-action btn-secondaire-action" id="annexe-produire-mod">Version modifiée…</button>
          <button type="button" class="btn-action btn-principal" id="annexe-produire">Produire l'annexe</button>
        </div>
      </div>`;

    const cases = () => Array.from(overlay.querySelectorAll('.annexe-liste input[type="checkbox"]'));
    const majCompte = () => {
      const n = cases().filter((c) => c.checked).length;
      overlay.querySelector('#annexe-compte').textContent = `${n} œuvre(s) sélectionnée(s)`;
    };

    function fermer(resultat) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(resultat);
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); fermer(null); } }
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(null); });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    overlay.querySelectorAll('#annexe-type button').forEach((b) => {
      b.addEventListener('click', () => {
        typeCourant = b.dataset.type;
        overlay.querySelectorAll('#annexe-type button').forEach((x) => x.classList.toggle('actif', x === b));
      });
    });
    overlay.addEventListener('change', (e) => { if (e.target.matches('.annexe-liste input')) majCompte(); });
    overlay.querySelector('#annexe-tout').addEventListener('click', () => {
      const tout = cases().some((c) => !c.checked);
      cases().forEach((c) => { c.checked = tout; });
      majCompte();
    });
    overlay.querySelector('#annexe-annuler').addEventListener('click', () => fermer(null));

    async function lancer(editer, btn) {
      const ids = new Set(cases().filter((c) => c.checked).map((c) => Number(c.value)));
      const choisies = oeuvres.filter((o) => ids.has(o.id));
      if (!choisies.length) {
        await confirmer({ type: 'warning', title: 'Aucune œuvre', message: 'Coche au moins une œuvre.', buttons: ['OK'] });
        return;
      }
      const libelle = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Génération…';
      try {
        const res = await produireAnnexe({ artiste, oeuvres: choisies, type: typeCourant, editer });
        if (res) { fermer(res); return; }
        // édition annulée : on rouvre la modale telle quelle
        btn.disabled = false;
        btn.textContent = libelle;
      } catch (err) {
        btn.disabled = false;
        btn.textContent = libelle;
        await confirmer({ type: 'error', title: 'Échec', message: (err && err.message) || String(err), buttons: ['OK'] });
      }
    }
    overlay.querySelector('#annexe-produire').addEventListener('click', (e) => lancer(false, e.currentTarget));
    overlay.querySelector('#annexe-produire-mod').addEventListener('click', (e) => lancer(true, e.currentTarget));

    majCompte();
  });
}
