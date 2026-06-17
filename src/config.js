const fs = require('node:fs');
const path = require('node:path');
const { getDataDir } = require('./db/paths');

const NOM_FICHIER = 'config.json';

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
    prefixe_facture: 'F-2026',
    prochain_numero_facture: 1,
    prefixe_facture_artiste: 'A-2026',
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
  ia: {
    instructions_galerie: '',
    lien_chatgpt_defaut: 'https://chat.openai.com/',
  },
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
