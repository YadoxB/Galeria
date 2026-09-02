const { openDatabase } = require('./database');
const { obtenirArtiste, obtenirOeuvre, obtenirClient, obtenirVente, obtenirCertificat, obtenirExposition } = require('./requetes');
const { obtenirConfig, mettreAJourConfig } = require('../config');
const { construireNomFichier } = require('./nomenclature');

const vide = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const bool = (v) => (v ? 1 : 0);
const nombre = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const entier = (v) => {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
};

// ===== Garde-fous de valeurs (dernier rempart : protège toutes les voies,
// y compris l'édition en lot et un futur import) =====
// Rejette une valeur négative avec un message clair nommant le champ. `valeur`
// est déjà normalisée (null accepté = champ laissé vide).
const exigerPositifOuNul = (valeur, libelle) => {
  if (valeur != null && valeur < 0) {
    throw new Error(`${libelle} : une valeur négative n'est pas permise.`);
  }
};
// Une année saisie doit être un nombre à quatre chiffres plausible.
const exigerAnneePlausible = (annee) => {
  if (annee != null && (annee < 1000 || annee > 2999)) {
    throw new Error("L'année doit être un nombre à quatre chiffres (par exemple 2024).");
  }
};

const STATUTS_VALIDES = new Set(['disponible', 'reserve', 'vendu', 'pretee', 'exposee']);

// ===== Dérivés des dimensions (mêmes règles que le formulaire d'œuvre) =====
// Seuils empiriques calés sur 476 œuvres déjà étiquetées (cf.
// scripts/analyse-seuils-format.js). La profondeur est ignorée (châssis).
//
// ⚠ COPIE MIROIR de `src/app/calcul-prix.js` (côté interface, ESM), qui sert
// à la fiche d'œuvre et au calculateur. Les deux copies existent parce que le
// processus principal (CommonJS) et l'interface (modules ES) ne partagent pas
// de module. Toute modification doit être reportée dans les DEUX fichiers.
const SEUILS_FORMAT = [
  { max: 16, libelle: 'Petit' },
  { max: 30, libelle: 'Moyen' },
  { max: 42, libelle: 'Grand' },
  { max: Infinity, libelle: 'Très grand' },
];
function calculerFormat(h, l) {
  const H = Number(h) || 0;
  const L = Number(l) || 0;
  if (H <= 0 || L <= 0) return '';
  const equivalent = Math.sqrt(H * L);
  for (const seuil of SEUILS_FORMAT) {
    if (equivalent <= seuil.max) return seuil.libelle;
  }
  return '';
}
function calculerOrientation(h, l) {
  const H = Number(h) || 0;
  const L = Number(l) || 0;
  if (H <= 0 || L <= 0) return '';
  if (L > H * 1.05) return 'Horizontale';
  if (H > L * 1.05) return 'Verticale';
  return 'Carrée';
}
function formaterDimensionsTexte(h, l, p) {
  const arr = [h, l, p].map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const visibles = arr[2] != null ? arr : arr.slice(0, 2);
  if (!visibles.some((v) => v != null)) return '';
  return visibles.map((v) => (v != null ? String(v) : '?')).join(' × ') + ' po';
}

// ⚠ Doit rester aligné avec TAILLES_COTES de src/app/calcul-prix.js (interface).
// « Hors normes » = taille attribuée à la main, jamais calculée.
const TAILLES_COTES = new Set(['Tous', 'Petit', 'Moyen', 'Grand', 'Très grand', 'Hors normes']);
const UNITES_COTES = new Set(['lineaire', 'carre']);

const normaliserCotes = (v) => {
  if (v == null || v === '') return null;
  let arr;
  try {
    arr = typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    throw new Error('Cotes : format invalide.');
  }
  if (!Array.isArray(arr)) throw new Error('Cotes : doit être une liste.');
  const nettoye = arr
    .map((item) => {
      const medium = vide(item?.medium) || 'Tous';
      const taille = vide(item?.taille);
      const unite = vide(item?.unite);
      const prixPref = nombre(item?.prix_pref);
      if (taille && !TAILLES_COTES.has(taille)) {
        throw new Error(`Taille de cote invalide : ${taille}.`);
      }
      if (unite && !UNITES_COTES.has(unite)) {
        throw new Error(`Unité de cote invalide : ${unite}.`);
      }
      return {
        medium,
        taille: taille || 'Tous',
        unite: unite || 'lineaire',
        prix_pref: prixPref,
      };
    })
    .filter((item) => item.prix_pref != null && item.prix_pref > 0);
  return nettoye.length ? JSON.stringify(nettoye) : null;
};

const normaliserNumerosTaxes = (v) => {
  if (v == null || v === '') return null;
  let arr;
  try {
    arr = typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    throw new Error('Numéros de taxes : format invalide.');
  }
  if (!Array.isArray(arr)) throw new Error('Numéros de taxes : doit être une liste.');
  const nettoye = arr
    .map((item) => ({
      etiquette: vide(item?.etiquette) || 'Taxe',
      numero: vide(item?.numero),
    }))
    .filter((item) => item.numero);
  return nettoye.length ? JSON.stringify(nettoye) : null;
};

const COLONNES_ARTISTE = [
  ['nom', vide],
  ['prenom', vide],
  ['type', vide],
  ['prefixe_inventaire', vide],
  ['citation', vide],
  ['biographie', vide],
  ['demarche', vide],
  ['curriculum', vide],
  ['courriel', vide],
  ['telephone', vide],
  ['adresse', vide],
  ['province', vide],
  ['pays', vide],
  ['langue', vide],
  ['percoit_taxes', bool],
  ['numeros_taxes', normaliserNumerosTaxes],
  ['notes', vide],
  ['instructions_ia', vide],
  ['lien_chatgpt', vide],
  ['cotes', normaliserCotes],
];

const COLONNES_OEUVRE = [
  ['artiste_id', entier],
  ['titre', vide],
  ['type', vide],
  ['numero_inventaire', vide],
  ['numero_delivrance', vide],
  ['annee', entier],
  ['medium', vide],
  ['support', vide],
  ['dimensions', vide],
  ['hauteur', nombre],
  ['largeur', nombre],
  ['profondeur', nombre],
  ['format', vide],
  ['orientation', vide],
  ['style', vide],
  ['sujets', vide],
  ['emplacement_signature', vide],
  ['particularite', vide],
  ['description', vide],
  ['prix', nombre],
  ['frais_production', nombre],
  ['statut', vide],
  ['emplacement', vide],
  ['exposition_actuelle', vide],
  ['url_site', vide],
  ['cote_hors_normes', bool],
  // Jalon 3 — préparation (Sage → Stock → Site)
  ['sage_cree', bool],
  ['sage_cree_date', vide],
  ['stock_fait', bool],
  ['stock_fait_date', vide],
  ['site_publie', bool],
  ['site_publie_date', vide],
];

function modifierArtiste(id, data) {
  if (!vide(data.nom)) throw new Error("Le nom de l'artiste est requis.");
  const db = openDatabase();
  const cols = COLONNES_ARTISTE.map(([c]) => c);
  const valeurs = COLONNES_ARTISTE.map(([c, n]) => n(data[c]));
  const set = cols.map((c) => `${c} = ?`).join(', ');
  db.prepare(
    `UPDATE artistes SET ${set}, modifie_le = datetime('now') WHERE id = ?`
  ).run(...valeurs, id);
  return obtenirArtiste(id);
}

function creerArtiste(data) {
  if (!vide(data.nom)) throw new Error("Le nom de l'artiste est requis.");
  const db = openDatabase();
  const cols = COLONNES_ARTISTE.map(([c]) => c);
  const valeurs = COLONNES_ARTISTE.map(([c, n]) => n(data[c]));
  const colNames = cols.join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const info = db.prepare(`INSERT INTO artistes (${colNames}) VALUES (${placeholders})`).run(...valeurs);
  return obtenirArtiste(info.lastInsertRowid);
}

function supprimerArtiste(id) {
  const db = openDatabase();
  const nbOeuvres = db.prepare('SELECT COUNT(*) AS n FROM oeuvres WHERE artiste_id = ?').get(id).n;
  if (nbOeuvres > 0) {
    throw new Error(`Impossible de supprimer cet artiste : ${nbOeuvres} œuvre(s) y sont attachée(s). Supprime ou réattribue d'abord ces œuvres.`);
  }
  const info = db.prepare('DELETE FROM artistes WHERE id = ?').run(id);
  return { supprime: info.changes > 0 };
}

function _valeursOeuvre(data) {
  if (!vide(data.titre)) throw new Error("Le titre de l'œuvre est requis.");
  if (!entier(data.artiste_id)) throw new Error("Un artiste doit être sélectionné.");
  const statut = vide(data.statut);
  if (statut && !STATUTS_VALIDES.has(statut)) {
    throw new Error(`Statut invalide : ${statut}.`);
  }
  exigerPositifOuNul(nombre(data.prix), 'Prix');
  exigerPositifOuNul(nombre(data.frais_production), 'Frais de production');
  exigerPositifOuNul(nombre(data.hauteur), 'Hauteur');
  exigerPositifOuNul(nombre(data.largeur), 'Largeur');
  exigerPositifOuNul(nombre(data.profondeur), 'Profondeur');
  exigerAnneePlausible(entier(data.annee));
  const cols = COLONNES_OEUVRE.map(([c]) => c);
  const valeurs = COLONNES_OEUVRE.map(([c, n]) => n(data[c]));
  const idxStatut = cols.indexOf('statut');
  if (!valeurs[idxStatut]) valeurs[idxStatut] = 'disponible';
  const idxTitre = cols.indexOf('titre');
  if (!valeurs[idxTitre]) valeurs[idxTitre] = String(data.titre).trim();
  return { cols, valeurs };
}

function modifierOeuvre(id, data) {
  const { cols, valeurs } = _valeursOeuvre(data);
  const db = openDatabase();
  const set = cols.map((c) => `${c} = ?`).join(', ');
  db.prepare(
    `UPDATE oeuvres SET ${set}, modifie_le = datetime('now') WHERE id = ?`
  ).run(...valeurs, id);
  return obtenirOeuvre(id);
}

// Mise à jour d'UN SEUL champ d'une œuvre, via une liste blanche stricte. Sert à
// l'import « tirer » depuis le site (Phase 5) : contrairement à modifierOeuvre,
// qui réécrit toute la ligne, ceci ne touche QUE la colonne visée — les autres
// champs (dimensions, statut, image…) restent intacts.
const CHAMPS_IMPORT_WEB = new Set(['titre', 'description', 'prix']);
function majChampOeuvre(id, champ, valeur) {
  const oid = entier(id);
  if (oid == null) throw new Error('Identifiant invalide.');
  if (!CHAMPS_IMPORT_WEB.has(champ)) throw new Error(`Champ non autorisé : ${champ}.`);
  let v;
  if (champ === 'prix') {
    v = (valeur == null || valeur === '') ? null : nombre(valeur);
    exigerPositifOuNul(v, 'Prix');
  } else if (champ === 'titre') {
    v = vide(valeur);
    if (!v) throw new Error("Le titre ne peut pas être vide.");
  } else {
    // description : texte simple, vide autorisé (null si vraiment vide).
    v = vide(valeur) || null;
  }
  const db = openDatabase();
  const info = db.prepare(
    `UPDATE oeuvres SET ${champ} = ?, modifie_le = datetime('now') WHERE id = ?`
  ).run(v, oid);
  if (!info.changes) throw new Error('Œuvre introuvable.');
  return obtenirOeuvre(oid);
}

// Synchro site : mémorise « garder la version de l'app » pour un champ, en
// enregistrant la clé de la valeur du site alors présentée. Upsert (une entrée
// par œuvre + champ ; une nouvelle valeur du site remplacera la clé).
function ignorerDiffWeb(oeuvreId, champ, siteCle) {
  const oid = entier(oeuvreId);
  if (oid == null) throw new Error('Identifiant invalide.');
  const c = vide(champ);
  if (!c) throw new Error('Champ manquant.');
  const db = openDatabase();
  db.prepare(`
    INSERT INTO web_sync_ignore (oeuvre_id, champ, site_cle, cree_le)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(oeuvre_id, champ) DO UPDATE SET site_cle = excluded.site_cle, cree_le = datetime('now')
  `).run(oid, c, String(siteCle == null ? '' : siteCle));
  return { ok: true };
}

// Annule un « garder » (la différence pourra de nouveau être proposée).
function retirerIgnoreWeb(oeuvreId, champ) {
  const oid = entier(oeuvreId);
  if (oid == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  db.prepare('DELETE FROM web_sync_ignore WHERE oeuvre_id = ? AND champ = ?').run(oid, vide(champ));
  return { ok: true };
}

// --- Artistes : mêmes mécanismes, table web_sync_ignore_artiste ---
const CHAMPS_IMPORT_ARTISTE = new Set(['citation', 'biographie', 'demarche', 'curriculum']);
function majChampArtiste(id, champ, valeur) {
  const aid = entier(id);
  if (aid == null) throw new Error('Identifiant invalide.');
  if (!CHAMPS_IMPORT_ARTISTE.has(champ)) throw new Error(`Champ non autorisé : ${champ}.`);
  const v = vide(valeur) || null;
  const db = openDatabase();
  const info = db.prepare(
    `UPDATE artistes SET ${champ} = ?, modifie_le = datetime('now') WHERE id = ?`
  ).run(v, aid);
  if (!info.changes) throw new Error('Artiste introuvable.');
  return obtenirArtiste(aid);
}
function ignorerDiffArtisteWeb(artisteId, champ, siteCle) {
  const aid = entier(artisteId);
  if (aid == null) throw new Error('Identifiant invalide.');
  const c = vide(champ);
  if (!c) throw new Error('Champ manquant.');
  const db = openDatabase();
  db.prepare(`
    INSERT INTO web_sync_ignore_artiste (artiste_id, champ, site_cle, cree_le)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(artiste_id, champ) DO UPDATE SET site_cle = excluded.site_cle, cree_le = datetime('now')
  `).run(aid, c, String(siteCle == null ? '' : siteCle));
  return { ok: true };
}
function retirerIgnoreArtisteWeb(artisteId, champ) {
  const aid = entier(artisteId);
  if (aid == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  db.prepare('DELETE FROM web_sync_ignore_artiste WHERE artiste_id = ? AND champ = ?').run(aid, vide(champ));
  return { ok: true };
}

// Corrige le numéro d'inventaire d'une œuvre pour l'aligner sur le SKU du site
// (cas d'une coquille de SKU : on rattache l'œuvre existante au produit plutôt
// que d'en créer un doublon). Refuse si le numéro est déjà pris par une autre œuvre.
function corrigerNumeroInventaire(id, sku) {
  const oid = entier(id);
  if (oid == null) throw new Error('Identifiant invalide.');
  const s = vide(sku);
  if (!s) throw new Error('Le numéro d\'inventaire (SKU) est vide.');
  const db = openDatabase();
  const autre = db.prepare('SELECT id FROM oeuvres WHERE numero_inventaire = ? AND id <> ?').get(s, oid);
  if (autre) throw new Error(`Le numéro « ${s} » est déjà utilisé par une autre œuvre.`);
  const info = db.prepare(
    `UPDATE oeuvres SET numero_inventaire = ?, modifie_le = datetime('now') WHERE id = ?`
  ).run(s, oid);
  if (!info.changes) throw new Error('Œuvre introuvable.');
  return obtenirOeuvre(oid);
}

// Met à jour l'étiquette de statut d'une œuvre (réconciliation avec le site).
// Ne touche QUE la colonne statut ; n'enregistre pas de vente. Validation stricte.
function majStatutOeuvre(id, statut) {
  const oid = entier(id);
  if (oid == null) throw new Error('Identifiant invalide.');
  const st = vide(statut);
  if (!st || !STATUTS_VALIDES.has(st)) throw new Error(`Statut invalide : ${statut}.`);
  const db = openDatabase();
  const info = db.prepare(
    `UPDATE oeuvres SET statut = ?, modifie_le = datetime('now') WHERE id = ?`
  ).run(st, oid);
  if (!info.changes) throw new Error('Œuvre introuvable.');
  return obtenirOeuvre(oid);
}

function creerOeuvre(data) {
  const { cols, valeurs } = _valeursOeuvre(data);
  const db = openDatabase();
  const colNames = cols.join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const info = db.prepare(`INSERT INTO oeuvres (${colNames}) VALUES (${placeholders})`).run(...valeurs);
  return obtenirOeuvre(info.lastInsertRowid);
}

// ===== Édition en lot — mise à jour partielle de plusieurs œuvres =====

// Colonnes modifiables en lot (sous-ensemble de COLONNES_OEUVRE). Tout autre
// champ reçu est ignoré silencieusement (garde-fou).
const COLS_OEUVRE_MAP = new Map(COLONNES_OEUVRE);
const COLS_LOT_AUTORISEES = new Set([
  'titre', 'numero_inventaire', 'annee', 'type',
  'medium', 'support', 'hauteur', 'largeur', 'profondeur',
  'prix', 'statut', 'emplacement', 'exposition_actuelle', 'style',
]);

// Met à jour, en une seule transaction, plusieurs œuvres — chacune avec
// uniquement les champs réellement modifiés. `modifs` = [{ id, champs:{col:val} }].
// Quand une dimension (H/L/P) change, on régénère le texte des dimensions et,
// si format/orientation n'ont pas été saisis à la main, on les recalcule —
// exactement comme le formulaire d'une œuvre.
function modifierOeuvresLot(modifs) {
  const liste = Array.isArray(modifs) ? modifs : [];
  if (!liste.length) return { modifiees: 0 };
  const db = openDatabase();
  let n = 0;
  db.exec('BEGIN');
  try {
    for (const m of liste) {
      const id = entier(m && m.id);
      if (id == null) continue;
      const champs = (m && m.champs && typeof m.champs === 'object') ? m.champs : {};
      const cols = [];
      const valeurs = [];
      const set = (col, val) => { cols.push(col); valeurs.push(val); };

      let toucheDim = false;
      for (const [col, brut] of Object.entries(champs)) {
        if (!COLS_LOT_AUTORISEES.has(col)) continue;
        const norm = COLS_OEUVRE_MAP.get(col);
        if (!norm) continue;
        if (col === 'statut') {
          const s = vide(brut);
          if (s && !STATUTS_VALIDES.has(s)) throw new Error(`Statut invalide : ${s}.`);
          set('statut', s || 'disponible');
          continue;
        }
        if (col === 'titre') {
          const t = vide(brut);
          if (!t) throw new Error("Le titre d'une œuvre ne peut pas être vide.");
          set('titre', t);
          continue;
        }
        if (col === 'hauteur' || col === 'largeur' || col === 'profondeur') toucheDim = true;
        const valNorm = norm(brut);
        if (col === 'prix') exigerPositifOuNul(valNorm, 'Prix');
        if (col === 'hauteur') exigerPositifOuNul(valNorm, 'Hauteur');
        if (col === 'largeur') exigerPositifOuNul(valNorm, 'Largeur');
        if (col === 'profondeur') exigerPositifOuNul(valNorm, 'Profondeur');
        if (col === 'annee') exigerAnneePlausible(valNorm);
        set(col, valNorm);
      }

      if (toucheDim) {
        const actuel = obtenirOeuvre(id) || {};
        const idxH = cols.indexOf('hauteur');
        const idxL = cols.indexOf('largeur');
        const idxP = cols.indexOf('profondeur');
        const h = idxH >= 0 ? valeurs[idxH] : actuel.hauteur;
        const l = idxL >= 0 ? valeurs[idxL] : actuel.largeur;
        const p = idxP >= 0 ? valeurs[idxP] : actuel.profondeur;
        set('dimensions', formaterDimensionsTexte(h, l, p) || null);
        const formatAuto = !actuel.format
          || actuel.format === calculerFormat(actuel.hauteur, actuel.largeur);
        const orientationAuto = !actuel.orientation
          || actuel.orientation === calculerOrientation(actuel.hauteur, actuel.largeur);
        if (formatAuto) { const f = calculerFormat(h, l); if (f) set('format', f); }
        if (orientationAuto) { const ori = calculerOrientation(h, l); if (ori) set('orientation', ori); }
      }

      if (!cols.length) continue;
      const setSql = cols.map((c) => `${c} = ?`).join(', ');
      const info = db.prepare(
        `UPDATE oeuvres SET ${setSql}, modifie_le = datetime('now') WHERE id = ?`
      ).run(...valeurs, id);
      n += info.changes;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { modifiees: n };
}

function supprimerOeuvre(id) {
  const db = openDatabase();
  const nbVentes = db.prepare('SELECT COUNT(*) AS n FROM ventes WHERE oeuvre_id = ?').get(id).n;
  if (nbVentes > 0) {
    throw new Error(`Impossible de supprimer cette œuvre : ${nbVentes} vente(s) y sont attachée(s).`);
  }
  // Les certificats référencent l'œuvre (FK ON DELETE RESTRICT). On les préserve
  // (comme partout dans l'app) : refus clair plutôt qu'une cascade silencieuse.
  const nbCertifs = db.prepare('SELECT COUNT(*) AS n FROM certificats WHERE oeuvre_id = ?').get(id).n;
  if (nbCertifs > 0) {
    const phrase = nbCertifs > 1
      ? `${nbCertifs} certificats y sont liés. Supprimez-les d'abord`
      : `1 certificat y est lié. Supprimez-le d'abord`;
    throw new Error(`Impossible de supprimer cette œuvre : ${phrase} depuis la fiche de l'œuvre, puis réessayez.`);
  }
  const info = db.prepare('DELETE FROM oeuvres WHERE id = ?').run(id);
  return { supprime: info.changes > 0 };
}

// Jalon 3 — mise à jour partielle des statuts de préparation (sans passer par
// le formulaire complet). Met à jour seulement les colonnes sage/site.
function majPreparationOeuvre(id, data = {}) {
  const oid = entier(id);
  if (!oid) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  db.prepare(`
    UPDATE oeuvres SET
      sage_cree = ?, sage_cree_date = ?,
      stock_fait = ?, stock_fait_date = ?,
      site_publie = ?, site_publie_date = ?,
      modifie_le = datetime('now')
    WHERE id = ?
  `).run(
    bool(data.sage_cree), vide(data.sage_cree_date),
    bool(data.stock_fait), vide(data.stock_fait_date),
    bool(data.site_publie), vide(data.site_publie_date),
    oid
  );
  return obtenirOeuvre(oid);
}

const normaliserTelephone = (v) => {
  const s = vide(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return s;
};

const COLONNES_CLIENT = [
  ['nom', vide],
  ['prenom', vide],
  ['numero_civique', vide],
  ['rue', vide],
  ['appartement', vide],
  ['ville', vide],
  ['province', vide],
  ['code_postal', vide],
  ['pays', vide],
  ['adresse', vide],
  ['courriel', vide],
  ['telephone', normaliserTelephone],
  ['consentement_courriel', bool],
  ['consentement_date', vide],
  ['notes', vide],
];

function modifierClient(id, data) {
  if (!vide(data.nom)) throw new Error('Le nom du client est requis.');
  const db = openDatabase();
  const cols = COLONNES_CLIENT.map(([c]) => c);
  const valeurs = COLONNES_CLIENT.map(([c, n]) => n(data[c]));
  const set = cols.map((c) => `${c} = ?`).join(', ');
  db.prepare(
    `UPDATE clients SET ${set}, modifie_le = datetime('now') WHERE id = ?`
  ).run(...valeurs, id);
  return obtenirClient(id);
}

function creerClient(data) {
  if (!vide(data.nom)) throw new Error('Le nom du client est requis.');
  const db = openDatabase();
  const cols = COLONNES_CLIENT.map(([c]) => c);
  const valeurs = COLONNES_CLIENT.map(([c, n]) => n(data[c]));
  const colNames = cols.join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const info = db.prepare(`INSERT INTO clients (${colNames}) VALUES (${placeholders})`).run(...valeurs);
  return obtenirClient(info.lastInsertRowid);
}

function supprimerClient(id) {
  const db = openDatabase();
  const nbVentes = db.prepare('SELECT COUNT(*) AS n FROM ventes WHERE client_id = ?').get(id).n;
  if (nbVentes > 0) {
    throw new Error(`Impossible de supprimer ce client : ${nbVentes} vente(s) y sont rattachée(s).`);
  }
  // Réservations actives : refus clair plutôt qu'une œuvre « réservée pour
  // personne » (et des notes de réservation orphelines au nom du client).
  const reservees = db.prepare(
    `SELECT titre FROM oeuvres WHERE reservation_client_id = ? ORDER BY titre`
  ).all(entier(id));
  if (reservees.length > 0) {
    const titres = reservees.map((o) => `« ${o.titre || 'sans titre'} »`).join(', ');
    const multiple = reservees.length > 1;
    const phrase = multiple
      ? `${reservees.length} œuvres lui sont réservées (${titres})`
      : `1 œuvre lui est réservée (${titres})`;
    const consigne = multiple
      ? `Libère ces réservations depuis les fiches des œuvres, puis réessaie.`
      : `Libère la réservation depuis la fiche de l'œuvre, puis réessaie.`;
    throw new Error(`Impossible de supprimer ce client : ${phrase}. ${consigne}`);
  }
  const info = db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  return { supprime: info.changes > 0 };
}

const COLONNES_VENTE = [
  ['oeuvre_id', entier],
  ['client_id', entier],
  ['date_vente', vide],
  ['prix_vente', nombre],
  ['rabais_artiste', nombre],
  ['rabais_galerie', nombre],
  ['tps', nombre],
  ['tvq', nombre],
  ['mode_paiement', vide],
  ['numero_facture', vide],
  ['numero_facture_sage', vide],
  ['notes', vide],
  // Pochette de vente — sélection de la lettre de remerciement
  ['type_achat', vide],
  ['est_cadeau', bool],
  ['langue', vide],
  // Jalon 3 — suivi cycle de vie post-vente
  ['paiement_statut', vide],
  ['paiement_date', vide],
  ['emballage_date', vide],
  ['envoi_date', vide],
  ['livraison_date', vide],
];

function formaterNumero(prefixe, n) {
  const p = (prefixe || '').trim();
  const num = String(n).padStart(3, '0');
  return p ? `${p}-${num}` : num;
}

// ===== Garde-fou anti-doublons des compteurs de numérotation =====
// Appelé au démarrage : si un compteur est en retard sur les numéros déjà
// utilisés en base (config perdue ou réinitialisée, « prochain numéro »
// abaissé par erreur dans les Réglages), il est rehaussé à max + 1. Couvre
// les trois compteurs de documents (facture client, facture artiste,
// certificat) — un numéro de facture en double est un problème comptable.
// Le compteur d'inventaire n'est volontairement pas touché : ses numéros
// historiques (Airtable, par artiste) ont un format libre, et une suggestion
// d'inventaire erronée est visible et modifiable à la saisie.

function echapperRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Plus grand suffixe numérique des numéros existants (`PREFIXE-NNN` ou `NNN`).
function maxSuffixeNumerique(rows) {
  let max = 0;
  for (const r of rows) {
    const s = String(r.n || '');
    const m = s.match(/-(\d+)$/) || s.match(/^(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function rehausserCompteursSelonBase() {
  const db = openDatabase();
  const d = obtenirConfig().documents || {};
  const maj = {};

  const maxFacture = maxSuffixeNumerique(
    db.prepare('SELECT numero_facture AS n FROM ventes WHERE numero_facture IS NOT NULL').all()
  );
  if (maxFacture >= (d.prochain_numero_facture || 1)) {
    maj.prochain_numero_facture = maxFacture + 1;
  }

  const maxFactureArtiste = maxSuffixeNumerique(
    db.prepare('SELECT numero_facture_artiste AS n FROM ventes WHERE numero_facture_artiste IS NOT NULL').all()
  );
  if (maxFactureArtiste >= (d.prochain_numero_facture_artiste || 1)) {
    maj.prochain_numero_facture_artiste = maxFactureArtiste + 1;
  }

  // Certificats : seuls les numéros à l'ancien format `${prefixe}-NNN`
  // consomment ce compteur. Le format composé `{inventaire}-{seq}-{sage}`
  // (ex. MTR1042-003-5567) ne doit surtout pas entrer dans le calcul — son
  // dernier segment est un numéro Sage, pas un compteur.
  const prefixeCert = (d.prefixe_certificat || '').trim();
  if (prefixeCert) {
    const re = new RegExp(`^${echapperRegex(prefixeCert)}-(\\d+)$`);
    const rows = db
      .prepare('SELECT numero_delivrance AS n FROM certificats WHERE numero_delivrance LIKE ?')
      .all(`${prefixeCert}-%`);
    let maxCert = 0;
    for (const r of rows) {
      const m = String(r.n || '').match(re);
      if (m) maxCert = Math.max(maxCert, parseInt(m[1], 10));
    }
    if (maxCert >= (d.prochain_numero_certificat || 1)) {
      maj.prochain_numero_certificat = maxCert + 1;
    }
  }

  if (Object.keys(maj).length) {
    mettreAJourConfig({ documents: maj });
    console.log('Compteurs de numérotation rehaussés selon la base :', maj);
  }
  return maj;
}

function apercuProchainNumeroFacture() {
  const cfg = obtenirConfig();
  return formaterNumero(cfg.documents.prefixe_facture, cfg.documents.prochain_numero_facture);
}

function reserverProchainNumeroFacture() {
  const cfg = obtenirConfig();
  const numero = formaterNumero(cfg.documents.prefixe_facture, cfg.documents.prochain_numero_facture);
  mettreAJourConfig({
    documents: { prochain_numero_facture: cfg.documents.prochain_numero_facture + 1 },
  });
  return numero;
}

function apercuProchainNumeroInventaire(artisteId) {
  const cfg = obtenirConfig();
  const num = cfg.documents.prochain_numero_inventaire || 1;
  if (!artisteId) return String(num);
  const db = openDatabase();
  const artiste = db.prepare('SELECT prefixe_inventaire FROM artistes WHERE id = ?').get(entier(artisteId));
  const prefixe = (artiste?.prefixe_inventaire || '').trim();
  return `${prefixe}${num}`;
}

function reserverProchainNumeroInventaire(artisteId) {
  const cfg = obtenirConfig();
  const num = cfg.documents.prochain_numero_inventaire || 1;
  const db = openDatabase();
  const artiste = db.prepare('SELECT prefixe_inventaire FROM artistes WHERE id = ?').get(entier(artisteId));
  const prefixe = (artiste?.prefixe_inventaire || '').trim();
  mettreAJourConfig({
    documents: { prochain_numero_inventaire: num + 1 },
  });
  return `${prefixe}${num}`;
}

function apercuProchainNumeroFactureArtiste() {
  const cfg = obtenirConfig();
  return formaterNumero(cfg.documents.prefixe_facture_artiste, cfg.documents.prochain_numero_facture_artiste);
}

function reserverProchainNumeroFactureArtiste() {
  const cfg = obtenirConfig();
  const numero = formaterNumero(cfg.documents.prefixe_facture_artiste, cfg.documents.prochain_numero_facture_artiste);
  mettreAJourConfig({
    documents: { prochain_numero_facture_artiste: cfg.documents.prochain_numero_facture_artiste + 1 },
  });
  return numero;
}

// Réserve un numéro de facture artiste pour une vente donnée si elle n'en a pas déjà un.
// Retourne le numéro (existant ou nouvellement réservé).
function obtenirOuReserverNumeroFactureArtisteVente(venteId) {
  const db = openDatabase();
  const existant = db.prepare('SELECT numero_facture_artiste FROM ventes WHERE id = ?').get(venteId);
  if (existant?.numero_facture_artiste) return existant.numero_facture_artiste;
  const numero = reserverProchainNumeroFactureArtiste();
  db.prepare('UPDATE ventes SET numero_facture_artiste = ?, modifie_le = datetime(\'now\') WHERE id = ?').run(numero, venteId);
  return numero;
}

function _valeursVente(data) {
  if (!entier(data.oeuvre_id)) throw new Error('Une œuvre doit être sélectionnée.');
  if (!entier(data.client_id)) throw new Error('Un client doit être sélectionné.');
  if (!vide(data.date_vente)) throw new Error('La date de vente est requise.');
  const prix = nombre(data.prix_vente);
  if (prix == null || prix < 0) throw new Error('Le prix de vente est requis et doit être positif ou nul.');
  exigerPositifOuNul(nombre(data.rabais_artiste), 'Rabais artiste');
  exigerPositifOuNul(nombre(data.rabais_galerie), 'Rabais galerie');
  exigerPositifOuNul(nombre(data.tps), 'TPS');
  exigerPositifOuNul(nombre(data.tvq), 'TVQ');
  const cols = COLONNES_VENTE.map(([c]) => c);
  const valeurs = COLONNES_VENTE.map(([c, n]) => n(data[c]));
  // Forcer TPS/TVQ et rabais à 0 plutôt que null pour cohérence avec NOT NULL
  for (const champ of ['tps', 'tvq', 'rabais_artiste', 'rabais_galerie']) {
    const idx = cols.indexOf(champ);
    if (idx >= 0 && valeurs[idx] == null) valeurs[idx] = 0;
  }
  return { cols, valeurs };
}

function creerVente(data) {
  const { cols, valeurs } = _valeursVente(data);
  const db = openDatabase();
  const oeuvreId = entier(data.oeuvre_id);

  db.exec('BEGIN');
  try {
    // Vérifier que l'œuvre existe et n'est pas déjà vendue
    const oeuvre = db.prepare('SELECT id, statut, sage_cree FROM oeuvres WHERE id = ?').get(oeuvreId);
    if (!oeuvre) throw new Error("Œuvre introuvable.");
    if (oeuvre.statut === 'vendu') {
      throw new Error("Cette œuvre est déjà marquée comme vendue. Vérifie la liste des ventes existantes.");
    }
    if (!oeuvre.sage_cree) {
      const nomFichier = construireNomFichier(obtenirOeuvre(oeuvreId));
      const ref = nomFichier ? `\n\nNom de référence (= item Sage / nom de fichier photo) :\n${nomFichier}` : '';
      throw new Error(
        "Cette œuvre n'a pas été créée dans Sage 50. "
        + "Crée-la dans Sage, puis coche « Créée dans Sage » sur sa fiche avant d'enregistrer la vente."
        + ref
      );
    }

    const colNames = cols.join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const info = db.prepare(`INSERT INTO ventes (${colNames}) VALUES (${placeholders})`).run(...valeurs);

    db.prepare(`UPDATE oeuvres SET statut = 'vendu', reservation_client_id = NULL, reservation_date = NULL, reservation_echeance = NULL, reservation_notes = NULL, modifie_le = datetime('now') WHERE id = ?`).run(oeuvreId);

    db.exec('COMMIT');
    return obtenirVente(info.lastInsertRowid);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Jalon 3 — mise à jour partielle des statuts post-vente (sans passer par le
// formulaire complet). Met à jour seulement les colonnes du cycle de vie.
function majCycleVente(id, data = {}) {
  const vid = entier(id);
  if (!vid) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  db.prepare(`
    UPDATE ventes SET
      paiement_statut = ?, paiement_date = ?,
      emballage_date = ?, envoi_date = ?, livraison_date = ?,
      modifie_le = datetime('now')
    WHERE id = ?
  `).run(
    vide(data.paiement_statut), vide(data.paiement_date),
    vide(data.emballage_date), vide(data.envoi_date), vide(data.livraison_date),
    vid
  );
  return obtenirVente(vid);
}

function modifierVente(id, data) {
  const { cols, valeurs } = _valeursVente(data);
  const db = openDatabase();
  const nouvelleOeuvreId = entier(data.oeuvre_id);

  db.exec('BEGIN');
  try {
    const venteExistante = db.prepare('SELECT oeuvre_id FROM ventes WHERE id = ?').get(id);
    if (!venteExistante) throw new Error('Vente introuvable.');
    const ancienneOeuvreId = venteExistante.oeuvre_id;

    const set = cols.map((c) => `${c} = ?`).join(', ');
    db.prepare(
      `UPDATE ventes SET ${set}, modifie_le = datetime('now') WHERE id = ?`
    ).run(...valeurs, id);

    // Si on change d'œuvre : appliquer à la nouvelle les mêmes garde-fous que
    // la création (existe, pas déjà vendue, créée dans Sage), remettre
    // l'ancienne dispo si plus aucune vente ne la lie, puis passer la nouvelle
    // à vendu en effaçant une éventuelle réservation résiduelle.
    if (ancienneOeuvreId !== nouvelleOeuvreId) {
      const nouvelle = db.prepare('SELECT id, statut, sage_cree FROM oeuvres WHERE id = ?').get(nouvelleOeuvreId);
      if (!nouvelle) throw new Error('Œuvre introuvable.');
      if (nouvelle.statut === 'vendu') {
        throw new Error("Cette œuvre est déjà marquée comme vendue. Vérifie la liste des ventes existantes.");
      }
      if (!nouvelle.sage_cree) {
        const nomFichier = construireNomFichier(obtenirOeuvre(nouvelleOeuvreId));
        const ref = nomFichier ? `\n\nNom de référence (= item Sage / nom de fichier photo) :\n${nomFichier}` : '';
        throw new Error(
          "Cette œuvre n'a pas été créée dans Sage 50. "
          + "Crée-la dans Sage, puis coche « Créée dans Sage » sur sa fiche avant d'enregistrer la vente."
          + ref
        );
      }
      const nbAutres = db
        .prepare('SELECT COUNT(*) AS n FROM ventes WHERE oeuvre_id = ? AND id <> ?')
        .get(ancienneOeuvreId, id).n;
      if (nbAutres === 0) {
        db.prepare(`UPDATE oeuvres SET statut = 'disponible', modifie_le = datetime('now') WHERE id = ?`)
          .run(ancienneOeuvreId);
      }
      db.prepare(`UPDATE oeuvres SET statut = 'vendu', reservation_client_id = NULL, reservation_date = NULL, reservation_echeance = NULL, reservation_notes = NULL, modifie_le = datetime('now') WHERE id = ?`)
        .run(nouvelleOeuvreId);
    }

    db.exec('COMMIT');
    return obtenirVente(id);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function supprimerVente(id) {
  const db = openDatabase();

  db.exec('BEGIN');
  try {
    const vente = db.prepare('SELECT oeuvre_id FROM ventes WHERE id = ?').get(id);
    if (!vente) throw new Error('Vente introuvable.');

    // Détacher les certificats liés (ils restent dans l'historique de l'œuvre)
    // plutôt que de bloquer la suppression de la vente.
    db.prepare('UPDATE certificats SET vente_id = NULL WHERE vente_id = ?').run(id);

    db.prepare('DELETE FROM ventes WHERE id = ?').run(id);

    // Si plus aucune vente ne lie l'œuvre, la remettre disponible
    const nbAutres = db
      .prepare('SELECT COUNT(*) AS n FROM ventes WHERE oeuvre_id = ?')
      .get(vente.oeuvre_id).n;
    if (nbAutres === 0) {
      db.prepare(`UPDATE oeuvres SET statut = 'disponible', modifie_le = datetime('now') WHERE id = ?`)
        .run(vente.oeuvre_id);
    }

    db.exec('COMMIT');
    return { supprime: true };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ===== Archivage =====

const TABLES_ARCHIVABLES = new Set(['artistes', 'oeuvres', 'clients']);

function definirArchive(table, id, archive) {
  if (!TABLES_ARCHIVABLES.has(table)) {
    throw new Error(`Table non archivable : ${table}`);
  }
  const idInt = entier(id);
  if (idInt == null) throw new Error('Identifiant invalide.');
  const valeur = archive ? 1 : 0;
  const db = openDatabase();
  db.prepare(`UPDATE ${table} SET archive = ?, modifie_le = datetime('now') WHERE id = ?`).run(valeur, idInt);
  return { archive: valeur === 1 };
}

// Retrait d'une œuvre de la galerie (rendue à l'artiste). Remplace l'archivage
// côté œuvre : réutilise la colonne `archive` (donc exclue des listes actives)
// et enregistre date + motif pour le rapport journalier. Réversible.
function definirRetraitOeuvre(id, data = {}) {
  const idInt = entier(id);
  if (idInt == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  if (data.retire) {
    const date = vide(data.date) || new Date().toISOString().slice(0, 10);
    db.prepare(`
      UPDATE oeuvres SET archive = 1, retrait_date = ?, retrait_motif = ?, modifie_le = datetime('now')
      WHERE id = ?
    `).run(date, vide(data.motif), idInt);
  } else {
    db.prepare(`
      UPDATE oeuvres SET archive = 0, retrait_date = NULL, retrait_motif = NULL, modifie_le = datetime('now')
      WHERE id = ?
    `).run(idInt);
  }
  return obtenirOeuvre(idInt);
}

// ===== Expositions =====
// Le départ et le retour des œuvres (changements de statut) viendront plus
// tard : ici, seulement la vie de la fiche d'exposition elle-même.

function creerExposition(data = {}) {
  const nom = vide(data.nom);
  if (!nom) throw new Error("Le nom de l'exposition est requis.");
  const db = openDatabase();
  const info = db.prepare(`
    INSERT INTO expositions (nom, lieu, date_debut, date_fin_prevue, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(nom, vide(data.lieu), vide(data.date_debut), vide(data.date_fin_prevue), vide(data.notes));
  return obtenirExposition(Number(info.lastInsertRowid));
}

function modifierExposition(id, data = {}) {
  const n = entier(id);
  if (n == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  const actuel = db.prepare('SELECT * FROM expositions WHERE id = ?').get(n);
  if (!actuel) throw new Error('Exposition introuvable.');
  const cols = [], vals = [];
  const set = (col, v) => { cols.push(`${col} = ?`); vals.push(v); };
  if ('nom' in data) {
    const nom = vide(data.nom);
    if (!nom) throw new Error("Le nom de l'exposition est requis.");
    set('nom', nom);
  }
  for (const c of ['lieu', 'date_debut', 'date_fin_prevue', 'notes']) {
    if (c in data) set(c, vide(data[c]));
  }
  if (!cols.length) return obtenirExposition(n);
  vals.push(n);
  db.prepare(`UPDATE expositions SET ${cols.join(', ')}, modifie_le = datetime('now') WHERE id = ?`).run(...vals);
  return obtenirExposition(n);
}

// --- Départ et retour des œuvres ---------------------------------------
// Statuts qu'une œuvre peut avoir pour partir en exposition. Les vendues et
// les retirées (archive = 1) sont volontairement exclues : même principe que
// le retrait en lot, qui ignore déjà les vendues.
const STATUTS_PARTABLES = new Set(['disponible', 'reserve']);

// Ajoute des œuvres à une exposition en cours : mémorise le statut de chacune
// AVANT le départ (pour le lui rendre à la fin), la passe en 'exposee' et
// inscrit le nom de l'exposition dans `exposition_actuelle` — le champ qui
// existait déjà sur la fiche d'œuvre et dans l'édition en lot.
// Les œuvres inéligibles sont ignorées et comptées, jamais forcées.
function ajouterOeuvresExposition(expoId, oeuvreIds) {
  const eid = entier(expoId);
  if (eid == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  const expo = db.prepare('SELECT * FROM expositions WHERE id = ?').get(eid);
  if (!expo) throw new Error('Exposition introuvable.');
  if (expo.statut !== 'en_cours') throw new Error("Cette exposition est terminée : on ne peut plus y ajouter d'œuvres.");

  const ids = (Array.isArray(oeuvreIds) ? oeuvreIds : []).map(entier).filter((n) => n != null);
  if (!ids.length) return { ajoutees: 0, ignorees: 0, deja: 0 };

  const lireOeuvre = db.prepare('SELECT id, statut, archive FROM oeuvres WHERE id = ?');
  const dejaLa = db.prepare('SELECT 1 AS x FROM exposition_oeuvres WHERE exposition_id = ? AND oeuvre_id = ? AND retire_le IS NULL');
  const lien = db.prepare(`
    INSERT INTO exposition_oeuvres (exposition_id, oeuvre_id, statut_avant, retire_le)
    VALUES (?, ?, ?, NULL)
    ON CONFLICT(exposition_id, oeuvre_id)
      DO UPDATE SET statut_avant = excluded.statut_avant, ajoute_le = datetime('now'), retire_le = NULL
  `);
  const majOeuvre = db.prepare(`
    UPDATE oeuvres SET statut = 'exposee', exposition_actuelle = ?, modifie_le = datetime('now')
    WHERE id = ?
  `);

  let ajoutees = 0, ignorees = 0, deja = 0;
  db.exec('BEGIN');
  try {
    for (const id of ids) {
      const o = lireOeuvre.get(id);
      if (!o) { ignorees += 1; continue; }
      if (dejaLa.get(eid, id)) { deja += 1; continue; }
      if (o.archive === 1 || !STATUTS_PARTABLES.has(o.statut)) { ignorees += 1; continue; }
      lien.run(eid, id, o.statut);
      majOeuvre.run(expo.nom, id);
      ajoutees += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { ajoutees, ignorees, deja };
}

// Rend UNE œuvre : elle retrouve le statut qu'elle avait avant de partir.
// Une œuvre vendue pendant l'exposition n'est JAMAIS ressuscitée.
function retirerOeuvreExposition(expoId, oeuvreId) {
  const eid = entier(expoId), oid = entier(oeuvreId);
  if (eid == null || oid == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  const r = rendreOeuvres(db, eid, [oid]);
  return r;
}

// Cœur commun du retour : rend les œuvres passées en paramètre (ou toutes
// celles encore présentes si `ids` est nul). À utiliser dans une transaction.
function rendreOeuvres(db, eid, ids) {
  const lignes = ids
    ? ids.map((id) => db.prepare(`
        SELECT eo.oeuvre_id, eo.statut_avant, o.statut, o.archive
        FROM exposition_oeuvres eo JOIN oeuvres o ON o.id = eo.oeuvre_id
        WHERE eo.exposition_id = ? AND eo.oeuvre_id = ? AND eo.retire_le IS NULL
      `).get(eid, id)).filter(Boolean)
    : db.prepare(`
        SELECT eo.oeuvre_id, eo.statut_avant, o.statut, o.archive
        FROM exposition_oeuvres eo JOIN oeuvres o ON o.id = eo.oeuvre_id
        WHERE eo.exposition_id = ? AND eo.retire_le IS NULL
      `).all(eid);

  const majOeuvre = db.prepare(`
    UPDATE oeuvres SET statut = ?, exposition_actuelle = NULL, modifie_le = datetime('now') WHERE id = ?
  `);
  const soldeLien = db.prepare(`
    UPDATE exposition_oeuvres SET retire_le = datetime('now')
    WHERE exposition_id = ? AND oeuvre_id = ?
  `);
  const seulLien = db.prepare(`
    UPDATE exposition_oeuvres SET retire_le = datetime('now')
    WHERE exposition_id = ? AND oeuvre_id = ?
  `);

  let rendues = 0, vendues = 0, inchangees = 0;
  for (const l of lignes) {
    if (l.statut === 'vendu') {
      // Vendue pendant l'exposition : on la sort de l'expo sans toucher au statut.
      seulLien.run(eid, l.oeuvre_id);
      vendues += 1;
      continue;
    }
    if (l.statut !== 'exposee') {
      // Quelqu'un a changé le statut à la main entre-temps : on respecte ce choix.
      seulLien.run(eid, l.oeuvre_id);
      inchangees += 1;
      continue;
    }
    const avant = STATUTS_PARTABLES.has(l.statut_avant || '') ? l.statut_avant : 'disponible';
    majOeuvre.run(avant, l.oeuvre_id);
    soldeLien.run(eid, l.oeuvre_id);
    rendues += 1;
  }
  return { rendues, vendues, inchangees };
}

// Met fin à l'exposition : toutes les œuvres encore présentes reviennent.
function terminerExposition(expoId) {
  const eid = entier(expoId);
  if (eid == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  const expo = db.prepare('SELECT * FROM expositions WHERE id = ?').get(eid);
  if (!expo) throw new Error('Exposition introuvable.');
  if (expo.statut === 'terminee') throw new Error('Cette exposition est déjà terminée.');
  let r;
  db.exec('BEGIN');
  try {
    r = rendreOeuvres(db, eid, null);
    db.prepare(`
      UPDATE expositions SET statut = 'terminee', date_fin_reelle = date('now'), modifie_le = datetime('now')
      WHERE id = ?
    `).run(eid);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { ...r, exposition: obtenirExposition(eid) };
}

// Supprime la fiche d'exposition. Refuse tant qu'elle contient des œuvres :
// il faut d'abord y mettre fin, pour que les œuvres retrouvent leur statut et
// ne restent pas bloquées en « En exposition ».
function supprimerExposition(id) {
  const n = entier(id);
  if (n == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  const expo = db.prepare('SELECT * FROM expositions WHERE id = ?').get(n);
  if (!expo) throw new Error('Exposition introuvable.');
  const presentes = db.prepare(`
    SELECT COUNT(*) AS n FROM exposition_oeuvres
    WHERE exposition_id = ? AND retire_le IS NULL
  `).get(n).n;
  if (presentes > 0) {
    throw new Error(`Cette exposition contient encore ${presentes} œuvre(s). Mets-y fin d'abord pour qu'elles retrouvent leur statut.`);
  }
  db.prepare('DELETE FROM expositions WHERE id = ?').run(n);
  return { supprime: true };
}

// Remplit `url_site` à partir des produits du site, rapprochés par
// numéro d'inventaire = SKU. Ne touche QUE cette colonne, et rien sur le site.
//
// `modifie_le` est volontairement laissé intact : c'est un remplissage
// technique, pas une modification de fiche, et ce champ ordonne la liste des
// réservations (requetes.js) — le bouger pour 500 œuvres la réordonnerait.
function majUrlsSiteDepuisSite(produits) {
  const liste = Array.isArray(produits) ? produits : [];
  const vide = { total_site: liste.length, rapprochees: 0, remplies: 0, inchangees: 0, sans_correspondance: 0, sans_numero: 0 };
  if (!liste.length) return vide;
  const db = openDatabase();
  const norm = (s) => (s || '').toString().trim().toLowerCase();

  const parInv = new Map();
  const rows = db.prepare(`
    SELECT id, numero_inventaire, url_site FROM oeuvres
    WHERE numero_inventaire IS NOT NULL AND TRIM(numero_inventaire) <> ''
  `).all();
  for (const o of rows) {
    const k = norm(o.numero_inventaire);
    if (k && !parInv.has(k)) parInv.set(k, o);
  }
  const totalOeuvres = db.prepare('SELECT COUNT(*) AS n FROM oeuvres').get().n;

  const upd = db.prepare('UPDATE oeuvres SET url_site = ? WHERE id = ?');
  let rapprochees = 0, remplies = 0, inchangees = 0, sans = 0;
  db.exec('BEGIN');
  try {
    for (const p of liste) {
      const o = parInv.get(norm(p && p.sku));
      if (!o) { sans += 1; continue; }
      rapprochees += 1;
      if ((o.url_site || '') === p.permalink) { inchangees += 1; continue; }
      upd.run(p.permalink, o.id);
      remplies += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return {
    total_site: liste.length,
    rapprochees, remplies, inchangees,
    sans_correspondance: sans,
    sans_numero: totalOeuvres - rows.length,
  };
}

// Retrait en lot : retire plusieurs œuvres (rendues à l'artiste) en une fois.
// Ignore les œuvres déjà vendues (non retirables). Renvoie le nombre retiré.
function definirRetraitOeuvresLot(ids, data = {}) {
  const liste = (Array.isArray(ids) ? ids : []).map(entier).filter((n) => n != null);
  if (!liste.length) return { retirees: 0 };
  const db = openDatabase();
  const date = vide(data.date) || new Date().toISOString().slice(0, 10);
  const motif = vide(data.motif);
  const upd = db.prepare(`
    UPDATE oeuvres SET archive = 1, retrait_date = ?, retrait_motif = ?, modifie_le = datetime('now')
    WHERE id = ? AND statut <> 'vendu'
  `);
  let n = 0;
  db.exec('BEGIN');
  try {
    for (const id of liste) {
      const info = upd.run(date, motif, id);
      n += info.changes;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { retirees: n };
}

// ===== Réservation d'œuvre =====

// Réserve une œuvre pour un client (statut 'reserve' + client/échéance/notes).
// Le client est obligatoire. Refuse une œuvre déjà vendue.
function reserverOeuvre(id, data = {}) {
  const idInt = entier(id);
  if (idInt == null) throw new Error('Identifiant invalide.');
  const clientId = entier(data.client_id);
  if (clientId == null) throw new Error('Un client doit être sélectionné pour réserver.');
  const db = openDatabase();
  const oeuvre = db.prepare('SELECT statut FROM oeuvres WHERE id = ?').get(idInt);
  if (!oeuvre) throw new Error('Œuvre introuvable.');
  if (oeuvre.statut === 'vendu') throw new Error('Cette œuvre est déjà vendue.');
  const date = vide(data.date) || new Date().toISOString().slice(0, 10);
  db.prepare(`
    UPDATE oeuvres SET
      statut = 'reserve',
      reservation_client_id = ?, reservation_date = ?,
      reservation_echeance = ?, reservation_notes = ?,
      modifie_le = datetime('now')
    WHERE id = ?
  `).run(clientId, date, vide(data.echeance), vide(data.notes), idInt);
  return obtenirOeuvre(idInt);
}

// Libère une œuvre réservée : la remet « disponible » et efface la réservation.
function libererOeuvre(id) {
  const idInt = entier(id);
  if (idInt == null) throw new Error('Identifiant invalide.');
  const db = openDatabase();
  db.prepare(`
    UPDATE oeuvres SET
      statut = 'disponible',
      reservation_client_id = NULL, reservation_date = NULL,
      reservation_echeance = NULL, reservation_notes = NULL,
      modifie_le = datetime('now')
    WHERE id = ? AND statut = 'reserve'
  `).run(idInt);
  return obtenirOeuvre(idInt);
}

// ===== Certificats =====

const COLONNES_CERTIFICAT = [
  ['oeuvre_id', entier],
  ['vente_id', entier],
  ['numero_delivrance', vide],
  ['date_delivrance', vide],
  ['valeur', nombre],
  ['signataire', vide],
  ['particularite', vide],
  ['pdf_path', vide],
];

function apercuProchainNumeroCertificat() {
  const cfg = obtenirConfig();
  return formaterNumero(cfg.documents.prefixe_certificat, cfg.documents.prochain_numero_certificat);
}

function reserverProchainNumeroCertificat() {
  const cfg = obtenirConfig();
  const numero = formaterNumero(cfg.documents.prefixe_certificat, cfg.documents.prochain_numero_certificat);
  mettreAJourConfig({
    documents: { prochain_numero_certificat: cfg.documents.prochain_numero_certificat + 1 },
  });
  return numero;
}

function _valeursCertificat(data) {
  if (!entier(data.oeuvre_id)) throw new Error("Une œuvre doit être choisie pour le certificat.");
  if (!vide(data.numero_delivrance)) throw new Error("Le numéro de délivrance est requis.");
  if (!vide(data.date_delivrance)) throw new Error("La date de délivrance est requise.");
  exigerPositifOuNul(nombre(data.valeur), 'Valeur');
  const cols = COLONNES_CERTIFICAT.map(([c]) => c);
  const valeurs = COLONNES_CERTIFICAT.map(([c, n]) => n(data[c]));
  return { cols, valeurs };
}

// Compose le numéro de certificat (= numéro de délivrance) :
// {n° inventaire}-{seq artiste}-{n° Sage}. Ex. « MTR1042-003-5567 ».
// Pas d'année dans le numéro (l'année reste dans le dossier + l'horodatage du
// nom de fichier). Les segments vides sont omis.
function composerNumeroCertificat({ numeroInventaire, seq, numeroSage }) {
  return [
    (numeroInventaire || '').toString().trim(),
    seq != null ? String(seq).padStart(3, '0') : '',
    (numeroSage || '').toString().trim(),
  ].filter((p) => p !== '').join('-');
}

// Aperçu pour le formulaire : composantes du numéro AVANT saisie (n° d'inventaire
// de l'œuvre + prochain séquentiel de l'artiste). Le formulaire compose le numéro
// complet en direct en y ajoutant l'année et le n° Sage.
function apercuNumeroCertificat(oeuvreId) {
  const db = openDatabase();
  const oeuvre = db.prepare('SELECT numero_inventaire, artiste_id FROM oeuvres WHERE id = ?').get(entier(oeuvreId));
  if (!oeuvre) return null;
  const row = db.prepare(`
    SELECT COALESCE(MAX(c.seq_artiste), 0) AS m
    FROM certificats c JOIN oeuvres o ON o.id = c.oeuvre_id
    WHERE o.artiste_id = ?
  `).get(oeuvre.artiste_id);
  return {
    numero_inventaire: oeuvre.numero_inventaire || '',
    prochain_seq: ((row && row.m) || 0) + 1,
  };
}

function creerCertificat(data) {
  const db = openDatabase();
  const oeuvre = db.prepare('SELECT id, numero_inventaire, artiste_id FROM oeuvres WHERE id = ?').get(entier(data.oeuvre_id));
  if (!oeuvre) throw new Error("Une œuvre doit être choisie pour le certificat.");
  const dateDelivrance = vide(data.date_delivrance);
  if (!dateDelivrance) throw new Error("La date de délivrance est requise.");
  const numeroSage = vide(data.numero_sage);
  if (!numeroSage) throw new Error("Le numéro de facture (Sage) est requis pour produire un certificat.");
  exigerPositifOuNul(nombre(data.valeur), 'Valeur');

  // Séquentiel par artiste : MAX existant + 1 (les anciens « C- » ont seq NULL → 0).
  const row = db.prepare(`
    SELECT COALESCE(MAX(c.seq_artiste), 0) AS m
    FROM certificats c JOIN oeuvres o ON o.id = c.oeuvre_id
    WHERE o.artiste_id = ?
  `).get(oeuvre.artiste_id);
  const seq = ((row && row.m) || 0) + 1;
  const numero = composerNumeroCertificat({ numeroInventaire: oeuvre.numero_inventaire, seq, numeroSage });

  const langue = (vide(data.langue) || 'FR').toUpperCase();
  if (langue !== 'FR' && langue !== 'EN') throw new Error('Langue de certificat invalide.');

  const cols = ['oeuvre_id', 'vente_id', 'numero_delivrance', 'date_delivrance', 'valeur', 'signataire', 'particularite', 'pdf_path', 'seq_artiste', 'numero_sage', 'langue'];
  const valeurs = [
    entier(data.oeuvre_id), entier(data.vente_id), numero, dateDelivrance,
    nombre(data.valeur), vide(data.signataire), vide(data.particularite), vide(data.pdf_path),
    seq, numeroSage, langue,
  ];
  const info = db.prepare(`INSERT INTO certificats (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...valeurs);

  // Source unique : reporte le n° Sage sur la vente liée s'il n'y est pas déjà.
  if (entier(data.vente_id)) {
    db.prepare("UPDATE ventes SET numero_facture_sage = ? WHERE id = ? AND (numero_facture_sage IS NULL OR numero_facture_sage = '')")
      .run(numeroSage, entier(data.vente_id));
  }
  return obtenirCertificat(info.lastInsertRowid);
}

function modifierCertificat(id, data) {
  const { cols, valeurs } = _valeursCertificat(data);
  const db = openDatabase();
  const set = cols.map((c) => `${c} = ?`).join(', ');
  db.prepare(`UPDATE certificats SET ${set} WHERE id = ?`).run(...valeurs, id);
  return obtenirCertificat(id);
}

function supprimerCertificat(id) {
  const db = openDatabase();
  const info = db.prepare('DELETE FROM certificats WHERE id = ?').run(id);
  return { supprime: info.changes > 0 };
}

// ===== Annexes A (dépôt / retrait d'œuvres) =====

// Réserve le prochain numéro d'annexe pour un artiste (séquence par artiste,
// partagée dépôt/retrait) et enregistre la ligne. Numéro : AD-{préfixe}-{NNN}
// pour un dépôt, AR-{préfixe}-{NNN} pour un retrait.
function enregistrerAnnexe({ artisteId, type, oeuvreIds }) {
  const db = openDatabase();
  const art = obtenirArtiste(artisteId);
  if (!art) throw new Error('Artiste introuvable.');
  const t = type === 'retrait' ? 'retrait' : 'depot';
  const row = db.prepare('SELECT MAX(seq) AS m FROM annexes WHERE artiste_id = ?').get(artisteId);
  const seq = ((row && row.m) || 0) + 1;
  const prefixe = (art.prefixe_inventaire || '').toString().trim() || String(artisteId);
  const numero = `${t === 'retrait' ? 'AR' : 'AD'}-${prefixe}-${String(seq).padStart(3, '0')}`;
  const date = new Date().toISOString().slice(0, 10);
  const ids = Array.isArray(oeuvreIds) && oeuvreIds.length ? JSON.stringify(oeuvreIds) : null;
  const info = db.prepare(`
    INSERT INTO annexes (artiste_id, type, numero, seq, date, oeuvre_ids)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(artisteId, t, numero, seq, date, ids);
  return { id: Number(info.lastInsertRowid), numero, seq, date, type: t };
}

function majAnnexePdfPath(id, pdfPath) {
  const db = openDatabase();
  db.prepare('UPDATE annexes SET pdf_path = ? WHERE id = ?').run(pdfPath, id);
  return { ok: true };
}

// Annule une annexe réservée dont le PDF n'a finalement pas été produit
// (échec de génération ou annulation de l'éditeur) : sans cela, le numéro
// séquentiel de l'artiste était consommé et une ligne fantôme restait en base.
// Ne supprime que si aucun PDF n'y est rattaché — jamais une annexe produite.
function annulerAnnexe(id) {
  const aid = entier(id);
  if (aid == null) return { annulee: false };
  const db = openDatabase();
  const info = db.prepare(
    "DELETE FROM annexes WHERE id = ? AND (pdf_path IS NULL OR pdf_path = '')"
  ).run(aid);
  return { annulee: info.changes > 0 };
}

// Mémorise le PDF de présentation d'un artiste et la signature de son profil
// (pour réutiliser le document tant que le profil ne change pas).
function majPresentationArtiste(id, pdfPath, sig) {
  const db = openDatabase();
  db.prepare('UPDATE artistes SET presentation_path = ?, presentation_sig = ? WHERE id = ?').run(pdfPath, sig, id);
  return { ok: true };
}

module.exports = {
  creerExposition, modifierExposition, supprimerExposition,
  ajouterOeuvresExposition, retirerOeuvreExposition, terminerExposition,
  majUrlsSiteDepuisSite,
  enregistrerAnnexe, majAnnexePdfPath, annulerAnnexe, majPresentationArtiste,
  modifierArtiste, creerArtiste, supprimerArtiste,
  modifierOeuvre, majChampOeuvre, majStatutOeuvre, corrigerNumeroInventaire, ignorerDiffWeb, retirerIgnoreWeb, creerOeuvre, modifierOeuvresLot, supprimerOeuvre, majPreparationOeuvre,
  majChampArtiste, ignorerDiffArtisteWeb, retirerIgnoreArtisteWeb,
  modifierClient, creerClient, supprimerClient,
  creerVente, modifierVente, supprimerVente, majCycleVente,
  apercuProchainNumeroFacture, reserverProchainNumeroFacture,
  apercuProchainNumeroFactureArtiste, reserverProchainNumeroFactureArtiste,
  obtenirOuReserverNumeroFactureArtisteVente,
  creerCertificat, modifierCertificat, supprimerCertificat,
  apercuProchainNumeroCertificat, reserverProchainNumeroCertificat,
  apercuNumeroCertificat, composerNumeroCertificat,
  apercuProchainNumeroInventaire, reserverProchainNumeroInventaire,
  formaterNumero,
  rehausserCompteursSelonBase,
  definirArchive,
  definirRetraitOeuvre,
  definirRetraitOeuvresLot,
  reserverOeuvre,
  libererOeuvre,
};
