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
import { rendreReglages } from './vues/reglages.js';
import { rendreProfilGalerie } from './vues/profil-galerie.js';
import { rendreOutils } from './vues/outils.js';
import { rafraichirEntete } from './marque.js';
import { formaterTelephone } from './commun.js';
import { initialiserUpdater } from './updater.js';

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

(async () => {
  await rafraichirEntete();
  await remplacer('accueil');
  initialiserUpdater();
})();
