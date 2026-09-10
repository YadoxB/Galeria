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
// « Windows_NT 10.0.26200 » est le nom que Node donne au système ; personne ne
// l'écrit ainsi. On garde le numéro de version — il sert au diagnostic — mais
// sous un nom qui se lit.
function systemeLisible() {
  const brut = `${os.release()} (${os.arch()})`;
  if (os.type() === 'Windows_NT') {
    // 10.0.22000 et au-delà = Windows 11 (Microsoft n'a pas changé le 10.0).
    const build = parseInt((os.release().split('.')[2] || '0'), 10);
    return `Windows ${build >= 22000 ? '11' : '10'} — ${brut}`;
  }
  return `${os.type()} ${brut}`;
}

function construireRapport({ description, contexte } = {}) {
  const sauvegarde = derniereSauvegarde();
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    systeme: systemeLisible(),
    // Une date qui se lit à voix haute plutôt qu'un horodatage.
    date: new Date().toLocaleString('fr-CA', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    page: (contexte && contexte.page) || '(inconnue)',
    ecran: (contexte && contexte.ecran) || '',
    catalogue: comptes(),
    derniere_sauvegarde: sauvegarde,
    description: String(description || '').trim(),
    erreurs: dernieresErreurs(),
  };
}

// Le texte lisible : celui que les parents relisent avant l'envoi, et celui que
// Dave reçoit.
//
// L'ordre compte. La première version commençait par « Version / Système /
// Date » : Dave devait traverser quatre lignes de numéros avant d'apprendre ce
// qui s'était passé, et l'endroit où ça s'était passé se perdait au milieu.
// Désormais : CE QUI S'EST PASSÉ, puis OÙ, puis QUAND — et tout le technique
// est rejeté à la fin, sous une ligne qui dit clairement qu'on peut s'arrêter
// là (Dave, 2026-09-08 : « moins technique et plus clair pour moi »).
//
// Les parents relisent ce texte : il doit rester lisible pour eux aussi.
function rapportEnTexte(r) {
  const l = [];
  l.push('CE QUI S\'EST PASSÉ');
  l.push(r.description || '(rien de décrit)');
  l.push('');
  l.push(`OÙ     ${r.page || '(page inconnue)'}`);
  l.push(`QUAND  ${r.date}`);
  l.push('');
  l.push('— — — Détails techniques — — —');
  l.push(`Galeria ${r.version} · Electron ${r.electron}`);
  l.push(`${r.systeme}${r.ecran ? ` · écran ${r.ecran}` : ''}`);
  if (r.catalogue) {
    const p = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
    l.push(`Catalogue : ${p(r.catalogue.artistes, 'artiste')}, ${p(r.catalogue.oeuvres, 'œuvre')}, `
      + `${p(r.catalogue.clients, 'client')}, ${p(r.catalogue.ventes, 'vente')}`);
  }
  l.push(`Dernière sauvegarde : ${r.derniere_sauvegarde ? r.derniere_sauvegarde.date : 'aucune trouvée'}`);
  if (r.erreurs.length) {
    l.push('');
    l.push(`Dernières erreurs enregistrées (${r.erreurs.length}) :`);
    l.push(...r.erreurs);
  } else {
    l.push('Aucune erreur enregistrée dans le journal.');
  }
  return l.join('\n');
}

module.exports = { construireRapport, rapportEnTexte, LIGNES_JOURNAL };
