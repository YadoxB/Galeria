const fs = require('node:fs');
const path = require('node:path');
const { getDataDir } = require('./db/paths');

const NOM_FICHIER = 'config.json';

// Set global de la galerie pour la génération de descriptions par IA, transcrit
// de gabarits/Consignes-IA-descriptions-oeuvres.md. C'est la VALEUR PAR DÉFAUT
// du champ « Consignes générales de la galerie » (Réglages → IA) : modifiable
// dans l'app, et empaquetée dans le build (les installs neuves la reçoivent ;
// les configs existantes sont complétées une fois par migrerConfig).
const CONSIGNES_GALERIE_DEFAUT = [
  "Rôle. Tu rédiges des descriptions d'œuvres pour la Galerie du Vieux Saint-Jean : aider un visiteur à apprécier l'œuvre et à se projeter, dans une voix soignée et chaleureuse, fidèle à l'artiste.",
  "Voix et ton. Troisième personne, ton évocateur mais sobre, qui valorise l'œuvre sans exagération commerciale. Tu peux nommer l'artiste. Élégant et accessible.",
  "Langue et format. Produis toujours deux versions : d'abord le français, puis l'anglais. L'anglais dit la même chose, en adaptation naturelle (pas une traduction mot à mot). Sépare-les clairement sous les intitulés « Français » puis « English ».",
  "Ancrage factuel (la règle la plus importante). N'invente jamais de fait. Appuie-toi uniquement sur le titre, le médium, le support, les dimensions, le sujet, le format, l'orientation, et ce qui est réellement visible sur la photo. N'invente jamais d'année, de provenance, de prix, de signature, de numéro d'édition, d'anecdote, de lieu géographique précis, d'inspiration, de référence à un autre artiste, ni d'élément biographique. Si une information manque, n'en parle pas ; dans le doute, reste descriptif et sobre.",
  "Ouverture. Pour une œuvre originale, tu peux ouvrir par « Œuvre originale. ». Pour une reproduction ou une giclée, indique clairement qu'il s'agit d'une reproduction (et l'édition si elle est fournie) ; ne présente jamais une reproduction comme une pièce unique.",
  "Longueur. Adapte-toi au sujet et au style de l'artiste. Par défaut, vise court à moyen ; étoffe seulement quand l'œuvre et le style le justifient. Mieux vaut court et juste que long et inventé.",
  "Adapter au type d'œuvre. Peinture : la scène, la palette, la lumière, la touche. Sculpture : le matériau, la forme, le volume, le procédé. Reproduction : reste factuel sur la technique d'impression.",
  "Préférences d'écriture (à respecter strictement). N'utilise jamais de tiret cadratin (le trait long « — ») ; sépare plutôt par une virgule, un deux-points ou une parenthèse. N'utilise jamais la tournure « ce n'est pas X, c'est Y ». Évite les clichés de marketing d'art (« incontournable », « véritable chef-d'œuvre », « ne vous laissera pas indifférent »). Écris en phrases complètes, dans une prose claire.",
  "Qualité. Décris ce qui se voit et ce que l'œuvre évoque, sans sur-interpréter. Si la photo et les données sont minces, une à deux phrases honnêtes valent mieux qu'un paragraphe spéculatif.",
].join('\n\n');

const DEFAULTS = {
  galerie: {
    nom: 'Ma galerie',
    adresse_ligne1: '',
    adresse_ligne2: '',
    telephone: '',
    courriel: '',
    site_web: '',
    numero_tps: '',
    numero_tvq: '',
    logo_path: '',
  },
  documents: {
    prefixe_facture: 'FC-2026',
    prochain_numero_facture: 1,
    prefixe_facture_artiste: 'FA-2026',
    prochain_numero_facture_artiste: 1,
    prefixe_certificat: 'C-2026',
    prochain_numero_certificat: 1,
    tps_actif: true,
    tps_taux: 5.0,
    tvq_actif: true,
    tvq_taux: 9.975,
    cote_galerie_pourcent: 50,
    signataire_certificat: '',
    prochain_numero_inventaire: 1,
  },
  sauvegardes: {
    frequence_minutes: 60,
    retention: 50,
    dossier: '',
  },
  affichage: {
    zoom: 1.0,
  },
  securite: {
    // Verrou léger : barrière d'accès (un code court), pas du chiffrement. Le
    // code n'est JAMAIS conservé en clair — seules une empreinte scrypt et son
    // sel (hex) sont enregistrés. La vérification se fait dans le processus
    // principal (src/securite.js) ; ces deux champs sont retirés de config:get
    // pour ne pas exposer l'empreinte au renderer.
    verrou_actif: false,
    code_hash: '',
    code_sel: '',
    // 0 = jamais (verrou seulement à l'ouverture). Sinon délai en minutes avant
    // le verrouillage automatique sur inactivité.
    inactivite_minutes: 10,
    // Demander le code au démarrage de l'application.
    verrouiller_au_demarrage: true,
    // Verrouiller aussi quand la fenêtre perd le focus.
    verrouiller_au_blur: false,
    // Chiffrement du fichier de la base au repos (DPAPI / coffre Windows).
    // Opt-in. Les sauvegardes, elles, restent en clair (BitLocker + USB
    // chiffrée, cf. CLAUDE.md §10).
    chiffrement_actif: false,
  },
  ia: {
    // Consignes générales de la galerie pour la génération IA (modifiable dans
    // Réglages → IA). Par défaut = set global du document de consignes.
    instructions_galerie: CONSIGNES_GALERIE_DEFAUT,
    // Marqueur : le défaut a-t-il déjà été appliqué aux configs existantes ?
    // (évite de réécrire le champ si l'utilisateur l'a vidé volontairement.)
    consignes_galerie_init: false,
    lien_chatgpt_defaut: 'https://chat.openai.com/',
    // Clé API Anthropic CHIFFRÉE (safeStorage / coffre Windows), encodée en
    // base64. Jamais en clair. Vide = génération directe inactive.
    cle_anthropic: '',
  },
  // Tutoriel de bienvenue (#13) : passe à true une fois la visite vue au
  // premier lancement ; rejouable ensuite depuis l'aide.
  tutoriel_vu: false,
  // Catalogue livré : identifiant du catalogue que l'utilisateur a refusé de
  // charger (pour ne pas le reproposer) ; et drapeau « re-déballer les photos »
  // après un chargement de catalogue (relu au prochain démarrage).
  catalogue_refuse: '',
  forcer_photos_catalogue: false,
};

function cheminConfig() {
  return path.join(getDataDir(), NOM_FICHIER);
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function fusionner(base, partiel) {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return partiel;
  if (typeof partiel !== 'object' || partiel === null || Array.isArray(partiel)) return base;
  const res = { ...base };
  for (const k of Object.keys(partiel)) {
    res[k] = fusionner(base[k], partiel[k]);
  }
  return res;
}

// Migrations ponctuelles de la configuration déjà enregistrée (les nouveaux
// défauts ne remplacent pas une valeur existante via fusionner). Renvoie true
// si un champ a changé (pour réécrire le fichier).
function migrerConfig(cfg) {
  let change = false;
  const d = cfg.documents || {};
  // 2026-06-23 : préfixes de factures FA (artiste) / FC (client). On ne migre
  // que si la valeur est restée au défaut historique (« A-2026 » / « F-2026 »),
  // pour ne pas écraser un préfixe personnalisé dans les Réglages.
  if (d.prefixe_facture === 'F-2026') { d.prefixe_facture = 'FC-2026'; change = true; }
  if (d.prefixe_facture_artiste === 'A-2026') { d.prefixe_facture_artiste = 'FA-2026'; change = true; }
  // 2026-06-30 : set global de consignes IA. On remplit le champ UNE fois s'il
  // est vide (configs créées avant l'ajout), puis on pose le marqueur — ainsi
  // l'utilisateur peut ensuite le modifier ou le vider sans qu'il se réécrive.
  const ia = cfg.ia || (cfg.ia = {});
  if (!ia.consignes_galerie_init) {
    if (!ia.instructions_galerie || !String(ia.instructions_galerie).trim()) {
      ia.instructions_galerie = CONSIGNES_GALERIE_DEFAUT;
    }
    ia.consignes_galerie_init = true;
    change = true;
  }
  return change;
}

let cache = null;

function chargerConfig() {
  if (cache) return cache;
  const p = cheminConfig();
  if (!fs.existsSync(p)) {
    cache = clone(DEFAULTS);
    try { fs.mkdirSync(getDataDir(), { recursive: true }); } catch {}
    fs.writeFileSync(p, JSON.stringify(cache, null, 2), 'utf-8');
    return cache;
  }
  try {
    const charge = JSON.parse(fs.readFileSync(p, 'utf-8'));
    cache = fusionner(DEFAULTS, charge);
    if (migrerConfig(cache)) sauverConfig(cache);
    return cache;
  } catch (e) {
    console.error('Configuration illisible, valeurs par défaut utilisées :', e);
    cache = clone(DEFAULTS);
    return cache;
  }
}

function sauverConfig(nouvelle) {
  const p = cheminConfig();
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(nouvelle, null, 2), 'utf-8');
  cache = nouvelle;
}

function obtenirConfig() {
  return chargerConfig();
}

function mettreAJourConfig(partiel) {
  const courant = chargerConfig();
  const nouveau = fusionner(courant, partiel);
  sauverConfig(nouveau);
  return nouveau;
}

module.exports = { chargerConfig, sauverConfig, obtenirConfig, mettreAJourConfig, DEFAULTS };
