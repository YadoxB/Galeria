export function ech(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sansAccents(s) {
  return (s ?? '').toString().normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}

// Traduit les erreurs techniques courantes (codes système, SQLite) en une
// phrase claire en français. Renvoie null si le message n'est pas un cas connu
// (on garde alors le message d'origine, souvent déjà en français).
function traduireErreurTechnique(msg) {
  const s = String(msg);
  if (/\bEBUSY\b|resource busy or locked|\bEPERM\b|\bEACCES\b|being used by another process/i.test(s)) {
    return "Le fichier est ouvert dans un autre programme (par exemple un PDF dans Acrobat). Ferme-le, puis réessaie.";
  }
  if (/\bENOSPC\b|no space left/i.test(s)) {
    return "Le disque est plein. Libère de l'espace, puis réessaie.";
  }
  if (/\bENOENT\b|no such file|cannot find the (file|path)/i.test(s)) {
    return "Un fichier ou un dossier est introuvable. Il a peut-être été déplacé ou supprimé.";
  }
  if (/SQLITE_BUSY|database is locked/i.test(s)) {
    return "La base de données est occupée un instant. Attends quelques secondes, puis réessaie.";
  }
  if (/SQLITE_CORRUPT|file is not a database|malformed|disk I\/O error/i.test(s)) {
    return "La base de données semble abîmée. Contacte Dave — une sauvegarde peut être restaurée.";
  }
  return null;
}

// Electron préfixe les rejets d'IPC par « Error invoking remote method
// 'canal:methode': Error: <vrai message> ». On retire ce préfixe technique,
// puis on traduit les codes techniques connus, pour n'afficher qu'un message
// clair dans les dialogues.
export function nettoyerErreur(err) {
  const brut = (err && err.message) ? String(err.message) : String(err || 'Erreur inconnue');
  const m = brut.match(/Error invoking remote method '[^']*':\s*(?:Error:\s*)?([\s\S]*)$/);
  const propre = (m ? m[1] : brut).trim();
  return traduireErreurTechnique(propre) || propre || 'Une erreur est survenue.';
}

export function formaterPrix(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function initiales(nom) {
  if (!nom) return '?';
  const mots = nom.trim().split(/\s+/);
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

export const STATUTS = {
  disponible: { libelle: 'Disponible', classe: 'statut-disponible' },
  reserve:    { libelle: 'Réservée',   classe: 'statut-reserve' },
  vendu:      { libelle: 'Vendue',     classe: 'statut-vendu' },
  pretee:     { libelle: 'Prêtée',     classe: 'statut-pretee' },
  exposee:    { libelle: 'En exposition', classe: 'statut-exposee' },
};

// Comparaison avec le site : une œuvre réservée encore en vente là-bas. La
// correction se fait SUR LE SITE (Galeria n'y écrit pas) — même phrase sur la
// page Site web et dans la comparaison lancée depuis la fiche. HTML constant.
export const CONSIGNE_RESERVEE = "Réservée dans Galeria, mais encore en vente sur le site : marquez-la <b>épuisée</b> sur le site le temps de la réservation.";

// ===== Le cycle d'une vente, en deux groupes =====
//
// POUR LE CLIENT : paiement, emballage, envoi, livraison.
// CÔTÉ GALERIE (2026-09-10) : trois tâches qui s'oubliaient, dont deux défont
// ce que la préparation avait fait — créée dans Sage → rendue inactive ;
// publiée sur le site → retirée de la synchronisation Google — et le règlement
// de l'artiste.
//
// Chaque étape se lit et s'écrit dans la colonne `${cle}_date` de la vente
// (sauf le paiement, qui a son propre statut). C'est ce qui permet à la page
// Suivi de les traiter toutes pareil.
//
// Libellés de `google_retire` : « Retirée de Google » jusqu'à la 0.31.0, puis
// « M.A.J. site » à la demande de Joanne (2026-11-25) — la tâche est de mettre
// la fiche du site à jour, pas seulement la synchronisation Google. La clé
// (et la colonne `google_retire_date`) ne change pas. Les changer ici suffit,
// partout dans l'interface (le rapport imprimé a ses propres en-têtes).
// `lbl` dit l'ÉTAT une fois fait ; `afaire` dit la TÂCHE tant qu'elle ne l'est
// pas. Les deux sont nécessaires : « Inactive dans Sage » dans une liste de
// choses à faire se lirait comme déjà fait.
export const ETAPES_GALERIE = [
  { cle: 'sage_inactif', lbl: 'Inactive dans Sage', attente: 'À désactiver',
    afaire: 'à désactiver dans Sage',
    quoi: "Rendre l'article inactif dans l'inventaire de Sage 50" },
  { cle: 'google_retire', lbl: 'M.A.J. site', attente: 'À faire',
    afaire: 'site à mettre à jour',
    quoi: 'Mettre la fiche à jour sur le site (vendue, synchronisation Google retirée)' },
  { cle: 'artiste_paye', lbl: 'Artiste payé', attente: 'À payer',
    afaire: 'artiste à payer',
    quoi: "Le versement de sa part lui a été fait" },
];

export const clientServi = (v) => !!v && v.paiement_statut === 'recu'
  && !!v.emballage_date && !!v.envoi_date && !!v.livraison_date;
export const galerieReglee = (v) => !!v && ETAPES_GALERIE.every((e) => !!v[`${e.cle}_date`]);

// Une vente est TERMINÉE quand le client a tout reçu ET que la galerie a fait
// ses trois tâches — décision de Dave (2026-09-10) : elle reste en suivi tant
// que l'artiste n'est pas payé. ⚠ Pendant côté base : VENTE_EN_COURS_SQL dans
// src/db/requetes.js. Les deux doivent rester d'accord.
export const venteTerminee = (v) => clientServi(v) && galerieReglee(v);

export function badgeStatut(statut) {
  const s = STATUTS[statut] || { libelle: statut || '—', classe: 'statut-defaut' };
  return `<span class="badge-statut ${s.classe}">${ech(s.libelle)}</span>`;
}

export function pluriel(n, singulier, pluriel) {
  return `${n.toLocaleString('fr-CA')} ${n === 1 ? singulier : (pluriel ?? singulier + 's')}`;
}

// ====== Champs de formulaire ======

export function champTexte({ nom, libelle, valeur = '', requis = false, type = 'text', liste, attributs = '' }) {
  const id = `f-${nom}`;
  const valeurAffichee = type === 'tel' ? formaterTelephone(valeur ?? '') : (valeur ?? '');
  return `
    <div class="form-champ">
      <label for="${id}">${ech(libelle)}${requis ? ' <span class="requis">*</span>' : ''}</label>
      <input type="${type}" id="${id}" name="${nom}" value="${ech(valeurAffichee)}"
             ${requis ? 'required' : ''}
             ${liste ? `list="${liste}"` : ''}
             ${attributs}>
    </div>
  `;
}

export function champTextarea({ nom, libelle, valeur = '', lignes = 4 }) {
  const id = `f-${nom}`;
  return `
    <div class="form-champ">
      <label for="${id}">${ech(libelle)}</label>
      <textarea id="${id}" name="${nom}" rows="${lignes}">${ech(valeur ?? '')}</textarea>
    </div>
  `;
}

export function champSelect({ nom, libelle, valeur, options }) {
  const id = `f-${nom}`;
  const opts = options
    .map((o) => `<option value="${ech(o.valeur)}"${o.valeur == valeur ? ' selected' : ''}>${ech(o.libelle)}</option>`)
    .join('');
  return `
    <div class="form-champ">
      <label for="${id}">${ech(libelle)}</label>
      <select id="${id}" name="${nom}">${opts}</select>
    </div>
  `;
}

export function champCheckbox({ nom, libelle, valeur }) {
  const id = `f-${nom}`;
  return `
    <div class="form-champ form-champ-checkbox">
      <input type="checkbox" id="${id}" name="${nom}" ${valeur ? 'checked' : ''}>
      <label for="${id}">${ech(libelle)}</label>
    </div>
  `;
}

export function datalist(id, valeurs) {
  return `<datalist id="${id}">${valeurs.map((v) => `<option value="${ech(v)}">`).join('')}</datalist>`;
}

// ===== Sélecteur de taille des vignettes (vue grille) =====
export const TAILLES_VIGNETTE = { petit: '190px', moyen: '240px', grand: '300px' };

export function gabaritSelecteurTaille(taille = 'moyen') {
  const opt = (v, lbl) => `<button type="button" data-taille="${v}" class="${taille === v ? 'actif' : ''}">${lbl}</button>`;
  return `<div class="taille-vue" role="group" aria-label="Taille des vignettes">${opt('petit', 'Petit')}${opt('moyen', 'Moyen')}${opt('grand', 'Grand')}</div>`;
}

// ===== Champ à valeurs libres + suggestions (brique générique) =====
// Un champ texte que l'on remplit librement, doublé d'une liste dépliante de
// valeurs connues. C'est le composant du Médium, généralisé : il sert aussi au
// Type d'œuvre, au Support, au Style et au Type d'artiste.
//
// Volontairement PAS un <select> : les galeristes doivent pouvoir saisir une
// valeur inédite sans passer par le code. Les valeurs déjà employées dans le
// catalogue reviennent ensuite dans les suggestions (requêtes DISTINCT côté
// base), d'où l'effet « ça s'ajoute tout seul ».
export function champListe({ nom, libelle, valeur = '', placeholder = '', id } = {}) {
  const idAttr = id || `f-${nom}`;
  return `
    <div class="form-champ">
      <label for="${idAttr}">${ech(libelle)}</label>
      <div class="select-edit-wrap" data-liste-wrap="${ech(nom)}">
        <input type="text" id="${idAttr}" name="${nom}" placeholder="${ech(placeholder || libelle)}" value="${ech(valeur ?? '')}" autocomplete="off">
        <button type="button" class="select-edit-toggle" aria-label="Voir les valeurs connues" tabindex="-1">▾</button>
      </div>
    </div>
  `;
}

// Branche la liste dépliante sur un wrap `.select-edit-wrap`.
//   opts.getGroupes() → [{ titre, valeurs }] , recalculé à chaque ouverture
//                       (permet de suivre un artiste qui change).
//   opts.epingle      → valeur épinglée en tête (« Tous » pour les cotes).
//   opts.vide         → texte affiché quand aucune valeur n'est connue.
//   opts.onChange     → rappel après un choix dans la liste.
// Les doublons entre groupes sont retirés : le premier groupe gagne.
export function brancherDropdownListe(wrap, opts = {}) {
  if (!wrap) return;
  const input = wrap.querySelector('input');
  const toggle = wrap.querySelector('.select-edit-toggle');
  if (!input || !toggle) return;
  const norm = (s) => (s || '').toString().normalize('NFD').replace(/\p{Mn}/gu, '').trim().toLowerCase();
  let panneau = null;
  const fermer = () => {
    if (panneau) { panneau.remove(); panneau = null; }
    document.removeEventListener('mousedown', onClicExt);
  };
  const onClicExt = (e) => { if (!wrap.contains(e.target)) fermer(); };
  const ouvrir = () => {
    if (panneau) return;
    const groupes = (opts.getGroupes ? opts.getGroupes() : (opts.groupes || [])) || [];
    const vus = new Set();
    if (opts.epingle) vus.add(norm(opts.epingle));
    let html = opts.epingle
      ? `<button type="button" class="select-edit-option select-edit-option-tous">${ech(opts.epingle)}</button>`
      : '';
    for (const g of groupes) {
      const valeurs = (g?.valeurs || []).filter((v) => {
        const n = norm(v);
        if (!n || vus.has(n)) return false;
        vus.add(n);
        return true;
      });
      if (!valeurs.length) continue;
      if (g.titre) html += `<div class="select-edit-section">${ech(g.titre)}</div>`;
      html += valeurs
        .map((v) => `<button type="button" class="select-edit-option">${ech(v)}</button>`)
        .join('');
    }
    if (!html) html = `<div class="select-edit-section">${ech(opts.vide || 'Aucune valeur connue')}</div>`;
    panneau = document.createElement('div');
    panneau.className = 'select-edit-panel';
    panneau.innerHTML = html;
    wrap.appendChild(panneau);
    panneau.querySelectorAll('.select-edit-option').forEach((b) => {
      b.addEventListener('click', () => {
        input.value = b.textContent;
        fermer();
        input.focus();
        if (opts.onChange) opts.onChange(input.value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    setTimeout(() => document.addEventListener('mousedown', onClicExt), 0);
  };
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (panneau) fermer(); else ouvrir();
  });
}

// Charge les valeurs connues d'un champ : valeurs par défaut + ce qui existe
// déjà au catalogue, dédoublonné et trié. `chargerDb` est une fonction qui
// interroge la base (window.api.*) ; en cas d'échec on garde les défauts.
export async function chargerValeursConnues(defauts, chargerDb) {
  try {
    const enBase = (await chargerDb()) || [];
    const set = new Set([...(defauts || []), ...enBase].filter((v) => v && String(v).trim()));
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
  } catch {
    return [...(defauts || [])];
  }
}

// ===== Médium : champ texte libre + dropdown (même composant que les cotes) =====
export const MEDIUMS_PAR_DEFAUT = ['Acrylique', 'Huile', 'Encaustique', 'Aquarelle', 'Pastel', 'Photographie', 'Mixte'];

// Markup d'un champ médium avec label (pour les formulaires).
export function champMedium({ nom = 'medium', libelle = 'Médium', valeur = '', id, placeholder = 'Médium' } = {}) {
  const idAttr = id || `f-${nom}`;
  return `
    <div class="form-champ">
      <label for="${idAttr}">${ech(libelle)}</label>
      <div class="select-edit-wrap" data-medium-wrap>
        <input type="text" id="${idAttr}" name="${nom}" class="champ-medium-input" placeholder="${ech(placeholder)}" value="${ech(valeur ?? '')}" autocomplete="off">
        <button type="button" class="select-edit-toggle" aria-label="Voir les médiums" tabindex="-1">▾</button>
      </div>
    </div>
  `;
}

// Charge la liste complète des médiums connus (base + valeurs par défaut), triée.
export async function chargerMediumsConnus() {
  try {
    const dbMediums = await window.api.oeuvresMediums();
    const set = new Set([...MEDIUMS_PAR_DEFAUT, ...dbMediums]);
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
  } catch {
    return [...MEDIUMS_PAR_DEFAUT];
  }
}

// Branche le dropdown sur un wrap `.select-edit-wrap[data-medium-wrap]`.
// opts.getMediums() peut renvoyer { mediumsArtiste, mediumsConnus } à chaque
// ouverture (pour refléter un artiste qui change) ; sinon on prend les tableaux
// statiques opts.mediumsArtiste / opts.mediumsConnus.
// inclureTous : épingle « Tous » en tête (utilisé par les cotes).
export function brancherDropdownMedium(wrap, opts = {}) {
  brancherDropdownListe(wrap, {
    epingle: opts.inclureTous ? 'Tous' : '',
    vide: 'Aucun médium connu',
    onChange: opts.onChange,
    getGroupes: () => {
      const src = opts.getMediums ? opts.getMediums() : opts;
      const mediumsArtiste = src.mediumsArtiste || [];
      const mediumsConnus = (src.mediumsConnus || []).filter((m) => (m || '').trim().toLowerCase() !== 'tous');
      return [
        { titre: mediumsArtiste.length ? 'Médiums de cet artiste' : '', valeurs: mediumsArtiste },
        { titre: mediumsArtiste.length ? 'Autres médiums' : 'Médiums', valeurs: mediumsConnus },
      ];
    },
  });
}

export const PROVINCES_CANADA = [
  'Québec', 'Ontario', 'Nouveau-Brunswick', 'Nouvelle-Écosse',
  'Île-du-Prince-Édouard', 'Terre-Neuve-et-Labrador',
  'Manitoba', 'Saskatchewan', 'Alberta', 'Colombie-Britannique',
  'Yukon', 'Territoires du Nord-Ouest', 'Nunavut',
];

export const ETATS_USA = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'Californie',
  'Caroline du Nord', 'Caroline du Sud', 'Colorado', 'Connecticut',
  'Dakota du Nord', 'Dakota du Sud', 'Delaware', 'District de Columbia',
  'Floride', 'Géorgie', 'Hawaï', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiane', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana',
  'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New York',
  'Nouveau-Mexique', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvanie',
  'Rhode Island', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginie', 'Virginie-Occidentale', 'Washington', 'Wisconsin', 'Wyoming',
];

// Canada et États-Unis en tête, le reste alphabétique. Liste large pour
// couvrir la quasi-totalité des cas. Toutes les valeurs en français.
export const PAYS = [
  'Canada', 'États-Unis',
  'Afghanistan', 'Afrique du Sud', 'Albanie', 'Algérie', 'Allemagne',
  'Andorre', 'Angola', 'Antigua-et-Barbuda', 'Arabie saoudite', 'Argentine',
  'Arménie', 'Australie', 'Autriche', 'Azerbaïdjan', 'Bahamas', 'Bahreïn',
  'Bangladesh', 'Barbade', 'Belgique', 'Belize', 'Bénin', 'Bhoutan',
  'Biélorussie', 'Birmanie', 'Bolivie', 'Bosnie-Herzégovine', 'Botswana',
  'Brésil', 'Brunei', 'Bulgarie', 'Burkina Faso', 'Burundi', 'Cambodge',
  'Cameroun', 'Cap-Vert', 'Chili', 'Chine', 'Chypre', 'Colombie', 'Comores',
  'Congo (République démocratique)', 'Congo (République)', 'Corée du Nord',
  'Corée du Sud', 'Costa Rica', "Côte d'Ivoire", 'Croatie', 'Cuba',
  'Danemark', 'Djibouti', 'Dominique', 'Égypte', 'Émirats arabes unis',
  'Équateur', 'Érythrée', 'Espagne', 'Estonie', 'Eswatini', 'Éthiopie',
  'Fidji', 'Finlande', 'France', 'Gabon', 'Gambie', 'Géorgie', 'Ghana',
  'Grèce', 'Grenade', 'Guatemala', 'Guinée', 'Guinée-Bissau',
  'Guinée équatoriale', 'Guyana', 'Haïti', 'Honduras', 'Hongrie',
  'Îles Marshall', 'Îles Salomon', 'Inde', 'Indonésie', 'Irak', 'Iran',
  'Irlande', 'Islande', 'Israël', 'Italie', 'Jamaïque', 'Japon', 'Jordanie',
  'Kazakhstan', 'Kenya', 'Kirghizistan', 'Kiribati', 'Kosovo', 'Koweït',
  'Laos', 'Lesotho', 'Lettonie', 'Liban', 'Libéria', 'Libye',
  'Liechtenstein', 'Lituanie', 'Luxembourg', 'Macédoine du Nord',
  'Madagascar', 'Malaisie', 'Malawi', 'Maldives', 'Mali', 'Malte', 'Maroc',
  'Maurice', 'Mauritanie', 'Mexique', 'Micronésie', 'Moldavie', 'Monaco',
  'Mongolie', 'Monténégro', 'Mozambique', 'Namibie', 'Nauru', 'Népal',
  'Nicaragua', 'Niger', 'Nigéria', 'Norvège', 'Nouvelle-Zélande', 'Oman',
  'Ouganda', 'Ouzbékistan', 'Pakistan', 'Palaos', 'Panama',
  'Papouasie-Nouvelle-Guinée', 'Paraguay', 'Pays-Bas', 'Pérou',
  'Philippines', 'Pologne', 'Portugal', 'Qatar', 'République centrafricaine',
  'République dominicaine', 'République tchèque', 'Roumanie', 'Royaume-Uni',
  'Russie', 'Rwanda', 'Saint-Christophe-et-Niévès', 'Saint-Marin',
  'Saint-Vincent-et-les-Grenadines', 'Sainte-Lucie', 'Salvador', 'Samoa',
  'Sao Tomé-et-Principe', 'Sénégal', 'Serbie', 'Seychelles', 'Sierra Leone',
  'Singapour', 'Slovaquie', 'Slovénie', 'Somalie', 'Soudan', 'Soudan du Sud',
  'Sri Lanka', 'Suède', 'Suisse', 'Suriname', 'Syrie', 'Tadjikistan',
  'Tanzanie', 'Tchad', 'Thaïlande', 'Timor oriental', 'Togo', 'Tonga',
  'Trinité-et-Tobago', 'Tunisie', 'Turkménistan', 'Turquie', 'Tuvalu',
  'Ukraine', 'Uruguay', 'Vanuatu', 'Vatican', 'Venezuela', 'Vietnam',
  'Yémen', 'Zambie', 'Zimbabwe',
];

// Pour un pays donné, quel libellé et quelles options pour la subdivision.
// Si non listé, on tombe sur un champ texte libre avec libellé « Région ».
const SUBDIVISIONS_PAYS = {
  'Canada':      { libelle: 'Province', options: PROVINCES_CANADA, defaut: 'Québec' },
  'États-Unis':  { libelle: 'État',     options: ETATS_USA,        defaut: '' },
};

export function champPays({ nom = 'pays', valeur = '' }) {
  const choisi = (valeur && String(valeur).trim()) || 'Canada';
  // Préserver une valeur héritée qui ne serait pas dans la liste standard.
  const options = PAYS.includes(choisi) ? PAYS : [choisi, ...PAYS];
  const id = `f-${nom}`;
  const opts = options
    .map((p) => `<option value="${ech(p)}"${p === choisi ? ' selected' : ''}>${ech(p)}</option>`)
    .join('');
  return `
    <div class="form-champ">
      <label for="${id}">${ech('Pays')}</label>
      <select id="${id}" name="${nom}">${opts}</select>
    </div>
  `;
}

export function champSubdivision({ nom = 'province', pays = 'Canada', valeur = '' }) {
  const v = (valeur ?? '').toString();
  const sub = SUBDIVISIONS_PAYS[pays];
  const id = `f-${nom}`;
  if (sub) {
    // Menu déroulant fermé
    const choisie = v.trim() || sub.defaut || '';
    const options = sub.options.includes(choisie) || !choisie
      ? sub.options
      : [choisie, ...sub.options];
    const opts = [
      sub.defaut ? '' : `<option value=""${choisie ? '' : ' selected'}>—</option>`,
      ...options.map(
        (p) => `<option value="${ech(p)}"${p === choisie ? ' selected' : ''}>${ech(p)}</option>`
      ),
    ].filter(Boolean).join('');
    return `
      <div class="form-champ">
        <label for="${id}">${ech(sub.libelle)}</label>
        <select id="${id}" name="${nom}">${opts}</select>
      </div>
    `;
  }
  // Pays sans subdivision listée : champ texte libre
  return `
    <div class="form-champ">
      <label for="${id}">${ech('Région')}</label>
      <input type="text" id="${id}" name="${nom}" value="${ech(v)}">
    </div>
  `;
}

// Câble le rerendu du champ subdivision lorsque le pays change.
// Doit être appelé après que le HTML est inséré.
export function brancherChangementPays(form, { paysNom = 'pays', subNom = 'province', subZoneId } = {}) {
  if (!form || !subZoneId) return;
  const paysSel = form.querySelector(`[name="${paysNom}"]`);
  const zone = form.querySelector(`#${subZoneId}`);
  if (!paysSel || !zone) return;
  paysSel.addEventListener('change', () => {
    zone.innerHTML = champSubdivision({ nom: subNom, pays: paysSel.value, valeur: '' });
  });
}

export function parserNumerosTaxes(s) {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.filter((x) => x && x.numero) : [];
  } catch {
    return [];
  }
}

export function urlPhoto(cheminRelatif) {
  if (!cheminRelatif) return '';
  const segments = cheminRelatif.split('/').map(encodeURIComponent).join('/');
  return `galerie://photos/${segments}`;
}

export function formaterTelephone(s) {
  const digits = String(s ?? '').replace(/\D/g, '').slice(0, 10);
  const n = digits.length;
  if (n === 0) return '';
  if (n <= 3) return `(${digits}`;
  if (n <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function nomComplet(c) {
  const parts = [c?.prenom, c?.nom].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(' ') : (c?.nom || '');
}

// Repère un champ numérique dont la saisie est illisible : le navigateur laisse
// alors `value` vide (le nombre serait effacé en silence à l'enregistrement).
// Cas typique : « 1 234,56 » collé depuis Excel. Renvoie le premier champ
// fautif (pour message + focus), ou null si tout est bon.
export function champNombreInvalide(form) {
  for (const inp of form.querySelectorAll('input[type="number"]')) {
    if (inp.validity && inp.validity.badInput) return inp;
  }
  return null;
}

// Emballe un gestionnaire de soumission pour empêcher la double-soumission
// (double-clic, double Entrée) : les soumissions concurrentes sont ignorées et
// le bouton d'envoi est désactivé pendant tout le traitement asynchrone.
export function soumissionUnique(handler) {
  let enCours = false;
  return async (e) => {
    if (enCours) { e.preventDefault(); return; }
    enCours = true;
    const btn = e.submitter || (e.target && e.target.querySelector && e.target.querySelector('button[type="submit"]'));
    if (btn) btn.disabled = true;
    try {
      await handler(e);
    } finally {
      enCours = false;
      if (btn) btn.disabled = false;
    }
  };
}

// ====== Archivage ======

const ETIQUETTES_ARCHIVE = {
  artistes: { article: "cet", nom: "artiste", message: "L'artiste n'apparaîtra plus dans les listes ni les sélecteurs, mais ses œuvres et l'historique sont conservés." },
  oeuvres:  { article: "cette", nom: "œuvre", message: "L'œuvre n'apparaîtra plus dans les listes ni dans le sélecteur d'œuvres lors d'une nouvelle vente." },
  clients:  { article: "ce", nom: "client", message: "Le client n'apparaîtra plus dans les listes ni dans le sélecteur lors d'une nouvelle vente. Son historique de ventes reste consultable." },
};

export function badgeArchive() {
  return '<span class="badge-archive">Archivée</span>';
}

export function boutonArchive({ archive }) {
  const libelle = archive ? 'Désarchiver' : 'Archiver';
  return `<button class="btn-action" id="btn-archiver">${libelle}</button>`;
}

// ===== Boutons d'en-tête de fiche : hiérarchie (2026-11-27) =====
//
// Règle choisie par Dave (demos/artiste-actions.html, variante B) : UN bouton
// principal ; les gestes occasionnels en boutons discrets (icône + mot) ; les
// gestes rares et graves (archiver, supprimer) rangés dans « ⋯ », Supprimer en
// rouge et en dernier. Une fiche archivée garde « Désarchiver » dans la barre.

export const ICO_DOCUMENT = '<svg class="ico-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
export const ICO_SITE = '<svg class="ico-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
export const ICO_MODIFIER = '<svg class="ico-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
export const ICO_RESERVER = '<svg class="ico-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
const ICO_PLUS = '<svg class="ico-btn" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';

// Une entrée de menu : un libellé, et dessous ce que fait le geste.
export function entreeMenu({ id, libelle, aide, danger = false }) {
  return `<button type="button" role="menuitem" id="${id}"${danger ? ' class="menu-danger"' : ''}>${ech(libelle)}${aide ? `<small>${ech(aide)}</small>` : ''}</button>`;
}

// Le bouton « ⋯ » et son menu. `entrees` : HTML d'entrées (entreeMenu),
// séparées au besoin par <div class="menu-docs-sep"></div>.
export function menuPlus(entrees) {
  return `<div class="menu-docs" id="menu-plus">
      <button class="btn-action btn-discret btn-plus" id="btn-menu-plus" aria-haspopup="menu" aria-expanded="false" title="Plus d'actions" aria-label="Plus d'actions">${ICO_PLUS}</button>
      <div class="menu-docs-pop" id="menu-plus-pop" role="menu" hidden>${entrees}</div>
    </div>`;
}

// Menus déroulants d'un en-tête : ouverture, fermeture, accessibilité. Un seul
// ouvert à la fois dans un même groupe. Usage :
//   const brancherMenu = groupeMenus(contenu);
//   brancherMenu(bouton, pop, { aLOuverture });
// Les écouteurs sont posés sur `contenu`, donc retirés avec la vue.
export function groupeMenus(contenu) {
  const fermetures = [];
  return function brancherMenu(menuBtn, menuPop, { aLOuverture } = {}) {
    if (!menuBtn || !menuPop) return;
    const fermerMenu = () => {
      menuPop.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    fermetures.push(fermerMenu);
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ouvert = !menuPop.hidden;
      fermetures.forEach((f) => f());
      if (ouvert) return;
      menuPop.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      if (aLOuverture) aLOuverture();
      // Le premier élément de MENU, pas le premier bouton — une bascule de
      // réglage en tête de menu (langue des documents) ne prend pas le focus.
      const premier = menuPop.querySelector('[role="menuitem"]');
      if (premier) premier.focus();
    });
    // Un clic sur une entrée déclenche son propre handler, puis referme. Une
    // bascule de réglage (.bascule-langue) n'est pas une entrée : elle ne
    // ferme rien, sinon on ne pourrait jamais la changer.
    menuPop.addEventListener('click', (e) => {
      if (e.target.closest('.bascule-langue')) return;
      if (e.target.closest('button')) fermerMenu();
    });
    contenu.addEventListener('click', () => { if (!menuPop.hidden) fermerMenu(); });
    contenu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menuPop.hidden) { fermerMenu(); menuBtn.focus(); }
    });
  };
}

export async function basculerArchive({ table, fiche, libelleFiche, confirmer, surFait }) {
  const meta = ETIQUETTES_ARCHIVE[table] || { article: '', nom: 'fiche', message: '' };
  const versArchive = !fiche.archive;
  if (versArchive) {
    const reponse = await confirmer({
      type: 'question',
      title: `Archiver ${meta.article} ${meta.nom} ?`,
      message: `Archiver « ${libelleFiche} » ?`,
      detail: meta.message + ' Tu pourras le retrouver en cochant « Inclure les archivés » dans les filtres.',
      buttons: ['Archiver', 'Annuler'],
      defaultId: 0,
      cancelId: 1,
    });
    if (reponse !== 0) return false;
  }
  try {
    await window.api.ficheArchiver(table, fiche.id, versArchive);
    fiche.archive = versArchive ? 1 : 0;
    if (surFait) surFait(fiche.archive);
    return true;
  } catch (err) {
    await confirmer({
      type: 'error',
      title: 'Action impossible',
      message: nettoyerErreur(err),
      buttons: ['OK'],
    });
    return false;
  }
}

export function formaterDate(s) {
  if (!s) return '—';
  const t = String(s).trim();
  if (!t) return '—';
  const d = new Date(t.length === 10 ? t + 'T00:00:00' : t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

// En-tête de page commun aux 4 vues de listes : titre + recherche + bouton Ajouter.
// Le bouton Filtres (s'il existe) est placé séparément dans la barre des contrôles de vue.
export function gabaritEntetePage(options) {
  const {
    titre,
    placeholder = 'Rechercher…',
    boutonAjouterLibelle = '+ Ajouter',
    idRecherche = 'recherche',
    idBoutonAjouter = 'btn-ajouter',
    boutonSecondaireLibelle = null,
    idBoutonSecondaire = 'btn-ajouter-multiple',
  } = options;
  return `
    <div class="entete-page">
      <h2 class="entete-page-titre">${ech(titre)}</h2>
      <div class="entete-page-recherche-wrap">
        <div class="recherche-pillule">
          <svg class="recherche-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.5" y2="16.5"/>
          </svg>
          <input type="search" id="${ech(idRecherche)}" placeholder="${ech(placeholder)}" autocomplete="off">
        </div>
      </div>
      <div class="entete-page-actions">
        ${boutonSecondaireLibelle ? `<button type="button" class="btn-action btn-secondaire-action" id="${ech(idBoutonSecondaire)}">${ech(boutonSecondaireLibelle)}</button>` : ''}
        <button type="button" class="btn-primaire" id="${ech(idBoutonAjouter)}">${ech(boutonAjouterLibelle)}</button>
      </div>
    </div>
  `;
}

// Bouton Filtres compact, à placer dans la barre des contrôles de vue à côté de Tri.
export function gabaritBoutonFiltres(idBouton = 'btn-filtres', { avecCompteur = false } = {}) {
  return `
    <button type="button" class="btn-filtres-compact" id="${ech(idBouton)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="4" y1="6" x2="20" y2="6"/>
        <line x1="7" y1="12" x2="17" y2="12"/>
        <line x1="10" y1="18" x2="14" y2="18"/>
      </svg>
      Filtres
      ${avecCompteur ? '<span class="filtres-nb"></span>' : ''}
      <svg class="chevron-bas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
  `;
}
