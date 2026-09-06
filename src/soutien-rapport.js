// Rapport de problème : ce que Galeria joint quand les parents cliquent sur
// « Signaler un problème ».
//
// ─────────────────────────────────────────────────────────────────────────
// CE QUI N'Y ENTRE JAMAIS
//
//   — aucun nom de client, aucune adresse, aucun courriel, aucun montant :
//     seulement des COMPTES (« 12 clients »), jamais qui ni combien ;
//   — le code du verrou et sa question de secours, même sous forme
//     d'empreinte (config.securite.*) ;
//   — la clé Anthropic et les clés du site web (config.ia.*, config.web.*),
//     chiffrées dans le coffre Windows : elles ne doivent jamais en sortir.
//
// La configuration N'EST PAS jointe du tout. C'est plus sûr qu'une liste de
// champs à exclure, qu'un ajout futur rendrait incomplète sans prévenir.
//
// Le journal d'erreurs, lui, EST joint : c'est ce qui sert vraiment. Il peut
// contenir des chemins de fichiers, donc le nom de session Windows. Les
// parents le voient avant l'envoi — c'est à ça que sert « Voir le détail ».
// ─────────────────────────────────────────────────────────────────────────

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');
const { getDataDir, getBackupsDir } = require('./db/paths');
const { openDatabase } = require('./db/database');

// Assez de lignes pour comprendre, assez peu pour tenir dans un courriel.
const LIGNES_JOURNAL = 12;

function derniereSauvegarde() {
  try {
    const dossier = getBackupsDir();
    if (!fs.existsSync(dossier)) return null;
    const fichiers = fs.readdirSync(dossier)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({ f, t: fs.statSync(path.join(dossier, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!fichiers.length) return null;
    return { nom: fichiers[0].f, date: new Date(fichiers[0].t).toLocaleString('fr-CA') };
  } catch { return null; }
}

function dernieresErreurs() {
  try {
    const chemin = path.join(getDataDir(), 'erreurs.log');
    if (!fs.existsSync(chemin)) return [];
    const lignes = fs.readFileSync(chemin, 'utf-8').split('\n').filter((l) => l.trim());
    return lignes.slice(-LIGNES_JOURNAL);
  } catch { return []; }
}

function comptes() {
  // Des COMPTES, jamais de contenu. « 12 clients », jamais qui.
  try {
    const db = openDatabase();
    const n = (t) => {
      try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch { return 0; }
    };
    return {
      artistes: n('artistes'),
      oeuvres: n('oeuvres'),
      clients: n('clients'),
      ventes: n('ventes'),
    };
  } catch { return null; }
}

// `contexte` vient de l'interface : la page ouverte et la taille de l'écran,
// que le processus principal ne connaît pas.
function construireRapport({ description, contexte } = {}) {
  const sauvegarde = derniereSauvegarde();
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    systeme: `${os.type()} ${os.release()} (${os.arch()})`,
    date: new Date().toLocaleString('fr-CA'),
    page: (contexte && contexte.page) || '(inconnue)',
    ecran: (contexte && contexte.ecran) || '',
    catalogue: comptes(),
    derniere_sauvegarde: sauvegarde,
    description: String(description || '').trim(),
    erreurs: dernieresErreurs(),
  };
}

// Le texte lisible, celui que les parents voient et qui part dans le courriel.
function rapportEnTexte(r) {
  const l = [];
  l.push('--- Signalement Galeria ---');
  l.push(`Version    : ${r.version} (Electron ${r.electron})`);
  l.push(`Système    : ${r.systeme}`);
  l.push(`Date       : ${r.date}`);
  l.push(`Page       : ${r.page}${r.ecran ? ` · écran ${r.ecran}` : ''}`);
  if (r.catalogue) {
    const p = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    l.push(`Catalogue  : ${p(r.catalogue.artistes, 'artiste')}, ${p(r.catalogue.oeuvres, 'œuvre')}, `
      + `${p(r.catalogue.clients, 'client')}, ${p(r.catalogue.ventes, 'vente')}`);
  }
  if (r.derniere_sauvegarde) l.push(`Sauvegarde : ${r.derniere_sauvegarde.date}`);
  l.push('');
  l.push('Ce qui s\'est passé :');
  l.push(r.description || '(rien de décrit)');
  if (r.erreurs.length) {
    l.push('');
    l.push(`Journal d'erreurs (${r.erreurs.length} dernières lignes) :`);
    l.push(...r.erreurs);
  }
  return l.join('\n');
}

module.exports = { construireRapport, rapportEnTexte, LIGNES_JOURNAL };
