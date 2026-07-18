// ===== Verrou léger de l'application =====
// Barrière d'accès par code court (NIP). Ce n'est PAS du chiffrement : la base
// reste lisible sur le disque tant que le volet « chiffrement » n'est pas en
// place. Le but est d'empêcher une personne de passage de consulter les fiches
// de clients quand l'écran est laissé sans surveillance.
//
// Le code n'est jamais conservé en clair : on enregistre une empreinte scrypt
// salée (sel aléatoire de 16 octets), comparée à temps constant. La
// vérification vit ici, dans le processus principal — le renderer ne reçoit
// jamais l'empreinte (retirée de config:get dans main.js).

const crypto = require('node:crypto');

const SCRYPT_KEYLEN = 32;

function obtenirConfig() {
  return require('./config').obtenirConfig();
}
function mettreAJourConfig(partiel) {
  return require('./config').mettreAJourConfig(partiel);
}

// Code valide = 4 à 6 chiffres.
function codeValide(code) {
  return typeof code === 'string' && /^\d{4,6}$/.test(code);
}

function hacher(code, selHex) {
  const sel = Buffer.from(selHex, 'hex');
  return crypto.scryptSync(String(code), sel, SCRYPT_KEYLEN).toString('hex');
}

// État non sensible, sûr à exposer au renderer.
function etatSecurite() {
  const s = obtenirConfig().securite || {};
  const codeDefini = !!(s.code_hash && s.code_sel);
  return {
    code_defini: codeDefini,
    // Le verrou n'est réellement actif que si un code est défini.
    verrou_actif: !!s.verrou_actif && codeDefini,
    inactivite_minutes: Number.isFinite(s.inactivite_minutes) ? s.inactivite_minutes : 10,
    verrouiller_au_demarrage: s.verrouiller_au_demarrage !== false,
    verrouiller_au_blur: !!s.verrouiller_au_blur,
  };
}

// Définit (ou remplace) le code. Active le verrou par défaut au premier code.
function definirCode(code) {
  if (!codeValide(code)) {
    throw new Error('Le code doit comporter de 4 à 6 chiffres.');
  }
  const selHex = crypto.randomBytes(16).toString('hex');
  const hash = hacher(code, selHex);
  mettreAJourConfig({ securite: { code_hash: hash, code_sel: selHex, verrou_actif: true } });
  return { ok: true };
}

// Retire le code et désactive le verrou.
function retirerCode() {
  mettreAJourConfig({ securite: { code_hash: '', code_sel: '', verrou_actif: false } });
  return { ok: true };
}

// Vérifie un code à temps constant. Renvoie { ok }.
function verifierCode(code) {
  const s = obtenirConfig().securite || {};
  if (!s.code_hash || !s.code_sel) return { ok: false };
  if (typeof code !== 'string' || !code) return { ok: false };
  let attendu, fourni;
  try {
    attendu = Buffer.from(s.code_hash, 'hex');
    fourni = Buffer.from(hacher(code, s.code_sel), 'hex');
  } catch {
    return { ok: false };
  }
  if (attendu.length !== fourni.length) return { ok: false };
  return { ok: crypto.timingSafeEqual(attendu, fourni) };
}

// Met à jour les options non sensibles. Refuse d'activer le verrou sans code.
function definirOptions(opts) {
  const o = opts || {};
  const s = obtenirConfig().securite || {};
  const codeDefini = !!(s.code_hash && s.code_sel);
  const partiel = {};
  if (typeof o.verrou_actif === 'boolean') {
    partiel.verrou_actif = o.verrou_actif && codeDefini;
  }
  if (o.inactivite_minutes != null) {
    const n = Math.max(0, Math.floor(Number(o.inactivite_minutes) || 0));
    partiel.inactivite_minutes = n;
  }
  if (typeof o.verrouiller_au_demarrage === 'boolean') {
    partiel.verrouiller_au_demarrage = o.verrouiller_au_demarrage;
  }
  if (typeof o.verrouiller_au_blur === 'boolean') {
    partiel.verrouiller_au_blur = o.verrouiller_au_blur;
  }
  mettreAJourConfig({ securite: partiel });
  return etatSecurite();
}

module.exports = {
  etatSecurite,
  definirCode,
  retirerCode,
  verifierCode,
  definirOptions,
  codeValide,
};
