import { retour, poserGardien, leverGardien } from '../router.js';
import { ech, champTexte, champTextarea, champCheckbox, nettoyerErreur } from '../commun.js';
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

function formaterTaille(octets) {
  if (!Number.isFinite(octets)) return '';
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

// Icônes de la barre latérale (une par catégorie).
const ICONES_CAT = {
  galerie: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
  finances: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.5 2.5 0 0 1 9.5 15"/><path d="M12 6v1.5M12 16.5V18"/>',
  documents: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  donnees: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  securite: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ia: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/>',
  application: '<line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2"/>',
};
const CATEGORIES = [
  { cle: 'galerie', libelle: 'La galerie' },
  { cle: 'finances', libelle: 'Finances' },
  { cle: 'documents', libelle: 'Documents' },
  { cle: 'donnees', libelle: 'Données' },
  { cle: 'securite', libelle: 'Sécurité' },
  { cle: 'ia', libelle: 'Intelligence artificielle' },
  { cle: 'application', libelle: 'Application' },
];

function boutonCat({ cle, libelle }, actif) {
  return `<button type="button" class="cat-item${actif ? ' actif' : ''}" data-cat="${cle}">
    <span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONES_CAT[cle]}</svg></span>
    ${ech(libelle)}
  </button>`;
}

// Modale de choix d'une sauvegarde à restaurer. Résout avec l'entrée choisie,
// ou null si l'utilisateur annule (bouton, Échap, clic hors de la fenêtre).
function ouvrirModaleRestauration(liste, formaterDateHeure) {
  return new Promise((resolve) => {
    const MAX_AFFICHEES = 30;
    const visibles = liste.slice(0, MAX_AFFICHEES);

    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale';
    overlay.innerHTML = `
      <div class="modale-restauration" role="dialog" aria-modal="true">
        <h3>Restaurer une sauvegarde</h3>
        <p class="aide-champ">Choisissez la copie à restaurer. La plus récente est en haut.${
          liste.length > MAX_AFFICHEES ? ` (${MAX_AFFICHEES} plus récentes affichées sur ${liste.length}.)` : ''
        }</p>
        <div class="liste-restauration">
          ${visibles.map((s, i) => `
            <button type="button" class="ligne-restauration" data-i="${i}">
              <span class="ligne-restauration-date">${ech(formaterDateHeure(s.quand))}</span>
              <span class="ligne-restauration-detail">${ech(s.nom)} · ${formaterTaille(s.taille)}${
                s.personnalise ? ' · dossier personnalisé' : ''
              }</span>
            </button>
          `).join('')}
        </div>
        <div class="dialogue-actions">
          <button type="button" class="btn-action btn-secondaire-action" data-annuler>Annuler</button>
        </div>
      </div>
    `;

    function fermer(valeur) {
      window.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(valeur);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        fermer(null);
      }
    }
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) fermer(null);
    });
    overlay.querySelector('[data-annuler]').addEventListener('click', () => fermer(null));
    overlay.querySelectorAll('.ligne-restauration').forEach((b) => {
      b.addEventListener('click', () => fermer(visibles[Number(b.dataset.i)]));
    });
    window.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  });
}

export async function rendreReglages(contenu, params) {
  const config = JSON.parse(JSON.stringify(await chargerConfig()));
  const infosApp = await window.api.appInfos();
  const emplacement = await window.api.donneesEmplacement();
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
  const g = config.galerie;

  // Catégorie ouverte au chargement (permet d'ouvrir directement « La galerie »
  // depuis un lien externe, ex. remplacement du bloc profil de la barre latérale).
  const categorieValide = CATEGORIES.some((c) => c.cle === params?.categorie);
  const catInitiale = categorieValide ? params.categorie : 'galerie';

  contenu.innerHTML = `
    <div class="vue-fiche reglages-vue">
      <div class="reglages-entete">
        <h1>Réglages</h1>
        <p class="reglages-entete-meta">
          Tout ce qui se règle dans Galeria, regroupé par catégorie. Choisis une section à gauche.
        </p>
      </div>

      <form id="formulaire" class="formulaire" novalidate>
        <div class="reglages-layout">
          <nav class="cat-nav" id="cat-nav" aria-label="Catégories de réglages">
            ${CATEGORIES.map((c) => boutonCat(c, c.cle === catInitiale)).join('')}
          </nav>

          <div class="cat-zone">

            <!-- ═══ LA GALERIE ═══ -->
            <section class="cat-panneau${catInitiale === 'galerie' ? ' actif' : ''}" data-cat="galerie">
              <div class="panneau-tete"><h2>La galerie</h2><p class="desc">L'identité de la galerie. Ces informations alimentent l'en-tête et le pied des documents générés.</p></div>
              <div class="grille-bento">
                <div class="carte zone-profil-identite">
                  <h3>Identité</h3>
                  <div class="grille-form">
                    ${champTexte({ nom: 'g_nom', libelle: 'Nom de la galerie', valeur: g.nom, requis: true })}
                    ${champTexte({ nom: 'g_site_web', libelle: 'Site web', valeur: g.site_web, type: 'url' })}
                  </div>
                </div>
                <div class="carte zone-profil-coord">
                  <h3>Coordonnées</h3>
                  <div class="grille-form">
                    ${champTexte({ nom: 'g_telephone', libelle: 'Téléphone', valeur: g.telephone, type: 'tel' })}
                    ${champTexte({ nom: 'g_courriel', libelle: 'Courriel', valeur: g.courriel, type: 'email' })}
                  </div>
                  <div class="grille-form">
                    ${champTexte({ nom: 'g_adresse_ligne1', libelle: 'Adresse (ligne 1)', valeur: g.adresse_ligne1 })}
                    ${champTexte({ nom: 'g_adresse_ligne2', libelle: 'Adresse (ligne 2)', valeur: g.adresse_ligne2 })}
                  </div>
                </div>
                <div class="carte zone-profil-visuel">
                  <h3>Logo</h3>
                  <div class="form-champ">
                    <label for="f-g_logo_path">Fichier du logo (laisse vide pour le logo par défaut)</label>
                    <div class="ligne-dossier">
                      <input type="text" id="f-g_logo_path" name="g_logo_path" value="${ech(g.logo_path)}" placeholder="Aucun — logo Galeria par défaut" readonly>
                      <button type="button" class="btn-action btn-secondaire-action" id="btn-choisir-logo">Choisir un fichier…</button>
                      <button type="button" class="btn-action btn-secondaire-action" id="btn-effacer-logo">Retirer</button>
                    </div>
                    <p class="aide-champ">Le logo apparaît en haut des lettres de remerciement. Format PNG, JPG, GIF ou WebP.</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- ═══ FINANCES ═══ -->
            <section class="cat-panneau${catInitiale === 'finances' ? ' actif' : ''}" data-cat="finances">
              <div class="panneau-tete"><h2>Finances</h2><p class="desc">Numéros d'enregistrement, taux de taxes et commission de la galerie.</p></div>
              <div class="grille-bento">
                <div class="carte zone-fisc-numeros">
                  <h3>Numéros d'enregistrement</h3>
                  <div class="grille-form">
                    ${champTexte({ nom: 'g_numero_tps', libelle: 'Numéro TPS de la galerie', valeur: g.numero_tps })}
                    ${champTexte({ nom: 'g_numero_tvq', libelle: 'Numéro TVQ de la galerie', valeur: g.numero_tvq })}
                  </div>
                  <p class="aide-champ">Ces numéros apparaissent sur les factures.</p>
                </div>
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
              </div>
            </section>

            <!-- ═══ DOCUMENTS ═══ -->
            <section class="cat-panneau${catInitiale === 'documents' ? ' actif' : ''}" data-cat="documents">
              <div class="panneau-tete"><h2>Documents</h2><p class="desc">Numérotation des factures, certificats et de l'inventaire, et texte du signataire.</p></div>
              <div class="grille-bento">
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
                <div class="carte zone-doc-rappel">
                  <h3>Rappel</h3>
                  <p class="aide-champ">Les <strong>taux</strong> de TPS/TVQ et la <strong>cote</strong> de la galerie sont dans la catégorie <strong>Finances</strong>.</p>
                </div>
              </div>
            </section>

            <!-- ═══ DONNÉES ═══ -->
            <section class="cat-panneau${catInitiale === 'donnees' ? ' actif' : ''}" data-cat="donnees">
              <div class="panneau-tete"><h2>Données</h2><p class="desc">Emplacement du dossier, sauvegardes automatiques, restauration et import.</p></div>
              <div class="grille-bento">
                <div class="carte zone-emplacement">
                  <h3>Dossier de données Galeria<span class="chip-emplacement ${emplacement.sousOneDrive ? 'nuage' : 'local'}" id="chip-emplacement">${emplacement.sousOneDrive ? 'dans le nuage' : 'local'}</span></h3>
                  <p class="aide-champ" style="margin-top:0;">C'est là que Galeria conserve tout : le catalogue, les photos, les documents produits et les sauvegardes. Un seul dossier, entièrement sur cet ordinateur.</p>
                  <div class="sous-section">
                    <h4>Emplacement actuel</h4>
                    <div class="ligne-dossier">
                      <input type="text" id="f-emplacement-actuel" value="${ech(emplacement.chemin)}" readonly>
                      <button type="button" class="btn-action btn-secondaire-action" id="btn-ouvrir-emplacement">Ouvrir</button>
                    </div>
                    ${emplacement.sousOneDrive ? `
                    <p class="aide-champ attention-secours" id="bandeau-onedrive">
                      <strong>Vos données sont dans un dossier synchronisé par OneDrive</strong> — elles sont donc aussi copiées dans le nuage Microsoft. Pour que tout reste seulement sur cet ordinateur (recommandé, et conforme à la Loi&nbsp;25), déplacez-les vers un dossier local comme <strong>${ech(emplacement.defautSuggere)}</strong>.
                    </p>` : ''}
                  </div>
                  <div class="ligne-boutons-donnees">
                    <button type="button" class="btn-action btn-principal btn-gros-bento" id="btn-deplacer-dossier">Déplacer le dossier…</button>
                  </div>
                  <p class="aide-champ">Une sauvegarde est faite d'abord, puis Galeria redémarre pour terminer en toute sécurité.</p>
                  <div class="bloc-recuperation">
                    Vos données se trouvent déjà ailleurs ? <span class="sous">(OneDrive les a déplacées, ou vous réinstallez Galeria sur cet ordinateur.)</span><br>
                    <button type="button" class="lien-recup" id="btn-adopter-dossier">→ Indiquer à Galeria où les retrouver</button>
                  </div>
                </div>
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
                  <p class="aide-champ" id="backup-etat">Vérification des sauvegardes…</p>
                  <div class="ligne-boutons-sauvegardes">
                    <button type="button" class="btn-action btn-secondaire-action btn-gros-bento" id="btn-sauvegarder-maintenant">Sauvegarder maintenant</button>
                    <button type="button" class="btn-action btn-secondaire-action btn-gros-bento" id="btn-restaurer-sauvegarde">Restaurer une sauvegarde…</button>
                  </div>
                </div>
                <div class="carte zone-import">
                  <h3>Import de données</h3>
                  <p class="aide-champ" style="margin-top:0;">
                    Importe un fichier CSV exporté d'Airtable (Artistes ou Œuvres). Tu choisiras entre <em>mettre à jour</em> ou <em>n'ajouter que les nouvelles</em>.
                  </p>
                  <button type="button" class="btn-action btn-secondaire-action btn-gros-bento" id="btn-importer">Importer un fichier CSV…</button>
                </div>
              </div>
            </section>

            <!-- ═══ SÉCURITÉ ═══ -->
            <section class="cat-panneau${catInitiale === 'securite' ? ' actif' : ''}" data-cat="securite">
              <div class="panneau-tete"><h2>Sécurité</h2><p class="desc">Verrou par code et question de secours.</p></div>
              <div class="grille-bento">
                <div class="carte zone-securite">
                  <h3>Verrou de l'application</h3>

                  <div class="sous-section">
                    <h4>Activation</h4>
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
                </div>

                <div class="carte zone-securite-secours">
                  <h3>Question de secours</h3>
                  <p class="aide-champ" style="margin-top:0;">Facultative, mais recommandée : elle permet de reprendre la main si le code est oublié, sans avoir à appeler à l'aide.</p>
                  <div class="form-champ">
                    <label for="sec-question">Question</label>
                    <select id="sec-question">
                      <option value="">— Choisir une question —</option>
                      <option>Dans quelle ville êtes-vous né ?</option>
                      <option>Quel était le nom de votre premier animal ?</option>
                      <option>Quel est le nom de jeune fille de votre mère ?</option>
                      <option>Quelle est votre ville de vacances préférée ?</option>
                      <option>Quel était le nom de votre école primaire ?</option>
                      <option value="__autre__">Écrire ma propre question…</option>
                    </select>
                  </div>
                  <div class="form-champ" id="sec-question-libre-bloc" hidden>
                    <label for="sec-question-libre">Votre question</label>
                    <input type="text" id="sec-question-libre" maxlength="120" placeholder="Ex. : Comment s'appelait le chalet de mes parents ?">
                  </div>
                  <div class="form-champ">
                    <label for="sec-reponse">Réponse</label>
                    <input type="text" id="sec-reponse" autocomplete="off" spellcheck="false" placeholder="Votre réponse">
                    <p class="aide-champ">Les accents, les majuscules et les espaces n'ont pas d'importance : « Sainte-Foy » et « sainte foy » sont acceptés tous les deux.</p>
                  </div>
                  <div class="ia-cle-actions">
                    <button type="button" class="btn-action btn-principal" id="sec-question-def">Enregistrer la question</button>
                    <button type="button" class="btn-action btn-secondaire-action" id="sec-question-suppr">Retirer la question</button>
                  </div>
                  <p class="securite-statut absent" id="sec-question-statut">Aucune question définie.</p>
                  <p class="aide-champ attention-secours">Choisissez une réponse qu'un visiteur ne pourrait pas deviner — évitez ce qui se trouve sur le site ou la page Facebook de la galerie.</p>
                </div>
              </div>
            </section>

            <!-- ═══ INTELLIGENCE ARTIFICIELLE ═══ -->
            <section class="cat-panneau${catInitiale === 'ia' ? ' actif' : ''}" data-cat="ia">
              <div class="panneau-tete"><h2>Intelligence artificielle</h2><p class="desc">Consignes de rédaction et clé d'accès pour la génération des descriptions.</p></div>
              <div class="grille-bento">
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
              </div>
            </section>

            <!-- ═══ APPLICATION ═══ -->
            <section class="cat-panneau${catInitiale === 'application' ? ' actif' : ''}" data-cat="application">
              <div class="panneau-tete"><h2>Application</h2><p class="desc">Affichage, version et mises à jour.</p></div>
              <div class="grille-bento">
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
            </section>

          </div>
        </div>

        <div class="form-actions reglages-barre-save">
          <span class="reglages-indic" id="reglages-indic">Aucune modification.</span>
          <div class="reglages-barre-boutons">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler">Annuler</button>
            <button type="submit" class="btn-action btn-principal">Enregistrer</button>
          </div>
        </div>
      </form>
    </div>
  `;

  const form = contenu.querySelector('#formulaire');
  const indic = contenu.querySelector('#reglages-indic');
  function marquerModifie() {
    modifie = true;
    if (indic) { indic.textContent = '● Modifications non enregistrées'; indic.classList.add('modif'); }
  }
  form.addEventListener('input', marquerModifie);
  form.addEventListener('change', marquerModifie);

  // ---- Navigation entre catégories (un seul panneau visible à la fois) ----
  // Tout vit dans le même formulaire : changer de catégorie ne perd aucune
  // saisie, donc pas d'avertissement à la bascule.
  const nav = contenu.querySelector('#cat-nav');
  const catItems = [...nav.querySelectorAll('.cat-item')];
  const panneaux = [...contenu.querySelectorAll('.cat-panneau')];
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('.cat-item');
    if (!b) return;
    const cat = b.dataset.cat;
    catItems.forEach((i) => i.classList.toggle('actif', i === b));
    panneaux.forEach((p) => p.classList.toggle('actif', p.dataset.cat === cat));
  });

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
        await alerter({ type: 'error', title: 'Impossible d\'ouvrir le dossier', message: nettoyerErreur(err) });
      }
    });
  }

  // ---- Emplacement du dossier de données : ouvrir / déplacer / retrouver ----
  const btnOuvrirEmplacement = contenu.querySelector('#btn-ouvrir-emplacement');
  if (btnOuvrirEmplacement) {
    btnOuvrirEmplacement.addEventListener('click', () => window.api.ouvrirDossier(emplacement.chemin));
  }

  const btnDeplacer = contenu.querySelector('#btn-deplacer-dossier');
  if (btnDeplacer) {
    btnDeplacer.addEventListener('click', async () => {
      // 1. Choisir la destination (le dossier local recommandé est proposé).
      const choix = await confirmer({
        type: 'question',
        title: 'Déplacer le dossier de données',
        message: `Où placer le dossier Galeria ? Nous recommandons un dossier local, hors OneDrive :\n${emplacement.defautSuggere}`,
        buttons: [`Utiliser ${emplacement.defautSuggere}`, 'Choisir un autre dossier…', 'Annuler'],
        defaultId: 0, cancelId: 2,
      });
      if (choix === 2) return;
      let destination = emplacement.defautSuggere;
      if (choix === 1) {
        const r = await window.api.donneesChoisirDestination();
        if (!r || r.cancelled) return;
        destination = r.destination;
      }
      // 2. Valider sans rien déplacer.
      const val = await window.api.donneesValiderDestination(destination);
      if (!val || !val.ok) {
        await alerter({ type: 'error', title: 'Emplacement impossible', message: val?.erreur || 'Cette destination ne convient pas.' });
        return;
      }
      // 3. Confirmation finale, puis déplacement au redémarrage.
      const ok = await confirmer({
        type: 'warning',
        title: 'Déplacer et redémarrer',
        message: `Galeria va déplacer toutes vos données vers :\n${destination}`,
        detail: 'Une sauvegarde de sûreté est faite d’abord. Si c’est sur le même disque, c’est instantané ; sur un autre disque, une copie vérifiée est faite avant d’effacer l’ancien dossier. Galeria redémarre ensuite. Pendant l’opération, ne fermez pas Galeria et laissez OneDrive tranquille.',
        buttons: ['Déplacer et redémarrer', 'Annuler'],
        defaultId: 0, cancelId: 1,
      });
      if (ok !== 0) return;
      const res = await window.api.donneesDeplacer(destination);
      if (res && !res.ok) {
        await alerter({ type: 'error', title: 'Déplacement impossible', message: res.erreur || 'Le déplacement n’a pas pu être lancé.' });
      }
      // Si tout va bien, Galeria redémarre d’elle-même.
    });
  }

  const btnAdopter = contenu.querySelector('#btn-adopter-dossier');
  if (btnAdopter) {
    btnAdopter.addEventListener('click', async () => {
      const r = await window.api.donneesChoisirDossierExistant();
      if (!r || r.cancelled) return;
      if (!r.valide) {
        await alerter({
          type: 'error',
          title: 'Dossier non reconnu',
          message: 'Ce dossier ne contient pas de base Galeria (galerie.db).',
          detail: 'Choisissez le dossier « Galeria » lui-même — celui qui contient le fichier galerie.db, le dossier Photos et le dossier Sauvegardes.',
        });
        return;
      }
      const ok = await confirmer({
        type: 'question',
        title: 'Indiquer où se trouvent vos données',
        message: `Utiliser ce dossier ?\n${r.dossier}`,
        detail: 'Rien n’est déplacé : Galeria va simplement lire vos données à cet endroit, puis redémarrer.',
        buttons: ['Utiliser et redémarrer', 'Annuler'],
        defaultId: 0, cancelId: 1,
      });
      if (ok !== 0) return;
      const res = await window.api.donneesAdopter(r.dossier);
      if (res && !res.ok) {
        await alerter({ type: 'error', title: 'Impossible', message: res.erreur || 'Ce dossier ne peut pas être utilisé.' });
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

  // ---- Logo de la galerie : sélecteur de fichier ----
  contenu.querySelector('#btn-choisir-logo').addEventListener('click', async () => {
    try {
      const r = await window.api.configChoisirLogo();
      if (r && !r.cancelled && r.path) {
        contenu.querySelector('#f-g_logo_path').value = r.path;
        marquerModifie();
      }
    } catch (err) {
      await alerter({ type: 'error', title: 'Impossible de choisir le fichier', message: nettoyerErreur(err) });
    }
  });
  contenu.querySelector('#btn-effacer-logo').addEventListener('click', () => {
    contenu.querySelector('#f-g_logo_path').value = '';
    marquerModifie();
  });

  contenu.querySelector('#btn-choisir-dossier').addEventListener('click', async () => {
    const r = await window.api.configChoisirDossier();
    if (r && !r.cancelled && r.path) {
      contenu.querySelector('#f-s_dossier').value = r.path;
      marquerModifie();
    }
  });

  contenu.querySelector('#btn-defaut-dossier').addEventListener('click', () => {
    contenu.querySelector('#f-s_dossier').value = '';
    marquerModifie();
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

  // ---- État des sauvegardes (dernière copie sur disque) ----
  const elEtatBackup = contenu.querySelector('#backup-etat');
  const formaterDateHeure = (t) =>
    new Date(t).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' });
  async function rafraichirEtatBackup() {
    if (!elEtatBackup || !document.body.contains(elEtatBackup)) return;
    try {
      const [liste, etat] = await Promise.all([window.api.backupListe(), window.api.backupEtat()]);
      const morceaux = [];
      if (liste.length) {
        morceaux.push(`Dernière copie : ${formaterDateHeure(liste[0].quand)} (${liste.length} sur disque).`);
      } else {
        morceaux.push('Aucune sauvegarde sur le disque pour l\'instant.');
      }
      if (etat.dernier_echec && (!etat.derniere_reussite || etat.dernier_echec > etat.derniere_reussite)) {
        morceaux.push(`⚠ Dernier essai échoué (${formaterDateHeure(Date.parse(etat.dernier_echec))}).`);
      } else if (etat.repli) {
        morceaux.push('⚠ Dossier configuré inaccessible : copies faites dans le dossier par défaut.');
      }
      elEtatBackup.textContent = morceaux.join(' ');
    } catch {
      elEtatBackup.textContent = 'État des sauvegardes indisponible.';
    }
  }
  rafraichirEtatBackup();

  contenu.querySelector('#btn-sauvegarder-maintenant').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const r = await window.api.backupNow();
      await alerter({
        type: r.repli ? 'warning' : 'succes',
        title: 'Sauvegarde créée',
        message: r.repli
          ? 'La sauvegarde a été créée, mais dans le dossier PAR DÉFAUT : le dossier configuré est inaccessible (clé USB retirée ?).'
          : 'La sauvegarde a été créée et vérifiée avec succès.',
        detail: `Fichier : ${r.nom}\nDossier : ${r.dossier}`,
      });
    } catch (err) {
      await alerter({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: 'La sauvegarde a échoué.',
        detail: nettoyerErreur(err),
      });
    } finally {
      btn.disabled = false;
      rafraichirEtatBackup();
    }
  });

  // ---- Restauration d'une sauvegarde ----
  contenu.querySelector('#btn-restaurer-sauvegarde').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const liste = await window.api.backupListe();
      if (!liste.length) {
        await alerter({
          type: 'info',
          title: 'Aucune sauvegarde',
          message: 'Aucune sauvegarde n\'a été trouvée sur le disque.',
        });
        return;
      }
      const choix = await ouvrirModaleRestauration(liste, formaterDateHeure);
      if (!choix) return;

      const i = await confirmer({
        type: 'warning',
        title: 'Restaurer cette sauvegarde ?',
        message: `La base actuelle sera remplacée par la copie du ${formaterDateHeure(choix.quand)}.`,
        detail:
          'Tout ce qui a été fait APRÈS cette copie sera perdu. Par sécurité, '
          + 'une copie de la base actuelle est faite juste avant. '
          + 'L\'application redémarrera automatiquement.',
        buttons: ['Restaurer et redémarrer', 'Annuler'],
        defaultId: 1,
        cancelId: 1,
      });
      if (i !== 0) return;

      const r = await window.api.backupRestaurer(choix.chemin);
      if (r && r.ok) {
        await alerter({
          type: 'succes',
          title: 'Sauvegarde restaurée',
          message: 'L\'application va redémarrer sur les données restaurées…',
        });
      } else {
        await alerter({
          type: 'error',
          title: 'Restauration impossible',
          message: (r && r.erreur) || 'Une erreur est survenue.',
        });
      }
    } catch (err) {
      await alerter({
        type: 'error',
        title: 'Restauration impossible',
        message: nettoyerErreur(err),
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
      galerie: {
        nom: v('g_nom').trim() || 'Galerie',
        telephone: v('g_telephone').trim(),
        courriel: v('g_courriel').trim(),
        site_web: v('g_site_web').trim(),
        adresse_ligne1: v('g_adresse_ligne1').trim(),
        adresse_ligne2: v('g_adresse_ligne2').trim(),
        numero_tps: v('g_numero_tps').trim(),
        numero_tvq: v('g_numero_tvq').trim(),
        logo_path: v('g_logo_path').trim(),
      },
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
        message: nettoyerErreur(err),
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
        await alerter({ type: 'error', title: 'Enregistrement échoué', message: nettoyerErreur(err) });
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
        await alerter({ type: 'error', title: 'Échec', message: nettoyerErreur(err) });
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

    // ---- Question de secours ----
    const secQuestion = contenu.querySelector('#sec-question');
    const secQuestionLibre = contenu.querySelector('#sec-question-libre');
    const secQuestionLibreBloc = contenu.querySelector('#sec-question-libre-bloc');
    const secReponse = contenu.querySelector('#sec-reponse');
    const secQStatut = contenu.querySelector('#sec-question-statut');
    [secQuestion, secQuestionLibre, secReponse].forEach((el) => {
      el.addEventListener('input', (e) => e.stopPropagation());
      el.addEventListener('change', (e) => e.stopPropagation());
    });
    secQuestion.addEventListener('change', () => {
      secQuestionLibreBloc.hidden = secQuestion.value !== '__autre__';
      if (secQuestion.value === '__autre__') secQuestionLibre.focus();
    });
    const questionChoisie = () => (secQuestion.value === '__autre__'
      ? secQuestionLibre.value.trim()
      : secQuestion.value.trim());

    let codeDefini = false;
    const rafraichirSecurite = async () => {
      try {
        const s = await window.api.securiteEtat();
        codeDefini = !!s.code_defini;
        // Question de secours : on n'affiche jamais la réponse (on ne l'a pas).
        secQStatut.className = s.question_definie ? 'securite-statut ok' : 'securite-statut absent';
        secQStatut.textContent = s.question_definie
          ? `✓ Question définie : « ${s.question} »`
          : 'Aucune question définie.';
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

    contenu.querySelector('#sec-question-def').addEventListener('click', async () => {
      const q = questionChoisie();
      const rep = secReponse.value;
      if (!q) {
        secQStatut.className = 'securite-statut erreur';
        secQStatut.textContent = 'Choisissez une question.';
        return;
      }
      if (!rep || !rep.trim()) {
        secQStatut.className = 'securite-statut erreur';
        secQStatut.textContent = 'Entrez la réponse.';
        return;
      }
      try {
        await window.api.securiteDefinirQuestion(q, rep);
        secReponse.value = '';
        await rafraichirSecurite();
        await alerter({
          type: 'succes',
          title: 'Question enregistrée',
          message: 'Vous pourrez reprendre la main si le code est oublié.',
          detail: 'Sur l\'écran de verrouillage, cliquez « Code oublié ? » pour répondre à la question et choisir un nouveau code.',
        });
      } catch (err) {
        secQStatut.className = 'securite-statut erreur';
        secQStatut.textContent = err.message;
      }
    });

    contenu.querySelector('#sec-question-suppr').addEventListener('click', async () => {
      const r = await confirmer({
        type: 'warning', title: 'Retirer la question de secours ?',
        message: 'Sans elle, un code oublié ne pourra plus être réinitialisé depuis l\'écran de verrouillage.',
        buttons: ['Retirer', 'Annuler'], defaultId: 1, cancelId: 1,
      });
      if (r !== 0) return;
      try {
        await window.api.securiteRetirerQuestion();
        secQuestion.value = '';
        secQuestionLibre.value = '';
        secQuestionLibreBloc.hidden = true;
        secReponse.value = '';
        await rafraichirSecurite();
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
