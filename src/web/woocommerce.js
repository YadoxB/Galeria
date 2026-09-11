// Accès à la boutique WooCommerce du site (API REST officielle).
//
// PROCESSUS PRINCIPAL UNIQUEMENT. Les clés (consumer key/secret) sont fournies
// par l'appelant, déchiffrées depuis le coffre Windows au dernier moment — elles
// ne transitent jamais par l'interface ni ne sont écrites en clair.
//
// Lot 0 : uniquement des lectures (GET). Aucune écriture. On ne peut donc rien
// modifier sur le site depuis ce module. Le sens « pousser » viendra plus tard,
// dans un module séparé, avec prévisualisation et confirmation.
//
// Auth : WooCommerce accepte l'authentification « Basic » (clé:secret) sur HTTPS.
// On utilise le `fetch` intégré de Node (pas `net.fetch`), comme pour les taux de
// change. Un délai maximal protège contre un site qui ne répond pas.

const DELAI_MS = 15000;

// Normalise l'adresse du site : force https, retire les barres et suffixes
// courants collés par erreur (/boutique, /wp-admin, /wp-json…).
function normaliserUrl(u) {
  let s = String(u == null ? '' : u).trim();
  if (!s) throw new Error('Adresse du site vide.');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  s = s.replace(/\/+$/, '');
  s = s.replace(/\/(wp-json|wp-admin|boutique|shop)(\/.*)?$/i, '');
  return s.replace(/\/+$/, '');
}

// GET JSON avec délai maximal et messages d'erreur clairs (en français).
async function getJson(url, { auth } = {}) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS);
  const entetes = { Accept: 'application/json' };
  if (auth) entetes.Authorization = auth;
  let resp;
  try {
    resp = await fetch(url, { headers: entetes, signal: ctrl.signal, redirect: 'follow' });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error("Le site n'a pas répondu à temps (15 s). Vérifie l'adresse du site et ta connexion Internet.");
    }
    throw new Error(`Site injoignable : ${err && err.message ? err.message : 'erreur réseau'}. Vérifie l'adresse du site.`);
  } finally {
    clearTimeout(minuteur);
  }
  return resp;
}

// Vérifie que la connexion et les clés fonctionnent, en LECTURE SEULE.
// Retourne { ok, boutique, produits } ou lève une erreur au message clair.
async function testerConnexion({ url, consumerKey, consumerSecret }) {
  const base = normaliserUrl(url);
  const ck = String(consumerKey == null ? '' : consumerKey).trim();
  const cs = String(consumerSecret == null ? '' : consumerSecret).trim();
  if (!ck || !cs) throw new Error('Clé et secret requis pour tester la connexion.');
  const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64');

  // Un GET minimal sur les produits : valide l'adresse, l'API et les clés d'un coup.
  const endpoint = `${base}/wp-json/wc/v3/products?per_page=1&_fields=id`;
  const resp = await getJson(endpoint, { auth });

  if (resp.status === 401 || resp.status === 403) {
    throw new Error('Clés refusées par le site (identifiants invalides ou permissions insuffisantes). Vérifie la clé et le secret.');
  }
  if (resp.status === 404) {
    throw new Error("L'API WooCommerce est introuvable à cette adresse. Vérifie que c'est bien l'adresse du site WordPress et que WooCommerce y est activé.");
  }
  if (!resp.ok) {
    throw new Error(`Le site a répondu par une erreur (${resp.status}). Réessaie plus tard ou vérifie l'adresse.`);
  }
  const ctype = resp.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    throw new Error("La réponse du site n'est pas au format attendu. L'API REST n'est peut-être pas active à cette adresse.");
  }
  // On consomme le corps pour libérer la connexion (on n'a besoin que de l'en-tête).
  try { await resp.json(); } catch {}

  const total = Number(resp.headers.get('x-wp-total'));
  const produits = Number.isFinite(total) ? total : null;

  // Nom de la boutique : lu sur la racine publique /wp-json (sans clés). Facultatif.
  let boutique = '';
  try {
    const root = await getJson(`${base}/wp-json`);
    if (root.ok) {
      const j = await root.json();
      boutique = (j && j.name) ? String(j.name) : '';
    }
  } catch { /* facultatif : on n'échoue pas le test pour ça */ }

  return { ok: true, boutique, produits };
}

// Point de code → caractère, avec garde contre les valeurs invalides.
function cp(n) {
  try { return (Number.isFinite(n) && n > 0) ? String.fromCodePoint(n) : ''; }
  catch { return ''; }
}

// Entités nommées courantes (WooCommerce émet surtout du numérique + &nbsp;/&amp;,
// mais on couvre les nommées fréquentes par sécurité).
const ENTITES_NOMMEES = {
  nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>',
  laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', hellip: '…', mdash: '—', ndash: '–',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', auml: 'ä', ccedil: 'ç',
  igrave: 'ì', icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü', ntilde: 'ñ',
  deg: '°', euro: '€', copy: '©', reg: '®', trade: '™',
};

// Décode les entités HTML : numériques décimales (&#233;), hexadécimales
// (&#xE9;) et nommées. &amp; en dernier pour éviter un double décodage.
function decodeEntites(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, nom) => {
      const k = nom.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITES_NOMMEES, k) ? ENTITES_NOMMEES[k] : m;
    })
    .replace(/&amp;/gi, '&');
}

// Convertit un tableau HTML (ex. C.V. à deux colonnes année/description) en texte
// lisible : une ligne par rangée, cellules jointes par « — ». Appelé AVANT le
// retrait des balises pour préserver la structure des colonnes.
function tableauEnTexte(tableHtml) {
  const lignes = [...String(tableHtml).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((mr) => {
    const cellules = [...mr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((mc) => mc[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return cellules.join(' — ');
  }).filter(Boolean);
  return lignes.join('\n');
}

// Convertit le HTML d'une description WooCommerce en texte lisible : retire les
// balises, décode les entités, normalise les espaces. Sert à la fois à
// l'affichage et à la valeur importée (l'app stocke du texte simple).
function stripHtml(html) {
  let s = String(html == null ? '' : html);
  // Tableaux (C.V.) : convertis en lignes « année — description » avant tout.
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (bloc) => '\n' + tableauEnTexte(bloc) + '\n');
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n')
       .replace(/<\s*h[1-6][^>]*>/gi, '\n')
       .replace(/<\/\s*(p|h[1-6]|div|tr)\s*>/gi, '\n')
       .replace(/<\s*li[^>]*>/gi, '\n• ')
       .replace(/<\/\s*li\s*>/gi, '');
  s = s.replace(/<[^>]*>/g, '');
  s = decodeEntites(s);
  // Espaces : on garde les sauts de ligne mais on nettoie le reste.
  s = s.replace(/[ \t ]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// Champs demandés à l'API REST (v3) pour un produit, et leur mise en forme.
const CHAMPS_PRODUIT_V3 = 'id,sku,name,description,short_description,price,regular_price,stock_status,status,images,permalink,categories';
function normaliserProduitV3(p) {
  const prixBrut = (p.regular_price || p.price || '').toString().trim();
  const prix = prixBrut === '' ? null : Number(prixBrut);
  return {
    id: p.id,
    sku: (p.sku || '').trim(),
    name: p.name || '',
    description: stripHtml(p.description || p.short_description || ''),
    prix: Number.isFinite(prix) ? prix : null,
    stock_status: p.stock_status || '',
    status: p.status || '',
    image: (Array.isArray(p.images) && p.images[0] && p.images[0].src) ? p.images[0].src : '',
    // Sur ce site, la catégorie d'un produit est son artiste (vrai pour 22
    // artistes sur 23 au 2026-09-11). Sert à comparer UN artiste.
    categories: Array.isArray(p.categories)
      ? p.categories.map((c) => ({ id: c.id, name: decodeEntites(c.name || '') }))
      : [],
  };
}

function authBasique({ consumerKey, consumerSecret }) {
  const ck = String(consumerKey == null ? '' : consumerKey).trim();
  const cs = String(consumerSecret == null ? '' : consumerSecret).trim();
  if (!ck || !cs) throw new Error('Clé et secret requis.');
  return 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64');
}

// Nombre de SKU par requête quand on lit une liste de SKU : l'API les accepte
// séparés par des virgules, mais l'adresse doit rester de longueur raisonnable.
const PAQUET_SKU = 40;

// Découpe une lecture en requêtes : toute la boutique, une catégorie, ou une
// liste de SKU (par paquets). Rend les fragments de requête à ajouter.
function requetesFiltre(filtre = {}) {
  if (Array.isArray(filtre.skus)) {
    const skus = [...new Set(filtre.skus.map((s) => String(s == null ? '' : s).trim()).filter(Boolean))];
    const r = [];
    for (let i = 0; i < skus.length; i += PAQUET_SKU) {
      r.push(`&sku=${encodeURIComponent(skus.slice(i, i + PAQUET_SKU).join(','))}`);
    }
    return r;                              // liste vide → aucune requête
  }
  if (filtre.category) return [`&category=${encodeURIComponent(filtre.category)}`];
  return [''];
}

// Récupère les produits de la boutique (lecture seule, paginé). Retourne des
// fiches normalisées. N'écrit jamais rien sur le site.
// `filtre` restreint la lecture, pour comparer un seul artiste :
//   { category: id } → les produits d'une catégorie ;
//   { skus: [...] }  → les produits portant ces SKU.
// Sans filtre : TOUTE la boutique.
async function listerProduits(creds, filtre = {}) {
  const base = normaliserUrl(creds.url);
  const auth = authBasique(creds);
  const produits = [];
  for (const q of requetesFiltre(filtre)) {
    const MAX_PAGES = 50; // garde-fou (5000 produits max) contre une boucle infinie.
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url2 = `${base}/wp-json/wc/v3/products?per_page=100&page=${page}${q}&_fields=${encodeURIComponent(CHAMPS_PRODUIT_V3)}`;
      const resp = await getJson(url2, { auth });
      if (resp.status === 401 || resp.status === 403) {
        throw new Error('Clés refusées par le site (identifiants invalides ou permissions insuffisantes).');
      }
      if (resp.status === 404) {
        throw new Error("L'API WooCommerce est introuvable à cette adresse.");
      }
      if (!resp.ok) {
        throw new Error(`Le site a répondu par une erreur (${resp.status}).`);
      }
      let lot;
      try { lot = await resp.json(); } catch { throw new Error("Réponse du site illisible (format inattendu)."); }
      if (!Array.isArray(lot) || !lot.length) break;
      for (const p of lot) produits.push(normaliserProduitV3(p));
      const totalPages = Number(resp.headers.get('x-wp-totalpages'));
      if (Number.isFinite(totalPages) && page >= totalPages) break;
      if (lot.length < 100) break;
    }
  }
  return produits;
}

// Catégories de produits de la boutique (id, nom, nombre de produits).
async function listerCategoriesProduits(creds) {
  const base = normaliserUrl(creds.url);
  const auth = authBasique(creds);
  const cats = [];
  for (let page = 1; page <= 10; page++) {
    const resp = await getJson(`${base}/wp-json/wc/v3/products/categories?per_page=100&page=${page}&_fields=id,name,count`, { auth });
    if (!resp.ok) throw new Error(`Le site a répondu par une erreur (${resp.status}) en lisant les catégories.`);
    let lot;
    try { lot = await resp.json(); } catch { throw new Error('Réponse du site illisible (catégories).'); }
    if (!Array.isArray(lot) || !lot.length) break;
    for (const c of lot) cats.push({ id: c.id, name: decodeEntites(c.name || ''), count: c.count || 0 });
    if (lot.length < 100) break;
  }
  return cats;
}

// Normalise un titre de section (retire balises/entités, minuscule, sans point final).
function normTitreSection(t) {
  return String(t == null ? '' : t)
    .replace(/<[^>]+>/g, '').replace(/&[a-z0-9#]+;/gi, ' ')
    .toLowerCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim();
}

// Découpe le contenu d'un artiste (HTML structuré par des titres <h2> :
// « Biographie », « Démarche », « C.V. » + sous-sections) en trois champs qui
// correspondent à ceux de l'app. Le curriculum = tout depuis le titre « C.V. »
// jusqu'à la fin (Formation, Expositions, etc. y sont inclus). Chaque champ est
// pris SANS son titre, pour coller au contenu des champs de l'app.
function decouperSectionsArtiste(html) {
  const s = String(html == null ? '' : html);
  const re = /<(h[1-6])[^>]*>(.*?)<\/\1>/gis;
  const heads = [];
  let m;
  while ((m = re.exec(s))) heads.push({ titre: normTitreSection(m[2]), contentStart: re.lastIndex, headStart: m.index });
  const corps = (i) => s.slice(heads[i].contentStart, i + 1 < heads.length ? heads[i + 1].headStart : s.length);
  // Titres français ET anglais : le site est bilingue (WPML). Les intitulés
  // anglais relevés sur les 21 fiches sont « Biography », « Artist's statement »
  // (casse variable) et « C.V. ».
  const idxBio = heads.findIndex((h) => /^bio(graphie|graphy)?$/.test(h.titre));
  const idxDem = heads.findIndex((h) => /^(d[ée]marche|artist.s statement|statement)/.test(h.titre));
  const idxCv = heads.findIndex((h) => /^(c\.?\s*v\.?|curriculum|r[ée]sum[ée])/.test(h.titre));
  return {
    biographie: idxBio >= 0 ? stripHtml(corps(idxBio)) : '',
    demarche: idxDem >= 0 ? stripHtml(corps(idxDem)) : '',
    curriculum: idxCv >= 0 ? stripHtml(s.slice(heads[idxCv].contentStart)) : '',
  };
}

// Récupère UN produit par son SKU (= numéro d'inventaire). Pour la comparaison
// d'une seule œuvre depuis sa fiche. Retourne la fiche normalisée, ou null.
async function produitParSku(creds, sku) {
  const s = String(sku == null ? '' : sku).trim();
  if (!s) return null;
  const base = normaliserUrl(creds.url);
  const auth = authBasique(creds);
  const resp = await getJson(`${base}/wp-json/wc/v3/products?sku=${encodeURIComponent(s)}&per_page=1&_fields=${encodeURIComponent(CHAMPS_PRODUIT_V3)}`, { auth });
  if (resp.status === 401 || resp.status === 403) throw new Error('Clés refusées par le site.');
  if (!resp.ok) throw new Error(`Le site a répondu par une erreur (${resp.status}).`);
  let lot;
  try { lot = await resp.json(); } catch { throw new Error('Réponse du site illisible.'); }
  const p = Array.isArray(lot) && lot[0] ? lot[0] : null;
  return p ? normaliserProduitV3(p) : null;
}

// Récupère les artistes du site : type de contenu WordPress `portfolio`, exposé
// PUBLIQUEMENT par l'API standard wp/v2 (aucune clé nécessaire — contenu publié).
// Champs retenus : nom (title), biographie (content, peut inclure le curriculum),
// courte présentation (excerpt), photo (image mise en avant). Lecture seule.
// langue : 'fr' | 'en' | undefined. WPML expose les traductions via ?lang=,
// sur la même API publique — aucune clé requise.
async function listerArtistesSite({ url, langue }) {
  const base = normaliserUrl(url);
  const artistes = [];
  const MAX_PAGES = 20;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const lang = langue ? `&lang=${encodeURIComponent(langue)}` : '';
    const u = `${base}/wp-json/wp/v2/portfolio?per_page=100&page=${page}&orderby=title&order=asc&_embed=wp:featuredmedia${lang}`;
    const resp = await getJson(u);
    if (resp.status === 404) {
      throw new Error("La liste des artistes est introuvable sur le site (type « portfolio » absent de l'API).");
    }
    if (!resp.ok) throw new Error(`Le site a répondu par une erreur (${resp.status}) en lisant les artistes.`);
    let lot;
    try { lot = await resp.json(); } catch { throw new Error('Réponse du site illisible (artistes).'); }
    if (!Array.isArray(lot) || !lot.length) break;
    for (const p of lot) {
      const media = p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0];
      const sections = decouperSectionsArtiste((p.content && p.content.rendered) || '');
      artistes.push({
        id: p.id,
        nom: stripHtml((p.title && p.title.rendered) || ''),
        slug: p.slug || '',
        biographie: sections.biographie,
        demarche: sections.demarche,
        curriculum: sections.curriculum,
        excerpt: stripHtml((p.excerpt && p.excerpt.rendered) || ''),
        image: (media && media.source_url) ? media.source_url : '',
        link: p.link || '',
      });
    }
    const totalPages = Number(resp.headers.get('x-wp-totalpages'));
    if (Number.isFinite(totalPages) && page >= totalPages) break;
    if (lot.length < 100) break;
  }
  return artistes;
}

// Télécharge une image (URL publique du site) et la renvoie en data URL, pour la
// passer au recadrage. Lecture seule ; vérifie le type et la taille.
async function telechargerImage(url) {
  const u = String(url == null ? '' : url).trim();
  if (!/^https?:\/\//i.test(u)) throw new Error("Adresse d'image invalide.");
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS);
  let resp;
  try {
    resp = await fetch(u, { signal: ctrl.signal, redirect: 'follow' });
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error("Le téléchargement de l'image a expiré.");
    throw new Error(`Image inaccessible : ${err && err.message ? err.message : 'erreur réseau'}.`);
  } finally {
    clearTimeout(minuteur);
  }
  if (!resp.ok) throw new Error(`Image inaccessible (${resp.status}).`);
  const ctype = resp.headers.get('content-type') || '';
  if (!ctype.startsWith('image/')) throw new Error("Le lien ne pointe pas vers une image.");
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) throw new Error("Image trop volumineuse (plus de 20 Mo).");
  return `data:${ctype};base64,${buf.toString('base64')}`;
}


// ===== Adresses des fiches du site, SANS CLÉ =====
// L'API « Store » de WooCommerce (wc/store/v1) est PUBLIQUE : elle expose le SKU
// et le permalink de chaque produit sans authentification, comme le fait déjà
// wp/v2/portfolio pour les artistes. On s'en sert pour remplir `url_site` même
// chez un utilisateur qui n'a pas configuré de clés REST.
// Renvoie [{ sku, permalink, nom }].
// langue : 'fr' | 'en' | undefined (voir listerArtistesSite).
// La description d'une œuvre vit dans `short_description`, pas dans
// `description`, qui est vide sur ce site.
// `skus` (facultatif) : ne lire que ces produits — comparaison d'un artiste.
async function listerProduitsPublics({ url, langue, skus }) {
  const base = normaliserUrl(url);
  const produits = [];
  for (const q of requetesFiltre(Array.isArray(skus) ? { skus } : {})) {
    const MAX_PAGES = 50; // garde-fou (5000 produits) contre une boucle infinie
    for (let page = 1; page <= MAX_PAGES; page++) {
      const lang = langue ? `&lang=${encodeURIComponent(langue)}` : '';
      const u = `${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}${lang}${q}`;
      const resp = await getJson(u);
      if (resp.status === 404) {
        throw new Error("La boutique du site est introuvable à cette adresse.");
      }
      if (!resp.ok) {
        throw new Error(`Le site a répondu par une erreur (${resp.status}) en lisant la boutique.`);
      }
      let lot;
      try { lot = await resp.json(); }
      catch { throw new Error('Réponse du site illisible (boutique).'); }
      if (!Array.isArray(lot) || !lot.length) break;
      for (const p of lot) {
        const sku = (p && p.sku ? String(p.sku) : '').trim();
        const permalink = (p && p.permalink ? String(p.permalink) : '').trim();
        if (sku) {
          produits.push({
            sku,
            permalink,
            nom: stripHtml((p.name || '')),
            description: stripHtml((p && p.short_description) || ''),
          });
        }
      }
      if (lot.length < 100) break;
    }
  }
  return produits;
}

// ===== Caractéristiques d'une œuvre, du site vers la fiche =====
//
// « Quand on importe une œuvre du site pour créer la fiche, les
// caractéristiques ne suivent pas » (signalement du 2026-09-10). La création
// ne reprenait que titre, description et prix : type, format, médium, support,
// orientation, sujets, style et dimensions restaient à ressaisir.
//
// ⚠ Le site et l'app ne parlent pas la même langue, et cette table n'a PAS été
// devinée : elle est DÉDUITE des 510 œuvres présentes des deux côtés au
// 2026-09-10, en regardant ce que les parents avaient eux-mêmes saisi dans
// l'app pour chaque valeur du site. Aucune contradiction pour le type.
const TYPES_SITE = {
  'tableaux': 'Peinture',
  'œuvre sur papier': 'Peinture',
  'oeuvre sur papier': 'Peinture',
  'fusain': 'Peinture',
  'aquarelles': 'Peinture',
  'sculptures': 'Sculpture',
  'œuvre numérique': 'Reproduction',
  'oeuvre numérique': 'Reproduction',
  'reproductions sur toile': 'Reproduction',
  'reproductions sur papier': 'Reproduction',
};
const FORMATS_APP = ['Mini', 'Petit', 'Moyen', 'Grand', 'Très grand'];
const STYLES_APP = ['Figuratif', 'Mi-Figuratif', 'Abstrait'];

function decoderEntites(s) {
  return String(s == null ? '' : s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, '’').trim();
}
const plat = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// `supportsConnus` : les supports déjà employés dans l'app, écrits comme elle
// les écrit (« Toile », « Papier beaux-arts »…). Ils décident où couper
// « Acrylique sur toile » : on ne coupe que si ce qui suit « sur » est un
// support reconnu. Sinon on garde le tout comme médium — c'est ce que les
// parents ont fait pour « Encaustique sur bois, Feuilles d'or 24k » (34
// œuvres) et « Acrylique sur toile - Pixélisme » (27), conventions propres à
// deux artistes.
//
// Chaque champ absent ou inconnu vaut null : une case vide se remplit, une
// case fausse se remarque rarement.
function caracteristiquesProduit(p, { supportsConnus = [] } = {}) {
  const attr = (nom) => {
    const a = (p.attributes || []).find((x) => plat(decoderEntites(x.name)) === plat(nom));
    return a ? (a.terms || []).map((t) => decoderEntites(t.name)).filter(Boolean) : [];
  };
  const c = {
    type: null, format: null, medium: null, support: null, orientation: null,
    sujets: null, style: null, hauteur: null, largeur: null, profondeur: null,
    categories: (p.categories || []).map((x) => decoderEntites(x.name)).filter(Boolean),
  };

  const type = attr('Type')[0];
  if (type) c.type = TYPES_SITE[plat(type)] || null;

  const format = attr('Format')[0];
  if (format) c.format = FORMATS_APP.find((f) => plat(f) === plat(format)) || null;

  // Plusieurs orientations (« Horizontale, Verticale ») : la première, comme
  // l'ont fait les parents.
  const orientation = attr('Orientation')[0];
  if (orientation) c.orientation = orientation;

  // Sujets : l'app les range séparés par une simple virgule.
  const sujets = attr('Sujet');
  if (sujets.length) c.sujets = sujets.join(',');

  // Style : l'étiquette du site. Un seul style reconnu → on le prend ; deux
  // (« Figuratif, Mi-Figuratif ») → on laisse la case vide plutôt que de
  // choisir à la place des parents.
  const styles = (p.tags || []).map((t) => decoderEntites(t.name))
    .map((t) => STYLES_APP.find((s) => plat(s) === plat(t))).filter(Boolean);
  if (styles.length === 1) c.style = styles[0];

  // Médium et support.
  const ms = attr('Médium et support').join(', ');
  if (ms) {
    const i = ms.toLowerCase().lastIndexOf(' sur ');
    const suite = i >= 0 ? ms.slice(i + 5).trim() : '';
    const connu = suite ? supportsConnus.find((s) => plat(s) === plat(suite)) : null;
    if (connu) { c.medium = ms.slice(0, i).trim(); c.support = connu; }
    else c.medium = ms;
  } else {
    // Les sculptures ont leur propre attribut, repris tel quel comme médium.
    const mat = attr('Sculpture - Matériaux');
    if (mat.length) c.medium = mat.join(', ');
  }

  // Dimensions : hauteur × largeur × profondeur (« length » côté WooCommerce).
  const d = p.dimensions || {};
  const nombre = (v) => { const n = Number(String(v == null ? '' : v).trim()); return v !== '' && v != null && Number.isFinite(n) && n > 0 ? n : null; };
  c.hauteur = nombre(d.height);
  c.largeur = nombre(d.width);
  c.profondeur = nombre(d.length);
  return c;
}

// Un produit, par son SKU, depuis l'API PUBLIQUE (aucune clé nécessaire) :
// c'est elle qui expose attributs, étiquettes, catégories et dimensions dans
// une forme stable.
async function produitPublicParSku({ url, sku }) {
  const base = normaliserUrl(url);
  const resp = await getJson(`${base}/wp-json/wc/store/v1/products?sku=${encodeURIComponent(sku)}`);
  if (!resp.ok) throw new Error(`Le site a répondu par une erreur (${resp.status}) en lisant le produit.`);
  let lot;
  try { lot = await resp.json(); } catch { throw new Error('Réponse du site illisible (produit).'); }
  return (Array.isArray(lot) && lot[0]) || null;
}

module.exports = { caracteristiquesProduit, produitPublicParSku, TYPES_SITE, listerProduitsPublics, testerConnexion, normaliserUrl, stripHtml, listerProduits, listerCategoriesProduits, produitParSku, listerArtistesSite, telechargerImage };
