// Courriel préparé, jamais envoyé : Galeria ouvre un BROUILLON dans le logiciel
// de courriel de la galerie, pièce jointe comprise ; c'est la personne qui
// relit et clique « Envoyer ». Aucun mot de passe, aucun serveur de courriel :
// rien ne quitte l'ordinateur autrement que par Outlook, comme d'habitude.
//
// Deux voies, dans cet ordre :
//   1. Outlook « classique » piloté directement (objet COM Outlook.Application,
//      par un court script PowerShell) — la voie des parents. Le texte s'écrit
//      AU-DESSUS de leur signature habituelle, qu'Outlook ajoute en ouvrant le
//      brouillon.
//   2. À défaut (pas d'Outlook classique, Outlook sans profil, délai dépassé),
//      un fichier .eml marqué « X-Unsent: 1 », que Windows ouvre avec le
//      logiciel de courriel par défaut comme un brouillon à envoyer.
// Le nouvel Outlook n'a pas d'objet COM : il passe par la voie 2.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const DELAI_OUTLOOK_MS = 45000;          // Outlook peut mettre du temps à démarrer

// ===== Fichier .eml (RFC 5322 / MIME) =====

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const enTete = (s) => (/^[\x20-\x7e]*$/.test(String(s)) ? String(s) : `=?UTF-8?B?${b64(s)}?=`);
const lignes76 = (base64) => base64.replace(/.{1,76}/g, '$&\r\n');

function construireEml({ a, sujet, texte, piece }) {
  const frontiere = `----=_Galeria_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const tetes = [
    'X-Unsent: 1',
    ...(a ? [`To: ${a}`] : []),
    `Subject: ${enTete(sujet)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${frontiere}"`,
  ];
  const corps = [
    `--${frontiere}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    lignes76(b64(texte.replace(/\r?\n/g, '\r\n'))),
  ];
  if (piece) {
    const nom = enTete(piece.nom);
    corps.push(
      `--${frontiere}`,
      `Content-Type: application/pdf; name="${nom}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${nom}"`,
      '',
      lignes76(fs.readFileSync(piece.chemin).toString('base64')),
    );
  }
  corps.push(`--${frontiere}--`, '');
  return `${tetes.join('\r\n')}\r\n\r\n${corps.join('\r\n')}`;
}

// ===== Outlook classique, par COM =====
//
// Les données passent par un fichier JSON, jamais par la ligne de commande :
// ni guillemets à échapper, ni caractère spécial qui casse la commande. Le
// texte est inséré juste après <body> — et non par -replace, où un « $ » du
// texte serait pris pour une référence de groupe.
const SCRIPT_OUTLOOK = String.raw`
param([string]$Donnees)
$ErrorActionPreference = 'Stop'
try {
  $d = Get-Content -LiteralPath $Donnees -Raw -Encoding UTF8 | ConvertFrom-Json
  $ol = New-Object -ComObject Outlook.Application
  $m = $ol.CreateItem(0)
  if ($d.a) { $m.To = $d.a }
  $m.Subject = $d.sujet
  if ($d.piece) { $null = $m.Attachments.Add($d.piece) }
  $m.Display($false)
  $corps = $m.HTMLBody
  $mt = [regex]::Match($corps, '(?is)<body[^>]*>')
  if ($mt.Success) {
    $i = $mt.Index + $mt.Length
    $m.HTMLBody = $corps.Substring(0, $i) + $d.html + $corps.Substring($i)
  } else {
    $m.HTMLBody = $d.html + $corps
  }
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

function dossierTemporaire() {
  const d = path.join(os.tmpdir(), 'Galeria-courriels');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function ouvrirDansOutlook({ a, sujet, html, piece }) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') { resolve({ ok: false, erreur: 'Windows seulement.' }); return; }
    const dossier = dossierTemporaire();
    const jeton = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const script = path.join(dossier, `outlook-${jeton}.ps1`);
    const donnees = path.join(dossier, `outlook-${jeton}.json`);
    // BOM : sans lui, Windows PowerShell 5.1 lirait le script en ANSI.
    fs.writeFileSync(script, `\uFEFF${SCRIPT_OUTLOOK}`, 'utf8');
    fs.writeFileSync(donnees, JSON.stringify({ a: a || '', sujet, html, piece: piece ? piece.chemin : '' }), 'utf8');
    const nettoyer = () => { for (const f of [script, donnees]) { try { fs.unlinkSync(f); } catch { /* sans conséquence */ } } };
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Donnees', donnees],
      { timeout: DELAI_OUTLOOK_MS, windowsHide: true },
      (err, _stdout, stderr) => {
        nettoyer();
        if (err) resolve({ ok: false, erreur: String(stderr || err.message || '').trim().split('\n')[0] });
        else resolve({ ok: true });
      });
  });
}

// Ouvre le brouillon : Outlook d'abord, le .eml ensuite. `shell` = celui
// d'Electron (openPath), passé par l'appelant pour garder ce module testable.
async function ouvrirBrouillon(courriel, { shell }) {
  const outlook = await ouvrirDansOutlook(courriel);
  if (outlook.ok) return { moyen: 'outlook' };
  const eml = path.join(dossierTemporaire(), `${courriel.nomFichier || 'Courriel'}.eml`);
  fs.writeFileSync(eml, construireEml(courriel), 'utf8');
  const erreur = await shell.openPath(eml);
  if (erreur) throw new Error(`Le brouillon n'a pas pu s'ouvrir (${erreur}). Le fichier est ici : ${eml}`);
  return { moyen: 'eml', eml_path: eml, raison_outlook: outlook.erreur };
}

// ===== Le courriel de la facture artiste =====
//
// Demande de Dave (2026-09-08) : « quand une facture artiste est produite,
// offrir de préparer le courriel pour l'envoi », PDF déjà joint.
//
// Le message se règle dans l'app (Réglages → Documents → « Courriel à
// l'artiste », demande du 2026-09-21). Les {jetons} y sont remplacés par les
// données de la vente. Tout passe par ce fichier : l'écran des réglages ne
// fabrique aucun texte lui-même, il demande son aperçu ici.

const echHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function dateLongue(iso, langue) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(langue === 'EN' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Le texte d'origine, celui que Galeria propose tant qu'on ne l'a pas réécrit.
const MODELES_DEFAUT = {
  fr: {
    sujet: 'Facture {numéro} — « {titre} »',
    texte: [
      'Bonjour {prénom},',
      'Bonne nouvelle : votre œuvre « {titre} » a été vendue le {date}.',
      "Vous trouverez ci-joint la facture {numéro}, qui détaille le prix de vente, la commission de la galerie et le montant qui vous revient.",
      'Merci de votre confiance,',
    ].join('\n\n'),
  },
  en: {
    sujet: 'Invoice {numéro} — “{titre}”',
    texte: [
      'Hello {prénom},',
      'Good news: your artwork “{titre}” was sold on {date}.',
      "Please find attached the invoice {numéro}, which details the sale price, the gallery's commission and the amount due to you.",
      'Thank you for your trust,',
    ].join('\n\n'),
  },
};

// Les mots entre accolades. `cle` est la forme normalisée : « {Numéro} » et
// « {numero} » mènent au même endroit — on ne pénalise pas une majuscule ou un
// accent oublié.
const JETONS = [
  { cle: 'prénom', jeton: '{prénom}', libelle: "Prénom de l'artiste" },
  { cle: 'titre', jeton: '{titre}', libelle: "Titre de l'œuvre" },
  { cle: 'date', jeton: '{date}', libelle: 'Date de la vente' },
  { cle: 'numéro', jeton: '{numéro}', libelle: 'N° de la facture' },
];
const JETON_RE = /\{([^{}\n]{1,30})\}/g;
const normJeton = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const CLES_JETONS = JETONS.map((j) => normJeton(j.cle));

// Remplace les {jetons} connus. Un jeton inconnu (faute de frappe) est laissé
// TEL QUEL et signalé : mieux vaut un « {prenom2} » visible dans le brouillon
// qu'un trou silencieux dans le courriel.
function appliquerJetons(gabarit, valeurs, inconnus) {
  return String(gabarit == null ? '' : gabarit).replace(JETON_RE, (tout, nom) => {
    const cle = normJeton(nom);
    if (CLES_JETONS.includes(cle)) return String(valeurs[cle] == null ? '' : valeurs[cle]);
    if (inconnus) inconnus.add(tout);
    return tout;
  });
}

const paragraphes = (texte) => String(texte || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

// Le modèle en vigueur : celui des réglages s'il est rempli, sinon l'original.
// Un champ vidé retombe sur l'original plutôt que d'envoyer un courriel vide.
function modeleFactureArtiste(langue) {
  const { obtenirConfig } = require('./config');
  const cle = langue === 'EN' ? 'en' : 'fr';
  const defaut = MODELES_DEFAUT[cle];
  const regle = (((obtenirConfig() || {}).courriel || {}).facture_artiste || {})[cle] || {};
  return {
    sujet: String(regle.sujet || '').trim() ? String(regle.sujet) : defaut.sujet,
    texte: String(regle.texte || '').trim() ? String(regle.texte) : defaut.texte,
  };
}

function valeursFactureArtiste(vente, artiste, langue) {
  return {
    'prenom': String(artiste.prenom || '').trim() || String(artiste.nom || '').trim(),
    'titre': String(vente.oeuvre_titre || '').trim(),
    'date': dateLongue(vente.date_vente, langue),
    'numero': String(vente.numero_facture_artiste || '').trim(),
  };
}

// Le PDF à joindre : le plus récent entre la facture officielle et ses
// « versions modifiées » (« Modifier ce document… » les enregistre à côté,
// sans toucher à l'officielle). Si on l'a retouchée après l'avoir produite,
// c'est la retouche qu'on veut envoyer ; si on a re-généré depuis, l'officielle.
function pdfFactureAJoindre(cheminOfficiel) {
  if (!cheminOfficiel || !fs.existsSync(cheminOfficiel)) return null;
  const dossier = path.dirname(cheminOfficiel);
  const base = path.basename(cheminOfficiel, '.pdf');
  const candidats = [{ chemin: cheminOfficiel, modifiee: false }];
  try {
    for (const f of fs.readdirSync(dossier)) {
      if (f.startsWith(`${base} (version modifiée`) && f.toLowerCase().endsWith('.pdf')) {
        candidats.push({ chemin: path.join(dossier, f), modifiee: true });
      }
    }
  } catch { /* dossier illisible : l'officielle suffit */ }
  for (const c of candidats) { try { c.mtime = fs.statSync(c.chemin).mtimeMs; } catch { c.mtime = 0; } }
  candidats.sort((x, y) => y.mtime - x.mtime);
  const choisi = candidats[0];
  return { chemin: choisi.chemin, nom: path.basename(choisi.chemin), modifiee: choisi.modifiee };
}

function preparerCourrielFactureArtiste(venteId) {
  const { obtenirVente, obtenirArtiste } = require('./db/requetes');
  const { obtenirConfig } = require('./config');
  const vente = obtenirVente(venteId);
  if (!vente) throw new Error('Vente introuvable.');
  const piece = pdfFactureAJoindre(vente.facture_artiste_path);
  if (!piece) throw new Error("La facture artiste n'a pas encore été produite (ou son fichier a été déplacé). Produisez-la d'abord.");
  const artiste = obtenirArtiste(vente.artiste_id) || {};
  const g = (obtenirConfig() || {}).galerie || {};
  const langue = /^angl/i.test(artiste.langue || '') ? 'EN' : 'FR';
  const numero = String(vente.numero_facture_artiste || '').trim();
  const galerie = String(g.nom || '').trim() || 'La galerie';

  const modele = modeleFactureArtiste(langue);
  const valeurs = valeursFactureArtiste(vente, artiste, langue);
  const sujet = appliquerJetons(modele.sujet, valeurs).trim();
  const corps = paragraphes(appliquerJetons(modele.texte, valeurs));
  // Outlook ajoute la signature habituelle de la galerie sous le texte. Le
  // .eml, lui, n'en a pas : on y signe avec les coordonnées des Réglages.
  const signature = [galerie, g.telephone, g.site_web].map((x) => String(x || '').trim()).filter(Boolean);
  const texte = `${corps.join('\n\n')}\n\n${signature.join('\n')}\n`;
  const html = `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${
    corps.map((p) => `<p>${echHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}</div>`;

  return {
    a: String(artiste.courriel || '').trim(),
    sujet,
    texte,
    html,
    piece,
    langue,
    artiste_nom: vente.artiste_nom || '',
    nomFichier: `Facture ${numero || vente.id} — ${vente.artiste_nom || 'artiste'}`.replace(/[\\/:*?"<>|]/g, '-'),
  };
}

// ===== L'aperçu du modèle, pour les Réglages =====
//
// L'écran des réglages n'écrit pas de texte : il envoie le modèle en cours de
// saisie et reçoit le courriel rendu. Une seule mécanique de remplacement,
// donc l'aperçu ne peut pas mentir sur ce qui partira.

// Faute de vente avec facture, un exemple : l'aperçu ne doit jamais être vide.
const EXEMPLE_APERCU = {
  prenom: 'Jean-Pierre', nom: 'Neveu', titre: 'Samankari',
  numero: 'FA-2026-012', date_vente: '2026-09-11', courriel: 'jp.neveu@exemple.ca',
  piece_nom: 'Facture artiste FA-2026-012 — Jean-Pierre Neveu.pdf',
};

function exempleFactureArtiste(langue) {
  const requetes = require('./db/requetes');
  let vente = null;
  try {
    const recente = (requetes.listerVentes() || []).find((v) => v.facture_artiste_path);
    if (recente) vente = requetes.obtenirVente(recente.id);
  } catch { vente = null; }
  if (vente) {
    const artiste = requetes.obtenirArtiste(vente.artiste_id) || {};
    const piece = pdfFactureAJoindre(vente.facture_artiste_path);
    return {
      a: String(artiste.courriel || '').trim(),
      piece_nom: piece ? piece.nom : path.basename(vente.facture_artiste_path || ''),
      valeurs: valeursFactureArtiste(vente, artiste, langue),
      sur_vente: true,
    };
  }
  const e = EXEMPLE_APERCU;
  return {
    a: e.courriel,
    piece_nom: e.piece_nom,
    valeurs: { prenom: e.prenom, titre: e.titre, date: dateLongue(e.date_vente, langue), numero: e.numero },
    sur_vente: false,
  };
}

// Rend le gabarit en HTML sûr, chaque valeur remplacée entourée d'un <mark>
// (et en rouge quand le mot entre accolades n'existe pas).
function surlignerJetons(gabarit, valeurs, inconnus) {
  return echHtml(gabarit).replace(JETON_RE, (tout, nom) => {
    const cle = normJeton(nom);
    if (CLES_JETONS.includes(cle)) return `<mark>${echHtml(valeurs[cle] == null ? '' : valeurs[cle])}</mark>`;
    inconnus.add(tout);
    return `<mark class="inconnu">${tout}</mark>`;
  });
}

function apercuModeleFactureArtiste({ langue, sujet, texte } = {}) {
  const l = langue === 'EN' ? 'EN' : 'FR';
  const defaut = MODELES_DEFAUT[l === 'EN' ? 'en' : 'fr'];
  const sujetVide = !String(sujet || '').trim();
  const texteVide = !String(texte || '').trim();
  const ex = exempleFactureArtiste(l);
  const inconnus = new Set();
  return {
    a: ex.a,
    piece_nom: ex.piece_nom,
    sur_vente: ex.sur_vente,
    vide: sujetVide || texteVide,
    sujet_html: surlignerJetons(sujetVide ? defaut.sujet : sujet, ex.valeurs, inconnus),
    paragraphes_html: paragraphes(texteVide ? defaut.texte : texte)
      .map((p) => surlignerJetons(p, ex.valeurs, inconnus).replace(/\n/g, '<br>')),
    inconnus: [...inconnus],
  };
}

module.exports = {
  construireEml, ouvrirDansOutlook, ouvrirBrouillon, SCRIPT_OUTLOOK,
  pdfFactureAJoindre, preparerCourrielFactureArtiste,
  MODELES_DEFAUT, JETONS, appliquerJetons, modeleFactureArtiste, apercuModeleFactureArtiste,
};
