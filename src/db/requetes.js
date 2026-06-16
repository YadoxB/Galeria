const { openDatabase } = require('./database');

function listerArtistes() {
  const db = openDatabase();
  return db.prepare(`
    SELECT a.id, a.nom, a.prenom, a.type, a.prefixe_inventaire,
           a.courriel, a.telephone, a.province, a.langue, a.photo_path,
           (SELECT COUNT(*) FROM oeuvres o WHERE o.artiste_id = a.id) AS nb_oeuvres
    FROM artistes a
    ORDER BY a.nom COLLATE NOCASE, a.prenom COLLATE NOCASE
  `).all();
}

function obtenirArtiste(id) {
  const db = openDatabase();
  const artiste = db.prepare('SELECT * FROM artistes WHERE id = ?').get(id);
  if (!artiste) return null;
  const nb_oeuvres = db
    .prepare('SELECT COUNT(*) AS n FROM oeuvres WHERE artiste_id = ?')
    .get(id).n;
  return { ...artiste, nb_oeuvres };
}

function voisinsArtiste(id) {
  const db = openDatabase();
  const liste = db
    .prepare("SELECT id, TRIM(COALESCE(prenom || ' ', '') || nom) AS nom FROM artistes ORDER BY nom COLLATE NOCASE, prenom COLLATE NOCASE")
    .all();
  const idx = liste.findIndex((a) => a.id === id);
  if (idx === -1) return { precedent: null, suivant: null, position: null, total: liste.length };
  return {
    precedent: idx > 0 ? liste[idx - 1] : null,
    suivant: idx < liste.length - 1 ? liste[idx + 1] : null,
    position: idx + 1,
    total: liste.length,
  };
}

function listerOeuvres(filtres = {}) {
  const db = openDatabase();
  const where = [];
  const params = [];
  if (filtres.artiste_id != null) {
    where.push('o.artiste_id = ?');
    params.push(filtres.artiste_id);
  }
  if (filtres.statut) {
    where.push('o.statut = ?');
    params.push(filtres.statut);
  }
  if (filtres.type) {
    where.push('o.type = ?');
    params.push(filtres.type);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.numero_delivrance,
           o.type, o.annee, o.medium, o.support, o.dimensions,
           o.prix, o.statut, o.image_path,
           a.id AS artiste_id, TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    ${whereSql}
    ORDER BY o.titre COLLATE NOCASE
  `).all(...params);
}

function obtenirOeuvre(id) {
  const db = openDatabase();
  return db.prepare(`
    SELECT o.*, TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    WHERE o.id = ?
  `).get(id);
}

function voisinsOeuvre(id) {
  const db = openDatabase();
  const liste = db
    .prepare('SELECT id, titre FROM oeuvres ORDER BY titre COLLATE NOCASE')
    .all();
  const idx = liste.findIndex((o) => o.id === id);
  if (idx === -1) return { precedent: null, suivant: null, position: null, total: liste.length };
  return {
    precedent: idx > 0 ? liste[idx - 1] : null,
    suivant: idx < liste.length - 1 ? liste[idx + 1] : null,
    position: idx + 1,
    total: liste.length,
  };
}

function listerClients() {
  const db = openDatabase();
  return db.prepare(`
    SELECT c.id, c.nom, c.prenom, c.courriel, c.telephone, c.ville,
           c.consentement_courriel, c.consentement_date,
           (SELECT COUNT(*) FROM ventes v WHERE v.client_id = c.id) AS nb_ventes
    FROM clients c
    ORDER BY c.nom COLLATE NOCASE, c.prenom COLLATE NOCASE
  `).all();
}

function obtenirClient(id) {
  const db = openDatabase();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return null;
  const nb_ventes = db
    .prepare('SELECT COUNT(*) AS n FROM ventes WHERE client_id = ?')
    .get(id).n;
  return { ...client, nb_ventes };
}

function listerVentesOeuvre(oeuvreId) {
  const db = openDatabase();
  return db.prepare(`
    SELECT
      v.id, v.date_vente, v.prix_vente, v.tps, v.tvq, v.numero_facture, v.mode_paiement,
      c.id AS client_id, c.nom AS client_nom, c.prenom AS client_prenom
    FROM ventes v
    JOIN clients c ON c.id = v.client_id
    WHERE v.oeuvre_id = ?
    ORDER BY v.date_vente DESC, v.id DESC
  `).all(oeuvreId);
}

function listerVentesClient(clientId) {
  const db = openDatabase();
  return db.prepare(`
    SELECT
      v.id, v.date_vente, v.prix_vente, v.tps, v.tvq,
      v.mode_paiement, v.numero_facture,
      v.certificat_path, v.facture_artiste_path,
      v.facture_client_path, v.lettre_path,
      o.id AS oeuvre_id, o.titre AS oeuvre_titre, o.numero_inventaire,
      o.image_path,
      TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    WHERE v.client_id = ?
    ORDER BY v.date_vente DESC, v.id DESC
  `).all(clientId);
}

function voisinsClient(id) {
  const db = openDatabase();
  const liste = db
    .prepare('SELECT id, nom, prenom FROM clients ORDER BY nom COLLATE NOCASE, prenom COLLATE NOCASE')
    .all();
  const idx = liste.findIndex((c) => c.id === id);
  const label = (c) => c ? [c.prenom, c.nom].filter(Boolean).join(' ') : null;
  if (idx === -1) return { precedent: null, suivant: null, position: null, total: liste.length };
  const prec = idx > 0 ? liste[idx - 1] : null;
  const suiv = idx < liste.length - 1 ? liste[idx + 1] : null;
  return {
    precedent: prec ? { id: prec.id, nom: label(prec) } : null,
    suivant: suiv ? { id: suiv.id, nom: label(suiv) } : null,
    position: idx + 1,
    total: liste.length,
  };
}

function statsOeuvres() {
  const db = openDatabase();
  // Bornes du mois courant en UTC, format ISO compatible SQLite (datetime('now'))
  const debutMois = "datetime('now', 'start of month')";

  const total = db.prepare('SELECT COUNT(*) AS n FROM oeuvres').get().n;
  const totalDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres WHERE cree_le >= ${debutMois}`)
    .get().n;

  const artistes = db.prepare('SELECT COUNT(*) AS n FROM artistes').get().n;
  const artistesDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM artistes WHERE cree_le >= ${debutMois}`)
    .get().n;

  const ventesRow = db
    .prepare(`
      SELECT COUNT(*) AS n,
             COALESCE(SUM(prix_vente + tps + tvq), 0) AS montant
      FROM ventes
      WHERE date_vente >= date('now', 'start of month')
    `).get();

  const disponibles = db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres WHERE statut = 'disponible'`)
    .get().n;
  const disponiblesPct = total > 0 ? Math.round((disponibles / total) * 100) : 0;

  return {
    total,
    totalDeltaMois,
    artistes,
    artistesDeltaMois,
    ventesRecentes: ventesRow.n,
    ventesRecentesMontant: ventesRow.montant,
    disponibles,
    disponiblesPct,
  };
}

function listerTypesOeuvre() {
  const db = openDatabase();
  return db
    .prepare(`SELECT DISTINCT type FROM oeuvres WHERE type IS NOT NULL AND type <> '' ORDER BY type`)
    .all()
    .map((r) => r.type);
}

function listerVentes() {
  const db = openDatabase();
  return db.prepare(`
    SELECT
      v.id, v.date_vente, v.prix_vente, v.tps, v.tvq,
      v.mode_paiement, v.numero_facture,
      v.certificat_path, v.facture_artiste_path,
      v.facture_client_path, v.lettre_path,
      o.id AS oeuvre_id, o.titre AS oeuvre_titre, o.numero_inventaire, o.image_path,
      a.id AS artiste_id, TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
      c.id AS client_id, c.nom AS client_nom, c.prenom AS client_prenom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients c ON c.id = v.client_id
    ORDER BY v.date_vente DESC, v.id DESC
  `).all();
}

function obtenirVente(id) {
  const db = openDatabase();
  return db.prepare(`
    SELECT
      v.*,
      o.titre AS oeuvre_titre, o.numero_inventaire, o.image_path,
      o.dimensions, o.medium, o.support, o.annee,
      o.prix AS oeuvre_prix,
      a.id AS artiste_id, TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
      c.nom AS client_nom, c.prenom AS client_prenom,
      c.courriel AS client_courriel, c.telephone AS client_telephone
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients c ON c.id = v.client_id
    WHERE v.id = ?
  `).get(id);
}

function listerCertificatsParOeuvre(oeuvreId) {
  const db = openDatabase();
  return db.prepare(`
    SELECT c.id, c.oeuvre_id, c.vente_id,
           c.numero_delivrance, c.date_delivrance,
           c.valeur, c.signataire, c.particularite, c.pdf_path, c.cree_le,
           v.numero_facture
    FROM certificats c
    LEFT JOIN ventes v ON v.id = c.vente_id
    WHERE c.oeuvre_id = ?
    ORDER BY c.date_delivrance DESC, c.id DESC
  `).all(oeuvreId);
}

function listerCertificatsParVente(venteId) {
  const db = openDatabase();
  return db.prepare(`
    SELECT id, oeuvre_id, vente_id,
           numero_delivrance, date_delivrance,
           valeur, signataire, particularite, pdf_path, cree_le
    FROM certificats
    WHERE vente_id = ?
    ORDER BY date_delivrance DESC, id DESC
  `).all(venteId);
}

function obtenirCertificat(id) {
  const db = openDatabase();
  return db.prepare(`
    SELECT c.*,
           o.titre AS oeuvre_titre, o.numero_inventaire, o.image_path,
           o.dimensions, o.medium, o.support, o.annee,
           o.type AS oeuvre_type, o.emplacement_signature,
           a.id AS artiste_id, TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           v.numero_facture
    FROM certificats c
    JOIN oeuvres o ON o.id = c.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    LEFT JOIN ventes v ON v.id = c.vente_id
    WHERE c.id = ?
  `).get(id);
}

function voisinsVente(id) {
  const db = openDatabase();
  const liste = db
    .prepare('SELECT id, date_vente, numero_facture FROM ventes ORDER BY date_vente DESC, id DESC')
    .all();
  const idx = liste.findIndex((v) => v.id === id);
  const label = (v) => v ? (v.numero_facture || v.date_vente || `#${v.id}`) : null;
  if (idx === -1) return { precedent: null, suivant: null, position: null, total: liste.length };
  const prec = idx > 0 ? liste[idx - 1] : null;
  const suiv = idx < liste.length - 1 ? liste[idx + 1] : null;
  return {
    precedent: prec ? { id: prec.id, nom: label(prec) } : null,
    suivant: suiv ? { id: suiv.id, nom: label(suiv) } : null,
    position: idx + 1,
    total: liste.length,
  };
}

module.exports = {
  listerArtistes,
  obtenirArtiste,
  voisinsArtiste,
  listerOeuvres,
  obtenirOeuvre,
  voisinsOeuvre,
  listerTypesOeuvre,
  statsOeuvres,
  listerClients,
  obtenirClient,
  voisinsClient,
  listerVentesClient,
  listerVentesOeuvre,
  listerVentes,
  obtenirVente,
  voisinsVente,
  listerCertificatsParOeuvre,
  listerCertificatsParVente,
  obtenirCertificat,
};
