import { naviguer } from '../router.js';
import { ech, sansAccents, formaterDate, urlPhoto } from '../commun.js';
import { confirmer } from '../dialogue.js';

// ===== Icônes (SVG inline, stroke courant) =====
const ICO = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  sage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8H3l1.2-4h15.6L21 8z"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="9.5" y1="12" x2="14.5" y2="12"/></svg>',
  site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  paiement: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  emballage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  envoi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  livraison: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  fleche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
};

const PREP_STEPS = [
  { cle: 'sage', lbl: 'Sage 50', icone: ICO.sage },
  { cle: 'stock', lbl: 'Stock', icone: ICO.stock },
  { cle: 'site', lbl: 'Site web', icone: ICO.site },
];
const POST_STEPS = [
  { cle: 'paiement', lbl: 'Paiement', icone: ICO.paiement },
  { cle: 'emballage', lbl: 'Emballage', icone: ICO.emballage },
  { cle: 'envoi', lbl: 'Envoi', icone: ICO.envoi },
  { cle: 'livraison', lbl: 'Livraison', icone: ICO.livraison },
];
const RANG = { attente: 0, partiel: 1, fait: 2 };
const PREP_COL = { sage: 'sage_cree', stock: 'stock_fait', site: 'site_publie' };
const PREP_DATE = { sage: 'sage_cree_date', stock: 'stock_fait_date', site: 'site_publie_date' };

function aujourdHuiISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ----- Lecture d'état -----
const etatPaiement = (v) => (v.paiement_statut === 'recu' ? 'fait' : v.paiement_statut === 'partiel' ? 'partiel' : 'attente');
const etatVente = (v, cle) => (cle === 'paiement' ? etatPaiement(v) : (v[`${cle}_date`] ? 'fait' : 'attente'));
const etatPrep = (o, cle) => (o[PREP_COL[cle]] ? 'fait' : 'attente');
const venteComplete = (v) => v.paiement_statut === 'recu' && !!v.emballage_date && !!v.envoi_date && !!v.livraison_date;

export async function rendreSuivi(contenu) {
  let data = await window.api.suiviDonnees();
  let onglet = 'actif';
  let filtre = '';

  contenu.innerHTML = `
    <div class="vue-suivi">
      <div class="entete-page entete-page--simple">
        <h2 class="entete-page-titre">Suivi</h2>
        <div class="entete-page-recherche-wrap">
          <div class="recherche-pillule">
            <svg class="recherche-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
            </svg>
            <input type="search" id="suivi-recherche" placeholder="Rechercher (œuvre, artiste, client, n° facture)…" autocomplete="off">
          </div>
        </div>
      </div>

      <div class="suivi-files-wrap" id="suivi-files"></div>

      <div class="suivi-onglets">
        <button type="button" class="actif" data-onglet="actif" id="suivi-bt-actif"></button>
        <button type="button" data-onglet="comp" id="suivi-bt-comp"></button>
      </div>

      <div id="suivi-corps"></div>
    </div>
  `;

  const elFiles = contenu.querySelector('#suivi-files');
  const elCorps = contenu.querySelector('#suivi-corps');
  const btActif = contenu.querySelector('#suivi-bt-actif');
  const btComp = contenu.querySelector('#suivi-bt-comp');

  async function recharger() {
    data = await window.api.suiviDonnees();
    peindre();
  }

  // ----- Sauvegardes inline -----
  async function sauverPrep(o, cle, fait) {
    const payload = {
      sage_cree: o.sage_cree, sage_cree_date: o.sage_cree_date,
      stock_fait: o.stock_fait, stock_fait_date: o.stock_fait_date,
      site_publie: o.site_publie, site_publie_date: o.site_publie_date,
    };
    payload[PREP_COL[cle]] = fait ? 1 : 0;
    payload[PREP_DATE[cle]] = fait ? (o[PREP_DATE[cle]] || aujourdHuiISO()) : null;
    await window.api.oeuvreMajPreparation(o.id, payload);
    await recharger();
  }
  async function sauverCycle(v, changes) {
    const payload = {
      paiement_statut: v.paiement_statut || null,
      paiement_date: v.paiement_date || null,
      emballage_date: v.emballage_date || null,
      envoi_date: v.envoi_date || null,
      livraison_date: v.livraison_date || null,
      ...changes,
    };
    await window.api.venteMajCycle(v.id, payload);
    await recharger();
  }

  // ----- Stepper -----
  function stepperHTML(steps, getEtat, type, id) {
    return steps.map((s, i) => {
      const etat = getEtat(s.cle);
      const icone = etat === 'fait' ? ICO.check : s.icone;
      const suivantFait = i < steps.length - 1 && etat === 'fait' && getEtat(steps[i + 1].cle) === 'fait';
      const conn = i < steps.length - 1 ? `<span class="suivi-conn ${suivantFait ? 'fait' : ''}"></span>` : '';
      return `<span class="suivi-step ${etat}"><button type="button" class="suivi-rond" data-type="${type}" data-id="${id}" data-cle="${s.cle}" title="Changer le statut">${icone}</button><span class="suivi-lbl">${s.lbl}</span></span>${conn}`;
    }).join('');
  }

  // ----- Filtres -----
  function ligneMatch(champs) {
    if (!filtre) return true;
    return sansAccents(champs.filter(Boolean).join(' ')).includes(filtre);
  }
  const oeuvresPrep = () => data.preparation.filter((o) => ligneMatch([o.titre, o.artiste_nom, o.numero_inventaire]));
  const ventesEnCours = () => data.ventes.filter((v) => !venteComplete(v) && ligneMatch([v.oeuvre_titre, v.artiste_nom, v.client_nom, v.numero_facture, v.numero_inventaire]));
  const ventesCompletees = () => data.ventes.filter((v) => venteComplete(v) && ligneMatch([v.oeuvre_titre, v.artiste_nom, v.client_nom, v.numero_facture, v.numero_inventaire]));

  // ----- Rendu des lignes -----
  function ligneOeuvre(o) {
    return `
      <div class="suivi-ligne prep">
        <div class="suivi-vignette suivi-ouvrir" data-open="oeuvre" data-open-id="${o.id}">
          ${o.image_path ? `<img src="${urlPhoto(o.image_path)}" loading="lazy" alt="">` : '<span>&#9635;</span>'}
        </div>
        <div class="suivi-col-titre suivi-ouvrir" data-open="oeuvre" data-open-id="${o.id}">
          <p class="o">${ech(o.titre)}</p><p class="a">${ech(o.artiste_nom || '')}</p>
        </div>
        <div class="suivi-col-client">
          <p class="c">${ech(o.numero_inventaire || '—')}</p>
          <p class="f">${o.statut === 'reserve' ? 'Réservée' : 'Disponible'}</p>
        </div>
        <div class="suivi-stepper">${stepperHTML(PREP_STEPS, (cle) => etatPrep(o, cle), 'oeuvre', o.id)}</div>
      </div>`;
  }
  function ligneVente(v) {
    const prochaine = POST_STEPS.find((s) => etatVente(v, s.cle) !== 'fait');
    const partiel = prochaine && etatVente(v, prochaine.cle) === 'partiel';
    const fin = venteComplete(v)
      ? `<span class="suivi-etat-ok">${ICO.check} Livré le ${formaterDate(v.livraison_date)}</span>`
      : `<span class="suivi-chip-prochaine">${ICO.fleche}${partiel ? 'Finir ' : ''}${prochaine.lbl}</span>`;
    return `
      <div class="suivi-ligne post">
        <div class="suivi-vignette suivi-ouvrir" data-open="vente" data-open-id="${v.id}">
          ${v.image_path ? `<img src="${urlPhoto(v.image_path)}" loading="lazy" alt="">` : '<span>&#9635;</span>'}
        </div>
        <div class="suivi-col-titre suivi-ouvrir" data-open="vente" data-open-id="${v.id}">
          <p class="o">${ech(v.oeuvre_titre)}</p><p class="a">${ech(v.artiste_nom || '')}</p>
        </div>
        <div class="suivi-col-client">
          <p class="c">${ech(v.client_nom || '—')}</p>
          <p class="f">${v.numero_facture ? ech(v.numero_facture) + ' · ' : ''}${formaterDate(v.date_vente)}</p>
        </div>
        <div class="suivi-stepper">${stepperHTML(POST_STEPS, (cle) => etatVente(v, cle), 'vente', v.id)}</div>
        <div class="suivi-col-fin">${fin}</div>
      </div>`;
  }

  const carte = (html) => `<div class="suivi-liste">${html}</div>`;
  const vide = (msg) => `<div class="suivi-vide">${msg}</div>`;

  function peindre() {
    const prep = oeuvresPrep();
    const cours = ventesEnCours();
    const comp = ventesCompletees();
    const totalPrep = data.preparation.length;
    const totalCours = data.ventes.filter((v) => !venteComplete(v)).length;
    const totalComp = data.ventes.filter(venteComplete).length;

    // Files d'attente (sur l'ensemble, non filtré)
    const tuile = (cls, ico, val, lbl) => `<div class="suivi-file-tuile"><div class="suivi-ico ${cls}">${ico}</div><div><div class="val">${val}</div><div class="lbl">${lbl}</div></div></div>`;
    const cs = data.ventes.filter((v) => !venteComplete(v));
    elFiles.innerHTML = `
      <div class="suivi-files-groupe prep">
        <p class="titre-g">Préparation</p>
        <div class="suivi-files">
          ${tuile('sage', ICO.sage, data.preparation.filter((o) => !o.sage_cree).length, 'À créer dans Sage')}
          ${tuile('stock', ICO.stock, data.preparation.filter((o) => !o.stock_fait).length, 'À mettre en stock')}
          ${tuile('site', ICO.site, data.preparation.filter((o) => !o.site_publie).length, 'À publier au site')}
        </div>
      </div>
      <div class="suivi-files-groupe post">
        <p class="titre-g">Expédition</p>
        <div class="suivi-files">
          ${tuile('encaisser', ICO.paiement, cs.filter((v) => v.paiement_statut !== 'recu').length, 'À encaisser')}
          ${tuile('emballer', ICO.emballage, cs.filter((v) => v.paiement_statut === 'recu' && !v.emballage_date).length, 'À emballer')}
          ${tuile('expedier', ICO.envoi, cs.filter((v) => v.emballage_date && !v.envoi_date).length, 'À expédier')}
          ${tuile('livrer', ICO.livraison, cs.filter((v) => v.envoi_date && !v.livraison_date).length, 'À livrer')}
        </div>
      </div>`;

    btActif.textContent = `Actif (${totalPrep + totalCours})`;
    btComp.textContent = `Complétées (${totalComp})`;
    btActif.classList.toggle('actif', onglet === 'actif');
    btComp.classList.toggle('actif', onglet === 'comp');

    if (onglet === 'actif') {
      if (prep.length + cours.length === 0) {
        elCorps.innerHTML = carte(vide(filtre ? 'Aucun résultat actif pour cette recherche.' : 'Rien à préparer ni à expédier — tout est à jour. 🎉'));
      } else {
        let html = '';
        if (prep.length) {
          html += `<div class="suivi-groupe">
            <div class="suivi-groupe-titre"><span class="ico-g ic-prep">${ICO.sage}</span><span>À préparer</span><span class="nb">${prep.length}</span></div>
            ${carte(prep.map(ligneOeuvre).join(''))}
          </div>`;
        }
        if (cours.length) {
          html += `<div class="suivi-groupe">
            <div class="suivi-groupe-titre"><span class="ico-g ic-cours">${ICO.emballage}</span><span>Commandes en cours</span><span class="nb">${cours.length}</span></div>
            ${carte(cours.map(ligneVente).join(''))}
          </div>`;
        }
        elCorps.innerHTML = html;
      }
    } else {
      elCorps.innerHTML = comp.length
        ? carte(comp.map(ligneVente).join(''))
        : carte(vide(filtre ? 'Aucune commande complétée pour cette recherche.' : 'Aucune commande complétée pour l\'instant.'));
    }

    brancher();
  }

  // ----- Menu déroulant du statut de paiement -----
  let menuOuvert = null;
  function fermerMenu() {
    if (menuOuvert) {
      menuOuvert.remove();
      menuOuvert = null;
      document.removeEventListener('click', fermerMenuExt, true);
      elCorps.removeEventListener('scroll', fermerMenu, true);
      contenu.removeEventListener('scroll', fermerMenu, true);
    }
  }
  function fermerMenuExt(e) { if (menuOuvert && !menuOuvert.contains(e.target)) fermerMenu(); }
  const PAIEMENT_OPTIONS = [
    { v: '', l: 'À faire', c: 'var(--stone)' },
    { v: 'partiel', l: 'Partiel', c: 'var(--terracotta)' },
    { v: 'recu', l: 'Reçu', c: 'var(--succes)' },
  ];
  function ouvrirMenuPaiement(rond, v) {
    fermerMenu();
    const menu = document.createElement('div');
    menu.className = 'suivi-menu-pop';
    const courantV = v.paiement_statut || '';
    menu.innerHTML = PAIEMENT_OPTIONS.map((o) => {
      const courant = courantV === o.v;
      return `<button type="button" data-v="${o.v}" class="${courant ? 'courant' : ''}"><span class="pastille-etat" style="background:${o.c}"></span>${o.l}${courant ? `<span class="coche">${ICO.check}</span>` : ''}</button>`;
    }).join('');
    document.body.appendChild(menu);
    const r = rond.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${r.bottom + 6}px`;
    menu.style.left = `${Math.min(r.left, window.innerWidth - 190)}px`;
    menuOuvert = menu;
    menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      fermerMenu();
      const next = b.dataset.v;
      const cur = v.paiement_statut || '';
      if (next === cur) return;
      const rNext = next === 'recu' ? 2 : next === 'partiel' ? 1 : 0;
      const rCur = cur === 'recu' ? 2 : cur === 'partiel' ? 1 : 0;
      const appliquer = () => {
        const changes = { paiement_statut: next || null };
        changes.paiement_date = next ? (v.paiement_date || aujourdHuiISO()) : null;
        sauverCycle(v, changes);
      };
      if (rNext < rCur) {
        const lis = (x) => (x === 'recu' ? 'reçu' : x === 'partiel' ? 'partiel' : 'à faire');
        confirmer({
          type: 'warning', title: 'Revenir en arrière ?',
          message: `Le paiement repassera de « ${lis(cur)} » à « ${lis(next)} ».`,
          buttons: ['Confirmer', 'Annuler'], defaultId: 0, cancelId: 1,
        }).then((i) => { if (i === 0) appliquer(); });
      } else appliquer();
    }));
    setTimeout(() => {
      document.addEventListener('click', fermerMenuExt, true);
      contenu.addEventListener('scroll', fermerMenu, true);
    }, 0);
  }

  // ----- Branchement des interactions -----
  function brancher() {
    elCorps.querySelectorAll('.suivi-ouvrir').forEach((el) => el.addEventListener('click', () => {
      const type = el.dataset.open;
      const id = Number(el.dataset.openId);
      naviguer(type === 'oeuvre' ? 'oeuvre-fiche' : 'vente-fiche', { id });
    }));

    elCorps.querySelectorAll('.suivi-rond').forEach((r) => r.addEventListener('click', () => {
      const type = r.dataset.type;
      const cle = r.dataset.cle;
      const id = Number(r.dataset.id);

      if (type === 'oeuvre') {
        const o = data.preparation.find((x) => x.id === id);
        if (!o) return;
        const fait = etatPrep(o, cle) !== 'fait'; // toggle
        if (!fait) {
          const lblPrep = PREP_STEPS.find((s) => s.cle === cle).lbl;
          confirmer({
            type: 'warning', title: 'Revenir en arrière ?',
            message: `L'étape « ${lblPrep} » sera décochée.`,
            buttons: ['Décocher', 'Annuler'], defaultId: 0, cancelId: 1,
          }).then((i) => { if (i === 0) sauverPrep(o, cle, false); });
        } else {
          sauverPrep(o, cle, true);
        }
        return;
      }

      // type === 'vente'
      const v = data.ventes.find((x) => x.id === id);
      if (!v) return;
      if (cle === 'paiement') { ouvrirMenuPaiement(r, v); return; }

      const fait = etatVente(v, cle) !== 'fait'; // toggle binaire
      const lbl = POST_STEPS.find((s) => s.cle === cle).lbl;
      const appliquer = () => sauverCycle(v, { [`${cle}_date`]: fait ? (v[`${cle}_date`] || aujourdHuiISO()) : null });

      if (!fait) {
        confirmer({
          type: 'warning', title: 'Revenir en arrière ?',
          message: `L'étape « ${lbl} » sera décochée.`,
          buttons: ['Décocher', 'Annuler'], defaultId: 0, cancelId: 1,
        }).then((i) => { if (i === 0) appliquer(); });
      } else if (cle === 'livraison') {
        confirmer({
          type: 'question', title: 'Confirmer la livraison ?',
          message: `La commande « ${v.oeuvre_titre} » sera marquée livrée et déplacée dans « Complétées ».`,
          buttons: ['Confirmer la livraison', 'Annuler'], defaultId: 0, cancelId: 1,
        }).then((i) => { if (i === 0) appliquer(); });
      } else {
        appliquer();
      }
    }));
  }

  // ----- Recherche & onglets -----
  contenu.querySelector('#suivi-recherche').addEventListener('input', (e) => {
    filtre = sansAccents(e.target.value || '');
    peindre();
  });
  [btActif, btComp].forEach((b) => b.addEventListener('click', () => {
    onglet = b.dataset.onglet;
    peindre();
  }));

  peindre();
}
