// Vue « Synchronisation site — Artistes » (sens TIRER, lecture seule).
// Compare les artistes de l'app aux pages « portfolio » du site (par NOM) et
// permet de reprendre la biographie / la photo, ou de créer les fiches manquantes.
// La biographie du site peut inclure le curriculum : la comparaison tolère les
// deux (voir main.js), et l'import place le texte dans « Biographie » seulement.

import { ech, nettoyerErreur, pluriel, urlPhoto, nomComplet, initiales, sansAccents } from '../commun.js';
import { naviguer } from '../router.js';
import { alerter, confirmer, editerTexteImport } from '../dialogue.js';
import { recadrerCarre } from '../recadrage.js';

const TYPES_DIFF = [
  { cle: 'citation', libelle: 'Citation' },
  { cle: 'biographie', libelle: 'Biographie' },
  { cle: 'demarche', libelle: 'Démarche' },
  { cle: 'curriculum', libelle: 'Curriculum' },
  { cle: 'photo', libelle: 'Photo' },
];

function apercuTexte(v) {
  const s = (v == null) ? '' : String(v);
  return s.trim() ? ech(s) : '<span class="wsync-vide">— (vide)</span>';
}

export async function rendreWebSyncArtistes(contenu) {
  contenu.innerHTML = `
    <div class="vue-liste web-sync-vue">
      <div class="entete-page">
        <div>
          <h1>Synchronisation avec le site</h1>
          <p class="sous-titre">Sens « tirer » — l'app lit les artistes du site. <strong>Aucune modification n'est faite sur le site.</strong></p>
          <div class="wsync-mode" role="tablist" aria-label="Type de synchronisation">
            <button type="button" class="wsync-mode-btn" id="wsync-vers-oeuvres">Œuvres</button>
            <button type="button" class="wsync-mode-btn actif" aria-current="true">Artistes</button>
          </div>
        </div>
        <div class="entete-page-actions">
          <button type="button" class="btn-action btn-principal" id="btn-comparer">Comparer les artistes</button>
        </div>
      </div>
      <div class="wsync-astuce">
        <div class="wsync-astuce-txt">
          <strong>Séparer les citations</strong> — sur le site, la citation de l'artiste (« … ») est rangée à part, alors que dans l'app elle est encore <em>incluse dans la biographie</em>. Ce bouton remplit le champ <strong>Citation</strong> de chaque artiste à partir du site <strong>et</strong> retire cette citation du texte de la biographie. À faire une seule fois ; n'agit que sur les artistes dont le champ Citation est encore vide.
        </div>
        <button type="button" class="btn-action btn-secondaire-action" id="btn-ranger-citations">Séparer les citations</button>
      </div>
      <div id="web-sync-corps"></div>
    </div>
  `;

  const corps = contenu.querySelector('#web-sync-corps');
  const btnComparer = contenu.querySelector('#btn-comparer');
  contenu.querySelector('#wsync-vers-oeuvres').addEventListener('click', () => naviguer('web-sync'));
  contenu.querySelector('#btn-ranger-citations').addEventListener('click', async (e) => {
    const btn = e.currentTarget; // à capturer AVANT tout await (sinon null ensuite)
    const rep = await confirmer({
      type: 'question', title: 'Séparer les citations ?',
      message: 'Remplir le champ « Citation » de chaque artiste à partir du site, et retirer cette citation du texte de la biographie quand elle y figure.',
      detail: "Ne touche qu'aux artistes dont la citation est encore vide. Les biographies ne sont modifiées que pour en retirer la citation exacte — rien d'autre.",
      buttons: ['Séparer les citations', 'Annuler'], defaultId: 0, cancelId: 1,
    });
    if (rep !== 0) return;
    btn.disabled = true; const lib = btn.textContent; btn.textContent = 'Séparation…';
    try {
      const r = await window.api.webRangerCitations();
      await alerter({
        type: 'succes', title: 'Citations rangées',
        message: r.traites
          ? `${r.traites} citation(s) remplie(s)${r.biosNettoyees ? `, dont ${r.biosNettoyees} retirée(s) de la biographie` : ''}.`
          : 'Rien à ranger : toutes les citations sont déjà en place.',
      });
      if (dataCourant) await charger(); // rafraîchir la comparaison si déjà affichée
    } catch (err) {
      await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) });
    } finally {
      btn.disabled = false; btn.textContent = lib;
    }
  });

  let dataCourant = null;
  let ongletActif = 'diff';
  let afficherReglees = false;
  const filtres = new Set(TYPES_DIFF.map((t) => t.cle));

  // Carnet complet des artistes, pour la fenêtre « Relier ». Chargé à la
  // demande : la comparaison avec le site n'en a pas besoin, et cet écran
  // s'ouvre souvent sans qu'on relie quoi que ce soit.
  let artistesTous = null;
  async function chargerArtistes() {
    if (artistesTous) return artistesTous;
    artistesTous = await window.api.artistesListe({ inclureArchives: false });
    return artistesTous;
  }

  const champsVisibles = (l) => l.champs.filter((c) => filtres.has(c.champ) && (afficherReglees || !c.ignore));
  const ligneVisible = (l) => champsVisibles(l).length > 0;
  const compteType = (t) => dataCourant.lignes.filter((l) => l.champs.some((c) => c.champ === t && !c.ignore)).length;

  async function charger() {
    btnComparer.disabled = true;
    corps.innerHTML = `<p class="chargement">⏳ Lecture des artistes du site… (aucune modification du site)</p>`;
    let data;
    try {
      data = await window.api.webComparerArtistes();
    } catch (err) {
      corps.innerHTML = `<div class="wsync-erreur"><p>✗ ${ech(nettoyerErreur(err))}</p></div>`;
      btnComparer.disabled = false;
      return;
    }
    btnComparer.disabled = false;
    btnComparer.textContent = 'Rafraîchir';
    dataCourant = data;
    dessiner();
  }

  function dessiner() {
    const data = dataCourant;
    const r = data.resume;
    const resteDiff = data.lignes.filter((l) => l.champs.some((c) => !c.ignore)).length;
    const nbReglees = data.lignes.reduce((n, l) => n + l.champs.filter((c) => c.ignore).length, 0);
    const visibles = data.lignes.filter(ligneVisible);

    const resumeHtml = `
      <div class="wsync-resume">
        <div class="wsync-stat"><span class="n">${r.relies}</span><span class="lib">artiste(s) relié(s)</span></div>
        <div class="wsync-stat"><span class="n">${resteDiff}</span><span class="lib">avec des différences</span></div>
        <div class="wsync-stat"><span class="n">${r.app_seul}</span><span class="lib">seulement dans l'app</span></div>
        <div class="wsync-stat"><span class="n">${r.site_seul}</span><span class="lib">seulement sur le site</span></div>
        <div class="wsync-stat discret"><span class="n">${r.total_site}</span><span class="lib">artistes en ligne</span></div>
      </div>`;

    const chipsHtml = TYPES_DIFF.map((t) => {
      const n = compteType(t.cle);
      return `<button type="button" class="wsync-chip${filtres.has(t.cle) ? ' actif' : ''}" data-type="${t.cle}" ${n === 0 ? 'disabled' : ''}>${ech(t.libelle)} <span class="wsync-chip-n">${n}</span></button>`;
    }).join('');
    const barreHtml = `
      <div class="wsync-barre">
        <div class="wsync-filtres"><span class="wsync-filtres-lib">Afficher :</span>${chipsHtml}</div>
        <div class="wsync-selection">
          ${nbReglees ? `<label class="wsync-reglees-toggle"><input type="checkbox" id="wsync-voir-reglees" ${afficherReglees ? 'checked' : ''}> déjà gardées (${nbReglees})</label>` : ''}
        </div>
      </div>`;

    let cartesHtml;
    if (!resteDiff && !nbReglees) cartesHtml = `<p class="liste-vide">✓ Rien à réconcilier : les artistes reliés concordent avec le site.</p>`;
    else if (!visibles.length) cartesHtml = `<p class="liste-vide">Aucune différence de ce type.</p>`;
    else cartesHtml = visibles.map((l) => carteArtiste(l)).join('');

    const appSeulHtml = data.appSeul.length
      ? `<div class="wsync-recon-liste">${data.appSeul.map((a) => `
          <div class="wsync-recon" data-artiste="${a.id}">
            <div class="wsync-recon-info"><strong>${ech(a.nom)}</strong></div>
            <div class="wsync-recon-actions"><button type="button" class="btn-lien wsync-voir-artiste" data-artiste="${a.id}">Voir la fiche</button></div>
          </div>`).join('')}</div>`
      : `<p class="liste-vide">✓ Tous les artistes de l'app ont une page sur le site.</p>`;
    const siteSeulHtml = data.siteSeul.length
      ? `<div class="wsync-recon-liste">${data.siteSeul.map((p, i) => `
          <div class="wsync-recon" data-idx="${i}">
            <div class="wsync-recon-info"><strong>${ech(p.nom)}</strong>${p.excerpt ? ` <span class="wsync-artiste">${ech(p.excerpt.slice(0, 80))}${p.excerpt.length > 80 ? '…' : ''}</span>` : ''}</div>
            <div class="wsync-recon-actions">
              <button type="button" class="btn-action btn-secondaire-action wsync-relier-artiste">Relier à une fiche existante</button>
              <button type="button" class="btn-action btn-principal wsync-creer-artiste">Créer la fiche artiste</button>
            </div>
          </div>`).join('')}</div>`
      : `<p class="liste-vide">✓ Tous les artistes du site ont une fiche dans l'app.</p>`;

    const onglets = [
      { cle: 'diff', libelle: 'Différences', n: resteDiff },
      { cle: 'app', libelle: "Seulement dans l'app", n: data.appSeul.length },
      { cle: 'site', libelle: 'Seulement sur le site', n: data.siteSeul.length },
    ];
    const ongletsHtml = `<div class="wsync-onglets" role="tablist">${onglets.map((o) =>
      `<button type="button" class="wsync-onglet${ongletActif === o.cle ? ' actif' : ''}" data-onglet="${o.cle}">${ech(o.libelle)} <span class="wsync-onglet-n">${o.n}</span></button>`).join('')}</div>`;

    let panneauHtml;
    if (ongletActif === 'app') panneauHtml = appSeulHtml;
    else if (ongletActif === 'site') panneauHtml = siteSeulHtml;
    else panneauHtml = barreHtml + `<div class="wsync-cartes">${cartesHtml}</div>`;

    corps.innerHTML = resumeHtml + ongletsHtml + `<div class="wsync-panneau">${panneauHtml}</div>`;
    brancher();
  }

  function carteArtiste(l) {
    const champsHtml = champsVisibles(l).map((c) => {
      const estPhoto = c.champ === 'photo';
      const tete = c.ignore
        ? `<div class="wsync-champ-tete"><span class="wsync-lib">${ech(c.libelle)}</span> <span class="wsync-gardee">✓ gardé (version de l'app)</span></div>`
        : `<div class="wsync-champ-tete"><span class="wsync-lib">${ech(c.libelle)}</span></div>`;
      const btnReprendre = estPhoto
        ? `<button type="button" class="btn-action btn-secondaire-action wsync-import-photo" data-champ="photo">Télécharger la photo du site →</button>`
        : `<button type="button" class="btn-action btn-secondaire-action wsync-import-texte" data-champ="${ech(c.champ)}">Reprendre la valeur du site →</button>`;
      const actions = c.ignore
        ? `<button type="button" class="btn-lien wsync-degarder" data-champ="${ech(c.champ)}">Ne plus garder</button>`
        : `${btnReprendre} <button type="button" class="btn-lien wsync-garder" data-champ="${ech(c.champ)}">Garder la version de l'app</button>`;
      const aide = '';
      return `
        <div class="wsync-champ${c.ignore ? ' est-gardee' : ''}" data-champ="${ech(c.champ)}">
          ${tete}
          <div class="wsync-cols">
            <div class="wsync-col"><span class="wsync-et">Dans l'app</span><div class="wsync-val">${apercuTexte(c.app)}</div></div>
            <div class="wsync-col site"><span class="wsync-et">Sur le site</span><div class="wsync-val">${apercuTexte(c.site)}</div></div>
          </div>
          <div class="wsync-champ-actions">${actions}</div>
          ${aide}
        </div>`;
    }).join('');

    // Le lien posé à la main s'affiche LÀ OÙ IL AGIT, avec de quoi le défaire.
    // Un rapprochement invisible qu'on ne peut pas corriger vaut moins qu'un
    // rapprochement manquant : on verrait des différences incompréhensibles
    // sans pouvoir remonter à leur cause.
    const lienHtml = l.nom_site
      ? `<div class="wsync-lien-site">Relié au site sous « <strong>${ech(l.nom_site)}</strong> »
           <button type="button" class="btn-lien wsync-delier" data-artiste="${l.artiste_id}">Délier</button></div>`
      : '';

    return `
      <div class="wsync-carte" data-artiste="${l.artiste_id}">
        <div class="wsync-tete">
          <div><strong class="wsync-titre">${ech(l.nom)}</strong></div>
          <button type="button" class="btn-lien wsync-voir-artiste" data-artiste="${l.artiste_id}">Voir la fiche</button>
        </div>
        ${lienHtml}
        ${champsHtml}
      </div>`;
  }

  function brancher() {
    corps.querySelectorAll('.wsync-onglet').forEach((b) => b.addEventListener('click', () => { ongletActif = b.dataset.onglet; dessiner(); }));
    corps.querySelectorAll('.wsync-chip').forEach((chip) => chip.addEventListener('click', () => {
      const t = chip.dataset.type;
      if (filtres.has(t)) filtres.delete(t); else filtres.add(t);
      dessiner();
    }));
    corps.querySelector('#wsync-voir-reglees')?.addEventListener('change', (e) => { afficherReglees = e.target.checked; dessiner(); });

    corps.querySelectorAll('.wsync-carte').forEach((carte) => {
      const artisteId = Number(carte.dataset.artiste);
      carte.querySelector('.wsync-voir-artiste')?.addEventListener('click', () => ouvrirApercuArtiste(artisteId));
      carte.querySelectorAll('.wsync-import-texte').forEach((btn) =>
        btn.addEventListener('click', (e) => importerTexte(e.currentTarget, artisteId, btn.dataset.champ)));
      carte.querySelector('.wsync-import-photo')?.addEventListener('click', (e) => importerPhoto(e.currentTarget, artisteId));
      carte.querySelectorAll('.wsync-garder').forEach((btn) => btn.addEventListener('click', () => garder(artisteId, btn.dataset.champ)));
      carte.querySelectorAll('.wsync-degarder').forEach((btn) => btn.addEventListener('click', () => degarder(artisteId, btn.dataset.champ)));
    });
    corps.querySelectorAll('.wsync-recon[data-artiste] .wsync-voir-artiste').forEach((b) =>
      b.addEventListener('click', () => ouvrirApercuArtiste(Number(b.dataset.artiste))));
    corps.querySelectorAll('.wsync-recon[data-idx]').forEach((row) => {
      const idx = Number(row.dataset.idx);
      row.querySelector('.wsync-creer-artiste')?.addEventListener('click', () => creerArtiste(idx));
      row.querySelector('.wsync-relier-artiste')?.addEventListener('click', () => relierArtiste(idx));
    });
    corps.querySelectorAll('.wsync-delier').forEach((b) =>
      b.addEventListener('click', () => delierArtiste(Number(b.dataset.artiste))));
  }

  const champObj = (artisteId, champ) => {
    const l = dataCourant.lignes.find((x) => x.artiste_id === artisteId);
    return { l, c: l ? l.champs.find((x) => x.champ === champ) : null };
  };
  const retirerChamp = (artisteId, champ) => {
    const l = dataCourant.lignes.find((x) => x.artiste_id === artisteId);
    if (l) l.champs = l.champs.filter((c) => c.champ !== champ);
  };

  async function importerTexte(btn, artisteId, champ) {
    const { c } = champObj(artisteId, champ);
    if (!c) return;
    // Édition avant remplacement : on ouvre le texte du site, modifiable.
    const edite = await editerTexteImport(c.libelle || champ, c.site);
    if (edite == null) return; // annulé
    btn.disabled = true; btn.textContent = 'Import…';
    try {
      await window.api.webImporterChampArtiste(artisteId, champ, edite);
      retirerChamp(artisteId, champ);
      dessiner();
    } catch (err) { btn.disabled = false; btn.textContent = 'Reprendre la valeur du site →'; await alerter({ type: 'error', title: 'Import échoué', message: nettoyerErreur(err) }); }
  }
  async function importerPhoto(btn, artisteId) {
    const { c } = champObj(artisteId, 'photo');
    if (!c || !c.site_image) return;
    btn.disabled = true; btn.textContent = 'Téléchargement…';
    try {
      const dataUrl = await window.api.webTelechargerImage(c.site_image);
      const crop = await recadrerCarre(dataUrl);
      if (crop) {
        await window.api.photoEnregistrerRecadree('artistes', artisteId, crop, dataUrl);
        retirerChamp(artisteId, 'photo');
        dessiner();
      } else {
        btn.disabled = false; btn.textContent = 'Télécharger la photo du site →';
      }
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Télécharger la photo du site →';
      await alerter({ type: 'error', title: 'Photo non ajoutée', message: nettoyerErreur(err) });
    }
  }
  async function garder(artisteId, champ) {
    const { c } = champObj(artisteId, champ);
    if (!c) return;
    try { await window.api.webIgnorerDiffArtiste(artisteId, champ, c.site_cle); c.ignore = true; dessiner(); }
    catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }
  async function degarder(artisteId, champ) {
    const { c } = champObj(artisteId, champ);
    if (!c) return;
    try { await window.api.webRetirerIgnoreArtiste(artisteId, champ); c.ignore = false; dessiner(); }
    catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }

  // ===== Relier un artiste du site à une fiche existante =====
  //
  // Deux artistes de la galerie signent d'un nom d'artiste : le site dit
  // « PAMCOMEAU (Pamela Comeau) » là où l'app dit « Pam Comeau ». Le
  // rapprochement se faisant par le nom, ils tombaient chacun d'un côté et le
  // seul geste offert créait un DOUBLON. Relier retient le nom porté sur le
  // site : chacun garde le sien, et la paire tient.
  async function relierArtiste(idx) {
    const p = dataCourant.siteSeul[idx];
    if (!p) return;
    try { await chargerArtistes(); }
    catch (err) {
      await alerter({ type: 'error', title: 'Liste des artistes illisible', message: nettoyerErreur(err) });
      return;
    }
    const artisteId = await choisirFicheAReliers(p);
    if (artisteId == null) return;
    await charger(); // la comparaison entière change : on la refait
    await alerter({
      type: 'succes', title: 'Fiches reliées',
      message: `« ${p.nom} » est maintenant rattaché à une fiche existante.`,
      detail: "Les différences de biographie, de démarche, de C.V., de citation et de photo se reprennent maintenant dans l'onglet « Différences ». Le lien se défait depuis la fiche de l'artiste.",
    });
  }

  async function delierArtiste(artisteId) {
    const l = dataCourant.lignes.find((x) => x.artiste_id === artisteId);
    const rep = await confirmer({
      type: 'question', title: 'Délier du site ?',
      message: `Galeria ne rapprochera plus cette fiche de « ${l && l.nom_site ? l.nom_site : 'la page du site'} ».`,
      detail: "Rien n'est supprimé : ni la fiche, ni ses œuvres, ni le site. Le nom de la fiche ne change pas non plus.",
      buttons: ['Délier', 'Annuler'], defaultId: 1, cancelId: 1,
    });
    if (rep !== 0) return;
    try { await window.api.webDelierArtiste(artisteId); await charger(); }
    catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }

  // Retourne l'id de la fiche reliée, ou null si annulé. Fait l'appel lui-même :
  // les deux étapes (quelle fiche, quel nom) forment un seul geste, et les
  // séparer laisserait un état à moitié choisi.
  function choisirFicheAReliers(produit) {
    return new Promise((resolve) => {
      // Les artistes que le site ne retrouve pas d'abord : par construction,
      // c'est parmi eux que se trouve presque toujours la bonne fiche.
      const appSeulIds = new Set((dataCourant.appSeul || []).map((a) => a.id));
      const tous = (artistesTous || []).map((a) => ({
        id: a.id,
        nom: nomComplet(a) || a.nom || '',
        prenom: a.prenom || '',
        nomSeul: a.nom || '',
        oeuvres: a.nb_oeuvres || 0,
        seul: appSeulIds.has(a.id),
      }));

      // Mots de 3 lettres et plus : c'est ce qui rapproche « Comeau » de
      // « PAMCOMEAU (Pamela Comeau) », y compris quand le site colle les mots.
      const mots = (s) => sansAccents(String(s || '')).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((m) => m.length >= 3);
      const motsSite = new Set(mots(produit.nom));
      const communs = (a) => mots(a.nom).filter((m) => motsSite.has(m)
        || [...motsSite].some((x) => x.includes(m) || m.includes(x)));
      const score = (a) => communs(a).length;

      let choisi = null;
      let modeNom = 'app';

      const overlay = document.createElement('div');
      overlay.className = 'overlay-modale overlay-dialogue';
      overlay.innerHTML = `
        <div class="dialogue" role="dialog" aria-modal="true" style="max-width:660px;width:94vw;">
          <div class="dialogue-entete"><h3 class="dialogue-titre">Relier « ${ech(produit.nom)} »</h3></div>
          <p class="dialogue-message">Cet artiste du site correspond-il à une fiche que vous avez déjà ? Rien n'est modifié sur le site.</p>
          <p class="rl-etape">1 — De quelle fiche s'agit-il ?</p>
          <input class="rl-rech" id="rl-rech" type="search" placeholder="Chercher un artiste…">
          <div id="rl-cands" class="rl-cands"></div>
          <div id="rl-etape2" hidden>
            <p class="rl-etape">2 — Quel nom Galeria doit-elle afficher ?</p>
            <div class="rl-noms" id="rl-noms"></div>
            <div class="rl-champs" id="rl-champs" hidden>
              <div><label for="rl-prenom">Prénom</label><input id="rl-prenom" type="text"></div>
              <div><label for="rl-nom">Nom</label><input id="rl-nom" type="text"></div>
            </div>
            <div class="rl-recap" id="rl-recap"></div>
          </div>
          <div class="dialogue-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="rl-annuler">Annuler</button>
            <button type="button" class="btn-action btn-principal" id="rl-ok" disabled>Relier</button>
          </div>
        </div>`;

      let fini = false;
      const fermer = (r) => {
        if (fini) return;
        fini = true;
        window.removeEventListener('keydown', onKey);
        overlay.remove();
        resolve(r);
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(null); } };
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(null); });
      window.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);

      const $ = (s) => overlay.querySelector(s);
      const fiche = () => tous.find((a) => a.id === choisi);

      function dessinerCands() {
        const q = sansAccents($('#rl-rech').value.trim());
        let liste = tous.slice().sort((x, y) => (y.seul - x.seul) || (score(y) - score(x))
          || x.nom.localeCompare(y.nom));
        if (q) liste = liste.filter((a) => sansAccents(a.nom).includes(q));
        else liste = liste.slice(0, 5);
        $('#rl-cands').innerHTML = liste.length ? liste.map((a) => {
          const c = communs(a);
          return `<div class="rl-cand${choisi === a.id ? ' on' : ''}" data-id="${a.id}">
            <span class="n">${ech(a.nom)}</span>
            <span class="d">${pluriel(a.oeuvres, 'œuvre')}</span>
            ${c.length ? `<span class="p">nom en commun : ${ech(c.join(', '))}</span>` : ''}
          </div>`;
        }).join('') : '<p class="liste-vide">Aucun artiste trouvé.</p>';
        $('#rl-cands').querySelectorAll('.rl-cand').forEach((el) => el.addEventListener('click', () => {
          choisi = Number(el.dataset.id);
          modeNom = 'app';
          dessinerCands();
          dessinerNoms();
        }));
      }

      function dessinerNoms() {
        const a = fiche();
        $('#rl-etape2').hidden = !a;
        $('#rl-ok').disabled = !a;
        if (!a) return;
        const opts = [
          { cle: 'app', t: `Garder « ${ech(a.nom)} »`, q: "le nom actuel de la fiche — c'est le cas courant" },
          { cle: 'site', t: `Prendre « ${ech(produit.nom)} »`, q: 'le nom que porte le site' },
          { cle: 'autre', t: 'Écrire un autre nom', q: 'pour corriger une coquille au passage' },
        ];
        $('#rl-noms').innerHTML = opts.map((o) => `
          <label class="${modeNom === o.cle ? 'on' : ''}" data-cle="${o.cle}">
            <input type="radio" name="rl-mn" ${modeNom === o.cle ? 'checked' : ''}>
            <span>${o.t}<br><span class="q">${o.q}</span></span>
          </label>`).join('');
        $('#rl-noms').querySelectorAll('label').forEach((l) => l.addEventListener('click', () => {
          modeNom = l.dataset.cle;
          if (modeNom === 'autre') {
            $('#rl-prenom').value = a.prenom;
            $('#rl-nom').value = a.nomSeul;
          }
          dessinerNoms();
        }));
        $('#rl-champs').hidden = modeNom !== 'autre';
        dessinerRecap();
      }

      // Le nom retenu, et comment il se range dans prénom + nom. Un nom
      // d'artiste ne se coupe pas : il part entier dans « nom », prénom vide.
      function nomRetenu() {
        const a = fiche();
        if (modeNom === 'site') return { prenom: '', nom: produit.nom, affiche: produit.nom };
        if (modeNom === 'autre') {
          const pr = $('#rl-prenom').value.trim();
          const nm = $('#rl-nom').value.trim();
          return { prenom: pr, nom: nm, affiche: [pr, nm].filter(Boolean).join(' ') };
        }
        return null; // « garder » : on ne renomme pas du tout
      }

      function dessinerRecap() {
        const a = fiche();
        const n = nomRetenu();
        const affiche = n ? n.affiche : a.nom;
        const change = !!n && affiche !== a.nom;
        $('#rl-ok').disabled = !!n && !n.nom.trim();
        $('#rl-recap').innerHTML = `
          <div class="ln"><span class="k">Sur le site</span><span><strong>${ech(produit.nom)}</strong></span></div>
          <div class="ln"><span class="k">Dans l'app</span><span><strong>${ech(affiche) || '<em>nom manquant</em>'}</strong>${change ? ' <span class="rl-avert">(renommée, son dossier de photos suivra)</span>' : ''}</span></div>
          <div class="ln"><span class="k">Conséquence</span><span>Les ${pluriel(a.oeuvres, 'œuvre')} restent sur cette fiche. La paire passera dans l'onglet « Différences ».</span></div>`;
      }

      $('#rl-rech').addEventListener('input', dessinerCands);
      ['#rl-prenom', '#rl-nom'].forEach((s) => $(s).addEventListener('input', dessinerRecap));
      $('#rl-annuler').addEventListener('click', () => fermer(null));
      $('#rl-ok').addEventListener('click', async (e) => {
        const btn = e.currentTarget; // avant tout await
        const a = fiche();
        if (!a) return;
        const n = nomRetenu();
        btn.disabled = true;
        btn.textContent = 'Liaison…';
        try {
          await window.api.webRelierArtiste(a.id,
            n ? { nomSite: produit.nom, prenom: n.prenom, nom: n.nom } : { nomSite: produit.nom });
          fermer(a.id);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Relier';
          await alerter({ type: 'error', title: 'Liaison impossible', message: nettoyerErreur(err) });
        }
      });

      dessinerCands();
      dessinerNoms();
      $('#rl-rech').focus();
    });
  }

  async function creerArtiste(idx) {
    const p = dataCourant.siteSeul[idx];
    if (!p) return;
    const rep = await confirmer({
      type: 'question', title: 'Créer la fiche artiste ?',
      message: `Créer « ${p.nom} » dans l'app, avec sa biographie, sa démarche et son C.V.${p.image ? ', et sa photo (recadrage ensuite)' : ''} ?`,
      buttons: ['Créer', 'Annuler'], defaultId: 0, cancelId: 1,
    });
    if (rep !== 0) return;
    let artiste;
    try {
      const r = await window.api.webCreerArtisteDepuisSite({ nom: p.nom, citation: p.citation, biographie: p.biographie, demarche: p.demarche, curriculum: p.curriculum });
      artiste = r.artiste;
    } catch (err) { await alerter({ type: 'error', title: 'Création échouée', message: nettoyerErreur(err) }); return; }
    dataCourant.siteSeul.splice(idx, 1);
    dessiner();
    if (p.image) {
      try {
        const dataUrl = await window.api.webTelechargerImage(p.image);
        const crop = await recadrerCarre(dataUrl);
        if (crop) await window.api.photoEnregistrerRecadree('artistes', artiste.id, crop, dataUrl);
      } catch (err) {
        await alerter({ type: 'warning', title: 'Photo non ajoutée', message: `${nettoyerErreur(err)} La fiche est créée ; tu pourras ajouter la photo plus tard.` });
      }
    }
    await alerter({ type: 'succes', title: 'Fiche créée', message: `« ${artiste.nom || p.nom} » ajoutée aux artistes.` });
  }

  btnComparer.addEventListener('click', charger);
}

// Aperçu de l'artiste en modale (lecture seule) — pour consulter la fiche sans
// quitter l'écran de synchronisation. « Ouvrir la fiche complète » y mène (et
// quitte la synchro).
async function ouvrirApercuArtiste(artisteId) {
  let a;
  try {
    a = await window.api.artisteGet(artisteId);
  } catch (err) {
    await alerter({ type: 'error', title: 'Erreur', message: nettoyerErreur(err) });
    return;
  }
  if (!a) { await alerter({ type: 'warning', title: 'Introuvable', message: 'Cet artiste est introuvable.' }); return; }

  const nom = nomComplet(a) || a.nom || 'Artiste';
  const coord = [
    a.courriel ? `<dt>Courriel</dt><dd>${ech(a.courriel)}</dd>` : '',
    a.telephone ? `<dt>Téléphone</dt><dd>${ech(a.telephone)}</dd>` : '',
    a.type ? `<dt>Type</dt><dd>${ech(a.type)}</dd>` : '',
  ].join('');
  const section = (titre, val) => (val && String(val).trim())
    ? `<div class="apercu-section"><h3 class="apercu-section-titre">${ech(titre)}</h3><div class="apercu-desc">${ech(val)}</div></div>` : '';
  const sections = [
    section('Citation', a.citation),
    section('Biographie', a.biographie),
    section('Démarche', a.demarche),
    section('Curriculum (C.V.)', a.curriculum),
  ].join('');

  const overlay = document.createElement('div');
  overlay.className = 'overlay-modale apercu-overlay';
  overlay.innerHTML = `
    <div class="apercu-oeuvre" role="dialog" aria-modal="true" aria-label="Aperçu de l'artiste">
      <button type="button" class="apercu-fermer" aria-label="Fermer">&times;</button>
      <div class="apercu-corps apercu-artiste-corps">
        <div class="apercu-image apercu-image-artiste">
          ${a.photo_path
            ? `<img src="${urlPhoto(a.photo_path)}" alt="">`
            : `<span class="apercu-initiales">${ech(initiales(nom))}</span>`}
        </div>
        <div class="apercu-infos">
          <h2 class="apercu-titre">${ech(nom)}</h2>
          ${coord ? `<dl class="apercu-meta">${coord}</dl>` : ''}
          ${sections || '<p class="wsync-vide">Aucun texte enregistré pour cet artiste.</p>'}
        </div>
      </div>
      <div class="apercu-actions">
        <button type="button" class="btn-action btn-secondaire-action" id="apercu-ouvrir-fiche">Ouvrir la fiche complète</button>
        <button type="button" class="btn-action btn-principal" id="apercu-fermer-2">Fermer</button>
      </div>
    </div>`;

  const fermer = () => { overlay.remove(); window.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(); });
  window.addEventListener('keydown', onKey);
  overlay.querySelector('.apercu-fermer').addEventListener('click', fermer);
  overlay.querySelector('#apercu-fermer-2').addEventListener('click', fermer);
  overlay.querySelector('#apercu-ouvrir-fiche').addEventListener('click', () => { fermer(); naviguer('artiste-fiche', { id: artisteId }); });
  document.body.appendChild(overlay);
}
