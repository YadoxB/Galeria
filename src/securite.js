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

// Compare deux empreintes hex à temps constant, sans jamais lever.
function empreintesEgales(hexAttendu, hexFourni) {
  try {
    const a = Buffer.from(hexAttendu, 'hex');
    const b = Buffer.from(hexFourni, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// ===== Question de secours =====
// Normalise une réponse avant comparaison. Sans ça, le secours ne sert à rien :
// les propriétaires écriraient « Sainte-Foy » un jour et « sainte foy »
// l'autre, et se feraient refuser leur propre réponse. On retire les accents,
// la casse, les espaces et toute la ponctuation — « Sainte-Foy », « sainte foy »
// et « SainteFoy » deviennent la même chose.
function normaliserReponse(txt) {
  return String(txt == null ? '' : txt)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // signes diacritiques detaches par NFD
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Freinage des tentatives de secours. En mémoire du processus principal :
// remis à zéro au redémarrage de l'app, ce qui est acceptable — le but est de
// décourager quelqu'un qui essaie des réponses en rafale devant l'écran, pas
// de résister à une attaque outillée (voir la note de portée en tête de
// fichier). Fermer et rouvrir l'app est bien plus lent que d'attendre.
const MAX_TENTATIVES = 3;
const PAUSE_MS = 30 * 1000;
let tentativesSecours = 0;
let bloqueJusqua = 0;

function secondesRestantes() {
  const reste = bloqueJusqua - Date.now();
  return reste > 0 ? Math.ceil(reste / 1000) : 0;
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
    // Question de secours. Le texte de la question n'est PAS un secret : il
    // s'affiche sur l'écran de verrouillage. La réponse, elle, ne sort jamais.
    question_definie: !!(s.question && s.reponse_hash && s.reponse_sel),
    question: String(s.question || ''),
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

// Retire le code et désactive le verrou. Retire aussi la question de secours :
// elle ne protège plus rien sans code, et la laisser traîner ferait croire à
// une sécurité qui n'existe plus.
function retirerCode() {
  mettreAJourConfig({
    securite: {
      code_hash: '', code_sel: '', verrou_actif: false,
      question: '', reponse_hash: '', reponse_sel: '',
    },
  });
  tentativesSecours = 0;
  bloqueJusqua = 0;
  return { ok: true };
}

// --- Question de secours ---

// Enregistre la question et sa réponse. La réponse est protégée comme le code.
function definirQuestion(question, reponse) {
  const q = String(question == null ? '' : question).trim();
  if (q.length < 5) {
    throw new Error('La question doit être un peu plus longue.');
  }
  const norm = normaliserReponse(reponse);
  if (norm.length < 2) {
    throw new Error('La réponse doit comporter au moins 2 lettres ou chiffres.');
  }
  const selHex = crypto.randomBytes(16).toString('hex');
  mettreAJourConfig({
    securite: { question: q, reponse_hash: hacher(norm, selHex), reponse_sel: selHex },
  });
  tentativesSecours = 0;
  bloqueJusqua = 0;
  return { ok: true };
}

function retirerQuestion() {
  mettreAJourConfig({ securite: { question: '', reponse_hash: '', reponse_sel: '' } });
  tentativesSecours = 0;
  bloqueJusqua = 0;
  return { ok: true };
}

// Vérifie la réponse de secours, avec freinage après plusieurs échecs.
// Renvoie { ok } ou { ok:false, pause_secondes } quand il faut patienter.
function verifierReponse(reponse) {
  const attente = secondesRestantes();
  if (attente > 0) return { ok: false, pause_secondes: attente };

  const s = obtenirConfig().securite || {};
  if (!s.question || !s.reponse_hash || !s.reponse_sel) return { ok: false };

  const norm = normaliserReponse(reponse);
  // Une réponse vide ne doit jamais compter comme une tentative valable, mais
  // elle ne doit pas non plus servir à réarmer le compteur en boucle.
  if (norm.length < 2) return { ok: false };

  if (empreintesEgales(s.reponse_hash, hacher(norm, s.reponse_sel))) {
    tentativesSecours = 0;
    bloqueJusqua = 0;
    return { ok: true };
  }

  tentativesSecours += 1;
  if (tentativesSecours >= MAX_TENTATIVES) {
    tentativesSecours = 0;
    bloqueJusqua = Date.now() + PAUSE_MS;
    return { ok: false, pause_secondes: Math.ceil(PAUSE_MS / 1000) };
  }
  return { ok: false, tentatives_restantes: MAX_TENTATIVES - tentativesSecours };
}

// Réinitialise le code à partir de la question de secours. La réponse est
// re-vérifiée ici : c'est le processus principal qui décide, pas l'interface.
// Un seul appel fait les deux, pour qu'il n'existe aucun état intermédiaire
// « réponse acceptée » exploitable.
function reinitialiserCodeParSecours(reponse, nouveauCode) {
  const r = verifierReponse(reponse);
  if (!r.ok) return r;
  if (!codeValide(nouveauCode)) {
    throw new Error('Le code doit comporter de 4 à 6 chiffres.');
  }
  definirCode(nouveauCode);
  return { ok: true };
}

// Vérifie un code à temps constant. Renvoie { ok }.
function verifierCode(code) {
  const s = obtenirConfig().securite || {};
  if (!s.code_hash || !s.code_sel) return { ok: false };
  if (typeof code !== 'string' || !code) return { ok: false };
  return { ok: empreintesEgales(s.code_hash, hacher(code, s.code_sel)) };
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
  definirQuestion,
  retirerQuestion,
  verifierReponse,
  reinitialiserCodeParSecours,
  normaliserReponse,
};
