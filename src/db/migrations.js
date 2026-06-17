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
