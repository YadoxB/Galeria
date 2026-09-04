// Traduction assistée vers l'anglais, pour les champs bilingues du catalogue
// (présentation d'artiste, description d'œuvre).
//
// Deux règles, les mêmes que du côté de l'importation depuis le site :
//   — la traduction PROPOSE, elle n'enregistre rien. Le texte arrive dans le
//     champ, l'utilisateur le relit et c'est lui qui enregistre.
//   — un texte anglais déjà écrit n'est jamais remplacé sans confirmation :
//     ce serait perdre une relecture humaine au profit d'une machine.
//
// Rien ne part vers le site : l'appel va à Claude, et la réponse revient dans
// le formulaire.

import { confirmer, alerter } from './dialogue.js';
import { naviguer } from './router.js';
import { nettoyerErreur } from './commun.js';

// Branche un bouton « Traduire » sur un couple de champs.
//   bouton   : l'élément à brancher.
//   source   : () => texte français (chaîne).
//   cible    : () => l'élément de saisie anglais à remplir.
//   champ    : 'biographie' | 'demarche' | 'curriculum' | 'citation' | 'description'
//              — sert à donner le ton de la traduction.
//   contexte : nom de l'artiste ou de l'œuvre, pour lever les ambiguïtés.
//   onRempli : appelé après un remplissage réussi (marquer « modifié »).
export function brancherTraduction({ bouton, source, cible, champ, contexte, onRempli }) {
  if (!bouton) return;
  bouton.addEventListener('click', async () => {
    const texte = (source() || '').trim();
    if (!texte) {
      await alerter({
        type: 'info',
        title: 'Rien à traduire',
        message: "Le texte français est vide : il n'y a rien à traduire.",
        detail: "Écris d'abord la version française, ou saisis l'anglais à la main.",
      });
      return;
    }
    const champCible = cible();
    if (champCible && champCible.value && champCible.value.trim()) {
      const c = await confirmer({
        type: 'warning',
        title: 'Remplacer le texte anglais ?',
        message: "Ce champ contient déjà un texte anglais, peut-être relu et corrigé.",
        detail: 'La traduction le remplacerait entièrement.',
        buttons: ['Remplacer', 'Annuler'],
        defaultId: 1, cancelId: 1,
      });
      if (c !== 0) return;
    }
    const libelle = bouton.innerHTML;
    bouton.disabled = true;
    bouton.innerHTML = '<span class="ia-icone" aria-hidden="true">⏳</span> Traduction…';
    try {
      const r = await window.api.iaTraduire({ champ, texte, contexte });
      if (r && r.texte && champCible) {
        champCible.value = r.texte;
        champCible.dispatchEvent(new Event('input', { bubbles: true }));
        champCible.focus();
        if (typeof onRempli === 'function') onRempli();
      }
    } catch (err) {
      const sansCle = (err && err.code === 'NO_KEY') || /clé API|Aucune clé/i.test(err?.message || '');
      if (sansCle) {
        const c = await confirmer({
          type: 'info',
          title: 'Clé API non configurée',
          message: 'Pour traduire automatiquement, ajoute ta clé Anthropic dans Réglages → IA.',
          detail: 'La fonction est optionnelle — tu peux toujours écrire la version anglaise à la main.',
          buttons: ['Ouvrir les Réglages', 'Fermer'],
          defaultId: 0, cancelId: 1,
        });
        if (c === 0) naviguer('reglages');
      } else {
        await alerter({
          type: 'error',
          title: 'Traduction échouée',
          message: nettoyerErreur(err),
        });
      }
    } finally {
      bouton.disabled = false;
      bouton.innerHTML = libelle;
    }
  });
}
