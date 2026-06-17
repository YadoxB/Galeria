import { retour, poserGardien, leverGardien } from '../router.js';
import { ech, champTexte } from '../commun.js';
import { confirmer, alerter } from '../dialogue.js';
import { chargerConfig, invaliderCacheConfig, rafraichirEntete } from '../marque.js';

export async function rendreProfilGalerie(contenu) {
  const config = JSON.parse(JSON.stringify(await chargerConfig()));
  let modifie = false;

  async function gardien() {
    if (!modifie) return true;
    const r = await confirmer({
      type: 'warning',
      title: 'Modifications non sauvegardées',
      message: 'Voulez-vous abandonner les modifications en cours ?',
      buttons: ['Abandonner', 'Rester sur la page'],
      defaultId: 1, cancelId: 1,
    });
    return r === 0;
  }
  poserGardien(gardien);

  const g = config.galerie;

  contenu.innerHTML = `
    <div class="vue-fiche vue-fiche-bento">
      <div class="reglages-entete">
        <h1>Profil de la galerie</h1>
        <p class="reglages-entete-meta">
          Ces informations alimentent les bas de page, les en-têtes et les blocs de coordonnées
          de tous les documents générés (certificats, factures).
        </p>
      </div>

      <form id="formulaire" class="formulaire" novalidate>
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

          <div class="carte zone-profil-fisc">
            <h3>Fiscalité</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'g_numero_tps', libelle: 'Numéro TPS de la galerie', valeur: g.numero_tps })}
              ${champTexte({ nom: 'g_numero_tvq', libelle: 'Numéro TVQ de la galerie', valeur: g.numero_tvq })}
            </div>
          </div>

          <div class="carte zone-profil-visuel">
            <h3>Identité visuelle</h3>
            ${champTexte({ nom: 'g_logo_path', libelle: 'Chemin du logo (optionnel — laisse vide pour le logo par défaut)', valeur: g.logo_path })}
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const v = (k) => fd.get(k) ?? '';

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
    };

    try {
      await window.api.configSauver(partiel);
      invaliderCacheConfig();
      await rafraichirEntete();
      modifie = false;
      leverGardien();
      await alerter({
        type: 'succes',
        title: 'Profil enregistré',
        message: 'Les informations de la galerie ont été mises à jour.',
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
    leverGardien();
    retour();
  });
}
