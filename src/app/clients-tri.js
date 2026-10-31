// Trier et filtrer les clients : les mêmes outils sur la page Clients et au moment
// de choisir un client dans une vente. Le tri est retenu d'un écran à l'autre ; les
// filtres repartent à zéro, comme sur la page Œuvres.
// Maquette : demos/clients-tri-filtres.html
import {
  ech, sansAccents, pluriel, nomComplet, formaterDate, formaterPrix, gabaritBoutonFiltres,
} from './commun.js';

const CLE_PREF_TRI = 'clients-tri';

function lirePref(cle, defaut) {
  try { return localStorage.getItem(cle) || defaut; } catch { return defaut; }
}
function ecrirePref(cle, val) {
  try { localStorage.setItem(cle, val); } catch {}
}

// ⚠ Copie de l'ordre de src/db/requetes.js (comparerClients) : les deux processus
// ne partagent pas de module. Les modifier ensemble.
const COLLATEUR = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
function comparerTexte(a, b) {
  const x = String(a == null ? '' : a).trim();
  const y = String(b == null ? '' : b).trim();
  // Une fiche sans ce renseignement passe à la fin.
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return COLLATEUR.compare(x, y);
}
const parNom = (a, b) => comparerTexte(a.nom, b.nom) || comparerTexte(a.prenom, b.prenom) || a.id - b.id;
const parDateDesc = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
};
// Un client sans prénom (une entreprise) se lit par son nom : il se classe donc là.
const prenomOuNom = (c) => String(c.prenom || '').trim() || c.nom;

const TRIS = {
  nom:     { libelle: 'Nom A→Z',           cmp: parNom },
  prenom:  { libelle: 'Prénom A→Z',        cmp: (a, b) => comparerTexte(prenomOuNom(a), prenomOuNom(b)) || parNom(a, b) },
  ville:   { libelle: 'Ville A→Z',         cmp: (a, b) => comparerTexte(a.ville, b.ville) || parNom(a, b) },
  achat:   { libelle: 'Dernier achat',     cmp: (a, b) => parDateDesc(a.derniere_vente, b.derniere_vente) || parNom(a, b) },
  montant: { libelle: 'Montant acheté',    cmp: (a, b) => (b.total_achats - a.total_achats) || parNom(a, b) },
  ajout:   { libelle: 'Ajoutés récemment', cmp: (a, b) => parDateDesc(a.cree_le, b.cree_le) || parNom(a, b) },
};

const LIB_COURRIEL = { oui: 'Accepte les courriels', non: "N'a pas accepté" };
const LIB_ACHATS = { oui: 'A déjà acheté', non: 'Aucun achat' };

// Le nom se lit dans l'ordre du tri : « Bouchard, Zoé » ; trié par prénom, « Zoé Bouchard ».
export function nomLigneClient(c, tri) {
  if (tri === 'prenom' || !String(c.prenom || '').trim()) return ech(nomComplet(c));
  return `<span class="nom-famille">${ech(c.nom)}</span>, ${ech(c.prenom)}`;
}

// SQLite écrit cree_le en temps universel : sans ce « Z », un client ajouté en
// soirée serait daté du lendemain.
const dateAjout = (cree) => formaterDate(String(cree).replace(' ', 'T') + 'Z');

// Le renseignement sur lequel on trie apparaît dans la ligne : on comprend l'ordre.
function metaTri(c, tri) {
  if (tri === 'achat') return c.derniere_vente ? `dernier achat le ${formaterDate(c.derniere_vente)}` : 'aucun achat';
  if (tri === 'montant') return c.nb_ventes > 0 ? `${formaterPrix(Math.round(c.total_achats))} achetés` : 'aucun achat';
  if (tri === 'ajout') return `ajouté le ${dateAjout(c.cree_le)}`;
  return '';
}

export function metaLigneClient(c, tri, { avecVentes = false } = {}) {
  return [
    c.courriel ? ech(c.courriel) : '<em>aucun courriel</em>',
    c.telephone && ech(c.telephone),
    c.ville && ech(c.ville),
    ech(metaTri(c, tri)) || (avecVentes && c.nb_ventes > 0 ? pluriel(c.nb_ventes, 'vente') : ''),
  ].filter(Boolean).join('&nbsp;&middot;&nbsp;');
}

function lettreRepere(c, tri) {
  const base = tri === 'prenom' ? prenomOuNom(c) : c.nom;
  const l = sansAccents(base).trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : '#';
}

// Les repères A, B, C n'ont de sens que dans un ordre alphabétique de personnes.
export function lignesAvecReperes(clients, tri, rendreLigne) {
  const avecReperes = tri === 'nom' || tri === 'prenom';
  let precedente = null;
  return clients.map((c) => {
    let repere = '';
    if (avecReperes) {
      const l = lettreRepere(c, tri);
      if (l !== precedente) repere = `<div class="repere-lettre">${l}</div>`;
      precedente = l;
    }
    return repere + rendreLigne(c);
  }).join('');
}

// Regroupe Québec / Quebec / QUÉBEC en un seul choix : on garde l'écriture la plus
// fréquente, à égalité celle qui porte des accents et des minuscules.
function villesDe(clients) {
  const groupes = new Map();
  for (const c of clients) {
    const brute = String(c.ville || '').trim();
    if (!brute) continue;
    const cle = sansAccents(brute);
    if (!groupes.has(cle)) groupes.set(cle, new Map());
    const g = groupes.get(cle);
    g.set(brute, (g.get(brute) || 0) + 1);
  }
  return [...groupes.entries()].map(([cle, g]) => {
    const libelle = [...g.entries()].sort((a, b) => b[1] - a[1]
      || (b[0] !== b[0].toUpperCase()) - (a[0] !== a[0].toUpperCase())
      || b[0].localeCompare(a[0], 'fr'))[0][0];
    return { cle, libelle };
  }).sort((a, b) => comparerTexte(a.libelle, b.libelle));
}

function artistesDe(clients) {
  const parId = new Map();
  for (const c of clients) for (const a of c.artistes) parId.set(String(a.id), a.nom);
  return [...parId.entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => comparerTexte(a.nom, b.nom));
}

export function gabaritOutilsClients() {
  const triRetenu = triInitial();
  return `
    <div class="controles-vue controles-clients">
      <span class="compteur" id="compteur-clients"></span>
      <div class="controles-vue-droite">
        ${gabaritBoutonFiltres('btn-filtres-clients', { avecCompteur: true })}
        <div class="tri-deroulant">
          <label for="tri-clients" class="tri-deroulant-libelle">Trier par</label>
          <select id="tri-clients">
            ${Object.entries(TRIS).map(([k, t]) => `<option value="${k}" ${k === triRetenu ? 'selected' : ''}>${ech(t.libelle)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="filtres-actifs" id="filtres-actifs-clients"></div>
  `;
}

function triInitial() {
  const tri = lirePref(CLE_PREF_TRI, 'nom');
  return TRIS[tri] ? tri : 'nom';
}

// Branche les outils dans `racine`, qui contient gabaritOutilsClients().
// `surChange` redessine la liste : la vue appelle alors appliquer(texte cherché).
// `archives` n'existe que sur la page Clients : une vente exclut toujours les archivés.
export function monterOutilsClients(racine, { clients: clientsDepart, archives = null, surChange }) {
  let clients = clientsDepart;
  const etat = { tri: triInitial(), ville: '', courriel: '', achats: '', artiste: '' };

  const barre = racine.querySelector('.controles-clients');
  const compteur = racine.querySelector('#compteur-clients');
  const btnFiltres = racine.querySelector('#btn-filtres-clients');
  const rangee = racine.querySelector('#filtres-actifs-clients');
  const nbFiltres = btnFiltres.querySelector('.filtres-nb');

  // Dans le formulaire de vente : trier ou filtrer ne modifie pas la vente.
  barre.addEventListener('input', (e) => e.stopPropagation());
  barre.addEventListener('change', (e) => e.stopPropagation());

  racine.querySelector('#tri-clients').addEventListener('change', (e) => {
    etat.tri = e.target.value;
    ecrirePref(CLE_PREF_TRI, etat.tri);
    surChange();
  });

  function filtresActifs() {
    const actifs = [];
    if (etat.ville) {
      const libelle = villesDe(clients).find((g) => g.cle === etat.ville)?.libelle || etat.ville;
      actifs.push({ cle: 'ville', texte: `Ville : ${libelle}` });
    }
    if (etat.courriel) actifs.push({ cle: 'courriel', texte: LIB_COURRIEL[etat.courriel] });
    if (etat.achats) actifs.push({ cle: 'achats', texte: LIB_ACHATS[etat.achats] });
    if (etat.artiste) {
      const nom = artistesDe(clients).find((a) => a.id === etat.artiste)?.nom || '';
      actifs.push({ cle: 'artiste', texte: `A acheté : ${nom}` });
    }
    return actifs;
  }

  // Chaque mot doit se trouver dans la fiche : le nom étant maintenant écrit
  // « Bouchard, Zoé », il doit se retrouver dans les deux sens.
  function correspond(c, mots) {
    if (mots.length) {
      const fiche = sansAccents([c.prenom, c.nom, c.courriel, c.telephone, c.ville].filter(Boolean).join(' '));
      if (!mots.every((m) => fiche.includes(m))) return false;
    }
    if (etat.ville && sansAccents(String(c.ville || '').trim()) !== etat.ville) return false;
    if (etat.courriel && (etat.courriel === 'oui') !== !!c.consentement_courriel) return false;
    if (etat.achats && (etat.achats === 'oui') !== c.nb_ventes > 0) return false;
    if (etat.artiste && !c.artistes.some((a) => String(a.id) === etat.artiste)) return false;
    return true;
  }

  function appliquer(texte = '') {
    const mots = sansAccents(texte).split(/[\s,]+/).filter(Boolean);
    const liste = clients.filter((c) => correspond(c, mots)).sort(TRIS[etat.tri].cmp);
    const actifs = filtresActifs();

    compteur.textContent = liste.length === clients.length
      ? pluriel(clients.length, 'client')
      : `${pluriel(liste.length, 'client')} sur ${clients.length.toLocaleString('fr-CA')}`;
    nbFiltres.textContent = actifs.length || '';
    rangee.innerHTML = actifs.map((a) => `
      <span class="filtre-pastille">${ech(a.texte)}<button type="button" data-enlever="${a.cle}" aria-label="Enlever ce filtre">×</button></span>
    `).join('') + (actifs.length > 1 ? '<button type="button" class="btn-lien" data-tout-effacer>Tout effacer</button>' : '');

    return { liste, tri: etat.tri };
  }

  function effacerFiltres() {
    etat.ville = etat.courriel = etat.achats = etat.artiste = '';
    rafraichirPanneau();
    surChange();
  }

  rangee.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.enlever) {
      etat[b.dataset.enlever] = '';
      rafraichirPanneau();
      surChange();
    } else {
      effacerFiltres();
    }
  });

  // Bouton Filtres → ouvre un panneau déroulant, comme sur la page Œuvres.
  let panneau = null;
  function fermerPanneau() {
    if (!panneau) return;
    panneau.remove();
    panneau = null;
    btnFiltres.classList.remove('ouvert');
    document.removeEventListener('mousedown', surExtClic);
    document.removeEventListener('keydown', surEchap);
  }
  function surExtClic(e) {
    if (panneau && !panneau.contains(e.target) && !btnFiltres.contains(e.target)) fermerPanneau();
  }
  function surEchap(e) { if (e.key === 'Escape') fermerPanneau(); }

  function champFiltre(cle, titre, options) {
    return `
      <div class="groupe-filtre">
        <h4>${ech(titre)}</h4>
        <select id="filtre-client-${cle}" data-filtre="${cle}">
          ${options.map(([val, lib]) => `<option value="${ech(val)}" ${val === etat[cle] ? 'selected' : ''}>${ech(lib)}</option>`).join('')}
        </select>
      </div>
    `;
  }

  function dessinerPanneau() {
    panneau.innerHTML = [
      champFiltre('ville', 'Ville', [['', 'Toutes les villes'], ...villesDe(clients).map((g) => [g.cle, g.libelle])]),
      champFiltre('courriel', 'Courriels', [['', 'Tous'], ['oui', LIB_COURRIEL.oui], ['non', LIB_COURRIEL.non]]),
      champFiltre('achats', 'Achats', [['', 'Tous'], ['oui', LIB_ACHATS.oui], ['non', LIB_ACHATS.non]]),
      champFiltre('artiste', 'Artiste acheté', [['', 'Tous les artistes'], ...artistesDe(clients).map((a) => [a.id, a.nom])]),
      archives ? `
        <div class="groupe-filtre">
          <label class="case-archives">
            <input type="checkbox" id="filtre-client-archives" ${archives.coche ? 'checked' : ''}>
            <span>Inclure les archivés</span>
          </label>
        </div>
      ` : '',
    ].join('');
    panneau.querySelectorAll('[data-filtre]').forEach((sel) => {
      sel.addEventListener('change', () => {
        etat[sel.dataset.filtre] = sel.value;
        surChange();
      });
    });
    panneau.querySelector('#filtre-client-archives')?.addEventListener('change', (e) => {
      archives.coche = e.target.checked;
      archives.surChange(archives.coche);
    });
  }

  function rafraichirPanneau() {
    if (panneau) dessinerPanneau();
  }

  btnFiltres.addEventListener('click', () => {
    if (panneau) { fermerPanneau(); return; }
    btnFiltres.classList.add('ouvert');
    panneau = document.createElement('div');
    panneau.className = 'panneau-filtres';
    dessinerPanneau();
    racine.querySelector('.controles-vue-droite').appendChild(panneau);
    setTimeout(() => {
      document.addEventListener('mousedown', surExtClic);
      document.addEventListener('keydown', surEchap);
    }, 0);
  });

  return {
    appliquer,
    // La liste recharge (case des archivés) : un choix qui n'existe plus ne peut pas
    // rester actif, le menu ne saurait plus le montrer.
    remplacerClients(nouveaux) {
      clients = nouveaux;
      if (etat.ville && !villesDe(clients).some((g) => g.cle === etat.ville)) etat.ville = '';
      if (etat.artiste && !artistesDe(clients).some((a) => a.id === etat.artiste)) etat.artiste = '';
      rafraichirPanneau();
    },
    // Message de liste vide, avec le moyen d'en sortir quand un filtre en est la cause.
    afficherAucun(zone, message) {
      const avecFiltres = filtresActifs().length > 0;
      zone.innerHTML = `<p class="liste-vide">${ech(message)}${avecFiltres ? ' <button type="button" class="btn-lien" id="vide-effacer">Effacer les filtres</button>' : ''}</p>`;
      zone.querySelector('#vide-effacer')?.addEventListener('click', effacerFiltres);
    },
  };
}
