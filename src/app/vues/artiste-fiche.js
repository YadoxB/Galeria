import { naviguer, retour, poserGardien, leverGardien, modifierParamsCourants, remplacerCourant } from '../router.js';
import {
  ech, initiales, pluriel,
  champTexte, champTextarea, champCheckbox, datalist,
  champPays, champSubdivision, brancherChangementPays,
  parserNumerosTaxes, urlPhoto, sansAccents, nomComplet,
  badgeArchive, boutonArchive, basculerArchive,
} from '../commun.js';
import { parserCotes, TAILLES_COTES, formaterMontant } from '../calcul-prix.js';
import { recadrerCarre } from '../recadrage.js';
import { visionner } from '../visionneuse.js';
import { confirmer } from '../dialogue.js';

const TYPES_ARTISTE = ['Peintre', 'Sculpteur', 'Photographe', 'Graveur', 'Illustrateur'];
const LANGUES = ['Français', 'Anglais', 'Bilingue'];
const ETIQUETTES_TAXES_COURANTES = ['TPS', 'TVQ', 'TVH', 'TPS/TVH'];

const GABARIT_VIDE = {
  id: null,
  nom: '',
  type: null, prefixe_inventaire: null,
  biographie: null, demarche: null, curriculum: null,
  courriel: null, telephone: null, adresse: null,
  pays: 'Canada', province: null, langue: null,
  percoit_taxes: 0, numeros_taxes: null,
  photo_path: null,
  photo_originale_path: null,
  notes: null,
  instructions_ia: null,
  lien_chatgpt: null,
  cotes: null,
  nb_oeuvres: 0,
};

const MEDIUMS_PAR_DEFAUT = ['Acrylique', 'Huile', 'Encaustique', 'Aquarelle', 'Pastel', 'Photographie', 'Mixte'];

export async function rendreArtisteFiche(contenu, params) {
  const estNouveau = !!params.nouveau;
  let a;
  let voisins = { precedent: null, suivant: null, position: null, total: 0 };

  // Liste des médiums : fusion de la base existante et de la liste par défaut.
  // On charge en plus les médiums propres à CET artiste pour les mettre en
  // tête du dropdown (très visible).
  let mediumsConnus = [];
  let mediumsArtiste = [];
  try {
    const dbMediums = await window.api.oeuvresMediums();
    const set = new Set([...MEDIUMS_PAR_DEFAUT, ...dbMediums]);
    mediumsConnus = Array.from(set).sort((x, y) => x.localeCompare(y, 'fr', { sensitivity: 'base' }));
  } catch {
    mediumsConnus = [...MEDIUMS_PAR_DEFAUT];
  }
  if (!estNouveau) {
    try {
      mediumsArtiste = await window.api.oeuvresMediumsArtiste(params.id);
    } catch { mediumsArtiste = []; }
  }

  if (estNouveau) {
    a = { ...GABARIT_VIDE };
  } else {
    [a, voisins] = await Promise.all([
      window.api.artisteGet(params.id),
      window.api.artisteVoisins(params.id),
    ]);
    if (!a) {
      contenu.innerHTML = `<p class="erreur">Artiste introuvable.</p>`;
      return;
    }
  }

  let mode = estNouveau ? 'edition' : 'lecture';
  let modifie = false;
  let nouveau = estNouveau;

  if (nouveau) poserGardien(gardienChangements);

  async function gardienChangements() {
    if (!modifie && !nouveau) return true;
    const reponse = await confirmer({
      type: 'warning',
      title: nouveau ? 'Abandonner cet artiste ?' : 'Modifications non sauvegardées',
      message: nouveau
        ? 'Cet artiste n\'a pas été enregistré. Voulez-vous l\'abandonner ?'
        : 'Voulez-vous abandonner les modifications en cours ?',
      buttons: ['Abandonner', nouveau ? 'Continuer la saisie' : 'Rester sur la fiche'],
      defaultId: 1,
      cancelId: 1,
    });
    return reponse === 0;
  }

  function entrerEdition() {
    mode = 'edition';
    modifie = false;
    poserGardien(gardienChangements);
    dessiner();
  }

  function sortirEdition() {
    mode = 'lecture';
    modifie = false;
    nouveau = false;
    leverGardien();
    dessiner();
  }

  async function supprimer() {
    const nomA = nomComplet(a) || a.nom || '';
    if (a.nb_oeuvres > 0) {
      await confirmer({
        type: 'error',
        title: 'Impossible de supprimer',
        message: `« ${nomA} » est lié à ${pluriel(a.nb_oeuvres, 'œuvre')} dans le catalogue.`,
        detail: "Tu dois d'abord supprimer ou réattribuer ces œuvres avant de pouvoir supprimer l'artiste.",
        buttons: ['OK'],
      });
      return;
    }
    const reponse = await confirmer({
      type: 'warning',
      title: 'Supprimer cet artiste ?',
      message: `Supprimer définitivement « ${nomA} » ?`,
      detail: 'Cette action est irréversible. Tu peux retrouver une version antérieure dans les sauvegardes si besoin.',
      buttons: ['Supprimer', 'Annuler'],
      defaultId: 1,
      cancelId: 1,
    });
    if (reponse !== 0) return;
    try {
      await window.api.artisteSupprimer(a.id);
      leverGardien();
      retour();
    } catch (err) {
      await confirmer({
        type: 'error',
        title: 'Suppression échouée',
        message: err.message,
        buttons: ['OK'],
      });
    }
  }

  function dessiner() {
    mode === 'lecture' ? dessinerLecture() : dessinerEdition();
  }

  function dessinerLecture() {
    const champ = (libelle, valeur) =>
      valeur != null && valeur !== ''
        ? `<div class="champ"><dt>${ech(libelle)}</dt><dd>${ech(valeur).replace(/\n/g, '<br>')}</dd></div>`
        : '';

    const libelleSub = a.pays === 'États-Unis' ? 'État' : (a.pays && a.pays !== 'Canada' ? 'Région' : 'Province');
    const lignesContact = [
      champ('Courriel', a.courriel),
      champ('Téléphone', a.telephone),
      champ('Adresse', a.adresse),
      champ('Pays', a.pays),
      champ(libelleSub, a.province),
      champ('Langue', a.langue),
    ].join('');

    const taxes = parserNumerosTaxes(a.numeros_taxes);
    const lignesTaxes = [
      champ('Perçoit les taxes', a.percoit_taxes ? 'Oui' : 'Non'),
      a.percoit_taxes && taxes.length
        ? taxes.map((t) => champ(t.etiquette, t.numero)).join('')
        : '',
    ].join('');

    const cotesA = parserCotes(a.cotes);
    const lignesCotes = cotesA.length ? cotesA.map((c) => {
      const uniteLib = c.unite === 'carre' ? '$/po²' : '$/po lin';
      const cible = c.medium === 'Tous' && c.taille === 'Tous'
        ? 'Toutes œuvres'
        : `${c.medium}${c.taille !== 'Tous' ? ' · ' + c.taille : ''}`;
      return champ(cible, `${formaterMontant(c.prix_pref)} ${uniteLib}`);
    }).join('') : '';

    const nomCompletA = nomComplet(a) || a.nom || '';
    const avatarHtml = a.photo_path
      ? `<div class="avatar grand avec-photo cliquable" id="avatar-vision" title="Voir en grand"><img src="${urlPhoto(a.photo_path)}" alt="${ech(nomCompletA)}"></div>`
      : `<div class="avatar grand"><span>${ech(initiales(nomCompletA))}</span></div>`;

    const blocPliable = (titre, contenuInterne, ouvertParDefaut = true) =>
      `<details class="bloc pliable" ${ouvertParDefaut ? 'open' : ''}>
         <summary><h3>${ech(titre)}</h3><span class="chevron-bloc">&rsaquo;</span></summary>
         <div class="bloc-corps">${contenuInterne}</div>
       </details>`;

    const navVoisins = voisins.total > 1 ? `
      <nav class="nav-voisins" aria-label="Navigation entre artistes">
        <button class="btn-voisin btn-voisin-prec" ${voisins.precedent ? '' : 'disabled'} title="${voisins.precedent ? ech(voisins.precedent.nom) : ''}">
          <span class="fleche">&larr;</span>
          <span class="libelle-voisin">
            <span class="libelle-mini">Précédent</span>
            <span class="nom-voisin">${voisins.precedent ? ech(voisins.precedent.nom) : '—'}</span>
          </span>
        </button>
        <span class="position-voisin">${voisins.position} / ${voisins.total}</span>
        <button class="btn-voisin btn-voisin-suiv" ${voisins.suivant ? '' : 'disabled'} title="${voisins.suivant ? ech(voisins.suivant.nom) : ''}">
          <span class="libelle-voisin libelle-droite">
            <span class="libelle-mini">Suivant</span>
            <span class="nom-voisin">${voisins.suivant ? ech(voisins.suivant.nom) : '—'}</span>
          </span>
          <span class="fleche">&rarr;</span>
        </button>
      </nav>
    ` : '';

    contenu.innerHTML = `
      <div class="vue-fiche">
        <div class="entete-fiche">
          ${avatarHtml}
          <div class="entete-fiche-info">
            <h2>${ech(nomCompletA)} ${a.archive ? badgeArchive() : ''}</h2>
            <p class="meta">
              ${a.type ? ech(a.type) : '<em>type non précisé</em>'}
              ${a.prefixe_inventaire ? ` &middot; Préfixe ${ech(a.prefixe_inventaire)}` : ''}
              &middot; ${pluriel(a.nb_oeuvres, 'œuvre')} au catalogue
            </p>
          </div>
          <div class="entete-fiche-actions">
            <button class="btn-action btn-danger" id="btn-supprimer">Supprimer</button>
            ${boutonArchive({ archive: a.archive })}
            <button class="btn-action" id="btn-modifier">Modifier</button>
          </div>
        </div>

        ${navVoisins}

        <div class="actions-fiche">
          ${a.nb_oeuvres > 0 ? `
            <button class="btn-action" id="btn-voir-oeuvres">
              Voir ${a.nb_oeuvres === 1 ? 'son œuvre' : 'ses œuvres'} &rsaquo;
            </button>
          ` : ''}
          <button class="btn-action btn-principal" id="btn-ajouter-oeuvres">
            + Ajouter ${a.nb_oeuvres > 0 ? "d'autres" : 'des'} œuvres
          </button>
        </div>

        ${lignesContact ? blocPliable('Contact', `<dl class="champs">${lignesContact}</dl>`) : ''}
        ${a.biographie ? blocPliable('Biographie', `<p class="texte-long">${ech(a.biographie).replace(/\n/g, '<br>')}</p>`) : ''}
        ${a.demarche ? blocPliable('Démarche', `<p class="texte-long">${ech(a.demarche).replace(/\n/g, '<br>')}</p>`) : ''}
        ${a.curriculum ? blocPliable('Curriculum', `<p class="texte-long">${ech(a.curriculum).replace(/\n/g, '<br>')}</p>`) : ''}
        ${lignesTaxes ? blocPliable('Fiscalité', `<dl class="champs">${lignesTaxes}</dl>`) : ''}
        ${lignesCotes ? blocPliable('Cotes (calcul de prix)', `<dl class="champs">${lignesCotes}</dl><p class="aide-champ" style="margin-top:8px;">Le prix courant ajoute automatiquement <strong>2 $/po linéaire</strong> au tarif préférentiel pour l'encadrement.</p>`) : ''}
        ${a.notes ? blocPliable('Notes', `<p class="texte-long">${ech(a.notes).replace(/\n/g, '<br>')}</p>`) : ''}
      </div>
    `;

    contenu.querySelector('#btn-modifier').addEventListener('click', entrerEdition);
    contenu.querySelector('#btn-supprimer').addEventListener('click', supprimer);
    contenu.querySelector('#btn-archiver').addEventListener('click', async () => {
      const fait = await basculerArchive({
        table: 'artistes',
        fiche: a,
        libelleFiche: nomCompletA,
        confirmer,
        surFait: () => dessiner(),
      });
      if (!fait) return;
    });
    const avatarVision = contenu.querySelector('#avatar-vision');
    if (avatarVision && a.photo_path) {
      avatarVision.addEventListener('click', () => {
        const source = a.photo_originale_path || a.photo_path;
        visionner(urlPhoto(source));
      });
    }
    contenu.querySelectorAll('.btn-voisin-prec').forEach((btn) => {
      if (voisins.precedent) {
        btn.addEventListener('click', () =>
          remplacerCourant('artiste-fiche', { id: voisins.precedent.id })
        );
      }
    });
    contenu.querySelectorAll('.btn-voisin-suiv').forEach((btn) => {
      if (voisins.suivant) {
        btn.addEventListener('click', () =>
          remplacerCourant('artiste-fiche', { id: voisins.suivant.id })
        );
      }
    });
    const btnVoir = contenu.querySelector('#btn-voir-oeuvres');
    if (btnVoir) {
      btnVoir.addEventListener('click', () =>
        naviguer('oeuvres-liste', { artiste_id: a.id, artiste_nom: nomCompletA })
      );
    }
    const btnAjouterOeuvres = contenu.querySelector('#btn-ajouter-oeuvres');
    if (btnAjouterOeuvres) {
      btnAjouterOeuvres.addEventListener('click', () => {
        naviguer('oeuvre-fiche', {
          nouveau: true,
          artiste_id: a.id,
          enchainement: true,
          enchainement_compte: 0,
          enchainement_artiste_nom: nomCompletA,
        });
      });
    }
  }

  function gabaritLigneTaxe(etiquette = '', numero = '') {
    return `
      <div class="ligne-taxe">
        <input type="text" class="champ-etiquette" placeholder="Étiquette (ex. TPS)" list="etiquettes-taxes" value="${ech(etiquette)}">
        <input type="text" class="champ-numero" placeholder="Numéro" value="${ech(numero)}">
        <button type="button" class="btn-supprimer-ligne" title="Retirer cette ligne" aria-label="Retirer">&times;</button>
      </div>
    `;
  }

  function dessinerEdition() {
    const taxes = parserNumerosTaxes(a.numeros_taxes);
    const lignesTaxesHtml = taxes.length
      ? taxes.map((t) => gabaritLigneTaxe(t.etiquette, t.numero)).join('')
      : (nouveau ? gabaritLigneTaxe('TPS', '') : gabaritLigneTaxe('TPS', ''));

    const nomAffichage = nomComplet(a) || a.nom || '';
    const titrePage = nouveau ? 'Nouvel artiste' : `Modifier « ${ech(nomAffichage)} »`;

    contenu.innerHTML = `
      <div class="vue-fiche">
        <h2 class="titre-formulaire">${titrePage}</h2>
        ${datalist('types-artiste', TYPES_ARTISTE)}
        ${datalist('langues', LANGUES)}
        ${datalist('etiquettes-taxes', ETIQUETTES_TAXES_COURANTES)}
        <form id="formulaire" class="formulaire" novalidate>
          <section class="bloc">
            <h3>Identité</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'prenom', libelle: 'Prénom', valeur: a.prenom })}
              ${champTexte({ nom: 'nom', libelle: 'Nom de famille', valeur: a.nom, requis: true })}
            </div>
            <div class="grille-form">
              ${champTexte({ nom: 'type', libelle: 'Type', valeur: a.type, liste: 'types-artiste' })}
              ${champTexte({ nom: 'prefixe_inventaire', libelle: "Préfixe d'inventaire", valeur: a.prefixe_inventaire, attributs: 'maxlength="10"' })}
              ${champTexte({ nom: 'langue', libelle: 'Langue', valeur: a.langue, liste: 'langues' })}
            </div>
            ${nouveau ? '<p class="aide-champ">Le préfixe se calcule automatiquement à partir des deux premières lettres du prénom et de la première du nom de famille (ex. Joe Untel → JOU). Tu peux le modifier au besoin.</p>' : ''}
          </section>

          ${nouveau ? '' : `
          <section class="bloc">
            <h3>Photo</h3>
            <div class="zone-photo-edition">
              <div class="apercu-photo">
                ${a.photo_path
                  ? `<img src="${urlPhoto(a.photo_path)}" alt="">`
                  : '<span class="apercu-vide">Aucune photo</span>'}
              </div>
              <div class="actions-photo">
                <button type="button" class="btn-action" id="btn-choisir-photo">${a.photo_path ? 'Remplacer la photo…' : 'Choisir une photo…'}</button>
                <button type="button" class="btn-action" id="btn-recadrer-photo" style="${a.photo_path ? '' : 'display:none'}">Recadrer</button>
                <button type="button" class="btn-action btn-danger" id="btn-effacer-photo" style="${a.photo_path ? '' : 'display:none'}">Retirer la photo</button>
              </div>
            </div>
            <p class="aide-champ">Le fichier est copié dans <code>Documents\\GalerieApp\\Photos\\artistes\\</code>. Ton original reste intact.</p>
          </section>
          `}

          <section class="bloc">
            <h3>Contact</h3>
            <div class="grille-form">
              ${champTexte({ nom: 'courriel', libelle: 'Courriel', valeur: a.courriel, type: 'email' })}
              ${champTexte({ nom: 'telephone', libelle: 'Téléphone', valeur: a.telephone, type: 'tel' })}
            </div>
            ${champTextarea({ nom: 'adresse', libelle: 'Adresse', valeur: a.adresse, lignes: 2 })}
            <div class="grille-form">
              ${champPays({ nom: 'pays', valeur: a.pays || 'Canada' })}
              <div id="zone-province-artiste">
                ${champSubdivision({ nom: 'province', pays: a.pays || 'Canada', valeur: a.province })}
              </div>
            </div>
          </section>

          <section class="bloc">
            <h3>Présentation</h3>
            ${champTextarea({ nom: 'biographie', libelle: 'Biographie', valeur: a.biographie, lignes: 5 })}
            ${champTextarea({ nom: 'demarche', libelle: 'Démarche', valeur: a.demarche, lignes: 5 })}
            ${champTextarea({ nom: 'curriculum', libelle: 'Curriculum', valeur: a.curriculum, lignes: 5 })}
          </section>

          <section class="bloc">
            <h3>Fiscalité</h3>
            ${champCheckbox({ nom: 'percoit_taxes', libelle: 'Perçoit les taxes', valeur: !!a.percoit_taxes })}
            <div class="form-champ">
              <label>Numéros de taxes</label>
              <div id="zone-taxes">${lignesTaxesHtml}</div>
              <button type="button" id="btn-ajouter-taxe" class="btn-ajouter">+ Ajouter un numéro de taxe</button>
              <p class="aide-champ">Une ligne par numéro. Étiquettes courantes : TPS, TVQ, TVH. Tu peux mettre n'importe quel libellé.</p>
            </div>
          </section>

          <section class="bloc">
            <h3>Notes</h3>
            ${champTextarea({ nom: 'notes', libelle: 'Notes internes', valeur: a.notes, lignes: 3 })}
          </section>

          <section class="bloc">
            <h3>Cotes (calcul de prix)</h3>
            <p class="aide-champ">Tarif <strong>préférentiel</strong> (sans encadrement) appliqué selon le médium et la taille de l'œuvre. La version <strong>courante</strong> ajoute automatiquement 2 $ à la cote (= prix avec encadrement). Si aucune cote ne correspond, le prix de l'œuvre reste saisi à la main.</p>
            <div id="zone-cotes"></div>
            <button type="button" id="btn-ajouter-cote" class="btn-ajouter">+ Ajouter une cote</button>
            <details class="aide-priorite-cotes" style="margin-top:12px;">
              <summary>Ordre de priorité (cliquer pour déplier)</summary>
              <p class="aide-champ" style="margin-top:8px;">Quand plusieurs cotes pourraient s'appliquer à une œuvre, Galeria prend toujours la <strong>plus précise</strong> :</p>
              <ol class="aide-champ" style="margin:6px 0 8px 1.4em; padding:0;">
                <li>Médium <em>exact</em> + taille <em>exacte</em></li>
                <li>Médium « Tous » + taille <em>exacte</em></li>
                <li>Médium <em>exact</em> + taille « Tous »</li>
                <li>Médium « Tous » + taille « Tous » (fallback général)</li>
              </ol>
              <p class="aide-champ" style="margin-top:8px;"><strong>Exemple.</strong> Tu veux 30 $ partout sauf 35 $ en très grand : 1 cote « Tous / Tous = 30 » + 1 cote « Tous / Très grand = 35 » suffit. Pas besoin de répéter pour Petit / Moyen / Grand.</p>
              <p class="aide-champ"><strong>À noter.</strong> Le médium est insensible à la casse et aux accents : « Acrylique », « acrylique » et « ACRYLIQUE » sont équivalents.</p>
            </details>
          </section>

          <section class="bloc">
            <h3>Aide à la description IA</h3>
            ${champTextarea({ nom: 'instructions_ia', libelle: "Consignes pour ChatGPT spécifiques à cet artiste", valeur: a.instructions_ia, lignes: 6 })}
            <p class="aide-champ">Ce texte sera inclus dans le prompt généré par le bouton « Copier pour ChatGPT » sur les fiches d'œuvres de cet artiste. Tu peux y coller le système prompt de son GPT personnalisé : style à adopter, mots-clés à privilégier, termes à éviter, longueur cible, exemples, etc.</p>
            ${champTexte({ nom: 'lien_chatgpt', libelle: 'Lien vers le GPT personnalisé de cet artiste', valeur: a.lien_chatgpt, attributs: 'placeholder="https://chatgpt.com/g/g-xxx-mon-artiste"' })}
            <p class="aide-champ">Si l'artiste a son propre GPT, colle l'URL ici. Le bouton « Copier pour ChatGPT » ouvrira directement ce lien plutôt que ChatGPT générique.</p>
          </section>

          <div class="form-actions">
            <button type="button" class="btn-action btn-secondaire-action" id="btn-annuler">Annuler</button>
            ${nouveau
              ? `<button type="submit" class="btn-action btn-secondaire-action" id="btn-creer-seul">Créer seulement</button>
                 <button type="submit" class="btn-action btn-principal" id="btn-creer-et-oeuvres">Créer + ajouter les œuvres</button>`
              : `<button type="submit" class="btn-action btn-principal">Enregistrer</button>`}
          </div>
        </form>
      </div>
    `;

    const form = contenu.querySelector('#formulaire');
    const zoneTaxes = contenu.querySelector('#zone-taxes');

    function majPreviewPhoto() {
      const apercu = contenu.querySelector('.apercu-photo');
      if (apercu) {
        apercu.innerHTML = a.photo_path
          ? `<img src="${urlPhoto(a.photo_path)}" alt="">`
          : '<span class="apercu-vide">Aucune photo</span>';
      }
      const btnChoisir = contenu.querySelector('#btn-choisir-photo');
      if (btnChoisir) btnChoisir.textContent = a.photo_path ? 'Remplacer la photo…' : 'Choisir une photo…';
      const btnEffacer = contenu.querySelector('#btn-effacer-photo');
      if (btnEffacer) btnEffacer.style.display = a.photo_path ? '' : 'none';
      const btnRecadrer = contenu.querySelector('#btn-recadrer-photo');
      if (btnRecadrer) btnRecadrer.style.display = a.photo_path ? '' : 'none';
    }

    const btnChoisirPhoto = contenu.querySelector('#btn-choisir-photo');
    if (btnChoisirPhoto) {
      btnChoisirPhoto.addEventListener('click', async () => {
        btnChoisirPhoto.disabled = true;
        try {
          const lecture = await window.api.photoLireFichier();
          if (!lecture || lecture.cancelled) return;
          const dataUrlRecadree = await recadrerCarre(lecture.dataUrl);
          if (!dataUrlRecadree) return;
          const result = await window.api.photoEnregistrerRecadree(
            'artistes', a.id, dataUrlRecadree, lecture.dataUrl
          );
          if (result && result.path !== undefined) {
            a.photo_path = result.path;
            a.photo_originale_path = (await window.api.artisteGet(a.id)).photo_originale_path;
            majPreviewPhoto();
          }
        } catch (err) {
          await confirmer({
            type: 'error', title: 'Photo non chargée',
            message: err.message, buttons: ['OK'],
          });
        } finally {
          btnChoisirPhoto.disabled = false;
        }
      });
    }

    const btnRecadrerPhoto = contenu.querySelector('#btn-recadrer-photo');
    if (btnRecadrerPhoto) {
      btnRecadrerPhoto.addEventListener('click', async () => {
        btnRecadrerPhoto.disabled = true;
        try {
          const lecture = await window.api.photoLirePourRecadrage('artistes', a.id);
          if (!lecture || !lecture.dataUrl) return;
          if (!lecture.depuisOriginale) {
            const reponse = await confirmer({
              type: 'info',
              title: 'Pas d\'original conservé',
              message: 'Cette photo a été ajoutée avant que la conservation des originaux ne soit en place. Le recadrage partira de la version déjà recadrée (résolution moindre).',
              detail: 'Pour partir d\'une pleine résolution, utilise plutôt « Remplacer la photo… » avec le fichier d\'origine.',
              buttons: ['Continuer quand même', 'Annuler'],
              defaultId: 0, cancelId: 1,
            });
            if (reponse !== 0) return;
          }
          const dataUrlRecadree = await recadrerCarre(lecture.dataUrl);
          if (!dataUrlRecadree) return;
          const result = await window.api.photoEnregistrerRecadree(
            'artistes', a.id, dataUrlRecadree, null
          );
          if (result && result.path !== undefined) {
            a.photo_path = result.path;
            majPreviewPhoto();
          }
        } catch (err) {
          await confirmer({
            type: 'error', title: 'Recadrage impossible',
            message: err.message, buttons: ['OK'],
          });
        } finally {
          btnRecadrerPhoto.disabled = false;
        }
      });
    }

    const btnEffacerPhoto = contenu.querySelector('#btn-effacer-photo');
    if (btnEffacerPhoto) {
      btnEffacerPhoto.addEventListener('click', async () => {
        const reponse = await confirmer({
          type: 'warning', title: 'Retirer la photo ?',
          message: 'La photo (recadrée et originale) sera effacée définitivement du dossier de la galerie.',
          buttons: ['Retirer', 'Annuler'],
          defaultId: 1, cancelId: 1,
        });
        if (reponse !== 0) return;
        try {
          await window.api.photoEffacer('artistes', a.id);
          a.photo_path = null;
          a.photo_originale_path = null;
          majPreviewPhoto();
        } catch (err) {
          await confirmer({
            type: 'error', title: 'Suppression échouée',
            message: err.message, buttons: ['OK'],
          });
        }
      });
    }

    function brancherSuppressions() {
      zoneTaxes.querySelectorAll('.btn-supprimer-ligne').forEach((btn) => {
        btn.onclick = () => {
          btn.closest('.ligne-taxe').remove();
          modifie = true;
        };
      });
    }
    brancherSuppressions();

    contenu.querySelector('#btn-ajouter-taxe').addEventListener('click', () => {
      zoneTaxes.insertAdjacentHTML('beforeend', gabaritLigneTaxe());
      brancherSuppressions();
      modifie = true;
      const dernierEtiq = zoneTaxes.querySelector('.ligne-taxe:last-child .champ-etiquette');
      if (dernierEtiq) dernierEtiq.focus();
    });

    // ====== Éditeur de cotes ======
    const zoneCotes = contenu.querySelector('#zone-cotes');
    function gabaritLigneCote(c = {}) {
      const medium = (c.medium || 'Tous').replace(/"/g, '&quot;');
      const taille = c.taille || 'Tous';
      const unite = c.unite || 'lineaire';
      const prix = c.prix_pref ?? '';
      const optionsTailles = ['Tous', ...TAILLES_COTES]
        .map((t) => `<option value="${t}" ${t === taille ? 'selected' : ''}>${ech(t)}</option>`).join('');
      return `
        <div class="ligne-cote">
          <div class="select-edit-wrap" data-medium-wrap>
            <input type="text" class="cote-medium" placeholder="Médium (ou Tous)" value="${medium}" autocomplete="off">
            <button type="button" class="select-edit-toggle" aria-label="Voir les options" tabindex="-1">▾</button>
          </div>
          <select class="cote-taille">${optionsTailles}</select>
          <select class="cote-unite">
            <option value="lineaire" ${unite === 'lineaire' ? 'selected' : ''}>$/po linéaire</option>
            <option value="carre" ${unite === 'carre' ? 'selected' : ''}>$/po²</option>
          </select>
          <input type="number" class="cote-prix" placeholder="Prix" value="${prix}" min="0" step="0.01">
          <button type="button" class="btn-supprimer-ligne" title="Retirer cette cote" aria-label="Retirer">&times;</button>
        </div>
      `;
    }
    // Dropdown custom pour les médiums : input texte libre + bouton ▾ qui
    // affiche toute la liste, sans filtrage. Click outside pour fermer.
    // Deux sections : médiums déjà utilisés par cet artiste (en haut),
    // puis tous les autres médiums (le reste).
    const normaliser = (s) => (s || '').toString().normalize('NFD').replace(/\p{Mn}/gu, '').trim().toLowerCase();
    const ensembleArtiste = new Set(mediumsArtiste.map(normaliser));
    const autresMediums = mediumsConnus.filter((m) => !ensembleArtiste.has(normaliser(m)) && normaliser(m) !== 'tous');

    function brancherDropdownMedium(wrap) {
      const input = wrap.querySelector('.cote-medium');
      const toggle = wrap.querySelector('.select-edit-toggle');
      let panneau = null;
      const fermer = () => {
        if (panneau) { panneau.remove(); panneau = null; }
        document.removeEventListener('mousedown', onClicExt);
      };
      const onClicExt = (e) => {
        if (!wrap.contains(e.target)) fermer();
      };
      const optionsHtml = (vals) => vals
        .map((v) => `<button type="button" class="select-edit-option">${ech(v)}</button>`)
        .join('');
      const ouvrir = () => {
        if (panneau) return;
        panneau = document.createElement('div');
        panneau.className = 'select-edit-panel';
        let html = `<button type="button" class="select-edit-option select-edit-option-tous">Tous</button>`;
        if (mediumsArtiste.length) {
          html += `<div class="select-edit-section">Médiums de cet artiste</div>`;
          html += optionsHtml(mediumsArtiste);
        }
        if (autresMediums.length) {
          html += `<div class="select-edit-section">Autres médiums</div>`;
          html += optionsHtml(autresMediums);
        }
        panneau.innerHTML = html;
        wrap.appendChild(panneau);
        panneau.querySelectorAll('.select-edit-option').forEach((b) => {
          b.addEventListener('click', () => {
            input.value = b.textContent;
            modifie = true;
            fermer();
            input.focus();
          });
        });
        setTimeout(() => document.addEventListener('mousedown', onClicExt), 0);
      };
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (panneau) fermer(); else ouvrir();
      });
    }

    function rendreCotes(cotesArr) {
      const liste = Array.isArray(cotesArr) && cotesArr.length ? cotesArr : [];
      zoneCotes.innerHTML = liste.map(gabaritLigneCote).join('') ||
        '<p class="aide-champ" style="margin:0 0 8px;">Aucune cote définie. Ajoute-en une pour activer le calcul automatique du prix.</p>';
      zoneCotes.querySelectorAll('.btn-supprimer-ligne').forEach((btn) => {
        btn.onclick = () => { btn.closest('.ligne-cote').remove(); modifie = true; };
      });
      zoneCotes.querySelectorAll('[data-medium-wrap]').forEach(brancherDropdownMedium);
    }
    rendreCotes(parserCotes(a.cotes));
    contenu.querySelector('#btn-ajouter-cote').addEventListener('click', () => {
      // Si message « Aucune cote… » présent, on le remplace par une vraie ligne.
      const aucune = zoneCotes.querySelector('.aide-champ');
      if (aucune) zoneCotes.innerHTML = '';
      zoneCotes.insertAdjacentHTML('beforeend', gabaritLigneCote());
      const nouvelle = zoneCotes.querySelector('.ligne-cote:last-child');
      if (nouvelle) {
        nouvelle.querySelectorAll('.btn-supprimer-ligne').forEach((btn) => {
          btn.onclick = () => { btn.closest('.ligne-cote').remove(); modifie = true; };
        });
        nouvelle.querySelectorAll('[data-medium-wrap]').forEach(brancherDropdownMedium);
      }
      modifie = true;
      const dernierPrix = zoneCotes.querySelector('.ligne-cote:last-child .cote-prix');
      if (dernierPrix) dernierPrix.focus();
    });

    form.addEventListener('input', () => { modifie = true; });
    form.addEventListener('change', () => { modifie = true; });

    brancherChangementPays(form, { paysNom: 'pays', subNom: 'province', subZoneId: 'zone-province-artiste' });

    // Auto-préfixe d'inventaire : 2 premières lettres du prénom + 1 du nom, en majuscules sans accents.
    // S'applique seulement tant que l'utilisateur n'a pas modifié le préfixe à la main.
    const elPrenom = form.elements.prenom;
    const elNom = form.elements.nom;
    const elPrefixe = form.elements.prefixe_inventaire;
    const calculerPrefixe = () => {
      const p = sansAccents(elPrenom?.value || '').toUpperCase();
      const n = sansAccents(elNom?.value || '').toUpperCase();
      const letters = (p.replace(/[^A-Z]/g, '').slice(0, 2)) + (n.replace(/[^A-Z]/g, '').slice(0, 1));
      return letters;
    };
    let prefixeAuto = !elPrefixe?.value || elPrefixe.value === calculerPrefixe();
    if (elPrefixe) {
      elPrefixe.addEventListener('input', () => {
        prefixeAuto = false;
      });
    }
    const majPrefixe = () => {
      if (!elPrefixe || !prefixeAuto) return;
      const nv = calculerPrefixe();
      if (nv !== elPrefixe.value) elPrefixe.value = nv;
    };
    if (elPrenom) elPrenom.addEventListener('input', majPrefixe);
    if (elNom)    elNom.addEventListener('input', majPrefixe);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);
      data.percoit_taxes = form.elements.percoit_taxes.checked;

      const lignesTaxes = Array.from(zoneTaxes.querySelectorAll('.ligne-taxe'))
        .map((l) => ({
          etiquette: l.querySelector('.champ-etiquette').value.trim(),
          numero: l.querySelector('.champ-numero').value.trim(),
        }))
        .filter((t) => t.numero);
      data.numeros_taxes = lignesTaxes.length ? JSON.stringify(lignesTaxes) : null;

      const lignesCotes = Array.from(zoneCotes.querySelectorAll('.ligne-cote'))
        .map((l) => ({
          medium: l.querySelector('.cote-medium').value.trim() || 'Tous',
          taille: l.querySelector('.cote-taille').value,
          unite: l.querySelector('.cote-unite').value,
          prix_pref: Number(l.querySelector('.cote-prix').value) || 0,
        }))
        .filter((c) => c.prix_pref > 0);
      data.cotes = lignesCotes.length ? JSON.stringify(lignesCotes) : null;

      const enchainerApresCreation = nouveau && e.submitter?.id === 'btn-creer-et-oeuvres';

      try {
        if (nouveau) {
          a = await window.api.artisteCreer(data);
          modifierParamsCourants({ id: a.id, nouveau: false });
        } else {
          a = await window.api.artisteModifier(a.id, data);
        }
        if (enchainerApresCreation) {
          leverGardien();
          remplacerCourant('oeuvre-fiche', {
            nouveau: true,
            artiste_id: a.id,
            enchainement: true,
            enchainement_compte: 0,
            enchainement_artiste_nom: nomComplet(a) || a.nom || '',
          });
          return;
        }
        sortirEdition();
      } catch (err) {
        await confirmer({
          type: 'error',
          title: "Impossible d'enregistrer",
          message: err.message,
          buttons: ['OK'],
        });
      }
    });

    contenu.querySelector('#btn-annuler').addEventListener('click', async () => {
      if (modifie || nouveau) {
        const reponse = await confirmer({
          type: 'warning',
          title: nouveau ? 'Abandonner ce nouvel artiste ?' : 'Abandonner les modifications ?',
          message: nouveau
            ? 'Les informations saisies seront perdues.'
            : 'Les modifications en cours seront perdues.',
          buttons: ['Abandonner', nouveau ? 'Continuer la saisie' : 'Continuer à modifier'],
          defaultId: 1,
          cancelId: 1,
        });
        if (reponse !== 0) return;
      }
      leverGardien();
      if (nouveau) {
        retour();
      } else {
        sortirEdition();
      }
    });
  }

  dessiner();
}
