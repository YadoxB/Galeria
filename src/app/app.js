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
import { rendreReglages } from './vues/reglages.js';
import { rafraichirEntete } from './marque.js';
import { formaterTelephone } from './commun.js';

enregistrer('accueil', rendreAccueil);
enregistrer('artistes-liste', rendreArtistesListe);
enregistrer('artiste-fiche', rendreArtisteFiche);
enregistrer('oeuvres-liste', rendreOeuvresListe);
enregistrer('oeuvre-fiche', rendreOeuvreFiche);
enregistrer('clients-liste', rendreClientsListe);
enregistrer('client-fiche', rendreClientFiche);
enregistrer('ventes-liste', rendreVentesListe);
enregistrer('vente-fiche', rendreVenteFiche);
enregistrer('reglages', rendreReglages);

document.getElementById('btn-retour').addEventListener('click', retour);
document.getElementById('btn-accueil-entete').addEventListener('click', () => remplacer('accueil'));

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
})();
