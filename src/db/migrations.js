// Migrations additives : au démarrage, on ajoute les colonnes manquantes
// sans toucher aux données existantes. Idempotent — sûr de relancer à chaque ouverture.
//
// Pour ajouter un nouveau champ à une table existante :
//   1. Ajouter la colonne au CREATE TABLE de schema.sql (pour les installations fraîches).
//   2. Ajouter une entrée ci-dessous (pour les bases existantes).

const COLONNES_ATTENDUES = {
  artistes: [
    ['citation', 'TEXT'],
    ['numeros_taxes', 'TEXT'],
    ['photo_originale_path', 'TEXT'],
    ['pays', 'TEXT'],
    ['prenom', 'TEXT'],
    ['archive', 'INTEGER NOT NULL DEFAULT 0'],
    ['instructions_ia', 'TEXT'],
    ['lien_chatgpt', 'TEXT'],
    ['cotes', 'TEXT'],
    // Pochette de vente : présentation artiste mise en cache (réutilisée tant
    // que le profil n'a pas changé). `presentation_sig` = signature des champs.
    ['presentation_path', 'TEXT'],
    ['presentation_sig', 'TEXT'],
  ],
  oeuvres: [
    ['format', 'TEXT'],
    ['orientation', 'TEXT'],
    ['sujets', 'TEXT'],
    ['archive', 'INTEGER NOT NULL DEFAULT 0'],
    ['hauteur', 'REAL'],
    ['largeur', 'REAL'],
    ['profondeur', 'REAL'],
    ['url_site', 'TEXT'],
    ['cote_hors_normes', 'INTEGER NOT NULL DEFAULT 0'],
    // Jalon 3 — préparation (en amont de la vente) : Sage → Stock → Site
    ['sage_cree', 'INTEGER NOT NULL DEFAULT 0'],
    ['sage_cree_date', 'TEXT'],
    ['stock_fait', 'INTEGER NOT NULL DEFAULT 0'],
    ['stock_fait_date', 'TEXT'],
    ['site_publie', 'INTEGER NOT NULL DEFAULT 0'],
    ['site_publie_date', 'TEXT'],
    // Style : 'Figuratif' | 'Abstrait' | 'Mi-Figuratif' | NULL
    ['style', 'TEXT'],
    // Retrait de la galerie (rendu à l'artiste) : remplace « Archiver » côté
    // œuvre. S'appuie sur la colonne `archive` ; ajoute la date et le motif.
    ['retrait_date', 'TEXT'],
    ['retrait_motif', 'TEXT'],
    // Réservation (statut 'reserve') : client visé + échéance + notes. Une
    // réservation active par œuvre ; effacée à la vente ou à la libération.
    ['reservation_client_id', 'INTEGER'],
    ['reservation_date', 'TEXT'],
    ['reservation_echeance', 'TEXT'],
    ['reservation_notes', 'TEXT'],
    // Reproductions : frais de production récupérés par la galerie avant le
    // partage 50/50 (déduits sur la facture artiste).
    ['frais_production', 'REAL'],
  ],
  clients: [
    ['prenom', 'TEXT'],
    ['numero_civique', 'TEXT'],
    ['rue', 'TEXT'],
    ['appartement', 'TEXT'],
    ['ville', 'TEXT'],
    ['province', 'TEXT'],
    ['code_postal', 'TEXT'],
    ['pays', 'TEXT'],
    ['archive', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  ventes: [
    ['numero_facture_artiste', 'TEXT'],
    ['rabais_artiste', 'REAL NOT NULL DEFAULT 0'],
    ['rabais_galerie', 'REAL NOT NULL DEFAULT 0'],
    // Jalon 3 — suivi cycle de vie post-vente
    ['paiement_statut', 'TEXT'],    // 'en_attente' | 'partiel' | 'recu' | NULL
    ['paiement_date', 'TEXT'],
    ['emballage_date', 'TEXT'],
    ['envoi_date', 'TEXT'],
    ['livraison_date', 'TEXT'],
    // Pochette de vente : sélection de la lettre de remerciement.
    ['type_achat', 'TEXT'],          // 'personne' | 'web'
    ['est_cadeau', 'INTEGER NOT NULL DEFAULT 0'],
    ['langue', 'TEXT'],              // 'FR' | 'EN'
    // N° de facture Sage (saisi à la main pour l'instant ; Phase 4 plus tard).
    // Alimente le numéro de certificat composé.
    ['numero_facture_sage', 'TEXT'],
  ],
  certificats: [
    // Nouveau format de numéro de certificat : {n° inventaire}-{année}-{seq
    // artiste}-{n° Sage}. Les anciens certificats « C-2026-NNN » gardent
    // seq_artiste/numero_sage à NULL.
    ['seq_artiste', 'INTEGER'],
    ['numero_sage', 'TEXT'],
  ],
};

// Ajout du statut 'exposee' aux œuvres (fonction Expositions).
//
// SQLite ne sait pas modifier une contrainte CHECK : il faut reconstruire la
// table. Procédure officielle en 12 étapes, resserrée ici parce qu'`oeuvres`
// n'a NI vue NI déclencheur (vérifié) — seulement 3 index et 3 clés étrangères
// entrantes (ventes, certificats, web_sync_ignore).
//
// Précautions :
//   - une copie de la base a déjà été prise avant migration par main.js
//     (sauvegardeAvantMigrationSiNouvelleVersion) ;
//   - on part du CREATE TABLE réel lu dans sqlite_master, et on n'y remplace
//     QUE la contrainte de statut : aucun risque de perdre une colonne ajoutée
//     par une migration antérieure, ni une autre contrainte ;
//   - si la contrainte n'a pas la forme attendue, on n'y touche pas du tout ;
//   - le nombre de lignes est comparé avant/après et les clés étrangères sont
//     vérifiées AVANT le COMMIT ; au moindre écart, on annule tout.
function ajouterStatutExposee(db) {
  const ligne = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'oeuvres'")
    .get();
  const ddl = ligne && ligne.sql ? ligne.sql : '';
  if (!ddl) return { fait: false, raison: 'table introuvable' };
  if (/exposee/.test(ddl)) return { fait: false, raison: 'déjà présent' };

  const reCheck = /CHECK\s*\(\s*statut\s+IN\s*\(([^)]*)\)\s*\)/i;
  const m = ddl.match(reCheck);
  if (!m) return { fait: false, raison: 'contrainte de statut non reconnue' };

  const nouveauCheck = `CHECK (statut IN (${m[1].trim()}, 'exposee'))`;
  const ddlNouveau = ddl
    .replace(reCheck, nouveauCheck)
    .replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["'`[]?oeuvres["'`\]]?/i, 'CREATE TABLE oeuvres_migr');
  if (!/CREATE TABLE oeuvres_migr/.test(ddlNouveau)) {
    return { fait: false, raison: 'réécriture du CREATE TABLE impossible' };
  }

  const avant = db.prepare('SELECT COUNT(*) AS n FROM oeuvres').get().n;

  // PRAGMA foreign_keys ne peut pas changer à l'intérieur d'une transaction.
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    db.exec(ddlNouveau);
    db.exec('INSERT INTO oeuvres_migr SELECT * FROM oeuvres');
    const apres = db.prepare('SELECT COUNT(*) AS n FROM oeuvres_migr').get().n;
    if (apres !== avant) {
      throw new Error(`copie incomplète : ${apres} lignes copiées sur ${avant}`);
    }
    db.exec('DROP TABLE oeuvres');
    db.exec('ALTER TABLE oeuvres_migr RENAME TO oeuvres');
    // Les index tombent avec l'ancienne table : on les remonte à l'identique.
    db.exec('CREATE INDEX IF NOT EXISTS idx_oeuvres_artiste ON oeuvres(artiste_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_oeuvres_statut  ON oeuvres(statut)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_oeuvres_inv     ON oeuvres(numero_inventaire)');
    const orphelins = db.prepare('PRAGMA foreign_key_check').all();
    if (orphelins.length) {
      throw new Error(`${orphelins.length} référence(s) orpheline(s) après reconstruction`);
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    db.exec('PRAGMA foreign_keys = ON');
    throw new Error(`Migration du statut « exposée » abandonnée, base inchangée : ${err.message}`);
  }
  db.exec('PRAGMA foreign_keys = ON');
  return { fait: true, lignes: avant };
}
function migrer(db) {
  // 1. Ajout des colonnes manquantes
  for (const [table, colonnes] of Object.entries(COLONNES_ATTENDUES)) {
    if (colonnes.length === 0) continue;
    const existantes = new Set(
      db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
    );
    for (const [nom, type] of colonnes) {
      if (!existantes.has(nom)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${nom} ${type}`);
      }
    }
  }

  // 1b. Backfill ponctuel du jalon 3, versionné via PRAGMA user_version pour
  //     s'exécuter exactement une fois par base — même si la colonne avait été
  //     ajoutée lors d'un démarrage antérieur (cas des bases de dev déjà
  //     migrées). Tout le catalogue qui existait au moment de la mise à jour
  //     est réputé déjà créé dans Sage et publié sur le site (confirmé par la
  //     galerie). Les œuvres créées APRÈS partent à 0 et déclenchent le
  //     garde-fou Sage normalement.
  const versionBase = db.prepare('PRAGMA user_version').get().user_version || 0;
  if (versionBase < 1) {
    const colsOeuvres = new Set(
      db.prepare(`PRAGMA table_info(oeuvres)`).all().map((c) => c.name)
    );
    if (colsOeuvres.has('sage_cree')) {
      db.exec(`UPDATE oeuvres SET sage_cree = 1`);
    }
    if (colsOeuvres.has('site_publie')) {
      db.exec(`UPDATE oeuvres SET site_publie = 1`);
    }
    db.exec('PRAGMA user_version = 1');
  }

  // 1c. Backfill du jalon « Visibilité » : ajout de l'étape « Stock » dans la
  //     préparation (entre Sage et Site). Tout le catalogue existant est réputé
  //     déjà en stock. Versionné à 2 pour ne s'exécuter qu'une fois.
  if (versionBase < 2) {
    const colsOeuvres = new Set(
      db.prepare(`PRAGMA table_info(oeuvres)`).all().map((c) => c.name)
    );
    if (colsOeuvres.has('stock_fait')) {
      db.exec(`UPDATE oeuvres SET stock_fait = 1`);
    }
    db.exec('PRAGMA user_version = 2');
  }

  // 1e. Statut « exposée » (fonction Expositions). Reconstruction de la table
  //     `oeuvres` pour élargir la contrainte CHECK — voir ajouterStatutExposee.
  //     Versionné à 3 : ne s'exécute qu'une fois par base. La garde `< 3` et le
  //     test « déjà présent » de la fonction se doublent volontairement.
  if (versionBase < 3) {
    const r = ajouterStatutExposee(db);
    if (r.fait) {
      console.log(`Migration : statut « exposée » ajouté (${r.lignes} œuvres conservées).`);
    } else if (r.raison !== 'déjà présent') {
      console.warn(`Migration du statut « exposée » non appliquée : ${r.raison}.`);
    }
    db.exec('PRAGMA user_version = 3');
  }
  // 1d. Nouvelle table « annexes » (Annexe A — dépôt / retrait d'œuvres).
  //     Créée ici pour les bases existantes (schema.sql la crée pour les
  //     installations fraîches). Numérotation séquentielle par artiste.
  db.exec(`
    CREATE TABLE IF NOT EXISTS annexes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      artiste_id  INTEGER NOT NULL REFERENCES artistes(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      numero      TEXT NOT NULL,
      seq         INTEGER NOT NULL,
      date        TEXT NOT NULL,
      oeuvre_ids  TEXT,
      pdf_path    TEXT,
      cree_le     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_annexes_artiste ON annexes(artiste_id);
  `);

  // 1e. Table « meta » (clé/valeur). Porte notamment `catalogue_id` : l'identifiant
  //     du catalogue livré avec un build. Sert à proposer le chargement d'un
  //     nouveau catalogue quand la base de l'utilisateur en a un différent (ou
  //     aucun, comme une vieille base 0.2.0).
  db.exec(`CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT);`);

  // 1f. Table « web_sync_ignore » (Phase 5) : différences de synchro « déjà
  //     réglées » (l'utilisateur a choisi de garder la version de l'app). Voir
  //     schema.sql pour le détail. Créée ici pour les bases existantes.
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_sync_ignore (
      oeuvre_id INTEGER NOT NULL REFERENCES oeuvres(id) ON DELETE CASCADE,
      champ     TEXT NOT NULL,
      site_cle  TEXT NOT NULL,
      cree_le   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (oeuvre_id, champ)
    );
    CREATE TABLE IF NOT EXISTS web_sync_ignore_artiste (
      artiste_id INTEGER NOT NULL REFERENCES artistes(id) ON DELETE CASCADE,
      champ      TEXT NOT NULL,
      site_cle   TEXT NOT NULL,
      cree_le    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (artiste_id, champ)
    );
  `);

  // 2. Backfill : artistes.numero_taxes (TPS unique) → artistes.numeros_taxes (liste JSON)
  const colsArtistes = db.prepare(`PRAGMA table_info(artistes)`).all().map((c) => c.name);
  if (colsArtistes.includes('numeros_taxes') && colsArtistes.includes('numero_taxes')) {
    const aMigrer = db.prepare(`
      SELECT id, numero_taxes FROM artistes
      WHERE numero_taxes IS NOT NULL
        AND numero_taxes != ''
        AND (numeros_taxes IS NULL OR numeros_taxes = '')
    `).all();
    const update = db.prepare('UPDATE artistes SET numeros_taxes = ? WHERE id = ?');
    for (const row of aMigrer) {
      update.run(
        JSON.stringify([{ etiquette: 'TPS', numero: row.numero_taxes }]),
        row.id
      );
    }
  }
}

module.exports = { migrer };
