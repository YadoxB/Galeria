// « Quoi de neuf » — fenêtre de nouveautés montrée UNE fois après une mise à
// jour, aux utilisateurs qui reviennent (pas au tout premier lancement, où le
// tutoriel de bienvenue couvre déjà tout).
//
// Une mise à jour peut en sauter plusieurs : si les parents passent de la
// 0.13.0 à la 0.15.0 sans être passés par la 0.14.0, ils voient les nouveautés
// des DEUX versions, à la suite. C'est pourquoi les diapos sont rangées PAR
// VERSION plutôt qu'en une liste unique.
//
// ⚠ OBLIGATOIRE À CHAQUE VERSION (règle de la galerie, 2026-08-27) :
//    ajouter une entrée EN TÊTE de VERSIONS, avec le numéro de la version
//    publiée et ses diapos. Ne pas supprimer les entrées précédentes : elles
//    servent à ceux qui ont sauté une mise à jour.
//    `npm run release` REFUSE de publier si la version en tête de VERSIONS ne
//    correspond pas à celle de package.json (voir scripts/release.js).

// La plus récente EN PREMIER.
export const VERSIONS = [
  {
    // ⚠ Numéro à ajuster si la version publiée n'est pas la 0.21.0 :
    // `npm run release` refuse de publier si elle ne correspond pas à
    // package.json.
    version: '0.21.0',
    diapos: [
      {
        titre: 'Des cartels qui gaspillent moins de papier',
        texte: "Sauf à dix par page, la feuille de cartels sort maintenant <b>couchée</b> plutôt que debout. Un cartel est large et bas&nbsp;: en couchant la feuille, il ne reste plus de grands vides au-dessus et au-dessous du texte. À six par page, chaque cartel passe de 96 × 85&nbsp;mm à <b>128 × 64&nbsp;mm</b>.",
      },
      {
        titre: 'La vignette suit la taille du texte',
        texte: "La petite image de la toile n'a plus une taille fixe&nbsp;: elle est exactement <b>aussi haute que le texte à côté d'elle</b>. Elle grandit donc sur les grands cartels, rapetisse sur les petits, et se retrouve toujours bien en face du titre.",
      },
      {
        titre: 'Les toiles vendues d’un artiste',
        texte: "L'en-tête d'une fiche d'artiste compte maintenant ses <b>toiles vendues</b>. L'ancienne case « Ventes » devient <b>« Ventes saisies »</b>&nbsp;: elle ne compte que les ventes enregistrées dans Galeria, ce qui n'est pas du tout le même nombre pour un catalogue repris de vos anciens dossiers.",
      },
      {
        titre: 'Un tableau de bord au-dessus des œuvres',
        texte: "La page <b>Œuvres</b> s'ouvre sur une rangée de chiffres&nbsp;: affichées, disponibles, en exposition, vendues, retirées, et la valeur totale. Ils se <b>recalculent à chaque filtre et à chaque recherche</b> — ils décrivent toujours ce que vous avez sous les yeux. La valeur reste masquée tant que vous ne cliquez pas dessus.",
      },
    ],
  },
  {
    version: '0.20.0',
    diapos: [
      {
        titre: 'Des cartels plus lisibles',
        texte: "La photo sur les cartels devient une <b>petite vignette</b> à gauche, juste assez grande pour reconnaître la toile. Le <b>texte reprend toute la place</b> — c'est lui qu'on lit sur un mur.",
      },
      {
        titre: 'Et tous les formats redeviennent possibles',
        texte: "Avec la photo, vous pouviez seulement choisir 2, 4 ou 6 cartels par page. Vous avez maintenant le choix habituel&nbsp;: <b>4, 6, 8 ou 10</b>, avec ou sans photo. Deux fois moins de papier.",
      },
      {
        titre: 'Revoir les nouveautés quand vous voulez',
        texte: "Dans l'aide, une nouvelle catégorie <b>Nouveautés par version</b> garde la trace de tout ce qui a changé, version par version. Un bouton <b>Revoir en grand</b> rejoue cette fenêtre-ci autant de fois que vous le souhaitez.",
      },
      {
        titre: 'Le courriel de signalement s’ouvre enfin',
        texte: "Votre signalement n'ouvrait pas Outlook&nbsp;: le message était trop long pour Windows, et Galeria ne s'en apercevait même pas. Les deux sont réglés.",
      },
    ],
  },
  {
    version: '0.19.1',
    diapos: [
      {
        titre: 'Merci pour le signalement',
        texte: "Votre message sur les cartels nous est bien parvenu — c'était le tout premier. Les <b>deux problèmes</b> qu'il a permis de trouver sont corrigés dans cette mise à jour.",
      },
      {
        titre: 'Les cartels tiennent sur une page',
        texte: "Une page de six cartels avec photo s'imprimait en réalité sur <b>quatre feuilles</b>, ce qui coupait les cartels en deux. C'est réglé : six cartels, une feuille.",
      },
      {
        titre: 'Vos photos vont enfin se ranger',
        texte: "Le rangement des photos par artiste ne s'était jamais fait chez vous : quelques photos d'artistes manquaient sur le disque, et Galeria refusait de continuer. Au <b>prochain démarrage</b>, le rangement aura lieu — les photos manquantes sont simplement laissées de côté.",
      },
    ],
  },
  {
    version: '0.19.0',
    diapos: [
      {
        titre: 'Un bouton pour dire que ça ne marche pas',
        texte: "Le bouton <b>?</b> en bas à droite propose maintenant <b>deux choix</b>&nbsp;: <b>Consulter l'aide</b> quand vous cherchez comment faire quelque chose, et <b>Signaler un problème</b> quand quelque chose ne fonctionne pas.",
      },
      {
        titre: 'Signaler prend une phrase',
        texte: "Vous décrivez ce qui s'est passé en une phrase. Galeria ajoute les informations techniques dont Dave a besoin, <b>vous les montre</b>, puis ouvre un courriel <b>déjà rempli</b>. Il ne vous reste qu'à cliquer sur <b>Envoyer</b>.",
      },
      {
        titre: 'Ce qui ne part jamais',
        texte: "Le signalement ne contient <b>aucun nom de client</b>, <b>aucun montant</b> et <b>aucun mot de passe</b> — seulement des nombres, comme « 12 clients ». Vous pouvez tout lire avant d'envoyer.",
      },
      {
        titre: 'Envoyer votre catalogue à Dave',
        texte: "Dans <b>Réglages → Données</b>, un bouton prépare une <b>copie de votre catalogue</b> pour qu'il puisse reproduire un problème chez lui. <b>Vos clients et vos ventes n'y sont pas</b> — Galeria vous montre la liste de ce qui est retiré avant de la préparer.",
      },
    ],
  },
  {
    version: '0.18.0',
    diapos: [
      {
        titre: 'Vos photos rangées par artiste',
        texte: "Le dossier <b>Photos</b> a été réorganisé : <b>un seul dossier par artiste</b>, contenant <b>Oeuvres</b>, <b>Portraits</b> et <b>Divers</b>. Tout ce qui concerne un artiste est enfin au même endroit.",
      },
      {
        titre: 'La photo suit la toile',
        texte: "Dans <b>Oeuvres</b>, les photos sont classées par statut — <b>disponible</b>, <b>en exposition</b>, <b>vendu</b>, <b>retiré</b>. Et quand vous vendez une toile, <b>sa photo change de dossier toute seule</b>. Plus besoin d'y penser.",
      },
      {
        titre: 'Un dossier « Divers » pour chaque artiste',
        texte: "Déposez-y ce qui n'appartient à aucune œuvre&nbsp;: photos de vernissage, d'atelier, portraits supplémentaires. Le bouton <b>+ Ajouter</b> de la fiche le fait pour vous.",
      },
      {
        titre: 'Une section Photos sur la fiche',
        texte: "La fiche d'un artiste montre maintenant <b>toutes ses photos</b>, groupées comme sur le disque. Vous pouvez <b>copier</b> une image pour la coller dans un courriel, en <b>enregistrer</b> une copie ailleurs, ou <b>ouvrir le dossier</b> d'un clic.",
      },
      {
        titre: 'Rien ne se perd',
        texte: "Le rangement s'est fait <b>une seule fois</b>, après une sauvegarde, en vérifiant chaque fichier copié avant d'effacer l'ancien. Vos <b>539 photos</b> sont toutes là.",
      },
    ],
  },
  {
    version: '0.17.0',
    diapos: [
      {
        titre: 'Vos documents en anglais',
        texte: "Dans le menu <b>Documents</b> d'une fiche d'artiste, une petite bascule <b>FR&nbsp;/&nbsp;EN</b>. Choisissez <b>EN</b> et la <b>présentation</b> ou le <b>catalogue</b> sortent en anglais. Elle revient au français à chaque fois que vous ouvrez le menu.",
      },
      {
        titre: 'La pochette de vente vous demande la langue',
        texte: "Au moment de produire une pochette, Galeria demande maintenant&nbsp;: <b>français ou anglais&nbsp;?</b> La réponse s'applique à <b>tous</b> les documents — lettre, certificat, présentation — et même au nom des fichiers.",
      },
      {
        titre: "Ce qui n'était anglais qu'à moitié",
        texte: "Jusqu'ici, une vente en anglais ne donnait que la lettre en anglais&nbsp;: le certificat et la présentation sortaient en français, et la page de l'œuvre gardait ses lignes françaises sous un titre anglais. C'est réglé.",
      },
      {
        titre: 'Quand un texte anglais manque',
        texte: "Le document sort quand même, avec le texte français à la place — un blanc serait pire. Galeria vous dit ensuite <b>quelles sections</b> étaient concernées, pour que vous puissiez les traduire depuis la fiche de l'artiste.",
      },
    ],
  },
  {
    version: '0.16.0',
    diapos: [
      {
        titre: 'Vos textes anglais, rapatriés du site',
        texte: "Les biographies, démarches et C.V. que votre site affiche déjà en anglais peuvent maintenant entrer dans Galeria. Un bouton <b>« Importer les textes anglais »</b>, dans l'écran de synchronisation, va les chercher tout seul.",
      },
      {
        titre: 'Une bascule FR / EN sur les fiches',
        texte: "Sur la fiche d'un artiste, un petit bouton <b>FR&nbsp;/&nbsp;EN</b> à droite des onglets fait passer le texte d'une langue à l'autre. Même chose pour la <b>description</b> d'une œuvre. Un <b>point doré</b> vous dit qu'une version anglaise existe.",
      },
      {
        titre: 'Traduire ce qui manque',
        texte: "Quand un texte n'existe pas en anglais, Galeria vous propose de le <b>traduire</b> ou de l'<b>écrire à la main</b>. La traduction ne fait que remplir le champ&nbsp;: vous la relisez, et rien n'est conservé tant que vous n'avez pas cliqué sur <b>Enregistrer</b>.",
      },
      {
        titre: 'Vos textes français ne bougent pas',
        texte: "L'importation ne remplit que les cases <b>vides</b> — une traduction que vous avez corrigée n'est jamais écrasée. Et rien ne repart vers le site&nbsp;: ces échanges vont dans un seul sens.",
      },
      {
        titre: "Les numéros d'inventaire en ordre",
        texte: "Le menu <b>Trier par</b> de la liste des œuvres propose maintenant <b>N° d'inventaire</b>. Et les numéros se suivent enfin correctement&nbsp;: <b>CLB565</b> venait avant, après <b>CLB1236</b>. Les catalogues, les annexes et les cartels en profitent aussi.",
      },
      {
        titre: 'Des cartels avec la photo',
        texte: "La fenêtre d'impression des cartels propose <b>d'ajouter la photo de l'œuvre</b>, et de <b>montrer ou non le code QR</b>. Quand la photo est demandée, Galeria n'offre plus que 2, 4 ou 6 cartels par page&nbsp;: à dix, l'image serait trop petite pour se voir.",
      },
      {
        titre: 'Deux détails sur vos documents',
        texte: "La <b>facture à l'artiste</b> montre maintenant la <b>photo de l'œuvre vendue</b>, à gauche du calcul. Et le <b>cadre du certificat</b> a été élargi de 4&nbsp;mm de chaque côté, pour que votre <b>estampe</b> ne morde plus sur le filet rouge.",
      },
      {
        titre: 'Les œuvres parties en exposition',
        texte: "L'en-tête d'une fiche d'artiste compte désormais ses œuvres <b>en exposition</b>, en rouge, à côté des disponibles et des retirées.",
      },
    ],
  },
  {
    version: '0.15.0',
    diapos: [
      {
        titre: 'Préparer une exposition',
        texte: "La grande nouveauté : une section <b>Expositions</b> dans le menu de gauche. Vous créez une exposition, vous <b>cochez les œuvres qui partent</b>, et Galeria s'occupe du reste.",
      },
      {
        titre: 'Les œuvres reviennent comme elles étaient',
        texte: "Les œuvres parties passent au statut <b>En exposition</b>. À la fin, un seul clic sur <b>« Mettre fin à l'exposition »</b> les ramène toutes — chacune retrouve exactement le statut qu'elle avait avant. Une œuvre <b>vendue</b> pendant l'exposition reste vendue.",
      },
      {
        titre: 'Imprimer les cartels',
        texte: "Galeria produit vos <b>cartels</b> en PDF, dix par page, prêts à découper : artiste, titre, médium, dimensions, numéro d'inventaire et un <b>code QR</b> qui mène à la fiche de l'œuvre sur votre site. Une case permet <b>d'afficher ou non le prix</b>.",
      },
      {
        titre: 'Certificats en anglais',
        texte: "La fenêtre de création d'un certificat propose maintenant sa <b>langue</b> : français ou anglais. Tout le document suit — les libellés, la date et le texte d'attestation. La langue est conservée, donc régénérer le certificat plus tard le refait à l'identique.",
      },
      {
        titre: 'Les adresses de votre site',
        texte: "Pour que les codes QR fonctionnent, un bouton <b>« Récupérer les adresses du site »</b> relie chaque œuvre à sa fiche en ligne, d'un seul coup. Il ne demande aucune configuration, et le bouton <b>« Voir sur le site »</b> de vos fiches se met à fonctionner du même coup.",
      },
    ],
  },
  {
    version: '0.14.0',
    diapos: [
      {
        titre: "Le nombre d'œuvres était faux",
        texte: "Le nombre affiché sur la carte d'un artiste comptait aussi les œuvres <b>retirées</b> et <b>vendues</b>. C'est corrigé : c'est désormais le nombre d'<b>œuvres disponibles</b>. Sa fiche indique aussi combien ont été retirées.",
      },
      {
        titre: 'Écrire ce que vous voulez dans les menus',
        texte: "Les champs <b>Style</b>, <b>Type</b> et <b>Support</b> d'une œuvre, et le <b>Type</b> d'un artiste, acceptent maintenant n'importe quelle valeur. Ce que vous tapez revient dans les suggestions la fois suivante.",
      },
      {
        titre: 'Une cote « Hors normes »',
        texte: "Pour une œuvre exceptionnelle, vous pouvez fixer un <b>tarif d'exception</b> : ajoutez une cote de taille <b>Hors normes</b> sur la fiche de l'artiste, puis choisissez <b>Hors normes</b> dans le champ <i>Format</i> de l'œuvre concernée.",
      },
      {
        titre: 'Les C.V. collés depuis le site',
        texte: "Quand vous colliez un C.V. à la main, certaines lignes ressortaient en rouge comme des titres de section. C'est réglé, et les points d'une même année s'alignent maintenant sous elle.",
      },
    ],
  },
];

// Repère enregistré dans la configuration une fois les nouveautés vues.
const VERSION_COURANTE = VERSIONS.length ? VERSIONS[0].version : '0.0.0';

// Comparaison « x.y.z » → -1, 0, 1. Tout ce qui n'a pas cette forme (dont les
// anciens repères comme « sync-web-2026-08 ») est traité comme « rien vu » :
// c'est le bon comportement, on montre alors toutes les nouveautés connues.
function comparerVersions(a, b) {
  const decouper = (v) => String(v == null ? '' : v).split('.').map((n) => parseInt(n, 10));
  const A = decouper(a), B = decouper(b);
  const okA = A.length === 3 && A.every((n) => Number.isFinite(n));
  const okB = B.length === 3 && B.every((n) => Number.isFinite(n));
  if (!okA && !okB) return 0;
  if (!okA) return -1;
  if (!okB) return 1;
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1;
  }
  return 0;
}

// Diapos à montrer à quelqu'un qui en était resté à la version `vue` : toutes
// les versions strictement plus récentes, de la plus ancienne à la plus
// récente — on raconte les choses dans l'ordre où elles sont arrivées.
//
// `jusqua` borne l'autre bout : sert au bouton « Revoir en grand » de l'aide,
// qui rejoue UNE version précise. Sans lui, revoir la 0.17.0 afficherait aussi
// tout ce qui l'a suivie — correct après une mise à jour, absurde quand on
// clique sur un article intitulé « Version 0.17.0 ».
export function construireDiapos(vue, { jusqua = null } = {}) {
  const aMontrer = VERSIONS
    .filter((v) => comparerVersions(vue, v.version) < 0
      && (!jusqua || comparerVersions(v.version, jusqua) <= 0))
    .sort((x, y) => comparerVersions(x.version, y.version));
  if (!aMontrer.length) return [];

  const plusieurs = aMontrer.length > 1;
  const premiere = aMontrer[0].version;
  const derniere = aMontrer[aMontrer.length - 1].version;
  const diapos = [{
    titre: 'Quoi de neuf',
    texte: plusieurs
      ? `Plusieurs mises à jour se sont accumulées : voici les nouveautés des versions <b>${premiere}</b> à <b>${derniere}</b>, dans l'ordre. Vous pourrez tout revoir tranquillement plus tard.`
      : `Voici les principales nouveautés de la version <b>${premiere}</b>. Vous pourrez tout revoir tranquillement plus tard.`,
    intro: true,
  }];
  for (const v of aMontrer) {
    for (const d of v.diapos) {
      // Le numéro de version n'apparaît que s'il y en a plusieurs : sinon
      // c'est du bruit.
      diapos.push(plusieurs ? { ...d, version: v.version } : { ...d });
    }
  }
  diapos.push({
    titre: "C'est tout !",
    texte: "Bonne exploration. En cas de doute, le bouton <b>?</b> en bas à droite répond à presque tout.",
    fin: true,
  });
  return diapos;
}

let racine = null;
let idx = 0;
let DIAPOS = [];

function pointsHtml(i) {
  return `<div class="tuto-points">${DIAPOS.map((_, k) => `<span class="tuto-point ${k === i ? 'actif' : ''}"></span>`).join('')}</div>`;
}

function montrer(i) {
  idx = Math.max(0, Math.min(i, DIAPOS.length - 1));
  const d = DIAPOS[idx];
  const carte = racine.querySelector('.nouv-carte');
  const dernier = idx === DIAPOS.length - 1;
  carte.innerHTML = `
    <div class="nouv-badge">Nouveautés${d.version ? ` &middot; ${d.version}` : ''}</div>
    <h2>${d.titre}</h2>
    <p>${d.texte}</p>
    ${pointsHtml(idx)}
    <div class="nouv-actions">
      ${idx > 0 ? '<button type="button" class="tuto-btn sec" data-prec>Précédent</button>' : '<span></span>'}
      <button type="button" class="tuto-btn pri" data-suiv>${dernier ? 'Terminer' : 'Suivant'}</button>
    </div>`;
  carte.querySelector('[data-suiv]').addEventListener('click', () => { if (dernier) fermer(); else montrer(idx + 1); });
  const p = carte.querySelector('[data-prec]'); if (p) p.addEventListener('click', () => montrer(idx - 1));
}

function fermer() {
  if (!racine) return;
  window.removeEventListener('keydown', onKey);
  racine.remove();
  racine = null;
}
function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); fermer(); } }

// `vue` = la version que l'utilisateur avait déjà vue. Sans argument, on
// montre tout (utile pour revoir les nouveautés depuis un bouton).
export function lancerNouveautes(vue = null, options = {}) {
  if (racine) return;
  DIAPOS = construireDiapos(vue, options);
  if (!DIAPOS.length) return;
  racine = document.createElement('div');
  racine.className = 'overlay-modale nouv-overlay';
  racine.innerHTML = `
    <div class="tuto-carte nouv-carte" role="dialog" aria-modal="true" aria-label="Nouveautés"></div>
    <button type="button" class="nouv-passer" data-passer>Passer</button>`;
  racine.addEventListener('mousedown', (e) => { if (e.target === racine) fermer(); });
  racine.querySelector('[data-passer]').addEventListener('click', fermer);
  window.addEventListener('keydown', onKey);
  document.body.appendChild(racine);
  montrer(0);
}

// Affiché une fois pour les utilisateurs qui reviennent. `premierLancement` =
// première installation (tutoriel de bienvenue) → on marque « vu » sans afficher.
export async function initialiserNouveautes({ premierLancement } = {}) {
  try {
    const cfg = await window.api.configGet();
    if (!cfg) return;
    const vue = cfg.nouveautes_vue_id;
    if (comparerVersions(vue, VERSION_COURANTE) >= 0) return; // déjà à jour
    // On note la version courante AVANT d'afficher : même fermée d'un
    // « Passer », la fenêtre ne revient pas au prochain démarrage.
    await window.api.configSauver({ nouveautes_vue_id: VERSION_COURANTE });
    if (premierLancement) return; // tout est nouveau : le tutoriel suffit
    lancerNouveautes(vue);
  } catch { /* silencieux */ }
}
