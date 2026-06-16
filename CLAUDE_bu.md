# Dossier de projet : application de gestion pour la Galerie du Vieux Saint-Jean

> À conserver à la racine du projet sous le nom `CLAUDE.md` pour que Claude Code le relise à chaque session.

---

## 1. Le projet en une phrase

Une application Windows locale, simple et soignée, qui permet aux propriétaires de la galerie de gérer leurs artistes et leurs œuvres, d'enregistrer une vente, et de produire automatiquement trois documents (certificat d'authenticité, lettre de remerciement, facture).

## 2. Qui l'utilise

Les propriétaires de la galerie, qui ne sont pas familiers avec l'informatique. L'interface doit être en français, claire, avec de gros boutons évidents et le moins de jargon possible. On vise « ça marche du premier coup sans manuel ».

## 3. Principes directeurs

- **Tout est local.** Aucune donnée ne quitte l'ordinateur. C'est un choix volontaire pour respecter la Loi 25 du Québec et protéger les renseignements des clients et des artistes.
- **Une seule source de vérité.** L'application est la référence pour le catalogue et les ventes. On importe une fois les données existantes, puis on travaille uniquement dans l'app.
- **Ne jamais écrire directement dans la base de Sage 50.** On passe seulement par les canaux officiels (fichier d'import et lecture ODBC). Voir la section 8.
- **Simple et beau avant tout.** Une fonction de moins, mieux faite, vaut mieux qu'une fonction de plus mal fichue.
- **Sauvegardes systématiques.** Le fichier de base doit être copié automatiquement à intervalle régulier dans un dossier de sauvegarde local.

## 4. Pile technique recommandée

Tu peux proposer une alternative si tu juges qu'il y a mieux, mais voici la direction par défaut, choisie pour la facilité de maintenance et la qualité visuelle :

- **Application de bureau :** Electron (interface en HTML/CSS, packagée en installateur Windows `.exe`).
- **Base de données :** SQLite, un seul fichier local.
- **Documents PDF :** générés à partir de gabarits HTML stylisés, rendus en PDF par le moteur intégré d'Electron.
- **Langue de l'interface :** français.

## 5. Modèle de données

Quatre tables, inspirées de la base Airtable déjà construite. Les noms de champs peuvent être ajustés.

**Artistes**
- Nom de l'artiste
- Biographie, démarche, curriculum (texte ou fichiers joints)
- Photo
- Coordonnées (optionnel)
- Notes

**Œuvres**
- Titre (avec accents)
- Artiste (lien vers la table Artistes)
- Numéro d'inventaire
- Dimensions
- Médium et support (souvent vides, laisser facultatifs)
- Année (souvent vide)
- Prix
- Statut (disponible, réservé, vendu)
- Description
- Image
- Emplacement ou code interne

**Clients**
- Nom
- Adresse
- Courriel
- Téléphone
- Consentement à être contacté par courriel (oui/non et date)
- Notes

**Ventes**
- Œuvre vendue (lien)
- Client (lien)
- Date de la vente
- Prix de vente
- Taxes (TPS et TVQ)
- Mode de paiement
- Numéro de facture
- Documents générés (liens vers les PDF produits)
- Statut d'export vers Sage 50

## 6. Les documents

Chaque document est un PDF généré à partir des données de l'app, à l'identité visuelle de la galerie (logo, mise en page Garamond et accent doré, déjà établis). Deux gabarits ont déjà été conçus et approuvés lors d'une session précédente, et servent de point de départ. Leurs fichiers d'origine (gabarit, logo, polices) doivent être remis à Claude Code pour reproduire le rendu exact.

**Documents déjà conçus (à reprendre)**

- **Certificat d'authenticité.** Gabarit HTML rendu en PDF, format lettre, cadre doré, police Garamond. Champs : type d'œuvre (peintre, sculpteur ou reproduction, avec un texte d'attestation adapté), titre, artiste, année, médium, support, dimensions, signature, particularité, valeur, numéro de délivrance, date de délivrance, photo de l'œuvre.
- **Facture artiste (relevé de versement à l'artiste).** Document de consignation qui calcule automatiquement ce que la galerie verse à l'artiste après sa commission. Champs : numéro, date, artiste (nom, raison sociale, adresse, téléphone, courriel), œuvre (titre, numéro d'inventaire, format), mode de paiement, commentaire, prix régulier, rabais artiste, rabais galerie, cote (pourcentage de commission), et taxes (TPS et TVQ activables, taux modifiables). Calculs automatiques : prix de vente, montant de la cote, part de l'artiste, taxes et total.

**Documents à bâtir ensuite**

- **Facture client.** À concevoir une fois qu'un exemple sera disponible.
- **Lettre de remerciement.** Nom du client, mention de l'œuvre achetée, ton chaleureux, signature de la galerie.

> Reprise des gabarits : conçus à l'origine comme outils autonomes (un script pour le certificat, un outil HTML interactif pour la facture artiste), leur HTML et leur CSS se transposent directement dans l'app Electron. On garde la mise en page et le style, et l'app fournit les données à la place des formulaires de saisie.

> Note sur les taxes : le traitement fiscal varie selon l'artiste et la province. Les taux et l'application de la taxe restent configurables, à valider avec le comptable de la galerie.

## 7. Construction par phases

On construit et on teste une phase à la fois. Chaque phase doit être fonctionnelle et vérifiée avant de passer à la suivante.

**Portée actuelle : phases 1 à 3 (le logiciel de gestion).** La phase 4, qui touche la comptabilité et Sage 50, est reportée à plus tard, une fois le logiciel de gestion en service.

**Phase 1 : Fondations**
Mettre en place l'application Electron, la base SQLite locale, un écran d'accueil, et l'import des données existantes exportées d'Airtable (en CSV ou JSON). Activer la sauvegarde automatique du fichier de base.

**Phase 2 : Catalogue**
Gestion des artistes et des œuvres : liste, recherche, fiche détaillée, ajout, modification, gestion des photos. Interface claire et agréable.

**Phase 3 : Ventes et documents**
Enregistrer une vente (choisir une œuvre, choisir ou créer un client, saisir le prix et les taxes), générer les documents en PDF en commençant par les deux gabarits déjà conçus (certificat d'authenticité et facture artiste), marquer l'œuvre comme vendue, et conserver un historique des ventes. La facture client et la lettre de remerciement s'ajoutent ensuite.

**Phase 4 : Pont avec Sage 50 (reportée à plus tard)**
À aborder seulement une fois le logiciel de gestion en service. Première étape : déterminer comment Sage 50 est configuré chez eux (inventaire par œuvre, ou suivi de ventes seulement). Ensuite seulement : produire un fichier d'import des ventes vers Sage, et lire l'inventaire depuis Sage en lecture seule.

## 8. Règles pour Sage 50

- Ne jamais modifier ni écrire dans la base de données de Sage par l'extérieur. Risque de corruption des données comptables et de perte du support.
- Sens application vers Sage : générer un fichier d'import au format que Sage 50 sait lire, que les propriétaires importent eux-mêmes en une étape.
- Sens Sage vers application : lecture seule des données d'inventaire via la connexion ODBC de Sage, pour affichage uniquement.
- Version installée à la galerie : Sage 50 Comptabilité Pro, Édition Canadienne, Lancement 2026.1. Vérifier les options de connexion (ODBC, import/export) propres à l'édition Pro avant de coder le pont.

## 9. Loi 25 et protection des données

- Toutes les données restent sur l'ordinateur, sans service en nuage.
- Sauvegardes automatiques locales du fichier de base.
- Possibilité de consulter, modifier et supprimer la fiche d'un client sur demande.
- Suivi du consentement avant tout envoi de courriel (invitations aux vernissages, etc.).
- Les factures contiennent des renseignements personnels et doivent être conservées pour la comptabilité selon les délais applicables, à valider avec le comptable.

## 10. Comment travailler avec Claude Code

Conseils pour bien diriger la construction, même sans connaître la programmation :

- Garder ce dossier à la racine du projet sous `CLAUDE.md`. Demander à Claude Code de le relire au début de chaque session.
- Avancer une phase à la fois. Demander à Claude Code de présenter son plan et de le faire valider avant d'écrire du code.
- Tester après chaque phase. Décrire les problèmes en mots simples, par exemple « quand je clique sur Enregistrer, rien ne se passe ».
- Demander que l'interface reste en français.
- En cas de blocage, demander à Claude Code d'expliquer simplement et de proposer deux ou trois options.
- Ne jamais coller de mots de passe ou de clés dans le code. Les données restent locales.

## 11. Premier message à donner à Claude Code

> Je veux bâtir une application Windows locale pour gérer une galerie d'art. Lis le fichier `CLAUDE.md` à la racine du projet, il contient tout le contexte. Commençons par la Phase 1 seulement : mets en place une application Electron avec une base SQLite locale, un écran d'accueil simple en français, et la sauvegarde automatique du fichier de base. Présente-moi d'abord ton plan en mots simples, puis attends mon accord avant de coder.
