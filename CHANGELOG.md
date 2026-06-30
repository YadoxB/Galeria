# Journal des versions

Le format suit librement [Keep a Changelog](https://keepachangelog.com/fr/) :
**Ajouté** pour les nouvelles fonctionnalités, **Modifié** pour les
changements de comportement, **Corrigé** pour les bugs, **Retiré** pour
les suppressions, **Sécurité** pour ce qui touche aux données ou aux
identifiants.

---

## [Non publié]

### Sécurité

- **Verrou léger de l'application (volet 1 de la phase Sécurité).** Code court
  (NIP de 4 à 6 chiffres) demandé à l'ouverture et/ou après une période
  d'inactivité, pour empêcher une personne de passage de consulter les fiches
  clients. **Le code n'est jamais conservé en clair** : seule une empreinte
  **scrypt salée** (sel aléatoire de 16 octets) est enregistrée dans la config,
  comparée à **temps constant** (`crypto.timingSafeEqual`) ; la vérification vit
  dans le processus principal (`src/securite.js`) et l'empreinte est **retirée
  de `config:get`** (jamais exposée au renderer). Écran de verrouillage plein
  cadre avec pavé numérique (`src/app/verrou.js`), verrouillage **au démarrage**,
  sur **inactivité** (délai réglable : jamais / 5 / 10 / 15 / 30 min, minuterie
  réarmée à chaque activité) et, en option, à la **perte de focus** de la
  fenêtre. Nouvelle carte **Réglages → Sécurité** (définir/retirer le code,
  activer le verrou, choisir le délai). L'app derrière l'écran est rendue
  `inert` pendant le verrouillage. Nouveaux IPC `securite:*`, défauts de config
  `securite.*`. Démo `demos/verrou-securite.html`. Tests unitaires du module
  (hachage, sel aléatoire, rejet, options). **Note :** barrière d'accès, pas du
  chiffrement — la base reste lisible sur le disque (volet 2 à venir :
  chiffrement du fichier au repos via safeStorage/DPAPI + BitLocker). ⚠️ Écran
  non vérifié visuellement par Claude (la fenêtre Electron de dev n'est pas
  captée) — **à confirmer par Dave dans l'app**.

---

## [0.9.0] — 2026-06-30

> **Confirmé par Dave dans l'app.** Ajoute la prise en compte des **frais de
> production des reproductions** sur la facture artiste.

### Ajouté

- **Reproductions — frais de production sur la facture artiste.** Nouveau champ
  **« Frais de production »** sur la fiche d'œuvre (carte Commerce), **affiché
  seulement quand le type est une reproduction / giclée**. Colonne
  `oeuvres.frais_production` (migration additive). Sur la **facture artiste**, la
  galerie récupère ces frais **avant** la cote : deux lignes apparaissent
  (« Frais de production » déduits, « Net après frais »), la cote s'applique au
  **net** (« Cote de la galerie (50 % du net) »), donc *artiste = net × (100 −
  cote)/100*. Déduction **bornée au type reproduction** (une valeur résiduelle
  sur un autre type est ignorée) ; sans frais, la facture est **identique** à
  avant. S'applique à la génération et à la « version modifiée ». Démo
  `demos/facture-artiste-frais-repro.html`.

---

## [0.8.0] — 2026-06-30

> Affine la génération IA : consignes de rédaction par artiste, set global
> éditable dans les Réglages, et descriptions bilingues français + anglais.
> Distribué par auto-update (≥ 0.2.1) ; inactif sans clé API.

### Ajouté

- **Consignes IA par artiste + set global de la galerie** (d'après
  `gabarits/Consignes-IA-descriptions-oeuvres.md`). Le **set global** (voix,
  ancrage factuel strict, langue et format bilingue, ouverture « Œuvre
  originale. », règles d'écriture — pas de tiret cadratin, pas de « ce n'est pas
  X, c'est Y », pas de clichés) est la **valeur par défaut du champ éditable**
  « Consignes générales de la galerie » (Réglages → IA) : **modifiable dans
  l'app**, empaqueté dans le build (défaut dans `config.js`), et appliqué aux
  configs existantes par une migration unique (`consignes_galerie_init`, sans
  écraser un champ déjà personnalisé ni la clé). Les **consignes par artiste**
  (19) sont écrites dans `artistes.instructions_ia` (script
  `scripts/appliquer-consignes-ia.js`, qui parse le document, sauvegarde la base
  et apparie par nom ; modifiables sur la fiche artiste) — elles suivront aux
  parents via `npm run build:catalogue`.

### Modifié

- **Génération des descriptions** : la **langue et le format** (bilingue
  français puis anglais par défaut) et les règles d'écriture sont **pilotés par
  les consignes éditables** (champ galerie + consignes artiste), pas figés dans
  le code. `assemblerPromptIA` injecte ces consignes et le prompt système de
  `src/ia.js` reste minimal (il y défère). `max_tokens` relevé (800 → 1500) pour
  les deux versions. Le champ Description n'apparaissant dans aucun document PDF
  (vérifié), le bilingue ne touche pas les documents français. S'applique aussi
  au flux « Copier pour ChatGPT » (même assemblage).

---

## [0.7.0] — 2026-06-30

> **Confirmé par Dave dans l'app.** Ajoute la **génération des descriptions
> d'œuvres par IA (Claude)**. Distribué par auto-update (≥ 0.2.1), mais
> **inactif sans clé** : aucun utilisateur ne génère ni ne dépense tant qu'une
> clé API n'est pas saisie dans Réglages → IA.

### Ajouté

- **Génération des descriptions d'œuvres par IA (Claude)** — sur la fiche
  d'œuvre (création + édition), un bouton **« Générer la description »** envoie
  la **photo de l'œuvre** + les consignes assemblées (galerie + artiste +
  caractéristiques + description actuelle, via `assemblerPromptIA`) au modèle
  **`claude-haiku-4-5`** (vision) et **remplit le champ Description** (à relire
  avant d'enregistrer). « Copier pour ChatGPT » reste comme repli hors-ligne.
  Module `src/ia.js` (dépendance `@anthropic-ai/sdk`, requise paresseusement) ;
  IPC `ia:generer-description` / `…-inline`.
- **Clé API Anthropic dans Réglages → IA** — champ de saisie masqué + statut
  « Clé définie ✓ ». La clé est **chiffrée dans le coffre de Windows**
  (`safeStorage` / DPAPI, liée à la session) et rangée chiffrée dans
  `config.json` — **jamais en clair, jamais dans le code, jamais incluse dans un
  build**. Déchiffrée seulement au moment de l'appel. IPC `ia:definir-cle` /
  `ia:effacer-cle` / `ia:cle-definie`.
- **Loi 25** : seules des **données de catalogue** (image + caractéristiques de
  l'œuvre) sont envoyées à l'API ; **aucune donnée client**. La fonction est
  **optionnelle** — sans clé, l'app fonctionne comme avant (le bouton renvoie
  vers les Réglages). L'API Anthropic n'entraîne pas ses modèles sur les données
  d'API. Démo `demos/ia-generer-description.html`.

---

## [0.6.0] — 2026-06-30

> Inclut une **nouvelle fonctionnalité de l'app** (édition en lot des œuvres),
> qui rejoint donc les installations par auto-update (≥ 0.2.1), **plus** les
> améliorations de l'**installateur de livraison** (build catalogue) déjà
> faites après la 0.5.0. Les parents (sur 0.2.0) restent à rejoindre par
> installation manuelle d'un build catalogue.

### Ajouté

- **Édition en lot des œuvres** — sur la page Œuvres, un bouton **« Édition en
  lot »** ouvre un **tableur multi-lignes** où chaque cellule (n° inventaire,
  titre, année, type, médium, support, H/L/P, prix, statut, emplacement,
  exposition, style) se modifie directement. Deux modes complémentaires : édition
  cellule par cellule, et **« Appliquer à la sélection »** (cocher des lignes →
  poser une même valeur sur un champ pour toutes). Cellules/lignes modifiées
  surlignées ; remettre la valeur d'origine démarque automatiquement ; **barre
  « Enregistrer tout / Annuler »** (rien n'est écrit avant). Pastilles pour
  afficher/masquer des groupes de colonnes (Identité / Matériel / Commerce /
  Localisation). Enregistrement **transactionnel** via l'IPC `oeuvres:modifier-lot`
  (`modifierOeuvresLot`) : mise à jour **partielle** (seuls les champs changés),
  et **recalcul auto** du texte des dimensions + format/orientation quand H/L/P
  changent (mêmes règles que le formulaire d'une œuvre, l'override manuel du
  format est préservé). Garde-fous : titre non vidable, statut validé, colonnes
  hors-liste ignorées. Démo `demos/edition-batch.html` ; module
  `src/app/vues/oeuvres-batch.js`. ⚠️ **À confirmer par Dave dans l'app** (vérifié
  par Claude en banc d'essai navigateur + tests unitaires de la mutation, pas
  dans la fenêtre Electron).

- **Détection automatique du catalogue livré** — chaque build catalogue est
  tamponné (`meta.catalogue_id`). Au démarrage, si la base de l'utilisateur a un
  catalogue différent (ou aucun tampon, ex. base 0.2.0) et que ce catalogue n'a
  pas été refusé, l'app **propose de le charger** : sauvegarde de la base
  actuelle dans `Sauvegardes\`, remplacement par le catalogue livré, re-déballage
  des photos (barre du splash), puis **redémarrage**. Garde-fous : jamais
  d'écrasement silencieux ; le build public (auto-update) n'a pas de catalogue →
  aucune proposition ; un refus n'est pas reproposé.

### Modifié

- **Installateur (build catalogue)** — photos embarquées en **un seul paquet**
  (`seed/photos.pack`) déballé au 1er lancement avec progression (au lieu de
  poser 540 fichiers, ce qui gelait l'install/désinstall). Installateur
  **assisté**, **en français** (`installerLanguages: ["fr_FR"]`), **visuels
  Galeria** (`build/installer*.bmp`), `runAfterFinish: false`. Photos en pleine
  résolution inchangées.
- **Build de livraison** — nouveau script `npm run build:catalogue`
  (catalogue sans clients/ventes/certificats/annexes, statut des œuvres
  conservé, photos classées par artiste et renommées selon la nomenclature).

---

## [0.5.0] — 2026-06-29

### Ajouté

- **Numéro de certificat composé + n° de facture Sage** — le numéro de
  certificat d'authenticité (= numéro de délivrance) suit désormais le format
  **`{n° inventaire}-{séquentiel par artiste}-{n° Sage}`**
  (ex. `MTR1042-003-5567`, **sans année**). Le **séquentiel est propre à
  chaque artiste**. Le **n° de facture Sage est requis** : une invite le
  demande avant de produire le certificat (impossible de produire sans).
  Nouveau champ **« N° de facture (Sage) »** sur le formulaire de vente
  (source unique, pré-remplit le certificat) et sur le formulaire de
  certificat (aperçu du numéro composé en direct, bouton bloqué tant que le
  n° Sage est vide). Le certificat de la **pochette** utilise le n° Sage de
  la vente. **Nom de fichier daté** :
  `Certificat {n° inventaire} — titre (artiste) {AAAA-MM-JJ}.pdf`
  (le numéro complet reste dans le PDF ; un doublon le même jour reçoit un
  suffixe « (2) », une œuvre pouvant avoir plusieurs certificats). Colonnes
  `certificats.seq_artiste`, `certificats.numero_sage`,
  `ventes.numero_facture_sage`. Les anciens certificats `C-2026-NNN` ne sont
  pas renumérotés. Démo : `demos/certificat-numero-sage.html`.

### Modifié

- **Préfixes de numéros de factures et d'annexes** — facture artiste →
  **`FA-2026`**, facture client → **`FC-2026`** (migration douce : seules les
  configs restées au défaut historique `A-2026`/`F-2026` sont mises à jour,
  un préfixe personnalisé est préservé). Annexes → **`AD-`** (dépôt) /
  **`AR-`** (retrait) au lieu de `A-`. Les noms de fichiers suivent
  automatiquement (ils reprennent le numéro).

- **Nomenclature unifiée des noms de fichiers des documents** — tous les
  PDF produits suivent désormais un seul schéma **lisible en français** :
  `Type Numéro — Entité.pdf` (accents et espaces conservés). Exemples :
  `Certificat C-2026-001 — Le verger (Marie Tremblay).pdf`,
  `Facture artiste A-2026-005 — Marie Tremblay.pdf`,
  `Catalogue 2026-06-23 — Marie Tremblay.pdf`,
  `Annexe dépôt A-MTR-003 — Marie Tremblay.pdf`,
  `Présentation — Marie Tremblay.pdf`, `Rapport 2026-06-23.pdf`. Les
  documents numérotés portent leur numéro (continu, jamais remis à zéro) ;
  catalogue/présentation/rapport restent datés. Les **versions modifiées**
  reçoivent un suffixe unique ` (version modifiée AAAA-MM-JJ)` et ne peuvent
  plus écraser un document édité à la main. Centralisé dans un seul helper
  `nomDocument()` (`src/pdf.js`), appliqué aux ~10 générateurs ; la section
  **Documents** reste **tolérante aux anciens noms** déjà sur le disque.
- **Re-génération propre** — re-produire un certificat, une facture artiste
  ou une présentation **supprime l'ancien fichier** s'il a été renommé (plus
  de doublon dans la section Documents). Les documents datés régénérés le
  même jour s'**écrasent** ; bascule automatique sur « (2) » si le fichier
  est ouvert dans un visionneur (verrou).

### Corrigé

- **Nomenclature des images d'œuvres** (`src/db/nomenclature.js`) — les mots
  du titre sont désormais joints par **underscore** (`Sault_en_Provence`) et
  non par tiret, conformément à la formule de référence : le tiret est
  réservé à la séparation des grandes parties du nom. Corrige aussi le nom
  exact suggéré par le garde-fou Sage. (Renommage physique des photos :
  Jalon 5, non touché ici.)
- **Suppression d'une œuvre liée à un certificat** — `supprimerOeuvre` ne
  vérifiait que les ventes ; une œuvre ayant un certificat (sans vente)
  échouait sur la contrainte FK avec l'erreur SQL brute « FOREIGN KEY
  constraint failed ». Le refus est désormais **clair** (« supprimez d'abord
  le(s) certificat(s) depuis la fiche de l'œuvre »), cohérent avec les
  ventes ; les certificats restent préservés.

---

## [0.4.0] — 2026-06-20

### Ajouté

- **Réservation d'œuvres** — bouton **« Réserver »** sur une œuvre
  disponible : on la met de côté pour un **client** (requis), avec **date
  d'échéance** et **notes**. Carte **« Réservation »** sur la fiche (client,
  dates, **badge d'échéance** échue/bientôt) avec **« Convertir en vente »**
  (formulaire de vente pré-rempli) et **« Libérer »**. La réservation est
  effacée à la vente. Bloc « Œuvres réservées » du tableau de bord enrichi
  (client + échéance). Colonnes `reservation_*` sur les œuvres.
- **Section « Aide »** — bouton **« ? »** flottant présent sur toutes les
  pages, ouvrant un panneau cherchable (deux volets : catégories
  collapsibles + recherche à gauche, article complet à droite). Base de
  ~65 articles (artistes, œuvres, cotes/prix, clients, ventes, documents,
  suivi, sauvegardes, réglages, sécurité, problèmes courants, glossaire),
  avec mots-clés, surlignage et liens « Voir aussi ». Tout local.
- **Tutoriel de bienvenue** — visite guidée hybride au 1ᵉʳ lancement
  (diapo de bienvenue → coach-marks qui **font défiler les sections** :
  Accueil, Artistes, Œuvres, Clients, Ventes, Suivi, Documents, Rapport,
  Outils, Profil/Réglages, Aide → diapo finale). Rejouable depuis l'aide.
- **Calculateur de commission** (Outils) — projette le **net versé à
  l'artiste** après TPS/TVQ. Cote selon le type : Peinture 50 %,
  Sculpture 33 %, Reproduction 50 % après frais de production, ou « Autre »
  (% libre).
- **Vue « Explorateur »** pour la section Documents (bascule **Liste /
  Explorateur** mémorisée) : navigation dans l'arborescence réelle
  (Année → Type → fichiers ; Pochettes → client → facture), fil d'Ariane
  et recherche globale ; dossiers de type avec leur icône.

### Modifié

- **Section Documents repensée (Lot 4)** : réunit **tous les types** de
  documents (certificats, factures artiste, catalogues, annexes,
  présentations, rapports, **pochettes**) depuis une source **hybride
  base + disque** (y compris les « versions modifiées »). Groupement par
  type, **barre de filtres** (Type · Année · Artiste · Client) +
  recherche, icônes SVG par type, **pochettes dépliables**, badge
  « version modifiée ».
- **Facture artiste** : la **cote** appliquée dépend désormais du **type de
  l'œuvre** (Sculpture 33 %, sinon le défaut configurable, 50 %).
- **Fenêtre** adaptée à la taille de l'écran disponible (la barre latérale
  reste entièrement visible, même sur un écran < 900 px de haut).
- **Icône « Emballage »** (tableau de bord + Suivi) : boîte de livraison.

### Corrigé

- Padding manquant sur la carte « Réservation » ; débordement des boutons
  à la dernière étape du tutoriel.

---

## [0.3.0] — 2026-06-19

### Ajouté

- **Présentation d'artiste imprimable (PDF)** — bouton **« Présentation PDF »**
  sur la fiche artiste : photo + biographie + démarche + curriculum. Le **CV est
  mis en forme en frise** (année à gauche — y compris plages `1996 à 2001` et
  listes `2000, 2004, 2009` —, rubriques en intertitres, listes à tirets) ; les
  **citations** (paragraphe entre guillemets « ») ressortent en **exergue** avec
  attribution alignée à droite ; espacement français des guillemets automatique.
  **Mise en cache** : le PDF n'est régénéré que si le profil de l'artiste a
  changé (signature des champs), sinon la dernière version est réutilisée.
- **Pochette de vente** — bouton **« Produire la pochette de vente »** sur la
  fiche de vente (proposé aussi automatiquement juste après l'enregistrement
  d'une vente). Rassemble dans un dossier par client/facture
  (`Documents\{année}\Pochettes\{client}\{facture}\`) : **lettre de remerciement
  + fiche de l'œuvre** (1 des 8 variantes selon type d'achat / cadeau / langue),
  **certificat d'authenticité** (produit automatiquement s'il manque),
  **présentation de l'artiste** (réutilisée du cache) et le **guide de
  l'acheteur** (PDF fixe). La lettre est garantie sur une page (texte réduit au
  besoin). Les documents apparaissent sur la fiche de vente (Voir / Dossier).
- **Champs de vente** : type d'achat (en personne / web), achat-cadeau, langue
  (FR / EN) — choisissent la lettre de remerciement de la pochette.
- **« Version modifiée » de n'importe quel document** — ouvre le document dans
  une fenêtre **éditable (WYSIWYG)** : on modifie le texte directement (ex.
  retirer une ligne du CV) puis on enregistre en PDF, **sans toucher aux données
  ni au cache**. Disponible pour la lettre, le certificat, la présentation, la
  facture artiste, le catalogue et l'annexe. Pour un document de pochette, la
  version modifiée remplace le fichier correspondant dans le dossier de la pochette.
- **Annexe A — dépôt / retrait d'œuvres (PDF)** — document signé artiste +
  galeriste confirmant la consignation (dépôt) ou la reprise (retrait) des
  œuvres. Format Lettre paysage, tableau des œuvres (n° inv, titre, format,
  H/L/P, codes médium/support/signature, année, prix **sans cadre/avec cadre**
  calculés via les cotes) + blocs de signature. **Dépôt en rouge `#900001`**,
  **retrait en bleu `#2a5c8a`**. Numérotation séquentielle **par artiste**
  (`A-{préfixe}-001`), enregistrée dans une nouvelle table `annexes`.
  Production : bouton **« Annexe A… »** sur la fiche artiste (sélection des
  œuvres) **et** invites automatiques dans les flux — après l'ajout d'œuvres
  (dépôt, à la fin d'un chaînage ou pour une œuvre seule) et après un retrait
  (œuvre seule ou en lot, une annexe par artiste).
- **Catalogue d'artiste imprimable (PDF)** — bouton **« Catalogue PDF »** sur la
  fiche artiste : génère un PDF portrait Lettre, **6 œuvres par page** (grille
  2×3, identité rouge GVSJ #900001, sauts de page automatiques). Sous chaque
  œuvre : n° d'inventaire, titre, dimensions, médium (sur support) et — selon la
  disponibilité — le **prix** si l'œuvre est disponible, sinon **« Non
  disponible »**. Exclut les œuvres archivées et retirées.
- **Sélecteur d'unité pouces / cm** sur le calculateur de prix (Outils) et sur
  les champs de dimensions de la fiche d'œuvre. Changer d'unité **convertit les
  valeurs affichées** ; la source de vérité et l'enregistrement restent
  **toujours en pouces** (aucune dérive sur les allers-retours).
- **Pré-remplissage TPS + TVQ** dans la section fiscalité à la **création** d'un
  artiste (étiquettes remplies, numéros à compléter).
- **Validation bloquante du format des numéros TPS et TVQ** à l'enregistrement
  d'un artiste — TPS : `9 chiffres + RT + 4` · TVQ : `10 chiffres + TQ + 4`,
  **espaces ignorés**. Les autres étiquettes (TVH, étranger…) et les champs
  laissés vides ne bloquent jamais.

### Modifié

- **Documents générés sur fond blanc** (présentation, catalogue, annexes) — pas
  d'aplat de couleur à l'impression ; les accents rouge/bleu sont conservés.
- **Certificat d'authenticité** : son PDF officiel (nom à nomenclature) est
  désormais rangé **dans le dossier de la pochette** quand il est lié à une vente
  (au lieu du dossier `Certificats\`).
- **Suppression d'une vente** : n'est plus **bloquée** par les certificats liés
  (ils sont détachés et conservés dans l'historique de l'œuvre) ; l'app **propose
  d'effacer le dossier de pochette** associé — et, dans ce cas, supprime aussi
  les certificats qu'il contenait. Le dossier **Pochettes** est sous l'année.
- **Classement des documents générés** : rangés par **type dans l'année**
  (`Documents\{année}\Certificats\`, `…\Factures artiste\`, `…\Catalogues\`,
  `…\Annexes\`, `…\Rapports\`) au lieu d'un seul dossier annuel. S'applique aux
  nouveaux documents ; les anciens restent en place.
- **Certificat d'authenticité** : l'accent **doré (#b9912f)** passe au **rouge
  GVSJ #900001**, amorçant l'identité visuelle rouge commune à tous les
  documents générés.
- **Hiérarchie de la sidebar** : **Accueil** détaché en tête (porte d'entrée),
  puis trois groupes intitulés — **Catalogue** (Artistes, Œuvres), **Ventes**
  (Clients, Ventes, Suivi) et **Archives** (Documents, Rapport). Bloc bas
  (Outils, Réglages) et bloc profil inchangés. Markup + CSS uniquement, aucune
  logique de navigation modifiée.
- **Cartes de statistiques retirées** du haut de la liste des Œuvres.
- **Fiche artiste réorganisée en 3 niveaux** : **en-tête** (photo + nom + stats
  en ligne + actions de fiche / documents), **contenu** (Présentation + Aperçu
  du catalogue), et un bloc **« Informations de gestion »** discret et grisé
  (Contact, Conditions galerie, Aide IA, Notes). La **valeur disponible est
  masquée** (révélée au clic, re-masquée quand la souris quitte). La carte
  Présentation garde une hauteur stable (texte défilant) + un bouton **« ⤢ »**
  pour l'ouvrir en grand (modale Bio + Démarche + Curriculum).

---

## [0.2.5] — 2026-06-18

> Publiée sur GitHub Releases. À livrer aux parents en une **installation
> manuelle** du build **complet** (ils sont encore sur 0.2.0, sans auto-update) —
> le build public publié ici a un catalogue/photos vides.

### Ajouté

- **Section « Suivi »** (sidebar) — vue dédiée du cycle de vie complet : vue
  **Actif** combinant *À préparer* (œuvres) et *Commandes en cours* (ventes),
  onglet *Complétées*, bandeau de synthèse (files d'attente Préparation /
  Expédition), **stepper inline-éditable** (icône + libellé + connecteurs),
  paiement en **menu déroulant** (À faire / Partiel / Reçu), modales
  « Confirmer la livraison » et « Revenir en arrière ».
- **Étape de préparation « Stock »** (Sage → **Stock** → Site) partout (fiche
  œuvre + Suivi + tableau de bord). Colonnes `stock_fait` / `stock_fait_date`,
  backfill du catalogue existant (`PRAGMA user_version = 2`).
- **Bloc « Œuvres en préparation »** au tableau de bord (remplace le « Résumé
  du catalogue »). Rangée du bas réordonnée : Préparation · Réservées ·
  Commandes non complétées.
- **Section « Documents »** (sidebar) — index de tous les PDF produits
  (certificats + factures artiste), groupés par année, filtrables par type,
  recherchables, actions Voir / Dossier / Re-générer.
- **Section « Rapport »** (sidebar) — journal d'une journée (sélecteur de
  date) : tuiles, ventes détaillées (sous-total/TPS/TVQ/total),
  intrants/extrants du jour, activité opérationnelle ; **+ suivi opérationnel**
  (admissions en cours, ventes & livraisons en cours). **Export PDF format
  Lettre** via gabarit autonome (`gabarit-rapport.html`, polices système).
- **Retrait d'œuvres** — « Retirer » remplace « Archiver » sur l'œuvre :
  bouton sur la fiche (modale date + motif), badge « Retirée », « Réintégrer »,
  filtre « Inclure les retirées ». **Retrait en lot** via mode sélection sur la
  liste (bouton « Retirer » près de « + Ajouter » ; œuvres vendues non
  retirables). Colonnes `retrait_date` / `retrait_motif`.
- **Droplist médium partagé** — composant unique (`commun.js`) appliqué à la
  fiche œuvre, au calculateur (Outils) et aux cotes (fiche artiste).
- **Sélecteur de taille de vignette** (Petit / Moyen / Grand) dans les listes
  Artistes et Œuvres (vue grille), mémorisé en localStorage.
- **Avancement du splash** au démarrage : barre de progression + libellé
  d'étape ; le splash s'affiche **avant** les étapes longues ; copie des photos
  rendue asynchrone pour que la barre avance réellement.
- **Stepper étiqueté** pour le bloc « Commandes non complétées » du tableau de
  bord (remplace les petits points).

### Modifié

- **Formulaire d'œuvre** réagencé : Caractéristiques (8) + Commerce et
  localisation (4) ; Préparation (6) + Sujets (6).
- **Dimensions des œuvres** : 498 fiches migrées du texte libre vers les
  colonnes H/L/P (`scripts/separer-dimensions.js`), profondeur absente laissée
  NULL, texte régénéré au format de l'app.

### Corrigé

- Mise en page du rapport (largeur pleine page à l'impression), format **Lettre**
  garanti via `printToPDF` `pageSize: 'Letter'`.

### Connu

- Le visionneur **Acrobat** affiche une erreur « Font Capture » quelques
  secondes après l'ouverture de **tout** PDF généré (certificats inclus) —
  environnemental, le PDF reste valide. À investiguer séparément.

---

## [0.2.4] — 2026-06-17

### Ajouté

- **Jalon 3 — Suivi du cycle de vie.** Nouvelles colonnes sur les œuvres
  (`sage_cree`, `site_publie` + dates) et sur les ventes (`paiement_statut`,
  `paiement_date`, `emballage_date`, `envoi_date`, `livraison_date`).
  - **Carte « Préparation »** sur la fiche œuvre : statut Sage 50 (obligatoire
    avant la vente) et Site web (facultatif), **éditables en place** sans
    passer par « Modifier » (boutons « Marquer fait » / « Annuler », dates
    inline). Sauvegarde immédiate.
  - **Carte « Suivi cycle de vie »** sur la fiche vente : paiement (En
    attente / Partiel / Reçu) + emballage / envoi / livraison, eux aussi
    **éditables en place**.
  - **Bloc « Commandes non complétées »** sur le tableau de bord (remplace le
    placeholder Agenda) : liste des ventes dont une étape post-vente n'est pas
    terminée, avec 4 pastilles d'avancement (Paiement / Emballage / Envoi /
    Livraison) et clic vers la fiche.
- **Garde-fou Sage à la vente.** Impossible d'enregistrer la vente d'une
  œuvre qui n'est pas marquée « Créée dans Sage 50 ». L'avertissement
  apparaît **dès la sélection de l'œuvre** dans le formulaire de vente, et le
  backend refuse en dernier recours. Le message indique le **nom de
  référence complet** (= numéro d'item Sage = nom de fichier photo), généré
  selon la nomenclature de la galerie.
- **Générateur de nomenclature** (`src/db/nomenclature.js`) : construit le nom
  normalisé d'une œuvre — `(code)-(titre slug)-(formatL)(HxLxP)-(médiumL)
  (supportL)-(signatureL)(année)`, ex. `CLD1992-Entre-le-vent-et-la-mer-
  M30x30x0.75-AT-BD2023`. Réutilisable pour le renommage physique des photos
  (Jalon 5, non encore implémenté). Codes-lettres = première lettre de chaque
  mot, sans accent.
- **Champ « Style »** sur les œuvres (Figuratif / Abstrait / Mi-Figuratif) :
  dans le formulaire, sur la fiche en lecture, et comme **filtre** dans la
  liste des œuvres.
- **Formulaires d'édition en bento** (artiste + œuvre) : mise en grille comme
  les fiches en lecture. Photo / image **compacte** (3 col) avec actions en
  **icônes superposées** (remplacer ↑ / recadrer ⊡ / retirer 🗑) au lieu de
  boutons texte. La photo peut désormais être ajoutée **dès la création** d'un
  artiste (avant, il fallait créer puis ré-ouvrir la fiche).
- **Sujets en chips** dans le formulaire d'œuvre : pastilles cliquables
  (activer/désactiver) + bouton « + Ajouter un sujet ».

### Modifié

- **Catalogue existant réputé déjà dans Sage et sur le site.** Backfill unique
  (via `PRAGMA user_version`) au premier démarrage de cette version :
  toutes les œuvres existantes passent à `sage_cree = 1` et
  `site_publie = 1`. Les œuvres créées ensuite partent à 0 et déclenchent le
  garde-fou normalement.
- **Messages d'erreur nettoyés** : le préfixe technique d'Electron
  (« Error invoking remote method '…': Error: ») est retiré des dialogues
  d'erreur (helper `nettoyerErreur`).

### Corrigé

- Le **filtre Style** de la liste des œuvres ne renvoyait rien : la colonne
  `style` manquait dans la requête `listerOeuvres` (corrigé, `o.style`
  ajouté).
- L'**ajout de photo sur un nouvel artiste** était bloqué : une ancienne règle
  CSS `.zone-photo-edition { display:flex }` faisait s'effondrer la zone photo
  à une taille nulle (bouton incliquable). Règles mortes supprimées.
- `champSelect` n'était pas importé dans `vente-fiche.js` : tous les
  formulaires de vente plantaient au rendu (« champSelect is not defined »).

---

## [0.2.3] — 2026-06-17

### Ajouté

- **Cotes & calcul de prix (jalon 2).** Cotes par artiste (médium × taille,
  unités po linéaire ou po²), avec deux versions : préférentiel (sans
  encadrement) et courante (= préf + 2 $ par unité). Application
  automatique au prix de l'œuvre dès que dimensions/médium/format/artiste
  sont remplis ; l'utilisateur peut écraser à la main, le système le
  détecte et arrête d'écraser. Switch **« cote hors-normes »** sur
  l'œuvre pour les cas exceptionnels (vide le prix et désactive l'auto).
- **Section « Outils »** dans la sidebar, séparée visuellement du
  reste avec une fine ligne dorée. Première page : **calculateur de
  prix** autonome (artiste + dimensions → prix préférentiel et courant
  avec formule détaillée).
- **Dropdown intelligent pour le médium** sur les cotes : input texte
  libre + bouton ▾ qui ouvre une liste **toujours complète** (sans
  filtrage natif du `<datalist>`), scrollable. La liste sépare les
  **médiums de l'artiste** (en tête) des **autres médiums** (en dessous),
  avec un raccourci « Tous » épinglé tout en haut.
- **Refonte bento des 7 pages principales.** Mise en page en grille
  12 colonnes avec cartes hiérarchisées remplaçant les piles
  d'accordéons verticaux. Couvre **Artiste** (photo + identité + 4
  stats, présentation à onglets Bio/Démarche/CV, conditions galerie
  avec cotes + fiscalité, contact, aide IA, aperçu de 8 œuvres),
  **Œuvre** (image + identité avec 2 prix Courant/Préférentiel,
  caractéristiques, localisation/sujets, description, certificats),
  **Client** (avatar + identité + 4 stats achats/total/dernier/depuis,
  coordonnées + bloc Loi 25 avec pastille consentement, historique
  d'achat, notes), **Vente** (identité + tuile Total navy/or, œuvre +
  client cliquables, détails financiers en table-facture, documents
  avec icônes A/C), **Réglages** (numérotation + taxes & commission,
  sauvegardes + affichage + import, IA + à propos), **Profil galerie**
  (4 cartes 2×2), **Outils** (calculateur + cotes de référence côte
  à côte).
- **Nouveau IPC `app:ouvrir-dossier`** (wrap `shell.openPath`). Le
  chemin du dossier de données dans À propos est maintenant un bouton
  pillule cliquable qui ouvre l'Explorateur Windows directement.
- **5 nouveaux IPC `*FicheBundle`** (artiste, œuvre, client, vente,
  réglages) qui chargent tout ce qu'une fiche en lecture a besoin en
  un seul appel — incluant les stats calculées et les listes
  apparentées.
- **DevTools accessibles via F12 ou Ctrl+Shift+I** (utile pour le
  débogage occasionnel ; menu de la fenêtre toujours désactivé).
- **Document `A-VALIDER.md`** à la racine du projet : liste vivante
  des questions à clarifier avec les parents (formule du courant pour
  les cotes en po², catégories de format, taxes par client, etc.).
- **Démos HTML standalone** dans `demos/` (artiste, œuvre, client,
  vente, réglages) pour valider visuellement les mises en page avant
  l'intégration dans l'app.

### Modifié

- **Sidebar séparée en deux blocs.** Accueil / Artistes / Œuvres /
  Clients / Ventes en haut ; Outils / Réglages en bas ancrés près du
  bloc Profil. Fine ligne dorée pour séparer.
- **Matching des médiums** dans les cotes désormais insensible à la
  casse et aux accents (« Acrylique », « acrylique » et « ACRYLIQUE »
  sont équivalents).
- **Formule de la cote courante** : `prix_courant = (prix_pref + 2) ×
  base`. Le supplément de 2 $ s'ajoute à la **cote** (par unité), pas au
  prix total. Sur une cote en $/po linéaire, ça revient au même qu'un
  supplément linéaire ; sur une cote en $/po², l'écart se creuse avec
  la surface (à reconfirmer avec les parents).
- **Titres de cartes harmonisés à 24 px Cormorant gallery-navy**
  sur toutes les pages bento (au lieu de 18 px). Sous-sections
  internes en encarts soft-ivory + bordure mist (au lieu de filets
  séparateurs) pour mieux délimiter visuellement les zones.
- **Boutons de navigation Précédent/Suivant** sans cadre, juste flèche
  + libellé et fond cloud au survol.

### Corrigé

- Quand on naviguait dans Outils ou Réglages, les **deux entrées**
  apparaissaient comme actives dans la sidebar (toutes les vues
  inconnues partageaient la même section ''). Désormais chacune a sa
  propre section.
- Le validateur de cotes refusait `taille = 'Tous'` (seules les 4
  tailles « réelles » étaient acceptées).

---

## [0.2.2] — 2026-06-16

### Ajouté

- **Jalon 1 polish & UX.** Filtre des œuvres par format (Petit / Moyen /
  Grand / Très grand) dans le panneau Filtres. Champ « URL de la fiche
  sur le site web » sur l'œuvre + bouton **« Voir sur le site › »** sous
  le prix (lien ouvert dans le navigateur). Premier **numéro séquentiel
  d'inventaire** (global à la galerie) ajustable dans Réglages,
  pré-rempli au formulaire d'œuvre (préfixe artiste + numéro), incrémenté
  uniquement si la valeur suggérée n'est pas modifiée à la main.
- **Chaînage de création d'œuvres pour un artiste existant** : bouton
  « + Ajouter d'autres œuvres » sur la fiche artiste. Sur la liste
  Œuvres, le bouton « + Ajouter une œuvre » ouvre maintenant une modale
  de sélection d'artiste avec option **« ✦ Nouvel artiste… »** qui mène
  d'abord à la création d'artiste, puis chaîne vers la création d'œuvres.
- **Import des URLs d'Airtable** : 504 URLs rapatriées via le script
  dédié `scripts/import-urls-oeuvres.js` (matching par numéro
  d'inventaire, sauvegarde automatique avant écriture, dry-run par
  défaut).
- **Nouveau template de certificat** (gabarit complet fourni par Dave,
  `certificat_outil_GVSJ_9.html`), intégré via une fonction
  `remplir(data)` qui pilote les inputs du panneau de saisie depuis les
  données de Galeria et force le mode imprimable pour `printToPDF`. Le
  template reste utilisable en standalone (panneau de saisie visible
  dans un navigateur).

### Corrigé

- **Polices Garamond externalisées** vers `gabarits/actifs/` dans le
  nouveau certificat. En base64, elles faisaient crasher Acrobat à la
  fermeture du PDF — comportement connu sur Chromium quand des polices
  embarquées sont ré-embarquées par `printToPDF`.

---

## [0.2.1] — 2026-06-16

### Ajouté

- **Mécanisme de mises à jour automatiques** via `electron-updater` +
  GitHub Releases. Comportement non intrusif :
  - Check silencieux 5 s après le démarrage (et sur clic manuel dans
    Réglages → À propos).
  - Toast en bas à droite si une mise à jour devient disponible →
    modale détaillée avec notes de version, téléchargement contrôlé
    par l'utilisateur, redémarrage sur confirmation explicite.
  - `autoDownload: false`, `autoInstallOnAppQuit: false` — rien ne se
    fait sans clic.
- **Chaîne de build à deux modes.** `npm run build:complet` pour
  livrer chez les parents (catalogue + photos embarqués) ; `npm run
  build:public` pour la release publique (catalogue et photos vides) ;
  `npm run release` qui bâtit le public et publie sur GitHub Releases.
- **Generic defaults** dans `src/config.js` (« Ma galerie », adresses
  vides, signataire vide) pour rendre le build public neutre. Les
  parents conservent leurs valeurs via leur `config.json` existant,
  préservé d'une mise à jour à l'autre (electron-updater ne touche
  jamais au dossier de données utilisateur).

### Sécurité

- Premier release **publique** sur GitHub Releases ; le repo est
  désormais public pour qu'electron-updater puisse lire la release
  sans token. Aucune donnée personnelle dans le build public.

---

## [0.2.0] — 2026-06-15

### Ajouté

- **Splash screen** au démarrage de l'app : fenêtre 600 × 338 avec
  logo Galeria, version en doré italique avec fade-in, durée minimale
  1,2 s, filet de sécurité 8 s pour ne jamais se coincer.
- **Tableau de bord à l'accueil** (refonte complète de l'écran
  d'accueil) : layout 3 × 2 sans scroll global, scroll interne par
  bloc. 4 cartes stats (Œuvres au total, Artistes représentés, Clients
  actifs, Ventes ce mois avec delta %). Blocs : Œuvres récemment
  ajoutées (6 vignettes), Ventes récentes, Œuvres réservées, Résumé
  du catalogue avec sparkline 12 mois, et un placeholder Agenda pour
  une intégration future. Bouton « Accueil » ajouté en haut de la
  sidebar.
- **Archivage des fiches.** Statut `archive` sur artistes, œuvres et
  clients. Bouton « Archiver / Désarchiver » sur les fiches. Listes
  excluent les archivés par défaut, case « Inclure les archivés » dans
  les contrôles (panneau Filtres pour œuvres). Sélecteurs œuvre/client
  lors d'une nouvelle vente excluent automatiquement. Les stats du
  tableau de bord ignorent les archivés.
- **Réglages d'affichage.** Section « Affichage » dans Réglages avec
  sélecteur 6 niveaux (80 % à 150 %), preview live via
  `webContents.setZoomFactor()`, persistance dans `config.affichage.zoom`,
  réappliqué au démarrage.
- **Section « À propos »** dans Réglages : nom de l'app, version,
  marque affichée, dossier des données, moteur (Electron + plateforme).
- **Dimensions H × L × P séparées** sur les œuvres (en pouces). Texte
  `dimensions` régénéré automatiquement (« 24 × 36 po »). Auto-calcul
  de l'**orientation** (Horizontale / Verticale / Carrée) et du **format**
  (Petit / Moyen / Grand / Très grand) basé sur **√(H × L)** — moyenne
  géométrique, dérivée empiriquement de 476 œuvres déjà classées avec
  93,7 % de précision (voir `scripts/analyse-seuils-format.js`).
- **Intégration ChatGPT en mode presse-papier.** Bouton « Copier pour
  ChatGPT » sur la fiche d'œuvre. Assemble un prompt complet (consignes
  galerie + consignes par artiste + caractéristiques de l'œuvre) et
  copie texte + image dans le presse-papier. Modale en 2 étapes : texte
  copié + image draggable ou bouton « Copier l'image » (Chrome ne
  préserve pas le multi-format texte+image lors d'un collage). Champ par
  artiste pour le lien vers son Custom GPT.
- **Migration auto du dossier de données** : renommage de
  `Documents\GalerieApp\` vers `Documents\Galeria\` au démarrage si
  l'ancien existe.
- **Migration automatique des prénoms / noms d'artistes** : split sur
  le dernier mot (avec gestion des particules « de », « du », « von »,
  etc., et skip des pseudonymes avec parenthèses). Script
  `scripts/migrer-prenoms-noms.js` (dry-run par défaut). 17 artistes
  migrés automatiquement.

### Modifié

- **Refonte UI complète** selon le brief visuel : palette Deep Navy +
  Soft Ivory + Warm Gold, typographie Cormorant Garamond + Inter,
  variables centralisées dans `src/theme.css`, polices embarquées
  localement (pas de Google Fonts à l'exécution). Sidebar navy à gauche
  avec menu vertical et bloc profil cliquable en bas, en-tête de page
  avec titre Cormorant + barre de recherche pillule + bouton primaire
  doré, vue grille pour Œuvres et Artistes (toggle Grille / Liste
  mémorisé en `localStorage`), panneau de filtres avec dropdown.
- **Toutes les requêtes SQL** retournent désormais le nom complet
  (prénom + nom) pour les artistes.

---

## [0.1.0] — 2026-06-14

Première version livrable chez les parents. Phases 1 à 3 complètes :
fondations Electron + SQLite, catalogue (artistes / œuvres / clients),
ventes, certificats d'authenticité et factures artiste en PDF,
sauvegardes automatiques, installateur Windows. Voir `ETAT.md` pour le
détail historique.
