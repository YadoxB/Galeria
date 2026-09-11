// Vue « Synchronisation site » — sens TIRER (site → app), LECTURE SEULE côté site.
// Compare les produits WooCommerce (par SKU = numéro d'inventaire) aux œuvres de
// l'app. Permet de : filtrer les écarts par type, reprendre une valeur du site
// (à l'unité ou EN LOT), et mettre le statut à jour d'après le site (avec choix).
// Rien n'est jamais écrit sur le site depuis cette vue.

import { ech, formaterPrix, nettoyerErreur, pluriel, urlPhoto, badgeStatut, STATUTS, sansAccents, nomComplet } from '../commun.js';
import { naviguer } from '../router.js';
import { alerter, confirmer, editerTexteImport } from '../dialogue.js';
import { recadrerCarre } from '../recadrage.js';

const TYPES_DIFF = [
  { cle: 'titre', libelle: 'Titre' },
  { cle: 'description', libelle: 'Description' },
  // Seule colonne anglaise des œuvres : ni le titre ni le prix n'ont de
  // version anglaise dans l'app.
  { cle: 'description_en', libelle: 'Description (EN)' },
  { cle: 'prix', libelle: 'Prix' },
  { cle: 'statut', libelle: 'Statut' },
];
const CHAMPS_COPIE = ['titre', 'description', 'description_en', 'prix'];

// Clé de préférence : comparer l'anglais oblige à relire tout le site une
// seconde fois. Le choix se mémorise plutôt que de se redemander à chaque fois.
const CLE_PREF_ANGLAIS = 'web-sync-anglais';

// ===== « Manquant » et « différent » ne sont pas la même chose =====
//
// Un champ VIDE dans l'app qu'on remplit depuis le site, et un champ REMPLI
// qu'on remplace, sont deux gestes de nature opposée : le premier ne peut rien
// détruire, le second écrase peut-être une correction faite à la main.
//
// C'est cette distinction qui justifiait le bouton « Importer les textes
// anglais » (retiré le 2026-09-09), dont la règle était « remplir le vide, ne
// jamais écraser ». Elle devient un filtre : avec « Manquants » actif, « tout
// cocher » fait exactement ce que faisait ce bouton — mais visible avant
// confirmation, et décochable ligne par ligne.
export const NATURES = [
  { cle: 'tous', libelle: 'Toutes' },
  { cle: 'manquant', libelle: 'Manquants' },
  { cle: 'different', libelle: 'Différents' },
];
export function natureDe(c) { return c && c.manquant ? 'manquant' : 'different'; }
export function pastilleNature(c) {
  const n = natureDe(c);
  return `<span class="wsync-nature ${n}">${n === 'manquant' ? 'manquant' : 'différent'}</span>`;
}

// Les pastilles de nature, partagées par les deux écrans.
export function chipsNatureHtml(natureActive, compte) {
  return NATURES.map((n) => {
    const c = n.cle === 'tous' ? null : compte(n.cle);
    return `<button type="button" class="wsync-chip${natureActive === n.cle ? ' actif' : ''}" data-nature="${n.cle}"
      ${c === 0 ? 'disabled' : ''}>${n.libelle}${c == null ? '' : ` <span class="wsync-chip-n">${c}</span>`}</button>`;
  }).join('');
}

export function lirePrefAnglais() {
  try { return localStorage.getItem(CLE_PREF_ANGLAIS) === '1'; } catch { return false; }
}
export function ecrirePrefAnglais(v) {
  try { localStorage.setItem(CLE_PREF_ANGLAIS, v ? '1' : '0'); } catch { /* sans conséquence */ }
}

// ===== État de la connexion au site =====
//
// Depuis que « Site web » est une entrée du menu, on arrive ici DIRECTEMENT.
// Le garde-fou qui vivait dans les Réglages — vérifier les clés avant
// d'ouvrir — n'existe plus : l'écran doit donc le dire lui-même, plutôt que de
// laisser cliquer « Comparer » pour ne récolter qu'un message d'erreur.
//
// ⚠ Trois états, et non deux, parce que les besoins diffèrent :
//   — comparer les ŒUVRES exige l'adresse ET les clés REST (`web:comparer`) ;
//   — comparer les ARTISTES, récupérer les adresses, importer les textes
//     anglais n'exigent que l'ADRESSE : ils passent par les API publiques.
// Un bandeau « relié / pas relié » unique désactiverait donc à tort la moitié
// de l'écran quand seules les clés manquent.
export async function etatConnexion() {
  try {
    const e = await window.api.webEtat();
    return {
      url: (e && e.url) || '',
      cles: !!(e && e.cles_definies),
      adresseOk: !!(e && e.url),
    };
  } catch {
    return { url: '', cles: false, adresseOk: false };
  }
}

// `exigeCles` : true pour l'écran des œuvres, false pour celui des artistes.
export function bandeauConnexionHtml(etat, exigeCles) {
  if (!etat.adresseOk) {
    return `<div class="wsync-connexion absente">
        <span>Aucune adresse de site n'est configurée&nbsp;: il n'y a rien à comparer.</span>
        <button type="button" class="btn-lien" data-vers-reglages>Configurer dans Réglages</button>
      </div>`;
  }
  if (exigeCles && !etat.cles) {
    return `<div class="wsync-connexion partielle">
        <span>Relié à <strong>${ech(etat.url)}</strong>, mais la comparaison des œuvres demande en plus les
          <strong>clés d'accès</strong> de la boutique. Les artistes, eux, se comparent déjà.</span>
        <button type="button" class="btn-lien" data-vers-reglages>Ajouter les clés</button>
      </div>`;
  }
  return `<div class="wsync-connexion ok">
      <span>Relié à <strong>${ech(etat.url)}</strong>. Lecture seule&nbsp;: rien n'est modifié sur le site.</span>
      <button type="button" class="btn-lien" data-vers-reglages>Changer la connexion</button>
    </div>`;
}

// Branche le renvoi vers les Réglages et grise ce qui ne peut pas fonctionner.
export function brancherConnexion(contenu, etat, { exigeCles, boutons }) {
  contenu.querySelector('[data-vers-reglages]')?.addEventListener('click',
    () => naviguer('reglages', { categorie: 'web' }));
  const bloque = !etat.adresseOk || (exigeCles && !etat.cles);
  for (const b of boutons) {
    if (!b) continue;
    // Un bouton grisé qui n'explique rien est une impasse : le bandeau
    // juste au-dessus dit pourquoi, et l'infobulle le redit au survol.
    b.disabled = bloque;
    if (bloque) b.title = etat.adresseOk ? "Ajoutez les clés d'accès dans Réglages → Site web."
      : "Configurez l'adresse du site dans Réglages → Site web.";
  }
}

function valeurAffichee(champ, v) {
  if (champ === 'prix') return (v == null || v === '') ? '—' : formaterPrix(Number(v));
  const s = (v == null) ? '' : String(v);
  return s.trim() ? ech(s) : '<span class="wsync-vide">— (vide)</span>';
}

// `params.artiste_id` : arriver réglé sur un artiste, et comparer tout de suite
// (menu « Comparer avec le site → Ses œuvres » de la fiche de l'artiste).
export async function rendreWebSync(contenu, params = {}) {
  const etat = await etatConnexion();
  contenu.innerHTML = `
    <div class="vue-liste web-sync-vue">
      <div class="entete-page">
        <div>
          <h1>Site web</h1>
          <p class="sous-titre">Sens « tirer » — l'app lit la boutique et te propose de reprendre des valeurs. <strong>Aucune modification n'est faite sur le site.</strong></p>
          <div class="wsync-mode" role="tablist" aria-label="Type de synchronisation">
            <button type="button" class="wsync-mode-btn actif" aria-current="true">Œuvres</button>
            <button type="button" class="wsync-mode-btn" id="wsync-vers-artistes">Artistes</button>
          </div>
        </div>
        <div class="entete-page-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="btn-recuperer-adresses">Récupérer les adresses du site</button>
          <!-- Ce qu'on compare : toute la boutique, ou un seul artiste (1 à 2 s
               au lieu d'une dizaine). Changer d'artiste relance la comparaison.
               Le groupe ne se coupe pas : le choix et son bouton vont ensemble. -->
          <div class="wsync-comparer-grp">
            <label class="wsync-portee">Comparer
              <select id="wsync-portee"><option value="">Toutes les œuvres</option></select>
            </label>
            <label class="wsync-opt-anglais" title="Relit le site en anglais pour comparer aussi les descriptions anglaises. Deux fois plus long.">
              <input type="checkbox" id="c-anglais"> textes anglais
            </label>
            <button type="button" class="btn-action btn-principal" id="btn-comparer">Comparer avec le site</button>
          </div>
        </div>
      </div>
      ${bandeauConnexionHtml(etat, true)}
      <div id="web-sync-corps"></div>
    </div>
  `;

  const corps = contenu.querySelector('#web-sync-corps');
  const btnComparer = contenu.querySelector('#btn-comparer');
  const btnAdresses = contenu.querySelector('#btn-recuperer-adresses');
  const caseAnglais = contenu.querySelector('#c-anglais');
  caseAnglais.checked = lirePrefAnglais();
  caseAnglais.addEventListener('change', () => ecrirePrefAnglais(caseAnglais.checked));
  brancherRecupererAdresses(btnAdresses);
  contenu.querySelector('#wsync-vers-artistes')?.addEventListener('click', () => naviguer('web-sync-artistes'));
  // « Comparer » exige les clés ; « Récupérer les adresses » se contente de
  // l'adresse, et reste donc utilisable quand seules les clés manquent.
  brancherConnexion(contenu, etat, { exigeCles: true, boutons: [btnComparer] });
  if (!etat.adresseOk) btnAdresses.disabled = true;

  // Portée : null = toutes les œuvres, sinon l'id d'un artiste.
  const selPortee = contenu.querySelector('#wsync-portee');
  let portee = Number(params && params.artiste_id) || null;
  // Recherche (titre ou n° d'inventaire) : resserre l'affichage des trois
  // onglets, sans relire le site.
  let recherche = '';
  // Seule la DERNIÈRE comparaison demandée s'affiche : changer d'artiste pendant
  // une lecture ne doit pas laisser l'ancienne réponse écraser la nouvelle.
  let jeton = 0;

  let dataCourant = null;
  let ongletActif = 'diff'; // 'diff' | 'app' | 'site'
  let afficherReglees = false; // montrer aussi les différences « déjà gardées »
  const filtres = new Set(TYPES_DIFF.map((t) => t.cle)); // tous actifs par défaut
  let nature = 'tous'; // 'tous' | 'manquant' | 'different'
  const selection = new Set(); // clés `${oeuvreId}:${champ}` (champs de copie only)

  const cle = (oeuvreId, champ) => `${oeuvreId}:${champ}`;
  const correspond = (...champs) => {
    const q = sansAccents(recherche.trim());
    return !q || sansAccents(champs.filter(Boolean).join(' ')).includes(q);
  };
  const champsVisibles = (l) => l.champs.filter((c) => filtres.has(c.champ)
    && (nature === 'tous' || natureDe(c) === nature)
    && (afficherReglees || !c.ignore));
  const statutVisible = (l) => !!l.statut_reconcilier && filtres.has('statut') && (afficherReglees || !l.statut_reconcilier.ignore);
  const ligneVisible = (l) => correspond(l.sku, l.titre) && (champsVisibles(l).length > 0 || statutVisible(l));
  const compteType = (t) => (t === 'statut'
    ? dataCourant.lignes.filter((l) => l.statut_reconcilier && !l.statut_reconcilier.ignore).length
    : dataCourant.lignes.filter((l) => l.champs.some((c) => c.champ === t && !c.ignore)).length);

  async function charger() {
    const moi = ++jeton;
    btnComparer.disabled = true;
    const avecAnglais = !!(caseAnglais && caseAnglais.checked);
    const quoi = portee ? `des produits de ${nomPortee()}` : 'de la boutique';
    corps.innerHTML = `<p class="chargement">⏳ Lecture ${ech(quoi)}${avecAnglais ? ' (français puis anglais)' : ''} et comparaison… (aucune modification du site)</p>`;
    let data;
    try {
      data = await window.api.webComparer({ avecAnglais, artisteId: portee });
    } catch (err) {
      if (moi !== jeton) return;
      corps.innerHTML = `<div class="wsync-erreur"><p>✗ ${ech(nettoyerErreur(err))}</p></div>`;
      btnComparer.disabled = false;
      return;
    }
    if (moi !== jeton) return;
    btnComparer.disabled = false;
    btnComparer.textContent = 'Rafraîchir';
    dataCourant = data;
    selection.clear();
    dessiner();
  }

  function nomPortee() {
    const opt = selPortee && selPortee.selectedOptions[0];
    return opt && opt.value ? opt.textContent : '';
  }

  // Liste des artistes du sélecteur : tous les artistes actifs, même sans
  // œuvre dans l'app — ils peuvent en avoir sur le site.
  async function remplirPortee() {
    let artistes = [];
    try { artistes = await window.api.artistesListe({ inclureArchives: false }); } catch { artistes = []; }
    if (artistes.length) {
      selPortee.insertAdjacentHTML('beforeend', `<optgroup label="Un artiste">${artistes.map((a) =>
        `<option value="${a.id}">${ech(nomComplet(a) || a.nom || '')}</option>`).join('')}</optgroup>`);
    }
    // Un artiste demandé mais introuvable dans la liste (archivé entre-temps) :
    // retour à « Toutes les œuvres » plutôt qu'une portée invisible.
    if (portee && !artistes.some((a) => a.id === portee)) portee = null;
    selPortee.value = portee ? String(portee) : '';
    selPortee.classList.toggle('cible', !!portee);
  }

  function dessiner() {
    const data = dataCourant;
    const r = data.resume;
    const resteDiff = data.lignes.filter((l) => l.champs.some((c) => !c.ignore) || (l.statut_reconcilier && !l.statut_reconcilier.ignore)).length;
    const nbReglees = data.lignes.reduce((n, l) =>
      n + l.champs.filter((c) => c.ignore).length + (l.statut_reconcilier && l.statut_reconcilier.ignore ? 1 : 0), 0);
    const visibles = data.lignes.filter(ligneVisible);

    // Ce qui a été comparé, pour ne jamais prendre les résultats d'un artiste
    // pour ceux de toute la galerie.
    const pt = data.portee;
    const porteeHtml = pt ? `
      <div class="wsync-portee-bandeau">
        <strong>${ech(pt.artiste_nom)}</strong>
        <span>seulement — ${pluriel(r.relies + r.app_seul, 'œuvre')} dans Galeria, ${pluriel(r.total_site, 'produit')} sur le site</span>
        <span class="src">${pt.categorie
          ? `catégorie du site « ${ech(pt.categorie)} »`
          : "aucune catégorie du site à son nom : seules ses œuvres déjà reliées sont comparées"}</span>
        <button type="button" class="btn-lien" id="wsync-portee-tout">Comparer toutes les œuvres</button>
      </div>` : '';

    const resumeHtml = `
      <div class="wsync-resume">
        <div class="wsync-stat"><span class="n">${r.relies}</span><span class="lib">œuvre(s) reliée(s)</span></div>
        <div class="wsync-stat"><span class="n">${resteDiff}</span><span class="lib">avec des différences</span></div>
        <div class="wsync-stat"><span class="n">${r.app_seul}</span><span class="lib">seulement dans l'app</span></div>
        <div class="wsync-stat"><span class="n">${r.site_seul}</span><span class="lib">seulement sur le site</span></div>
        <div class="wsync-stat discret"><span class="n">${r.total_site}</span><span class="lib">${pt ? "produits de l'artiste en ligne" : 'produits en ligne'}</span></div>
      </div>
    `;

    const chipsHtml = TYPES_DIFF.map((t) => {
      const n = compteType(t.cle);
      const actif = filtres.has(t.cle);
      return `<button type="button" class="wsync-chip${actif ? ' actif' : ''}" data-type="${t.cle}" ${n === 0 ? 'disabled' : ''}>
        ${ech(t.libelle)} <span class="wsync-chip-n">${n}</span>
      </button>`;
    }).join('');

    // Le compte par nature respecte les types déjà filtrés : sinon le chiffre
    // annoncerait des écarts que la liste ne montre pas.
    const compteNature = (n) => dataCourant.lignes.reduce((acc, l) => acc
      + l.champs.filter((c) => filtres.has(c.champ) && !c.ignore && natureDe(c) === n).length, 0);

    const barreHtml = `
      <div class="wsync-barre">
        <div class="wsync-filtres" role="group" aria-label="Filtrer les différences">
          <span class="wsync-filtres-lib">Afficher :</span>
          ${chipsHtml}
          <span class="wsync-filtres-lib wsync-filtres-sep">Nature :</span>
          ${chipsNatureHtml(nature, compteNature)}
        </div>
        <div class="wsync-selection">
          ${nbReglees ? `<label class="wsync-reglees-toggle"><input type="checkbox" id="wsync-voir-reglees" ${afficherReglees ? 'checked' : ''}> déjà gardées (${nbReglees})</label>` : ''}
          <button type="button" class="btn-lien" id="wsync-sel-tout">Tout cocher (visible)</button>
          <button type="button" class="btn-lien" id="wsync-sel-rien">Décocher</button>
          <button type="button" class="btn-action btn-principal" id="wsync-importer-lot" ${selection.size ? '' : 'disabled'}>
            Reprendre la sélection${selection.size ? ` (${selection.size})` : ''}
          </button>
        </div>
      </div>
    `;

    const aucunResultat = `<p class="liste-vide">Aucune œuvre ne correspond à « ${ech(recherche.trim())} ».</p>`;
    let cartesHtml;
    if (!resteDiff) {
      cartesHtml = `<p class="liste-vide">✓ Rien à réconcilier : les fiches ${pt ? 'de cet artiste' : 'reliées'} concordent avec le site.</p>`;
    } else if (!visibles.length) {
      cartesHtml = recherche.trim()
        ? aucunResultat
        : `<p class="liste-vide">Aucune différence de ce type. Ajuste les filtres ci-dessus.</p>`;
    } else {
      cartesHtml = visibles.map((l) => carteLigne(l)).join('');
    }

    // Les index `data-idx` renvoient à dataCourant.siteSeul : on les garde
    // d'origine même quand la recherche en masque une partie.
    const appSeulVus = data.appSeul.filter((o) => correspond(o.inv, o.titre));
    const siteSeulVus = data.siteSeul.map((prod, i) => ({ prod, i })).filter(({ prod }) => correspond(prod.sku, prod.name));
    const appSeulHtml = !data.appSeul.length
      ? `<p class="liste-vide">✓ Toutes les œuvres de l'app ont un produit relié sur le site.</p>`
      : !appSeulVus.length ? aucunResultat
      : `<div class="wsync-recon-liste">${appSeulVus.map((o) => `
            <div class="wsync-recon" data-oeuvre="${o.id}">
              <div class="wsync-recon-info"><span class="wsync-sku">${ech(o.inv || '—')}</span> <strong>${ech(o.titre)}</strong> <span class="wsync-artiste">${ech(o.artiste)}</span></div>
              <div class="wsync-recon-actions">
                <button type="button" class="btn-lien wsync-voir-2" data-oeuvre="${o.id}">Voir</button>
                <button type="button" class="btn-action btn-secondaire-action wsync-app-retirer">Retirer</button>
                <button type="button" class="btn-action btn-secondaire-action wsync-app-vendre">Vendre</button>
                <button type="button" class="btn-action btn-secondaire-action wsync-app-supprimer">Supprimer</button>
              </div>
            </div>`).join('')}</div>`;
    const siteSeulHtml = !data.siteSeul.length
      ? `<p class="liste-vide">✓ Tous les produits du site ont une œuvre reliée dans l'app.</p>`
      : !siteSeulVus.length ? aucunResultat
      : `<div class="wsync-recon-liste">${siteSeulVus.map(({ prod, i }) => `
            <div class="wsync-recon" data-idx="${i}">
              <div class="wsync-recon-info"><span class="wsync-sku">${ech(prod.sku)}</span> <strong>${ech(prod.name)}</strong>${prod.prix != null ? ` <span class="wsync-artiste">${formaterPrix(prod.prix)}</span>` : ''}${(prod.candidats && prod.candidats.some((c) => c.match)) ? ' <span class="wsync-badge-doute">SKU douteux ?</span>' : ''}</div>
              <div class="wsync-recon-actions">
                <button type="button" class="btn-action btn-principal wsync-site-creer">Créer la fiche</button>
                <button type="button" class="btn-action btn-secondaire-action wsync-site-sku">Corriger le SKU</button>
              </div>
            </div>`).join('')}</div>`;

    const onglets = [
      { cle: 'diff', libelle: 'Différences', n: resteDiff },
      { cle: 'app', libelle: "Seulement dans l'app", n: data.appSeul.length },
      { cle: 'site', libelle: 'Seulement sur le site', n: data.siteSeul.length },
    ];
    const ongletsHtml = `<div class="wsync-onglets" role="tablist">${onglets.map((o) =>
      `<button type="button" class="wsync-onglet${ongletActif === o.cle ? ' actif' : ''}" data-onglet="${o.cle}">${ech(o.libelle)} <span class="wsync-onglet-n">${o.n}</span></button>`).join('')}</div>`;

    const rechercheHtml = `
      <div class="wsync-recherche">
        <input type="search" id="wsync-rech" placeholder="Chercher un titre ou un n° d'inventaire" value="${ech(recherche)}" autocomplete="off">
      </div>`;

    let panneauHtml;
    if (ongletActif === 'app') panneauHtml = appSeulHtml;
    else if (ongletActif === 'site') panneauHtml = siteSeulHtml;
    else panneauHtml = barreHtml + `<div class="wsync-cartes">${cartesHtml}</div>`;

    // Le champ de recherche est redessiné avec le reste : on lui rend le focus
    // et la position du curseur, sans quoi chaque lettre tapée le ferait perdre.
    const rechActif = document.activeElement && document.activeElement.id === 'wsync-rech';
    const curseur = rechActif ? document.activeElement.selectionStart : null;
    corps.innerHTML = porteeHtml + resumeHtml + ongletsHtml + rechercheHtml + `<div class="wsync-panneau">${panneauHtml}</div>`;
    if (rechActif) {
      const r = corps.querySelector('#wsync-rech');
      r.focus();
      if (curseur != null) r.setSelectionRange(curseur, curseur);
    }
    brancher();
  }

  function carteLigne(l) {
    const champsHtml = champsVisibles(l).map((c) => {
      const k = cle(l.oeuvre_id, c.champ);
      const tete = c.ignore
        ? `<div class="wsync-champ-tete"><span class="wsync-lib">${ech(c.libelle)}</span> <span class="wsync-gardee">✓ gardé (version de l'app)</span></div>`
        : `<div class="wsync-champ-tete"><label class="wsync-check"><input type="checkbox" class="wsync-case" data-cle="${k}" ${selection.has(k) ? 'checked' : ''}><span class="wsync-lib">${ech(c.libelle)}</span></label>${pastilleNature(c)}</div>`;
      const actions = c.ignore
        ? `<button type="button" class="btn-lien wsync-degarder" data-champ="${ech(c.champ)}">Ne plus garder</button>`
        : `<button type="button" class="btn-action btn-secondaire-action wsync-importer" data-champ="${ech(c.champ)}">Reprendre la valeur du site →</button>
           <button type="button" class="btn-lien wsync-garder" data-champ="${ech(c.champ)}">Garder la version de l'app</button>`;
      return `
        <div class="wsync-champ${c.ignore ? ' est-gardee' : ''}" data-champ="${ech(c.champ)}">
          ${tete}
          <div class="wsync-cols">
            <div class="wsync-col">
              <span class="wsync-et">Dans l'app</span>
              <div class="wsync-val">${valeurAffichee(c.champ, c.app)}</div>
            </div>
            <div class="wsync-col site">
              <span class="wsync-et">Sur le site</span>
              <div class="wsync-val">${valeurAffichee(c.champ, c.site)}</div>
            </div>
          </div>
          <div class="wsync-champ-actions">${actions}</div>
        </div>
      `;
    }).join('');

    let statutHtml = '';
    if (statutVisible(l)) {
      const sr = l.statut_reconcilier;
      const cols = `
        <div class="wsync-cols">
          <div class="wsync-col">
            <span class="wsync-et">Dans l'app</span>
            <div class="wsync-val">${badgeStatut(l.statut_app)}</div>
          </div>
          <div class="wsync-col site">
            <span class="wsync-et">Sur le site</span>
            <div class="wsync-val">${ech(sr.site_indication)}</div>
          </div>
        </div>`;
      if (sr.ignore) {
        statutHtml = `
          <div class="wsync-champ wsync-statut est-gardee" data-champ="statut">
            <div class="wsync-champ-tete"><span class="wsync-lib">Statut</span> <span class="wsync-gardee">✓ gardé (version de l'app)</span></div>
            ${cols}
            <div class="wsync-champ-actions"><button type="button" class="btn-lien wsync-statut-degarder">Ne plus garder</button></div>
          </div>`;
      } else {
        const options = Object.entries(STATUTS).map(([k, v]) =>
          `<option value="${k}" ${k === sr.suggere ? 'selected' : ''}>${ech(v.libelle)}</option>`).join('');
        statutHtml = `
          <div class="wsync-champ wsync-statut" data-champ="statut">
            <div class="wsync-lib">Statut</div>
            ${cols}
            <div class="wsync-champ-actions wsync-statut-actions">
              <label class="wsync-statut-choix">Mettre le statut de l'app à
                <select class="wsync-statut-select">${options}</select>
              </label>
              <button type="button" class="btn-action btn-secondaire-action wsync-statut-appliquer">Appliquer</button>
              <button type="button" class="btn-lien wsync-statut-garder">Garder la version de l'app</button>
            </div>
            <p class="wsync-statut-aide">Met à jour l'étiquette de statut ; n'enregistre pas de vente.</p>
          </div>
        `;
      }
    }

    return `
      <div class="wsync-carte" data-oeuvre="${l.oeuvre_id}">
        <div class="wsync-tete">
          <div>
            <span class="wsync-sku">${ech(l.sku || '—')}</span>
            <strong class="wsync-titre">${ech(l.titre)}</strong>
            <span class="wsync-artiste">${ech(l.artiste)}</span>
          </div>
          <button type="button" class="btn-lien wsync-voir">Voir la fiche</button>
        </div>
        ${champsHtml}
        ${statutHtml}
      </div>
    `;
  }

  // (Re)branche les écouteurs après chaque rendu.
  function brancher() {
    // Recherche : une case cochée qui disparaît de l'écran est décochée — on
    // ne reprend jamais une valeur qu'on ne voit pas (même règle que la nature).
    corps.querySelector('#wsync-rech')?.addEventListener('input', (e) => {
      recherche = e.target.value;
      const visiblesCles = new Set();
      dataCourant.lignes.filter(ligneVisible).forEach((l) =>
        champsVisibles(l).forEach((c) => visiblesCles.add(cle(l.oeuvre_id, c.champ))));
      for (const k of [...selection]) if (!visiblesCles.has(k)) selection.delete(k);
      dessiner();
    });
    corps.querySelector('#wsync-portee-tout')?.addEventListener('click', () => {
      portee = null;
      selPortee.value = '';
      selPortee.classList.remove('cible');
      charger();
    });
    corps.querySelectorAll('.wsync-onglet').forEach((b) => b.addEventListener('click', () => {
      ongletActif = b.dataset.onglet;
      dessiner();
    }));
    corps.querySelectorAll('.wsync-chip[data-type]').forEach((chip) => chip.addEventListener('click', () => {
      const t = chip.dataset.type;
      if (filtres.has(t)) filtres.delete(t); else filtres.add(t);
      dessiner();
    }));
    // Changer de nature vide la sélection : garder des cases cochées qui ne
    // sont plus à l'écran ferait reprendre des valeurs qu'on ne voit plus.
    corps.querySelectorAll('.wsync-chip[data-nature]').forEach((chip) => chip.addEventListener('click', () => {
      nature = chip.dataset.nature;
      selection.clear();
      dessiner();
    }));

    corps.querySelector('#wsync-sel-tout')?.addEventListener('click', () => {
      dataCourant.lignes.filter(ligneVisible).forEach((l) => {
        champsVisibles(l).forEach((c) => selection.add(cle(l.oeuvre_id, c.champ)));
      });
      dessiner();
    });
    corps.querySelector('#wsync-sel-rien')?.addEventListener('click', () => { selection.clear(); dessiner(); });
    corps.querySelector('#wsync-importer-lot')?.addEventListener('click', importerLot);
    corps.querySelector('#wsync-voir-reglees')?.addEventListener('change', (e) => { afficherReglees = e.target.checked; dessiner(); });

    corps.querySelectorAll('.wsync-case').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) selection.add(cb.dataset.cle); else selection.delete(cb.dataset.cle);
      const btn = corps.querySelector('#wsync-importer-lot');
      if (btn) {
        btn.disabled = selection.size === 0;
        btn.textContent = `Reprendre la sélection${selection.size ? ` (${selection.size})` : ''}`;
      }
    }));

    corps.querySelectorAll('.wsync-carte').forEach((carte) => {
      const oeuvreId = Number(carte.dataset.oeuvre);
      carte.querySelector('.wsync-voir')?.addEventListener('click', () => ouvrirApercuOeuvre(oeuvreId));
      carte.querySelectorAll('.wsync-importer').forEach((btn) =>
        btn.addEventListener('click', () => importerUn(btn, oeuvreId, btn.dataset.champ)));
      carte.querySelectorAll('.wsync-garder').forEach((btn) =>
        btn.addEventListener('click', () => garderChamp(oeuvreId, btn.dataset.champ)));
      carte.querySelectorAll('.wsync-degarder').forEach((btn) =>
        btn.addEventListener('click', () => degarderChamp(oeuvreId, btn.dataset.champ)));
      const btnStatut = carte.querySelector('.wsync-statut-appliquer');
      if (btnStatut) btnStatut.addEventListener('click', () => appliquerStatut(carte, oeuvreId));
      carte.querySelector('.wsync-statut-garder')?.addEventListener('click', () => garderStatut(oeuvreId));
      carte.querySelector('.wsync-statut-degarder')?.addEventListener('click', () => degarderStatut(oeuvreId));
    });

    // Réconciliation « un seul côté »
    corps.querySelectorAll('.wsync-voir-2').forEach((b) =>
      b.addEventListener('click', () => ouvrirApercuOeuvre(Number(b.dataset.oeuvre))));
    corps.querySelectorAll('.wsync-recon[data-oeuvre]').forEach((row) => {
      const id = Number(row.dataset.oeuvre);
      row.querySelector('.wsync-app-retirer')?.addEventListener('click', () => appRetirer(id));
      row.querySelector('.wsync-app-vendre')?.addEventListener('click', () => naviguer('vente-fiche', { nouveau: true, oeuvre_id: id }));
      row.querySelector('.wsync-app-supprimer')?.addEventListener('click', () => appSupprimer(id));
    });
    corps.querySelectorAll('.wsync-recon[data-idx]').forEach((row) => {
      const idx = Number(row.dataset.idx);
      row.querySelector('.wsync-site-creer')?.addEventListener('click', () => creerFiche(idx));
      row.querySelector('.wsync-site-sku')?.addEventListener('click', () => corrigerSku(idx));
    });
  }

  // ----- Actions « œuvres seulement dans l'app » -----
  async function appRetirer(id) {
    const o = dataCourant.appSeul.find((x) => x.id === id);
    const r = await confirmer({
      type: 'warning', title: 'Retirer cette œuvre ?',
      message: `Retirer « ${o ? o.titre : ''} » du catalogue actif (rendue à l'artiste) ?`,
      detail: 'Réversible via « Réintégrer ». Aucune donnée n\'est supprimée.',
      buttons: ['Retirer', 'Annuler'], defaultId: 0, cancelId: 1,
    });
    if (r !== 0) return;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    try {
      await window.api.oeuvreRetrait(id, { retire: true, date, motif: 'Retrait (absente du site)' });
      dataCourant.appSeul = dataCourant.appSeul.filter((x) => x.id !== id);
      dessiner();
    } catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }
  async function appSupprimer(id) {
    const o = dataCourant.appSeul.find((x) => x.id === id);
    const r = await confirmer({
      type: 'warning', title: 'Supprimer cette œuvre ?',
      message: `Supprimer définitivement « ${o ? o.titre : ''} » ?`,
      detail: 'Action irréversible. Refusée si l\'œuvre est liée à une vente ou à un certificat.',
      buttons: ['Supprimer', 'Annuler'], defaultId: 1, cancelId: 1,
    });
    if (r !== 0) return;
    try {
      await window.api.oeuvreSupprimer(id);
      dataCourant.appSeul = dataCourant.appSeul.filter((x) => x.id !== id);
      dessiner();
    } catch (err) { await alerter({ type: 'error', title: 'Suppression refusée', message: nettoyerErreur(err) }); }
  }

  // ----- Actions « produits seulement sur le site » -----
  async function creerFiche(idx) {
    const produit = dataCourant.siteSeul[idx];
    if (!produit) return;
    const res = await modalCreerFiche(produit);
    if (res && res.cree) {
      dataCourant.siteSeul.splice(idx, 1);
      dessiner();
    }
  }
  async function corrigerSku(idx) {
    const produit = dataCourant.siteSeul[idx];
    if (!produit) return;
    const oeuvreId = await modalCorrigerSku(produit);
    if (oeuvreId) {
      dataCourant.siteSeul.splice(idx, 1);
      dataCourant.appSeul = dataCourant.appSeul.filter((x) => x.id !== oeuvreId);
      dessiner();
    }
  }

  async function garderChamp(oeuvreId, champ) {
    const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
    const c = l?.champs.find((x) => x.champ === champ);
    if (!c) return;
    try {
      await window.api.webIgnorerDiff(oeuvreId, champ, c.site_cle);
      c.ignore = true;
      selection.delete(cle(oeuvreId, champ));
      dessiner();
    } catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }
  async function degarderChamp(oeuvreId, champ) {
    const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
    const c = l?.champs.find((x) => x.champ === champ);
    if (!c) return;
    try {
      await window.api.webRetirerIgnore(oeuvreId, champ);
      c.ignore = false;
      dessiner();
    } catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }
  async function garderStatut(oeuvreId) {
    const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
    if (!l || !l.statut_reconcilier) return;
    try {
      await window.api.webIgnorerDiff(oeuvreId, 'statut', l.statut_reconcilier.site_cle);
      l.statut_reconcilier.ignore = true;
      dessiner();
    } catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }
  async function degarderStatut(oeuvreId) {
    const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
    if (!l || !l.statut_reconcilier) return;
    try {
      await window.api.webRetirerIgnore(oeuvreId, 'statut');
      l.statut_reconcilier.ignore = false;
      dessiner();
    } catch (err) { await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) }); }
  }

  function retirerChamp(oeuvreId, champ) {
    const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
    if (l) l.champs = l.champs.filter((c) => c.champ !== champ);
    selection.delete(cle(oeuvreId, champ));
  }

  async function importerUn(btn, oeuvreId, champ) {
    const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
    const c = l?.champs.find((x) => x.champ === champ);
    if (!c) return;
    // Titre et description : édition possible avant remplacement. Prix : direct.
    let valeur = c.site;
    if (champ === 'titre' || champ === 'description') {
      const edite = await editerTexteImport(c.libelle || champ, c.site == null ? '' : String(c.site));
      if (edite == null) return; // annulé
      valeur = edite;
    }
    btn.disabled = true;
    btn.textContent = 'Import…';
    try {
      await window.api.webImporterChamp(oeuvreId, champ, valeur);
      retirerChamp(oeuvreId, champ);
      dessiner();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Reprendre la valeur du site →';
      await alerter({ type: 'error', title: 'Import échoué', message: nettoyerErreur(err) });
    }
  }

  async function importerLot() {
    if (!selection.size) return;
    const items = [];
    for (const k of selection) {
      const [idStr, champ] = k.split(':');
      const oeuvreId = Number(idStr);
      const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
      const c = l?.champs.find((x) => x.champ === champ);
      if (c) items.push({ oeuvreId, champ, valeur: c.site });
    }
    if (!items.length) return;
    const rep = await confirmer({
      type: 'question', title: 'Reprendre les valeurs du site ?',
      message: `Importer ${pluriel(items.length, 'valeur')} du site dans l'app ?`,
      detail: 'Ces champs seront remplacés dans l\'app (réversible en éditant les œuvres). Le site n\'est pas touché.',
      buttons: ['Importer', 'Annuler'], defaultId: 0, cancelId: 1,
    });
    if (rep !== 0) return;
    let res;
    try {
      res = await window.api.webImporterLot(items);
    } catch (err) {
      await alerter({ type: 'error', title: 'Import échoué', message: nettoyerErreur(err) });
      return;
    }
    const enErreur = new Set((res.erreurs || []).map((e) => cle(e.oeuvreId, e.champ)));
    items.forEach((it) => { if (!enErreur.has(cle(it.oeuvreId, it.champ))) retirerChamp(it.oeuvreId, it.champ); });
    dessiner();
    if (res.erreurs && res.erreurs.length) {
      await alerter({ type: 'warning', title: 'Import partiel', message: `${res.reussis}/${res.total} importée(s). ${res.erreurs.length} en erreur.` });
    } else {
      await alerter({ type: 'succes', title: 'Import terminé', message: `${res.reussis} valeur(s) importée(s) dans l'app.` });
    }
  }

  async function appliquerStatut(carte, oeuvreId) {
    const select = carte.querySelector('.wsync-statut-select');
    const btn = carte.querySelector('.wsync-statut-appliquer');
    if (!select) return;
    const statut = select.value;
    btn.disabled = true;
    const libelle = btn.textContent;
    btn.textContent = 'Application…';
    try {
      await window.api.webDefinirStatut(oeuvreId, statut);
      const l = dataCourant.lignes.find((x) => x.oeuvre_id === oeuvreId);
      if (l) { l.statut_app = statut; l.statut_reconcilier = null; }
      dessiner();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = libelle;
      await alerter({ type: 'error', title: 'Statut non modifié', message: nettoyerErreur(err) });
    }
  }

  btnComparer.addEventListener('click', charger);

  // Changer de portée relance la comparaison — si elle est possible : sans
  // clés, le bandeau de connexion a déjà dit quoi faire.
  selPortee.addEventListener('change', () => {
    portee = Number(selPortee.value) || null;
    selPortee.classList.toggle('cible', !!portee);
    recherche = '';
    if (etat.adresseOk && etat.cles) charger();
  });
  await remplirPortee();
  // Arrivé depuis la fiche d'un artiste : on compare sans attendre de clic.
  if (portee && etat.adresseOk && etat.cles) charger();
}

// Aperçu de l'œuvre en modale (lecture seule) — pour consulter la fiche sans
// quitter l'écran de synchronisation. Un bouton permet d'ouvrir la fiche
// complète et éditable (qui, lui, quitte la synchro).
async function ouvrirApercuOeuvre(oeuvreId) {
  let oeuvre;
  try {
    const bundle = await window.api.oeuvreFicheBundle(oeuvreId);
    oeuvre = bundle && bundle.oeuvre ? bundle.oeuvre : null;
  } catch (err) {
    await alerter({ type: 'error', title: 'Erreur', message: nettoyerErreur(err) });
    return;
  }
  if (!oeuvre) {
    await alerter({ type: 'warning', title: 'Introuvable', message: "Cette œuvre est introuvable." });
    return;
  }

  const ligneMeta = (lib, val) => (val != null && String(val).trim() !== '')
    ? `<dt>${ech(lib)}</dt><dd>${ech(String(val))}</dd>` : '';
  const metaHtml = [
    ligneMeta('Année', oeuvre.annee),
    ligneMeta('Dimensions', oeuvre.dimensions),
    ligneMeta('Médium', oeuvre.medium),
    ligneMeta('Support', oeuvre.support),
    ligneMeta('Format', oeuvre.format),
    ligneMeta('Style', oeuvre.style),
    ligneMeta('Emplacement', oeuvre.emplacement),
  ].join('');

  const overlay = document.createElement('div');
  overlay.className = 'overlay-modale apercu-overlay';
  overlay.innerHTML = `
    <div class="apercu-oeuvre" role="dialog" aria-modal="true" aria-label="Aperçu de l'œuvre">
      <button type="button" class="apercu-fermer" aria-label="Fermer">&times;</button>
      <div class="apercu-corps">
        <div class="apercu-image">
          ${oeuvre.image_path
            ? `<img src="${urlPhoto(oeuvre.image_path)}" alt="">`
            : `<span class="apercu-image-vide">&#9635;</span>`}
        </div>
        <div class="apercu-infos">
          ${oeuvre.numero_inventaire ? `<div class="apercu-sku">Nº ${ech(oeuvre.numero_inventaire)}</div>` : ''}
          <h2 class="apercu-titre">${ech(oeuvre.titre || 'Sans titre')}</h2>
          <p class="apercu-artiste">${ech(oeuvre.artiste_nom || '')}</p>
          <div class="apercu-badges">
            ${badgeStatut(oeuvre.statut)}
            ${oeuvre.prix != null ? `<span class="apercu-prix">${formaterPrix(oeuvre.prix)}</span>` : ''}
          </div>
          ${metaHtml ? `<dl class="apercu-meta">${metaHtml}</dl>` : ''}
          ${oeuvre.description && String(oeuvre.description).trim()
            ? `<div class="apercu-desc">${ech(oeuvre.description)}</div>` : ''}
        </div>
      </div>
      <div class="apercu-actions">
        <button type="button" class="btn-action btn-secondaire-action" id="apercu-ouvrir-fiche">Ouvrir la fiche complète</button>
        <button type="button" class="btn-action btn-principal" id="apercu-fermer-2">Fermer</button>
      </div>
    </div>
  `;

  const fermer = () => {
    overlay.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(); });
  window.addEventListener('keydown', onKey);
  overlay.querySelector('.apercu-fermer').addEventListener('click', fermer);
  overlay.querySelector('#apercu-fermer-2').addEventListener('click', fermer);
  overlay.querySelector('#apercu-ouvrir-fiche').addEventListener('click', () => {
    fermer();
    naviguer('oeuvre-fiche', { id: oeuvreId });
  });

  document.body.appendChild(overlay);
}

// Modale : créer une fiche d'œuvre à partir d'un produit du site. L'artiste est
// choisi ici ; titre/description/prix sont pré-remplis et modifiables ; l'image
// du site peut être téléchargée puis recadrée. Retourne { cree, oeuvre } ou null.
function modalCreerFiche(produit) {
  return new Promise(async (resolve) => {
    let artistes = [];
    try {
      artistes = await window.api.artistesListe({ inclureArchives: false });
    } catch (err) {
      await alerter({ type: 'error', title: 'Erreur', message: nettoyerErreur(err) });
      resolve(null); return;
    }
    const options = artistes
      .map((a) => ({ id: a.id, nom: nomComplet(a) || a.nom || '' }))
      .sort((a, b) => sansAccents(a.nom).localeCompare(sansAccents(b.nom)))
      .map((a) => `<option value="${a.id}">${ech(a.nom)}</option>`).join('');

    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue" role="dialog" aria-modal="true" style="max-width: 560px;">
        <div class="dialogue-entete"><h3 class="dialogue-titre">Créer une fiche depuis le site</h3></div>
        <p class="dialogue-message">Produit <span class="wsync-sku">${ech(produit.sku)}</span> — le numéro d'inventaire de la fiche sera ce SKU.</p>
        <div class="form-champ"><label for="cf-titre">Titre</label><input type="text" id="cf-titre" value="${ech(produit.name || '')}"></div>
        <div class="form-champ"><label for="cf-artiste">Artiste</label>
          <select id="cf-artiste"><option value="">— Sélectionner —</option>${options}</select>
        </div>
        <div class="form-champ"><label for="cf-prix">Prix</label><input type="number" id="cf-prix" min="0" step="0.01" value="${produit.prix != null ? produit.prix : ''}"></div>
        <div class="form-champ"><label for="cf-desc">Description</label><textarea id="cf-desc" rows="4">${ech(produit.description || '')}</textarea></div>
        <!-- Caractéristiques reprises du site. Signalement du 2026-09-10 : « les
             caractéristiques ne suivent pas ». Elles sont MONTRÉES avant la
             création : une fiche remplie à l'insu de celui qui la crée est
             une fiche qu'on ne relit pas. -->
        <div class="cf-carac" id="cf-carac"><p class="aide-champ">Lecture des caractéristiques sur le site…</p></div>
        ${produit.image ? `<label class="cf-image-choix"><input type="checkbox" id="cf-image" checked> Télécharger l'image du site (recadrage ensuite)</label>` : ''}
        <div class="dialogue-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="cf-annuler">Annuler</button>
          <button type="button" class="btn-action btn-principal" id="cf-creer">Créer la fiche</button>
        </div>
      </div>`;

    let fini = false;
    const fermer = (r) => { if (fini) return; fini = true; window.removeEventListener('keydown', onKey); overlay.remove(); resolve(r); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(null); } };
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(null); });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('#cf-titre').focus();

    // Lecture des caractéristiques. Non bloquante : si le site ne répond pas,
    // la fiche se crée comme avant (titre, description, prix), et on le dit.
    let carac = null;
    const LIB_CARAC = [
      ['type', 'Type'], ['format', 'Format'], ['medium', 'Médium'], ['support', 'Support'],
      ['orientation', 'Orientation'], ['sujets', 'Sujets'], ['style', 'Style'],
    ];
    window.api.webCaracteristiquesProduit(produit.sku).then((r) => {
      if (fini) return;
      const zone = overlay.querySelector('#cf-carac');
      if (!r || !r.trouve) {
        zone.innerHTML = `<p class="aide-champ">Aucune caractéristique trouvée sur le site pour ce produit.</p>`;
        return;
      }
      carac = r.caracteristiques;
      const dims = [carac.hauteur, carac.largeur, carac.profondeur];
      const lignes = LIB_CARAC.filter(([k]) => carac[k]).map(([k, lib]) =>
        `<div class="cf-carac-l"><span>${lib}</span><strong>${ech(String(carac[k]).replace(/,/g, ', '))}</strong></div>`);
      if (dims.some((v) => v != null)) {
        lignes.push(`<div class="cf-carac-l"><span>Dimensions</span><strong>${dims.map((v) => (v != null ? v : '?')).join(' × ')} po</strong></div>`);
      }
      zone.innerHTML = lignes.length
        ? `<p class="cf-carac-titre">Repris du site</p>${lignes.join('')}`
        : `<p class="aide-champ">Le site n'indique aucune caractéristique pour ce produit.</p>`;
      // Artiste suggéré d'après la catégorie du produit — seulement si rien
      // n'est encore choisi : on ne défait jamais un choix fait à la main.
      const sel = overlay.querySelector('#cf-artiste');
      if (r.artiste_id_suggere && !sel.value) sel.value = String(r.artiste_id_suggere);
    }).catch(() => {
      if (fini) return;
      overlay.querySelector('#cf-carac').innerHTML =
        `<p class="aide-champ">Caractéristiques illisibles sur le site : la fiche sera créée sans elles, à compléter à la main.</p>`;
    });

    overlay.querySelector('#cf-annuler').addEventListener('click', () => fermer(null));
    overlay.querySelector('#cf-creer').addEventListener('click', async (e) => {
      const titre = overlay.querySelector('#cf-titre').value.trim();
      const artiste_id = overlay.querySelector('#cf-artiste').value;
      const prixTxt = overlay.querySelector('#cf-prix').value.trim();
      const description = overlay.querySelector('#cf-desc').value;
      if (!titre) { await alerter({ type: 'warning', title: 'Titre manquant', message: 'Donne un titre à l\'œuvre.' }); return; }
      if (!artiste_id) { await alerter({ type: 'warning', title: 'Artiste manquant', message: 'Choisis un artiste. (Crée-le d\'abord dans Artistes s\'il n\'existe pas.)' }); return; }
      const veutImage = produit.image && overlay.querySelector('#cf-image') && overlay.querySelector('#cf-image').checked;
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = 'Création…';
      let oeuvre;
      try {
        const r = await window.api.webCreerOeuvreDepuisSite({
          sku: produit.sku, titre, artiste_id: Number(artiste_id),
          description, prix: prixTxt === '' ? null : Number(prixTxt),
          caracteristiques: carac,
        });
        oeuvre = r.oeuvre;
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Créer la fiche';
        await alerter({ type: 'error', title: 'Création échouée', message: nettoyerErreur(err) });
        return;
      }
      // Fiche créée : on ferme, puis on gère l'image seule (recadrage par-dessus).
      fermer({ cree: true, oeuvre });
      if (veutImage) {
        try {
          const dataUrl = await window.api.webTelechargerImage(produit.image);
          const crop = await recadrerCarre(dataUrl);
          if (crop) await window.api.photoEnregistrerRecadree('oeuvres', oeuvre.id, crop, dataUrl);
        } catch (err) {
          await alerter({ type: 'warning', title: 'Image non ajoutée', message: `${nettoyerErreur(err)} La fiche est créée ; tu pourras ajouter la photo plus tard sur sa fiche.` });
        }
      }
      await alerter({ type: 'succes', title: 'Fiche créée', message: `« ${oeuvre.titre} » ajoutée (Nº ${oeuvre.numero_inventaire}).` });
    });
  });
}

// Modale : corriger le SKU d'une œuvre existante (coquille) = lui donner le SKU
// du site comme numéro d'inventaire. Propose des candidats, avec recherche.
// Retourne l'id de l'œuvre corrigée, ou null.
function modalCorrigerSku(produit) {
  return new Promise(async (resolve) => {
    let toutes = [];
    try {
      toutes = await window.api.oeuvresListe({ inclureArchives: false });
    } catch (err) {
      await alerter({ type: 'error', title: 'Erreur', message: nettoyerErreur(err) });
      resolve(null); return;
    }
    const candidats = produit.candidats || [];
    const ligne = (o, marque) => `
      <label class="csku-ligne">
        <input type="radio" name="csku-cible" value="${o.id}">
        <span class="csku-info"><span class="wsync-sku">${ech((o.inv ?? o.numero_inventaire) || '—')}</span> ${ech(o.titre)} <span class="wsync-artiste">${ech(o.artiste || o.artiste_nom || '')}</span></span>
        ${marque ? '<span class="wsync-badge-doute">titre identique</span>' : ''}
      </label>`;

    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue" role="dialog" aria-modal="true" style="max-width: 620px;">
        <div class="dialogue-entete"><h3 class="dialogue-titre">Corriger le SKU</h3></div>
        <p class="dialogue-message">Donner le SKU <span class="wsync-sku">${ech(produit.sku)}</span> (« ${ech(produit.name)} ») à une œuvre existante mal numérotée.</p>
        <div class="form-champ"><input type="search" id="csku-rech" placeholder="Rechercher une œuvre par titre, artiste, numéro…" autocomplete="off"></div>
        <div class="csku-liste" id="csku-liste">
          ${candidats.length ? candidats.map((o) => ligne(o, o.match)).join('') : '<p class="aide-champ" style="margin:0;">Aucun candidat évident — cherche ci-dessus.</p>'}
        </div>
        <div class="dialogue-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="csku-annuler">Annuler</button>
          <button type="button" class="btn-action btn-principal" id="csku-ok" disabled>Corriger le SKU</button>
        </div>
      </div>`;

    let fini = false;
    const fermer = (r) => { if (fini) return; fini = true; window.removeEventListener('keydown', onKey); overlay.remove(); resolve(r); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(null); } };
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fermer(null); });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    const liste = overlay.querySelector('#csku-liste');
    const btnOk = overlay.querySelector('#csku-ok');
    const majOk = () => { btnOk.disabled = !overlay.querySelector('input[name="csku-cible"]:checked'); };
    liste.addEventListener('change', majOk);

    const rech = overlay.querySelector('#csku-rech');
    rech.addEventListener('input', () => {
      const q = sansAccents(rech.value.trim());
      if (!q) {
        liste.innerHTML = candidats.length ? candidats.map((o) => ligne(o, o.match)).join('') : '<p class="aide-champ" style="margin:0;">Aucun candidat évident — cherche ci-dessus.</p>';
        majOk(); return;
      }
      const res = toutes.filter((o) => {
        const cible = sansAccents([o.titre, o.artiste_nom, o.numero_inventaire].filter(Boolean).join(' '));
        return cible.includes(q);
      }).slice(0, 30);
      liste.innerHTML = res.length ? res.map((o) => ligne(o, false)).join('') : '<p class="aide-champ" style="margin:0;">Aucune œuvre trouvée.</p>';
      majOk();
    });

    overlay.querySelector('#csku-annuler').addEventListener('click', () => fermer(null));
    btnOk.addEventListener('click', async (e) => {
      const sel = overlay.querySelector('input[name="csku-cible"]:checked');
      if (!sel) return;
      const oeuvreId = Number(sel.value);
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = 'Correction…';
      try {
        await window.api.webCorrigerSku(oeuvreId, produit.sku);
        fermer(oeuvreId);
        await alerter({ type: 'succes', title: 'SKU corrigé', message: `L'œuvre porte maintenant le numéro d'inventaire « ${produit.sku} ».` });
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Corriger le SKU';
        await alerter({ type: 'error', title: 'Correction refusée', message: nettoyerErreur(err) });
      }
    });
  });
}
// (brancherImporterAnglais retirée le 2026-09-09 : l'import en masse des textes
//  anglais est remplacé par le filtre « Manquants » du comparateur, qui couvre
//  en plus la citation anglaise que cet import n'a jamais traitée.)

// Bouton « Récupérer les adresses du site ». Remplit l'adresse de la fiche de
// chaque œuvre sur le site, rapprochée par numéro d'inventaire = SKU. Passe par
// l'API publique de la boutique : fonctionne même sans clés REST configurées.
// C'est cette adresse que le code QR des cartels d'exposition utilise.
function brancherRecupererAdresses(btn) {
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    const bouton = e.currentTarget; // à capturer AVANT tout await (sinon null ensuite)
    const rep = await confirmer({
      type: 'question',
      title: 'Récupérer les adresses du site ?',
      message: "Remplir, pour chaque œuvre, l'adresse de sa fiche sur le site web.",
      detail: [
        "Le rapprochement se fait par numéro d'inventaire (le SKU du site).",
        "Seule cette adresse est renseignée : aucun autre champ n'est touché, et rien n'est modifié sur le site.",
        "L'adresse sert au bouton « Voir sur le site » et aux codes QR des cartels.",
      ].join('\n\n'),
      buttons: ['Récupérer', 'Annuler'], defaultId: 0, cancelId: 1,
    });
    if (rep !== 0) return;
    bouton.disabled = true;
    const lib = bouton.textContent;
    bouton.textContent = 'Lecture du site…';
    try {
      const r = await window.api.webRecupererAdresses();
      const lignes = [
        `${pluriel(r.total_site, 'produit lu', 'produits lus')} sur le site.`,
        `${pluriel(r.rapprochees, 'œuvre rapprochée', 'œuvres rapprochées')} par numéro d'inventaire.`,
      ];
      if (r.inchangees) lignes.push(`${pluriel(r.inchangees, 'adresse était déjà à jour', 'adresses étaient déjà à jour')}.`);
      if (r.sans_correspondance) lignes.push(`${pluriel(r.sans_correspondance, 'produit du site n\u2019a', 'produits du site n\u2019ont')} aucune œuvre correspondante.`);
      if (r.sans_numero) lignes.push(`${pluriel(r.sans_numero, 'œuvre n\u2019a', 'œuvres n\u2019ont')} pas de numéro d'inventaire — impossible de les rapprocher.`);
      await alerter({
        type: 'succes',
        title: r.remplies ? 'Adresses récupérées' : 'Rien à mettre à jour',
        message: r.remplies
          ? `${pluriel(r.remplies, 'adresse enregistrée', 'adresses enregistrées')}.`
          : "Aucune nouvelle adresse à enregistrer.",
        detail: lignes.join('\n'),
      });
    } catch (err) {
      await alerter({ type: 'error', title: 'Récupération impossible', message: nettoyerErreur(err) });
    } finally {
      bouton.disabled = false;
      bouton.textContent = lib;
    }
  });
}
