# État du projet Galeria — Sauvegarde de session

> Document à lire en début de nouvelle conversation, après `CLAUDE.md`, pour reprendre le projet là où il en est.
> Date de cette sauvegarde : 2026-06-29.
>
> **Voir aussi** : `CHANGELOG.md` (historique versionné détaillé) et `A-VALIDER.md` (questions ouvertes avec les parents).

---

## ▶ Reprise — par où commencer (préparé le 2026-06-29)

**État** : **v0.5.0 publiée** ; tout le travail post-publication est sur **`master` = `4acbb71`**, **poussé, rien en attente**. L'**installateur de livraison** est **prêt** : `dist\Galeria Setup 0.5.0 (catalogue).exe` (catalogue, photos en paquet unique, install/désinstall rapides, **français**, branding **Galeria**, **détection auto du catalogue** avec sauvegarde + redémarrage).

**⚠️ Non vérifié visuellement par Claude** (le résolveur computer-use ne capte pas la fenêtre Electron de dev) — l'ensemble v0.5.0 + installateur est **à confirmer par Dave dans l'app**.

**Prochaine étape n°1 — livraison aux parents (hors-code, côté Dave) :**
1. Base **propre** : fermer l'app, retirer les entrées de test du catalogue (ex. artiste « Dave Belisle »), au besoin renommer `Galeria BU` → `Galeria` pour repartir des bonnes données.
2. `npm run build:catalogue` (depuis le worktree **principal**) → `dist\Galeria Setup 0.5.0 (catalogue).exe`.
3. Installer chez les parents (en 0.2.0) → ouvrir l'app → **« Charger le nouveau catalogue »** (leur ancienne base est sauvegardée). Tester sur une copie d'abord si possible.

**Ensuite — chantiers code ouverts (par priorité suggérée) :**
- **Reproductions** : frais de production sur la facture artiste (champ persistant — fiche œuvre ou vente, à trancher — + adaptation `gabarit-facture-artiste.html`). Voir `A-VALIDER.md`.
- **Facture client (Phase 3D)** : gabarit + rôle **FC vs Sage** (le n° vient-il de Sage ?). Lié au numéro de certificat qui intègre déjà le n° Sage.
- ~~**Édition en batch (#2)**~~ — **✓ Livré (2026-06-30, à confirmer par Dave)** : bouton « Édition en lot » sur la page Œuvres → tableur multi-lignes (édition cellule par cellule + « Appliquer à la sélection »), enregistrement transactionnel partiel avec recalcul auto dimensions/format/orientation. Démo `demos/edition-batch.html`, module `src/app/vues/oeuvres-batch.js`, IPC `oeuvres:modifier-lot`. Vérifié en banc d'essai navigateur + tests unitaires de la mutation ; **pas encore dans la fenêtre Electron**.
- **Détail nomenclature** : confirmer si chaque copie d'une édition est une œuvre distincte (n° d'inventaire différent) → impacte le nom de fichier du certificat.

**Pour démarrer la nouvelle conversation** : faire lire `CLAUDE.md`, puis ce `ETAT.md` (ce bloc + le « Journal de session — 2026-06-29 » plus bas).

---

## En une phrase

> **Session 2026-06-29 — v0.5.0 publiée.** `master` à jour (`0343d2c`) et **release `v0.5.0`** publiée sur GitHub Releases (auto-update ≥ 0.2.1). Au programme : **nomenclature unifiée des noms de fichiers** des documents (style « lisible français », helper unique `nomDocument()` dans `src/pdf.js`, relecteur disque tolérant aux anciens noms) ; **préfixes** facture artiste **FA-**, facture client **FC-** (migration douce de la config), annexes **AD-**/**AR-** ; **refonte du numéro de certificat** (= n° de délivrance) → **`{n° inventaire}-{séquentiel artiste}-{n° Sage}`** (sans année), séquentiel **par artiste**, **n° de facture Sage requis** (champ « N° de facture (Sage) » sur la vente + le certificat, invite bloquante, repris par la pochette) ; **nom de fichier de certificat daté** ; **correctif** : refus clair à la suppression d'une œuvre liée à un certificat. Correction au passage de la nomenclature des **images** (underscore dans le titre, `nomenclature.js`). **À confirmer par Dave dans l'app** (non vérifié visuellement par Claude). Reste : **livraison aux parents** (toujours sur 0.2.0 → install manuelle d'un build avec catalogue) ; rôle **FC vs Sage** pour la facture client (Phase 3D/4) ; reproductions (frais de production) ; édition en batch (#2). **Installateur du build catalogue refondu** (même session) : **paquet unique** de photos → install/désinstall rapides, **assisté**, **en français**, visuels **Galeria**, déballage des photos avec barre de progression au 1er lancement ; **détection auto du catalogue livré** (si la base de l'utilisateur a un catalogue différent — ex. parents en 0.2.0 —, l'app propose de charger le catalogue embarqué, avec sauvegarde préalable + redémarrage). Démo : `demos/certificat-numero-sage.html`.

> **Session 2026-06-20.** Gros lot fusionné dans `master` et **publié en release `v0.4.0`** sur GitHub (auto-update actif pour les ≥ 0.2.1). Au programme : **réservation d'œuvres**, **section d'aide (#22)**, **tutoriel de bienvenue (#13)**, **Lot 1** (calculateur de commission) + **cote par type** sur la facture artiste, **Lot 4** (refonte Documents) + **vue Explorateur**, correctifs UI. **À confirmer par Dave** (rien vérifié visuellement par Claude — résolveur computer-use). Reste : **nomenclature des factures** (formule de Dave) ; **reproductions** (frais de production sur la facture artiste) ; **édition en batch (#2)** ; **livraison aux parents** (toujours sur 0.2.0 → install manuelle du build COMPLET `npm run build:complet`, à tester avant — saut 0.2.0 → 0.4.0).

L'application **Galeria** pour la **Galerie du Vieux Saint-Jean** est livrable et installée chez les parents. Dernière version **publiée : v0.4.0** (2026-06-20, sur GitHub Releases — réservation d'œuvres, section d'aide cherchable, tutoriel de bienvenue, calculateur de commission, cote par type sur la facture artiste, refonte Documents + explorateur). *Historique :* v0.3.0 (2026-06-19 — pochette de vente, annexes A, catalogue artiste, présentation + « version modifiée » WYSIWYG, refonte fiche artiste, sidebar). *Historique :* v0.2.5 (2026-06-18, sur GitHub Releases) — apporte : migration des dimensions H/L/P, stepper du tableau de bord, **section Suivi** (cycle de vie complet + étape Stock), **bloc Œuvres en préparation** à l'accueil, **droplist médium** partagé, **sélecteur de taille de vignette**, réagencement du formulaire d'œuvre, **avancement du splash**, **section Documents** (index des PDF), **section Rapport** (journal + suivi opérationnel, export PDF Lettre) et **mécanisme de retrait d'œuvres** (simple + en lot). Reste le jalon 4 (pack de vente, sauf retrait/commission), le jalon 5 (renommage des photos), plus les phases reportées (Sage, web, sécurité). **Prochaine livraison parents : installer manuellement le build COMPLET de v0.4.0** (`npm run build:complet` → catalogue+photos) — ils sont sur 0.2.0, donc l'auto-update ne les rejoint pas encore.

> ⚠️ **Important — déploiement chez les parents.** Ils sont encore sur la **0.2.0**, qui **ne contient pas** le module de mise à jour automatique (`electron-updater`, ajouté seulement en 0.2.1). Aucune des versions 0.2.1 → 0.2.4 ne leur est donc parvenue, et n'arrivera jamais par auto-update. **La prochaine livraison doit être une installation manuelle unique** du `Galeria Setup x.x.x.exe` (build complet, catalogue + photos). À partir de cette installation manuelle seulement, l'auto-update prend le relais pour toutes les versions suivantes. → Viser à leur livrer la version la plus à jour possible en une seule install manuelle (plutôt que la 0.2.4 maintenant puis re-livrer juste après). Et **tester la migration 0.2.0 → version-cible** (le saut est large : colonnes cycle de vie, cotes, style, archive, dimensions séparées, renommage dossier `GalerieApp`→`Galeria`, backfill Sage via `PRAGMA user_version`).

---

## Ce qui est fait

### Phase 1 — Fondations (livrée)

- App Electron en français, fenêtre **1600×900** (16:9), min 1024×576.
- Base SQLite via **`node:sqlite` (PAS `better-sqlite3`)** — voir « Décisions importantes ».
- Dossier de données utilisateur sur `Documents\Galeria\` (renommé depuis `GalerieApp\` au démarrage si présent). Sous-dossiers : `Sauvegardes\`, `Photos\` (avec `Photos\artistes\originaux\`), `Documents\{annee}\` pour les PDFs.
- Schéma à 5 tables : `artistes`, `oeuvres`, `clients`, `ventes`, `certificats`. Migrations additives via `src/db/migrations.js`.
- Écran d'accueil simple avec gros boutons (sera remplacé par une vue d'ensemble — voir wishlist).
- Import CSV depuis Airtable (modes « Mettre à jour » et « Ajouter seul les nouveaux »), tolérance aux variations de noms de colonnes.
- Sauvegardes automatiques configurables, à la fermeture aussi.
- **Installateur Windows NSIS** (`Galeria Setup 0.1.0.exe`) one-click, per-user, avec catalogue ET **241 Mo de photos** seed embarquées. Copie au premier lancement via `src/db/seedPhotos.js` (marqueur `.seed-applique`).
- Build : icône en 6 tailles ICO via pngjs (corrige bug png-to-ico v2.1.8), gabarits HTML inclus, extraResources configurés.

### Phase 2 — Catalogue (livrée intégralement)

- **2A** Consultation : listes artistes/œuvres avec recherche multi-critères, filtres, fiches détaillées, navigation Précédent/Suivant.
- **2B** Édition : formulaires complets, validation, garde-fous de quitter avec confirmation, dialogues internes.
- **2C** Création + suppression avec refus si dépendances.
- **2D** Photos : flux complet, recadrage carré 800×800 avec slider, original pleine résolution conservé.
- **Image différée à la création d'œuvre** : section image visible dès le nouveau formulaire, stockée en dataUrl puis enregistrée après save.

### Phase 3A — Clients (livrée)

- CRUD complet (liste, fiche, édition, création, suppression).
- **Loi 25** : case consentement courriel + date, badge dans la liste.
- Champs d'adresse granulaires : numéro civique, rue, appartement, ville, **pays (~190 select) + subdivision contextuelle (Province/État/Région)**, code postal.
- **Formatage automatique du téléphone partout** via délégation globale (app.js sur tout `input[type=tel]`), reformatage des valeurs héritées à l'ouverture.
- Section « Historique d'achat » alimentée par les vraies ventes.
- Champs séparés `prenom` / `nom` avec fallback gracieux.

### Phase 3B — Ventes (livrée)

- Liste avec recherche multi-critères, tri.
- Création de vente : sélecteur œuvre disponible + sélecteur client + **bouton « + Nouveau client »** qui ouvre désormais un **formulaire complet en modale 720px** (au lieu d'un mini-formulaire) avec adresse, pays/subdivision, consentement, notes.
- Prix pré-rempli, TPS/TVQ depuis config, mode de paiement, numéro de facture auto.
- **Rabais artiste + rabais galerie** (colonnes ventes, formulaire avec sous-bloc « Rabais (optionnels) », récap en lecture si non-zéro, branchement dans facture artiste).
- Recalcul du total en temps réel.
- Transaction qui marque l'œuvre comme vendue. Suppression refusée si certificats liés.
- Bouton **Vendre** sur fiche d'œuvre disponible, bouton **Voir la vente F-2026-xxx** sur œuvre vendue.
- Historique d'achat des clients branché sur les vraies ventes.

### Phase 3B-bis — Certificats d'authenticité (livrée)

- Table `certificats` indépendante (lien œuvre obligatoire, lien vente optionnel — peut exister sans vente).
- Mini-formulaire overlay réutilisable accessible depuis fiche d'œuvre ET fiche de vente.
- Numéro auto, pré-remplissage valeur, signataire, particularité.
- Section « Certificats d'authenticité » sur fiche d'œuvre avec compteur ; section « Documents » sur fiche de vente.
- Suppression d'un certificat ne décrémente pas le compteur (gap acceptable).

### Phase 3C — Génération des PDF (livrée)

- Module `src/pdf.js` : BrowserWindow cachée, charge gabarit, `executeJavaScript` pour appeler `remplir(data)`, attend polices+images, `printToPDF`.
- **Auto-génération** à la création d'un certificat.
- Bouton **« Produire la facture artiste »** sur fiche de vente.
- Pour chaque PDF généré, **trois actions** : **Voir le PDF** (visionneur Windows), **Ouvrir le dossier** (explorateur via `shell.showItemInFolder`), **Re-générer**.
- Photo de l'œuvre intégrée en base64 dans le certificat.
- Mapping intelligent type d'œuvre → texte d'attestation (peintre/sculpteur/reproduction/photographe/etc.).
- Taxes intelligentes sur facture artiste (depuis `numeros_taxes` JSON de l'artiste).
- **Numérotation distincte** : factures client (F-2026-xxx), factures artiste (A-2026-xxx), certificats (C-2026-xxx). Réservation du numéro stockée sur la vente.
- Sortie : `Documents\Galeria\Documents\{annee}\Certificat_*.pdf` (paysage), `FactureArtiste_*.pdf` (portrait).

### Tableau de bord (v0.2.0 — refonte complète de l'accueil)

- Layout 3 colonnes × 2 rangées qui tient dans le viewport sans scroll global (scroll interne par bloc).
- En-tête : logo galerie + « Tableau de bord » + « Bienvenue. Voici un aperçu de [nom de la galerie]. »
- 4 cartes stats : Œuvres au total, Artistes représentés, **Clients actifs** (clients non archivés ayant déjà acheté), Ventes ce mois ($ avec delta % vs mois précédent).
- **Œuvres récemment ajoutées** : 6 vignettes cliquables (image, titre, artiste, année, badge statut, prix).
- **Ventes récentes** : 6 dernières avec vignette, œuvre, client, total, date.
- **Œuvres réservées** : liste actionnable (clic → fiche), libellé « À relancer ».
- **Résumé du catalogue** : valeur totale des œuvres disponibles + sparkline 12 mois en doré.
- **Agenda** : bloc placeholder avec icône calendrier — intégration future (les parents utilisent Outlook).
- Bouton **« Accueil »** ajouté en haut de la sidebar.
- Données chargées via IPC dédié `accueil:donnees` qui regroupe stats + listes en un seul appel.

### Archivage des fiches (v0.2.0)

- Colonne `archive` (0/1) sur artistes, œuvres, clients. Migration additive non destructive.
- Bouton **Archiver / Désarchiver** sur les fiches (entre Supprimer et Modifier).
- Badge gris « Archivée » dans le titre des fiches.
- **Listes excluent par défaut** ; case **« Inclure les archivés »** dans les contrôles (panneau Filtres pour œuvres). Lignes/cartes archivées affichées en opacité réduite.
- Sélecteurs œuvre/client lors d'une **nouvelle vente** excluent automatiquement les archivés.
- Stats du tableau de bord ignorent les archivés.
- Pas archivable : ventes (ce sont des transactions, pas des fiches).

### Dimensions des œuvres séparées + auto-calcul (v0.2.0)

- 3 nouvelles colonnes `hauteur`, `largeur`, `profondeur` (REAL nullables, en **pouces**). Le champ texte `dimensions` est conservé et régénéré automatiquement (« 24 × 36 po » ou « 24 × 36 × 2 po »).
- Form : 3 inputs nombre côte-à-côte avec libellés Hauteur/Largeur/Profondeur.
- Aperçu live sous le trio : « Dimensions enregistrées : **24 × 36 po** » ou, si la fiche a une saisie héritée pas encore convertie, « Saisie héritée : *texte historique* ».
- **Auto-calcul de l'orientation** : H > L×1,05 → Verticale, L > H×1,05 → Horizontale, sinon Carrée. S'arrête dès que l'utilisateur modifie le champ à la main.
- **Auto-calcul du format** basé sur **√(H × L)** (moyenne géométrique = côté équivalent d'un carré de même surface). Critère dérivé empiriquement de **476 œuvres déjà étiquetées** par la galerie (script `scripts/analyse-seuils-format.js`) : précision **93,7 %** vs 85,5 % pour le max et 78,2 % pour le min. Seuils : Petit ≤ 16", Moyen ≤ 30", Grand ≤ 42", Très grand > 42". Profondeur ignorée (épaisseur du châssis).
- Catégorie historique « Mini » (2 œuvres ≤ 6") non reproduite par l'auto-calcul — l'utilisateur peut la mettre à la main (l'override désactive l'auto-calcul pour la session).

### Intégration ChatGPT (v0.2.0 — mode presse-papier)

- Bouton **« Copier pour ChatGPT »** sur fiche d'œuvre (création + édition, section Description). Image placée **avant** Description dans le formulaire.
- Mode **création** (œuvre non encore persistée) : assemble depuis les champs en mémoire + image data URL. IPC dédié `ia:copier-pour-chatgpt-inline`. Mode **édition** : utilise l'ID pour charger l'image depuis le disque (IPC `ia:copier-pour-chatgpt`).
- Prompt assemblé : consignes générales de la galerie + consignes spécifiques de l'artiste + caractéristiques de l'œuvre + description actuelle s'il y en a une.
- **Modale en 2 étapes** s'ouvre toujours (Chrome ne préserve pas le multi-format texte+image lors d'un collage). Étape 1 : texte déjà copié, à coller dans ChatGPT. Étape 2 : image draggable + bouton « Copier l'image » + bouton « Ouvrir ChatGPT ».
- **Nouveau champ par artiste** : section pliable « Aide à la description IA » dans la fiche, avec textarea pour les consignes spécifiques et champ URL pour son Custom GPT (ouvert directement si défini).
- **Section IA dans Réglages** : textarea pour les consignes générales de la galerie + champ URL ChatGPT par défaut.

### Phase 3R — Réglages + Profil de la galerie (livrée, séparés)

- **Page Réglages** : Documents (factures, certificats, taxes, cote), Sauvegardes (fréquence, rétention, dossier, import CSV). Stockage JSON dans `Documents\Galeria\config.json`.
- **Page Profil de la galerie** (séparée) : nom, adresse, téléphone, courriel, site web, numéros TPS/TVQ, logo. **Accessible via le bloc profil en bas de la sidebar** (devenu cliquable).
- Au save : module de sauvegardes redémarre, entête mis à jour.

### Refonte UI complète (livrée — 10 étapes du brief, 8 conservée à 5 %)

- **`src/theme.css`** : toutes les variables visuelles centralisées (couleurs, polices, espacements, arrondis, ombres).
- **Polices embarquées localement** : Inter (400/500/600/700) + Cormorant Garamond (400/600 + 400 italic), sous-sets latin + latin-ext, 14 fichiers `.woff2` (703 Ko) dans `src/fonts/`. Pas de Google Fonts à l'exécution.
- **Sidebar Deep Navy** à gauche (250px), avec :
  - Logo Galeria PNG transparent au sommet (cliquable → accueil)
  - Menu vertical 5 entrées (Artistes, Œuvres, Clients, Ventes, Réglages) avec icônes SVG, état actif en Gallery Navy + bordure dorée + texte doré
  - **Bloc profil cliquable** en bas (avatar « GVSJ », nom de la galerie, sous-titre « Profil de la galerie ») → ouvre la page Profil
- **Fond Soft Ivory** très pâle (`#FCFAF4`), cartes en blanc pur (`#FFFFFF`).
- **En-tête de page** : titre Cormorant Garamond 32px Ink, recherche pillule centrée avec icône loupe, bouton **« + Ajouter »** primaire doré (texte blanc cassé).
- **4 cartes statistiques** sur la vue Œuvres : Œuvres au total (tuile dorée), Artistes représentés (tuile saumon, icône corail), Ventes ce mois (tuile terracotta), Disponibles (**tuile deep navy pleine avec icône cream** — accent visuel fort). Deltas mensuels calculés via `cree_le >= start of month`.
- **Vue grille** pour Œuvres et Artistes (toggle Grille/Liste mémorisé dans localStorage). Cartes 4 colonnes auto-fill avec image 4:3, titre Cormorant, métadonnées Inter, badge de statut, menu « ⋯ » par carte (Voir, Vendre, Supprimer).
- **Contrôles de vue** : barre avec toggle Grille/Liste à gauche, **bouton Filtres + dropdown Tri** à droite. Le panneau Filtres s'ouvre sous le bouton avec statuts en pastilles, dropdown artiste, dropdown type (selects au même style compact que le tri).
- **Boutons unifiés** : primaire (warm gold + texte soft-ivory + poids 600), secondaire (porcelain + bordure mist + ink), danger (outline rouge — Dave préfère outline à fond plein), bouton retour flottant (cercle porcelain en haut-gauche, visible **seulement sur les fiches détaillées**).
- **Champs de formulaire** : porcelain + mist border, radius 10px, hauteur 40px, focus warm-gold + halo 4px, label Inter 13px slate. Erreur state prêt (`form-champ.erreur`).
- **Modales** : porcelain radius 18px, overlay Deep Navy 45 % avec backdrop-filter blur 2px, titres Cormorant.
- **Header redesigné** : icône maison remplacée par sidebar, navigation sections supprimée du header (déplacée vers sidebar).
- **Grand titre des fiches** en Cormorant Garamond 32px Ink (seul élément conservé de l'étape 8 qui a été annulée à 95 %).
- Nettoyage final : 83 références aux anciennes variables remplacées, ancien `:root` retiré, règles dépréciées du header (`btn-entete`, `btn-titre`, `logo-mini`, etc.) supprimées.

### Flux artiste enrichis

- **Création d'artiste avec enchaînement** : bouton « Créer + ajouter les œuvres » (doré) qui bascule sur le formulaire d'œuvre en mode chaînage. Bannière dorée avec compteur, boutons « Terminer » et « Enregistrer + ajouter une autre ».
- **Prénom et nom de famille séparés** + auto-préfixe d'inventaire (Joe Untel → JOU). L'auto-fill s'arrête à la première modification manuelle du préfixe.
- Toutes les requêtes SQL retournent `prenom + ' ' + nom` comme `artiste_nom` via `TRIM(COALESCE(a.prenom || ' ', '') || a.nom)`.

### Polish transverse

- Système de **dialogues internes** unifié (`src/app/dialogue.js`) — info, warning, error, question, succes.
- App renommée **« Galeria »** au niveau Windows.
- Icône d'app convertie correctement en ICO multi-résolution.
- Sections **pliables** sur les fiches.
- Barre Annuler/Enregistrer en bas de viewport, **50 % d'opacité avec backdrop-filter blur 6px** (Dave préférait voir le contenu derrière).
- Navigation Précédent/Suivant alphabétique sur toutes les fiches.
- **Multi-numéros de taxes par artiste** en JSON.
- Gabarits PDF lisent `data.galerie` depuis config.

### Import en masse des photos d'œuvres

- 505 photos importées depuis F:\, matching par numéro d'inventaire. Script `npm run import-photos-oeuvres`.

### Refonte bento des 7 pages principales (v0.2.3)

- **Architecture** : grille CSS 12 colonnes (`.grille-bento`) avec cartes (`.carte`) qui occupent un nombre variable de colonnes selon leur importance. Variables visuelles dans `theme.css`.
- **Fiche Artiste** : photo grande à gauche, identité + 4 stats (catalogue / disponibles / ventes / valeur dispo) en bande supérieure, présentation à onglets Bio/Démarche/CV pleine largeur, conditions galerie (cotes + fiscalité en sous-sections empilées), contact, aide IA, aperçu de 8 vignettes du catalogue.
- **Fiche Œuvre** : image en `object-fit: contain` (carrée 3 cols, pour ne plus cropper l'œuvre), carte identité avec **2 prix Courant + Préférentiel côte à côte** (calculés via `calculerPrixSuggere`) + badge statut, caractéristiques (Identification + Matériel en sous-sections), localisation et sujets, description, certificats avec leurs actions Voir/Dossier/Re-générer.
- **Fiche Client** : avatar navy + identité + 4 stats (achats / total dépensé / dernier achat / client depuis), coordonnées + bloc Loi 25 avec pastille verte/grise selon consentement, historique d'achat cliquable pleine largeur, notes.
- **Fiche Vente** : numéro de facture en titre + date + mode paiement, **tuile Total Deep Navy/Or** à droite avec montant grand et récap, œuvre + client en lignes cliquables, détails financiers en table-facture (rabais en terracotta, sous-total marqué, total souligné), documents avec icônes A (doré) et C (navy).
- **Page Réglages** : numérotation (8 col) + taxes & commission (4), sauvegardes (6) + affichage (3) + import (3), IA (6) + à propos (6). **Lien dossier cliquable** sur le chemin du dossier de données dans À propos (ouvre l'Explorateur via le nouvel IPC `app:ouvrir-dossier`).
- **Page Profil galerie** : 4 cartes 2×2 (Identité, Coordonnées, Fiscalité, Identité visuelle).
- **Page Outils** : Calculateur de prix (8 col) + Cotes de l'artiste (4 col) côte à côte.
- **Harmonisation finale** : titres de cartes en **Cormorant 24px gallery-navy**, sous-sections internes en **encarts soft-ivory + bordure mist** (au lieu de filets séparateurs), boutons de navigation Précédent/Suivant sans cadre.
- **5 IPC `*FicheBundle`** + IPC `app:ouvrir-dossier` ajoutés (`requetes.js`, `main.js`, `preload.js`). Chaque bundle charge en un appel tout ce que la fiche en lecture a besoin (entité + voisins + listes apparentées + stats).
- **Démos HTML standalone** dans `demos/` pour chaque page (artiste, œuvre, client, vente, réglages) — utilisées pour valider visuellement les mises en page à taille réelle avant l'intégration.

---

## Plan structuré — ce qui reste (organisé par dépendance)

> Axe unique : **la dépendance décide quoi faire quand.**
> **A** = faisable maintenant · **B** = bloqué sur les parents · **C** = grandes phases reportées.
> Le détail des questions à poser aux parents (axe B) vit dans `A-VALIDER.md`.
> Les numéros `#n` renvoient aux anciennes « demandes spontanées » pour la traçabilité.

### A — Faisable maintenant (aucune dépendance externe)

**Chantier 1 · Visibilité & navigation** — *prochain jalon « Visibilité » ; naît du jalon 3 + du stepper du tableau de bord*
- ~~**Section Suivi (#16)**~~ — **✓ Intégrée** : vue dédiée du cycle de vie complet (À préparer + Commandes en cours regroupés dans « Actif », onglet « Complétées »), bandeau de synthèse, stepper inline-éditable, paiement en menu déroulant, modales « Confirmer la livraison » / « Revenir en arrière ». Inclut l'étape de préparation **Stock** (Sage → Stock → Site).
- ~~**Œuvres en préparation sur le tableau de bord (#21)**~~ — **✓ Livré (v0.2.5)** : bloc « Œuvres en préparation » (Sage/Stock/Site) à l'accueil, **« Résumé du catalogue » retiré**, rangée du bas réordonnée (Préparation · Réservées · Commandes).
- ~~**Réservation d'œuvres**~~ — **✓ Livré (2026-06-20)** : réserver une œuvre disponible pour un **client** (requis) avec **date d'échéance** + **notes** ; carte **Réservation** sur la fiche (client, dates, badge d'échéance échue/bientôt) avec **« Convertir en vente »** (formulaire pré-rempli) et **« Libérer »**. Réservation effacée à la vente. Colonnes `reservation_*` sur `oeuvres` (migration), mutations `reserverOeuvre`/`libererOeuvre`, bloc tableau de bord « Œuvres réservées » enrichi (client + échéance). Démo `demos/reservation-oeuvre.html`. ⚠️ Non vérifié visuellement par Claude — **à confirmer par Dave**.
- ~~**Section Documents (#15)**~~ — **✓ Livré** : section dédiée qui réunit tous les PDF produits (certificats + factures artiste), groupés par année, filtrables par type, recherchables, avec actions Voir / Dossier / Re-générer. Requête `tousLesDocuments` (sources `certificats.pdf_path` + `ventes.facture_artiste_path` ; prêt à accueillir factures client / lettres).
- ~~**Rapport journalier (#17)**~~ — **✓ Livré** : section **Rapport** (sidebar) = journal d'une journée (sélecteur de date) — tuiles, ventes détaillées, intrants/extrants du jour, activité opérationnelle — **+ suivi opérationnel** (admissions en cours, ventes/livraisons en cours). **PDF Lettre** via gabarit autonome `gabarit-rapport.html` (IPC `rapport:pdf` → `printToPDF` 'Letter', polices système, fond blanc, nom horodaté). Inclut le **mécanisme de retrait** d'œuvres (remplace « Archiver » sur l'œuvre : bouton « Retirer » fiche + **retrait en lot** via mode sélection sur la liste ; vendues non retirables ; colonnes `retrait_date`/`retrait_motif`). ⚠️ **Connu (hors périmètre)** : le visionneur **Acrobat** affiche une erreur « Font Capture » quelques secondes après l'ouverture de **tout** PDF généré (certificats inclus) — environnemental, le PDF reste valide. À investiguer séparément (voir Chantier 3).
- ~~**Lot 4 — refonte de la section Documents**~~ — **✓ Livré** : la Section Documents réunit désormais **tous les types** depuis une **source hybride base + disque**. `indexerTousLesDocuments()` (`pdf.js`) = entrées riches base (certificats, factures artiste, annexes, présentations) **+ scan disque** de `Documents\{année}\{Type}\` (catalogues, rapports, pochettes, **versions modifiées**) ; IPC `documents:liste` rebranché. Vue `documents.js` réécrite : **groupement par type** (sous-séparateurs d'année), **barre de filtres permanente** (Type · Année · Artiste · Client) + recherche + Réinitialiser, **icônes SVG** par type (annexe dépôt rouge / retrait bleu), **pochettes dépliables** (Voir chaque doc / Ouvrir le dossier), **badge « version modifiée »**. Re-générer pour certificats + factures artiste ; Voir/Dossier pour les autres. **+ Vue « Explorateur »** en **bascule Liste/Explorateur** (mémorisée) : navigation dans l'arborescence réelle (Année → Type → fichiers ; Pochettes → client → facture), fil d'Ariane + remonter, recherche globale ; dossiers de type avec leur icône de type. Démos `demos/documents-refonte.html` + `demos/documents-explorateur.html`. ⚠️ Non vérifié visuellement par Claude (résolveur computer-use) — **à confirmer par Dave**.

**Chantier 2 · Modèle économique** — *partie non bloquée du jalon 4*
- ~~**Lot 1 — calculateur de commission**~~ — **✓ Livré** : outil dans la page **Outils** qui projette le **net versé à l'artiste après TPS/TVQ** (mêmes formules que la facture artiste). Sélecteur **Type d'œuvre** portant la cote (**Peinture 50 %**, **Sculpture 33 %**, **Reproduction 50 % après frais de production**, **Autre** = % libre) ; cases TPS/TVQ (taux depuis la config) ; rabais optionnels ; résultat = tuile « Montant versé à l'artiste » + détail + note commission galerie. **Reproduction** : la galerie récupère ses frais avant le partage 50/50 du net. Carte de référence « Commissions par type » à côté. (`src/app/vues/outils.js`, `src/styles.css`, démo `demos/calculateur-commission.html`.)
- **Nomenclature des factures** — définir le format des numéros de facture (basé sur la formule des images d'inventaire). **Dépend de Dave** (il apporte la formule) ; ensuite changement ciblé, numérotation reconfigurable, aucune migration de fond (cf. décision #16). Recoupe le point « format final des numéros (#7) » de l'axe B.
- **Commission par type d'œuvre — branchement sur la facture artiste** — **✓ Partiellement** : la **facture artiste applique maintenant la cote selon `oeuvres.type`** (Sculpture 33 %, tout le reste = défaut config 50 %), via `coteGaleriePourType()` dans `src/pdf.js` (`obtenirVente` ramène désormais `o.type AS oeuvre_type`). Couvre les deux chemins (génération + « version modifiée »). **Reste à faire pour les reproductions** : déduire les **frais de production** (la galerie les récupère avant le partage 50/50) — nécessite un **champ coûts de production persistant** (fiche œuvre ou vente, à trancher — voir A-VALIDER) **et** une adaptation du `gabarit-facture-artiste.html` (ligne frais + net). Tant que ce n'est pas fait, une reproduction est facturée à 50 % du plein prix.

**Chantier 3 · Polish & onboarding**
- ~~**Sélecteur de taille de vignette (#19)**~~ — **✓ Livré** : segmenté Petit/Moyen/Grand (190/240/300 px) dans Artistes et Œuvres (vue grille), mémorisé en localStorage (`oeuvres-taille`, `artistes-taille`). Composant partagé `gabaritSelecteurTaille` + variable CSS `--vignette-min`.
- ~~**Inverser les cartes Sujet et Commerce (#20)**~~ — **✓ Livré** : formulaire d'œuvre réagencé en Caractéristiques (8) + Commerce (4) ; Préparation (6) + Sujets (6).
- ~~**Avancement du splash (#18)**~~ — **✓ Livré** : barre dorée + libellé d'étape sur le splash (Ouverture base → Préparation photos X/N → Chargement → Prêt). Le splash s'affiche **avant** les étapes longues ; `seedPhotos` rendu asynchrone par lots pour que la barre avance réellement. Progression poussée via `executeJavaScript`.
- ~~**Section d'aide (#22)**~~ — **✓ Livré** : **bouton « ? » flottant** présent sur toutes les pages → **panneau latéral à deux volets** (recherche + catégories collapsibles à gauche, article complet à droite). **Base de connaissance ~65 articles** en 14 catégories (artistes, œuvres, cotes/prix, clients, ventes, documents, suivi, sauvegardes, réglages, sécurité, **problèmes courants**, glossaire, soutien) avec mots-clés pour la recherche (classée titre > mots-clés > contenu, surlignage), liens **« Voir aussi »**, encadrés astuce/attention. Contact dans un article **Soutien** + pied de colonne (version via `appInfos`, dossier via `ouvrirDossier`, courriel via `ouvrirUrl`). `src/app/aide.js` + CSS + câblage `app.js`. Démo `demos/aide-section.html`. **Tout local.** ⚠️ Non vérifié visuellement dans l'app par Claude (résolveur computer-use ne capte pas la fenêtre Electron de dev) — **à confirmer par Dave** (clic sur « ? »).
- ~~**Tutoriel de première ouverture (#13)**~~ — **✓ Livré** : visite **hybride** (diapo de bienvenue → coach-marks qui **font défiler les vraies sections** via le routeur → diapo finale). Étapes : Accueil, Artistes, Œuvres, + Ajouter, Ventes, Documents, Outils, Profil/Réglages, Aide. **Ouverture auto au 1er lancement** (marqueur `config.tutoriel_vu`), puis marqué vu. **Rejouable** via « Revoir le tutoriel » dans l'aide (#22). `src/app/tutoriel.js` (overlay réutilisable : spotlight + bulle + diapos, `attendreElement` avant de pointer) + CSS + câblage `app.js`/`aide.js`. Démo `demos/tutoriel-bienvenue.html`. ⚠️ Non vérifié visuellement par Claude (résolveur computer-use) — **à confirmer par Dave**.
- **Assistant d'aide par LLM (optionnel, futur)** — *évoqué 2026-06-19* : un assistant qui répond en langage naturel **à partir de la base d'articles (#22)**. Module **cloud opt-in** (Anthropic Haiku), clé API dans le coffre Windows, **n'envoie que la question + la base**, jamais de données client ; l'app reste fonctionnelle hors-ligne. À valider (coût, Internet) — voir aussi « Sur le radar » (évolution ChatGPT → API directe).
- ~~**Correction #356 « Chrysalide 1/30 »**~~ — **✓ Fait par Dave** (dimensions saisies à la main).
- **Migration des 2 pseudonymes** — « LO (Laurent Torregrossa) », « Sofia (Sophie Lebeuf) » (5 min dans l'app).
- **Bug connu — Acrobat « Font Capture »** — Acrobat affiche une erreur « Font Capture » quelques secondes après l'ouverture de **tout** PDF généré (le PDF reste valide). Environnemental. À investiguer (tester un autre visionneur comme Edge ; vérifier l'embarquement des polices dans `printToPDF`).

**Chantier 4 · Données & catalogue** — *gros ou risqué, à isoler*
- **Jalon 5 — renommage des photos** : sous-dossiers par artiste + déplacement/renommage physique des 500+ fichiers (générateur `src/db/nomenclature.js` déjà fait et testé). Sauvegarde préalable obligatoire. **Dépend des validations B** (codes-lettres, dimensions incomplètes).
- ~~**Édition en batch (#2)**~~ — **✓ Livré (2026-06-30, à confirmer par Dave)** : tableur multi-lignes sur la page Œuvres (édition cellule par cellule + remplissage groupé « Appliquer à la sélection »), bascule de mode via le bouton « Édition en lot », enregistrement transactionnel partiel (`oeuvres:modifier-lot` → `modifierOeuvresLot`) avec recalcul auto dimensions/format/orientation (override manuel préservé) et garde-fous (titre non vidable, statut validé, colonnes hors-liste ignorées). Pastilles de groupes de colonnes (Identité/Matériel/Commerce/Localisation). `listerOeuvres` enrichi (H/L/P, emplacement, exposition). Démo `demos/edition-batch.html`, module `src/app/vues/oeuvres-batch.js`. ⚠️ Vérifié en banc d'essai navigateur + tests unitaires de la mutation, **pas dans la fenêtre Electron** — à confirmer par Dave.

### B — Bloqué sur les parents (à poser en une seule conversation → `A-VALIDER.md`)

- **Gabarits & textes** : facture client (Phase 3D), lettre de remerciement + variantes par méthode d'achat (3D / jalon 4), mise en page de la présentation artiste.
- **Modèle éco** : liste complète des types d'œuvre + %, où saisir les coûts de repro, modes de paiement (échelonné ?), taxes par client étranger.
- **Cotes** : formule en po², unité par défaut, cotes par médium, marquage hors-normes, seuils de format.
- **Nomenclature** : codes-lettres réels (médium/support/signature), format final des numéros (#7), dimensions incomplètes (0 vs vide).
- **Divers** : Agenda (#14 — Outlook ?), résolution du moniteur (#5), signataire du certificat.

### C — Grandes phases reportées (quand l'app sera en service réel)

- **Phase 4 — Sage 50** : export CSV des ventes (import par les parents), lecture ODBC seule, import rétroactif des historiques Sage → app. **Jamais d'écriture dans Sage.** Voir CLAUDE.md §8. Lourd.
- **Phase 5 — Web** : publication d'œuvres vers WordPress/WooCommerce (= #4 « push web »). **Décision** : flux site → app uniquement, jamais app → site (crainte de couplage) → plutôt *pull* des descriptions WooCommerce. Voir CLAUDE.md §7.
- **Sécurité** : verrou léger (code court, verrouillage auto, code hashé), puis chiffrement de la base avec clé dans le coffre Windows.
- **Sur le radar** : paiements échelonnés mensuels, profil fiscal par client, ouverture auto de Sage après vente, autres types de produits (#6 — encadrements, impressions), évolution ChatGPT presse-papier → API directe (Anthropic Haiku).

---

## Décisions importantes prises pendant ces sessions

1. **`node:sqlite` (built-in de Node 24/Electron 42)** plutôt que `better-sqlite3`. Évite l'installation de Visual Studio Build Tools. Sans helper `db.transaction()` : utiliser BEGIN/COMMIT/ROLLBACK explicites.

2. **Identité du produit vs marque de la galerie séparées.** Galeria = nom du produit Windows. Galerie du Vieux Saint-Jean = marque affichée, modifiable via Profil galerie.

3. **Architecture photo en deux niveaux** : crop 800×800 pour affichage + original pleine résolution conservé en parallèle.

4. **Dialogues internes uniformes**, jamais de boîte Windows générique.

5. **Loi 25** : tout local, consentement courriel obligatoire, suppression possible.

6. **Sécurité de l'app reportée à sa propre phase**.

7. **Mode d'import « mettre à jour » disponible**, anti-doublons par nom/numéro d'inventaire.

8. **Champs de taxes par artiste** : liste de paires (étiquette, numéro) en JSON.

9. **Sauvegardes configurables** depuis les réglages.

10. **Gabarits PDF préparés à l'avance** avec placeholders `data.galerie`.

11. **Signataire du certificat par défaut : « Joanne Boucher, Galeriste »**.

12. **Pre-build seed** : DB + photos copiés depuis le dossier user de Dave au moment du build via `npm run prepare:assets`.

13. **Certificat indépendant de la vente** : `vente_id` nullable. Plusieurs certificats par œuvre possibles.

14. **Facture artiste vs facture client** — distinction conceptuelle stricte :
    - Facture artiste = artiste → galerie (la galerie la produit à la place de l'artiste). Numérotation **A-2026-xxx**.
    - Facture client = galerie → acheteur (Phase 3D). Numérotation **F-2026-xxx**.

15. **PDF auto-généré à la création d'un certificat**.

16. **Numérotation entièrement reconfigurable** : tous les compteurs ont préfixe + prochain numéro dans Réglages. Aucune migration nécessaire pour changer la nomenclature finale.

17. **Pays + subdivision dynamique** : Canada → 13 provinces, États-Unis → 51 états, autres → champ texte libre. Québec préselectionné.

18. **Refonte UI selon brief fourni** : Deep Navy + Soft Ivory + Warm Gold + Cormorant Garamond + Inter. Variables centralisées dans `theme.css`. Étape 8 (refonte des blocs et listes descriptives) annulée à 95 % — Dave préférait l'ancien look. Seul conservé : le grand titre des fiches en Cormorant 32px Ink.

19. **Dossier utilisateur renommé `GalerieApp` → `Galeria`** au démarrage. Migration automatique unique via `migrerAncienDossierSiPresent()` dans `paths.js`.

20. **Bouton Filtres dans la barre des contrôles de vue** (à côté de Tri), pas dans l'en-tête de page (où il est moins à sa place).

21. **Bouton Supprimer en outline rouge** (Dave préfère à fond plein, sauf le brief le voulait plein).

22. **Texte des boutons dorés en soft-ivory** (Dave préfère à Deep Navy).

23. **Polices embarquées localement** (pas Google Fonts à l'exécution) — fonctionne 100 % hors ligne.

24. **Formulaire client complet en modale large** (720px) lors de création depuis une vente, au lieu d'un mini-formulaire à 4 champs.

---

## Historique des jalons & journal de session

**État livré :** v0.3.0 publiée sur GitHub Releases, tout sur `master`. ⚠ **Les parents sont encore sur 0.2.0** (sans auto-update) — voir l'encadré « En une phrase » en tête.

### Jalons livrés (récap — détail complet dans `CHANGELOG.md`)

- **Jalon 1 (v0.2.2)** : nouveau gabarit de certificat, filtre des œuvres par format, URL de fiche web (504 importées), n° d'inventaire séquentiel **global**, chaînage de création d'œuvres (artiste existant ou nouveau).
- **Jalon 2 (v0.2.3)** : cotes & calcul de prix par artiste (médium × taille, po linéaire/carré ; formule courante `(prix_pref + 2) × base`), section **Outils** + calculateur de prix autonome, refonte **bento** des 7 pages principales.
- **Jalon 3 (v0.2.4)** : suivi du **cycle de vie** (préparation œuvre Sage/site + post-vente paiement/emballage/envoi/livraison, **éditables inline**), **garde-fou Sage** à la vente, champ **Style**, formulaires d'édition en bento, **générateur de nomenclature** (`src/db/nomenclature.js`).

### Décisions de design issues des tests

- **Galeria ne pousse pas vers WordPress.** Les parents craignent le couplage : si la maintenance Galeria ne suit pas, ils restent coincés. Tout flux site → app, jamais app → site.
- **Le numéro séquentiel d'inventaire est global** à la galerie, pas par artiste.
- **Hors-normes = override par œuvre**, pas une cote permanente sur l'artiste.
- **Commande non complétée = vente avec un statut post-vente non « terminé »**, à afficher en proéminence sur le tableau de bord.

### Hygiène et test

- **Tests des cotes chez les parents** : Dave doit configurer quelques artistes avec des cotes (P/M/G/TG ou Tous + exception), tester le calcul auto sur des œuvres existantes, vérifier que ça « colle » avec les prix manuels actuels.
- **Audit Loi 25** : confirmer que la fonction ChatGPT n'envoie que les données de l'œuvre (pas de client). Déjà vérifié côté code.
- **Tester les commandes avec la formule courante en po²** : valider avec les parents que `(prix_pref + 2) × surface` est la bonne formule, ou si pour le carré c'est plutôt `(prix_pref × surface) + 2 × (H+L)`. Voir `A-VALIDER.md`.

### Journal de session — 2026-06-17

- **Migration des dimensions** : 498 œuvres séparées du texte libre vers les colonnes **H/L/P** (`scripts/separer-dimensions.js`), texte régénéré au format de l'app, profondeur absente laissée **NULL**. #356 « Chrysalide 1/30 » laissée pour correction manuelle (données décalées). Sauvegarde auto avant écriture. Format/orientation existants non touchés.
- **Tableau de bord** : bloc « Commandes non complétées » — les 4 étapes passent des petits points à un **stepper étiqueté** (icône + libellé + connecteurs ; vert = fait, terracotta = partiel). Démo des 3 variations conservée dans `demos/commandes-non-completees.html`.
- **To-do enrichie** : #15 Section Documents, #16 Section Suivi, #17 Rapport journalier, #18 Avancement du splash.
- **Planning réorganisé** par axe de dépendance (A/B/C, voir « Plan structuré » plus haut) — les anciennes listes redondantes (roadmap 5 jalons, tableaux « faisable/en attente/reportées ») ont été fusionnées.
- **Section Suivi (#16) intégrée** : nouvelle entrée sidebar + vue `src/app/vues/suivi.js`, IPC `suivi:donnees`, requêtes `oeuvresAPreparer` / `ventesSuivi`. Édition inline via les IPC existants (`oeuvreMajPreparation`, `venteMajCycle`), modales sur `confirmer`. Démo `demos/suivi.html`.
- **Étape de préparation « Stock »** ajoutée (Sage → Stock → Site) : colonnes `stock_fait` / `stock_fait_date`, migration + backfill `user_version=2` (catalogue existant réputé en stock), partout dans la fiche œuvre + Suivi.
- **Droplist médium partagé** : composant extrait dans `commun.js` (`champMedium`, `brancherDropdownMedium`, `chargerMediumsConnus`) et appliqué à la fiche œuvre, au calculateur (Outils) et aux cotes (fiche artiste) — code unique.
- **Nouvelles demandes** : #19 sélecteur de taille de vignette, #20 inverser cartes Sujet/Commerce (form œuvre), #21 œuvres en préparation au tableau de bord (retirer le Résumé du catalogue).
- **Prochaines étapes possibles** : #21 (tableau de bord), Section Documents (#15), Rapport journalier (#17), ou les polish #19/#20.

### Journal de session — 2026-06-18

Grosse session de fonctionnalités, tout commité et fusionné sur `master`, **poussé sur GitHub** (origin/master à jour). Pas encore taggé/publié.

- **#21 — Bloc « Œuvres en préparation »** au tableau de bord (remplace le « Résumé du catalogue »), rangée du bas réordonnée (Préparation · Réservées · Commandes).
- **#19 — Sélecteur de taille de vignette** (Petit/Moyen/Grand) dans Artistes et Œuvres (grille), mémorisé.
- **#20 — Formulaire d'œuvre réagencé** : Caractéristiques (8) + Commerce (4) ; Préparation (6) + Sujets (6).
- **#18 — Avancement du splash** : barre + libellé d'étape, splash affiché avant les étapes longues, `seedPhotos` rendu asynchrone. Nouvelle image de splash (de Dave) commitée.
- **#15 — Section Documents** : index des PDF produits (certificats + factures artiste), groupés par année, filtrables, actions Voir/Dossier/Re-générer.
- **#17 — Section Rapport** : journal d'une journée (date) + **suivi opérationnel** (admissions en cours, ventes/livraisons en cours). **Export PDF Lettre** via gabarit autonome `gabarit-rapport.html`. #356 « Chrysalide » corrigée par Dave.
- **Mécanisme de retrait d'œuvres** : « Retirer » remplace « Archiver » sur l'œuvre (date + motif, réversible « Réintégrer », badge « Retirée », filtre « Inclure les retirées »). **Retrait en lot** via mode sélection sur la liste (bouton « Retirer » près de « + Ajouter »). Œuvre vendue non retirable. Colonnes `retrait_date` / `retrait_motif`.
- **Convention** : tous les documents générés sont en **format Lettre** (`printToPDF` `pageSize: 'Letter'`).
- **Bug connu (hors périmètre)** : Acrobat plante (« Font Capture ») quelques secondes après l'ouverture de tout PDF généré (certificats inclus) — environnemental, PDF valide. Tâche de fond créée pour l'investiguer (tester un autre visionneur comme Edge).
- **Prochaine étape recommandée** : **tagger + release** une nouvelle version (≥ v0.2.5) et la livrer aux parents en install manuelle (ils sont sur 0.2.0). Puis : commission par type d'œuvre, tutoriel de 1re ouverture, édition en batch, ou jalon 5 (photos).

### Journal de session — 2026-06-18 (suite — Lot 0 : quick wins + identité rouge)

Nouveau train de fonctionnalités planifié avec Dave, organisé en **lots**. Templates fournis **hors repo** (voir mémoire `reference-gabarits-documents`, dossier `F:\Galerie\Automatisation\Galeria\`) :

- **Lot 0** (✓ fait) : certificat doré → rouge, TVQ pré-remplie, validation numéros de taxes, sélecteur d'unité po/cm.
- **Lot 1** : calculateur de commission (projection nette artiste après TPS/TVQ).
- **Lot 2** (✓ fait) : **catalogue artiste** + **Annexes A dépôt/retrait** livrés.
  - **Catalogue** : bouton « Catalogue PDF » (fiche artiste) → `gabarit-catalogue.html` (portrait, 6 œuvres/page), `genererCataloguePdf`, requête `oeuvresPourCatalogue`. Vignette : n° inv · titre · dimensions · médium ; bas = prix si disponible, sinon « Non disponible ».
  - **Annexes A** : `gabarit-annexe.html` (unique, paramétré par `data.type` — dépôt **rouge #900001**, retrait **bleu #2a5c8a**), `genererAnnexePdf` (`pdf.js`), table `annexes` + `enregistrerAnnexe`/`majAnnexePdfPath` (mutations), requêtes `oeuvresDetailArtiste` (manuel) et `oeuvresParIds` (flux, **sans filtre archive** car le retrait met `archive=1`). Numéro **`A-{préfixe}-NNN`** séquentiel par artiste. Prix sans cadre/avec cadre via cotes (`construireLignesAnnexe`). Entrées : bouton « Annexe A… » (modale de sélection, `src/app/annexe.js`) + invites dans les flux (dépôt après ajout simple/fin de chaînage via `enchainement_ids` ; retrait après retrait simple/lot, une annexe par artiste).
  - **Classement des documents** refactoré : `Documents\{année}\{Type}\` pour tous les générateurs.
- **Lot 3** (✓ fait) : **pochette de vente**. Architecture : présentation artiste = document **autonome mis en cache** (réutilisé tant que le profil ne change pas, signature SHA1 des champs), réutilisée par la pochette ; lettre+œuvre = document par vente (8 variantes FR/EN × personne/web × cadeau).
  - **Étape 1 ✓** : champs de vente `type_achat` / `est_cadeau` / `langue` (migration + formulaire). Colonnes artiste `presentation_path` / `presentation_sig`.
  - **Étape 2 ✓** : **présentation artiste** — `gabarit-presentation.html` (design en frise : CV année/rubriques/listes, exergue + attribution, espacement guillemets, fond blanc), `genererPresentationPdf` avec cache (`signaturePresentation`), `majPresentationArtiste`, bouton « Présentation PDF » sur la fiche artiste. Démo `demos/presentation-design.html`.
  - **Étape 3 ✓** : `gabarit-lettre.html` — lettre de remerciement (8 variantes FR/EN × personne/web × cadeau, `choisirLettre`) + fiche de l'œuvre, **garantie sur une page** (auto-réduction `window.ajusterApresRendu`, hook appelé par `genererPdf`).
  - **Étape 4 ✓** : bouton **« Produire la pochette »** (`genererPochette`) + invite automatique après enregistrement d'une vente. Dossier **`Documents\{année}\Pochettes\{client}\{facture}\`** : lettre+œuvre, **certificat officiel** (généré directement dans la pochette via `cheminCertificatOfficiel`), présentation réutilisée (cache), guide fixe. Affichés sur la fiche de vente (Voir / Dossier).
  - **« Version modifiée » générique (WYSIWYG)** : `ouvrirEditeurDocument` (fenêtre éditable + `preload-editeur.js` + `INJECT_EDIT_JS`), dispatcher `editerDocument(spec)`, lanceur renderer `src/app/editer-document.js`. Disponible pour lettre/certificat/présentation/facture/catalogue/annexe. Pour un doc de pochette → remplace le fichier de la pochette.
  - **Suppression de vente** : blocage « certificats liés » retiré (détache les certificats) ; propose d'effacer le dossier de pochette (`supprimerDossierPochette`, garde-fou : seulement sous `Documents\…\Pochettes\…`) + supprime les certificats du dossier.
  - Notes : « distinctions » **intégré au CV** (pas de champ séparé), démarche incluse ; `guide_certificat.pdf` dans `gabarits/actifs/`. **Reste pour Dave** : nomenclature des factures (basée sur la formule des images — à reprendre).
- **Lot 4** : refonte de la section **Documents** (tous types, rangement clair).
- **Lot 5** (✓ fait) : refonte de la **hiérarchie de la sidebar** — Accueil détaché + groupes Catalogue (Artistes, Œuvres) / Ventes (Clients, Ventes, Suivi) / Archives (Documents, Rapport). Markup + CSS seulement (`src/index.html`, `src/styles.css`) ; `majSidebarActif` intact (cible `.entree-sidebar[data-vue]`, ignore les intitulés `<div>`). Maquette : `demos/sidebar-hierarchie.html`. **Retrait** des cartes de stats en haut de la liste des Œuvres (au passage).

**Lot 0 livré et testé par Dave (OK dans l'app) :**

- **Certificat** : accent doré `#b9912f` → **rouge GVSJ `#900001`** (6 occurrences + halo de focus). Amorce l'identité rouge commune à tous les documents.
- **Fiche artiste** : à la création, fiscalité pré-remplie avec **TPS + TVQ** (numéros vides). **Validation bloquante** à l'enregistrement pour TPS (`9 + RT + 4`) et TVQ (`10 + TQ + 4`), **espaces ignorés** ; autres étiquettes et champs vides non bloquants (champ en rouge + dialogue d'erreur si invalide).
- **Sélecteur d'unité po ⇄ cm** sur le calculateur de prix (Outils) **et** sur les dimensions de la fiche d'œuvre. **Source de vérité toujours en pouces** (`calcPo` / `dimPo`) : le toggle convertit l'affichage ; format/orientation/prix/sauvegarde utilisent les pouces. Réutilise le composant segmenté `.taille-vue`. Démo : `demos/outils-unite-mesure.html`. Décision : le « convertisseur » séparé devient un **sélecteur d'unité sur l'outil en place**.

### Journal de session — 2026-06-19 (Lots 2, 3, 5 + refonte fiche artiste)

Grosse session « documents ». **Tout commité localement** sur `claude/interesting-sanderson-54354e` (**11 commits d'avance sur `origin/master`, rien de poussé ni publié — Dave fermera la session et reprendra ailleurs**).

- **Lot 5 ✓** — refonte de la **hiérarchie de la sidebar** (Accueil détaché + groupes Catalogue/Ventes/Archives) ; retrait des cartes de stats en haut de la liste Œuvres.
- **Lot 0 ✓** — certificat doré → rouge `#900001`, TPS+TVQ pré-remplis + validation des numéros, sélecteur d'unité po/cm.
- **Lot 2 ✓** — **catalogue artiste** (PDF 6/page) + **Annexes A dépôt (rouge) / retrait (bleu)** (table `annexes`, numéro `A-{préfixe}-NNN`, manuel + déclenchements dans les flux ajout/retrait).
- **Lot 3 ✓** — **pochette de vente** : bouton + **invite après enregistrement d'une vente** ; dossier **`Documents\{année}\Pochettes\{client}\{facture}\`** réunissant lettre+œuvre (8 variantes, garantie 1 page), **certificat officiel** (rangé dans la pochette via `cheminCertificatOfficiel`), présentation réutilisée (cache), guide fixe. **Présentation d'artiste** + cache par signature. **« Version modifiée » WYSIWYG générique** (`ouvrirEditeurDocument` + `preload-editeur.js`, dispatcher `editerDocument`, `src/app/editer-document.js`) pour tous les documents ; pour un doc de pochette, remplace le fichier dans la pochette. Suppression de vente débloquée (détache les certificats) + propose d'effacer le dossier de pochette (et ses certificats).
- **Refonte fiche artiste ✓** — 3 niveaux (en-tête / contenu / gestion grisée), **valeur dispo masquée** (clic pour révéler, re-masquée à la sortie souris), carte Présentation à hauteur stable (scroll) + bouton **« ⤢ »** (modale Bio/Démarche/CV). Démo : `demos/artiste-fiche-hierarchie.html`. CSS dans `styles.css` (sélecteurs `.hero-artiste`, `.contenu-artiste`, `.gestion-artiste`).

**Reporté / à reprendre la prochaine session :**
1. **Pousser** la branche (`git push`) / préparer une **release** (≥ v0.2.6) — puis livraison manuelle aux parents (toujours sur 0.2.0, voir encadré en tête).
2. **Nomenclature des factures** — Dave doit donner la formule (basée sur celle des images d'inventaire).
3. **Lot 1** — calculateur de commission (net artiste après TPS/TVQ).
4. **Lot 4** — refonte de la **section Documents** (regrouper certificats, factures, catalogues, annexes, rapports, **pochettes**).

### Journal de session — 2026-06-19 (suite — Lot 1 + ménage du plan)

Reprise dans le worktree `angry-heyrovsky-02b716` (mis à niveau sur `master` par fast-forward). Commits sur `claude/angry-heyrovsky-02b716`, **en avance sur `master`** (à fusionner) — rien de poussé ni publié.

- **Ménage du plan structuré (ETAT)** : chantiers qui ne vivaient que dans les journaux remontés dans le plan (Lot 1, Lot 4, nomenclature des factures, bug Acrobat) ; **#21 marqué livré** (était listé à faire) ; en-tête « Historique » corrigé v0.2.4 → v0.3.0.
- **Trois chantiers consignés** (demande de Dave) : **#22 Section d'aide** (nouveau), **#13 Tutoriel 1ʳᵉ ouverture**, **#2 Édition en batch** — tous axe A, démo HTML d'abord.
- **Lot 1 — calculateur de commission ✓** : nouvel outil dans la page **Outils** (net versé à l'artiste après TPS/TVQ, mêmes formules que la facture artiste). Sélecteur **Type d'œuvre** portant la cote (Peinture 50 / Sculpture 33 / Reproduction 50 après frais / Autre), cases TPS/TVQ depuis la config, rabais optionnels, tuile « Montant versé à l'artiste » + détail + note commission. Carte de référence « Commissions par type ». Démo `demos/calculateur-commission.html`. **Décisions tranchées** (A-VALIDER) : % par type ; pour la reproduction, **la galerie récupère ses frais avant le partage 50/50** ; type d'œuvre pré-rempli depuis `artiste.type`.
- **Note technique** : un champ `.form-champ` avec l'attribut `hidden` restait visible (le `display:flex` de `.form-champ` écrasait `hidden`) → règle `.form-champ[hidden] { display:none }` ajoutée. À garder en tête pour tout champ masqué conditionnellement.

**Reste à reprendre :** nomenclature des factures (formule de Dave) ; brancher la **cote par type sur la vraie facture artiste** + champ **coûts de production persistant** (repro) ; livraison manuelle v0.3.0 aux parents ; Lot 4 ; chantiers #22/#13/#2.

---

### Journal de session — 2026-06-20 (v0.4.0 publiée)

Grosse session de fonctionnalités, **fusionnée dans `master` et publiée en release `v0.4.0`** sur GitHub. Travail fait dans le worktree `angry-heyrovsky-02b716`.

**Livré (v0.4.0) :**
- **Lot 1 — calculateur de commission** (Outils ; net versé à l'artiste après TPS/TVQ ; cote par type Peinture 50 / Sculpture 33 / Reproduction 50 après frais / Autre).
- **Cote par type sur la vraie facture artiste** (`oeuvres.type` → Sculpture 33 %, sinon défaut config 50 %).
- **Section d'aide (#22)** — bouton « ? » flottant + panneau cherchable, ~65 articles.
- **Tutoriel de bienvenue (#13)** — visite hybride qui fait défiler toutes les sections ; rejouable depuis l'aide ; auto au 1er lancement (`config.tutoriel_vu`).
- **Lot 4 — refonte Documents** (groupement par type, filtres, icônes SVG, pochettes dépliables, source hybride base + scan disque) **+ vue Explorateur** (bascule Liste/Explorateur).
- **Réservation d'œuvres** (client + échéance + notes ; convertir en vente / libérer ; bloc tableau de bord enrichi).
- Correctifs : fenêtre adaptée à l'écran, icône emballage (boîte de livraison), padding carte réservation, boutons du tutoriel.

**Release & livraison :**
- `master` = `93bc21b`, poussé. Release **v0.4.0** publiée (auto-update ≥ 0.2.1).
- **Build complet prêt** : `F:\Galerie\Automatisation\GalerieApp\dist\Galeria Setup 0.4.0.exe` (477 Mo, catalogue + photos) — pour l'install manuelle chez les parents (toujours sur 0.2.0). **Tester la migration 0.2.0 → 0.4.0 sur une copie de leur base avant.**
- ⚠️ **`npm run release` et `npm run build:complet` doivent être lancés depuis le worktree PRINCIPAL** `F:\Galerie\Automatisation\GalerieApp` (qui a `node_modules` + Electron 42.4.0). Le worktree `angry-heyrovsky-02b716` n'a **pas** de `node_modules` → electron-builder y échoue (« Cannot compute electron version »). `npm start` y a fonctionné parce que… [à vérifier] — de toute façon, **builder depuis le principal**.
- ⚠️ Tout le lot v0.4.0 est **non vérifié visuellement par Claude** (résolveur computer-use ne capte pas la fenêtre Electron de dev) — **à confirmer par Dave**.

**Reporté / à reprendre :**
1. **Nomenclature des documents** — *recensement fait* (voir `A-VALIDER.md` → « Nomenclature des numéros et des fichiers »). Prochaine session : **définir la nomenclature générale unifiée** (Dave apporte la formule des images d'inventaire) et l'appliquer dans `src/pdf.js`.
2. **Reproductions** — brancher les **frais de production** sur la facture artiste (champ persistant + gabarit).
3. **Édition en batch (#2)** — vue tableau multi-lignes.
4. **Livraison aux parents** — installer le build complet v0.4.0 + tester la migration.

### Journal de session — 2026-06-29 (v0.5.0 — nomenclature + numéro de certificat)

Session « nomenclature », étendue à une refonte du numéro de certificat. **Tout commité, fusionné dans `master`, publié en `v0.5.0`.** Travail dans le worktree `affectionate-vaughan-9fbd10`.

**Livré (v0.5.0) :**
- **Nomenclature unifiée des noms de fichiers** (style « lisible français » : `Type Numéro — Entité.pdf`, accents/espaces). Helper unique `nomDocument()` dans `src/pdf.js`, appliqué aux ~10 générateurs ; re-génération propre (suppression de l'ancien fichier renommé) ; relecteur disque (`indexerTousLesDocuments`/`_nomLisible`) tolérant aux **anciens noms** déjà produits. Décisions (Dave) : style lisible, **numéros continus**, documents sans numéro restés datés.
- **Préfixes** : facture artiste **FA-2026**, facture client **FC-2026** (migration douce dans `config.js` : seules les configs au défaut historique `A-2026`/`F-2026` migrent), annexes **AD-** (dépôt) / **AR-** (retrait).
- **Refonte du numéro de certificat** : `{n° inventaire}-{séquentiel artiste}-{n° Sage}` (sans année). **Séquentiel par artiste** (`certificats.seq_artiste`, MAX+1, anciens `C-` ignorés). **N° de facture Sage requis** (`certificats.numero_sage`, `ventes.numero_facture_sage`) : invite bloquante au formulaire de certificat (aperçu live), champ sur la vente (source unique, pré-remplit), pochette reprend le n° Sage de la vente. **Nom de fichier daté** `Certificat {n° inventaire} — titre (artiste) {AAAA-MM-JJ}.pdf` (doublon même-jour → suffixe « (2) »). Anciens certificats `C-2026-NNN` non renumérotés ; compteur global `C-2026` retiré pour les certificats. IPC `certificats:apercu`. Démo `demos/certificat-numero-sage.html`.
- **Correctif** : `supprimerOeuvre` vérifie désormais les **certificats liés** (refus clair au lieu de l'erreur FK brute) — révélé par les tests du nouveau flux.
- **Correction nomenclature des images** (`nomenclature.js`) : underscore dans le titre (`Sault_en_Provence`), conforme à la formule de référence.

**DB :** migrations additives `certificats.seq_artiste` / `numero_sage`, `ventes.numero_facture_sage` (+ `schema.sql`). Testées (schéma frais + migration sur base ancienne + idempotence) via `node:sqlite` en mémoire.

**Release & build :** `master` = `80d05fd`, tag `v0.5.0` poussés ; **release v0.5.0 publiée** (build public, auto-update ≥ 0.2.1) via `npm run release` depuis le worktree principal. ⚠️ Non vérifié visuellement par Claude — **à confirmer par Dave dans l'app**.

**Reste / ouvert :**
1. **Livraison aux parents** (sur 0.2.0) — install manuelle du **build catalogue** : nouveau script **`npm run build:catalogue`** (`scripts/build-seed-catalogue.js`) = base catalogue **sans** clients/ventes/certificats/annexes (cache de présentation effacé, **statut des œuvres conservé**) + **photos d'œuvres réorganisées par artiste et renommées** selon la nomenclature (`construireNomFichier`), `image_path` mis à jour. Sortie : `dist\Galeria Setup 0.5.0 (catalogue).exe` (~331 Mo). ⚠️ **Builder app fermée** + nettoyer les entrées de test du catalogue (ex. artiste « Dave Belisle ») avant la livraison finale. (Le générateur lit la source en lecture seule ; les données live ne sont jamais modifiées.)
2. **Facture client FC vs Sage** : le n° de facture vient-il de Sage ou l'app garde-t-elle son compteur FC ? À trancher en Phase 3D/4.
3. **Reproductions** (frais de production sur la facture artiste) ; **édition en batch (#2)**.
4. Détail : à confirmer si chaque copie d'une édition est une œuvre distincte (n° d'inventaire différent) → le nom de fichier pourrait alors être `Certificat {n° inventaire}` seul.

#### Installateur — refonte UX (même session, jusqu'à `master` `148a9ce`)

Long travail sur l'expérience d'installation du **build catalogue** (~313 Mo). Décisions et solution finale :

- **Identité** : installateur **assisté** (`oneClick: false`), **en français** (`nsis.installerLanguages: ["fr_FR"]`, pas de sélecteur), **visuels Galeria** (fond Deep Navy + « Galeria » doré) via `build/installerHeader.bmp` (150×57) + `build/installerSidebar.bmp` (164×314), convertis depuis `gabarits/actifs/installer-galeria-{grande,bandeau}.png` par `scripts/build-installer-images.js` (PNG→BMP 24 bits ; electron-builder les détecte automatiquement). **`runAfterFinish: false`** (l'app lancée automatiquement bloquait une désinstall immédiate). ⚠️ Branding = **produit Galeria**, pas la marque GVSJ (un commit `e10c85c` a mis le logo GVSJ par erreur, corrigé ensuite).
- **Le gros problème — gel à l'install ET à la désinstall** : l'installateur posait/supprimait **540 fichiers de photos un par un** (218 Mo) → interface gelée, **Annuler grisé**, des minutes. `compression: store` n'a **rien changé** (le coût est le nombre de fichiers + le scan antivirus par fichier, pas la compression « solide »). Une **barre animée est impossible** (l'UI est gelée pendant l'opération synchrone NSIS).
- **Solution retenue — paquet unique** : `scripts/pack-photos.js` empaquette tout `seed-photos/` en **un seul fichier `seed/photos.pack`** (format maison « GALPACK1 » : magie 8 o + longueur d'index uint32 LE + index JSON `[[cheminRelatif, taille], …]` + données concaténées), puis vide `seed-photos/`. L'installateur ne pose/supprime alors **qu'un fichier** → rapide. Au **1er lancement**, `src/db/seedPhotos.js` **déballe** le paquet vers `Documents\Galeria\Photos\` avec la **barre du splash** (« Préparation des photos X / N ») — le travail (538 fichiers) devient **visible et progressif**. `getSeedPackPath()` ajouté à `paths.js` ; repli sur l'ancien dossier `seed-photos/` conservé (compat/public). Empaquetage branché dans `prepare:assets:catalogue` **et** `:complet` ; `build-photos-seed-vide.js` (public) efface tout paquet résiduel. **Photos en pleine résolution inchangées** (exigence : la galerie en a besoin au-delà de l'app).
- **Faux problème de test** : « chaque install de plus en plus longue » = **charge système accumulée** par les cycles install/désinstall/fermeture-forcée répétés (verrous de fichiers, antivirus, file d'attente). **Un simple redémarrage a tout réglé** — l'installateur était sain. Vérifié au passage : disque OK (494 Go libres), dossier d'install propre (pas d'accumulation de résidus).
- **Détection auto du catalogue livré** (`master` `0343d2c`) : résout le piège du déploiement (les parents ont déjà une base 0.2.0 → le seed catalogue n'était jamais appliqué). Chaque build catalogue est **tamponné** (`meta.catalogue_id`, `INSERT` dans `build-seed-catalogue.js`). Au démarrage (`app.js` → `catalogue-livraison.js`), si l'ID embarqué ≠ celui de la base de l'utilisateur (ou base ancienne sans tampon) **et** pas déjà refusé → **dialogue interne** « Charger le nouveau catalogue ? ». Oui → IPC `catalogue:charger` : **sauvegarde** `Sauvegardes\galerie-avant-catalogue-{stamp}.db`, fermeture base, remplacement par le seed, `forcer_photos_catalogue=true`, **redémarrage** ; au redémarrage, `seedPhotosIfNeeded({forcer:true})` re-déballe les photos (splash). **Garde-fous** : jamais d'écrasement silencieux (sauvegarde + question) ; build public = seed vide sans tampon → **jamais de proposition** (auto-update sûr) ; refus mémorisé (`config.catalogue_refuse`). Table `meta` (schema + migration), `lireCatalogueId()` dans `database.js`.

### Journal de session — 2026-06-30 (Édition en lot des œuvres)

Session « édition en batch (#2) », démo HTML d'abord (préférence Dave), puis intégration. Travail dans le worktree `flamboyant-elion-d27838`. **Rien poussé ni commité** (en attente du feu vert de Dave).

- **Démo validée par Dave** : `demos/edition-batch.html` — tableur multi-lignes, édition cellule par cellule, « Appliquer à la sélection », groupes de colonnes, barre « Enregistrer tout ». (Le gel des 1res colonnes a été retiré : `sticky` + masquage de colonnes se combinent mal en CSS ; raffinement possible plus tard.)
- **Intégration dans l'app** :
  - **Mutation** `modifierOeuvresLot(modifs)` (`src/db/mutations.js`) — UPDATE **partiel** par ligne en **une transaction** (BEGIN/COMMIT/ROLLBACK), whitelist `COLS_LOT_AUTORISEES`, **recalcul auto** dimensions/format/orientation quand H/L/P changent (helpers `calculerFormat`/`calculerOrientation`/`formaterDimensionsTexte` ajoutés côté serveur, override manuel du format préservé), validations (titre non vidable, statut). IPC `oeuvres:modifier-lot` (`main.js`) + API `oeuvresModifierLot` (`preload.js`).
  - **Requête** `listerOeuvres` enrichie : `hauteur, largeur, profondeur, emplacement, exposition_actuelle` (l'éditeur en a besoin ; la liste normale les ignore).
  - **Vue** `src/app/vues/oeuvres-batch.js` (`monterEditeurLot`) + CSS `.editeur-lot` / `.mode-lot` dans `styles.css`. Bascule via un bouton **« Édition en lot »** injecté dans l'en-tête de la page Œuvres (`oeuvres-liste.js`) ; en mode lot, l'en-tête/contrôles de la liste sont masqués et l'éditeur prend la place ; « Quitter » recharge les œuvres (reflète les enregistrements) avec garde-fou si modifications non enregistrées.
- **Tests** : mutation testée en isolation (`node:sqlite` en mémoire, stub de `database`) — 17/17 (maj partielle, recalcul dims, format manuel préservé, rollback sur statut invalide, whitelist, titre vide refusé). Module renderer testé en **banc d'essai navigateur** (import réel + `window.api` stubé) : rendu, édition inline + batch, **payload IPC exact** `[{id, champs}]`, masquage de groupe, quitter. ⚠️ **Pas vérifié dans la fenêtre Electron** (résolveur ne la capte pas) → **à confirmer par Dave**.
- **Reste / ouvert** : inchangé (reproductions, facture client FC vs Sage, détail nomenclature d'édition) ; livraison aux parents toujours côté Dave.

---

## Notes techniques pour l'intervenant suivant

- **Aucune commande de build automatique requise** au quotidien. `npm start` lance l'app en dev.
- **Build final** = `npm run build` (génère icône via pngjs, copie DB+photos depuis `Documents\Galeria\`, package via electron-builder). Mode Développeur Windows requis (symlinks).
- **Variantes de build** : `build:complet` (catalogue + photos, données live telles quelles) · `build:public` (DB vide + sans photos, utilisé par `release`) · **`build:catalogue`** (catalogue sans clients/ventes/certificats/annexes, statut des œuvres conservé, **photos d'œuvres classées par artiste et renommées** via `scripts/build-seed-catalogue.js`). Toutes lisent `Documents\Galeria\` en lecture seule ; **fermer l'app avant** pour un seed net.
- **Photos embarquées = paquet unique** : `scripts/pack-photos.js` empaquette `seed-photos/` → **`seed/photos.pack`** (un seul fichier, format « GALPACK1 »), puis vide `seed-photos/`. Branché dans `prepare:assets:catalogue` et `:complet`. Au 1er lancement, `src/db/seedPhotos.js` déballe le paquet vers `Documents\Galeria\Photos\` avec la barre du splash. **Raison** : poser 540 fichiers individuels via NSIS gèle l'install/désinstall (scan antivirus par fichier) ; un seul gros fichier est rapide. `getSeedPackPath()` dans `paths.js`.
- **Config installateur (`nsis`)** : assisté (`oneClick:false`), **français** (`installerLanguages:["fr_FR"]`), `runAfterFinish:false`, visuels `build/installer{Header,Sidebar}.bmp` régénérés par `scripts/build-installer-images.js` depuis `gabarits/actifs/installer-galeria-*.png`. Renommer la sortie `dist\Galeria Setup X.Y.Z.exe` (le build catalogue écrase le build public local — la release GitHub reste intacte).
- **Migrations DB** : ajouter dans `src/db/migrations.js` (additif). Modifier aussi `src/db/schema.sql` pour les installations fraîches.
- **Config** : ajouter un champ dans `DEFAULTS` de `src/config.js`. Le merge récursif gère le hot-add.
- **Dialogues** : `import { confirmer, alerter } from '../dialogue.js'`.
- **Flux import** : `import { fluxImport } from '../flux-import.js'`.
- **Photos** : URL via `urlPhoto(cheminRelatif)` qui produit `galerie://photos/...` (protocole défini dans `main.js`).
- **PDFs** : générés via `src/pdf.js`. Sortie dans `Documents\Galeria\Documents\{annee}\`. Ouvre dans visionneur via `shell.openPath`, dossier via `shell.showItemInFolder`.
- **Sidebar dynamique** : `majSidebarActif(nomVue)` dans `marque.js`, appelée automatiquement par le router. Ajouter à `SECTIONS_NAV` pour une nouvelle section.
- **Pays/subdivision** : `champPays` + `champSubdivision` + `brancherChangementPays` dans `commun.js`.
- **Variables visuelles** : toutes dans `src/theme.css`. Aucune valeur en dur dans `styles.css`.
- **Polices** : embarquées dans `src/fonts/`. Déclarées via `@font-face` au sommet de `theme.css`.
- **Préférences UI persistées** (vue grille/liste, tri) : `localStorage` (clés `oeuvres-vue`, `oeuvres-tri`, `artistes-vue`, `artistes-tri`).
- **Release** : `npm run release` (script `scripts/release.js`) récupère le token via `gh auth token` (GitHub CLI installé + `gh auth login` fait une fois), bâtit le public et publie sur GitHub Releases. **Plus aucun token à manipuler.** Bumper `package.json` + `git tag` + push avant.
- **Nomenclature des fichiers photo** : `src/db/nomenclature.js` → `construireNomFichier(oeuvre)`. Forme `(numéro_inventaire)-(titre slug)-(formatL)(HxLxP)-(médiumL)(supportL)-(signatureL)(année)`. Codes = 1re lettre de chaque mot sans accent. Utilisé par le garde-fou Sage ; à réutiliser pour le déplacement physique des photos (Jalon 5).
- **Bento (fiches + formulaires)** : grille `.grille-bento` (12 col) + cartes `.carte` avec spans `.span-N`. Les cartes de formulaire ont leur padding via `.formulaire .grille-bento > .carte`. Photo/image d'édition : `.zone-photo-edition` / `.zone-image-edition` (3 col) avec overlay d'icônes `.photo-action-btn`.
- **Suivi cycle de vie inline** : IPC `oeuvreMajPreparation(id, data)` et `venteMajCycle(id, data)` font un UPDATE partiel ; le renderer recharge le bundle et redessine après chaque changement.
- **Migrations versionnées** : `PRAGMA user_version` sert maintenant de marqueur pour les backfills ponctuels (version 1 = backfill Sage/site du jalon 3). Incrémenter pour un nouveau backfill unique.
- **Git** : 3 commits sur master. Branche `sauvegarde-avant-ui` (`57d95b0`) comme point de retour pour annuler la refonte en cas de besoin (`git checkout sauvegarde-avant-ui`).
- **Mémoires importantes** déjà enregistrées dans `C:\Users\Dave\.claude\projects\F--Galerie-Automatisation-GalerieApp\memory\` (rôle Dave, modèle déploiement, catalogue pré-construit, actifs de marque, choix SQLite).
