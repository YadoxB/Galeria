const { openDatabase } = require('./database');

// ---------------------------------------------------------------------------
// Ordre « naturel » des numéros d'inventaire
//
// Les numéros mêlent des lettres et un bloc de chiffres de longueur variable
// (CLB565, CLB1236, HUP99, HUP1069). Un tri de texte compare alors chiffre par
// chiffre : CLB565 se retrouve APRÈS CLB1236, et la liste devient impossible à
// suivre. Mesuré sur le catalogue réel : 6 artistes sur 20 étaient concernés.
//
// SQLite ne sait pas faire ce tri (COLLATE NOCASE reste alphabétique), donc on
// remet la liste en ordre côté JavaScript après la requête.
// ⚠ Une copie de ce comparateur vit dans src/app/commun.js pour l'interface :
// les deux processus ne partagent pas de module. Les modifier ensemble.
// ---------------------------------------------------------------------------
const COLLATEUR_NATUREL = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

function comparerInventaire(a, b) {
  const x = String(a == null ? '' : a).trim();
  const y = String(b == null ? '' : b).trim();
  // Une œuvre sans numéro passe à la fin : c'est une fiche à compléter, pas le
  // début de la série.
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return COLLATEUR_NATUREL.compare(x, y);
}

// Remet une liste d'œuvres dans l'ordre attendu : artiste (quand la ligne le
// porte), puis numéro d'inventaire naturel, puis titre.
function trierParInventaire(lignes) {
  return [...lignes].sort((x, y) => {
    if (x.artiste_nom != null && y.artiste_nom != null) {
      const c = COLLATEUR_NATUREL.compare(x.artiste_nom || '', y.artiste_nom || '');
      if (c !== 0) return c;
    }
    const n = comparerInventaire(x.numero_inventaire, y.numero_inventaire);
    if (n !== 0) return n;
    return COLLATEUR_NATUREL.compare(x.titre || '', y.titre || '');
  });
}

function listerArtistes(filtres = {}) {
  const db = openDatabase();
  const where = filtres.inclureArchives ? '' : 'WHERE a.archive = 0';
  return db.prepare(`
    SELECT a.id, a.nom, a.prenom, a.type, a.prefixe_inventaire,
           a.courriel, a.telephone, a.province, a.langue, a.photo_path, a.archive,
           (SELECT COUNT(*) FROM oeuvres o WHERE o.artiste_id = a.id) AS nb_oeuvres,
           (SELECT COUNT(*) FROM oeuvres o
             WHERE o.artiste_id = a.id AND o.archive = 0) AS nb_oeuvres_catalogue,
           (SELECT COUNT(*) FROM oeuvres o
             WHERE o.artiste_id = a.id AND o.archive = 0
               AND o.statut = 'disponible') AS nb_oeuvres_dispo
    FROM artistes a
    ${where}
    ORDER BY a.nom COLLATE NOCASE, a.prenom COLLATE NOCASE
  `).all();
}

function obtenirArtiste(id) {
  const db = openDatabase();
  const artiste = db.prepare('SELECT * FROM artistes WHERE id = ?').get(id);
  if (!artiste) return null;
  // Trois comptes distincts — ne pas les confondre :
  //   nb_oeuvres           → TOUTES les œuvres, vendues et retirées comprises.
  //                          Sert au garde-fou de suppression d'un artiste
  //                          (artiste-fiche.js). Il doit rester complet, sinon
  //                          un artiste dont toutes les œuvres sont vendues
  //                          deviendrait supprimable sans avertissement.
  //   nb_oeuvres_catalogue → ce qui est encore à la galerie (retirées exclues).
  //                          Même périmètre que oeuvresPourCatalogue().
  //   nb_oeuvres_dispo     → le nombre principal montré à l'écran (carte de
  //                          l'artiste et en-tête de sa fiche).
  const compte = (cond) => db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres WHERE artiste_id = ?${cond}`)
    .get(id).n;
  const nb_oeuvres = compte('');
  const nb_oeuvres_catalogue = compte(' AND archive = 0');
  const nb_oeuvres_dispo = compte(" AND archive = 0 AND statut = 'disponible'");
  return { ...artiste, nb_oeuvres, nb_oeuvres_catalogue, nb_oeuvres_dispo };
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

  // Œuvres actuellement parties en exposition. Elles ne sont ni disponibles
  // ni retirées : le statut « exposee » les exclut déjà du compte des
  // disponibles, et elles restent au catalogue (archive = 0).
  const exposeesNb = db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres
              WHERE artiste_id = ? AND archive = 0 AND statut = 'exposee'`)
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
      catalogue: artiste.nb_oeuvres_catalogue,
      // Retirées = rendues à l'artiste (archive = 1). Le total moins ce qui
      // reste au catalogue : pas de requête de plus.
      retirees: artiste.nb_oeuvres - artiste.nb_oeuvres_catalogue,
      disponibles: dispoRow.n,
      exposees: exposeesNb,
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
           o.hauteur, o.largeur, o.profondeur, o.emplacement, o.exposition_actuelle,
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

// Différences de synchro « déjà réglées » (l'utilisateur garde la version app).
// Retourne les lignes brutes ; main.js les indexe par `${oeuvre_id}:${champ}`.
function listerWebSyncIgnore() {
  const db = openDatabase();
  return db.prepare('SELECT oeuvre_id, champ, site_cle FROM web_sync_ignore').all();
}

function listerWebSyncIgnoreArtiste() {
  const db = openDatabase();
  return db.prepare('SELECT artiste_id, champ, site_cle FROM web_sync_ignore_artiste').all();
}

// Artistes actifs avec les champs comparables au site (nom, biographie,
// curriculum, photo). Le curriculum sert à éviter un faux « différent » quand le
// site combine bio + CV dans un seul bloc. Exclut les archivés.
function artistesPourComparaisonWeb() {
  const db = openDatabase();
  return db.prepare(`
    SELECT id, prenom, nom, citation, biographie, demarche, curriculum, photo_path
    FROM artistes
    WHERE archive = 0
    ORDER BY nom COLLATE NOCASE
  `).all();
}

// Œuvres actives avec les champs comparables au site (Phase 5, sens « tirer »).
// Inclut `description` (absente de listerOeuvres). Exclut les archivées/retirées.
function oeuvresPourComparaisonWeb() {
  const db = openDatabase();
  return db.prepare(`
    SELECT o.id, o.numero_inventaire, o.titre, o.description, o.prix, o.statut, o.image_path,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    WHERE o.archive = 0
    ORDER BY o.numero_inventaire COLLATE NOCASE, o.titre COLLATE NOCASE
  `).all();
}

function obtenirFicheOeuvreBundle(id) {
  const oeuvre = obtenirOeuvre(id);
  if (!oeuvre) return null;
  const voisins = voisinsOeuvre(id);
  const ventes = listerVentesOeuvre(id);
  const certificats = listerCertificatsParOeuvre(id);
  const artiste = oeuvre.artiste_id ? obtenirArtiste(oeuvre.artiste_id) : null;
  const reservationClient = oeuvre.reservation_client_id ? obtenirClient(oeuvre.reservation_client_id) : null;
  return { oeuvre, voisins, ventes, certificats, artiste, reservationClient };
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

// Section Documents — tous les PDF produits, réunis depuis leurs sources.
// Aujourd'hui : certificats (certificats.pdf_path) + factures artiste
// (ventes.facture_artiste_path). À étendre quand les factures client et les
// lettres de remerciement (ventes.facture_client_path / lettre_path) seront
// générées. `ref_id` = id à passer pour la re-génération (certificat ou vente).
function tousLesDocuments() {
  const db = openDatabase();
  const certificats = db.prepare(`
    SELECT 'certificat' AS type, c.id AS ref_id,
           c.numero_delivrance AS numero, c.date_delivrance AS date, c.pdf_path AS pdf_path,
           o.titre AS oeuvre_titre,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           TRIM(COALESCE(cl.prenom || ' ', '') || cl.nom) AS client_nom
    FROM certificats c
    JOIN oeuvres o ON o.id = c.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    LEFT JOIN ventes v ON v.id = c.vente_id
    LEFT JOIN clients cl ON cl.id = v.client_id
    WHERE c.pdf_path IS NOT NULL AND TRIM(c.pdf_path) <> ''
  `).all();
  const facturesArtiste = db.prepare(`
    SELECT 'facture_artiste' AS type, v.id AS ref_id,
           v.numero_facture_artiste AS numero, v.date_vente AS date, v.facture_artiste_path AS pdf_path,
           o.titre AS oeuvre_titre,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           TRIM(COALESCE(cl.prenom || ' ', '') || cl.nom) AS client_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients cl ON cl.id = v.client_id
    WHERE v.facture_artiste_path IS NOT NULL AND TRIM(v.facture_artiste_path) <> ''
  `).all();
  return [...certificats, ...facturesArtiste];
}

// Rapport journalier — journal d'une journée donnée (YYYY-MM-DD) : intrants
// (œuvres/artistes ajoutés), extrants (œuvres retirées ce jour), ventes du jour
// et activité opérationnelle (événements du cycle de vie survenus ce jour).
function rapportJournalier(dateISO) {
  const db = openDatabase();
  const oeuvresAjoutees = db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o JOIN artistes a ON a.id = o.artiste_id
    WHERE date(o.cree_le) = ?
    ORDER BY o.cree_le, o.id
  `).all(dateISO);
  const artistesAjoutes = db.prepare(`
    SELECT id, TRIM(COALESCE(prenom || ' ', '') || nom) AS nom, type
    FROM artistes WHERE date(cree_le) = ? ORDER BY cree_le, id
  `).all(dateISO);
  const oeuvresRetirees = db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.retrait_motif,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o JOIN artistes a ON a.id = o.artiste_id
    WHERE o.retrait_date = ?
    ORDER BY o.titre
  `).all(dateISO);
  const ventes = db.prepare(`
    SELECT v.id, v.numero_facture, v.prix_vente, v.tps, v.tvq,
           o.titre AS oeuvre_titre,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           TRIM(COALESCE(c.prenom || ' ', '') || c.nom) AS client_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients c ON c.id = v.client_id
    WHERE date(v.date_vente) = ?
    ORDER BY v.id
  `).all(dateISO);

  // Activité opérationnelle : événements du cycle de vie survenus ce jour.
  const evenementVente = (colDate, condSup = '') => db.prepare(`
    SELECT v.id, v.numero_facture, v.prix_vente, v.tps, v.tvq,
           o.titre AS oeuvre_titre,
           TRIM(COALESCE(c.prenom || ' ', '') || c.nom) AS client_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN clients c ON c.id = v.client_id
    WHERE date(v.${colDate}) = ? ${condSup}
    ORDER BY v.id
  `).all(dateISO);
  const certificatsProduits = db.prepare(`
    SELECT c.numero_delivrance AS numero, o.titre AS oeuvre_titre
    FROM certificats c JOIN oeuvres o ON o.id = c.oeuvre_id
    WHERE date(c.cree_le) = ?
    ORDER BY c.id
  `).all(dateISO);
  const activite = {
    paiementsRecus: evenementVente('paiement_date', "AND v.paiement_statut = 'recu'"),
    emballages: evenementVente('emballage_date'),
    envois: evenementVente('envoi_date'),
    livraisons: evenementVente('livraison_date'),
    certificats: certificatsProduits,
  };

  // Suivi opérationnel (état courant, indépendant de la journée choisie) :
  // admissions en cours (préparation incomplète) + ventes/livraisons en cours.
  const admissionsEnCours = db.prepare(`
    SELECT o.id, o.titre, o.cree_le, o.sage_cree, o.stock_fait, o.site_publie,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom
    FROM oeuvres o JOIN artistes a ON a.id = o.artiste_id
    WHERE o.archive = 0 AND o.statut <> 'vendu'
      AND (o.sage_cree = 0 OR o.stock_fait = 0 OR o.site_publie = 0)
    ORDER BY o.cree_le DESC, o.id DESC
  `).all();
  const ventesEnCours = db.prepare(`
    SELECT v.id, v.numero_facture, v.prix_vente, v.date_vente,
           v.paiement_statut, v.emballage_date, v.envoi_date, v.livraison_date,
           o.titre AS oeuvre_titre,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           TRIM(COALESCE(c.prenom || ' ', '') || c.nom) AS client_nom
    FROM ventes v
    JOIN oeuvres o ON o.id = v.oeuvre_id
    JOIN artistes a ON a.id = o.artiste_id
    JOIN clients c ON c.id = v.client_id
    WHERE v.paiement_statut IS NULL OR v.paiement_statut <> 'recu'
       OR v.emballage_date IS NULL OR v.envoi_date IS NULL OR v.livraison_date IS NULL
    ORDER BY v.date_vente DESC, v.id DESC
  `).all();

  return {
    date: dateISO, oeuvresAjoutees, artistesAjoutes, oeuvresRetirees, ventes, activite,
    suivi: { admissionsEnCours, ventesEnCours },
  };
}

function oeuvresReservees(limite = 8) {
  const db = openDatabase();
  return db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.prix, o.image_path,
           TRIM(COALESCE(a.prenom || ' ', '') || a.nom) AS artiste_nom,
           o.reservation_echeance,
           TRIM(COALESCE(cl.prenom || ' ', '') || cl.nom) AS client_nom,
           o.modifie_le
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    LEFT JOIN clients cl ON cl.id = o.reservation_client_id
    WHERE o.statut = 'reserve' AND o.archive = 0
    ORDER BY (o.reservation_echeance IS NULL), o.reservation_echeance ASC, o.modifie_le DESC
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

  // Œuvres DISPONIBLES (demande de Dave, 2026-07-18) : ce compteur montrait
  // auparavant toutes les œuvres non archivées, vendues et réservées comprises,
  // ce qui ne disait rien de ce qu'il reste à vendre. Le delta du mois suit la
  // même règle, pour rester cohérent avec le chiffre affiché au-dessus.
  const total = db
    .prepare("SELECT COUNT(*) AS n FROM oeuvres WHERE archive = 0 AND statut = 'disponible'")
    .get().n;
  const totalDeltaMois = db
    .prepare(`SELECT COUNT(*) AS n FROM oeuvres WHERE archive = 0 AND statut = 'disponible' AND cree_le >= ${debutMois}`)
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

// Valeurs déjà employées au catalogue, pour alimenter les suggestions des
// champs à saisie libre (support, style, type d'artiste). Même esprit que
// listerTypesOeuvre / listerMediumsOeuvre.
function listerSupportsOeuvre() {
  const db = openDatabase();
  return db
    .prepare(`SELECT DISTINCT TRIM(support) AS support FROM oeuvres WHERE support IS NOT NULL AND TRIM(support) <> '' ORDER BY TRIM(support) COLLATE NOCASE`)
    .all()
    .map((r) => r.support.trim());
}

function listerStylesOeuvre() {
  const db = openDatabase();
  return db
    .prepare(`SELECT DISTINCT TRIM(style) AS style FROM oeuvres WHERE style IS NOT NULL AND TRIM(style) <> '' ORDER BY TRIM(style) COLLATE NOCASE`)
    .all()
    .map((r) => r.style.trim());
}

function listerTypesArtiste() {
  const db = openDatabase();
  return db
    .prepare(`SELECT DISTINCT TRIM(type) AS type FROM artistes WHERE type IS NOT NULL AND TRIM(type) <> '' ORDER BY TRIM(type) COLLATE NOCASE`)
    .all()
    .map((r) => r.type.trim());
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

// ===== Expositions =====

// Liste des expositions, la plus récente d'abord, avec le nombre d'œuvres
// encore présentes (celles rendues avant la fin ne comptent plus).
function listerExpositions({ inclureTerminees = true } = {}) {
  const db = openDatabase();
  const where = inclureTerminees ? '' : "WHERE e.statut = 'en_cours'";
  return db.prepare(`
    SELECT e.*,
           (SELECT COUNT(*) FROM exposition_oeuvres eo
             WHERE eo.exposition_id = e.id AND eo.retire_le IS NULL) AS nb_oeuvres,
           (SELECT COUNT(*) FROM exposition_oeuvres eo
             WHERE eo.exposition_id = e.id) AS nb_oeuvres_total
    FROM expositions e
    ${where}
    ORDER BY (e.statut = 'terminee'), COALESCE(e.date_debut, e.cree_le) DESC, e.id DESC
  `).all();
}

// Une exposition et ses œuvres (avec de quoi bâtir un cartel).
function obtenirExposition(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  const db = openDatabase();
  const expo = db.prepare('SELECT * FROM expositions WHERE id = ?').get(n);
  if (!expo) return null;
  const oeuvres = db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.medium, o.dimensions,
           o.hauteur, o.largeur, o.profondeur, o.prix, o.statut, o.image_path,
           o.url_site, o.annee,
           a.nom AS artiste_nom, a.prenom AS artiste_prenom,
           eo.statut_avant, eo.ajoute_le, eo.retire_le
    FROM exposition_oeuvres eo
    JOIN oeuvres o   ON o.id = eo.oeuvre_id
    JOIN artistes a  ON a.id = o.artiste_id
    WHERE eo.exposition_id = ?
    ORDER BY a.nom COLLATE NOCASE, o.numero_inventaire COLLATE NOCASE, o.titre COLLATE NOCASE
  `).all(n);
  return { ...expo, oeuvres: trierParInventaire(oeuvres) };
}

// Œuvres qu'on peut envoyer en exposition : disponibles ou réservées, encore
// à la galerie (pas retirées), et pas déjà parties dans une exposition en
// cours — une toile ne peut pas être à deux endroits à la fois.
function oeuvresEligiblesExposition() {
  const db = openDatabase();
  return trierParInventaire(db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.medium, o.dimensions, o.prix,
           o.statut, o.image_path, o.format,
           a.nom AS artiste_nom, a.prenom AS artiste_prenom, a.id AS artiste_id
    FROM oeuvres o
    JOIN artistes a ON a.id = o.artiste_id
    WHERE o.archive = 0
      AND o.statut IN ('disponible', 'reserve')
      AND NOT EXISTS (
        SELECT 1 FROM exposition_oeuvres eo
        JOIN expositions e ON e.id = eo.exposition_id
        WHERE eo.oeuvre_id = o.id AND eo.retire_le IS NULL AND e.statut = 'en_cours'
      )
    ORDER BY a.nom COLLATE NOCASE, o.numero_inventaire COLLATE NOCASE, o.titre COLLATE NOCASE
  `).all());
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
      o.type AS oeuvre_type, o.dimensions, o.medium, o.support, o.annee,
      o.prix AS oeuvre_prix, o.frais_production,
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

// Œuvres d'un artiste pour le catalogue imprimé : exclut les archivées et les
// retirées, ordonnées par numéro d'inventaire puis titre.
function oeuvresPourCatalogue(artisteId) {
  const db = openDatabase();
  return trierParInventaire(db.prepare(`
    SELECT o.id, o.titre, o.numero_inventaire, o.medium, o.support,
           o.dimensions, o.statut, o.prix, o.image_path
    FROM oeuvres o
    WHERE o.artiste_id = ? AND o.archive = 0 AND o.retrait_date IS NULL
    ORDER BY o.numero_inventaire COLLATE NOCASE, o.titre COLLATE NOCASE
  `).all(artisteId));
}

// Œuvres d'un artiste avec tous les champs utiles à une Annexe A (dépôt/retrait) :
// dimensions séparées, codes (médium/support/signature), prix, statut. Exclut
// les archivées.
function oeuvresDetailArtiste(artisteId) {
  const db = openDatabase();
  return trierParInventaire(db.prepare(`
    SELECT o.id, o.numero_inventaire, o.titre, o.format,
           o.hauteur, o.largeur, o.profondeur,
           o.medium, o.support, o.emplacement_signature, o.annee,
           o.prix, o.statut, o.retrait_date
    FROM oeuvres o
    WHERE o.artiste_id = ? AND o.archive = 0
    ORDER BY o.numero_inventaire COLLATE NOCASE, o.titre COLLATE NOCASE
  `).all(artisteId));
}

// Œuvres par liste d'IDs, avec les champs utiles à une Annexe A. Sans filtre
// d'archive : nécessaire pour le retrait, qui met archive = 1 sur l'œuvre.
function oeuvresParIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const db = openDatabase();
  const ph = ids.map(() => '?').join(',');
  return trierParInventaire(db.prepare(`
    SELECT o.id, o.numero_inventaire, o.titre, o.format,
           o.hauteur, o.largeur, o.profondeur,
           o.medium, o.support, o.emplacement_signature, o.annee,
           o.prix, o.statut, o.retrait_date
    FROM oeuvres o
    WHERE o.id IN (${ph})
    ORDER BY o.numero_inventaire COLLATE NOCASE, o.titre COLLATE NOCASE
  `).all(...ids));
}

module.exports = {
  listerExpositions, obtenirExposition, oeuvresEligiblesExposition,
  listerArtistes,
  obtenirArtiste,
  oeuvresPourCatalogue,
  oeuvresDetailArtiste,
  oeuvresParIds,
  obtenirFicheArtisteBundle,
  voisinsArtiste,
  listerOeuvres,
  obtenirOeuvre,
  oeuvresPourComparaisonWeb,
  listerWebSyncIgnore,
  listerWebSyncIgnoreArtiste,
  artistesPourComparaisonWeb,
  obtenirFicheOeuvreBundle,
  voisinsOeuvre,
  listerTypesOeuvre,
  listerSupportsOeuvre,
  listerStylesOeuvre,
  listerTypesArtiste,
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
  tousLesDocuments,
  rapportJournalier,
  ventesParMois,
  statsTableauDeBord,
};
