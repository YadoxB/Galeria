import { retour, poserGardien, leverGardien } from '../router.js';
import { ech, champTexte, champTextarea, champCheckbox } from '../commun.js';
import { confirmer, alerter } from '../dialogue.js';
import { chargerConfig, invaliderCacheConfig, rafraichirEntete } from '../marque.js';
import { fluxImport } from '../flux-import.js';
import { abonnerEtatUpdater, libelleEtat, verifierManuellement, ouvrirModale } from '../updater.js';
import { reappliquerVerrou } from '../verrou.js';

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

  const d = config.documents;
  const s = config.sauvegardes;

  contenu.innerHTML = `
    <div class="vue-fiche vue-fiche-bento">
      <div class="reglages-entete">
        <h1>Réglages</h1>
        <p class="reglages-entete-meta">
          Les informations sur la galerie elle-même (nom, adresse, numéros de taxes) sont
          dans le <strong>Profil de la galerie</strong>, accessible en cliquant sur le profil
          en bas de la barre latérale.
        </p>
      </div>

      <form id="formulaire" class="formulaire" novalidate>
        <div class="grille-bento">

          <!-- Numérotation (8 col) -->
          <div class="carte zone-numerotation">
            <h3>Numérotation des documents</h3>

            <div class="sous-section">
              <h4>Factures client</h4>
              <div class="grille-form">
                ${champTexte({ nom: 'd_prefixe_facture', libelle: 'Préfixe', valeur: d.prefixe_facture, attributs: 'placeholder="F-2026"' })}
                ${champTexte({ nom: 'd_prochain_numero_facture', libelle: 'Prochain numéro', valeur: d.prochain_numero_facture, type: 'number', attributs: 'min="1" step="1"' })}
              </div>
              <p class="aide-champ">Émise par la galerie pour l'acheteur lors d'une vente.</p>
            </div>

            <div class="sous-section">
              <h4>Factures artiste</h4>
              <div class="grille-form">
                ${champTexte({ nom: 'd_prefixe_facture_artiste', libelle: 'Préfixe', valeur: d.prefixe_facture_artiste, attributs: 'placeholder="A-2026"' })}
                ${champTexte({ nom: 'd_prochain_numero_facture_artiste', libelle: 'Prochain numéro', valeur: d.prochain_numero_facture_artiste, type: 'number', attributs: 'min="1" step="1"' })}
              </div>
              <p class="aide-champ">Document que l'artiste devrait émettre vers la galerie pour sa part de la vente. La galerie le génère à sa place.</p>
            </div>

            <div class="sous-section">
              <h4>Certificats d'authenticité</h4>
              <div class="grille-form">
                ${champTexte({ nom: 'd_prefixe_certificat', libelle: 'Préfixe', valeur: d.prefixe_certificat, attributs: 'placeholder="C-2026"' })}
                ${champTexte({ nom: 'd_prochain_numero_certificat', libelle: 'Prochain numéro', valeur: d.prochain_numero_certificat, type: 'number', attributs: 'min="1" step="1"' })}
              </div>
              ${champTexte({ nom: 'd_signataire', libelle: 'Texte du signataire sur le certificat', valeur: d.signataire_certificat })}
              <p class="aide-champ">Format actuel : <strong>${ech(d.prefixe_certificat || 'C-2026')}-001</strong>, <strong>${ech(d.prefixe_certificat || 'C-2026')}-002</strong>, etc.</p>
            </div>

            <div class="sous-section">
              <h4>Numérotation d'inventaire</h4>
              <div class="grille-form">
                ${champTexte({ nom: 'd_prochain_numero_inventaire', libelle: "Prochain numéro", valeur: d.prochain_numero_inventaire, type: 'number', attributs: 'min="1" step="1"' })}
              </div>
              <p class="aide-champ">Compteur global. Combiné avec le préfixe d'inventaire de l'artiste (ex. <strong>JOU1992</strong>).</p>
            </div>
          </div>

          <!-- Taxes & commission (4 col) -->
          <div class="carte zone-taxes-cote">
            <h3>Taxes &amp; commission</h3>

            <div class="sous-section">
              <h4>TPS</h4>
              <div class="grille-form">
                ${champCheckbox({ nom: 'd_tps_actif', libelle: 'Appliquer', valeur: !!d.tps_actif })}
                ${champTexte({ nom: 'd_tps_taux', libelle: 'Taux (%)', valeur: d.tps_taux, type: 'number', attributs: 'min="0" max="100" step="0.001"' })}
              </div>
            </div>

            <div class="sous-section">
              <h4>TVQ</h4>
              <div class="grille-form">
                ${champCheckbox({ nom: 'd_tvq_actif', libelle: 'Appliquer', valeur: !!d.tvq_actif })}
                ${champTexte({ nom: 'd_tvq_taux', libelle: 'Taux (%)', valeur: d.tvq_taux, type: 'number', attributs: 'min="0" max="100" step="0.001"' })}
              </div>
            </div>

            <div class="sous-section">
              <h4>Cote galerie</h4>
              <div class="grille-form">
                ${champTexte({ nom: 'd_cote', libelle: 'Pourcentage par défaut (%)', valeur: d.cote_galerie_pourcent, type: 'number', attributs: 'min="0" max="100" step="0.1"' })}
              </div>
              <p class="aide-champ">Valeur préremplie à la création d'une facture artiste. Modifiable par vente.</p>
            </div>
          </div>

          <!-- Sauvegardes (6 col) -->
          <div class="carte zone-sauvegardes">
            <h3>Sauvegardes</h3>
            <div class="grille-form">
              ${champTexte({ nom: 's_frequence', libelle: 'Fréquence (minutes)', valeur: s.frequence_minutes, type: 'number', attributs: 'min="5" step="5"' })}
              ${champTexte({ nom: 's_retention', libelle: 'Nombre de copies conservées', valeur: s.retention, type: 'number', attributs: 'min="5" step="1"' })}
            </div>
            <div class="form-champ" style="margin-top: var(--s3);">
              <label for="f-s_dossier">Dossier de destination</label>
              <div class="ligne-dossier">
                <input type="text" id="f-s_dossier" name="s_dossier" value="${ech(s.dossier)}" placeholder="Par défaut : Documents\\Galeria\\Sauvegardes" readonly>
                <button type="button" class="btn-action btn-secondaire-action" id="btn-choisir-dossier">Choisir…</button>
                <button type="button" class="btn-action btn-secondaire-action" id="btn-defaut-dossier">Défaut</button>
              </div>
            </div>
            <p class="aide-champ">Anciennes sauvegardes supprimées automatiquement. Minimum 5 minutes.</p>
            <button type="button" class="btn-action btn-secondaire-action btn-gros-bento" id="btn-sauvegarder-maintenant">Sauvegarder maintenant</button>
            <button type="button" class="btn-action btn-secondaire-action btn-gros-bento" id="btn-restaurer">Restaurer une sauvegarde…</button>
            <p class="aide-champ">Remplace les données actuelles par une sauvegarde (une copie de sécurité de la base actuelle est faite d'abord). L'application redémarre ensuite.</p>
          </div>

          <!-- Affichage (3 col) -->
          <div class="carte zone-affichage">
            <h3>Affichage</h3>
            <div class="form-champ">
              <label for="f-a_zoom">Taille d'affichage</label>
              <select id="f-a_zoom" name="a_zoom">
                ${NIVEAUX_ZOOM.map((n) => `<option value="${n.val}" ${Math.abs(n.val - zoomInitial) < 0.001 ? 'selected' : ''}>${ech(n.libelle)} — ${Math.round(n.val * 100)} %</option>`).join('')}
              </select>
              <p class="aide-champ">Aperçu appliqué immédiatement. Annule pour revenir à l'original.</p>
            </div>
          </div>

          <!-- Import (3 col) -->
          <div class="carte zone-import">
            <h3>Import de données</h3>
            <p class="aide-champ" style="margin-top:0;">
              Importe un fichier CSV exporté d'Airtable (Artistes ou Œuvres). Tu choisiras entre <em>mettre à jour</em> ou <em>n'ajouter que les nouvelles</em>.
            </p>
            <button type="button" class="btn-action btn-secondaire-action btn-gros-bento" id="btn-importer">Importer un fichier CSV…</button>
          </div>

          <!-- IA (6 col) -->
          <div class="carte zone-ia">
            <h3>Intelligence artificielle</h3>
            <div class="ia-cle-bloc">
              <div class="form-champ">
                <label for="ia-cle">Clé API Anthropic (génération directe des descriptions)</label>
                <input type="password" id="ia-cle" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
              </div>
              <div class="ia-cle-actions">
                <button type="button" class="btn-action btn-principal" id="btn-ia-cle-save">Enregistrer la clé</button>
                <button type="button" class="btn-action btn-secondaire-action" id="btn-ia-cle-suppr">Retirer</button>
              </div>
              <p class="ia-cle-statut" id="ia-cle-statut"></p>
              <p class="aide-champ">Active le bouton « Générer la description » sur la fiche d'œuvre. La clé est <strong>chiffrée dans le coffre de Windows</strong> (jamais affichée ni stockée en clair). À créer sur console.anthropic.com — facturé à l'usage (~0,4 ¢ par description). Sans clé, l'app fonctionne normalement (« Copier pour ChatGPT » reste disponible).</p>
            </div>
            ${champTextarea({ nom: 'ia_instructions_galerie', libelle: 'Consignes générales de la galerie', valeur: config.ia?.instructions_galerie || '', lignes: 14 })}
            <p class="aide-champ">Consignes de base appliquées à <strong>toutes</strong> les générations (voix, langue et format, ancrage factuel, règles d'écriture). Modifiables ici. Les consignes propres à chaque artiste se règlent sur sa fiche (« Aide à la description IA »).</p>
            ${champTexte({ nom: 'ia_lien_chatgpt_defaut', libelle: 'Lien ChatGPT par défaut', valeur: config.ia?.lien_chatgpt_defaut || 'https://chat.openai.com/', attributs: 'placeholder="https://chat.openai.com/"' })}
            <p class="aide-champ">Pour « Copier pour ChatGPT » : utilisé quand l'artiste n'a pas de lien vers son propre GPT.</p>
          </div>

          <!-- Sécurité (6 col) — géré hors du formulaire principal -->
          <div class="carte zone-securite">
            <h3>Sécurité</h3>

            <div class="sous-section">
              <h4>Verrou de l'application</h4>
              <div class="form-champ form-champ-checkbox">
                <input type="checkbox" id="sec-verrou-actif">
                <label for="sec-verrou-actif">Demander un code pour ouvrir l'application</label>
              </div>
              <p class="aide-champ" id="sec-aide-verrou">Définissez d'abord un code ci-dessous pour pouvoir activer le verrou.</p>
            </div>

            <div class="sous-section">
              <h4>Code de déverrouillage</h4>
              <div class="grille-form">
                <div class="form-champ">
                  <label for="sec-code">Code (4 à 6 chiffres)</label>
                  <input type="password" id="sec-code" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="••••" spellcheck="false">
                </div>
                <div class="form-champ">
                  <label for="sec-code2">Confirmer le code</label>
                  <input type="password" id="sec-code2" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="••••" spellcheck="false">
                </div>
              </div>
              <div class="ia-cle-actions">
                <button type="button" class="btn-action btn-principal" id="sec-code-def">Enregistrer le code</button>
                <button type="button" class="btn-action btn-secondaire-action" id="sec-code-suppr">Retirer le code</button>
              </div>
              <p class="securite-statut absent" id="sec-statut">Aucun code défini.</p>
            </div>

            <div class="sous-section">
              <h4>Verrouillage automatique</h4>
              <div class="form-champ">
                <label for="sec-inactivite">Après une période d'inactivité</label>
                <select id="sec-inactivite">
                  <option value="0">Jamais (seulement à l'ouverture)</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                </select>
              </div>
              <div class="form-champ form-champ-checkbox">
                <input type="checkbox" id="sec-blur">
                <label for="sec-blur">Verrouiller aussi quand on quitte la fenêtre</label>
              </div>
              <p class="aide-champ">Le compte à rebours se réarme à chaque mouvement de souris ou frappe au clavier.</p>
            </div>

            <div class="sous-section">
              <h4>Chiffrement de la base de données</h4>
              <div class="form-champ form-champ-checkbox">
                <input type="checkbox" id="sec-chiffrement">
                <label for="sec-chiffrement">Chiffrer le fichier de la base au repos</label>
              </div>
              <p class="securite-statut absent" id="sec-chiffrement-statut">Chiffrement désactivé.</p>
              <p class="aide-champ">Quand l'application est fermée, le fichier de la base devient illisible si on le copie sur un autre ordinateur (clé rangée dans le coffre de Windows, lié à ce compte). À <strong>compléter par BitLocker</strong> (chiffrement du disque) pour protéger aussi les photos et les sauvegardes. Les <strong>sauvegardes restent en clair</strong> sur le disque (pour qu'une restauration reste possible) : gardez-les sur un disque BitLocker et une clé USB chiffrée. Prend pleinement effet à la fermeture de l'application.</p>
            </div>
          </div>

          <!-- À propos (6 col) -->
          <div class="carte zone-apropos">
            <h3>À propos</h3>
            <dl class="infos-app-bento">
              <dt>Application</dt><dd>${ech(infosApp.nom)}</dd>
              <dt>Version</dt><dd>${ech(infosApp.version)}</dd>
              <dt>Marque affichée</dt><dd>${ech(config.galerie?.nom || '—')}</dd>
              <dt>Dossier des données</dt>
              <dd><button type="button" class="lien-dossier" id="btn-ouvrir-dossier-donnees" title="Ouvrir le dossier dans l'Explorateur">${ech(infosApp.dataDir)}</button></dd>
              <dt>Moteur</dt><dd>Electron ${ech(infosApp.electron)} sur ${ech(infosApp.plateforme)}</dd>
            </dl>
            <div class="updater-bloc">
              <p class="updater-statut" id="updater-statut">${ech(libelleEtat())}</p>
              <div style="display: flex; gap: var(--s2);">
                <button type="button" class="btn-action btn-secondaire-action" id="btn-updater-verifier">Vérifier les mises à jour</button>
                <button type="button" class="btn-action btn-secondaire-action" id="btn-updater-voir" hidden>Voir les détails</button>
              </div>
            </div>
            <p class="aide-champ" style="margin-top: var(--s3);">Données conservées localement (Loi 25).</p>
          </div>

        </div>

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

  const btnUpdaterVerifier = contenu.querySelector('#btn-updater-verifier');
  const btnUpdaterVoir = contenu.querySelector('#btn-updater-voir');
  const statutUpdater = contenu.querySelector('#updater-statut');
  if (btnUpdaterVerifier && btnUpdaterVoir && statutUpdater) {
    const desabonner = abonnerEtatUpdater((etat) => {
      statutUpdater.textContent = libelleEtat(etat);
      const phasesActives = new Set(['available', 'downloading', 'downloaded', 'error']);
      btnUpdaterVoir.hidden = !phasesActives.has(etat.phase);
      btnUpdaterVerifier.disabled = etat.phase === 'checking' || etat.phase === 'downloading';
    });
    btnUpdaterVerifier.addEventListener('click', () => verifierManuellement());
    btnUpdaterVoir.addEventListener('click', () => ouvrirModale());
    // Nettoyer l'abonnement quand on quitte la vue (le contenu est remplacé par le router)
    const observer = new MutationObserver(() => {
      if (!document.body.contains(statutUpdater)) {
        desabonner();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const btnOuvrirDossierDonnees = contenu.querySelector('#btn-ouvrir-dossier-donnees');
  if (btnOuvrirDossierDonnees) {
    btnOuvrirDossierDonnees.addEventListener('click', async () => {
      try {
        const r = await window.api.ouvrirDossier(infosApp.dataDir);
        if (r && !r.ok) {
          await alerter({
            type: 'error',
            title: 'Impossible d\'ouvrir le dossier',
            message: r.erreur || 'Une erreur est survenue.',
          });
        }
      } catch (err) {
        await alerter({ type: 'error', title: 'Impossible d\'ouvrir le dossier', message: err.message });
      }
    });
  }

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

  contenu.querySelector('#btn-restaurer').addEventListener('click', async () => {
    let choix;
    try {
      choix = await window.api.backupChoisirRestauration();
    } catch (err) {
      await alerter({ type: 'error', title: 'Restauration impossible', message: err.message });
      return;
    }
    if (!choix || choix.cancelled) return;
    if (choix.error) {
      await alerter({ type: 'error', title: 'Fichier non valide', message: choix.error });
      return;
    }
    const i = choix.infos || {};
    const r = await confirmer({
      type: 'warning',
      title: 'Restaurer cette sauvegarde ?',
      message: `Le fichier « ${choix.nom} » remplacera vos données actuelles. Une copie de sécurité de la base actuelle sera faite avant.`,
      detail: `Contenu de la sauvegarde : ${i.artistes ?? '?'} artistes, ${i.oeuvres ?? '?'} œuvres, ${i.clients ?? '?'} clients, ${i.ventes ?? '?'} ventes.\n\nL'application va redémarrer.`,
      buttons: ['Restaurer et redémarrer', 'Annuler'],
      defaultId: 1, cancelId: 1,
    });
    if (r !== 0) return;
    try {
      await window.api.backupRestaurer(choix.path); // déclenche le redémarrage
    } catch (err) {
      await alerter({ type: 'error', title: 'Restauration échouée', message: err.message });
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
        prochain_numero_inventaire: Math.max(1, Math.floor(num('d_prochain_numero_inventaire') || 1)),
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

  // ---- Clé API Anthropic (chiffrée dans le coffre, gérée hors du form) ----
  const inCle = contenu.querySelector('#ia-cle');
  const statutCle = contenu.querySelector('#ia-cle-statut');
  if (inCle && statutCle) {
    // Ne pas marquer le formulaire « modifié » quand on tape la clé (gérée à part).
    inCle.addEventListener('input', (e) => e.stopPropagation());
    inCle.addEventListener('change', (e) => e.stopPropagation());
    const rafraichirStatutCle = async () => {
      try {
        const r = await window.api.iaCleDefinie();
        if (!r.chiffrement) {
          statutCle.className = 'ia-cle-statut absent';
          statutCle.textContent = "⚠ Le coffre de chiffrement n'est pas disponible sur cet ordinateur ; la clé ne peut pas être enregistrée en sécurité.";
        } else if (r.definie) {
          statutCle.className = 'ia-cle-statut ok';
          statutCle.textContent = '✓ Clé définie · chiffrée dans le coffre Windows';
          inCle.placeholder = '•••••••••••• (clé enregistrée — laisse vide pour la conserver)';
        } else {
          statutCle.className = 'ia-cle-statut absent';
          statutCle.textContent = 'Aucune clé enregistrée — la génération directe est inactive.';
          inCle.placeholder = 'sk-ant-…';
        }
      } catch { /* silencieux */ }
    };
    rafraichirStatutCle();
    contenu.querySelector('#btn-ia-cle-save').addEventListener('click', async () => {
      const cle = inCle.value.trim();
      if (!cle) {
        await alerter({ type: 'warning', title: 'Clé vide', message: 'Colle ta clé API Anthropic dans le champ.' });
        return;
      }
      try {
        await window.api.iaDefinirCle(cle);
        inCle.value = '';
        await rafraichirStatutCle();
        await alerter({ type: 'succes', title: 'Clé enregistrée', message: 'La clé est chiffrée dans le coffre de Windows.' });
      } catch (err) {
        await alerter({ type: 'error', title: 'Enregistrement échoué', message: err.message });
      }
    });
    contenu.querySelector('#btn-ia-cle-suppr').addEventListener('click', async () => {
      const r = await confirmer({
        type: 'warning', title: 'Retirer la clé ?',
        message: 'La génération directe des descriptions sera désactivée.',
        buttons: ['Retirer', 'Annuler'], defaultId: 1, cancelId: 1,
      });
      if (r !== 0) return;
      try {
        await window.api.iaEffacerCle();
        inCle.value = '';
        await rafraichirStatutCle();
      } catch (err) {
        await alerter({ type: 'error', title: 'Échec', message: err.message });
      }
    });
  }

  // ---- Sécurité : verrou léger (géré hors du form, effet immédiat) ----
  const secCode = contenu.querySelector('#sec-code');
  const secCode2 = contenu.querySelector('#sec-code2');
  const secStatut = contenu.querySelector('#sec-statut');
  const secVerrou = contenu.querySelector('#sec-verrou-actif');
  const secAide = contenu.querySelector('#sec-aide-verrou');
  const secInact = contenu.querySelector('#sec-inactivite');
  const secBlur = contenu.querySelector('#sec-blur');
  if (secCode && secStatut && secVerrou) {
    // Ces contrôles ne doivent pas marquer le formulaire principal « modifié ».
    [secCode, secCode2, secVerrou, secInact, secBlur].forEach((el) => {
      el.addEventListener('input', (e) => e.stopPropagation());
      el.addEventListener('change', (e) => e.stopPropagation());
    });
    // Entrée dans un champ de code = enregistrer le code, pas soumettre le form.
    [secCode, secCode2].forEach((el) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); contenu.querySelector('#sec-code-def').click(); }
      });
    });

    let codeDefini = false;
    const rafraichirSecurite = async () => {
      try {
        const s = await window.api.securiteEtat();
        codeDefini = !!s.code_defini;
        secVerrou.checked = !!s.verrou_actif;
        secVerrou.disabled = !codeDefini;
        secInact.value = String(s.inactivite_minutes ?? 10);
        secBlur.checked = !!s.verrouiller_au_blur;
        secAide.textContent = codeDefini
          ? "Le code sera demandé à l'ouverture et après la période d'inactivité choisie."
          : "Définissez d'abord un code ci-dessous pour pouvoir activer le verrou.";
        secStatut.className = codeDefini ? 'securite-statut ok' : 'securite-statut absent';
        secStatut.textContent = codeDefini ? '✓ Code défini' : 'Aucun code défini.';
      } catch { /* silencieux */ }
    };
    await rafraichirSecurite();

    contenu.querySelector('#sec-code-def').addEventListener('click', async () => {
      const c1 = secCode.value.trim();
      const c2 = secCode2.value.trim();
      if (!/^\d{4,6}$/.test(c1)) {
        secStatut.className = 'securite-statut erreur';
        secStatut.textContent = 'Le code doit comporter de 4 à 6 chiffres.';
        return;
      }
      if (c1 !== c2) {
        secStatut.className = 'securite-statut erreur';
        secStatut.textContent = 'Les deux codes ne correspondent pas.';
        return;
      }
      try {
        await window.api.securiteDefinirCode(c1);
        secCode.value = ''; secCode2.value = '';
        await rafraichirSecurite();
        await reappliquerVerrou();
        await alerter({ type: 'succes', title: 'Code enregistré', message: 'Le verrou de l\'application est maintenant actif.' });
      } catch (err) {
        secStatut.className = 'securite-statut erreur';
        secStatut.textContent = err.message;
      }
    });

    contenu.querySelector('#sec-code-suppr').addEventListener('click', async () => {
      if (!codeDefini) return;
      const r = await confirmer({
        type: 'warning', title: 'Retirer le code ?',
        message: 'Le verrou de l\'application sera désactivé.',
        buttons: ['Retirer', 'Annuler'], defaultId: 1, cancelId: 1,
      });
      if (r !== 0) return;
      try {
        await window.api.securiteRetirerCode();
        secCode.value = ''; secCode2.value = '';
        await rafraichirSecurite();
        await reappliquerVerrou();
      } catch (err) {
        await alerter({ type: 'error', title: 'Échec', message: err.message });
      }
    });

    const enregistrerOptions = async () => {
      try {
        await window.api.securiteDefinirOptions({
          verrou_actif: secVerrou.checked,
          inactivite_minutes: Number(secInact.value),
          verrouiller_au_blur: secBlur.checked,
        });
        await rafraichirSecurite();
        await reappliquerVerrou();
      } catch { /* silencieux */ }
    };
    secVerrou.addEventListener('change', enregistrerOptions);
    secInact.addEventListener('change', enregistrerOptions);
    secBlur.addEventListener('change', enregistrerOptions);
  }

  // ---- Sécurité : chiffrement de la base au repos (effet immédiat) ----
  const secChiff = contenu.querySelector('#sec-chiffrement');
  const secChiffStatut = contenu.querySelector('#sec-chiffrement-statut');
  if (secChiff && secChiffStatut) {
    secChiff.addEventListener('input', (e) => e.stopPropagation());
    let chiffActif = false;
    const rafraichirChiffrement = async () => {
      try {
        const e = await window.api.chiffrementEtat();
        chiffActif = !!e.actif;
        secChiff.checked = chiffActif;
        secChiff.disabled = !e.disponible;
        if (!e.disponible) {
          secChiffStatut.className = 'securite-statut erreur';
          secChiffStatut.textContent = "⚠ Le coffre de chiffrement n'est pas disponible sur cet ordinateur.";
        } else if (chiffActif) {
          secChiffStatut.className = 'securite-statut ok';
          secChiffStatut.textContent = '✓ Base chiffrée au repos (coffre Windows)';
        } else {
          secChiffStatut.className = 'securite-statut absent';
          secChiffStatut.textContent = 'Chiffrement désactivé.';
        }
      } catch { /* silencieux */ }
    };
    await rafraichirChiffrement();

    secChiff.addEventListener('change', async (e) => {
      e.stopPropagation();
      const vouluActif = secChiff.checked;
      // Confirmation : c'est une opération sensible.
      const r = await confirmer({
        type: vouluActif ? 'question' : 'warning',
        title: vouluActif ? 'Chiffrer la base de données ?' : 'Désactiver le chiffrement ?',
        message: vouluActif
          ? "Le fichier de la base sera chiffré et lié à ce compte Windows. Pensez à activer BitLocker pour une protection complète. Les sauvegardes restent en clair."
          : "Le fichier de la base ne sera plus chiffré au repos. La protection reposera sur BitLocker uniquement.",
        buttons: [vouluActif ? 'Chiffrer' : 'Désactiver', 'Annuler'],
        defaultId: 1, cancelId: 1,
      });
      if (r !== 0) { secChiff.checked = chiffActif; return; } // annulé : revenir à l'état réel
      try {
        if (vouluActif) await window.api.chiffrementActiver();
        else await window.api.chiffrementDesactiver();
        await rafraichirChiffrement();
        await alerter({
          type: 'succes',
          title: vouluActif ? 'Chiffrement activé' : 'Chiffrement désactivé',
          message: vouluActif
            ? 'La base est maintenant chiffrée. Le fichier clair est retiré à la fermeture de l’application.'
            : 'Le chiffrement de la base est désactivé.',
        });
      } catch (err) {
        secChiff.checked = chiffActif;
        await alerter({ type: 'error', title: 'Échec', message: err.message });
      }
    });
  }

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
