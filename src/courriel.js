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

const echHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function dateLongue(iso, langue) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(langue === 'EN' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
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
  const prenom = String(artiste.prenom || '').trim() || String(artiste.nom || '').trim();
  const titre = String(vente.oeuvre_titre || '').trim();
  const numero = String(vente.numero_facture_artiste || '').trim();
  const date = dateLongue(vente.date_vente, langue);
  const galerie = String(g.nom || '').trim() || 'La galerie';

  const mot = langue === 'EN' ? 'Invoice' : 'Facture';
  const oeuvre = langue === 'EN' ? `“${titre}”` : `« ${titre} »`;
  const sujet = [numero ? `${mot} ${numero}` : mot, titre ? oeuvre : ''].filter(Boolean).join(' — ');
  const paragraphes = langue === 'EN'
    ? [
      `Hello ${prenom},`,
      `Good news: your artwork “${titre}” was sold${date ? ` on ${date}` : ''}.`,
      `Please find attached the invoice${numero ? ` ${numero}` : ""}, which details the sale price, the gallery's commission and the amount due to you.`,
      'Thank you for your trust,',
    ]
    : [
      `Bonjour ${prenom},`,
      `Bonne nouvelle : votre œuvre « ${titre} » a été vendue${date ? ` le ${date}` : ''}.`,
      `Vous trouverez ci-joint la facture${numero ? ` ${numero}` : ""}, qui détaille le prix de vente, la commission de la galerie et le montant qui vous revient.`,
      'Merci de votre confiance,',
    ];
  // Outlook ajoute la signature habituelle de la galerie sous le texte. Le
  // .eml, lui, n'en a pas : on y signe avec les coordonnées des Réglages.
  const signature = [galerie, g.telephone, g.site_web].map((x) => String(x || '').trim()).filter(Boolean);
  const texte = `${paragraphes.join('\n\n')}\n\n${signature.join('\n')}\n`;
  const html = `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${
    paragraphes.map((p) => `<p>${echHtml(p)}</p>`).join('')}</div>`;

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

module.exports = {
  construireEml, ouvrirDansOutlook, ouvrirBrouillon, SCRIPT_OUTLOOK,
  pdfFactureAJoindre, preparerCourrielFactureArtiste,
};
