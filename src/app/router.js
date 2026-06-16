import { majActionsEntete } from './marque.js';

const vues = new Map();
let pile = [];
let gardien = null;

export function enregistrer(nom, fonction) {
  vues.set(nom, fonction);
}

export function poserGardien(fn) {
  gardien = fn;
}

export function leverGardien() {
  gardien = null;
}

export function modifierParamsCourants(params) {
  if (pile.length > 0) {
    pile[pile.length - 1].params = { ...pile[pile.length - 1].params, ...params };
  }
}

export async function remplacerCourant(nom, params = {}) {
  if (!(await peutQuitter())) return;
  const fn = vues.get(nom);
  if (!fn) return;
  if (pile.length === 0) {
    pile.push({ nom, params });
  } else {
    pile[pile.length - 1] = { nom, params };
  }
  await rendre(fn, params);
  majBoutonRetour();
}

async function peutQuitter() {
  if (!gardien) return true;
  const ok = await gardien();
  if (ok) gardien = null;
  return ok;
}

export async function naviguer(nom, params = {}) {
  if (!(await peutQuitter())) return;
  const fn = vues.get(nom);
  if (!fn) {
    console.error(`Vue inconnue : ${nom}`);
    return;
  }
  pile.push({ nom, params });
  await rendre(fn, params);
  majBoutonRetour();
}

export async function remplacer(nom, params = {}) {
  if (!(await peutQuitter())) return;
  const fn = vues.get(nom);
  if (!fn) return;
  pile = [{ nom, params }];
  await rendre(fn, params);
  majBoutonRetour();
}

export async function retour() {
  if (pile.length <= 1) return;
  if (!(await peutQuitter())) return;
  pile.pop();
  const { nom, params } = pile[pile.length - 1];
  const fn = vues.get(nom);
  await rendre(fn, params);
  majBoutonRetour();
}

async function rendre(fn, params) {
  const contenu = document.getElementById('contenu');
  contenu.innerHTML = '<p class="chargement">Chargement…</p>';
  try {
    await fn(contenu, params);
    contenu.scrollTop = 0;
  } catch (err) {
    contenu.innerHTML = `<p class="erreur">Erreur d'affichage : ${err.message}</p>`;
    console.error(err);
  }
  const nomCourant = pile.length > 0 ? pile[pile.length - 1].nom : '';
  majActionsEntete(nomCourant);
}

function majBoutonRetour() {
  const btn = document.getElementById('btn-retour');
  btn.style.visibility = pile.length > 1 ? 'visible' : 'hidden';
}
