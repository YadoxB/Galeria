// ===== Chiffrement de la base au repos (volet 2 de la phase Sécurité) =====
// node:sqlite n'a pas de chiffrement natif (pas de SQLCipher). On chiffre donc
// le FICHIER de la base « au repos » : quand l'app est fermée, seul
// `galerie.db.enc` existe ; au démarrage on le déchiffre vers `galerie.db`
// (clair) pour que node:sqlite l'ouvre normalement, et à la fermeture on
// re-chiffre puis on supprime le clair.
//
// Clé : coffre de Windows via safeStorage (DPAPI), même mécanisme que la clé
// API IA. La clé est liée au compte Windows : un fichier copié ailleurs est
// illisible (c'est le but). Pendant l'exécution, la base est en clair sur le
// disque (limite de node:sqlite) — couvert par BitLocker au niveau disque.
//
// Choix arrêté avec Dave (2026-06-30) : les SAUVEGARDES restent EN CLAIR
// (protégées par BitLocker + clé USB chiffrée hors-site, cf. CLAUDE.md §10),
// pour que la récupération après sinistre ne dépende pas du compte Windows.

const fs = require('node:fs');
const { safeStorage } = require('electron');
const { getDbPath, ensureDirectories } = require('./paths');

function encPath() { return getDbPath() + '.enc'; }
function walPath() { return getDbPath() + '-wal'; }
function shmPath() { return getDbPath() + '-shm'; }

function chiffrementDisponible() {
  try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
}

function estActif() {
  try { return require('../config').obtenirConfig().securite?.chiffrement_actif === true; }
  catch { return false; }
}

// Écrit de façon atomique (fichier .tmp puis renommage).
function ecrireAtomique(dest, buffer) {
  const tmp = dest + '.tmp';
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, dest);
}

// Chiffre un fichier binaire (base64 → safeStorage → blob) vers dest.
function chiffrerFichier(src, dest) {
  if (!chiffrementDisponible()) throw new Error("Le coffre de chiffrement n'est pas disponible.");
  const b64 = fs.readFileSync(src).toString('base64');
  const blob = safeStorage.encryptString(b64); // Buffer
  ecrireAtomique(dest, blob);
}

// Déchiffre un blob safeStorage vers un fichier binaire dest.
function dechiffrerFichier(srcEnc, destPlain) {
  if (!chiffrementDisponible()) throw new Error("Le coffre de chiffrement n'est pas disponible.");
  const blob = fs.readFileSync(srcEnc);
  const b64 = safeStorage.decryptString(blob);
  ecrireAtomique(destPlain, Buffer.from(b64, 'base64'));
}

function supprimerSiPresent(p) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

// À appeler AVANT openDatabase() au démarrage. Garantit qu'un `galerie.db`
// clair exploitable est en place quand le chiffrement est actif.
function preparerBaseAuDemarrage() {
  if (!estActif()) return; // mode clair : openDatabase gère la copie du seed
  ensureDirectories();
  const db = getDbPath();
  const enc = encPath();
  // 1. Un clair existe déjà (reliquat d'un plantage) : il est le plus récent,
  //    on le garde tel quel (il sera re-chiffré à la prochaine fermeture).
  if (fs.existsSync(db)) return;
  // 2. Sinon, déchiffrer le coffre si présent.
  if (fs.existsSync(enc)) {
    if (!chiffrementDisponible()) {
      throw new Error(
        "La base est chiffrée mais le coffre de Windows n'est pas accessible " +
        "(session ou compte différent). Impossible de l'ouvrir sur cet ordinateur."
      );
    }
    dechiffrerFichier(enc, db);
    return;
  }
  // 3. Ni clair ni coffre : openDatabase copiera le seed (premier lancement).
}

// À appeler APRÈS closeDatabase() à la fermeture. Re-chiffre la base et
// supprime le clair. En cas d'échec, on CONSERVE le clair (pas de perte).
function finaliserBaseALaFermeture() {
  if (!estActif()) return;
  if (!chiffrementDisponible()) {
    console.error('Chiffrement indisponible à la fermeture : la base reste en clair.');
    return;
  }
  const db = getDbPath();
  if (!fs.existsSync(db)) return;
  try {
    chiffrerFichier(db, encPath());
  } catch (e) {
    console.error('Échec du chiffrement à la fermeture, base laissée en clair :', e);
    return;
  }
  // Chiffrement réussi : retirer le clair et les fichiers WAL/SHM résiduels.
  supprimerSiPresent(db);
  supprimerSiPresent(walPath());
  supprimerSiPresent(shmPath());
}

// Active le chiffrement (depuis Réglages). Crée immédiatement le coffre à
// partir de la base vive (après checkpoint WAL) pour une protection effective
// dès maintenant ; le clair de la session courante est conservé (re-chiffré et
// supprimé à la fermeture).
function activerChiffrement() {
  if (!chiffrementDisponible()) {
    throw new Error("Le coffre de chiffrement n'est pas disponible sur cet ordinateur.");
  }
  // Vide le WAL dans le fichier principal pour un instantané cohérent.
  try { require('./database').openDatabase().exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
  const db = getDbPath();
  if (fs.existsSync(db)) chiffrerFichier(db, encPath());
  require('../config').mettreAJourConfig({ securite: { chiffrement_actif: true } });
  return etatChiffrement();
}

// Désactive le chiffrement : le clair de la session reste en place, on retire
// le coffre et le drapeau. (Pensez à BitLocker pour la protection au repos.)
function desactiverChiffrement() {
  supprimerSiPresent(encPath());
  require('../config').mettreAJourConfig({ securite: { chiffrement_actif: false } });
  return etatChiffrement();
}

function etatChiffrement() {
  return { actif: estActif(), disponible: chiffrementDisponible() };
}

// Retire le coffre chiffré (utilisé quand la base claire est remplacée, ex.
// chargement d'un nouveau catalogue).
function supprimerCoffreSiPresent() {
  supprimerSiPresent(encPath());
}

module.exports = {
  chiffrementDisponible,
  estActif,
  chiffrerFichier,
  dechiffrerFichier,
  preparerBaseAuDemarrage,
  finaliserBaseALaFermeture,
  activerChiffrement,
  desactiverChiffrement,
  etatChiffrement,
  supprimerCoffreSiPresent,
  encPath,
};
