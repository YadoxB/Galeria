# État du projet Galeria — Sauvegarde de session

> Document à lire en début de nouvelle conversation, après `CLAUDE.md`, pour reprendre le projet là où il en est.

---

## En une phrase

L'application **Galeria** (anciennement « GalerieApp ») pour la **Galerie du Vieux Saint-Jean** est fonctionnelle pour la consultation, l'édition, la création et la suppression complète du catalogue (artistes, œuvres, clients), pour **l'enregistrement des ventes**, l'**émission des certificats d'authenticité** et l'**émission des factures artiste** avec génération automatique des **PDF** finaux. Il reste à concevoir les documents complémentaires (facture client, lettre de remerciement), puis viendront le pont Sage 50 et la publication web.

---

## Ce qui est fait

### Phase 1 — Fondations (livrée)

- App Electron en français, fenêtre 1200×800.
- Base SQLite via **`node:sqlite` (PAS `better-sqlite3`)** — voir « Décisions importantes ».
- Dossier de données utilisateur sur `Documents\GalerieApp\` avec sous-dossiers `Sauvegardes\`, `Photos\` (avec `Photos\artistes\originaux\`) et **`Documents\{annee}\` pour les PDFs produits**.
- Schéma à 5 tables : `artistes`, `oeuvres`, `clients`, `ventes`, **`certificats`**. Migrations additives via `src/db/migrations.js`.
- Écran d'accueil avec logo de la galerie et pictogrammes SVG.
- Import CSV depuis Airtable avec deux modes (« Mettre à jour » et « Ajouter seul les nouveaux »), tolérance aux variations de noms de colonnes.
- Sauvegardes automatiques (intervalle configurable, par défaut 60 min, rétention 50, à chaque fermeture aussi).
- Installateur Windows NSIS (`Galeria Setup 0.1.0.exe`), one-click, per-user, avec catalogue seed embarqué.

### Phase 2 — Catalogue (livrée intégralement)

- **2A** Consultation : listes artistes/œuvres avec recherche multi-critères insensible aux accents, filtres (statuts en pastilles cochables multi-sélection, artiste, type), fiches détaillées en lecture, navigation Précédent/Suivant.
- **2B** Édition : formulaires complets pour modifier artistes et œuvres, validation, garde-fous de quitter avec confirmation, dialogues internes.
- **2C** Création + suppression : avec refus de suppression si dépendances (artiste avec œuvres, œuvre avec ventes, vente avec certificats). Création d'œuvre depuis la liste filtrée d'un artiste pré-remplit l'artiste.
- **2D** Photos : flux complet sélecteur de fichier → modale de recadrage carré (avec slider de taille) → JPEG 800×800. **Préservation de l'original** en pleine résolution dans `Photos\artistes\originaux\`. Bouton « Recadrer » sur photo existante (fall-back gracieux sur les anciennes photos sans original). Visionneuse plein écran au clic.
- **Image différée à la création d'œuvre** : la section image est visible dès le nouveau formulaire, l'image est stockée en mémoire et enregistrée immédiatement après le save.

### Phase 3A — Clients (livrée)

- CRUD complet (liste, fiche, édition, création, suppression).
- **Loi 25** : case consentement courriel + date, badge visible dans la liste pour ceux qui ont consenti.
- Champs d'adresse granulaires : numéro civique, rue, appartement, ville, **pays (~190 pays en select) + subdivision contextuelle (Province/État/Région) qui s'ajuste selon le pays**, code postal.
- **Formatage automatique du téléphone partout** au format `(xxx) xxx-xxxx` (délégation globale via app.js sur tout `input[type=tel]`, plus reformatage de la valeur héritée à l'ouverture).
- Section « Historique d'achat » alimentée automatiquement depuis les ventes (Phase 3B).
- Champs séparés `prenom` / `nom` (avec fallback gracieux pour les données héritées dans `nom` seul).

### Phase 3B — Ventes (livrée)

- Liste des ventes avec recherche multi-critères (œuvre, artiste, client, numéro de facture).
- Création de vente : sélecteur œuvre disponible avec recherche, sélecteur client avec recherche + bouton **« + Nouveau client »** qui ouvre une mini-modale (nom, prénom, courriel, téléphone), date du jour par défaut, prix pré-rempli depuis l'œuvre, TPS/TVQ pré-cochées avec taux depuis config, mode de paiement (datalist), numéro de facture auto-incrémenté (F-2026-001).
- Recalcul du total en temps réel pendant la saisie.
- À l'enregistrement : transaction qui insère la vente + passe l'œuvre au statut **vendu**. Si on supprime ou modifie la vente, le statut de l'œuvre est ré-évalué automatiquement.
- Fiche de vente : blocs pliables (œuvre vendue, client, détails, documents, notes), navigation Précédent/Suivant, suppression refusée si certificats liés.
- Bouton **« Vendre »** sur la fiche d'œuvre (dans l'entête, en or) qui ouvre la vente avec l'œuvre pré-remplie. Sur œuvre vendue, devient **« Voir la vente F-2026-xxx »**.
- Historique d'achat des clients branché sur les vraies ventes.

### Phase 3B-bis — Certificats d'authenticité (livrée)

- Table `certificats` indépendante (lien œuvre obligatoire, lien vente optionnel — un certificat peut exister sans vente).
- Mini-formulaire overlay réutilisable (`certificat-creation.js`) accessible depuis la fiche d'œuvre **et** depuis la fiche de vente.
- Pré-remplissage intelligent : numéro auto (`C-2026-001`...), date du jour, valeur = prix de vente (si vente) ou prix de l'œuvre (sinon), signataire depuis config, particularité optionnelle.
- Section « Certificats d'authenticité » en bas de la fiche d'œuvre avec compteur, et « Documents » sur fiche de vente.
- **Suppression d'un certificat ne décrémente pas le compteur** (comme un livre de factures papier — gaps acceptables).

### Phase 3C — Génération des PDF (livrée)

- Nouveau module `src/pdf.js` : ouvre BrowserWindow cachée, charge le gabarit HTML, appelle `remplir(data)` via `executeJavaScript`, attend que polices et images soient prêtes, capture avec `printToPDF`.
- **Auto-génération** à la création d'un certificat (le PDF apparaît tout de suite).
- Bouton **« Produire la facture artiste »** sur fiche de vente, génère le PDF.
- Sur chaque document généré : boutons **« Voir le PDF »** (ouvre dans le visionneur Windows via `shell.openPath`) et **« Re-générer »**.
- **Photo de l'œuvre** intégrée en base64 dans le certificat (pas de file:// fragile).
- **Mapping intelligent type d'œuvre → texte d'attestation** : Sculpture → sculpteur, Reproduction → reproduction, Photographie → photographe, Estampe → graveur, Dessin → dessinateur, autres → peintre.
- **Taxes intelligentes** sur facture artiste : TPS/TVQ activées si l'artiste a les numéros dans sa fiche.
- **Numérotation distincte pour les factures artistes** (A-2026-xxx) — séparée des factures client (F-2026-xxx). Le numéro est réservé et stocké sur la vente à la première génération (re-générations utilisent le même numéro).
- Sortie : `Documents\GalerieApp\Documents\{annee}\Certificat_C-2026-001_TitreSlug.pdf` (paysage) et `FactureArtiste_A-2026-001_ArtisteSlug.pdf` (portrait).

### Phase 3R — Page de réglages (livrée)

- Stockage JSON dans `Documents\GalerieApp\config.json`, indépendant de la base.
- Quatre sections prévues, **trois actives** (La galerie, Les documents, Les sauvegardes), une **reportée** (La sécurité — voir « Décisions »).
- Bloc « Les documents » organisé en sous-sections : **Factures client**, **Factures artiste**, **Certificats**, **TPS**, **TVQ**, **Facture artiste (cote galerie)**.
- Bouton « Sauvegarder maintenant » et bouton « Importer des données CSV » dans la section sauvegardes/import.
- Au save : le module de sauvegardes redémarre avec la nouvelle fréquence/dossier, l'entête de l'app reflète le nouveau nom de galerie.

### Flux artiste enrichis

- **Création d'artiste avec enchaînement** : bouton **« Créer + ajouter les œuvres »** (en or, par défaut) qui après save bascule directement sur le formulaire d'œuvre en mode chaînage. Compteur de progression dans une bannière dorée, boutons **« Terminer »** et **« Enregistrer + ajouter une autre »**. Navigation propre (la pile reste compacte).
- **Prénom et nom de famille séparés** sur la fiche artiste, avec **auto-préfixe d'inventaire** : 2 premières lettres du prénom + 1 du nom, en majuscules sans accents (Joe Untel → JOU). L'auto-fill s'arrête dès que l'utilisateur modifie le préfixe à la main. Les fiches existantes avec nom complet dans `nom` continuent de fonctionner via `nomComplet()` qui retombe sur `nom` si pas de prénom.
- Toutes les requêtes SQL qui joignent l'artiste retournent maintenant `prenom + ' ' + nom` comme `artiste_nom` (via `TRIM(COALESCE(a.prenom || ' ', '') || a.nom)`).

### Header et navigation

- **Icône maison** dans le header (à la place du logo de la galerie) pour revenir à l'accueil — plus clair fonctionnellement.
- **Navigation rapide entre sections** : quand l'utilisateur est dans une section principale, les boutons des **autres** sections (Artistes, Œuvres, Clients, Ventes) apparaissent dans la zone droite du header avec leur pictogramme + libellé. Mis à jour automatiquement à chaque changement de vue (hook dans le router).
- **Padding adaptatif** : le header garde son contenu sur la même bande centrale que `.vue-liste` (max 980px), donc les boutons restent stables quand la fenêtre s'agrandit.

### Polish transverse

- Système de **dialogues internes** unifié (`src/app/dialogue.js`) qui remplace toutes les boîtes Windows génériques. Types : info, warning, error, question, succes.
- App renommée **« Galeria »** au niveau Windows (titre, installateur, raccourci). La marque interne reste « Galerie du Vieux Saint-Jean » (configurable).
- Icône d'app : visuel fourni par Dave (`gabarits/actifs/icon-galeria.png`).
- Pictogrammes SVG (silhouettes, cadre, dollar, etc.) sur l'accueil au lieu de simples lettres.
- Sections **pliables** (`<details>`/`<summary>`) sur les fiches.
- Barre Annuler/Enregistrer collée au bas du viewport avec dégradé crème (épaisseur réduite de ~35 % récemment).
- Navigation Précédent/Suivant alphabétique sur fiches artistes, œuvres, clients, ventes.
- Bouton « Voir toutes les œuvres de [artiste] » sur fiche œuvre.
- Avatar artiste de 160 px sur la fiche (vs 48 px dans les listes).
- **Multi-numéros de taxes par artiste** : liste de paires (étiquette, numéro) en JSON dans `numeros_taxes`, gère TPS/TVQ/TVH et custom.
- Gabarits PDF (`gabarit-certificat.html`, `gabarit-facture-artiste.html`) modifiés pour lire les coordonnées de la galerie depuis `data.galerie` au lieu d'avoir les valeurs en dur. Restent utilisables en standalone avec données d'exemple.

### Import en masse des photos d'œuvres

- 505 photos importées depuis `F:\Galerie\Automatisation\Galerie\photos_oeuvres\`, matching parfait sur le numéro d'inventaire. Script ré-utilisable : `npm run import-photos-oeuvres`.

---

## Ce qui reste à faire

### Phase 3D — Documents complémentaires (PROCHAINE ÉTAPE quand exemples disponibles)

- **Facture client** (galerie → acheteur, émise au moment de la vente). À concevoir une fois que Dave aura un exemple/template de ses parents. Distincte de la facture artiste (artiste → galerie pour sa part). Numérotation F-2026-xxx déjà prête en config.
- **Lettre de remerciement** : nom du client, mention de l'œuvre achetée, ton chaleureux, signature de la galerie. Plus simple que les autres, mais texte par défaut à définir avec la galerie.

### Phase 4 — Pont Sage 50 (reportée)

Voir CLAUDE.md section 8. Inclut import des historiques de ventes Sage → app (alimentera l'historique des clients pour les ventes antérieures à l'app).

### Phase 5 — Publication web (reportée)

WordPress + WooCommerce. Voir CLAUDE.md section 7.

### Sécurité (reportée comme phase dédiée)

- Verrou léger d'app avec code court.
- Verrouillage automatique après inactivité.
- Code hashé en stockage.
- Plus tard : chiffrement de la base avec clé dans le coffre Windows.

### Demandes spontanées de Dave (à intégrer au planning, non encore programmées)

1. **Splash screen** au démarrage avec logo Galeria, version, et autres infos d'identité. Dave fournira l'image.
2. **Consultation/édition en batch** des tables (vue tableau pour modifier plusieurs lignes d'un coup).
3. **Archiver une/des fiches** (statut archivé qui les retire des vues actives tout en gardant la trace pour la comptabilité ou l'historique).
4. **Push d'infos vers le site web** (recoupe Phase 5 mais à confirmer comme sous-tâche).
5. **Validation des dimensions idéales de fenêtre** pour l'écran réel des parents de Dave (besoin de connaître la résolution de leur moniteur).
6. **Rabais artiste et rabais galerie sur les ventes** : la facture artiste a déjà les champs dans le gabarit mais l'app envoie `rabais_artiste: 0, rabais_galerie: 0`. Nécessite 2 colonnes sur ventes + 2 champs sur le formulaire de vente.
7. **Plus tard** : intégrer d'autres types de produits que les œuvres (encadrements, impressions). Implique d'ajouter une table « produits » ou d'élargir le modèle d'œuvre.
8. **Nomenclature finale des numéros** (factures, certificats, inventaires) : Dave doit obtenir les formules de ses parents. L'app utilise pour l'instant `F-2026-xxx`, `A-2026-xxx`, `C-2026-xxx` (modifiables dans Réglages — préfixe + compteur, aucune migration nécessaire pour changer).

---

## Décisions importantes prises pendant ces sessions

1. **`node:sqlite` (built-in de Node 24/Electron 42)** plutôt que `better-sqlite3`. Évite l'installation de Visual Studio Build Tools. API très proche, sans helper `db.transaction()` : utiliser BEGIN/COMMIT/ROLLBACK explicites.

2. **Identité du produit vs marque de la galerie séparées.** Galeria = nom du produit Windows. Galerie du Vieux Saint-Jean = marque affichée dans l'app, modifiable via réglages.

3. **Architecture photo en deux niveaux** : copie recadrée 800×800 pour affichage + original pleine résolution conservé en parallèle (pour push web futur, re-recadrages, ou impression).

4. **Dialogues internes uniformes**, jamais de boîte Windows générique (sauf sélecteur de fichier système).

5. **Loi 25** : tout local, consentement courriel obligatoire avant tout envoi futur, suppression possible, sauvegardes locales chiffrées (plus tard).

6. **Sécurité de l'app reportée à sa propre phase**, pour ne pas alourdir la livraison.

7. **Mode d'import « mettre à jour » disponible**, pour que les re-exports d'Airtable mettent à jour les fiches existantes sans créer de doublons.

8. **Champs de taxes par artiste** : liste de paires (étiquette, numéro) en JSON pour gérer TPS+TVQ (Québec), TVH (autres provinces), et cas exotiques.

9. **Sauvegardes configurables** depuis les réglages (fréquence min 5 min, rétention min 5, dossier alternatif).

10. **Gabarits PDF préparés à l'avance** : valeurs de galerie en dur retirées et remplacées par des placeholders peuplés depuis `data.galerie`. Les gabarits restent visualisables seuls grâce à `DONNEES_EXEMPLE`.

11. **Signataire du certificat par défaut : « Joanne Boucher, Galeriste »**.

12. **Pre-build seed** : la base SQLite avec catalogue actuel est embarquée dans l'installateur via `npm run prepare:seed` qui copie `Documents\GalerieApp\galerie.db` vers `seed/galerie.db` au moment du build.

13. **Certificat indépendant de la vente** : la table `certificats` a `vente_id` nullable. Un certificat peut être produit pour authentifier une œuvre sans qu'il y ait vente. Plusieurs certificats par œuvre possibles (ré-émissions).

14. **Facture artiste vs facture client** — distinction conceptuelle importante :
    - **Facture artiste** = document de l'artiste vers la galerie (l'artiste « facture » la galerie pour sa part de la vente, mais comme les artistes oublient, la galerie le produit à leur place). Numérotation **A-2026-xxx**, séparée de la facture client.
    - **Facture client** = document de la galerie vers l'acheteur (à concevoir en Phase 3D). Numérotation **F-2026-xxx**.
    - Les deux sont déclenchées au moment d'une vente mais représentent deux transactions distinctes.

15. **PDF par défaut auto-généré à la création d'un certificat**. Bouton « Générer le PDF » sur les rares cas d'échec, bouton « Re-générer » toujours disponible.

16. **Numérotation entièrement reconfigurable** : tous les compteurs (factures client/artiste, certificats) ont un préfixe et un prochain numéro dans Réglages. Quand la nomenclature finale viendra des parents de Dave, c'est juste deux champs à modifier — aucun code à toucher.

17. **Pays + subdivision dynamique** : pays = select large (~190 pays). Subdivision (Province/État/Région) s'adapte au pays choisi : Canada → 13 provinces dropdown, États-Unis → 51 états dropdown, autres → champ texte libre. Québec préselectionné par défaut.

---

## Prochaine étape concrète

**Phase 3D — Documents complémentaires** (quand Dave aura les exemples).

À la reprise de la conversation :

1. Demander à Dave de fournir un exemple de facture client (PDF, photo, ou description du contenu attendu).
2. Concevoir le gabarit HTML `gabarit-facture-client.html` dans `gabarits/`, en suivant le même pattern que les deux existants (style Garamond, liseré doré, `remplir(data)` avec `data.galerie`).
3. Ajouter `genererFactureClientPdf(venteId)` dans `src/pdf.js`, IPC, preload, et bouton sur fiche de vente. Le numéro vient de `vente.numero_facture` (qui existe déjà depuis la création de la vente).
4. Demander à Dave un exemple ou un brouillon de lettre de remerciement.
5. Concevoir `gabarit-lettre-remerciement.html` (plus simple), même mécanique.

En attendant les exemples, alternatives possibles :
- Attaquer une demande spontanée (#1 splash screen, #3 archivage, #2 batch editing, #6 rabais artiste/galerie).
- Construire un installateur de test (`npm run build`) pour livrer chez les parents et collecter du feedback réel.

---

## Notes techniques pour l'intervenant suivant

- **Aucune commande de build automatique requise** au quotidien. `npm start` lance l'app en dev.
- Le build final = `npm run build` (génère l'icône, le seed depuis le catalogue actuel, et produit le `.exe` dans `dist/`). Demande le Mode Développeur Windows activé pour les liens symboliques d'electron-builder.
- **Migrations DB** : ajouter dans `src/db/migrations.js` (additif uniquement). Ajouter aussi dans `src/db/schema.sql` pour les installations fraîches. La table `certificats` est créée via `CREATE TABLE IF NOT EXISTS` dans schema.sql.
- **Config** : ajouter un champ dans `DEFAULTS` de `src/config.js` ; le merge récursif s'occupe d'ajouter le champ aux configs existantes au chargement.
- **Dialogues** : `import { confirmer, alerter } from '../dialogue.js'` dans toute vue.
- **Flux import** : `import { fluxImport } from '../flux-import.js'`.
- **Photos** : URL via `urlPhoto(cheminRelatif)` qui produit `galerie://photos/...`. Protocole défini dans `main.js`.
- **PDFs** : générés via `src/pdf.js`. Gabarits dans `gabarits/`, sortie dans `Documents\GalerieApp\Documents\{annee}\`. Ouvre dans le visionneur système via `shell.openPath`.
- **Header dynamique** : `majActionsEntete(nomVue)` dans `src/app/marque.js`, appelée automatiquement par le router après chaque rendu. Pour ajouter une nouvelle section principale, ajouter à `SECTIONS_NAV` et à `sectionDe(nomVue)`.
- **Pays/subdivision** : `champPays` + `champSubdivision` + `brancherChangementPays` dans `src/app/commun.js`. Pour ajouter un pays avec subdivisions listées (ex. Mexique), étendre `SUBDIVISIONS_PAYS`.
- **Mémoires importantes** déjà enregistrées dans `C:\Users\Dave\.claude\projects\F--Galerie-Automatisation-GalerieApp\memory\` (rôle de Dave, modèle de déploiement, catalogue pré-construit, actifs de marque, choix SQLite).
