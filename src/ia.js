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

module.exports = { genererDescription, MODELE };
