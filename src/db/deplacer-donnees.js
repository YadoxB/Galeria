// Moteur de déplacement du dossier de données « Galeria ».
//
// Déplace la base, les photos, les documents, les sauvegardes et la config d'un
// emplacement à un autre. Conçu pour tourner AU DÉMARRAGE, base FERMÉE (donc pas
// de VACUUM INTO ici : la copie de sûreté est une copie brute, comme la copie
// avant-migration de backup.js). Le « papier d'adresse » (userData) n'est mis à
// jour qu'après réussite vérifiée.
//
// Deux chemins :
//   • même disque  → renommage instantané (fs.renameSync) ;
//   • autre disque → copie récursive avec progression + vérification, puis
//     suppression de l'ancien dossier seulement une fois la copie prouvée.
//
// Ce module ne redémarre pas l'app et ne décide pas de la destination : il reçoit
// (source, destination) et renvoie un résultat structuré ou lève une erreur au
// message clair, en français, AVANT tout changement irréversible.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { ecrireEmplacementConfigure } = require('./paths');

const NOM_DB = 'galerie.db';
const NOM_SAUVEGARDES = 'Sauvegardes';

function horodatageCompact(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// enfant est-il égal à parent ou situé à l'intérieur ? (empêche de déplacer un
// dossier dans lui-même). Deux disques différents ⇒ path.relative renvoie un
// chemin absolu ⇒ false.
function estSousDe(enfant, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(enfant));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// Parcourt le dossier : liste des sous-dossiers (pour recréer même les vides) et
// des fichiers avec leur taille, plus le total en octets et le nombre de fichiers.
function inventaire(source) {
  const dossiers = [];
  const fichiers = [];
  let total = 0;
  (function walk(rel) {
    const abs = path.join(source, rel);
    if (rel) dossiers.push(rel);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) {
        const taille = fs.statSync(path.join(source, r)).size;
        fichiers.push({ rel: r, taille });
        total += taille;
      }
      // Les liens symboliques et autres types ne sont pas attendus dans un
      // dossier de données Galeria ; on les ignore volontairement.
    }
  })('');
  return { dossiers, fichiers, total };
}

// Espace libre en octets sur le volume qui contient `dir` (ou son ancêtre
// existant le plus proche). Renvoie null si l'info n'est pas disponible.
function espaceLibre(dir) {
  try {
    let cible = path.resolve(dir);
    while (!fs.existsSync(cible)) {
      const parent = path.dirname(cible);
      if (parent === cible) break;
      cible = parent;
    }
    const st = fs.statfsSync(cible);
    return st.bavail * st.bsize;
  } catch {
    return null;
  }
}

// Vérifie qu'un fichier de base est lisible et cohérent (PRAGMA quick_check).
// Ouvert en écriture pour laisser SQLite rejouer un éventuel journal WAL copié à
// côté ; lève une erreur claire sinon.
function verifierBase(dbPath) {
  let raison = null;
  try {
    if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
      raison = 'le fichier est vide ou absent';
    } else {
      let d = null;
      try {
        d = new DatabaseSync(dbPath);
        const r = d.prepare('PRAGMA quick_check').get();
        if (!r || r.quick_check !== 'ok') raison = `test d'intégrité : ${r ? r.quick_check : 'aucun résultat'}`;
      } finally {
        try { if (d) d.close(); } catch {}
      }
    }
  } catch (e) {
    raison = e.message;
  }
  if (raison) throw new Error(`La base de données n'a pas pu être vérifiée (${raison}).`);
}

function sha256(fichier) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(fichier));
  return h.digest('hex');
}

// Copie de sûreté OBLIGATOIRE avant tout déplacement : copie brute de la base
// (et de ses journaux -wal/-shm s'ils existent) dans le dossier Sauvegardes de la
// SOURCE, puis vérification. Renvoie le chemin de la copie, ou null si la source
// n'a pas encore de base (installation neuve — rien à sauvegarder).
function sauvegardeAvantDeplacement(source, ts = horodatageCompact()) {
  const dbPath = path.join(source, NOM_DB);
  if (!fs.existsSync(dbPath)) return null;
  const dir = path.join(source, NOM_SAUVEGARDES);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `galerie-avant-deplacement-${ts}.db`);
  fs.copyFileSync(dbPath, dest);
  for (const suffixe of ['-wal', '-shm']) {
    try {
      if (fs.existsSync(dbPath + suffixe) && fs.statSync(dbPath + suffixe).size > 0) {
        fs.copyFileSync(dbPath + suffixe, dest + suffixe);
      }
    } catch {}
  }
  verifierBase(dest);
  return dest;
}

// Copie récursive avec progression (0..1). Crée d'abord tous les sous-dossiers
// (même vides), puis copie les fichiers en cumulant les octets pour la barre.
function copierRecursif(source, dest, inv, onProgres) {
  fs.mkdirSync(dest, { recursive: true });
  for (const rel of inv.dossiers) fs.mkdirSync(path.join(dest, rel), { recursive: true });
  let copie = 0;
  for (const { rel, taille } of inv.fichiers) {
    const d = path.join(dest, rel);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.copyFileSync(path.join(source, rel), d);
    copie += taille;
    if (onProgres && inv.total > 0) {
      try { onProgres(copie / inv.total); } catch {}
    }
  }
}

// Vérifie que la copie est complète : même nombre de fichiers, mêmes tailles, et
// empreinte SHA-256 de la base identique (le fichier le plus critique). Lève une
// erreur claire au moindre écart — l'ancien dossier ne sera PAS supprimé.
function verifierCopie(source, dest, inv) {
  for (const { rel, taille } of inv.fichiers) {
    const d = path.join(dest, rel);
    if (!fs.existsSync(d)) throw new Error(`Fichier manquant après copie : ${rel}`);
    const t = fs.statSync(d).size;
    if (t !== taille) throw new Error(`Taille différente après copie : ${rel} (${taille} → ${t} octets)`);
  }
  const dbSource = path.join(source, NOM_DB);
  const dbDest = path.join(dest, NOM_DB);
  if (fs.existsSync(dbSource) && fs.existsSync(dbDest)) {
    if (sha256(dbSource) !== sha256(dbDest)) {
      throw new Error('La base copiée ne correspond pas à l\'originale (empreinte différente).');
    }
  }
}

// Traduit une erreur système de renommage/copie en message clair pour un
// utilisateur non technicien.
function messageErreurDeplacement(e, source) {
  const code = e && e.code;
  if (code === 'EPERM' || code === 'EACCES' || code === 'EBUSY') {
    return (
      "Le dossier de données n'a pas pu être déplacé : un fichier est verrouillé "
      + "(souvent l'Explorateur Windows ouvert sur le dossier, OneDrive en cours de "
      + 'synchronisation, ou un document encore ouvert).\n\n'
      + 'À faire : fermez toutes les fenêtres de l\'Explorateur, mettez OneDrive en '
      + 'pause, puis réessayez. Vos données n\'ont pas été touchées : elles sont '
      + `toujours dans ${source}.`
    );
  }
  if (code === 'ENOSPC') {
    return (
      "Le déplacement a échoué faute d'espace disque suffisant à destination. "
      + `Vos données n'ont pas été touchées : elles sont toujours dans ${source}.`
    );
  }
  return (
    'Le déplacement du dossier de données a échoué. Vos données n\'ont pas été '
    + `touchées : elles sont toujours dans ${source}.\n\nDétail technique : ${String((e && e.message) || e)}`
  );
}

// Déplace le dossier de données de `source` vers `destination`.
// Options : onProgres(fraction 0..1) pendant la copie ; ts pour un horodatage
// déterministe (tests). Renvoie :
//   { ok:true, mode:'rename'|'copie', source, destination, backup,
//     sourceSupprimee, avertissement }
// Lève une Error au message clair en cas d'échec (données laissées intactes).
function deplacerDossierDonnees(source, destination, options = {}) {
  const { onProgres = null, ts } = options;
  const src = path.resolve(String(source || ''));
  const dst = path.resolve(String(destination || ''));

  // --- Contrôles préalables (aucun changement tant qu'ils ne passent pas) ---
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`Le dossier de données source est introuvable : ${src}`);
  }
  if (!dst || !path.isAbsolute(dst)) {
    throw new Error('La destination doit être un chemin de dossier complet.');
  }
  if (src.toLowerCase() === dst.toLowerCase()) {
    throw new Error('La destination est identique à l\'emplacement actuel : rien à déplacer.');
  }
  if (estSousDe(dst, src)) {
    throw new Error('On ne peut pas déplacer le dossier de données à l\'intérieur de lui-même.');
  }
  if (fs.existsSync(dst)) {
    if (!fs.statSync(dst).isDirectory()) {
      throw new Error(`Un fichier porte déjà le nom de la destination : ${dst}`);
    }
    if (fs.readdirSync(dst).length > 0) {
      throw new Error(
        `Le dossier de destination existe déjà et n'est pas vide : ${dst}\n\n`
        + 'Choisissez un autre emplacement, ou videz ce dossier d\'abord. '
        + '(Pour utiliser un dossier Galeria déjà existant sans rien déplacer, '
        + 'utilisez plutôt « Utiliser un dossier existant ».)'
      );
    }
  }

  // --- Sauvegarde d'abord, toujours (mandat de Dave) ---
  // Créée AVANT l'inventaire, pour qu'elle soit incluse dans la copie (mode
  // copie) et voyage donc, comme le reste, vers le nouvel emplacement.
  const backup = sauvegardeAvantDeplacement(src, ts || horodatageCompact());

  const inv = inventaire(src);

  // Espace disque : contrôlé seulement si la destination est sur un autre volume
  // (une copie s'annonce). On garde une marge de 5 %.
  const memeRacine = path.parse(src).root.toLowerCase() === path.parse(dst).root.toLowerCase();
  if (!memeRacine) {
    const libre = espaceLibre(path.dirname(dst));
    if (libre !== null && libre < inv.total * 1.05) {
      const go = (n) => (n / (1024 * 1024 * 1024)).toFixed(2);
      throw new Error(
        `Espace disque insuffisant à destination : il faut environ ${go(inv.total)} Go `
        + `et il n'en reste que ${go(libre)} Go. Libérez de l'espace ou choisissez un autre disque.`
      );
    }
  }

  // --- Déplacement : renommage rapide, repli sur copie si autre disque ---
  // Windows refuse de renommer SUR un dossier existant, même vide (contrairement
  // à Linux/Mac). Le dossier vide autorisé par le garde-fou plus haut est retiré
  // ici pour que le renommage (ou la copie) puisse le recréer proprement.
  if (fs.existsSync(dst)) {
    try { fs.rmdirSync(dst); } catch {}
  }
  let mode;
  try {
    fs.renameSync(src, dst);
    mode = 'rename';
  } catch (e) {
    if (e.code !== 'EXDEV') {
      throw new Error(messageErreurDeplacement(e, src));
    }
    // Autre disque : copie récursive vérifiée, puis suppression de la source.
    mode = 'copie';
    try {
      copierRecursif(src, dst, inv, onProgres);
      verifierCopie(src, dst, inv);
    } catch (err) {
      // Copie ratée : on retire la copie partielle, la source reste intacte.
      try { fs.rmSync(dst, { recursive: true, force: true }); } catch {}
      throw new Error(messageErreurDeplacement(err, src));
    }
  }

  // --- Le déplacement a réussi et est vérifié : on met à jour le papier d'adresse ---
  ecrireEmplacementConfigure(dst);

  // --- Nettoyage de l'ancien dossier (copie seulement ; le renommage l'a déjà retiré) ---
  let sourceSupprimee = true;
  let avertissement = null;
  if (mode === 'copie') {
    try {
      fs.rmSync(src, { recursive: true, force: true });
    } catch (e) {
      sourceSupprimee = false;
      avertissement =
        "Vos données ont bien été copiées et vérifiées au nouvel emplacement, mais "
        + "l'ancien dossier n'a pas pu être supprimé automatiquement (souvent parce "
        + "qu'il est verrouillé par OneDrive ou l'Explorateur). Ce n'est pas grave : "
        + `vous pourrez supprimer l'ancien dossier à la main plus tard :\n${src}`;
    }
  }

  // La copie de sûreté a voyagé avec le dossier : son chemin final est sous la
  // destination (renommage) ou y a été copiée (copie vérifiée).
  const backupFinal = backup ? path.join(dst, path.relative(src, backup)) : null;

  return { ok: true, mode, source: src, destination: dst, backup: backupFinal, sourceSupprimee, avertissement };
}

module.exports = {
  deplacerDossierDonnees,
  // Exposés pour le banc d'essai et la validation côté écran (Pas C) :
  estSousDe,
  inventaire,
  espaceLibre,
  sauvegardeAvantDeplacement,
  verifierBase,
};
