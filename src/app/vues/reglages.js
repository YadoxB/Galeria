import { retour, poserGardien, leverGardien } from '../router.js';
import { ech, champTexte, champTextarea, champCheckbox } from '../commun.js';
import { confirmer, alerter } from '../dialogue.js';
import { chargerConfig, invaliderCacheConfig, rafraichirEntete } from '../marque.js';
import { fluxImport } from '../flux-import.js';

const NIVEAUX_ZOOM = [
  { val: 0.8,  libelle: 'Très petit' },
  { val: 0.9,  libelle: 'Petit' },
  { val: 1.0,  libelle: 'Normal (défaut)' },
  { val: 1.1,  libelle: 'Grand' },
  { val: 1.25, libelle: 'Très grand' },
  { val: 1.5,  libelle: 'Maximum' },
];

function libelleZoomCourant(z) {
  const exact = NIVEAUX_ZOOM.find((n) => Math.abs(n.val - z) < 0.001);
  return exact ? exact.libelle : `Personnalisé (${Math.round(z * 100)} %)`;
}

export async function rendreReglages(contenu) {
  const config = JSON.parse(JSON.stringify(await chargerConfig()));
  const infosApp = await window.api.appInfos();
  let modifie = false;
  const zoomInitial = Number(config?.affichage?.zoom) || 1.0;

  async function gardien() {
    if (!modifie) {
      window.api.appZoom(zoomInitial);
      return true;
    }
    const r = await confirmer({
      type: 'warning',
      title: 'Modifications non sauvegardées',
      message: 'Voulez-vous abandonner les modifications en cours ?',
      buttons: ['Abandonner', 'Rester sur la page'],
      defaultId: 1, cancelId: 1,
    });
    if (r === 0) {
      window.api.appZoom(zoomInitial);
      return true;
    }
    return false;
  }
  poserGardien(gardien);

  const blocPliable = (titre, corps, ouvert = true) =>
    `<details class="bloc pliable" ${ouvert ? 'open' : ''}>
       <summary><h3>${ech(titre)}</h3><span class="chevron-bloc">&rsaquo;</span></summary>
       <div class="bloc-corps">${corps}</div>
     </details>`;

  const d = config.documents;
  const s = config.sauvegardes;

  contenu.innerHTML = `
    <div class="vue-fiche">
      <h2 class="titre-formulaire">Réglages</h2>
      <p class="aide-champ" style="margin-bottom: 1.5rem;">
        Les informations sur la galerie elle-même (nom, adresse, numéros de taxes) sont
        dans le <strong>Profil de la galerie</strong>, accessible en cliquant sur le profil
        en bas de la barre latérale.
      </p>
      <form id="formulaire" class="formulaire" novalidate>
        ${blocPliable('Les documents', `
          <div class="bloc-secondaire">
            <h4 class="sous-titre">Factures client</h4>
            <div class="grille-form">
              ${champTexte({ nom: 'd_prefixe_facture', libelle: 'Préfixe de facture client', valeur: d.prefixe_facture, attributs: 'placeholder="F-2026"' })}
              ${champTexte({ nom: 'd_prochain_numero_facture', libelle: 'Prochain numéro', valeur: d.prochain_numero_facture, type: 'number', attributs: 'min="1" step="1"' })}
            </div>
            <p class="aide-champ">Émise par la galerie pour l'acheteur lors d'une vente.</p>
          </div>
          <div class="bloc-secondaire">
            <h4 class="sous-titre">Factures artiste</h4>
            <div class="grille-form">
              ${champTexte({ nom: 'd_prefixe_facture_artiste', libelle: 'Préfixe de facture artiste', valeur: d.prefixe_facture_artiste, attributs: 'placeholder="A-2026"' })}
              ${champTexte({ nom: 'd_prochain_numero_facture_artiste', libelle: 'Prochain numéro', valeur: d.prochain_numero_facture_artiste, type: 'number', attributs: 'min="1" step="1"' })}
            </div>
            <p class="aide-champ">Document que l'artiste devrait émettre vers la galerie pour sa part de la vente. La galerie le génère à sa place. Numérotation distincte des factures client.</p>
          </div>
          <div class="bloc-secondaire">
            <h4 class="sous-titre">Certificats d'authenticité</h4>
            <div class="grille-form">
              ${champTexte({ nom: 'd_prefixe_certificat', libelle: 'Préfixe de certificat', valeur: d.prefixe_certificat, attributs: 'placeholder="C-2026"' })}
              ${champTexte({ nom: 'd_prochain_numero_certificat', libelle: 'Prochain numéro de certificat', valeur: d.prochain_numero_certificat, type: 'number', attributs: 'min="1" step="1"' })}
            </div>
            ${champTexte({ nom: 'd_signataire', libelle: 'Texte du signataire sur le certificat', valeur: d.signataire_certificat })}
            <p class="aide-champ">Format actuel des numéros : <strong>${ech(d.prefixe_certificat || 'C-2026')}-001</strong>, <strong>${ech(d.prefixe_certificat || 'C-2026')}-002</strong>, etc. La nomenclature finale sera ajustée plus tard ; il suffira de modifier le préfixe et de remettre le compteur à la bonne valeur.</p>
          </div>
          <div class="bloc-secondaire">
            <h4 class="sous-titre">TPS</h4>
            <div class="grille-form">
              ${champCheckbox({ nom: 'd_tps_actif', libelle: 'Appliquer la TPS sur les factures', valeur: !!d.tps_actif })}
              ${champTexte({ nom: 'd_tps_taux', libelle: 'Taux TPS (%)', valeur: d.tps_taux, type: 'number', attributs: 'min="0" max="100" step="0.001"' })}
            </div>
          </div>
          <div class="bloc-secondaire">
            <h4 class="sous-titre">TVQ</h4>
            <div class="grille-form">
              ${champCheckbox({ nom: 'd_tvq_actif', libelle: 'Appliquer la TVQ sur les factures', valeur: !!d.tvq_actif })}
              ${champTexte({ nom: 'd_tvq_taux', libelle: 'Taux TVQ (%)', valeur: d.tvq_taux, type: 'number', attributs: 'min="0" max="100" step="0.001"' })}
            </div>
          </div>
          <div class="bloc-secondaire">
            <h4 class="sous-titre">Facture artiste</h4>
            <div class="grille-form">
              ${champTexte({ nom: 'd_cote', libelle: 'Cote de la galerie par défaut (%)', valeur: d.cote_galerie_pourcent, type: 'number', attributs: 'min="0" max="100" step="0.1"' })}
            </div>
            <p class="aide-champ">La cote sert de valeur par défaut à la création d'une facture artiste. Modifiable par vente.</p>
          </div>
        `)}

        ${blocPliable('Les sauvegardes', `
          <div class="grille-form">
            ${champTexte({ nom: 's_frequence', libelle: 'Fréquence (minutes entre chaque sauvegarde auto)', valeur: s.frequence_minutes, type: 'number', attributs: 'min="5" step="5"' })}
            ${champTexte({ nom: 's_retention', libelle: 'Nombre de copies conservées', valeur: s.retention, type: 'number', attributs: 'min="5" step="1"' })}
          </div>
          <div class="form-champ">
            <label for="f-s_dossier">Dossier de destination</label>
            <div class="ligne-dossier">
              <input type="text" id="f-s_dossier" name="s_dossier" value="${ech(s.dossier)}" placeholder="Par défaut : Documents\\GalerieApp\\Sauvegardes" readonly>
              <button type="button" class="btn-action btn-secondaire-action" id="btn-choisir-dossier">Choisir un dossier…</button>
              <button type="button" class="btn-action btn-secondaire-action" id="btn-defaut-dossier">Défaut</button>
            </div>
          </div>
          <p class="aide-champ">Les anciennes sauvegardes sont supprimées automatiquement quand le nombre dépasse la limite. Fréquence minimale : 5 minutes.</p>
          <div class="form-champ">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-sauvegarder-maintenant">Sauvegarder maintenant</button>
          </div>
        `)}

        ${blocPliable("Import de données", `
          <p class="aide-champ">Importe un fichier CSV exporté d'Airtable (table Artistes ou Œuvres). Tu pourras choisir entre <em>mettre à jour</em> les fiches existantes ou <em>n'ajouter que les nouvelles</em>.</p>
          <button type="button" class="btn-action btn-secondaire-action" id="btn-importer">Importer un fichier CSV…</button>
        `, false)}

        ${blocPliable("Intelligence artificielle (ChatGPT)", `
          ${champTextarea({ nom: 'ia_instructions_galerie', libelle: 'Consignes générales de la galerie (toujours incluses)', valeur: config.ia?.instructions_galerie || '', lignes: 6 })}
          <p class="aide-champ">Ces consignes s'ajoutent à toutes les générations de description, peu importe l'artiste. Sert à fixer le ton maison (ex. accessible, jamais grandiloquent), la longueur cible générale, et toute autre règle commune.</p>
          ${champTexte({ nom: 'ia_lien_chatgpt_defaut', libelle: 'Lien ChatGPT par défaut', valeur: config.ia?.lien_chatgpt_defaut || 'https://chat.openai.com/', attributs: 'placeholder="https://chat.openai.com/"' })}
          <p class="aide-champ">Utilisé quand l'artiste n'a pas de lien spécifique vers son propre GPT.</p>
        `, false)}

        ${blocPliable("Affichage", `
          <div class="form-champ">
            <label for="f-a_zoom">Taille d'affichage</label>
            <select id="f-a_zoom" name="a_zoom">
              ${NIVEAUX_ZOOM.map((n) => `<option value="${n.val}" ${Math.abs(n.val - zoomInitial) < 0.001 ? 'selected' : ''}>${ech(n.libelle)} — ${Math.round(n.val * 100)} %</option>`).join('')}
            </select>
            <p class="aide-champ">Ajuste la taille de tous les éléments de l'application. L'aperçu est appliqué immédiatement quand tu changes la valeur ; il sera enregistré quand tu cliques sur <strong>Enregistrer</strong>. Annule pour revenir à la valeur d'origine.</p>
          </div>
        `, false)}

        ${blocPliable("À propos", `
          <dl class="champs">
            <div class="champ"><dt>Application</dt><dd>${ech(infosApp.nom)}</dd></div>
            <div class="champ"><dt>Version</dt><dd>${ech(infosApp.version)}</dd></div>
            <div class="champ"><dt>Marque affichée</dt><dd>${ech(config.galerie?.nom || '—')}</dd></div>
            <div class="champ"><dt>Dossier des données</dt><dd><code>${ech(infosApp.dataDir)}</code></dd></div>
            <div class="champ"><dt>Moteur</dt><dd>Electron ${ech(infosApp.electron)} sur ${ech(infosApp.plateforme)}</dd></div>
          </dl>
          <p class="aide-champ" style="margin-top:1rem;">© 2026 Galerie du Vieux Saint-Jean. Logiciel maison, données conservées localement (Loi 25).</p>
        `, false)}

        <div class="form-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler">Annuler</button>
          <button type="submit" class="btn-action btn-principal">Enregistrer</button>
        </div>
      </form>
    </div>
  `;

  const form = contenu.querySelector('#formulaire');
  form.addEventListener('input', () => { modifie = true; });
  form.addEventListener('change', () => { modifie = true; });

  const selZoom = contenu.querySelector('#f-a_zoom');
  if (selZoom) {
    selZoom.addEventListener('change', () => {
      const v = Number(selZoom.value);
      if (Number.isFinite(v) && v > 0) {
        window.api.appZoom(v);
      }
    });
  }

  contenu.querySelector('#btn-choisir-dossier').addEventListener('click', async () => {
    const r = await window.api.configChoisirDossier();
    if (r && !r.cancelled && r.path) {
      contenu.querySelector('#f-s_dossier').value = r.path;
      modifie = true;
    }
  });

  contenu.querySelector('#btn-defaut-dossier').addEventListener('click', () => {
    contenu.querySelector('#f-s_dossier').value = '';
    modifie = true;
  });

  contenu.querySelector('#btn-importer').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await fluxImport();
    } finally {
      btn.disabled = false;
    }
  });

  contenu.querySelector('#btn-sauvegarder-maintenant').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const r = await window.api.backupNow();
      await alerter({
        type: 'succes',
        title: 'Sauvegarde créée',
        message: 'La sauvegarde a été créée avec succès.',
        detail: `Fichier : ${r.nom}\nDossier : ${r.dossier}`,
      });
    } catch (err) {
      await alerter({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: 'La sauvegarde a échoué.',
        detail: err.message,
      });
    } finally {
      btn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const v = (k) => fd.get(k) ?? '';
    const num = (k) => {
      const x = Number(v(k));
      return Number.isFinite(x) ? x : null;
    };

    const partiel = {
      documents: {
        prefixe_facture: v('d_prefixe_facture').trim() || 'F',
        prochain_numero_facture: Math.max(1, Math.floor(num('d_prochain_numero_facture') || 1)),
        prefixe_facture_artiste: v('d_prefixe_facture_artiste').trim() || 'A',
        prochain_numero_facture_artiste: Math.max(1, Math.floor(num('d_prochain_numero_facture_artiste') || 1)),
        prefixe_certificat: v('d_prefixe_certificat').trim() || 'C',
        prochain_numero_certificat: Math.max(1, Math.floor(num('d_prochain_numero_certificat') || 1)),
        tps_actif: form.elements.d_tps_actif.checked,
        tps_taux: Math.max(0, Math.min(100, num('d_tps_taux') ?? 0)),
        tvq_actif: form.elements.d_tvq_actif.checked,
        tvq_taux: Math.max(0, Math.min(100, num('d_tvq_taux') ?? 0)),
        cote_galerie_pourcent: Math.max(0, Math.min(100, num('d_cote') ?? 0)),
        signataire_certificat: v('d_signataire').trim(),
      },
      sauvegardes: {
        frequence_minutes: Math.max(5, Math.floor(num('s_frequence') || 60)),
        retention: Math.max(5, Math.floor(num('s_retention') || 50)),
        dossier: v('s_dossier').trim(),
      },
      affichage: {
        zoom: (() => {
          const z = num('a_zoom');
          return Number.isFinite(z) && z > 0 ? z : 1.0;
        })(),
      },
      ia: {
        instructions_galerie: v('ia_instructions_galerie').trim(),
        lien_chatgpt_defaut: v('ia_lien_chatgpt_defaut').trim() || 'https://chat.openai.com/',
      },
    };

    try {
      await window.api.configSauver(partiel);
      invaliderCacheConfig();
      await rafraichirEntete();
      await window.api.backupRedemarrer();
      modifie = false;
      leverGardien();
      await alerter({
        type: 'succes',
        title: 'Réglages enregistrés',
        message: 'Les nouveaux réglages sont en vigueur.',
        detail: 'Les sauvegardes automatiques utiliseront la nouvelle fréquence et le nouveau dossier dès maintenant.',
      });
      retour();
    } catch (err) {
      await alerter({
        type: 'error',
        title: 'Enregistrement échoué',
        message: err.message,
      });
    }
  });

  contenu.querySelector('#btn-annuler').addEventListener('click', async () => {
    if (modifie) {
      const r = await confirmer({
        type: 'warning',
        title: 'Abandonner les modifications ?',
        message: 'Les modifications en cours seront perdues.',
        buttons: ['Abandonner', 'Continuer à modifier'],
        defaultId: 1, cancelId: 1,
      });
      if (r !== 0) return;
    }
    window.api.appZoom(zoomInitial);
    leverGardien();
    retour();
  });
}
