const { openDatabase } = require('./database');

function listerArtistes(filtres = {}) {
  const db = openDatabase();
  const where = filtres.inclureArchives ? '' : 'WHERE a.archive = 0';
  return db.prepare(`
    SELECT a.id, a.nom, a.prenom, a.type, a.prefixe_inventaire,
           a.courriel, a.telephone, a.province, a.langue, a.photo_path, a.archive,
           (SELECT COUNT(*) FROM oeuvres o WHERE o.artiste_id = a.id) AS nb_oeuvres
    FROM artistes a
    ${where}
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

function obtenirFicheArtisteBundle(id) {
  const artiste = obtenirArtiste(id);
  if (!artiste) return null;
  const voisins = voisinsArtiste(id);
  const db = openDatabase();

  const dispoRow = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(prix), 0) AS v
              FROM oeuvres
              WHERE artiste_id = ? AND statut = 'disponible' AND archive = 0`)
    .get(id);

  const ventesNb = db
    .prepare(`SELECT COUNT(*) AS n FROM ventes v
              JOIN oeuvres o ON o.id = v.oeuvre_id
              WHERE o.artiste_id = ?`)
    .get(id).n;

  const apercu = db
    .prepare(`SELECT id, titre, image_path, statut
              FROM oeuvres
              WHERE artiste_id = ? AND archive = 0
              ORDER BY cree_le DESC, id DESC
              LIMIT 8`)
    .all(id);

  return {
    artiste,
    voisins,
    stats: {
      catalogue: artiste.nb_oeuvres,
      disponibles: dispoRow.n,
      valeurDispo: dispoRow.v,
      ventes: ventesNb,
    },
    apercu,
  };
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
  if (!filtres.inclureArchives) {
    where.push('o.archive = 0');
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.numero_delivrance,
           o.type, o.annee, o.medium, o.support, o.dimensions, o.format, o.style,
           o.prix, o.statut, o.image_path, o.archive, o.sage_cree,
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

function obtenirFicheOeuvreBundle(id) {
  const oeuvre = obtenirOeuvre(id);
  if (!oeuvre) return null;
  const voisins = voisinsOeuvre(id);
  const ventes = listerVentesOeuvre(id);
  const certificats = listerCertificatsParOeuvre(id);
  const artiste = oeuvre.artiste_id ? obtenirArtiste(oeuvre.artiste_id) : null;
  return { oeuvre, voisins, ventes, certificats, artiste };
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

function listerClients(filtres = {}) {
  const db = openDatabase();
  const where = filtres.inclureArchives ? '' : 'WHERE c.archive = 0';
  return db.prepare(`
    SELECT c.id, c.nom, c.prenom, c.courriel, c.telephone, c.ville,
           c.consentement_courriel, c.consentement_date, c.archive,
           (SELECT COUNT(*) FROM ventes v WHERE v.client_id = c.id) AS nb_ventes
    FROM clients c
    ${where}
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

function obtenirFicheClientBundle(id) {
  const client = obtenirClient(id);
  if (!client) return null;
  const voisins = voisinsClient(id);
  const ventes = listerVentesClient(id);
  return { client, voisins, ventes };
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

function oeuvresRecentes(limite = 6) {
  const db = openDatabase();
  return db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.annee, o.prix, o.statut,
           o.image_path,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    WHERE o.archive = 0
    ORDER BY o.cree_le DESC, o.id DESC
    LIMIT ?
  `).all(limite);
}

function ventesRecentes(limite = 6) {
  const db = openDatabase();
  return db.prepare(`
    SELECT v.id, v.date_vente, v.prix_vente, v.tps, v.tvq, v.numero_facture,
           o.titre AS oeuvre_titre, o.image_path, o.numero_inventaire,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           c.id AS client_id,
           TRIM(COALESCE(c.prenom || ' ', '') || c.nom) AS client_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients c ON c.id = v.client_id
    ORDER BY v.date_vente DESC, v.id DESC
    LIMIT ?
  `).all(limite);
}

// Jalon 3 — ventes dont au moins une étape post-vente n'est pas complétée :
// paiement non reçu, ou emballage/envoi/livraison sans date.
function commandesNonCompletees(limite = 10) {
  const db = openDatabase();
  return db.prepare(`
    SELECT v.id, v.date_vente, v.numero_facture,
           v.prix_vente, v.tps, v.tvq,
           v.paiement_statut, v.paiement_date,
           v.emballage_date, v.envoi_date, v.livraison_date,
           o.titre AS oeuvre_titre, o.image_path, o.numero_inventaire,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           c.id AS client_id,
           TRIM(COALESCE(c.prenom || ' ', '') || c.nom) AS client_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients c ON c.id = v.client_id
    WHERE v.paiement_statut IS NULL OR v.paiement_statut != 'recu'
       OR v.emballage_date IS NULL
       OR v.envoi_date IS NULL
       OR v.livraison_date IS NULL
    ORDER BY v.date_vente DESC, v.id DESC
    LIMIT ?
  `).all(limite);
}

// Section Suivi — œuvres non vendues pas encore prêtes (à créer dans Sage
// ou à publier sur le site). Le catalogue existant a été backfillé prêt,
// donc cette liste ne contient que les œuvres ajoutées depuis.
function oeuvresAPreparer() {
  const db = openDatabase();
  return db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.image_path, o.statut,
           o.sage_cree, o.sage_cree_date, o.stock_fait, o.stock_fait_date,
           o.site_publie, o.site_publie_date,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    WHERE o.archive = 0
      AND o.statut <> 'vendu'
      AND (o.sage_cree = 0 OR o.stock_fait = 0 OR o.site_publie = 0)
    ORDER BY o.cree_le DESC, o.id DESC
  `).all();
}

// Section Suivi — toutes les ventes avec leurs champs de cycle de vie.
// Le renderer sépare « en cours » et « complétées » côté affichage.
function ventesSuivi() {
  const db = openDatabase();
  return db.prepare(`
    SELECT v.id, v.date_vente, v.numero_facture,
           v.prix_vente, v.tps, v.tvq,
           v.paiement_statut, v.paiement_date,
           v.emballage_date, v.envoi_date, v.livraison_date,
           o.titre AS oeuvre_titre, o.image_path, o.numero_inventaire,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           c.id AS client_id,
           TRIM(COALESCE(c.prenom || ' ', '') || c.nom) AS client_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients c ON c.id = v.client_id
    ORDER BY v.date_vente DESC, v.id DESC
  `).all();
}

function oeuvresReservees(limite = 8) {
  const db = openDatabase();
  return db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.prix, o.image_path,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           o.modifie_le
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    WHERE o.statut = 'reserve' AND o.archive = 0
    ORDER BY o.modifie_le DESC, o.id DESC
    LIMIT ?
  `).all(limite);
}

function ventesParMois(nbMois = 12) {
  const db = openDatabase();
  return db.prepare(`
    SELECT strftime('%Y-%m', date_vente) AS mois,
           COUNT(*) AS nb,
           COALESCE(SUM(prix_vente + tps + tvq), 0) AS montant
    FROM ventes
    WHERE date_vente >= date('now', '-' || ? || ' months', 'start of month')
    GROUP BY mois
    ORDER BY mois ASC
  `).all(nbMois);
}

function statsTableauDeBord() {
  const db = openDatabase();
  const debutMois = "datetime('now', 'start of month')";

  const total = db.prepare('SELECT COUNT(*) AS n FROM oeuvres WHERE archive = 0').get().n;
  const totalDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres WHERE archive = 0 AND cree_le >= ${debutMois}`)
    .get().n;

  const artistes = db.prepare('SELECT COUNT(*) AS n FROM artistes WHERE archive = 0').get().n;
  const artistesDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM artistes WHERE archive = 0 AND cree_le >= ${debutMois}`)
    .get().n;

  // « Clients actifs » = clients non archivés avec au moins une vente
  const clientsActifs = db.prepare(`
    SELECT COUNT(DISTINCT c.id) AS n FROM clients c
    JOIN ventes v ON v.client_id = c.id
    WHERE c.archive = 0
  `).get().n;
  const clientsDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM clients WHERE archive = 0 AND cree_le >= ${debutMois}`)
    .get().n;

  const ventesRow = db
    .prepare(`
      SELECT COUNT(*) AS n,
             COALESCE(SUM(prix_vente + tps + tvq), 0) AS montant
      FROM ventes
      WHERE date_vente >= date('now', 'start of month')
    `).get();

  // Comparaison avec le mois précédent
  const ventesMoisPrec = db
    .prepare(`
      SELECT COALESCE(SUM(prix_vente + tps + tvq), 0) AS montant
      FROM ventes
      WHERE date_vente >= date('now', 'start of month', '-1 month')
        AND date_vente <  date('now', 'start of month')
    `).get().montant;
  const deltaPct = ventesMoisPrec > 0
    ? Math.round(((ventesRow.montant - ventesMoisPrec) / ventesMoisPrec) * 100)
    : null;

  // Valeur du catalogue disponible (prix des œuvres disponibles non archivées)
  const valeurCatalogue = db
    .prepare(`SELECT COALESCE(SUM(prix), 0) AS v FROM oeuvres WHERE statut = 'disponible' AND archive = 0`)
    .get().v;

  return {
    total,
    totalDeltaMois,
    artistes,
    artistesDeltaMois,
    clientsActifs,
    clientsDeltaMois,
    ventesMois: ventesRow.n,
    ventesMoisMontant: ventesRow.montant,
    ventesDeltaPct: deltaPct,
    valeurCatalogue,
  };
}

function statsOeuvres() {
  const db = openDatabase();
  // Bornes du mois courant en UTC, format ISO compatible SQLite (datetime('now'))
  const debutMois = "datetime('now', 'start of month')";

  const total = db.prepare('SELECT COUNT(*) AS n FROM oeuvres WHERE archive = 0').get().n;
  const totalDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres WHERE archive = 0 AND cree_le >= ${debutMois}`)
    .get().n;

  const artistes = db.prepare('SELECT COUNT(*) AS n FROM artistes WHERE archive = 0').get().n;
  const artistesDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM artistes WHERE archive = 0 AND cree_le >= ${debutMois}`)
    .get().n;

  const ventesRow = db
    .prepare(`
      SELECT COUNT(*) AS n,
             COALESCE(SUM(prix_vente + tps + tvq), 0) AS montant
      FROM ventes
      WHERE date_vente >= date('now', 'start of month')
    `).get();

  const disponibles = db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres WHERE statut = 'disponible' AND archive = 0`)
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

function listerMediumsOeuvre() {
  const db = openDatabase();
  return db
    .prepare(`SELECT DISTINCT medium FROM oeuvres WHERE medium IS NOT NULL AND TRIM(medium) <> '' ORDER BY medium COLLATE NOCASE`)
    .all()
    .map((r) => r.medium.trim());
}

function listerMediumsArtiste(artisteId) {
  const id = Number(artisteId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const db = openDatabase();
  return db
    .prepare(`SELECT DISTINCT medium FROM oeuvres WHERE artiste_id = ? AND medium IS NOT NULL AND TRIM(medium) <> '' ORDER BY medium COLLATE NOCASE`)
    .all(id)
    .map((r) => r.medium.trim());
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

function obtenirFicheVenteBundle(id) {
  const vente = obtenirVente(id);
  if (!vente) return null;
  const voisins = voisinsVente(id);
  const certificats = listerCertificatsParVente(id);
  return { vente, voisins, certificats };
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
  obtenirFicheArtisteBundle,
  voisinsArtiste,
  listerOeuvres,
  obtenirOeuvre,
  obtenirFicheOeuvreBundle,
  voisinsOeuvre,
  listerTypesOeuvre,
  listerMediumsOeuvre,
  listerMediumsArtiste,
  statsOeuvres,
  listerClients,
  obtenirClient,
  obtenirFicheClientBundle,
  voisinsClient,
  listerVentesClient,
  listerVentesOeuvre,
  listerVentes,
  obtenirVente,
  obtenirFicheVenteBundle,
  voisinsVente,
  listerCertificatsParOeuvre,
  listerCertificatsParVente,
  obtenirCertificat,
  oeuvresRecentes,
  ventesRecentes,
  oeuvresReservees,
  commandesNonCompletees,
  oeuvresAPreparer,
  ventesSuivi,
  ventesParMois,
  statsTableauDeBord,
};
