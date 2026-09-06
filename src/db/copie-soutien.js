// « Copie pour le soutien » : un exemplaire du catalogue à envoyer à Dave pour
// qu'il puisse reproduire un problème depuis chez lui.
//
// ─────────────────────────────────────────────────────────────────────────
// LA RÈGLE, ET ELLE N'EST PAS NÉGOCIABLE
//
// Aucune donnée de client ne quitte l'ordinateur (Loi 25 ; CLAUDE.md §3 et §9).
// La copie garde le CATALOGUE — artistes, œuvres, expositions — et vide tout
// ce qui touche à une personne : clients, ventes, certificats, annexes.
//
// Ce qui rend l'outil utile malgré ça : le STATUT d'une œuvre vit dans la
// table des œuvres, pas dans la vente. Une toile vendue reste donc marquée
// vendue. Dave retrouve le catalogue dans l'état exact où les parents le
// voient, sans savoir À QUI quoi que ce soit a été vendu.
//
// ⚠ Si une table est ajoutée au schéma un jour, elle doit être classée ICI :
// gardée ou vidée. Une table oubliée serait gardée par défaut — et pourrait
// contenir des données personnelles. Le garde-fou `verifierCouverture()`
// échoue si une table du schéma n'est classée nulle part.
// ─────────────────────────────────────────────────────────────────────────

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { getDbPath } = require('./paths');

// Tables conservées telles quelles : aucune donnée personnelle.
const TABLES_GARDEES = [
  'artistes',
  'oeuvres',
  'expositions',
  'exposition_oeuvres',
  'web_sync_ignore',
  'web_sync_ignore_artiste',
  'meta',
];

// Tables vidées : elles portent des renseignements sur des personnes.
const TABLES_VIDEES = [
  'clients',      // noms, adresses, courriels, consentements
  'ventes',       // qui a acheté quoi, à quel prix, comment il a payé
  'certificats',  // le nom de l'acheteur y figure
  'annexes',      // documents de consignation signés
];

// ⚠ L'ORDRE compte : les clés étrangères restent actives pendant l'expurgation
// (on veut qu'un lien oublié fasse échouer la copie plutôt que de la laisser
// incohérente). Il faut donc vider les tables ENFANTS d'abord :
//   certificats → ventes, oeuvres
//   ventes      → oeuvres, clients
//   clients     → (personne)
// Supprimer `clients` en premier échoue avec « FOREIGN KEY constraint failed ».
const ORDRE_SUPPRESSION = ['certificats', 'annexes', 'ventes', 'clients'];

// Colonnes qui pointeraient dans le vide une fois les tables vidées.
const LIENS_A_COUPER = [
  ['oeuvres', 'reservation_client_id'],
  ['oeuvres', 'reservation_date'],
  ['oeuvres', 'reservation_echeance'],
  ['oeuvres', 'reservation_notes'],
];

// Toute table du schéma doit être classée quelque part. Sans ce garde-fou,
// une table ajoutée plus tard partirait dans la copie sans que personne l'ait
// décidé.
function verifierCouverture(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
  const classees = new Set([...TABLES_GARDEES, ...TABLES_VIDEES]);
  const oubliees = tables.filter((t) => !classees.has(t));
  if (oubliees.length) {
    throw new Error(
      `Copie pour le soutien impossible : ${oubliees.join(', ')} `
      + `${oubliees.length > 1 ? 'ne sont classées' : "n'est classée"} ni « gardée » ni « vidée » `
      + '(voir src/db/copie-soutien.js). Par prudence, rien n\'a été produit.'
    );
  }
  return tables;
}

// Ce que la copie contiendra et ne contiendra pas — affiché AVANT de produire
// quoi que ce soit, pour que personne n'envoie un fichier sans savoir.
function apercuCopieSoutien() {
  const db = new DatabaseSync(getDbPath(), { readOnly: true });
  try {
    verifierCouverture(db);
    const compter = (t) => {
      try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch { return 0; }
    };
    return {
      gardees: [
        { table: 'artistes', n: compter('artistes') },
        { table: 'oeuvres', n: compter('oeuvres') },
        { table: 'expositions', n: compter('expositions') },
      ],
      videes: TABLES_VIDEES.map((t) => ({ table: t, n: compter(t) })),
      octets_base: fs.existsSync(getDbPath()) ? fs.statSync(getDbPath()).size : 0,
    };
  } finally {
    try { db.close(); } catch {}
  }
}

// Produit la copie. `destination` : chemin complet du fichier .db à écrire.
function produireCopieSoutien(destination) {
  if (!destination) throw new Error('Aucune destination indiquée.');
  const source = getDbPath();
  if (!fs.existsSync(source)) throw new Error('Base de données introuvable.');

  // On vérifie AVANT de copier : mieux vaut ne rien produire que produire un
  // fichier qu'on refuserait ensuite d'expurger.
  const controle = new DatabaseSync(source, { readOnly: true });
  try { verifierCouverture(controle); } finally { try { controle.close(); } catch {} }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);

  const db = new DatabaseSync(destination);
  const vides = {};
  try {
    // Les clés étrangères restent actives : si un lien empêchait un DELETE,
    // on veut le savoir plutôt que de produire une copie incohérente.
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('BEGIN');
    for (const [table, colonne] of LIENS_A_COUPER) {
      try { db.exec(`UPDATE ${table} SET ${colonne} = NULL`); } catch { /* colonne absente */ }
    }
    for (const t of ORDRE_SUPPRESSION) {
      let n = 0;
      try { n = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch { continue; }
      db.exec(`DELETE FROM ${t}`);
      vides[t] = n;
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    try { db.close(); } catch {}
    try { fs.unlinkSync(destination); } catch {}
    throw new Error(`La copie n'a pas pu être expurgée, elle a été supprimée. Détail : ${err.message}`);
  }

  // VACUUM récupère la place des lignes supprimées. Sans lui, les données
  // effacées resteraient LISIBLES dans les pages libérées du fichier — c'est
  // le point le plus important de cette fonction.
  try { db.exec('VACUUM'); } catch { /* non bloquant : le contenu est déjà retiré */ }

  // Contrôle final sur le fichier produit : on ne se fie pas à l'intention.
  const restes = [];
  for (const t of TABLES_VIDEES) {
    try {
      const n = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
      if (n > 0) restes.push(`${t} (${n})`);
    } catch { /* table absente : rien à vérifier */ }
  }
  try { db.close(); } catch {}
  if (restes.length) {
    try { fs.unlinkSync(destination); } catch {}
    throw new Error(`Des données personnelles subsistaient (${restes.join(', ')}) : la copie a été supprimée.`);
  }

  return {
    chemin: destination,
    octets: fs.statSync(destination).size,
    vides,
  };
}

module.exports = {
  apercuCopieSoutien,
  produireCopieSoutien,
  TABLES_GARDEES,
  TABLES_VIDEES,
};
