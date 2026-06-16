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
};

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
      message: err.message,
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
        <button type="button" class="btn-primaire" id="${ech(idBoutonAjouter)}">${ech(boutonAjouterLibelle)}</button>
      </div>
    </div>
  `;
}

// Bouton Filtres compact, à placer dans la barre des contrôles de vue à côté de Tri.
export function gabaritBoutonFiltres(idBouton = 'btn-filtres') {
  return `
    <button type="button" class="btn-filtres-compact" id="${ech(idBouton)}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="4" y1="6" x2="20" y2="6"/>
        <line x1="7" y1="12" x2="17" y2="12"/>
        <line x1="10" y1="18" x2="14" y2="18"/>
      </svg>
      Filtres
      <svg class="chevron-bas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
  `;
}
