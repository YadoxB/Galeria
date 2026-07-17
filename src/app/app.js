import { enregistrer, naviguer, remplacer, retour } from './router.js';
import { rendreAccueil } from './vues/accueil.js';
import { rendreArtistesListe } from './vues/artistes-liste.js';
import { rendreArtisteFiche } from './vues/artiste-fiche.js';
import { rendreOeuvresListe } from './vues/oeuvres-liste.js';
import { rendreOeuvreFiche } from './vues/oeuvre-fiche.js';
import { rendreClientsListe } from './vues/clients-liste.js';
import { rendreClientFiche } from './vues/client-fiche.js';
import { rendreVentesListe } from './vues/ventes-liste.js';
import { rendreVenteFiche } from './vues/vente-fiche.js';
import { rendreSuivi } from './vues/suivi.js';
import { rendreDocuments } from './vues/documents.js';
import { rendreRapport } from './vues/rapport.js';
import { rendreReglages } from './vues/reglages.js';
import { rendreProfilGalerie } from './vues/profil-galerie.js';
import { rendreOutils } from './vues/outils.js';
import { rafraichirEntete } from './marque.js';
import { formaterTelephone, nettoyerErreur } from './commun.js';
import { alerter } from './dialogue.js';
import { initialiserUpdater } from './updater.js';
import { initialiserAide } from './aide.js';
import { initialiserTutoriel } from './tutoriel.js';
import { proposerCatalogueLivreSiNouveau } from './catalogue-livraison.js';

enregistrer('accueil', rendreAccueil);
enregistrer('artistes-liste', rendreArtistesListe);
enregistrer('artiste-fiche', rendreArtisteFiche);
enregistrer('oeuvres-liste', rendreOeuvresListe);
enregistrer('oeuvre-fiche', rendreOeuvreFiche);
enregistrer('clients-liste', rendreClientsListe);
enregistrer('client-fiche', rendreClientFiche);
enregistrer('ventes-liste', rendreVentesListe);
enregistrer('vente-fiche', rendreVenteFiche);
enregistrer('suivi', rendreSuivi);
enregistrer('documents', rendreDocuments);
enregistrer('rapport', rendreRapport);
enregistrer('reglages', rendreReglages);
enregistrer('profil-galerie', rendreProfilGalerie);
enregistrer('outils', rendreOutils);

document.getElementById('btn-retour').addEventListener('click', retour);
document.getElementById('logo-galeria').addEventListener('click', () => remplacer('accueil'));

// Câblage des entrées du menu de la sidebar (data-vue → naviguer)
document.querySelectorAll('#barre-laterale .entree-sidebar[data-vue]').forEach((btn) => {
  btn.addEventListener('click', () => naviguer(btn.dataset.vue));
});

// Profil galerie (clic sur le bloc en bas de la sidebar)
document.getElementById('btn-profil-galerie').addEventListener('click', () => naviguer('profil-galerie'));

// Formatage automatique du téléphone (xxx) xxx-xxxx au fil de la frappe.
// Délégation globale : couvre tous les input[type=tel], existants et futurs.
document.addEventListener('input', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  if (t.type !== 'tel') return;
  const formatte = formaterTelephone(t.value);
  if (formatte !== t.value) {
    t.value = formatte;
    // Curseur en fin de champ après reformatage
    t.setSelectionRange(formatte.length, formatte.length);
  }
});

// Filet global : toute erreur imprévue (promesse rejetée hors try/catch,
// exception dans un gestionnaire d'événement) affiche le dialogue d'erreur
// standard, au lieu d'un clic qui ne fait rien. Une seule alerte par tranche
// de 5 s pour qu'une erreur en boucle ne submerge pas l'utilisateur.
let dernierFiletMs = 0;
function filetErreur(raison) {
  console.error('Erreur imprévue :', raison);
  const maintenant = Date.now();
  if (maintenant - dernierFiletMs < 5000) return;
  dernierFiletMs = maintenant;
  alerter({
    type: 'error',
    title: 'Erreur imprévue',
    message: "L'opération en cours n'a pas pu être terminée.",
    detail: nettoyerErreur(raison),
  });
}
window.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  filetErreur(e.reason);
});
window.addEventListener('error', (e) => {
  filetErreur(e.error || e.message);
});

// Alertes du système de sauvegarde (émises par le processus principal
// seulement quand l'état change : échec, repli sur le dossier par défaut,
// retour à la normale).
window.api.onBackupAlerte((a) => {
  alerter({ type: a.niveau || 'warning', title: a.titre || 'Sauvegardes', message: a.message || '' });
});

(async () => {
  // L'entête est cosmétique : son échec ne doit pas empêcher l'accueil de s'afficher.
  await rafraichirEntete().catch((err) => console.error('Entête non rafraîchie :', err));
  await remplacer('accueil');
  await proposerCatalogueLivreSiNouveau();
  initialiserUpdater();
  initialiserAide();
  initialiserTutoriel();
})().catch(filetErreur);
