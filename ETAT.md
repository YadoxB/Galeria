# État du projet Galeria — Sauvegarde de session

> Document à lire en début de nouvelle conversation, après `CLAUDE.md`, pour reprendre le projet là où il en est.
> Date de cette sauvegarde : 2026-06-17.
>
> **Voir aussi** : `CHANGELOG.md` (historique versionné détaillé) et `A-VALIDER.md` (questions ouvertes avec les parents).

---

## En une phrase

L'application **Galeria** pour la **Galerie du Vieux Saint-Jean** est livrable et installée chez les parents. **v0.2.3 publiée** sur GitHub Releases (refonte bento des 7 pages + jalon 2 cotes). **v0.2.4 en cours sur la branche `claude/practical-payne-6f7562`** (non taggée) : jalon 3 (suivi cycle de vie + garde-fou Sage), champ Style, formulaires d'édition en bento, suivi inline-éditable, générateur de nomenclature. Reste le jalon 4 (pack de vente) et le jalon 5 (réorganisation/renommage des photos), plus les phases reportées (Sage, web, sécurité).

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

## Ce qui reste à faire

### Phase 3D — Documents complémentaires (en attente d'exemples)

- **Facture client** (galerie → acheteur, émise au moment de la vente). À concevoir une fois que Dave aura un exemple/template. Distincte de la facture artiste. Numérotation F-2026-xxx déjà prête.
- **Lettre de remerciement** : nom du client, mention de l'œuvre achetée, ton chaleureux, signature. Plus simple, mais texte par défaut à définir.

### Phase 4 — Pont Sage 50 (reportée)

Voir CLAUDE.md section 8. Inclut import des historiques de ventes Sage → app.

### Phase 5 — Publication web (reportée)

WordPress + WooCommerce. Voir CLAUDE.md section 7.

### Sécurité (reportée comme phase dédiée)

- Verrou léger d'app avec code court, verrouillage auto, code hashé.
- Plus tard : chiffrement de la base avec clé dans le coffre Windows.

### Demandes spontanées en attente

**Plus anciennes (depuis premières sessions)** :
1. ~~**Splash screen** au démarrage avec logo Galeria, version.~~ **Livré en v0.2.0** : fenêtre 600×338, `gabarits/actifs/splash-galeria.png`, version en doré italique avec fade-in, durée min 1,2 s, filet de sécurité 8 s.
2. **Consultation/édition en batch** des tables (vue tableau pour modifier plusieurs lignes).
3. ~~**Archiver une/des fiches**~~ **Livré en v0.2.0** : voir section « Archivage des fiches » au-dessus.
4. **Push d'infos vers le site web** (recoupe Phase 5).
5. **Validation des dimensions de fenêtre** pour l'écran réel des parents (actuellement 1600×900). Idéalement à voir sur place.
6. **Plus tard** : intégrer d'autres types de produits (encadrements, impressions).
7. **Nomenclature finale des numéros** (factures, certificats, inventaires) : Dave doit obtenir les formules de ses parents. L'app utilise des préfixes/compteurs configurables — aucune migration nécessaire.

**Nouvelles demandes (sessions récentes)** :
8. ~~**Réglages d'application** (taille d'affichage).~~ **Livré en v0.2.0** : section « Affichage » dans Réglages, sélecteur 6 niveaux (80-150 %), preview live via `webContents.setZoomFactor()`, persistance dans `config.affichage.zoom`, réappliqué à chaque démarrage.
9. **Mécanisme de mise à jour automatique** (push updates) : explorer electron-updater ou équivalent pour livrer les nouvelles versions aux parents sans qu'ils aient à réinstaller manuellement.
10. ~~**Page d'accueil avec vue d'ensemble**.~~ **Livré en v0.2.0** : voir section « Tableau de bord » au-dessus.
11. ~~**Descriptions d'œuvres générées par IA**.~~ **Livré en v0.2.0** (mode presse-papier vers ChatGPT existant des parents) : voir section « Intégration ChatGPT » au-dessus. Évolution possible vers une intégration API directe (Anthropic ou OpenAI) si le volume le justifie.
12. ~~**Section « À propos » dans les réglages**.~~ **Livré en v0.2.0** : nom de l'app, version (`app.getVersion()`), marque, dossier des données, moteur (Electron + plateforme), copyright Loi 25.
13. **Tutoriel de première ouverture** : flux d'accueil guidé qui présente les sections principales et leurs actions courantes. À déclencher au premier lancement, accessible ensuite depuis Réglages ou Aide.
14. **Intégration Agenda** : bloc placeholder en place dans le tableau de bord. Les parents utilisent probablement Outlook ; à confirmer puis explorer (lecture iCal local, sync Microsoft Graph, ou autre).

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

## Prochaine étape concrète (après tests chez les parents — 2026-06-16)

**État livré :**
- v0.2.0 installée chez les parents et testée en conditions réelles.
- v0.2.1 publiée sur GitHub Releases (https://github.com/YadoxB/Galeria/releases/tag/v0.2.1) avec electron-updater intégré. À installer manuellement chez les parents pour activer le mécanisme d'auto-update.

**Feedback issu des tests** : refonte importante du modèle économique (cotes), nouveaux outils (calculateur de prix, catalogue), suivi cycle de vie, pack de vente enrichi. Roadmap en 5 jalons ci-dessous.

### Roadmap des 5 jalons (synthèse des modifications post-tests)

### Jalon 1 — Livré en v0.2.2

- ~~Sceau du certificat repositionné~~ → **Nouveau gabarit complet** intégré depuis `certificat_outil_GVSJ_9.html` fourni par Dave, avec fonction `remplir(data)` qui pilote les inputs du panneau de saisie depuis les données de Galeria. Le template reste utilisable en standalone. Polices Garamond externalisées vers `actifs/` pour éviter un crash Acrobat à la fermeture (problème connu avec polices base64 ré-embarquées par printToPDF).
- ~~Filtre des œuvres par taille~~ → 4 chips (Petit / Moyen / Grand / Très grand) dans le panneau Filtres.
- ~~URL de la fiche sur le site~~ → champ dans le formulaire + bouton « Voir sur le site › » sous le prix dans la fiche en lecture. **504 URLs importées depuis Airtable** via script dédié `scripts/import-urls-oeuvres.js` (matching par numéro d'inventaire, sauvegarde automatique).
- ~~Numéro séquentiel d'inventaire global~~ → ajustable dans Réglages → Documents. Pré-rempli sur le formulaire d'œuvre (préfixe artiste + numéro), incrémenté seulement si la valeur suggérée n'est pas modifiée à la main.
- ~~Chaînage œuvres pour artiste existant~~ → bouton **« + Ajouter d'autres œuvres »** sur la fiche artiste. Et sur la liste Œuvres, le bouton « + Ajouter une œuvre » ouvre une modale qui demande l'artiste (avec option **✦ Nouvel artiste…** en tête) — si nouvel artiste choisi, redirige vers la fiche de création d'artiste qui chaîne ensuite vers les œuvres.

### Jalon 2 — Livré en v0.2.3 (en cours, pas encore taggée)

- ~~Modèle de données cotes par artiste~~ → colonne `cotes` (JSON) sur artistes + colonne `cote_hors_normes` (INTEGER) sur oeuvres. Chaque entrée = `{ medium, taille, unite, prix_pref }`. Liste vide acceptée (= pas de calcul auto, prix saisi à la main comme avant).
- ~~Calcul automatique~~ → module `src/app/calcul-prix.js`. **Formule courante** = `(prix_pref + 2) × base` : le 2 $ s'ajoute à la cote (par unité), pas au prix total. Sur cote en $/po linéaire ça revient au même qu'un supplément linéaire ; sur cote en $/po² ça creuse l'écart. **À reconfirmer avec les parents pour les po²** (noté dans `A-VALIDER.md`).
- ~~Matching de cote~~ → priorité explicite : exact médium + exact taille > Tous + exact taille > exact médium + Tous > Tous + Tous. **Insensible à la casse et aux accents** (« Acrylique » = « acrylique »).
- ~~UI section Cotes~~ sur fiche artiste : éditeur ligne-par-ligne, dropdown custom pour le médium (input texte libre + bouton ▾ qui ouvre une liste **complète, scrollable**, séparée en « Médiums de cet artiste » et « Autres médiums » avec « Tous » épinglé). Encart pliable « Ordre de priorité » qui explique la logique.
- ~~Prix suggéré sur fiche œuvre~~ → bloc doré sous le champ Prix régulier qui montre le prix courant avec formule détaillée. **Auto-appliqué au champ** dès que dimensions / médium / format / artiste sont remplis ; si l'utilisateur écrase la valeur, l'auto-fill arrête (détecté par comparaison à la dernière valeur appliquée). Bouton **« Réappliquer »** pour revenir au calculé.
- ~~Switch « Cote hors-normes »~~ sur l'œuvre : si coché, vide le prix et masque le bloc suggéré.
- ~~Section Outils~~ : nouvelle entrée dans la sidebar (en bas avec Réglages, séparée par une fine ligne dorée). Première page : **calculateur de prix autonome** (artiste + dimensions + médium optionnel → prix courant + préférentiel + formule + grille des cotes configurées de l'artiste).
- Sidebar segmentée en deux blocs visuellement séparés : haut = Accueil/Artistes/Œuvres/Clients/Ventes ; bas = Outils/Réglages ; pied = Profil.

### Jalon 3 — Suivi cycle de vie (1-2 jours)
- Statuts manuels de préparation : créé dans Sage (oui/non + date), créé sur le site (oui/non + date).
- Statuts manuels post-vente : paiement (statut + date), emballage (date), envoi (date), livraison (date).
- Bloc « Commandes non complétées » sur le tableau de bord (œuvres vendues dont les statuts post-vente ne sont pas tous à « complété »).

### Jalon 4 — Pack de vente complet (3-4 jours)
- **Présentation artiste** : PDF élégant de plusieurs pages (8.5×11) avec bio, démarche, CV, distinctions, photos d'œuvres représentatives. **Indépendant des ventes** — utile aussi pour démarchage, expositions, etc.
- **Catalogue artiste** : PDF 6 œuvres/page, indépendant des ventes (la galerie en imprime à la demande).
- **Lettre de remerciement personnalisée** selon méthode d'achat (web, en personne, cadeau, autres). Variantes de texte à venir de Dave.
- **Commission galerie selon type d'œuvre** : 50 % toiles, 33 % sculptures, 50 % reproductions après coûts (champ « coûts de production » sur la fiche d'œuvre).
- **Bundle PDF de vente** : certificat + facture artiste + présentation artiste + lettre de remerciement (et facture Sage en pièce jointe manuelle).

### Jalon 5 — Réorganisation des photos (2 jours, à faire en dernier car risqué)
- Sous-dossiers par artiste dans `Documents\Galeria\Photos\`.
- Renommage formulé : `(code 3 lettres)(num séq)-(titre slug)-(formatLettre)(HxLxP)-(médiumLettre)(supportLettre)-(emplSignature)(année)`. Exemple : `CLD1992-Entre-le-vent-et-la-mer-M30x30x.75-AT-BD2023`.
- Migration des 500+ photos existantes, avec sauvegarde préalable.

### Reporté plus tard (mais sur le radar)

- **Suivi des paiements échelonnés mensuels** sur 12 mois (modes « payer maintenant » / « payer plus tard » / « paiements échelonnés »).
- **Profil fiscal par client** : taxes activables/désactivables, taux personnalisés (pour ventes à l'étranger). S'applique à toutes les ventes du client.
- **Pull des descriptions depuis le site WooCommerce** (au lieu de push vers WordPress). À cadrer ; risque de couplage à minimiser.
- **Ouverture automatique de Sage** après l'enregistrement d'une vente dans Galeria (juste un `shell.openPath` sur l'exe de Sage).
- **Tutoriel de première ouverture** (toujours dans la liste mais non urgent).
- **Mises à jour automatiques** ✓ livrées en v0.2.1.

### Décisions de design issues des tests

- **Galeria ne pousse pas vers WordPress.** Les parents craignent le couplage : si la maintenance Galeria ne suit pas, ils restent coincés. Tout flux site → app, jamais app → site.
- **Le numéro séquentiel d'inventaire est global** à la galerie, pas par artiste.
- **Hors-normes = override par œuvre**, pas une cote permanente sur l'artiste.
- **Commande non complétée = vente avec un statut post-vente non « terminé »**, à afficher en proéminence sur le tableau de bord.

### Faisable tout de suite (sans dépendance externe)

| Priorité | Tâche | Note |
|---|---|---|
| **Reco** | **Tag + release v0.2.4** | La branche `claude/practical-payne-6f7562` contient le jalon 3 + Style + formulaires bento + nomenclature, commités mais pas taggés. Une fois Dave satisfait, bumper `package.json` en `0.2.4`, `git tag v0.2.4`, pousser, puis `npm run release` (gh CLI déjà configuré → plus de token à gérer). |
| **Reco** | **Jalon 4 — Pack de vente** | Présentation artiste PDF, catalogue artiste PDF, lettre de remerciement par méthode d'achat, commission par type d'œuvre, bundle PDF de vente. Détaillé plus bas. En attente de templates/textes des parents pour certains documents. |
| | **Jalon 5 — Renommage des photos** | Le générateur de nom est **déjà fait** (`src/db/nomenclature.js`, testé). Reste : sous-dossiers par artiste (décidé) + renommage physique des fichiers existants avec sauvegarde préalable. Risqué — à faire isolément. |
| | **#13 Tutoriel de première ouverture** | Overlay guidé qui présente les sections au 1er lancement. Quelques décisions de design. |
| | **#2 Édition en batch** (vue tableau) | Gros morceau qu'on a reporté plusieurs fois. Toujours là. |
| | **Migration manuelle des 2 pseudonymes** | « LO (Laurent Torregrossa) » et « Sofia (Sophie Lebeuf) » dans les fiches artistes — 5 minutes dans l'app. |

### En attente d'input externe

| Tâche | Manque |
|---|---|
| **Phase 3D — Facture client** | Exemple ou template des parents |
| **Phase 3D — Lettre de remerciement** | Exemple ou template des parents |
| **#7 Nomenclature finale des numéros** | Les formules réelles des parents (factures, certificats, inventaires) |
| **#14 Intégration Agenda** (placeholder en place) | Confirmation : Outlook ou autre ? |
| **#5 Dimensions de fenêtre** | Résolution du moniteur de tes parents (actuellement 1600×900) |

### Phases majeures reportées

| Phase | Portée |
|---|---|
| **Phase 4 — Sage 50** | Pont comptabilité (export → CSV pour import dans Sage, lecture ODBC seule). Inclut import des historiques de ventes Sage → app (alimentation rétroactive de l'historique des clients). Lourd. |
| **Phase 5 — Web** | Publication d'œuvres vers le site WordPress/WooCommerce. Recoupe la demande #4 « Push d'infos vers le site ». |
| **Sécurité** | Verrou léger avec code court, verrouillage auto après inactivité, chiffrement de la base avec clé dans le coffre Windows. À programmer quand l'app sera en service réel. |

### Plus tard / à valider

- **#6 Autres types de produits** (encadrements, impressions) — élargir le modèle d'œuvre ou ajouter une table « produits ».
- **Évolution ChatGPT presse-papier → API directe** si les parents trouvent le presse-papier pénible à l'usage (Anthropic Haiku recommandé).

### Hygiène et test

- **Tests des cotes chez les parents** : Dave doit configurer quelques artistes avec des cotes (P/M/G/TG ou Tous + exception), tester le calcul auto sur des œuvres existantes, vérifier que ça « colle » avec les prix manuels actuels.
- **Audit Loi 25** : confirmer que la fonction ChatGPT n'envoie que les données de l'œuvre (pas de client). Déjà vérifié côté code.
- **Tester les commandes avec la formule courante en po²** : valider avec les parents que `(prix_pref + 2) × surface` est la bonne formule, ou si pour le carré c'est plutôt `(prix_pref × surface) + 2 × (H+L)`. Voir `A-VALIDER.md`.

**Recommandation pour la prochaine session :**
1. **Tag + release v0.2.4** pour livrer aux parents le jalon 3 (suivi cycle de vie + garde-fou Sage), le champ Style et les formulaires bento. Le workflow release est maintenant `npm run release` via gh CLI (aucun token à manipuler — voir Notes techniques).
2. Puis attaquer le **jalon 4 — pack de vente** (documents PDF, commission par type), ou le **jalon 5 — renommage des photos** (le générateur de nom est déjà fait, reste le déplacement physique).

**État de la session 2026-06-17 (suite) :**
- Jalon 3 livré et testé chez Dave : cartes Préparation (œuvre) et Suivi cycle de vie (vente) **éditables en place** sans passer par « Modifier », bloc « Commandes non complétées » sur le tableau de bord.
- Garde-fou Sage : la vente d'une œuvre non créée dans Sage est refusée, avec un message qui donne le **nom de référence complet** (nomenclature). Le catalogue existant a été backfillé (`sage_cree = 1`, `site_publie = 1`) via `PRAGMA user_version`.
- Champ Style (Figuratif / Abstrait / Mi-Figuratif) ajouté partout (form, lecture, filtre).
- Formulaires d'édition artiste + œuvre passés en bento, photo compacte à icônes, sujets en chips, photo ajoutable dès la création d'artiste.
- À reconfirmer avec les parents : la nomenclature sur de vraies œuvres (codes-lettres médium/support/signature corrects ?), et la proposition pour dimensions incomplètes (0 en remplacement d'une H/L manquante).

---

## Notes techniques pour l'intervenant suivant

- **Aucune commande de build automatique requise** au quotidien. `npm start` lance l'app en dev.
- **Build final** = `npm run build` (génère icône via pngjs, copie DB+photos depuis `Documents\Galeria\`, package via electron-builder). Mode Développeur Windows requis (symlinks).
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
