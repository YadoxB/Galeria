const { BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDatabase } = require('./db/database');
const { getDocumentsDirAnnee, getPhotosDir } = require('./db/paths');
const { obtenirCertificat, obtenirVente, obtenirArtiste, oeuvresPourCatalogue, listerCertificatsParVente } = require('./db/requetes');
const { obtenirOuReserverNumeroFactureArtisteVente, enregistrerAnnexe, majAnnexePdfPath, majPresentationArtiste, creerCertificat, reserverProchainNumeroCertificat } = require('./db/mutations');
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

    // Hook d'ajustement optionnel (ex. lettre : réduire le texte pour tenir sur
    // une page). Exécuté une fois polices et images chargées, avant le rendu.
    await win.webContents.executeJavaScript(
      'if (typeof window.ajusterApresRendu === "function") { window.ajusterApresRendu(); } true;'
    );

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

// ===== Éditeur de document (« version modifiée », WYSIWYG) =====

// Script injecté dans la fenêtre d'édition : rend le document éditable et ajoute
// une barre d'outils (non imprimée) avec Enregistrer / Annuler.
const INJECT_EDIT_JS = `(function(){
  var style = document.createElement('style');
  style.textContent = '.editeur-barre{position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;align-items:center;gap:12px;padding:10px 16px;background:#1c1a17;color:#fff;font-family:-apple-system,Segoe UI,Arial,sans-serif;}'
    + '.editeur-barre .info{flex:1;opacity:.85;font-size:12.5px;}'
    + '.editeur-barre button{border:0;border-radius:7px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}'
    + '#ed-annuler{background:#3a3631;color:#fff;}#ed-ok{background:#900001;color:#fff;}'
    + 'body{padding-top:58px;}'
    + '[contenteditable=true]:focus-within, [contenteditable=true]:focus{outline:none;}'
    + '@media print{.editeur-barre{display:none!important;}body{padding-top:0!important;}}';
  document.head.appendChild(style);
  var bar = document.createElement('div');
  bar.className = 'editeur-barre';
  bar.setAttribute('contenteditable','false');
  bar.innerHTML = '<span class="info">Mode édition — clique dans le document pour modifier le texte, puis enregistre.</span>'
    + '<button type="button" id="ed-annuler">Annuler</button>'
    + '<button type="button" id="ed-ok">Enregistrer en PDF</button>';
  document.body.appendChild(bar);
  document.body.setAttribute('contenteditable','true');
  bar.setAttribute('contenteditable','false');
  document.getElementById('ed-ok').addEventListener('click', function(){ window.editeur && window.editeur.enregistrer(); });
  document.getElementById('ed-annuler').addEventListener('click', function(){ window.editeur && window.editeur.annuler(); });
})();`;

// Ouvre le document dans une fenêtre éditable ; l'utilisateur modifie le texte
// puis exporte en PDF. Retourne le chemin du PDF, ou null si annulé.
function ouvrirEditeurDocument({ gabaritNom, donnees, sortie, paysage = false, titre }) {
  return new Promise((resolve, reject) => {
    const gabaritPath = path.join(__dirname, '..', 'gabarits', gabaritNom);
    if (!fs.existsSync(gabaritPath)) { reject(new Error(`Gabarit introuvable : ${gabaritNom}`)); return; }

    const win = new BrowserWindow({
      show: true,
      width: paysage ? 1400 : 1024,
      height: 900,
      title: titre || 'Version modifiée',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload-editeur.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    let fini = false;
    const onSave = async (e) => {
      if (e.sender !== win.webContents || fini) return;
      try {
        const pdfBuffer = await win.webContents.printToPDF({
          pageSize: 'Letter', landscape: !!paysage, printBackground: true, margins: { marginType: 'none' },
        });
        fs.mkdirSync(path.dirname(sortie), { recursive: true });
        fs.writeFileSync(sortie, pdfBuffer);
        fini = true; nettoyer(); if (!win.isDestroyed()) win.close(); resolve(sortie);
      } catch (err) {
        fini = true; nettoyer(); if (!win.isDestroyed()) win.close(); reject(err);
      }
    };
    const onCancel = (e) => {
      if (e.sender !== win.webContents || fini) return;
      fini = true; nettoyer(); if (!win.isDestroyed()) win.close(); resolve(null);
    };
    function nettoyer() {
      ipcMain.removeListener('editeur:enregistrer', onSave);
      ipcMain.removeListener('editeur:annuler', onCancel);
    }
    ipcMain.on('editeur:enregistrer', onSave);
    ipcMain.on('editeur:annuler', onCancel);
    win.on('closed', () => { if (!fini) { fini = true; nettoyer(); resolve(null); } });

    (async () => {
      try {
        await win.loadFile(gabaritPath);
        await win.webContents.executeJavaScript(`(function(){ try{ remplir(${JSON.stringify(donnees)}); }catch(e){ throw e; } })();`);
        await win.webContents.executeJavaScript(`new Promise((r)=>{ const s=()=>requestAnimationFrame(()=>requestAnimationFrame(r)); const imgs=Array.from(document.images||[]); const ip=imgs.map(im=>im.complete?Promise.resolve():new Promise(rr=>{im.addEventListener('load',rr,{once:true});im.addEventListener('error',rr,{once:true});})); const fp=(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve(); Promise.all([fp,...ip]).then(s,s); })`);
        await win.webContents.executeJavaScript('if (typeof window.ajusterApresRendu === "function") { window.ajusterApresRendu(); } true;');
        await win.webContents.executeJavaScript(INJECT_EDIT_JS);
      } catch (err) {
        if (!fini) { fini = true; nettoyer(); if (!win.isDestroyed()) win.close(); reject(err); }
      }
    })();
  });
}

// ===== Orchestrateurs : certificat =====

async function genererCertificatPdf(certificatId) {
  const cert = obtenirCertificat(certificatId);
  if (!cert) throw new Error('Certificat introuvable.');
  const cfg = obtenirConfig();
  const donnees = preparerDonneesCertificat(cert, cfg);
  // Le certificat officiel vit dans la pochette de la vente (s'il y en a une).
  const sortie = cheminCertificatOfficiel(cert);

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
  const dossier = path.join(getDocumentsDirAnnee(annee), 'Factures artiste');
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
  const dossier = path.join(getDocumentsDirAnnee(anneeDe(dateISO)), 'Rapports');
  // Horodatage dans le nom : évite le verrou EBUSY si un rapport précédent du
  // même jour est encore ouvert dans le visionneur, et garde l'historique.
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const stamp = `${p(n.getHours())}h${p(n.getMinutes())}`;
  const sortie = path.join(dossier, `Rapport_${dateISO}_${stamp}.pdf`);
  await genererPdf({ gabaritNom: 'gabarit-rapport.html', donnees, sortie });
  return sortie;
}

// ===== Orchestrateur : catalogue d'artiste =====

function dispoCatalogue(o) {
  const s = (o.statut || '').toLowerCase();
  // Vendue ou réservée → non disponible à la vente.
  if (s.includes('vend') || s.includes('réserv') || s.includes('reserv')) {
    return { label: 'Non disponible', classe: 'dispo-indispo' };
  }
  // Disponible → on affiche le prix (ou « Prix sur demande » si absent).
  const prix = formaterValeurCa(o.prix);
  return { label: prix || 'Prix sur demande', classe: 'dispo-prix' };
}

function preparerDonneesCatalogue(artiste, oeuvres) {
  const nom = [artiste.prenom, artiste.nom].filter((x) => x && String(x).trim()).join(' ') || artiste.nom || '';
  return {
    artiste_nom: nom,
    logo: 'actifs/logo-gvsj.png',
    oeuvres: oeuvres.map((o) => {
      const dims = o.dimensions || '';
      const med = o.medium || '';
      const sup = o.support || '';
      const medSup = med ? (sup ? `${med} sur ${sup}` : med) : (sup || '');
      const details = [dims, medSup].filter(Boolean).join(' · ');
      const d = dispoCatalogue(o);
      return {
        inv: o.numero_inventaire || '',
        titre: o.titre || '',
        details,
        dispo: d.label,
        dispoClasse: d.classe,
        photo: photoEnDataUrl(o.image_path),
      };
    }),
  };
}

async function genererCataloguePdf(artisteId) {
  const artiste = obtenirArtiste(artisteId);
  if (!artiste) throw new Error('Artiste introuvable.');
  const oeuvres = oeuvresPourCatalogue(artisteId);
  const donnees = preparerDonneesCatalogue(artiste, oeuvres);

  const dossier = path.join(getDocumentsDirAnnee(new Date().getFullYear()), 'Catalogues');
  const slugArt = slug([artiste.prenom, artiste.nom].filter(Boolean).join(' ') || artiste.nom);
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const stamp = `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
  const sortie = path.join(dossier, `Catalogue_${slugArt || 'artiste'}_${stamp}.pdf`);

  await genererPdf({ gabaritNom: 'gabarit-catalogue.html', donnees, sortie, paysage: false });
  return { pdf_path: sortie, nb_oeuvres: oeuvres.length };
}

// ===== Orchestrateur : Annexe A (dépôt / retrait) =====

// Les lignes d'œuvres (codes + prix par cotes) sont préparées côté renderer et
// passées telles quelles ; le main numérote, enregistre et rend le PDF.
async function genererAnnexePdf({ type, artiste_id, artisteId, oeuvres = [], oeuvreIds = null, editer = false }) {
  artisteId = artiste_id != null ? artiste_id : artisteId;
  const artiste = obtenirArtiste(artisteId);
  if (!artiste) throw new Error('Artiste introuvable.');
  const cfg = obtenirConfig();
  const t = type === 'retrait' ? 'retrait' : 'depot';

  const ids = Array.isArray(oeuvreIds) && oeuvreIds.length
    ? oeuvreIds
    : oeuvres.map((o) => o.id).filter(Boolean);
  const enr = enregistrerAnnexe({ artisteId, type: t, oeuvreIds: ids });

  const nom = [artiste.prenom, artiste.nom].filter((x) => x && String(x).trim()).join(' ') || artiste.nom || '';
  const donnees = {
    type: t,
    numero: enr.numero,
    date: dateCourteRap(enr.date),
    identifiant: (artiste.prefixe_inventaire || '').toString().trim() || String(artisteId),
    artiste: { nom, telephone: artiste.telephone || '', courriel: artiste.courriel || '' },
    signataire: (cfg.documents && cfg.documents.signataire_certificat) || 'Joanne Boucher',
    galerie: donneesGalerie(cfg),
    oeuvres,
    total: oeuvres.length,
  };

  const gabarit = 'gabarit-annexe.html';
  const dossier = path.join(getDocumentsDirAnnee(new Date().getFullYear()), 'Annexes');
  const slugArt = slug(nom);
  const nomFichier = `Annexe_${t === 'retrait' ? 'Retrait' : 'Depot'}_${slug(enr.numero, 30)}${slugArt ? '_' + slugArt : ''}.pdf`;
  const sortie = path.join(dossier, nomFichier);

  if (editer) {
    const pdf = await ouvrirEditeurDocument({ gabaritNom: gabarit, donnees, sortie, paysage: true, titre: 'Annexe A — version modifiée' });
    if (pdf) majAnnexePdfPath(enr.id, pdf);
    return { pdf_path: pdf, numero: enr.numero, type: t };
  }
  await genererPdf({ gabaritNom: gabarit, donnees, sortie, paysage: true });
  majAnnexePdfPath(enr.id, sortie);
  return { pdf_path: sortie, numero: enr.numero, type: t };
}

// ===== Orchestrateur : présentation d'artiste (avec cache par signature) =====

function titreDArtiste(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('peintre')) return 'Artiste peintre';
  if (t.includes('sculpteur')) return 'Sculpteur';
  if (t.includes('photo')) return 'Photographe';
  return type || '';
}

// Signature des champs de présentation : sert à détecter un changement de profil
// et à éviter de régénérer un PDF identique. Inclut la date de modif de la photo.
function signaturePresentation(artiste) {
  let mtime = '';
  if (artiste.photo_path) {
    try {
      const pp = path.join(getPhotosDir(), artiste.photo_path);
      if (fs.existsSync(pp)) mtime = String(fs.statSync(pp).mtimeMs);
    } catch {}
  }
  const payload = JSON.stringify({
    nom: [artiste.prenom, artiste.nom].filter((x) => x && String(x).trim()).join(' ') || artiste.nom || '',
    type: artiste.type || '',
    bio: artiste.biographie || '',
    dem: artiste.demarche || '',
    cv: artiste.curriculum || '',
    photo: (artiste.photo_path || '') + '|' + mtime,
  });
  return crypto.createHash('sha1').update(payload).digest('hex');
}

function preparerDonneesPresentation(artiste, cfg) {
  const nom = [artiste.prenom, artiste.nom].filter((x) => x && String(x).trim()).join(' ') || artiste.nom || '';
  return {
    galerie: donneesGalerie(cfg),
    artiste: { nom, titre: titreDArtiste(artiste.type), photo: photoEnDataUrl(artiste.photo_path) },
    sections: [
      { titre: 'Biographie', contenu: artiste.biographie || '' },
      { titre: 'Démarche', contenu: artiste.demarche || '' },
      { titre: 'Curriculum', contenu: artiste.curriculum || '', cv: true, sautAvant: true },
    ],
  };
}

// Génère (ou réutilise) la présentation PDF d'un artiste. Réutilise le PDF
// existant tant que la signature du profil n'a pas changé.
async function genererPresentationPdf(artisteId, { forcer = false } = {}) {
  const artiste = obtenirArtiste(artisteId);
  if (!artiste) throw new Error('Artiste introuvable.');
  const sig = signaturePresentation(artiste);
  if (!forcer && artiste.presentation_sig === sig && artiste.presentation_path && fs.existsSync(artiste.presentation_path)) {
    return { pdf_path: artiste.presentation_path, reutilise: true };
  }
  const cfg = obtenirConfig();
  const donnees = preparerDonneesPresentation(artiste, cfg);
  const dossier = path.join(getDocumentsDirAnnee(new Date().getFullYear()), 'Présentations');
  const slugArt = slug([artiste.prenom, artiste.nom].filter(Boolean).join(' ') || artiste.nom);
  // Nom horodaté : évite le verrou EBUSY si une version précédente est encore
  // ouverte dans le visionneur lors d'une régénération.
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const stamp = `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
  const sortie = path.join(dossier, `Presentation_${slugArt || 'artiste'}_${stamp}.pdf`);
  await genererPdf({ gabaritNom: 'gabarit-presentation.html', donnees, sortie });
  majPresentationArtiste(artisteId, sortie, sig);
  return { pdf_path: sortie, reutilise: false };
}

// Présentation « version modifiée » : applique des textes édités (biographie /
// démarche / curriculum) le temps d'un document, SANS toucher au profil de
// l'artiste ni au cache. Toujours un nouveau fichier.
async function genererPresentationPersonnalisee(artisteId, overrides) {
  const artiste = obtenirArtiste(artisteId);
  if (!artiste) throw new Error('Artiste introuvable.');
  const a = { ...artiste };
  overrides = overrides || {};
  if (typeof overrides.biographie === 'string') a.biographie = overrides.biographie;
  if (typeof overrides.demarche === 'string') a.demarche = overrides.demarche;
  if (typeof overrides.curriculum === 'string') a.curriculum = overrides.curriculum;

  const cfg = obtenirConfig();
  const donnees = preparerDonneesPresentation(a, cfg);
  const dossier = path.join(getDocumentsDirAnnee(new Date().getFullYear()), 'Présentations');
  const slugArt = slug([artiste.prenom, artiste.nom].filter(Boolean).join(' ') || artiste.nom);
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const stamp = `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
  const sortie = path.join(dossier, `Presentation_${slugArt || 'artiste'}_modifiee_${stamp}.pdf`);
  await genererPdf({ gabaritNom: 'gabarit-presentation.html', donnees, sortie });
  return { pdf_path: sortie };
}

// ===== Orchestrateur : pochette de vente (lettre + œuvre + présentation…) =====

const MOIS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dateLettre(iso, langue) {
  const [y, m, j] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y) return '';
  if (langue === 'EN') return `${MOIS_EN[m - 1]} ${j}, ${y}`;
  return `${j} ${MOIS_RAP[m - 1]} ${y}`;
}

function preparerDonneesLettre(vente, cert, cfg) {
  const g = donneesGalerie(cfg);
  g.site_web = (cfg.galerie && cfg.galerie.site_web) || '';
  g.logo = 'actifs/logo-gvsj.png';
  return {
    galerie: g,
    date: dateLettre(vente.date_vente, vente.langue),
    langue: vente.langue || 'FR',
    type_achat: vente.type_achat || 'personne',
    est_cadeau: !!vente.est_cadeau,
    client: { prenom: vente.client_prenom || '', nom: vente.client_nom || '' },
    artiste: { nom: vente.artiste_nom || '' },
    signataire: (cfg.documents && cfg.documents.signataire_certificat) || 'Joanne Boucher',
    oeuvre: {
      titre: vente.oeuvre_titre || '',
      photo: photoEnDataUrl(vente.image_path),
      annee: vente.annee || '',
      medium: vente.medium || '',
      support: vente.support || '',
      dimensions: vente.dimensions || '',
      valeur: formaterValeurCa(vente.prix_vente != null ? vente.prix_vente : vente.oeuvre_prix),
      numero_delivrance: cert ? cert.numero_delivrance : '',
    },
  };
}

// Nom de fichier convivial : retire les caractères interdits, garde accents/espaces.
function nomSur(s) {
  return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Dossier de la pochette d'une vente : Documents\{année}\Pochettes\{client}\{facture}\.
function dossierPochetteVente(vente) {
  const cli = nomSur(`${vente.client_prenom || ''} ${vente.client_nom || ''}`.trim()) || ('client-' + vente.client_id);
  const facture = nomSur(vente.numero_facture || '') || ('vente-' + vente.id);
  return path.join(getDocumentsDirAnnee(anneeDe(vente.date_vente)), 'Pochettes', cli, facture);
}

// Chemin du PDF officiel d'un certificat : dans la pochette si le certificat est
// lié à une vente, sinon dans le dossier Certificats de l'année.
function cheminCertificatOfficiel(cert) {
  const slugTitre = slug(cert.oeuvre_titre);
  const nom = `Certificat_${slug(cert.numero_delivrance || '', 30)}${slugTitre ? '_' + slugTitre : ''}.pdf`;
  if (cert.vente_id) {
    const vente = obtenirVente(cert.vente_id);
    if (vente) return path.join(dossierPochetteVente(vente), nom);
  }
  return path.join(getDocumentsDirAnnee(anneeDe(cert.date_delivrance)), 'Certificats', nom);
}

// Chemin d'un document dans le dossier de la pochette d'une vente, s'il existe
// (sert à « Voir » : on ouvre la version de la pochette, donc modifiée le cas
// échéant). Retourne null si absent.
function cheminPochetteSiExiste(venteId, type) {
  const vente = obtenirVente(venteId);
  if (!vente) return null;
  const nom = nomFichierPochette(type, vente);
  if (!nom) return null;
  const p = path.join(dossierPochetteVente(vente), nom);
  return fs.existsSync(p) ? p : null;
}

// Dossier de la pochette d'une vente + s'il existe (à récupérer AVANT de
// supprimer la vente, car ensuite elle n'est plus en base).
function infosDossierPochette(venteId) {
  const vente = obtenirVente(venteId);
  if (!vente) return { dossier: null, existe: false };
  const dossier = dossierPochetteVente(vente);
  return { dossier, existe: fs.existsSync(dossier) };
}

// Suppression sécurisée d'un dossier de pochette : refuse tout chemin qui n'est
// pas un sous-dossier de Documents\Pochettes (garde-fou anti-effacement).
function supprimerDossierPochette(chemin) {
  const baseDocs = path.resolve(path.dirname(getDocumentsDirAnnee(new Date().getFullYear())));
  const cible = path.resolve(chemin || '');
  // Garde-fou : sous le dossier Documents ET dans un sous-dossier « Pochettes ».
  if (!cible.startsWith(baseDocs + path.sep) || !cible.includes(path.sep + 'Pochettes' + path.sep)) {
    throw new Error('Chemin non autorisé.');
  }
  if (fs.existsSync(cible)) fs.rmSync(cible, { recursive: true, force: true });
  return { ok: true };
}

// Nom de fichier (convivial) d'un document dans la pochette, par type. Doit
// rester identique à ce que produit genererPochette pour que la « version
// modifiée » remplace bien le bon fichier. Retourne null si hors pochette.
function nomFichierPochette(type, vente) {
  if (type === 'lettre') {
    const cli = nomSur(`${vente.client_prenom || ''} ${vente.client_nom || ''}`.trim());
    return 'Lettre de remerciement' + (cli ? ' - ' + cli : '') + '.pdf';
  }
  if (type === 'presentation') {
    const art = nomSur(vente.artiste_nom || '');
    return "Présentation de l'artiste" + (art ? ' - ' + art : '') + '.pdf';
  }
  return null;
}

// Génère le PDF « lettre de remerciement + fiche de l'œuvre » d'une vente.
async function genererLettrePochettePdf(venteId, dossier, nomFichier) {
  const vente = obtenirVente(venteId);
  if (!vente) throw new Error('Vente introuvable.');
  const cfg = obtenirConfig();
  const certs = listerCertificatsParVente(venteId);
  const cert = certs && certs[0] ? certs[0] : null;
  const donnees = preparerDonneesLettre(vente, cert, cfg);

  const annee = anneeDe(vente.date_vente);
  const dest = dossier || path.join(getDocumentsDirAnnee(annee), 'Lettres');
  const slugCli = slug(`${vente.client_prenom || ''} ${vente.client_nom || ''}`.trim()) || 'client';
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const stamp = `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`;
  const sortie = path.join(dest, nomFichier || `Lettre_${slug(vente.numero_facture || '', 30) || slugCli}_${stamp}.pdf`);

  await genererPdf({ gabaritNom: 'gabarit-lettre.html', donnees, sortie });
  const db = openDatabase();
  db.prepare('UPDATE ventes SET lettre_path = ? WHERE id = ?').run(sortie, venteId);
  return { pdf_path: sortie };
}

// Assemble tous les documents de la pochette dans un dossier par vente.
async function genererPochette(venteId) {
  const vente = obtenirVente(venteId);
  if (!vente) throw new Error('Vente introuvable.');
  const cfg = obtenirConfig();
  const dossier = dossierPochetteVente(vente);
  fs.mkdirSync(dossier, { recursive: true });

  const fichiers = [];

  // 1. Lettre + fiche de l'œuvre.
  const lettre = await genererLettrePochettePdf(venteId, dossier, nomFichierPochette('lettre', vente));
  fichiers.push({ label: "Lettre de remerciement + fiche de l'œuvre", path: lettre.pdf_path, present: true });

  // 2. Certificat d'authenticité — produit dans le workflow s'il n'existe pas
  //    encore (valeurs par défaut : valeur = prix de vente, signataire des réglages).
  let cert = (listerCertificatsParVente(venteId) || [])[0];
  if (!cert) {
    const today = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    const dateISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    cert = creerCertificat({
      oeuvre_id: vente.oeuvre_id,
      vente_id: venteId,
      numero_delivrance: reserverProchainNumeroCertificat(),
      date_delivrance: dateISO,
      valeur: vente.prix_vente != null ? vente.prix_vente : vente.oeuvre_prix,
      signataire: (cfg.documents && cfg.documents.signataire_certificat) || 'Joanne Boucher',
      particularite: null,
      pdf_path: null,
    });
  }
  if (cert && (!cert.pdf_path || !fs.existsSync(cert.pdf_path))) {
    const gen = await genererCertificatPdf(cert.id); // écrit directement dans la pochette
    cert.pdf_path = gen.pdf_path;
  }
  if (cert && cert.pdf_path && fs.existsSync(cert.pdf_path)) {
    fichiers.push({ label: "Certificat d'authenticité", path: cert.pdf_path, present: true });
  } else {
    fichiers.push({ label: "Certificat d'authenticité", path: null, present: false, note: 'à produire' });
  }

  // 3. Présentation de l'artiste (réutilisée via le cache) → copie.
  try {
    const pres = await genererPresentationPdf(vente.artiste_id);
    const dest = path.join(dossier, nomFichierPochette('presentation', vente));
    fs.copyFileSync(pres.pdf_path, dest);
    fichiers.push({ label: "Présentation de l'artiste", path: dest, present: true });
  } catch (e) {
    fichiers.push({ label: "Présentation de l'artiste", path: null, present: false, note: e.message });
  }

  // 4. Guide de l'acheteur (actif fixe) → copie.
  const guideSrc = path.join(__dirname, '..', 'gabarits', 'actifs', 'guide_certificat.pdf');
  if (fs.existsSync(guideSrc)) {
    const dest = path.join(dossier, "Guide de l'acheteur.pdf");
    fs.copyFileSync(guideSrc, dest);
    fichiers.push({ label: "Guide de l'acheteur", path: dest, present: true });
  }

  return { dossier, fichiers };
}

// Dispatcher « version modifiée » pour les documents pilotés par un id.
async function editerDocument(spec) {
  const cfg = obtenirConfig();
  const an = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const stamp = `${an.getFullYear()}${p(an.getMonth() + 1)}${p(an.getDate())}-${p(an.getHours())}${p(an.getMinutes())}${p(an.getSeconds())}`;
  const dossierAnnee = getDocumentsDirAnnee(an.getFullYear());
  let gabaritNom, donnees, paysage = false, sortie, titre;

  // Contexte de vente : si le document appartient à une pochette, la version
  // modifiée ira dans le dossier de cette pochette (en remplaçant le standard).
  let venteCtx = null;
  if ((spec.type === 'lettre' || spec.type === 'facture-artiste' || spec.type === 'presentation') && spec.vente_id) {
    venteCtx = obtenirVente(spec.vente_id);
  } else if (spec.type === 'certificat') {
    const c0 = obtenirCertificat(spec.certificat_id);
    if (c0 && c0.vente_id) venteCtx = obtenirVente(c0.vente_id);
  }

  if (spec.type === 'presentation') {
    const artiste = obtenirArtiste(spec.artiste_id);
    if (!artiste) throw new Error('Artiste introuvable.');
    const sa = slug([artiste.prenom, artiste.nom].filter(Boolean).join(' ') || artiste.nom) || 'artiste';
    gabaritNom = 'gabarit-presentation.html';
    donnees = preparerDonneesPresentation(artiste, cfg);
    sortie = path.join(dossierAnnee, 'Présentations', `Presentation_${sa}_modifiee_${stamp}.pdf`);
    titre = 'Présentation — version modifiée';
  } else if (spec.type === 'catalogue') {
    const artiste = obtenirArtiste(spec.artiste_id);
    if (!artiste) throw new Error('Artiste introuvable.');
    const sa = slug([artiste.prenom, artiste.nom].filter(Boolean).join(' ') || artiste.nom) || 'artiste';
    gabaritNom = 'gabarit-catalogue.html';
    donnees = preparerDonneesCatalogue(artiste, oeuvresPourCatalogue(spec.artiste_id));
    sortie = path.join(dossierAnnee, 'Catalogues', `Catalogue_${sa}_modifie_${stamp}.pdf`);
    titre = 'Catalogue — version modifiée';
  } else if (spec.type === 'lettre') {
    const vente = obtenirVente(spec.vente_id);
    if (!vente) throw new Error('Vente introuvable.');
    const cert = (listerCertificatsParVente(spec.vente_id) || [])[0] || null;
    gabaritNom = 'gabarit-lettre.html';
    donnees = preparerDonneesLettre(vente, cert, cfg);
    sortie = path.join(dossierAnnee, 'Lettres', `Lettre_modifiee_${stamp}.pdf`);
    titre = 'Lettre — version modifiée';
  } else if (spec.type === 'certificat') {
    const cert = obtenirCertificat(spec.certificat_id);
    if (!cert) throw new Error('Certificat introuvable.');
    gabaritNom = 'gabarit-certificat.html';
    donnees = preparerDonneesCertificat(cert, cfg);
    paysage = true;
    // On édite le PDF officiel du certificat lui-même (qui vit dans la pochette
    // s'il est lié à une vente).
    sortie = cert.pdf_path || cheminCertificatOfficiel(cert);
    titre = 'Certificat — version modifiée';
  } else if (spec.type === 'facture-artiste') {
    const vente = obtenirVente(spec.vente_id);
    if (!vente) throw new Error('Vente introuvable.');
    const artiste = obtenirArtiste(vente.artiste_id);
    const num = obtenirOuReserverNumeroFactureArtisteVente(spec.vente_id);
    vente.numero_facture_artiste = num;
    gabaritNom = 'gabarit-facture-artiste.html';
    donnees = preparerDonneesFactureArtiste(vente, artiste, cfg, num);
    sortie = path.join(dossierAnnee, 'Factures artiste', `FactureArtiste_${slug(num || '', 30)}_modifiee_${stamp}.pdf`);
    titre = 'Facture artiste — version modifiée';
  } else {
    throw new Error('Type de document inconnu : ' + spec.type);
  }

  // Documents de pochette liés à une vente : remplacer le fichier de la pochette
  // (même nom) au lieu de créer un fichier séparé.
  if (venteCtx && (spec.type === 'lettre' || spec.type === 'presentation')) {
    sortie = path.join(dossierPochetteVente(venteCtx), nomFichierPochette(spec.type, venteCtx));
  }

  const pdf = await ouvrirEditeurDocument({ gabaritNom, donnees, sortie, paysage, titre });
  return { pdf_path: pdf };
}

module.exports = { genererCertificatPdf, genererFactureArtistePdf, genererRapportPdf, genererCataloguePdf, genererAnnexePdf, genererPresentationPdf, genererPresentationPersonnalisee, genererLettrePochettePdf, genererPochette, editerDocument, cheminPochetteSiExiste, infosDossierPochette, supprimerDossierPochette };
