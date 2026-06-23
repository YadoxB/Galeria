import { ech, champTexte, champTextarea } from '../commun.js';
import { alerter } from '../dialogue.js';
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
export function ouvrirCreationCertificat({ oeuvre, vente = null }) {
  return new Promise(async (resolve) => {
    const config = await chargerConfig();
    const signataireDefaut = config.documents.signataire_certificat || '';
    const valeurDefaut = (vente?.prix_vente ?? oeuvre.prix ?? '').toString();
    const sageDefaut = (vente?.numero_facture_sage ?? '').toString();

    // Composantes du numéro : n° d'inventaire de l'œuvre + prochain séquentiel
    // de l'artiste (calculés côté base).
    const apercu = (await window.api.certificatApercu(oeuvre.id)) || {};
    const numeroInventaire = (apercu.numero_inventaire || oeuvre.numero_inventaire || '').toString();
    const prochainSeq = apercu.prochain_seq || 1;
    const seqAffiche = String(prochainSeq).padStart(3, '0');

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
        aide.textContent = `Numéro : ${complet}. Le séquentiel ${seqAffiche} est propre à l'artiste.`;
        aide.style.color = '';
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

    overlay.querySelector('#form-certif').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const val = (k) => (fd.get(k) ?? '').toString().trim();
      const numVal = (k) => {
        const x = Number(val(k));
        return Number.isFinite(x) ? x : null;
      };

      const numeroSage = val('numero_sage');
      if (!numeroSage) {
        await alerter({ type: 'warning', title: 'N° de facture requis', message: 'Le numéro de facture (Sage) est requis pour produire un certificat.' });
        return;
      }

      const data = {
        oeuvre_id: oeuvre.id,
        vente_id: vente?.id ?? null,
        date_delivrance: val('date_delivrance') || dateAujourdhui(),
        valeur: numVal('valeur'),
        signataire: val('signataire'),
        particularite: val('particularite'),
        numero_sage: numeroSage,
        pdf_path: null,
      };

      try {
        const cree = await window.api.certificatCreer(data);
        fermer(cree);
      } catch (err) {
        await alerter({ type: 'error', title: 'Enregistrement échoué', message: err.message });
      }
    });

    rafraichir();
    overlay.querySelector('#f-numero_sage')?.focus();
  });
}
