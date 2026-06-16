# Gabarits de documents — Galerie du Vieux Saint-Jean

Ce dossier contient les deux documents déjà approuvés, transformés en gabarits propres prêts à brancher dans l'application.

## Contenu du dossier

- `gabarit-certificat.html` : le certificat d'authenticité (format lettre, paysage).
- `gabarit-facture-artiste.html` : la facture artiste, avec calcul automatique (format lettre, portrait).
- `actifs/` : les éléments de marque partagés par les deux gabarits.
  - `garamond-regular.woff2`, `garamond-semibold.woff2`, `garamond-italic.woff2` : les polices.
  - `logo-gvsj.png` : le logo de la galerie.

## Pour les visualiser tout de suite

Ouvre l'un des deux fichiers `.html` dans un navigateur (en gardant le dossier `actifs` à côté). Le document s'affiche rempli avec des données d'exemple. Pour produire un PDF à la main, fais Imprimer (Ctrl+P), puis « Enregistrer au format PDF ». La bonne orientation est déjà réglée : paysage pour le certificat, portrait pour la facture.

## Comment c'est organisé

Chaque gabarit est séparé en deux parties :

1. **La présentation** : le document lui-même (HTML et CSS), avec sa mise en page, ses polices et son logo. C'est la partie qui ne change pas.
2. **Une seule fonction, `remplir(donnees)`** : l'application lui passe un objet de données, et elle remplit le document. Pour la facture, cette fonction calcule aussi tous les montants (prix de vente, cote, part de l'artiste, taxes, total).

Le détail exact des données attendues se trouve en commentaire en haut du `<script>` de chaque fichier, sous le titre « CONTRAT DE DONNÉES ».

## Comment l'application les utilise (résumé)

Dans l'app Electron, pour produire un document :

1. Charger le fichier de gabarit dans une fenêtre ou un cadre invisible.
2. Appeler `remplir(donnees)` avec les données tirées de la base.
3. Demander l'impression en PDF (Electron sait imprimer une page en PDF).

L'application remplace donc l'ancien formulaire de saisie : les données viennent de la base, plus personne ne tape dans le gabarit.

## À noter

- Les coordonnées de la galerie (bas de page, et bloc « Facturé à » de la facture) ainsi que le numéro de TPS sont pour l'instant écrits directement dans les gabarits. On pourra les rendre modifiables dans un écran de réglages plus tard.
- Les taxes de la facture sont activables et leurs taux modifiables, à valider avec le comptable.

## Message à donner à Claude Code

> Dans le projet, intègre les deux gabarits du dossier `gabarits` (`gabarit-certificat.html` et `gabarit-facture-artiste.html`) comme moteur de génération des documents PDF. Ne change ni la mise en page, ni le CSS, ni les polices, ni le logo : ce rendu est déjà approuvé. Chaque gabarit expose une fonction `remplir(donnees)` dont le format est décrit en commentaire en haut de son script. Branche-les ainsi : l'app charge le gabarit, appelle `remplir(donnees)` avec les données tirées de la base, puis exporte la page en PDF via le moteur d'Electron. Garde le dossier `actifs` à côté des gabarits pour que les polices et le logo se chargent. Présente-moi d'abord ta façon de faire en mots simples, puis attends mon accord avant de coder.
