// Génération de descriptions d'œuvres via l'API Claude (Anthropic).
// Le module est volontairement minimal : il reçoit un prompt déjà assemblé
// (consignes galerie + artiste + caractéristiques, via assemblerPromptIA dans
// main.js) et l'image de l'œuvre, et renvoie le texte généré.
//
// La dépendance `@anthropic-ai/sdk` est requise paresseusement pour que l'app
// démarre même si elle n'est pas installée (la génération échoue alors avec un
// message clair, au lieu de planter au lancement).

const MODELE = 'claude-haiku-4-5';

const SYSTEME = [
  "Tu es le rédacteur de catalogue de la Galerie du Vieux Saint-Jean.",
  "Suis scrupuleusement les consignes de la galerie et de l'artiste fournies dans",
  "le message (voix, langue, format, longueur, règles d'écriture), et appuie-toi",
  "uniquement sur les données et la photo fournies, sans inventer de fait.",
  "Réponds UNIQUEMENT avec la description demandée, sans préambule (« Voici… »)",
  "ni commentaire.",
].join(' ');

// Transforme un message d'erreur SDK en message clair en français.
function messageErreur(err) {
  const statut = err && (err.status || err.statusCode);
  if (statut === 401) return 'Clé API Anthropic invalide ou révoquée. Vérifie-la dans Réglages → IA.';
  if (statut === 403) return "Accès refusé par l'API (clé sans permission ou facturation non configurée).";
  if (statut === 429) return "Limite de l'API atteinte. Réessaie dans un moment.";
  if (statut === 400) return `Requête refusée par l'API : ${err.message || 'détail inconnu'}.`;
  if (statut >= 500) return "Le service Anthropic est momentanément indisponible. Réessaie plus tard.";
  if (err && /fetch failed|ENOTFOUND|ECONNREFUSED|network|getaddrinfo/i.test(String(err.message))) {
    return "Impossible de joindre l'API (pas de connexion Internet ?).";
  }
  return (err && err.message) || "Échec de la génération.";
}

function blocImage(imageDataUrl) {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/i.exec(imageDataUrl || '');
  if (!m) return null;
  return { type: 'image', source: { type: 'base64', media_type: m[1].toLowerCase(), data: m[2] } };
}

// apiKey : clé en clair (déchiffrée juste avant l'appel). prompt : texte assemblé.
// imageDataUrl : data URL base64 de la photo (optionnel).
async function genererDescription({ apiKey, prompt, imageDataUrl }) {
  if (!apiKey) {
    const e = new Error('Aucune clé API configurée.');
    e.code = 'NO_KEY';
    throw e;
  }
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    throw new Error("Le module d'IA n'est pas installé (@anthropic-ai/sdk).");
  }

  const client = new Anthropic({ apiKey });
  const content = [];
  const img = blocImage(imageDataUrl);
  if (img) content.push(img);
  content.push({ type: 'text', text: prompt });

  let reponse;
  try {
    reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 1500,
      system: SYSTEME,
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    throw new Error(messageErreur(err));
  }

  const texte = (reponse.content || [])
    .filter((b) => b && b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!texte) throw new Error("L'IA n'a renvoyé aucun texte. Réessaie.");
  return texte;
}

// ===== Traduction française → anglaise =====
// Sert aux documents en anglais (présentation d'artiste, catalogue) dont le
// contenu — biographie, démarche, C.V., descriptions — est rédigé en français.
//
// Modèle distinct de la génération de descriptions : traduire une biographie
// d'artiste demande plus de finesse que décrire une toile. Une seule constante
// à changer si l'on veut revenir à un modèle plus économique.
const MODELE_TRADUCTION = 'claude-opus-5';

const SYSTEME_TRADUCTION = [
  "Tu traduis du français vers l'anglais pour une galerie d'art québécoise.",
  "Rends un anglais naturel et soigné, du registre d'un catalogue d'exposition :",
  "ni littéral ni embelli. Conserve la structure du texte — paragraphes, sauts de",
  "ligne, listes, années en tête de ligne d'un curriculum.",
  "Ne traduis PAS les noms propres, les titres d'œuvres, les noms de lieux, de",
  "galeries, de musées ni de prix : laisse-les tels quels.",
  "N'ajoute rien, ne retire rien, ne commente pas.",
  "Réponds UNIQUEMENT avec la traduction, sans préambule ni guillemets.",
].join(' ');

// Ce que chaque champ est, pour que la traduction adopte le bon ton.
const NATURE_CHAMP = {
  biographie: "une notice biographique d'artiste",
  demarche: "un texte de démarche artistique, écrit à la première personne",
  curriculum: "un curriculum d'artiste : expositions, prix, collections, souvent en lignes « année — description »",
  citation: "une courte citation de l'artiste, mise en exergue",
  description: "la description d'une œuvre, destinée au catalogue et au site",
};

// texte : le français à traduire. champ : clé de NATURE_CHAMP (facultatif).
// contexte : nom de l'artiste ou de l'œuvre, pour lever les ambiguïtés.
async function traduireVersAnglais({ apiKey, texte, champ, contexte }) {
  const source = (texte == null ? '' : String(texte)).trim();
  if (!source) {
    const e = new Error('Aucun texte à traduire.');
    e.code = 'VIDE';
    throw e;
  }
  if (!apiKey) {
    const e = new Error('Aucune clé API configurée.');
    e.code = 'NO_KEY';
    throw e;
  }
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    throw new Error("Le module d'IA n'est pas installé (@anthropic-ai/sdk).");
  }

  const nature = NATURE_CHAMP[champ] || 'un texte de galerie';
  const entete = [
    `Traduis en anglais ${nature}${contexte ? ` (${contexte})` : ''}.`,
    '',
    'Texte français :',
  ].join('\n');

  const client = new Anthropic({ apiKey });
  let reponse;
  try {
    reponse = await client.messages.create({
      model: MODELE_TRADUCTION,
      max_tokens: 16000,
      // Une traduction n'est pas un problème à creuser : effort faible, donc
      // rapide et économique, sans perte de qualité sur cette tâche.
      output_config: { effort: 'low' },
      system: SYSTEME_TRADUCTION,
      messages: [{ role: 'user', content: `${entete}\n\n${source}` }],
    });
  } catch (err) {
    throw new Error(messageErreur(err));
  }

  if (reponse.stop_reason === 'refusal') {
    throw new Error("La traduction a été refusée par le service. Vérifie le texte source.");
  }

  const traduit = (reponse.content || [])
    .filter((b) => b && b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!traduit) throw new Error("Aucune traduction n'a été renvoyée. Réessaie.");
  return traduit;
}

module.exports = { genererDescription, traduireVersAnglais, MODELE, MODELE_TRADUCTION };
