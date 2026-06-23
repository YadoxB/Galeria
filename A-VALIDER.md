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

- ~~**Commission galerie selon type d'œuvre**~~ ✓ **Tranché (Dave, 2026-06-19)** : **Peinture 50 %**, **Sculpture 33 %**, **Reproduction 50 % après déduction des frais de production**. Pour la reproduction, **la galerie récupère ses frais de production en premier**, puis 50/50 sur le net : *Galerie = frais + 50 % du net · Artiste = 50 % du net* (net = prix de vente − frais). Le **type d'œuvre est pré-rempli depuis `artiste.type`** (peintre→Peinture, sculpteur→Sculpture), modifiable. Implémenté dans le **calculateur de commission** (Lot 1, `demos/calculateur-commission.html`). **Reste à confirmer** :
  - Y a-t-il d'autres types d'œuvre que Peinture / Sculpture / Reproduction (avec un % différent) ?
  - Pour les reproductions : où saisir les frais de production de façon persistante (fiche œuvre ? lors de la vente ?) pour les rapatrier dans la facture artiste. *(Dans le calculateur, ils sont tapés à la main pour l'instant.)*

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

## Nomenclature des numéros et des fichiers (✓ tranché et implémenté — 2026-06-23)

> **Recensement fait le 2026-06-20**, **décision prise et appliquée le 2026-06-23**
> (voir l'encadré « ✓ Tranché » plus bas). Le recensement ci-dessous est conservé
> à titre d'historique.

**Documents produits — numéro + nom de fichier actuel + dossier :**

| Document | Numéro | Nom de fichier actuel | Dossier |
|---|---|---|---|
| Certificat d'authenticité | `C-2026-NNN` | `Certificat_{numéro}_{titre-slug}.pdf` | `…\{année}\Certificats\` (ou dans la pochette) |
| Facture artiste | `A-2026-NNN` | `FactureArtiste_{numéro}_{artiste-slug}.pdf` | `…\{année}\Factures artiste\` |
| Facture client | `F-2026-NNN` | *non produite (Phase 3D)* | — |
| Catalogue d'artiste | — | `Catalogue_{artiste-slug}_{horodatage}.pdf` | `…\{année}\Catalogues\` |
| Annexe A (dépôt/retrait) | `A-{préfixe}-NNN` (par artiste) | `Annexe_{Depot\|Retrait}_{numéro}_{artiste-slug}.pdf` | `…\{année}\Annexes\` |
| Présentation d'artiste | — | `Presentation_{artiste-slug}_{horodatage}.pdf` | `…\{année}\Présentations\` |
| Rapport journalier | — | `Rapport_{date}_{horodatage}.pdf` | `…\{année}\Rapports\` |

**Pochette de vente** — dossier `…\{année}\Pochettes\{client}\{facture}\` : `Lettre de remerciement - {client}.pdf`, `Certificat_{numéro}_{titre}.pdf`, `Présentation de l'artiste - {artiste}.pdf`, `Guide de l'acheteur.pdf` (fixe).

**« Version modifiée »** : même dossier, suffixe `_modifie(e)` + horodatage.

### ✓ Tranché (Dave, 2026-06-23) — implémenté dans `src/pdf.js`

**Style retenu : « Lisible français »** — un seul gabarit pour tous les
documents : **`Type Numéro — Entité.pdf`**, accents et espaces conservés,
tiret cadratin ` — ` entre les parties, entité du certificat entre
parenthèses (`titre (artiste)`).

| Document | Nom de fichier |
|---|---|
| Certificat | `Certificat C-2026-001 — Le verger (Marie Tremblay).pdf` |
| Facture artiste | `Facture artiste A-2026-005 — Marie Tremblay.pdf` |
| Facture client | `Facture client F-2026-012 — Jean Dupont.pdf` |
| Catalogue | `Catalogue 2026-06-23 — Marie Tremblay.pdf` |
| Annexe dépôt/retrait | `Annexe dépôt A-MTR-003 — Marie Tremblay.pdf` |
| Présentation | `Présentation — Marie Tremblay.pdf` |
| Rapport | `Rapport 2026-06-23.pdf` |
| Pochette (lettre) | `Lettre de remerciement — Jean Dupont.pdf` |
| Version modifiée | `…même nom… (version modifiée 2026-06-23).pdf` |

- **Numéros : continu** — les compteurs ne se remettent jamais à zéro
  (c'était déjà le comportement ; l'année est figée dans le préfixe,
  modifiable dans les Réglages). Format préfixe + zéro-padding 3 chiffres.
- **Préfixes (2026-06-23)** : facture artiste **`FA-2026`**, facture client
  **`FC-2026`** (migration douce des configs au défaut historique). Annexes
  **`AD-`** (dépôt) / **`AR-`** (retrait).
- **Documents sans numéro restent datés** (catalogue, présentation,
  rapport) — instantanés régénérables, pas de compteur.
- **Numéro de certificat (2026-06-23)** : refonte complète. Format
  **`{n° inventaire}-{séquentiel par artiste}-{n° Sage}`**
  (ex. `MTR1042-003-5567`, **sans année**). **Séquentiel propre à l'artiste**
  (compte ses certificats). **N° de facture Sage requis** — saisi à la main
  sur la vente / via une invite avant de produire le certificat ; **bloque**
  la production si absent. Le n° de facture **vient de Sage** (Phase 4) ;
  pour l'instant saisie manuelle. **Facture client FC** : rôle vis-à-vis de
  Sage à trancher en Phase 3D/4. Anciens certificats `C-2026-NNN` non
  renumérotés ; compteur global `C-2026` retiré pour les certificats.
  **Nom de fichier daté** :
  `Certificat {n° inventaire} — titre (artiste) {AAAA-MM-JJ}.pdf`
  (numéro complet dans le PDF ; doublon le même jour → suffixe « (2) »,
  plusieurs certificats possibles par œuvre).
- **Version modifiée** : suffixe unique ` (version modifiée AAAA-MM-JJ)`,
  désambiguïsé en ` (2)` si besoin — ne peut plus écraser un document édité
  à la main.
- **Caractères interdits Windows** (`: / \ | ? * " < >`) nettoyés en gardant
  accents/espaces/parenthèses.
- **Incohérences résolues** : un seul style (les anciens `PascalCase_underscore`
  et les noms de pochette « - » convergent) ; suffixe `_modifie`/`_modifiee`
  unifié. La section Documents reste **tolérante aux anciens noms** déjà sur
  le disque (aucun renommage rétroactif).

> La **formule des images d'inventaire** apportée par Dave concernait en fait
> le **nommage des photos d'œuvres** (déjà codé dans `src/db/nomenclature.js`,
> Jalon 5), pas les documents. Une divergence y a été corrigée au passage :
> les mots du titre sont joints par **underscore** (`Sault_en_Provence`) et
> non par tiret.

**À confirmer par Dave (en lançant l'app)** : générer un de chaque document
et vérifier les noms produits dans `Documents\Galeria\Documents\{année}\`.

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
- **Dimensions incomplètes** (2026-06-18) : une H/L/P manquante est laissée **NULL** (« inconnu »), pas 0 — à la migration comme à la saisie.
- **Statut de paiement** (2026-06-18) : reste à **3 choix** (À faire / Partiel / Reçu) ; « Partiel » couvre un plan en cours. Le suivi détaillé des versements échelonnés reste un chantier séparé (voir « Modes de paiement » plus haut).
- **Extrants = retraits** (2026-06-18) : « retirer » une œuvre = la rendre à l'artiste (la sortir du catalogue actif), distinct d'une vente. « Retirer » remplace « Archiver » sur l'œuvre. Vendue = non retirable.
- **Documents générés en format Lettre** (8.5×11) — standard pour tous les documents.
- **Tableau de bord** (2026-06-18) : « Résumé du catalogue » (valeur cumulée) retiré au profit d'« Œuvres en préparation ».
