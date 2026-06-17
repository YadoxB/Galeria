const fs = require('node:fs');
const { parse } = require('csv-parse/sync');

const HEADER_ARTISTES = "Nom de l'artiste";
const HEADER_OEUVRES = "Titre de l'œuvre";

function parseCsv(content) {
  return parse(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    cast: false,
    relax_quotes: true,
  });
}

function detectType(headers) {
  if (headers.includes(HEADER_ARTISTES)) return 'artistes';
  if (headers.includes(HEADER_OEUVRES)) return 'oeuvres';
  return null;
}

function previewFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCsv(content);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { type: detectType(headers), count: rows.length, rows, headers };
}

function emptyToNull(v) {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
}

function parseChecked(v) {
  return (v ?? '').toString().trim().toLowerCase() === 'checked' ? 1 : 0;
}

function parseAnnee(v) {
  const s = emptyToNull(v);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isInteger(n) && n > 1000 && n < 3000 ? n : null;
}

function parsePrix(v) {
  const s = emptyToNull(v);
  if (!s) return null;
  const cleaned = s.replace(/[$\s,]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatut(v) {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (!s) return 'disponible';
  if (s.startsWith('disponible')) return 'disponible';
  if (s.startsWith('vendu')) return 'vendu';
  if (s.startsWith('réserv') || s.startsWith('reserv')) return 'reserve';
  if (s.startsWith('prêt') || s.startsWith('pret')) return 'pretee';
  return 'disponible';
}

function premiere(...vals) {
  for (const v of vals) {
    const e = emptyToNull(v);
    if (e != null) return e;
  }
  return null;
}

function valeursArtiste(row) {
  return [
    emptyToNull(row['Type']),
    emptyToNull(row["Préfixe d'inventaire"]),
    emptyToNull(row['Adresse']),
    emptyToNull(row['Téléphone']),
    emptyToNull(row['Courriel']),
    emptyToNull(row['Province']),
    parseChecked(row['Perçoit les taxes']),
    emptyToNull(row['Langue']),
    premiere(row['Démarche artistique'], row['Démarche']),
    premiere(row['C.V.'], row['CV']),
    premiere(row['Biographie'], row['Bio']),
  ];
}

function importArtistes(db, rows, mode = 'ajouter') {
  const insertStmt = db.prepare(`
    INSERT INTO artistes (
      nom, type, prefixe_inventaire, adresse, telephone, courriel,
      province, percoit_taxes, langue,
      demarche, curriculum, biographie
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE artistes SET
      type = ?, prefixe_inventaire = ?, adresse = ?, telephone = ?, courriel = ?,
      province = ?, percoit_taxes = ?, langue = ?,
      demarche = ?, curriculum = ?, biographie = ?,
      modifie_le = datetime('now')
    WHERE id = ?
  `);
  const findStmt = db.prepare('SELECT id FROM artistes WHERE nom = ?');

  const result = {
    table: 'artistes',
    mode,
    total: rows.length,
    imported: 0,
    updated: 0,
    skipped: [],
    errors: [],
  };

  db.exec('BEGIN');
  try {
    rows.forEach((row, i) => {
      const nom = emptyToNull(row[HEADER_ARTISTES]);
      if (!nom) {
        result.errors.push(`Ligne ${i + 2} : nom vide`);
        return;
      }
      const existant = findStmt.get(nom);
      const vals = valeursArtiste(row);
      if (existant) {
        if (mode === 'mettre_a_jour') {
          updateStmt.run(...vals, existant.id);
          result.updated++;
        } else {
          result.skipped.push(nom);
        }
        return;
      }
      insertStmt.run(nom, ...vals);
      result.imported++;
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return result;
}

function valeursOeuvre(row, artisteId, numInv) {
  return [
    artisteId,
    emptyToNull(row['Type']),
    numInv,
    emptyToNull(row['Numéro de délivrance']),
    parseAnnee(row['Année']),
    emptyToNull(row['Médium']),
    emptyToNull(row['Support']),
    emptyToNull(row['Dimension']),
    emptyToNull(row['Format']),
    emptyToNull(row['Orientation']),
    emptyToNull(row['Sujets']),
    emptyToNull(row['Emplacement de la signature']),
    emptyToNull(row['Particularité']),
    emptyToNull(row['Description']),
    parsePrix(row['Prix régulier']),
    normalizeStatut(row['Statut']),
    premiere(row['URL'], row['URL site'], row['URL site web'], row['Lien produit'], row['Site web']),
  ];
}

function importOeuvres(db, rows, mode = 'ajouter') {
  const insertStmt = db.prepare(`
    INSERT INTO oeuvres (
      titre,
      artiste_id, type, numero_inventaire, numero_delivrance,
      annee, medium, support, dimensions,
      format, orientation, sujets,
      emplacement_signature, particularite, description, prix, statut, url_site
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE oeuvres SET
      artiste_id = ?, type = ?, numero_inventaire = ?, numero_delivrance = ?,
      annee = ?, medium = ?, support = ?, dimensions = ?,
      format = ?, orientation = ?, sujets = ?,
      emplacement_signature = ?, particularite = ?, description = ?,
      prix = ?, statut = ?, url_site = ?,
      modifie_le = datetime('now')
    WHERE id = ?
  `);
  const findArtisteStmt = db.prepare('SELECT id FROM artistes WHERE nom = ?');
  const findByInvStmt = db.prepare('SELECT id FROM oeuvres WHERE numero_inventaire = ?');
  const findByTitreArtisteStmt = db.prepare(
    'SELECT id FROM oeuvres WHERE titre = ? AND artiste_id = ?'
  );

  const result = {
    table: 'oeuvres',
    mode,
    total: rows.length,
    imported: 0,
    updated: 0,
    skipped: [],
    orphans: [],
    errors: [],
  };

  db.exec('BEGIN');
  try {
    rows.forEach((row, i) => {
      const titre = emptyToNull(row[HEADER_OEUVRES]);
      const nomArtiste = emptyToNull(row['Artiste']);
      if (!titre) {
        result.errors.push(`Ligne ${i + 2} : titre vide`);
        return;
      }
      if (!nomArtiste) {
        result.orphans.push({ titre, raison: 'Aucun artiste indiqué' });
        return;
      }
      const artiste = findArtisteStmt.get(nomArtiste);
      if (!artiste) {
        result.orphans.push({
          titre,
          raison: `Artiste « ${nomArtiste} » introuvable`,
        });
        return;
      }
      const numInv = emptyToNull(row["Numéro d'inventaire"]);
      const existant = numInv
        ? findByInvStmt.get(numInv)
        : findByTitreArtisteStmt.get(titre, artiste.id);
      const vals = valeursOeuvre(row, artiste.id, numInv);
      if (existant) {
        if (mode === 'mettre_a_jour') {
          updateStmt.run(...vals, existant.id);
          result.updated++;
        } else {
          result.skipped.push(titre);
        }
        return;
      }
      insertStmt.run(titre, ...vals);
      result.imported++;
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return result;
}

module.exports = { previewFile, importArtistes, importOeuvres };
