const { BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase } = require('./db/database');
const { getDocumentsDirAnnee, getPhotosDir } = require('./db/paths');
const { obtenirCertificat, obtenirVente, obtenirArtiste } = require('./db/requetes');
const { obtenirOuReserverNumeroFactureArtisteVente } = require('./db/mutations');
const { obtenirConfig } = require('./config');

// ===== Helpers =====

function slug(s, maxLen = 40) {
  if (!s) return '';
  return String(s)
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
}

function anneeDe(dateIso) {
  if (!dateIso) return new Date().getFullYear();
  const m = String(dateIso).match(/^(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

function formaterValeurCa(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return Math.round(v).toLocaleString('fr-CA').replace(/ /g, ' ').replace(/ /g, ' ') + ' $';
}

function photoEnDataUrl(cheminRelatif) {
  if (!cheminRelatif) return '';
  const photoPath = path.join(getPhotosDir(), cheminRelatif);
  if (!fs.existsSync(photoPath)) return '';
  const buf = fs.readFileSync(photoPath);
  const ext = path.extname(photoPath).slice(1).toLowerCase();
  const mime = (ext === 'png') ? 'image/png'
              : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
              : (ext === 'gif') ? 'image/gif'
              : (ext === 'webp') ? 'image/webp'
              : 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function typeContrat(typeOeuvre) {
  if (!typeOeuvre) return { type: 'peintre', type_autre: '' };
  const t = typeOeuvre.toLowerCase();
  if (t.includes('sculpt')) return { type: 'sculpteur', type_autre: '' };
  if (t.includes('reprod')) return { type: 'reproduction', type_autre: '' };
  if (t.includes('photo'))  return { type: 'autre', type_autre: 'photographe' };
  if (t.includes('estamp') || t.includes('gravu')) return { type: 'autre', type_autre: 'graveur' };
  if (t.includes('dessin')) return { type: 'autre', type_autre: 'dessinateur' };
  return { type: 'peintre', type_autre: '' };
}

function donneesGalerie(cfg) {
  const g = cfg.galerie || {};
  return {
    nom: g.nom || '',
    adresse_ligne1: g.adresse_ligne1 || '',
    adresse_ligne2: g.adresse_ligne2 || '',
    telephone: g.telephone || '',
    courriel: g.courriel || '',
  };
}

// ===== Préparation des données par gabarit =====

function preparerDonneesCertificat(certificat, cfg) {
  const tc = typeContrat(certificat.oeuvre_type);
  return {
    galerie: donneesGalerie(cfg),
    type: tc.type,
    type_autre: tc.type_autre,
    titre: certificat.oeuvre_titre || '',
    artiste: certificat.artiste_nom || '',
    annee: certificat.annee ? String(certificat.annee) : '',
    valeur: formaterValeurCa(certificat.valeur),
    medium: certificat.medium || '',
    support: certificat.support || '',
    dimensions: certificat.dimensions || '',
    signature: certificat.emplacement_signature || '',
    particularite: certificat.particularite || '',
    numero: certificat.numero_delivrance || '',
    date: certificat.date_delivrance || '',
    photo: photoEnDataUrl(certificat.image_path),
  };
}

function preparerDonneesFactureArtiste(vente, artiste, cfg, numeroFactureArtiste) {
  // Numéros de taxes de l'artiste, parsés depuis JSON
  let tps = { active: false, taux: cfg.documents.tps_taux, numero: '' };
  let tvq = { active: false, taux: cfg.documents.tvq_taux, numero: '' };
  if (artiste.numeros_taxes) {
    try {
      const liste = JSON.parse(artiste.numeros_taxes);
      if (Array.isArray(liste)) {
        for (const ent of liste) {
          const et = (ent.etiquette || '').toUpperCase();
          if (et.includes('TPS') || et === 'GST') {
            tps = { active: true, taux: cfg.documents.tps_taux, numero: ent.numero || '' };
          } else if (et.includes('TVQ') || et === 'QST') {
            tvq = { active: true, taux: cfg.documents.tvq_taux, numero: ent.numero || '' };
          }
        }
      }
    } catch {}
  }

  // « Artiste peintre », « Artiste sculpteur », etc. — depuis le type de l'artiste
  let titreArtiste = '';
  if (artiste.type) {
    const t = artiste.type.toLowerCase();
    if (t.includes('peintre')) titreArtiste = 'Artiste peintre';
    else if (t.includes('sculpteur')) titreArtiste = 'Sculpteur';
    else if (t.includes('photo')) titreArtiste = 'Photographe';
    else titreArtiste = artiste.type;
  }

  const nomCompletArtiste = [artiste.prenom, artiste.nom].filter((x) => x && String(x).trim()).join(' ') || artiste.nom || '';
  return {
    galerie: donneesGalerie(cfg),
    numero: numeroFactureArtiste || vente.numero_facture_artiste || '',
    date: vente.date_vente || '',
    artiste: {
      nom: nomCompletArtiste,
      titre: titreArtiste,
      adresse: artiste.adresse || '',
      telephone: artiste.telephone || '',
      courriel: artiste.courriel || '',
    },
    oeuvre: {
      titre: vente.oeuvre_titre || '',
      inventaire: vente.numero_inventaire || '',
      format: vente.dimensions || '',
    },
    montants: {
      // Le gabarit recalcule prix_vente = prix_regulier - rabais.
      // On reconstruit le prix régulier depuis le sous-total stocké et les rabais.
      prix_regulier: (Number(vente.prix_vente) || 0) + (Number(vente.rabais_artiste) || 0) + (Number(vente.rabais_galerie) || 0),
      rabais_artiste: Number(vente.rabais_artiste) || 0,
      rabais_galerie: Number(vente.rabais_galerie) || 0,
      cote_pct: cfg.documents.cote_galerie_pourcent || 50,
    },
    taxes: {
      actives: !!artiste.percoit_taxes,
      tps,
      tvq,
    },
    paiement: {
      mode: vente.mode_paiement || '',
      commentaire: '',
    },
  };
}

// ===== Génération PDF (cœur) =====

async function genererPdf({ gabaritNom, donnees, sortie, paysage = false }) {
  const gabaritPath = path.join(__dirname, '..', 'gabarits', gabaritNom);
  if (!fs.existsSync(gabaritPath)) {
    throw new Error(`Gabarit introuvable : ${gabaritNom}`);
  }

  const win = new BrowserWindow({
    show: false,
    width: 1240,
    height: 1600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await win.loadFile(gabaritPath);

    // Injecter les données dans le gabarit
    const json = JSON.stringify(donnees);
    await win.webContents.executeJavaScript(`(function(){
      try { remplir(${json}); } catch(e) { throw e; }
    })();`);

    // Attendre que polices et images soient prêtes
    await win.webContents.executeJavaScript(`new Promise((resolve) => {
      const settle = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
      const imgs = Array.from(document.images || []);
      const imgPromises = imgs.map((im) => {
        if (im.complete) return Promise.resolve();
        return new Promise((r) => {
          im.addEventListener('load', r, { once: true });
          im.addEventListener('error', r, { once: true });
        });
      });
      const fontsP = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      Promise.all([fontsP, ...imgPromises]).then(settle, settle);
    })`);

    const pdfBuffer = await win.webContents.printToPDF({
      pageSize: 'Letter',
      landscape: !!paysage,
      printBackground: true,
      margins: { marginType: 'none' },
    });

    fs.mkdirSync(path.dirname(sortie), { recursive: true });
    fs.writeFileSync(sortie, pdfBuffer);
    return sortie;
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}

// ===== Orchestrateurs : certificat =====

async function genererCertificatPdf(certificatId) {
  const cert = obtenirCertificat(certificatId);
  if (!cert) throw new Error('Certificat introuvable.');
  const cfg = obtenirConfig();
  const donnees = preparerDonneesCertificat(cert, cfg);
  const annee = anneeDe(cert.date_delivrance);
  const dossier = getDocumentsDirAnnee(annee);
  const slugTitre = slug(cert.oeuvre_titre);
  const nomFichier = `Certificat_${slug(cert.numero_delivrance, 30)}${slugTitre ? '_' + slugTitre : ''}.pdf`;
  const sortie = path.join(dossier, nomFichier);

  await genererPdf({ gabaritNom: 'gabarit-certificat.html', donnees, sortie, paysage: true });

  const db = openDatabase();
  db.prepare('UPDATE certificats SET pdf_path = ? WHERE id = ?').run(sortie, certificatId);
  return { pdf_path: sortie };
}

// ===== Orchestrateurs : facture artiste =====

async function genererFactureArtistePdf(venteId) {
  const vente = obtenirVente(venteId);
  if (!vente) throw new Error('Vente introuvable.');
  const artiste = obtenirArtiste(vente.artiste_id);
  if (!artiste) throw new Error('Artiste introuvable.');
  const cfg = obtenirConfig();

  // Réserve un numéro de facture artiste (ou récupère celui déjà réservé pour cette vente)
  const numeroFA = obtenirOuReserverNumeroFactureArtisteVente(venteId);
  vente.numero_facture_artiste = numeroFA;

  const donnees = preparerDonneesFactureArtiste(vente, artiste, cfg, numeroFA);
  const annee = anneeDe(vente.date_vente);
  const dossier = getDocumentsDirAnnee(annee);
  const slugArt = slug([artiste.prenom, artiste.nom].filter(Boolean).join(' ') || artiste.nom);
  const nomFichier = `FactureArtiste_${slug(numeroFA, 30)}${slugArt ? '_' + slugArt : ''}.pdf`;
  const sortie = path.join(dossier, nomFichier);

  await genererPdf({ gabaritNom: 'gabarit-facture-artiste.html', donnees, sortie, paysage: false });

  const db = openDatabase();
  db.prepare('UPDATE ventes SET facture_artiste_path = ? WHERE id = ?').run(sortie, venteId);
  return { pdf_path: sortie, numero_facture_artiste: numeroFA };
}

// ===== Orchestrateur : rapport journalier =====

const MOIS_RAP = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateLongueRap(iso) {
  const [y, m, j] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, j).toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function dateCourteRap(val) {
  const [y, m, j] = String(val || '').slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return `${j} ${MOIS_RAP[m - 1]} ${y}`;
}

function preparerDonneesRapport(rap, cfg, dateISO) {
  const ventes = rap.ventes || [];
  const sousTotal = ventes.reduce((s, v) => s + (Number(v.prix_vente) || 0), 0);
  const tps = ventes.reduce((s, v) => s + (Number(v.tps) || 0), 0);
  const tvq = ventes.reduce((s, v) => s + (Number(v.tvq) || 0), 0);
  const su = rap.suivi || { admissionsEnCours: [], ventesEnCours: [] };
  const admissionsEnCours = (su.admissionsEnCours || []).map((o) => ({ ...o, admission: dateCourteRap(o.cree_le) }));
  const now = new Date();
  return {
    galerie: (cfg.galerie && cfg.galerie.nom) || 'La Galerie du Vieux Saint-Jean',
    dateLongue: dateLongueRap(dateISO),
    dateCourte: dateCourteRap(dateISO),
    heure: `${now.getHours()} h ${String(now.getMinutes()).padStart(2, '0')}`,
    oeuvresAjoutees: rap.oeuvresAjoutees || [],
    artistesAjoutes: rap.artistesAjoutes || [],
    oeuvresRetirees: rap.oeuvresRetirees || [],
    ventes,
    suivi: { admissionsEnCours, ventesEnCours: su.ventesEnCours || [] },
    totaux: { sousTotal, tps, tvq, total: sousTotal + tps + tvq, nbIntrants: (rap.oeuvresAjoutees || []).length + (rap.artistesAjoutes || []).length },
  };
}

async function genererRapportPdf(dateISO) {
  const { rapportJournalier } = require('./db/requetes');
  const rap = rapportJournalier(dateISO);
  const cfg = obtenirConfig();
  const donnees = preparerDonneesRapport(rap, cfg, dateISO);
  const dossier = getDocumentsDirAnnee(anneeDe(dateISO));
  // Horodatage dans le nom : évite le verrou EBUSY si un rapport précédent du
  // même jour est encore ouvert dans le visionneur, et garde l'historique.
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const stamp = `${p(n.getHours())}h${p(n.getMinutes())}`;
  const sortie = path.join(dossier, `Rapport_${dateISO}_${stamp}.pdf`);
  await genererPdf({ gabaritNom: 'gabarit-rapport.html', donnees, sortie });
  return sortie;
}

module.exports = { genererCertificatPdf, genererFactureArtistePdf, genererRapportPdf };
