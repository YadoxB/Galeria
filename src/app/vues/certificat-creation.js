import { ech, champTexte, champTextarea, champNombreInvalide, soumissionUnique, nettoyerErreur } from '../commun.js';
import { alerter, confirmer } from '../dialogue.js';
import { chargerConfig } from '../marque.js';

function dateAujourdhui() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Ouvre un overlay de création de certificat.
 *
 * Numéro de certificat (format unifié) :
 *   {n° inventaire de l'œuvre}-{année}-{séquentiel par artiste}-{n° facture Sage}
 * Le n° de facture Sage est REQUIS : impossible de produire sans. Il est
 * pré-rempli depuis la vente liée si elle en a un.
 *
 * @param {{oeuvre: object, vente?: object}} ctx
 * @returns {Promise<object|null>} le certificat créé ou null si annulé
 */
export async function ouvrirCreationCertificat({ oeuvre, vente = null }) {
  // Les appels asynchrones se font AVANT de créer la promesse d'interaction :
  // ainsi un échec de préparation affiche une erreur et renvoie null, au lieu
  // de laisser une promesse jamais résolue (fenêtre qui ne s'ouvre jamais).
  let config, apercu;
  try {
    config = await chargerConfig();
    apercu = (await window.api.certificatApercu(oeuvre.id)) || {};
  } catch (err) {
    await alerter({
      type: 'error', title: 'Certificat',
      message: 'Impossible de préparer le certificat.',
      detail: nettoyerErreur(err),
    });
    return null;
  }
  const signataireDefaut = config.documents.signataire_certificat || '';
  const valeurDefaut = (vente?.prix_vente ?? oeuvre.prix ?? '').toString();
  const sageDefaut = (vente?.numero_facture_sage ?? '').toString();
  // Composantes du numéro : n° d'inventaire de l'œuvre + prochain séquentiel
  // de l'artiste (calculés côté base).
  const numeroInventaire = (apercu.numero_inventaire || oeuvre.numero_inventaire || '').toString();
  const prochainSeq = apercu.prochain_seq || 1;
  const seqAffiche = String(prochainSeq).padStart(3, '0');
  const dernierAffiche = String(apercu.dernier_seq || 0).padStart(3, '0');
  // D'où vient le séquentiel — dit en clair sous le numéro. Le premier
  // certificat d'un artiste est LE moment où une numérotation papier oubliée
  // créerait un doublon : c'est là qu'on le rappelle.
  const origineSeq = {
    galeria: `Le ${seqAffiche} suit le n° ${dernierAffiche}, dernier certificat de l'artiste produit dans Galeria.`,
    fiche: `Le ${seqAffiche} suit le n° ${dernierAffiche}, dernier certificat délivré inscrit sur la fiche de l'artiste.`,
    premier: "C'est le premier certificat de l'artiste. S'il en a déjà sur papier, annulez et inscrivez le numéro du dernier sur sa fiche (« Dernier certificat délivré »).",
  }[apercu.seq_source] || `Le séquentiel ${seqAffiche} est propre à l'artiste.`;

  return new Promise((resolve) => {
    function composerNumero() {
      // Numéro de délivrance : {n° inventaire}-{séquentiel artiste}-{n° Sage}
      // (sans année). L'année reste dans l'horodatage du nom de fichier.
      const sage = (overlay.querySelector('#f-numero_sage')?.value || '').trim();
      const base = [numeroInventaire, seqAffiche].filter(Boolean).join('-');
      return { base, complet: sage ? `${base}-${sage}` : base, sage };
    }

    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-dialogue';
    overlay.innerHTML = `
      <div class="dialogue" role="dialog" aria-modal="true" style="max-width: 560px;">
        <div class="dialogue-entete">
          <h3 class="dialogue-titre">Produire un certificat d'authenticité</h3>
        </div>
        <p class="dialogue-message">
          Pour <strong>${ech(oeuvre.titre || '—')}</strong>
          ${oeuvre.artiste_nom ? ` — ${ech(oeuvre.artiste_nom)}` : ''}
        </p>
        <form id="form-certif" class="formulaire" novalidate>
          <div class="grille-form">
            ${champTexte({ nom: 'date_delivrance', libelle: 'Date de délivrance', valeur: dateAujourdhui(), type: 'date', requis: true })}
            ${champTexte({ nom: 'numero_sage', libelle: 'N° de facture (Sage) — requis', valeur: sageDefaut, requis: true, attributs: 'placeholder="ex. 5567"' })}
          </div>
          <div class="grille-form">
            ${champTexte({ nom: 'valeur', libelle: 'Valeur (CAD)', valeur: valeurDefaut, type: 'number', attributs: 'min="0" step="0.01"' })}
            <div class="form-champ">
              <label for="f-langue">Langue du certificat</label>
              <select id="f-langue" name="langue">
                <option value="FR" selected>Français</option>
                <option value="EN">Anglais</option>
              </select>
            </div>
            ${champTexte({ nom: 'signataire', libelle: 'Signataire', valeur: signataireDefaut })}
          </div>
          ${champTextarea({ nom: 'particularite', libelle: 'Particularité (optionnel)', valeur: '', lignes: 2 })}
          <div class="form-champ">
            <label>Numéro de certificat (composé automatiquement)</label>
            <input id="apercu-numero-certif" type="text" readonly value="">
          </div>
          <p class="aide-champ" id="aide-certif"></p>
          <div class="dialogue-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler-certif">Annuler</button>
            <button type="submit" class="btn-action btn-principal" id="btn-produire-certif">Produire le certificat</button>
          </div>
        </form>
      </div>
    `;

    function fermer(resultat) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(resultat);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); fermer(null); }
    }

    // Met à jour l'aperçu du numéro et l'état du bouton (bloqué tant que le n° Sage est vide).
    function rafraichir() {
      const { base, complet, sage } = composerNumero();
      const champApercu = overlay.querySelector('#apercu-numero-certif');
      const btn = overlay.querySelector('#btn-produire-certif');
      const aide = overlay.querySelector('#aide-certif');
      champApercu.value = sage ? complet : `${base}-…`;
      if (sage) {
        btn.disabled = false;
        aide.textContent = `Numéro : ${complet}. ${origineSeq}`;
        aide.style.color = apercu.seq_source === 'premier' ? '#900001' : '';
      } else {
        btn.disabled = true;
        aide.textContent = 'Le n° de facture (Sage) est requis pour produire le certificat.';
        aide.style.color = '#900001';
      }
    }

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) fermer(null);
    });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

    overlay.querySelector('#f-numero_sage').addEventListener('input', rafraichir);
    overlay.querySelector('#f-date_delivrance').addEventListener('input', rafraichir);
    overlay.querySelector('#btn-annuler-certif').addEventListener('click', () => fermer(null));

    overlay.querySelector('#form-certif').addEventListener('submit', soumissionUnique(async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const val = (k) => (fd.get(k) ?? '').toString().trim();
      const numVal = (k) => {
        const x = Number(val(k));
        return Number.isFinite(x) ? x : null;
      };

      const champInvalide = champNombreInvalide(form);
      if (champInvalide) {
        await alerter({
          type: 'warning', title: 'Nombre non valide',
          message: 'La valeur saisie n\'est pas un nombre valide.',
          detail: 'Écris le montant sans espaces (par exemple 1500 ou 1500,00).',
        });
        champInvalide.focus();
        return;
      }

      const numeroSage = val('numero_sage');
      if (!numeroSage) {
        await alerter({ type: 'warning', title: 'N° de facture requis', message: 'Le numéro de facture (Sage) est requis pour produire un certificat.' });
        return;
      }

      if (!await typeConfirme()) return;

      const data = {
        oeuvre_id: oeuvre.id,
        vente_id: vente?.id ?? null,
        date_delivrance: val('date_delivrance') || dateAujourdhui(),
        valeur: numVal('valeur'),
        signataire: val('signataire'),
        particularite: val('particularite'),
        numero_sage: numeroSage,
        langue: val('langue') || 'FR',
        pdf_path: null,
      };

      try {
        const cree = await window.api.certificatCreer(data);
        fermer(cree);
      } catch (err) {
        await alerter({ type: 'error', title: 'Enregistrement échoué', message: nettoyerErreur(err) });
      }
    }));

    // Garde-fou : le type de l'œuvre choisit le texte d'attestation du
    // certificat. Un type inédit (« Céramique », « Installation ») retombe
    // silencieusement sur celui de l'artiste peintre — on le dit avant de
    // produire plutôt que de laisser passer un document officiel inexact.
    // La reconnaissance vient de pdf.js, source unique (voir analyserTypeOeuvre).
    async function typeConfirme() {
      let a;
      try { a = await window.api.certificatAnalyserType(oeuvre?.type); }
      catch { return true; }               // en cas d'échec, on ne bloque pas
      if (!a || a.reconnu) return true;
      const LIB = { peintre: "d'un artiste peintre", sculpteur: "d'un artiste sculpteur",
                    reproduction: "d'une reproduction" };
      const attestation = a.type_autre ? `d'un ${a.type_autre}` : (LIB[a.type] || "d'un artiste peintre");
      const rep = await confirmer({
        type: 'warning',
        title: "Type d'œuvre non reconnu",
        message: a.vide
          ? "Cette œuvre n'a pas de type."
          : `Le type « ${oeuvre.type} » n'est pas un type que Galeria sait attester.`,
        detail: [
          `Le certificat portera le texte d'attestation ${attestation}.`,
          'Types reconnus : peinture, sculpture, reproduction, photographie, dessin, estampe, gravure, mixte.',
          "Tu peux continuer, ou annuler pour corriger le type sur la fiche de l'œuvre.",
        ].join('\n\n'),
        buttons: ['Continuer quand même', 'Annuler'],
        defaultId: 1,
        cancelId: 1,
      });
      return rep === 0;
    }

    rafraichir();
    overlay.querySelector('#f-numero_sage')?.focus();
  });
}
