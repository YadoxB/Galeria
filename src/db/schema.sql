-- Schéma GalerieApp. Idempotent : sûr de relancer à chaque démarrage.

CREATE TABLE IF NOT EXISTS artistes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nom                 TEXT NOT NULL,
  prenom              TEXT,
  type                TEXT,
  prefixe_inventaire  TEXT,
  biographie          TEXT,
  demarche            TEXT,
  curriculum          TEXT,
  photo_path          TEXT,
  photo_originale_path TEXT,
  courriel            TEXT,
  telephone           TEXT,
  adresse             TEXT,
  province            TEXT,
  pays                TEXT,
  langue              TEXT,
  percoit_taxes       INTEGER NOT NULL DEFAULT 0
                      CHECK (percoit_taxes IN (0, 1)),
  numeros_taxes       TEXT,
  notes               TEXT,
  instructions_ia     TEXT,
  lien_chatgpt        TEXT,
  cotes               TEXT,
  archive             INTEGER NOT NULL DEFAULT 0
                      CHECK (archive IN (0, 1)),
  cree_le             TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oeuvres (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  artiste_id             INTEGER NOT NULL REFERENCES artistes(id) ON DELETE RESTRICT,
  titre                  TEXT NOT NULL,
  type                   TEXT,
  numero_inventaire      TEXT,
  numero_delivrance      TEXT,
  dimensions             TEXT,
  hauteur                REAL,
  largeur                REAL,
  profondeur             REAL,
  medium                 TEXT,
  support                TEXT,
  annee                  INTEGER,
  prix                   REAL,
  statut                 TEXT NOT NULL DEFAULT 'disponible'
                         CHECK (statut IN ('disponible', 'reserve', 'vendu', 'pretee')),
  format                 TEXT,
  orientation            TEXT,
  style                  TEXT,
  sujets                 TEXT,
  emplacement_signature  TEXT,
  particularite          TEXT,
  description            TEXT,
  image_path             TEXT,
  emplacement            TEXT,
  exposition_actuelle    TEXT,
  url_site               TEXT,
  cote_hors_normes       INTEGER NOT NULL DEFAULT 0
                         CHECK (cote_hors_normes IN (0, 1)),
  sage_cree              INTEGER NOT NULL DEFAULT 0
                         CHECK (sage_cree IN (0, 1)),
  sage_cree_date         TEXT,
  site_publie            INTEGER NOT NULL DEFAULT 0
                         CHECK (site_publie IN (0, 1)),
  site_publie_date       TEXT,
  archive                INTEGER NOT NULL DEFAULT 0
                         CHECK (archive IN (0, 1)),
  cree_le                TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nom                   TEXT NOT NULL,
  prenom                TEXT,
  numero_civique        TEXT,
  rue                   TEXT,
  appartement           TEXT,
  ville                 TEXT,
  province              TEXT,
  code_postal           TEXT,
  pays                  TEXT,
  adresse               TEXT,
  courriel              TEXT,
  telephone             TEXT,
  consentement_courriel INTEGER NOT NULL DEFAULT 0
                        CHECK (consentement_courriel IN (0, 1)),
  consentement_date     TEXT,
  notes                 TEXT,
  archive               INTEGER NOT NULL DEFAULT 0
                        CHECK (archive IN (0, 1)),
  cree_le               TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ventes (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  oeuvre_id            INTEGER NOT NULL REFERENCES oeuvres(id) ON DELETE RESTRICT,
  client_id            INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date_vente           TEXT NOT NULL,
  prix_vente           REAL NOT NULL,
  rabais_artiste       REAL NOT NULL DEFAULT 0,
  rabais_galerie       REAL NOT NULL DEFAULT 0,
  tps                  REAL NOT NULL DEFAULT 0,
  tvq                  REAL NOT NULL DEFAULT 0,
  mode_paiement        TEXT,
  numero_facture       TEXT,
  numero_facture_artiste TEXT,
  certificat_path      TEXT,
  facture_artiste_path TEXT,
  facture_client_path  TEXT,
  lettre_path          TEXT,
  exporte_sage         INTEGER NOT NULL DEFAULT 0
                       CHECK (exporte_sage IN (0, 1)),
  exporte_sage_date    TEXT,
  paiement_statut      TEXT,        -- 'en_attente' | 'partiel' | 'recu' | NULL
  paiement_date        TEXT,
  emballage_date       TEXT,
  envoi_date           TEXT,
  livraison_date       TEXT,
  notes                TEXT,
  cree_le              TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS certificats (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  oeuvre_id          INTEGER NOT NULL REFERENCES oeuvres(id) ON DELETE RESTRICT,
  vente_id           INTEGER REFERENCES ventes(id) ON DELETE SET NULL,
  numero_delivrance  TEXT NOT NULL,
  date_delivrance    TEXT NOT NULL,
  valeur             REAL,
  signataire         TEXT,
  particularite      TEXT,
  pdf_path           TEXT,
  cree_le            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_artistes_nom         ON artistes(nom);
CREATE INDEX IF NOT EXISTS idx_oeuvres_artiste      ON oeuvres(artiste_id);
CREATE INDEX IF NOT EXISTS idx_oeuvres_statut       ON oeuvres(statut);
CREATE INDEX IF NOT EXISTS idx_oeuvres_inv          ON oeuvres(numero_inventaire);
CREATE INDEX IF NOT EXISTS idx_ventes_oeuvre        ON ventes(oeuvre_id);
CREATE INDEX IF NOT EXISTS idx_ventes_client        ON ventes(client_id);
CREATE INDEX IF NOT EXISTS idx_ventes_date          ON ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_certificats_oeuvre   ON certificats(oeuvre_id);
CREATE INDEX IF NOT EXISTS idx_certificats_vente    ON certificats(vente_id);
