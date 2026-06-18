// Migrations additives : au démarrage, on ajoute les colonnes manquantes
// sans toucher aux données existantes. Idempotent — sûr de relancer à chaque ouverture.
//
// Pour ajouter un nouveau champ à une table existante :
//   1. Ajouter la colonne au CREATE TABLE de schema.sql (pour les installations fraîches).
//   2. Ajouter une entrée ci-dessous (pour les bases existantes).

const COLONNES_ATTENDUES = {
  artistes: [
    ['numeros_taxes', 'TEXT'],
    ['photo_originale_path', 'TEXT'],
    ['pays', 'TEXT'],
    ['prenom', 'TEXT'],
    ['archive', 'INTEGER NOT NULL DEFAULT 0'],
    ['instructions_ia', 'TEXT'],
    ['lien_chatgpt', 'TEXT'],
    ['cotes', 'TEXT'],
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
  ],
};

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
