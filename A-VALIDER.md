# À valider avec les parents (Joanne et son équipe)

> Liste vivante des questions que Galeria laisse en suspens. Au fur et à mesure
> que des décisions sont prises pendant une session avec les parents, on les
> reporte ici comme « ✓ Tranché » avec la décision retenue, puis on retire la
> question de la liste active.

---

## Cotes & calcul de prix (jalon 2)

### En attente de validation

- ~~**Formule du prix courant.**~~ ✓ **Tranché (Dave, 2026-06-17)** : le **2 $ s'ajoute à la cote elle-même**, pas au prix final. Donc `prix_courant = (prix_pref + 2) × base`. Sur une cote en $/po linéaire, ça revient au même qu'un supplément de 2 × (H+L). Sur une cote en $/po², l'écart se creuse rapidement avec la surface. À reconfirmer avec les parents pour les cotes en pouces carrés.

- **Unité par défaut.** L'objectif à long terme est de convertir tout le monde aux pouces linéaires. Pour l'instant chaque cote peut être en linéaire ou en carré (paramètre par cote). À confirmer :
  - Y a-t-il une liste d'artistes qui passent au linéaire bientôt ? On peut prévoir un outil de conversion.
  - Le « 2 $/po de plus » s'applique-t-il pour les cotes en pouces carrés aussi, ou est-ce spécifique au linéaire ?

- **Cotes par médium.** Pour les artistes avec variation (ex. acrylique vs encaustique), faut-il une liste fermée de médiums ou laisser libre ? Si liste fermée, laquelle ?

- **« Cote hors-normes ».** Quand on coche ce statut sur une œuvre, le prix est saisi à la main. Doit-on aussi :
  - Marquer cette œuvre dans les rapports / catalogues pour la distinguer ?
  - Apparaître dans une liste à part « Œuvres à cotation spéciale » ?

- **Catégories de format (Petit / Moyen / Grand / Très grand).** Galeria calcule la catégorie automatiquement à partir des dimensions. Seuils empiriques actuels :
  - Petit ≤ 16", Moyen ≤ 30", Grand ≤ 42", Très grand > 42" (sur √(H × L))
  - À confirmer avec les parents.

---

## Phase 3D — Documents complémentaires

- **Facture client** : besoin d'un exemple ou d'un gabarit existant.
- **Lettre de remerciement** : variantes selon méthode d'achat (web, en personne, cadeau, etc.) → besoin des textes.
- **Présentation artiste PDF** : besoin de précisions sur la mise en page voulue (plusieurs pages, élégant). Y a-t-il un gabarit visuel existant ?

## Modèle économique

- **Commission galerie selon type d'œuvre** : 50 % toiles, 33 % sculptures, 50 % reproductions après déduction des coûts de production. À confirmer :
  - La liste complète des « types d'œuvre » et le pourcentage applicable à chacun.
  - Pour les reproductions : où sont saisis les coûts de production ? Sur la fiche œuvre, lors de la vente ?

- **Modes de paiement complexes** : payer maintenant / payer plus tard / paiements échelonnés mensuels sur 12 mois. À confirmer :
  - L'app doit-elle traquer les versements mensuels (rappels, statut de chaque versement) ou juste les noter ?
  - Y a-t-il d'autres modes (chèque, virement, comptant, carte, etc.) ?

- **Taxes par client (profil fiscal)** : pour les clients étrangers en ligne. À confirmer :
  - Liste des pays / régions exemptés ou avec taux différents.
  - Politique en place pour les ventes à l'international.

## Suivi cycle de vie

- **Statuts post-vente** : Galeria veut tracker paiement / emballage / envoi / livraison. À confirmer :
  - Liste exacte des étapes que les parents veulent voir.
  - Quels statuts sont visibles aux clients (par exemple si on veut les notifier) ?

## Nomenclature des numéros

- **Format final** des numéros de factures, certificats, inventaires. À confirmer avec les parents :
  - Préfixe et zéro-padding voulu (ex. F-2026-001 ou autre format).
  - Numérotation par année qui repart à 1 chaque janvier, ou continue ?

## Intégrations externes

- **Synchronisation site web** : pull des descriptions depuis le site WooCommerce.
  - URL du site : galerievieuxstjean.com → confirmé.
  - Plugin REST API exposé ? Authentification ?
  - Champs à pull : description, image principale, statut (publié/brouillon).

- **Ouverture automatique de Sage** après une vente.
  - Chemin de l'exécutable Sage sur la machine des parents.
  - Voir si Sage accepte des arguments en ligne de commande pour pré-remplir une transaction.

## Préférences UI

- **Dimensions de fenêtre** : confirmer la résolution du moniteur des parents. Actuellement 1600×900, à ajuster si nécessaire.
- **Zoom UI** : tester les niveaux pour voir lequel est le plus confortable.
- **Signataire du certificat** : actuellement champ libre dans Réglages. Confirmer si toujours « Joanne Boucher, Galeriste » ou variantes.

---

## Décisions déjà tranchées

> À ajouter au fur et à mesure pour garder la trace.

- Migration auto du dossier `GalerieApp` vers `Galeria` au démarrage.
- Distinction Galeria (produit) / Galerie du Vieux Saint-Jean (marque).
- Tout est local, Loi 25 respectée.
- Auto-update via GitHub Releases (v0.2.1+).
