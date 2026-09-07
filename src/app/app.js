import { enregistrer, naviguer, remplacer, retour, routeCourante } from './router.js';
import { rendreAccueil } from './vues/accueil.js';
import { rendreArtistesListe } from './vues/artistes-liste.js';
import { rendreArtisteFiche } from './vues/artiste-fiche.js';
import { rendreOeuvresListe } from './vues/oeuvres-liste.js';
import { rendreExpositionsListe } from './vues/expositions-liste.js';
import { rendreExpositionFiche } from './vues/exposition-fiche.js';
import { rendreOeuvreFiche } from './vues/oeuvre-fiche.js';
import { rendreClientsListe } from './vues/clients-liste.js';
import { rendreClientFiche } from './vues/client-fiche.js';
import { rendreVentesListe } from './vues/ventes-liste.js';
import { rendreVenteFiche } from './vues/vente-fiche.js';
import { rendreSuivi } from './vues/suivi.js';
import { rendreDocuments } from './vues/documents.js';
import { rendreRapport } from './vues/rapport.js';
import { rendreReglages } from './vues/reglages.js';
import { rendreOutils } from './vues/outils.js';
import { rendreWebSync } from './vues/web-sync.js';
import { rendreWebSyncArtistes } from './vues/web-sync-artistes.js';
import { rafraichirEntete } from './marque.js';
import { formaterTelephone, nettoyerErreur } from './commun.js';
import { alerter } from './dialogue.js';
import { initialiserUpdater } from './updater.js';
import { initialiserAide } from './aide.js';
import { initialiserTutoriel } from './tutoriel.js';
import { initialiserNouveautes } from './nouveautes.js';
import { proposerCatalogueLivreSiNouveau } from './catalogue-livraison.js';
import { initialiserVerrou } from './verrou.js';

enregistrer('accueil', rendreAccueil);
enregistrer('artistes-liste', rendreArtistesListe);
enregistrer('artiste-fiche', rendreArtisteFiche);
enregistrer('oeuvres-liste', rendreOeuvresListe);
enregistrer('expositions-liste', rendreExpositionsListe);
enregistrer('exposition-fiche', rendreExpositionFiche);
enregistrer('oeuvre-fiche', rendreOeuvreFiche);
enregistrer('clients-liste', rendreClientsListe);
enregistrer('client-fiche', rendreClientFiche);
enregistrer('ventes-liste', rendreVentesListe);
enregistrer('vente-fiche', rendreVenteFiche);
enregistrer('suivi', rendreSuivi);
enregistrer('documents', rendreDocuments);
enregistrer('rapport', rendreRapport);
enregistrer('reglages', rendreReglages);
// Le Profil de la galerie a été fondu dans les Réglages (catégorie « La galerie »).
// On redirige l'ancienne route pour ne casser aucun lien existant.
enregistrer('profil-galerie', (contenu) => rendreReglages(contenu, { categorie: 'galerie' }));
enregistrer('outils', rendreOutils);
enregistrer('web-sync', rendreWebSync);
enregistrer('web-sync-artistes', rendreWebSyncArtistes);

document.getElementById('btn-retour').addEventListener('click', retour);
document.getElementById('logo-galeria').addEventListener('click', () => remplacer('accueil'));

// Câblage des entrées du menu de la sidebar (data-vue → naviguer)
document.querySelectorAll('#barre-laterale .entree-sidebar[data-vue]').forEach((btn) => {
  btn.addEventListener('click', () => naviguer(btn.dataset.vue));
});

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

// ⚠ Consigner passe AVANT l'affichage, et n'est PAS soumis à la limite des
// 5 secondes : le dialogue est là pour l'utilisateur, le journal pour celui
// qui devra comprendre. Tant que ces erreurs ne partaient qu'à la console de
// développement, un signalement de problème ne contenait rien d'exploitable —
// c'est ce qui a rendu invisible le défaut de « Reprendre la valeur du site »
// (2026-09-07). La pile compte plus que le message : « Cannot set properties
// of null » ne dit rien, la ligne où ça casse dit tout.
function journaliser(raison) {
  try {
    const r = routeCourante();
    window.api.journaliserErreurInterface({
      ecran: r ? (r.id != null ? `${r.nom} #${r.id}` : r.nom) : null,
      message: String((raison && raison.message) || raison || ''),
      pile: raison && raison.stack ? String(raison.stack) : null,
    });
  } catch {
    // Un filet d'erreur qui lève une erreur ne servirait à personne.
  }
}

function filetErreur(raison) {
  console.error('Erreur imprévue :', raison);
  journaliser(raison);
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
  // Verrou léger : verrouille immédiatement si activé, avant tout affichage.
  await initialiserVerrou();
  // L'entête est cosmétique : son échec ne doit pas empêcher l'accueil de s'afficher.
  await rafraichirEntete().catch((err) => console.error('Entête non rafraîchie :', err));
  await remplacer('accueil');
  await proposerCatalogueLivreSiNouveau();
  initialiserUpdater();
  initialiserAide();
  // Premier lancement = tutoriel de bienvenue jamais vu. À déterminer AVANT que le
  // tutoriel ne pose son marqueur, pour ne pas superposer « Quoi de neuf » par-dessus.
  const cfgDebut = await window.api.configGet().catch(() => null);
  const premierLancement = !(cfgDebut && cfgDebut.tutoriel_vu);
  initialiserTutoriel();
  initialiserNouveautes({ premierLancement });
})().catch(filetErreur);
