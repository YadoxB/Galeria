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
 * @param {{oeuvre: object, vente?: object}} ctx
 *   oeuvre : objet œuvre (au minimum id, titre, prix, prix de vente si fourni)
 *   vente  : objet vente associé (optionnel — pour pré-remplir la valeur)
 * @returns {Promise<object|null>} le certificat créé ou null si annulé
 */
export function ouvrirCreationCertificat({ oeuvre, vente = null }) {
  return new Promise(async (resolve) => {
    const config = await chargerConfig();
    const signataireDefaut = config.documents.signataire_certificat || '';
    const numeroAuto = await window.api.certificatApercuNumero();
    // Valeur par défaut : prix de vente si vente fournie, sinon prix de l'œuvre
    const valeurDefaut = (vente?.prix_vente ?? oeuvre.prix ?? '').toString();

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
            ${champTexte({ nom: 'numero_delivrance', libelle: 'Numéro de délivrance', valeur: numeroAuto, requis: true })}
            ${champTexte({ nom: 'date_delivrance', libelle: 'Date de délivrance', valeur: dateAujourdhui(), type: 'date', requis: true })}
          </div>
          <div class="grille-form">
            ${champTexte({ nom: 'valeur', libelle: 'Valeur (CAD)', valeur: valeurDefaut, type: 'number', attributs: 'min="0" step="0.01"' })}
            ${champTexte({ nom: 'signataire', libelle: 'Signataire', valeur: signataireDefaut })}
          </div>
          ${champTextarea({ nom: 'particularite', libelle: 'Particularité (optionnel)', valeur: '', lignes: 2 })}
          <p class="aide-champ">Le numéro est généré automatiquement depuis les réglages. Modifiable si besoin. La génération du PDF arrivera à la prochaine étape (Phase 3C) ; pour l'instant le certificat est seulement enregistré.</p>
          <div class="dialogue-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler-certif">Annuler</button>
            <button type="submit" class="btn-action btn-principal">Enregistrer le certificat</button>
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

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) fermer(null);
    });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);

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

      const numeroSaisi = val('numero_delivrance');
      const data = {
        oeuvre_id: oeuvre.id,
        vente_id: vente?.id ?? null,
        numero_delivrance: numeroSaisi,
        date_delivrance: val('date_delivrance') || dateAujourdhui(),
        valeur: numVal('valeur'),
        signataire: val('signataire'),
        particularite: val('particularite'),
        pdf_path: null,
      };

      if (!data.numero_delivrance) {
        await alerter({ type: 'warning', title: 'Numéro requis', message: 'Le numéro de délivrance est requis.' });
        return;
      }

      try {
        // Si le numéro saisi correspond à l'auto, réserver et utiliser la version officielle (et incrémenter le compteur)
        if (numeroSaisi === numeroAuto) {
          data.numero_delivrance = await window.api.certificatReserverNumero();
        }
        const cree = await window.api.certificatCreer(data);
        fermer(cree);
      } catch (err) {
        await alerter({ type: 'error', title: 'Enregistrement échoué', message: err.message });
      }
    });

    overlay.querySelector('#f-valeur')?.focus();
  });
}
