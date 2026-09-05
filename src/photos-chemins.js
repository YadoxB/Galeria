// Où vit la photo d'une œuvre ou d'un artiste — SOURCE UNIQUE de la règle.
//
// Arborescence (depuis 2026-09-04, demande des parents) :
//
//   Photos\
//   └─ <Nom complet de l'artiste>\
//      ├─ Oeuvres\
//      │  ├─ disponible\
//      │  ├─ en exposition\
//      │  ├─ vendu\
//      │  └─ retiré\
//      ├─ Portraits\
//      │  └─ originaux\        (avant recadrage — géré par l'app)
//      └─ Divers\              (déposé à la main : vernissage, atelier…)
//
// Pourquoi c'est important : la méthode de suivi des parents repose sur
// l'EMPLACEMENT des photos. Un fichier rangé dans « vendu\ » est leur façon de
// savoir qu'une toile est vendue. Le classement n'est donc pas décoratif —
// quand le statut d'une œuvre change, sa photo doit suivre.
//
// Avant cette version : Photos\artistes\ (à plat) et Photos\oeuvres\<Artiste>\.
// La migration est dans src/db/migrer-photos.js.

const path = require('node:path');

// Les quatre sous-dossiers de statut. Le libellé est ce que les parents voient
// dans l'Explorateur : au singulier, sans accent en tête, comme ils l'écrivent.
const DOSSIERS_STATUT = ['disponible', 'en exposition', 'vendu', 'retiré'];

// Statut de la base → sous-dossier. « réservé » va dans « disponible » : la
// toile est encore à la galerie, ce que le classement par emplacement doit
// refléter. Un statut inconnu retombe sur « disponible » plutôt que d'inventer
// un dossier.
const STATUT_VERS_DOSSIER = {
  disponible: 'disponible',
  reserve: 'disponible',
  'réservé': 'disponible',
  vendu: 'vendu',
  exposee: 'en exposition',
};

const DOSSIER_OEUVRES = 'Oeuvres';
const DOSSIER_PORTRAITS = 'Portraits';
const DOSSIER_ORIGINAUX = 'originaux';
const DOSSIER_DIVERS = 'Divers';
// Les fichiers qui n'appartiennent plus à aucun artiste (fiche supprimée). On
// ne les efface jamais : c'est à l'utilisateur d'en décider.
const DOSSIER_ORPHELINS = '_non-rattachés';

// Caractères interdits par Windows dans un nom de dossier. On remplace plutôt
// que de retirer, pour que deux artistes différents ne se retrouvent jamais
// dans le même dossier.
const INTERDITS = /[<>:"/\\|?*\x00-\x1f]/g;

// Nom de dossier d'un artiste, à partir de sa fiche. Le nom COMPLET, parce que
// c'est déjà ce que les parents voient dans l'Explorateur.
function dossierArtiste(artiste) {
  if (!artiste) return '';
  const brut = [artiste.prenom, artiste.nom]
    .filter((x) => x && String(x).trim())
    .join(' ')
    .trim();
  return assainirNomDossier(brut);
}

// Windows refuse aussi les points et les espaces en fin de nom, et une poignée
// de noms réservés (CON, PRN, AUX, NUL, COM1…). Un artiste ne s'appellera
// probablement jamais « NUL », mais un dossier impossible à créer casserait la
// migration en silence.
const RESERVES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function assainirNomDossier(nom) {
  let s = String(nom == null ? '' : nom).replace(INTERDITS, '-').trim();
  s = s.replace(/[. ]+$/, '');
  if (!s) return 'Sans nom';
  if (RESERVES.test(s)) s = s + '-';
  return s;
}

function dossierStatut(oeuvre) {
  if (!oeuvre) return 'disponible';
  // Une œuvre retirée (rendue à l'artiste) l'emporte sur son statut : c'est
  // l'archive qui décide, comme partout ailleurs dans l'app.
  if (oeuvre.archive) return 'retiré';
  const s = String(oeuvre.statut || '').toLowerCase();
  return STATUT_VERS_DOSSIER[s] || 'disponible';
}

// --- Chemins RELATIFS au dossier Photos (c'est ce qui est stocké en base) ---

function dossierOeuvres(artiste, statut) {
  return [dossierArtiste(artiste), DOSSIER_OEUVRES, statut].join('/');
}

function cheminOeuvre(artiste, oeuvre, nomFichier) {
  return [dossierOeuvres(artiste, dossierStatut(oeuvre)), nomFichier].join('/');
}

function dossierPortraits(artiste) {
  return [dossierArtiste(artiste), DOSSIER_PORTRAITS].join('/');
}

function cheminPortrait(artiste, nomFichier) {
  return [dossierPortraits(artiste), nomFichier].join('/');
}

function cheminPortraitOriginal(artiste, nomFichier) {
  return [dossierPortraits(artiste), DOSSIER_ORIGINAUX, nomFichier].join('/');
}

function dossierDivers(artiste) {
  return [dossierArtiste(artiste), DOSSIER_DIVERS].join('/');
}

// Tous les sous-dossiers d'un artiste, à créer d'un coup. On les crée TOUS,
// même vides : un dossier « Divers » qui n'apparaît qu'une fois rempli est un
// dossier que personne ne trouve.
function sousDossiersArtiste(artiste) {
  const base = dossierArtiste(artiste);
  return [
    base,
    `${base}/${DOSSIER_OEUVRES}`,
    ...DOSSIERS_STATUT.map((s) => `${base}/${DOSSIER_OEUVRES}/${s}`),
    `${base}/${DOSSIER_PORTRAITS}`,
    `${base}/${DOSSIER_PORTRAITS}/${DOSSIER_ORIGINAUX}`,
    `${base}/${DOSSIER_DIVERS}`,
  ];
}

// Le nom de fichier seul, quel que soit le séparateur du chemin stocké.
function nomFichier(cheminRelatif) {
  return path.basename(String(cheminRelatif || '').replace(/\\/g, '/'));
}

module.exports = {
  DOSSIERS_STATUT,
  DOSSIER_OEUVRES,
  DOSSIER_PORTRAITS,
  DOSSIER_ORIGINAUX,
  DOSSIER_DIVERS,
  DOSSIER_ORPHELINS,
  assainirNomDossier,
  dossierArtiste,
  dossierStatut,
  dossierOeuvres,
  cheminOeuvre,
  dossierPortraits,
  cheminPortrait,
  cheminPortraitOriginal,
  dossierDivers,
  sousDossiersArtiste,
  nomFichier,
};
