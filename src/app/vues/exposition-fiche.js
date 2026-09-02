// Fiche d'une exposition : ses informations, ses œuvres, et les trois gestes
// qui comptent — faire partir des œuvres, en rendre une, mettre fin à tout.
//
// Règles portées par la base (mutations.js), rappelées ici pour la lecture :
//   - seules les œuvres disponibles ou réservées, encore à la galerie et pas
//     déjà dans une autre exposition en cours, peuvent partir ;
//   - le statut d'avant le départ est mémorisé et rendu à la clôture ;
//   - une œuvre vendue pendant l'exposition n'est JAMAIS ramenée en arrière.

import { naviguer, retour } from '../router.js';
import {
  ech, sansAccents, pluriel, formaterPrix, formaterDate, nomComplet,
  nettoyerErreur, badgeStatut,
} from '../commun.js';
import { alerter, confirmer } from '../dialogue.js';

export async function rendreExpositionFiche(contenu, params = {}) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) { retour(); return; }

  let expo = null;
  try {
    expo = await window.api.exposGet(id);
  } catch (err) {
    contenu.innerHTML = `<div class="vue-fiche"><p class="liste-vide">${ech(nettoyerErreur(err))}</p></div>`;
    return;
  }
  if (!expo) {
    contenu.innerHTML = `<div class="vue-fiche"><p class="liste-vide">Exposition introuvable.</p></div>`;
    return;
  }

  async function rafraichir() {
    expo = await window.api.exposGet(id);
    dessiner();
  }

  function periode() {
    const d = expo.date_debut ? formaterDate(expo.date_debut) : null;
    const f = expo.date_fin_reelle || expo.date_fin_prevue;
    const ff = f ? formaterDate(f) : null;
    if (d && ff) return `du ${d} au ${ff}`;
    if (d) return `depuis le ${d}`;
    if (ff) return `jusqu'au ${ff}`;
    return 'dates non précisées';
  }

  function dessiner() {
    const enCours = expo.statut === 'en_cours';
    const presentes = expo.oeuvres.filter((o) => !o.retire_le);
    const valeur = presentes.reduce((s, o) => s + (Number(o.prix) || 0), 0);
    const artistes = new Set(presentes.map((o) => o.artiste_nom)).size;

    const lignes = presentes.map((o) => {
      const nom = nomComplet({ nom: o.artiste_nom, prenom: o.artiste_prenom }) || o.artiste_nom || '';
      return `
        <tr>
          <td class="expo-td-num">${ech(o.numero_inventaire || '—')}</td>
          <td>${ech(o.titre)}</td>
          <td>${ech(nom)}</td>
          <td>${ech(o.medium || '—')}</td>
          <td class="expo-td-num">${ech(o.dimensions || '—')}</td>
          <td class="expo-td-prix">${o.prix != null ? formaterPrix(o.prix) : '—'}</td>
          <td>${badgeStatut(o.statut)}</td>
          ${enCours ? `<td class="expo-td-action"><button type="button" class="btn-lien" data-retirer="${o.id}">Rendre</button></td>` : ''}
        </tr>`;
    }).join('');

    contenu.innerHTML = `
      <div class="vue-fiche expo-vue">
        <button type="button" class="lien-retour" id="btn-retour">&lsaquo; Expositions</button>

        <div class="carte hero-expo">
          <div class="hero-expo-corps">
            <h1 class="hero-expo-nom">${ech(expo.nom)}</h1>
            <p class="hero-expo-meta">
              ${expo.lieu ? ech(expo.lieu) : '<em>lieu non précisé</em>'}
              &nbsp;&middot;&nbsp; ${ech(periode())}
              &nbsp;&middot;&nbsp; <span class="badge-expo ${enCours ? 'badge-expo-encours' : 'badge-expo-terminee'}">${enCours ? 'En cours' : 'Terminée'}</span>
            </p>
            <div class="hero-artiste-filet"></div>
            <div class="hero-artiste-stats">
              <div class="hero-stat"><span class="v accent">${presentes.length}</span><span class="l">${presentes.length === 1 ? 'Œuvre partie' : 'Œuvres parties'}</span></div>
              <div class="hero-stat"><span class="v">${formaterPrix(valeur)}</span><span class="l">Valeur exposée</span></div>
              <div class="hero-stat"><span class="v">${artistes}</span><span class="l">${artistes === 1 ? 'Artiste' : 'Artistes'}</span></div>
            </div>
          </div>
          <div class="hero-expo-actions">
            <div class="grp-actions">
              <button type="button" class="btn-action" id="btn-modifier">Modifier les informations</button>
              <button type="button" class="btn-action btn-principal" id="btn-cartels" ${presentes.length ? '' : 'disabled'}>Imprimer les cartels</button>
            </div>
            ${enCours
              ? `<button type="button" class="btn-action btn-danger" id="btn-fin">Mettre fin à l'exposition</button>`
              : `<button type="button" class="btn-action btn-danger" id="btn-supprimer">Supprimer</button>`}
          </div>
        </div>

        <div class="carte">
          <div class="entete-bloc-bento">
            <h3>Œuvres de l'exposition</h3>
            <div class="entete-bloc-actions">
              ${enCours ? `<button type="button" class="btn-action" id="btn-ajouter-oeuvres">+ Ajouter des œuvres</button>` : ''}
            </div>
          </div>
          ${presentes.length ? `
            <table class="expo-table">
              <thead>
                <tr>
                  <th>N°</th><th>Titre</th><th>Artiste</th><th>Médium</th><th>Dimensions</th>
                  <th class="expo-td-prix">Prix</th><th>Statut</th>${enCours ? '<th></th>' : ''}
                </tr>
              </thead>
              <tbody>${lignes}</tbody>
            </table>
          ` : `<p class="aide-champ" style="font-style:italic;margin:0;">Aucune œuvre pour l'instant.${enCours ? ' Utilise « + Ajouter des œuvres ».' : ''}</p>`}
        </div>

        ${expo.notes ? `<div class="carte"><h3>Notes</h3><p class="aide-champ" style="margin:0;white-space:pre-wrap;">${ech(expo.notes)}</p></div>` : ''}
      </div>
    `;

    contenu.querySelector('#btn-retour').addEventListener('click', () => naviguer('expositions-liste'));
    contenu.querySelector('#btn-modifier')?.addEventListener('click', ouvrirModification);
    contenu.querySelector('#btn-ajouter-oeuvres')?.addEventListener('click', ouvrirSelecteur);
    contenu.querySelector('#btn-fin')?.addEventListener('click', mettreFin);
    contenu.querySelector('#btn-supprimer')?.addEventListener('click', supprimer);
    contenu.querySelector('#btn-cartels')?.addEventListener('click', ouvrirCartels);
    contenu.querySelectorAll('[data-retirer]').forEach((b) =>
      b.addEventListener('click', () => rendreUne(Number(b.dataset.retirer))));
  }

  // ---- Modifier les informations ----
  function ouvrirModification() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue" role="dialog" aria-modal="true">
        <div class="dialogue-entete"><h3 class="dialogue-titre">Modifier l'exposition</h3></div>
        <div class="form-champ">
          <label for="m-nom">Nom <span class="requis">*</span></label>
          <input type="text" id="m-nom" value="${ech(expo.nom)}" autocomplete="off">
        </div>
        <div class="form-champ">
          <label for="m-lieu">Lieu</label>
          <input type="text" id="m-lieu" value="${ech(expo.lieu || '')}" autocomplete="off">
        </div>
        <div class="grille-form">
          <div class="form-champ">
            <label for="m-debut">Début</label>
            <input type="date" id="m-debut" value="${ech(expo.date_debut || '')}">
          </div>
          <div class="form-champ">
            <label for="m-fin">Fin prévue</label>
            <input type="date" id="m-fin" value="${ech(expo.date_fin_prevue || '')}">
          </div>
        </div>
        <div class="form-champ">
          <label for="m-notes">Notes</label>
          <textarea id="m-notes" rows="3">${ech(expo.notes || '')}</textarea>
        </div>
        <div class="dialogue-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="m-annuler">Annuler</button>
          <button type="button" class="btn-action btn-principal" id="m-ok">Enregistrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const fermer = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#m-annuler').addEventListener('click', fermer);
    const ok = overlay.querySelector('#m-ok');
    ok.addEventListener('click', async () => {
      const nom = overlay.querySelector('#m-nom').value.trim();
      if (!nom) {
        await alerter({ type: 'warning', title: 'Nom requis', message: "Le nom ne peut pas être vide." });
        return;
      }
      ok.disabled = true;
      try {
        await window.api.exposModifier(id, {
          nom,
          lieu: overlay.querySelector('#m-lieu').value.trim(),
          date_debut: overlay.querySelector('#m-debut').value || null,
          date_fin_prevue: overlay.querySelector('#m-fin').value || null,
          notes: overlay.querySelector('#m-notes').value.trim(),
        });
        fermer();
        await rafraichir();
      } catch (err) {
        ok.disabled = false;
        await alerter({ type: 'error', title: 'Enregistrement échoué', message: nettoyerErreur(err) });
      }
    });
    overlay.querySelector('#m-nom').focus();
  }

  // ---- Choisir les œuvres qui partent ----
  async function ouvrirSelecteur() {
    let eligibles = [];
    try {
      eligibles = await window.api.exposEligibles();
    } catch (err) {
      await alerter({ type: 'error', title: 'Lecture impossible', message: nettoyerErreur(err) });
      return;
    }
    const choisies = new Set();
    const artistes = Array.from(new Set(eligibles.map((o) =>
      nomComplet({ nom: o.artiste_nom, prenom: o.artiste_prenom }) || o.artiste_nom || ''))).sort(
      (a, b) => sansAccents(a).localeCompare(sansAccents(b)));

    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue expo-selecteur" role="dialog" aria-modal="true">
        <div class="dialogue-entete"><h3 class="dialogue-titre">Ajouter des œuvres</h3></div>
        <p class="aide-champ">Seules les œuvres <strong>disponibles ou réservées</strong>, encore à la galerie et pas déjà dans une autre exposition en cours, sont proposées.</p>
        <div class="expo-sel-filtres">
          <input type="text" id="sel-q" placeholder="Rechercher (titre, artiste, numéro)…" autocomplete="off">
          <select id="sel-artiste">
            <option value="">Tous les artistes</option>
            ${artistes.map((a) => `<option value="${ech(a)}">${ech(a)}</option>`).join('')}
          </select>
        </div>
        <div class="expo-sel-liste" id="sel-liste"></div>
        <div class="dialogue-actions expo-sel-pied">
          <span class="compteur" id="sel-compteur">Aucune sélectionnée</span>
          <span class="expo-sel-boutons">
            <button type="button" class="btn-action btn-secondaire-action" id="sel-annuler">Annuler</button>
            <button type="button" class="btn-action btn-principal" id="sel-ok" disabled>Ajouter</button>
          </span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const fermer = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#sel-annuler').addEventListener('click', fermer);

    const zone = overlay.querySelector('#sel-liste');
    const compteur = overlay.querySelector('#sel-compteur');
    const btnOk = overlay.querySelector('#sel-ok');

    function majCompteur() {
      compteur.textContent = choisies.size
        ? pluriel(choisies.size, 'œuvre sélectionnée', 'œuvres sélectionnées')
        : 'Aucune sélectionnée';
      btnOk.disabled = choisies.size === 0;
    }
    function dessinerListe() {
      const q = sansAccents(overlay.querySelector('#sel-q').value);
      const art = overlay.querySelector('#sel-artiste').value;
      const vues = eligibles.filter((o) => {
        const nom = nomComplet({ nom: o.artiste_nom, prenom: o.artiste_prenom }) || o.artiste_nom || '';
        if (art && nom !== art) return false;
        if (!q) return true;
        return sansAccents([o.titre, nom, o.numero_inventaire].filter(Boolean).join(' ')).includes(q);
      });
      zone.innerHTML = vues.length ? vues.map((o) => {
        const nom = nomComplet({ nom: o.artiste_nom, prenom: o.artiste_prenom }) || o.artiste_nom || '';
        const meta = [nom, o.numero_inventaire, o.medium, o.dimensions,
          o.prix != null ? formaterPrix(o.prix) : null].filter(Boolean).join(' · ');
        return `
          <label class="expo-sel-choix">
            <input type="checkbox" data-sel="${o.id}" ${choisies.has(o.id) ? 'checked' : ''}>
            <span class="expo-sel-corps">
              <span class="expo-sel-titre">${ech(o.titre)} ${badgeStatut(o.statut)}</span>
              <span class="expo-sel-meta">${ech(meta)}</span>
            </span>
          </label>`;
      }).join('') : `<p class="aide-champ" style="font-style:italic;padding:14px 2px;">Aucune œuvre disponible ne correspond.</p>`;
      zone.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', () => {
        const oid = Number(c.dataset.sel);
        if (c.checked) choisies.add(oid); else choisies.delete(oid);
        majCompteur();
      }));
    }
    overlay.querySelector('#sel-q').addEventListener('input', dessinerListe);
    overlay.querySelector('#sel-artiste').addEventListener('change', dessinerListe);

    btnOk.addEventListener('click', async () => {
      btnOk.disabled = true;
      btnOk.textContent = 'Ajout…';
      try {
        const r = await window.api.exposAjouterOeuvres(id, Array.from(choisies));
        fermer();
        await rafraichir();
        const details = [];
        if (r.ignorees) details.push(`${pluriel(r.ignorees, 'œuvre a été ignorée', 'œuvres ont été ignorées')} (vendue, retirée ou déjà ailleurs).`);
        if (r.deja) details.push(`${pluriel(r.deja, 'œuvre était déjà', 'œuvres étaient déjà')} dans cette exposition.`);
        await alerter({
          type: 'succes',
          title: 'Œuvres ajoutées',
          message: `${pluriel(r.ajoutees, 'œuvre est partie', 'œuvres sont parties')} en exposition.`,
          detail: details.length ? details.join('\n') : "Leur statut est passé à « En exposition ». Il sera rendu tel quel à la clôture.",
        });
      } catch (err) {
        btnOk.disabled = false;
        btnOk.textContent = 'Ajouter';
        await alerter({ type: 'error', title: 'Ajout impossible', message: nettoyerErreur(err) });
      }
    });
    dessinerListe();
    majCompteur();
    overlay.querySelector('#sel-q').focus();
  }

  // ---- Imprimer les cartels ----
  // Deux réglages seulement : le nombre par page et l'affichage du prix.
  // Le reste (contenu, code QR) est fixe — voir gabarit-cartels.html.
  function ouvrirCartels() {
    const presentes = expo.oeuvres.filter((x) => !x.retire_le);
    const sansAdresse = presentes.filter((x) => !x.url_site).length;
    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue" role="dialog" aria-modal="true">
        <div class="dialogue-entete"><h3 class="dialogue-titre">Imprimer les cartels</h3></div>
        <p class="dialogue-message">${pluriel(presentes.length, 'cartel sera produit', 'cartels seront produits')}, en format Lettre, avec traits de découpe.</p>
        <div class="form-champ">
          <label for="c-format">Cartels par page</label>
          <select id="c-format">
            <option value="10" selected>10 par page — compact (défaut)</option>
            <option value="8">8 par page</option>
            <option value="6">6 par page</option>
            <option value="4">4 par page — grand, lisible de loin</option>
          </select>
        </div>
        <div class="form-champ form-champ-checkbox">
          <input type="checkbox" id="c-prix" checked>
          <label for="c-prix">Afficher le prix sur les cartels</label>
        </div>
        ${sansAdresse ? `<p class="aide-champ" style="margin-top:10px;">${pluriel(sansAdresse, 'œuvre n\u2019a', 'œuvres n\u2019ont')} pas d'adresse sur le site : ${sansAdresse > 1 ? 'leurs cartels sortiront' : 'son cartel sortira'} sans code QR. Le bouton « Récupérer les adresses du site » peut y remédier.</p>` : ''}
        <div class="dialogue-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="c-annuler">Annuler</button>
          <button type="button" class="btn-action btn-principal" id="c-ok">Produire le PDF</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const fermer = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#c-annuler').addEventListener('click', fermer);

    const ok = overlay.querySelector('#c-ok');
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      const lib = ok.textContent;
      ok.textContent = 'Production…';
      try {
        const r = await window.api.exposCartels(id, {
          format: Number(overlay.querySelector('#c-format').value),
          afficherPrix: overlay.querySelector('#c-prix').checked,
        });
        fermer();
        const details = [`${pluriel(r.pages, 'page', 'pages')} à imprimer.`];
        if (r.nb_sans_qr) details.push(`${pluriel(r.nb_sans_qr, 'cartel est sorti', 'cartels sont sortis')} sans code QR (adresse du site manquante).`);
        const rep = await confirmer({
          type: 'succes',
          title: 'Cartels produits',
          message: `${pluriel(r.nb_cartels, 'cartel produit', 'cartels produits')}.`,
          detail: details.join('\n'),
          buttons: ['Ouvrir le PDF', 'Fermer'], defaultId: 0, cancelId: 1,
        });
        if (rep === 0) await window.api.pdfOuvrir(r.pdf_path);
      } catch (err) {
        ok.disabled = false;
        ok.textContent = lib;
        await alerter({ type: 'error', title: 'Production impossible', message: nettoyerErreur(err) });
      }
    });
  }

  // ---- Rendre une seule œuvre ----
  async function rendreUne(oeuvreId) {
    const o = expo.oeuvres.find((x) => x.id === oeuvreId);
    if (!o) return;
    const rep = await confirmer({
      type: 'question',
      title: "Rendre cette œuvre ?",
      message: `« ${o.titre} » quitterait l'exposition.`,
      detail: o.statut === 'vendu'
        ? "Cette œuvre a été vendue : elle sortira de l'exposition mais restera vendue."
        : `Elle retrouvera le statut qu'elle avait avant de partir (${o.statut_avant === 'reserve' ? 'réservée' : 'disponible'}).`,
      buttons: ['Rendre', 'Annuler'], defaultId: 0, cancelId: 1,
    });
    if (rep !== 0) return;
    try {
      await window.api.exposRetirerOeuvre(id, oeuvreId);
      await rafraichir();
    } catch (err) {
      await alerter({ type: 'error', title: 'Retour impossible', message: nettoyerErreur(err) });
    }
  }

  // ---- Mettre fin ----
  async function mettreFin() {
    const presentes = expo.oeuvres.filter((x) => !x.retire_le);
    const vendues = presentes.filter((x) => x.statut === 'vendu').length;
    const rendues = presentes.length - vendues;
    const detail = [];
    if (rendues) detail.push(`${pluriel(rendues, 'œuvre retrouvera', 'œuvres retrouveront')} le statut qu'elle avait avant de partir.`);
    if (vendues) detail.push(`${pluriel(vendues, 'œuvre vendue', 'œuvres vendues')} pendant l'exposition ${vendues === 1 ? 'restera vendue' : 'resteront vendues'}.`);
    if (!presentes.length) detail.push("Cette exposition ne contient plus aucune œuvre.");
    const rep = await confirmer({
      type: 'question',
      title: "Mettre fin à l'exposition ?",
      message: `« ${expo.nom} » sera marquée comme terminée.`,
      detail: detail.join('\n'),
      buttons: ["Mettre fin", 'Annuler'], defaultId: 0, cancelId: 1,
    });
    if (rep !== 0) return;
    try {
      const r = await window.api.exposTerminer(id);
      await rafraichir();
      const lignes = [];
      if (r.rendues) lignes.push(`${pluriel(r.rendues, 'œuvre rendue', 'œuvres rendues')} à la galerie.`);
      if (r.vendues) lignes.push(`${pluriel(r.vendues, 'œuvre vendue', 'œuvres vendues')} pendant l'exposition, laissée${r.vendues > 1 ? 's' : ''} telle${r.vendues > 1 ? 's' : ''} quelle${r.vendues > 1 ? 's' : ''}.`);
      if (r.inchangees) lignes.push(`${pluriel(r.inchangees, 'œuvre avait', 'œuvres avaient')} un statut changé à la main : respecté.`);
      await alerter({
        type: 'succes', title: 'Exposition terminée',
        message: `« ${expo.nom} » est close.`,
        detail: lignes.join('\n') || 'Aucune œuvre à rendre.',
      });
    } catch (err) {
      await alerter({ type: 'error', title: 'Clôture impossible', message: nettoyerErreur(err) });
    }
  }

  // ---- Supprimer (seulement une fois terminée) ----
  async function supprimer() {
    const rep = await confirmer({
      type: 'warning',
      title: "Supprimer cette exposition ?",
      message: `« ${expo.nom} » sera effacée de l'historique.`,
      detail: "Les œuvres ne sont pas touchées : elles ont déjà retrouvé leur statut à la clôture.",
      buttons: ['Supprimer', 'Annuler'], defaultId: 1, cancelId: 1,
    });
    if (rep !== 0) return;
    try {
      await window.api.exposSupprimer(id);
      naviguer('expositions-liste');
    } catch (err) {
      await alerter({ type: 'error', title: 'Suppression impossible', message: nettoyerErreur(err) });
    }
  }

  dessiner();
}
