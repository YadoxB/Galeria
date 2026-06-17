# Journal des versions

Le format suit librement [Keep a Changelog](https://keepachangelog.com/fr/) :
**Ajouté** pour les nouvelles fonctionnalités, **Modifié** pour les
changements de comportement, **Corrigé** pour les bugs, **Retiré** pour
les suppressions, **Sécurité** pour ce qui touche aux données ou aux
identifiants.

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
