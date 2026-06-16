const { openDatabase } = require('./database');
const { obtenirArtiste, obtenirOeuvre, obtenirClient, obtenirVente, obtenirCertificat } = require('./requetes');
const { obtenirConfig, mettreAJourConfig } = require('../config');

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

const STATUTS_VALIDES = new Set(['disponible', 'reserve', 'vendu', 'pretee']);

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
  ['format', vide],
  ['orientation', vide],
  ['sujets', vide],
  ['emplacement_signature', vide],
  ['particularite', vide],
  ['description', vide],
  ['prix', nombre],
  ['statut', vide],
  ['emplacement', vide],
  ['exposition_actuelle', vide],
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

function creerOeuvre(data) {
  const { cols, valeurs } = _valeursOeuvre(data);
  const db = openDatabase();
  const colNames = cols.join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const info = db.prepare(`INSERT INTO oeuvres (${colNames}) VALUES (${placeholders})`).run(...valeurs);
  return obtenirOeuvre(info.lastInsertRowid);
}

function supprimerOeuvre(id) {
  const db = openDatabase();
  const nbVentes = db.prepare('SELECT COUNT(*) AS n FROM ventes WHERE oeuvre_id = ?').get(id).n;
  if (nbVentes > 0) {
    throw new Error(`Impossible de supprimer cette œuvre : ${nbVentes} vente(s) y sont attachée(s).`);
  }
  const info = db.prepare('DELETE FROM oeuvres WHERE id = ?').run(id);
  return { supprime: info.changes > 0 };
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
  ['notes', vide],
];

function formaterNumero(prefixe, n) {
  const p = (prefixe || '').trim();
  const num = String(n).padStart(3, '0');
  return p ? `${p}-${num}` : num;
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
    const oeuvre = db.prepare('SELECT id, statut FROM oeuvres WHERE id = ?').get(oeuvreId);
    if (!oeuvre) throw new Error("Œuvre introuvable.");
    if (oeuvre.statut === 'vendu') {
      throw new Error("Cette œuvre est déjà marquée comme vendue. Vérifie la liste des ventes existantes.");
    }

    const colNames = cols.join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const info = db.prepare(`INSERT INTO ventes (${colNames}) VALUES (${placeholders})`).run(...valeurs);

    db.prepare(`UPDATE oeuvres SET statut = 'vendu', modifie_le = datetime('now') WHERE id = ?`).run(oeuvreId);

    db.exec('COMMIT');
    return obtenirVente(info.lastInsertRowid);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
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

    // Si on change d'œuvre : remettre l'ancienne dispo si plus aucune vente ne la lie ; passer la nouvelle à vendu
    if (ancienneOeuvreId !== nouvelleOeuvreId) {
      const nbAutres = db
        .prepare('SELECT COUNT(*) AS n FROM ventes WHERE oeuvre_id = ? AND id <> ?')
        .get(ancienneOeuvreId, id).n;
      if (nbAutres === 0) {
        db.prepare(`UPDATE oeuvres SET statut = 'disponible', modifie_le = datetime('now') WHERE id = ?`)
          .run(ancienneOeuvreId);
      }
      db.prepare(`UPDATE oeuvres SET statut = 'vendu', modifie_le = datetime('now') WHERE id = ?`)
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

    const nbCerts = db.prepare('SELECT COUNT(*) AS n FROM certificats WHERE vente_id = ?').get(id).n;
    if (nbCerts > 0) {
      throw new Error(`Impossible de supprimer cette vente : ${nbCerts} certificat(s) y sont liés. Supprime d'abord les certificats.`);
    }

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
  const cols = COLONNES_CERTIFICAT.map(([c]) => c);
  const valeurs = COLONNES_CERTIFICAT.map(([c, n]) => n(data[c]));
  return { cols, valeurs };
}

function creerCertificat(data) {
  const { cols, valeurs } = _valeursCertificat(data);
  const db = openDatabase();
  const colNames = cols.join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const info = db.prepare(`INSERT INTO certificats (${colNames}) VALUES (${placeholders})`).run(...valeurs);
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

module.exports = {
  modifierArtiste, creerArtiste, supprimerArtiste,
  modifierOeuvre, creerOeuvre, supprimerOeuvre,
  modifierClient, creerClient, supprimerClient,
  creerVente, modifierVente, supprimerVente,
  apercuProchainNumeroFacture, reserverProchainNumeroFacture,
  apercuProchainNumeroFactureArtiste, reserverProchainNumeroFactureArtiste,
  obtenirOuReserverNumeroFactureArtisteVente,
  creerCertificat, modifierCertificat, supprimerCertificat,
  apercuProchainNumeroCertificat, reserverProchainNumeroCertificat,
  formaterNumero,
};
