// Comparaison « site web » d'un SEUL élément, depuis sa fiche (œuvre ou artiste).
// Réutilise les mêmes IPC que l'écran de synchronisation. Lecture seule côté site.

import { ech, formaterPrix, nettoyerErreur, STATUTS, badgeStatut } from './commun.js';
import { alerter, editerTexteImport } from './dialogue.js';
import { recadrerCarre } from './recadrage.js';

const CHAMPS_TEXTE = new Set(['titre', 'description', 'citation', 'biographie', 'demarche', 'curriculum']);

function valeurAffichee(champ, v) {
  if (champ === 'prix') return (v == null || v === '') ? '—' : formaterPrix(Number(v));
  const s = (v == null) ? '' : String(v);
  return s.trim() ? ech(s) : '<span class="wsync-vide">— (vide)</span>';
}

// Point d'entrée œuvre.
export async function synchroniserOeuvre(oeuvreId, apresMaj) {
  let data;
  try { data = await window.api.webComparerOeuvre(oeuvreId); }
  catch (err) { await alerter({ type: 'error', title: 'Site web', message: nettoyerErreur(err) }); return; }
  if (!data.relie) {
    await alerter({ type: 'info', title: 'Non reliée au site', message: data.sku ? `Aucun produit avec le numéro « ${data.sku} » sur le site.` : "Cette œuvre n'a pas de numéro d'inventaire." });
    return;
  }
  const ligne = data.ligne || { champs: [] };
  const diffs = (ligne.champs || []).filter((c) => !c.ignore);
  if (ligne.statut_reconcilier && !ligne.statut_reconcilier.ignore) {
    diffs.push({ champ: 'statut', libelle: 'Statut', _statut: ligne.statut_reconcilier, statutApp: ligne.statut_app });
  }
  if (!diffs.length) { await alerter({ type: 'succes', title: 'À jour', message: 'Cette œuvre concorde avec le site.' }); return; }
  ouvrirModale({ type: 'oeuvre', id: oeuvreId, titre: ligne.titre, diffs, apresMaj });
}

// Point d'entrée artiste.
export async function synchroniserArtiste(artisteId, apresMaj) {
  let data;
  try { data = await window.api.webComparerArtiste(artisteId); }
  catch (err) { await alerter({ type: 'error', title: 'Site web', message: nettoyerErreur(err) }); return; }
  if (!data.relie) { await alerter({ type: 'info', title: 'Non reliée au site', message: "Aucune page d'artiste correspondante sur le site (rapprochement par le nom)." }); return; }
  const ligne = data.ligne || { champs: [] };
  const diffs = (ligne.champs || []).filter((c) => !c.ignore);
  if (!diffs.length) { await alerter({ type: 'succes', title: 'À jour', message: 'Cet artiste concorde avec le site.' }); return; }
  ouvrirModale({ type: 'artiste', id: artisteId, titre: ligne.nom, diffs, apresMaj });
}

function ouvrirModale({ type, id, titre, diffs, apresMaj }) {
  let modifie = false;
  const overlay = document.createElement('div');
  overlay.className = 'overlay-modale overlay-dialogue';
  overlay.innerHTML = `
    <div class="dialogue" role="dialog" aria-modal="true" style="max-width: 720px; width: 92vw;">
      <div class="dialogue-entete"><h3 class="dialogue-titre">Comparer avec le site — ${ech(titre || '')}</h3></div>
      <p class="dialogue-message">Rien n'est modifié sur le site. Reprenez ce qui a changé, ou gardez votre version.</p>
      <div class="sf-liste"></div>
      <div class="dialogue-actions"><button type="button" class="btn-action btn-principal" data-fermer>Fermer</button></div>
    </div>`;
  const liste = overlay.querySelector('.sf-liste');

  const fermer = () => { window.removeEventListener('keydown', onKey); overlay.remove(); if (modifie && apresMaj) apresMaj(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(); });
  overlay.querySelector('[data-fermer]').addEventListener('click', fermer);
  window.addEventListener('keydown', onKey);

  const retirer = (champ) => {
    const i = diffs.findIndex((d) => d.champ === champ);
    if (i >= 0) diffs.splice(i, 1);
    modifie = true;
    if (!diffs.length) fermer(); else dessiner();
  };

  function ligneHtml(c) {
    if (c.champ === 'statut') {
      const options = Object.entries(STATUTS).map(([k, v]) => `<option value="${k}" ${k === c._statut.suggere ? 'selected' : ''}>${ech(v.libelle)}</option>`).join('');
      return `<div class="wsync-champ" data-champ="statut">
        <div class="wsync-lib">Statut</div>
        <div class="wsync-cols">
          <div class="wsync-col"><span class="wsync-et">Dans l'app</span><div class="wsync-val">${badgeStatut(c.statutApp)}</div></div>
          <div class="wsync-col site"><span class="wsync-et">Sur le site</span><div class="wsync-val">${ech(c._statut.site_indication)}</div></div>
        </div>
        <div class="wsync-champ-actions wsync-statut-actions">
          <label class="wsync-statut-choix">Mettre à <select class="sf-statut-select">${options}</select></label>
          <button type="button" class="btn-action btn-secondaire-action" data-statut-ok>Appliquer</button>
          <button type="button" class="btn-lien" data-garder>Garder la version de l'app</button>
        </div>
      </div>`;
    }
    const estPhoto = c.champ === 'photo';
    const btnReprendre = estPhoto
      ? '<button type="button" class="btn-action btn-secondaire-action" data-photo>Télécharger la photo du site →</button>'
      : '<button type="button" class="btn-action btn-secondaire-action" data-reprendre>Reprendre la valeur du site →</button>';
    return `<div class="wsync-champ" data-champ="${ech(c.champ)}">
      <div class="wsync-lib">${ech(c.libelle)}</div>
      <div class="wsync-cols">
        <div class="wsync-col"><span class="wsync-et">Dans l'app</span><div class="wsync-val">${valeurAffichee(c.champ, c.app)}</div></div>
        <div class="wsync-col site"><span class="wsync-et">Sur le site</span><div class="wsync-val">${valeurAffichee(c.champ, c.site)}</div></div>
      </div>
      <div class="wsync-champ-actions">${btnReprendre} <button type="button" class="btn-lien" data-garder>Garder la version de l'app</button></div>
    </div>`;
  }

  const importerTexte = async (champ, valeur) => {
    if (type === 'oeuvre') await window.api.webImporterChamp(id, champ, valeur);
    else await window.api.webImporterChampArtiste(id, champ, valeur);
  };
  const garder = async (champ, siteCle) => {
    if (type === 'oeuvre') await window.api.webIgnorerDiff(id, champ, siteCle);
    else await window.api.webIgnorerDiffArtiste(id, champ, siteCle);
  };

  function dessiner() {
    liste.innerHTML = diffs.map(ligneHtml).join('');
    liste.querySelectorAll('.wsync-champ').forEach((bloc) => {
      const champ = bloc.dataset.champ;
      const c = diffs.find((d) => d.champ === champ);
      if (!c) return;
      bloc.querySelector('[data-reprendre]')?.addEventListener('click', async (e) => {
        let valeur = c.site;
        if (CHAMPS_TEXTE.has(champ)) {
          const edite = await editerTexteImport(c.libelle || champ, c.site == null ? '' : String(c.site));
          if (edite == null) return;
          valeur = edite;
        }
        e.currentTarget.disabled = true;
        try { await importerTexte(champ, valeur); retirer(champ); }
        catch (err) { e.currentTarget.disabled = false; await alerter({ type: 'error', title: 'Import échoué', message: nettoyerErreur(err) }); }
      });
      bloc.querySelector('[data-photo]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Téléchargement…';
        try {
          const dataUrl = await window.api.webTelechargerImage(c.site_image);
          const crop = await recadrerCarre(dataUrl);
          if (crop) { await window.api.photoEnregistrerRecadree('artistes', id, crop, dataUrl); retirer('photo'); }
          else { btn.disabled = false; btn.textContent = 'Télécharger la photo du site →'; }
        } catch (err) { btn.disabled = false; btn.textContent = 'Télécharger la photo du site →'; await alerter({ type: 'error', title: 'Photo non ajoutée', message: nettoyerErreur(err) }); }
      });
      bloc.querySelector('[data-statut-ok]')?.addEventListener('click', async (e) => {
        const sel = bloc.querySelector('.sf-statut-select');
        e.currentTarget.disabled = true;
        try { await window.api.webDefinirStatut(id, sel.value); retirer('statut'); }
        catch (err) { e.currentTarget.disabled = false; await alerter({ type: 'error', title: 'Statut non modifié', message: nettoyerErreur(err) }); }
      });
      bloc.querySelector('[data-garder]')?.addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        const siteCle = champ === 'statut' ? c._statut.site_cle : c.site_cle;
        try { await garder(champ, siteCle); retirer(champ); }
        catch (err) { e.currentTarget.disabled = false; await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
      });
    });
  }

  document.body.appendChild(overlay);
  dessiner();
}
