# Journal des versions

Le format suit librement [Keep a Changelog](https://keepachangelog.com/fr/) :
**Ajouté** pour les nouvelles fonctionnalités, **Modifié** pour les
changements de comportement, **Corrigé** pour les bugs, **Retiré** pour
les suppressions, **Sécurité** pour ce qui touche aux données ou aux
identifiants.

---

## [Non publié]

### Modifié

- **Le courriel de signalement se lit sans effort** (Dave, 2026-09-08 : « moins technique et
  plus clair pour moi, et qu'il m'indique sur quelle page ils se trouvent »).
  - **Ordre inversé** : CE QUI S'EST PASSÉ, puis OÙ, puis QUAND ; tout le technique est rejeté
    à la fin sous une ligne qui dit qu'on peut s'arrêter là. La première version ouvrait sur
    quatre lignes de numéros de version.
  - **La page porte un nom français** suivi du titre réellement affiché — « Fiche artiste —
    Pam Comeau » au lieu de `artiste-fiche (n° 17)`. Le titre est lu dans le document plutôt
    que rechargé de la base : c'est ce que la personne avait sous les yeux, sans aller-retour.
    Un titre déjà contenu dans le nom de section est omis (« Liste des œuvres », pas « Liste
    des œuvres — Œuvres »).
  - **L'objet du courriel porte la page** : la boîte de réception dit de quoi il s'agit avant
    l'ouverture.
  - Date lisible (« 8 septembre 2026 à 19 h 04 ») et système nommé (« Windows 11 —
    10.0.26200 ») au lieu de l'horodatage et de `Windows_NT`.
  - ⚠ Vérifié dans l'application réelle isolée — et un piège de banc trouvé en route :
    `spawn(..., { shell: true })` rend le processus `cmd.exe`, pas `electron`, si bien que
    `kill()` laissait l'application vivante et que le banc suivant se rebranchait sur
    l'**ancienne version du code** par le même port de débogage. Un « TOUT PASSE » avait
    ainsi validé une correction qui n'avait jamais tourné. Les bancs tuent désormais leurs
    processus par dossier temporaire — jamais par nom d'image, qui frapperait l'app installée.

### Ajouté

- **« Relier à une fiche existante » dans la synchronisation des artistes.** Deux artistes de
  la galerie signent d'un **nom d'artiste** : le site dit « PAMCOMEAU (Pamela Comeau) » et
  « Sofia (Sophie Lebeuf) » là où Galeria disait « Pam Comeau » et « Sophie Lebeuf ». Le
  rapprochement se faisant par le nom, chacun tombait d'un côté et le seul geste offert —
  « Créer la fiche artiste » — aurait produit des **doublons**, chacun avec ses œuvres.
  - Nouvelle colonne **`nom_site`** sur `artistes` : le nom que l'artiste porte *sur le site*.
    Le rapprochement essaie ce nom d'abord, le nom complet ensuite. La galerie garde le sien,
    le site garde le sien, et la paire tient — personne ne renonce à son nom.
  - ⚠ `nom_site` est **volontairement absente de `COLONNES_ARTISTE`** : `modifierArtiste`
    réécrit toutes les colonnes qu'il connaît et effacerait le lien à chaque enregistrement
    d'une fiche. Un banc le vérifie explicitement.
  - La fenêtre propose les **candidats classés** — les artistes que le site ne retrouve pas
    d'abord, puis par mots de nom en commun — avec **la raison affichée** (« nom en commun :
    pam, comeau »). Sans elle, l'ordre serait un oracle qu'on ne peut ni vérifier ni contredire.
    Une recherche atteint n'importe quelle autre fiche.
  - **Renommer est facultatif** et se fait dans le même geste, seul moment où l'on a les deux
    noms sous les yeux : garder le nom actuel (défaut), prendre celui du site, ou en écrire un.
    Le renommage passe par le même soin que `artistes:modifier` — l'artiste **emporte son
    dossier de photos**. Le préfixe d'inventaire n'est jamais touché.
  - **Réversible** : le lien s'affiche sur la carte de comparaison *et* sur la fiche de
    l'artiste, avec « Délier ». La carte disparaît dès que tout concorde, donc elle ne suffit
    pas — le lien serait introuvable précisément quand il marche.
  - Garde-fous : un artiste du site ne peut être relié qu'à **une seule** fiche, un nom vide
    est refusé, et un renommage vers un nom déjà porté par une autre fiche l'est aussi.
  - Vérifié sur une **copie de la vraie base** (migration, non-effacement par le formulaire,
    rapprochement) et en **montant la vraie vue** dans un Chromium : douze contrôles, du
    classement des candidats jusqu'au renommage effectif. Maquette :
    `demos/relier-artiste-site.html`.

## [0.21.1] — 2026-09-07

### Ajouté

- **Les erreurs de l'interface sont consignées dans `erreurs.log`.** Jusqu'ici, le filet global
  du processus de rendu affichait « Erreur imprévue » et écrivait la pile dans la console de
  développement — que personne n'ouvre. Un **signalement de problème ne contenait donc rien
  d'exploitable** : c'est exactement ce qui a rendu invisible le défaut corrigé ci-dessous.
  - Chaque erreur est consignée avec sa **pile** et l'**écran en cours** (`routeCourante()`).
    « Cannot set properties of null » ne dit rien ; la ligne où ça casse dit tout.
  - Consigner passe **avant** l'affichage et **n'est pas soumis** à la limite d'une alerte par
    5 secondes : le dialogue est pour l'utilisateur, le journal pour qui devra comprendre. Une
    erreur en boucle laisse donc une trace complète tout en n'affichant qu'un dialogue.
  - Canal `app:journaliser-erreur` en `send` et non `invoke` : consigner ne doit jamais faire
    attendre l'interface ni pouvoir échouer chez elle. Tout est enveloppé de `try/catch` des
    deux côtés — un filet d'erreur qui lève une erreur ne servirait à personne.
  - Vérifié **de bout en bout** : la vraie application lancée sur un dossier de données
    temporaire (profil neuf + papier d'adresse), une promesse rejetée provoquée dans son
    interface par le débogueur, et la ligne retrouvée dans le journal —
    `Erreur d'interface (écran « accueil ») : Error: …` avec sa pile.

### Corrigé

- **« Comparer avec le site » : reprendre un texte du site échouait toujours**, avec
  « Erreur imprévue — Cannot set properties of null (setting 'disabled') », et le texte que
  l'on venait de relire était **perdu en silence** (signalé par Dave le 2026-09-07).
  - Cause : `e.currentTarget` est remis à `null` dès la fin de la propagation de l'événement.
    Le gestionnaire ouvrait la fenêtre d'édition du texte (`await`), puis touchait
    `e.currentTarget.disabled` — sur `null`. Le geste échouait donc **avant** l'appel d'import.
  - Le même piège rendait muets les rattrapages d'erreur de « Appliquer le statut » et
    « Garder la version de l'app » : un échec réseau y aurait laissé le bouton désactivé
    derrière la même alerte.
  - Correction : le bouton est capturé **avant tout `await`** dans les quatre gestionnaires,
    comme c'était déjà le cas ailleurs dans le projet (`web-sync.js`, `web-sync-artistes.js`).
  - Le reste du code a été audité : c'était le seul endroit où `currentTarget` était lu après
    un `await`.
  - Reproduit puis vérifié au banc (le vrai module monté dans un Chromium) sur quatre gestes :
    reprise d'un texte édité, annulation de l'édition, import en échec, « garder » en échec.

## [0.21.0] — 2026-09-07

### Ajouté

- **Bandeau de statistiques en tête de la liste des œuvres** : affichées, disponibles, en
  exposition, vendues, retirées, et la valeur totale. Même vocabulaire visuel que l'en-tête
  d'une fiche d'artiste, dans une bande basse plutôt qu'une carte — la page a déjà un titre,
  une recherche et une barre de contrôles.
  - Les nombres **se recalculent sur la liste réellement affichée** : statuts, artiste, type,
    format, style, « inclure les retirées », et jusqu'au texte tapé dans la recherche. Ils
    sont dérivés de la liste que `dessiner()` vient de filtrer — aucune requête de plus, et
    aucun moyen qu'ils racontent autre chose que ce qu'on voit.
  - D'où **« Affichées »** en tête et non « Au catalogue » : ce ne sont pas des totaux. Un
    rappel discret des filtres actifs est posé à droite, sans quoi un nombre bas ressemble à
    un catalogue qui a fondu plutôt qu'à un filtre resté en place.
  - La **valeur reste masquée** par défaut et se révèle au clic, comme sur la fiche d'artiste
    (l'ordinateur peut se trouver dans un lieu de passage). Elle se re-masque quand la souris
    quitte **et dès que la liste change** : autrement, un filtre appliqué après coup afficherait
    un montant que personne n'a demandé à voir.
  - Remplace le compteur « 506 œuvres », qui disait moins en prenant la même place.
  - Vérifié en montant la vraie vue dans un Chromium avec les vraies feuilles de style : sur
    cinq combinaisons de filtres, la somme des cases égale toujours le nombre affiché, qui
    égale toujours le nombre de cartes rendues. Maquette : `demos/entete-stats-oeuvres.html`.

- **« Vendues » dans l'en-tête d'une fiche d'artiste** — le nombre de ses œuvres marquées
  vendues.

### Modifié

- **La case « Ventes » de la fiche d'artiste devient « Ventes saisies ».** ⚠ Œuvres vendues et
  ventes enregistrées sont **deux nombres différents**, et l'écart est énorme : au 2026-09-07,
  la base compte **165 œuvres au statut « vendu » pour 2 lignes dans `ventes`**, le catalogue
  ayant été importé avec son historique. Les deux sont justes ; côte à côte sous des libellés
  qui se ressemblent, ils seraient incompréhensibles.

- **L'orientation des feuilles de cartels suit le nombre par page.** Dix par page reste en
  portrait ; **4, 6 et 8 passent en paysage**. Un cartel est un objet large et bas — une
  ligne de texte flanquée d'une vignette et d'un code QR — et en portrait, moins il y en a
  par page, plus le vide s'accumule au-dessus et au-dessous du texte (Dave, 2026-09-07 :
  « on ne perd pas d'espace en haut et en bas »).
  - Même grille à deux colonnes dans les deux sens ; seule la feuille tourne. Les cases
    restent rigoureusement égales, donc les traits de découpe restent droits.
  - Cases obtenues : **128 × 96 mm** à 4 par page (au lieu de 96 × 128), **128 × 64** à 6
    (au lieu de 96 × 85), **128 × 48** à 8 (au lieu de 96 × 64), **96 × 51** à 10 (inchangé).
  - Le gabarit pose lui-même sa règle `@page` — elle ne peut pas être conditionnée par une
    classe CSS — et `genererCartelsPdf` en déduit le drapeau `paysage` de `printToPDF`. Les
    deux appliquent la même fonction `cartelsEnPaysage()` : s'ils divergeaient, la feuille et
    son contenu tourneraient l'un sans l'autre.
  - `preparerDonneesCartels` **borne maintenant le format** à la liste permise, comme le fait
    le gabarit depuis toujours. Un format inconnu donnait auparavant un nombre de pages faux
    dans le compte rendu.
  - La fenêtre d'impression **annonce le sens du papier** (« en format Lettre paysage ») et le
    met à jour quand on change de format : rien de plus à cocher, mais rien de surprenant non
    plus au moment d'imprimer.

- **La vignette d'une œuvre prend la hauteur de son texte.** Largeur fixe selon le format
  (24 mm à 4 par page, 15 mm à 10), hauteur exactement celle du bloc de texte voisin (Dave,
  2026-09-07 : « il faudrait que l'image de la toile suive la taille du texte »). Un carré de
  taille fixe paraissait minuscule sur un grand cartel et décalé vers le haut sur un petit ;
  la vignette est désormais d'aplomb en face du texte, ce qui règle aussi le défaut de
  centrage vertical signalé le même jour.
  - Vignette et texte forment un **corps** à hauteur libre, le code QR restant à part : c'est
    ce qui permet à la vignette de se caler sur le texte et non sur le code.
  - L'image reste en **position absolue** dans sa case : elle ne compte pour rien dans le
    calcul des hauteurs. L'invariant de la 0.20.0 tient — aucune dimension d'image ne peut
    influencer la hauteur d'un cartel.
  - Vérifié en produisant de **vrais PDF** (Electron + `printToPDF`, donc en média *print*) sur
    les huit combinaisons format × photo, avec une toile 1:4 en hauteur, une 5:1 en largeur et
    une œuvre sans photo : nombre de pages exact, `MediaBox` conforme au sens attendu, écart
    vignette/texte de 0,00 mm, aucun débordement.
  - Maquette : `demos/cartels-paysage.html`.

## [0.20.0] — 2026-09-06

### Ajouté

- **Catégorie « Nouveautés par version » dans l'aide**, avec un article par version et un
  bouton **« Revoir en grand »** qui rejoue la fenêtre de nouveautés de cette version-là.
  - Les articles sont **engendrés à partir de `src/app/nouveautes.js`** : rien n'est recopié,
    une nouvelle version y apparaît d'elle-même et ne peut pas se désynchroniser.
  - Un article **par version** plutôt qu'une liste unique : la recherche de l'aide trouve
    alors « exposition » ou « cartel » dans la version qui l'a apportée.
  - `construireDiapos()` accepte une borne haute `jusqua`. Sans elle, revoir la 0.17.0
    affichait aussi tout ce qui l'a suivie — correct après une mise à jour, absurde sous un
    article intitulé *Version 0.17.0*.

### Modifié

- **La photo des cartels devient une vignette de repérage.** « Ces images ne servent qu'à
  associer quel cartel va avec quelle toile ; ça ne sert pas vraiment à montrer les toiles »
  (Dave). Carré de **18 mm** à gauche du texte (14 mm sur les formats compacts), au lieu de
  la moitié de la case. Le texte redevient le sujet du cartel.
  - **La photo ne restreint plus les formats** : 4, 6, 8 ou 10 par page dans les deux modes,
    défaut 10. Cocher la case n'a plus d'effet de bord. Le format *2 par page* est retiré —
    il n'existait que pour loger une grande image.
  - La vignette ayant une **taille fixe en millimètres**, aucune dimension d'image ne peut
    plus influencer la hauteur d'un cartel : le défaut corrigé en 0.19.1 devient
    structurellement impossible.
  - Vérifié en produisant de **vrais PDF** (Electron + `printToPDF`) sur six combinaisons de
    format, avec des proportions extrêmes (1:5, 5:1, 4000 × 5000) et une œuvre sans photo.

### Corrigé

- **Le courriel de signalement ne s'ouvrait pas.** Deux défauts superposés, trouvés en
  reprenant le rapport réellement envoyé par les parents.
  - Le plafond de longueur portait sur le **texte brut** (1800 caractères). Leur rapport en
    faisait 1713 — donc non tronqué — mais **2450 une fois encodé**, au-dessus de la limite
    de Windows. L'encodage multiplie la longueur par ~1,4 sur du français ; elle est
    désormais mesurée sur **l'adresse finale**, réduite par dichotomie jusqu'à ce qu'elle
    tienne. Les lignes `at …` des traces d'appel sont retirées du courriel (elles restent
    dans le presse-papier et dans le fichier).
  - `app:ouvrir-url` n'attendait pas `shell.openExternal` et répondait « ok » quoi qu'il
    arrive : un échec passait inaperçu, et le repli « le logiciel de courriel n'a pas
    répondu » ne pouvait jamais se déclencher.

## [0.19.1] — 2026-09-06

> **Deux corrections, trouvées grâce au premier signalement envoyé par les parents.**
> L'outil de soutien a payé son écriture dès sa première utilisation.

### Corrigé

- **Les cartels avec photo s'étalaient sur quatre feuilles au lieu d'une.** D'où les cartels
  « superposés » signalés : ils étaient coupés en travers des pages.
  - Cause : `flex: 1 1 auto` sur la case photo. Avec `auto`, la hauteur de base est celle de
    l'**image**, donc indéfinie tant qu'elle n'est pas mesurée, et le `max-height: 100%` de
    l'image ne se résolvait sur rien. **À l'écran le navigateur s'en sortait ; à l'impression,
    l'image sortait à sa taille naturelle.**
  - Corrigé par `flex: 1 1 0` (hauteur issue du seul partage de l'espace, donc définie) et
    `height: 100%` + `object-fit: contain` sur l'image.
  - Vérifié en produisant de **vrais PDF** via Electron et `printToPDF` : 6/page → 1 page,
    4/page → 2 pages, 2/page → 3 pages ; sans photo, inchangé.
- **La migration des photos refusait de s'exécuter et se rejouait à chaque démarrage.** La
  base des parents référence des portraits d'artistes **absents du disque** ; le garde-fou
  bloquait tout, et leurs photos n'ont jamais été rangées depuis la 0.18.0 — en silence, sauf
  une ligne dans le journal d'erreurs.
  - Le garde-fou confondait deux choses. Une **collision** (deux photos qui veulent le même
    chemin) reste bloquante : elle ferait perdre une photo. Un **fichier absent** est un état
    déjà cassé, que la migration ne peut ni réparer ni aggraver — il est désormais **sauté et
    compté**, sans arrêter le rangement. Le chemin enregistré en base est laissé intact.

## [0.19.0] — 2026-09-06

> **Deux outils pour dépanner à distance.** Les parents peuvent envoyer une copie de leur
> catalogue sans données de client, et signaler un problème en une phrase.

### Ajouté

- **Copie pour le soutien technique** (*Réglages → Données*). Un exemplaire du catalogue à
  envoyer à Dave pour reproduire un problème. **Aucune donnée de client n'en fait partie** :
  `clients`, `ventes`, `certificats` et `annexes` sont vidées, les réservations détachées.
  - Le **bilan est affiché avant** la production, lu dans la vraie base — on n'envoie pas un
    fichier sans savoir ce qu'il contient.
  - Ce qui rend la copie utile malgré l'expurgation : le **statut** d'une œuvre vit dans la
    table des œuvres, pas dans la vente. Une toile vendue reste marquée vendue.
  - Sans photos : **un seul fichier d'environ 1 Mo**, joignable à un courriel. Avec photos :
    un dossier, puisque 200 Mo ne passent pas par courriel.
- **Signaler un problème.** Le bouton **?** flottant déplie maintenant **deux choix** —
  *Signaler un problème* et *Consulter l'aide* — au lieu d'ouvrir l'aide directement. Le
  signalement y était un article parmi quarante.
  - Une phrase de description, puis **le rapport complet est montré** avant tout envoi.
  - **Outlook s'ouvre pré-rempli** (destinataire, objet, corps) : il ne reste qu'à cliquer
    sur *Envoyer*. Le texte est aussi mis dans le presse-papier, et un bouton *Enregistrer
    le fichier* reste offert.
  - Le rapport porte la version, le système, **la page ouverte au moment du clic**, la
    taille du catalogue, la date de la dernière sauvegarde et les dernières lignes du
    journal d'erreurs.

### Sécurité

- Le rapport ne contient **jamais** de nom de client, d'adresse, de courriel ni de montant —
  seulement des **comptes** (« 12 clients »), jamais qui. La configuration **n'est pas jointe
  du tout** : plus sûr qu'une liste de champs à exclure, qu'un ajout futur rendrait
  incomplète sans prévenir. Le code du verrou et les clés (Anthropic, site web) restent donc
  hors du rapport.
- La copie pour le soutien a trois garde-fous : une **table non classée fait échouer la
  copie** (une table ajoutée plus tard serait sinon gardée par défaut) ; les **clés
  étrangères restent actives** pendant l'expurgation ; et un **`VACUUM` suivi d'un contrôle
  du fichier produit** — sans lui, les lignes supprimées resteraient lisibles dans les pages
  libérées du fichier.

### Corrigé

- Le menu du bouton **?** restait déplié en permanence : `display: flex` écrasait la règle
  `[hidden]` du navigateur. Ajout de `.aide-pile[hidden] { display: none; }`, comme
  `.menu-docs-pop[hidden]` ailleurs dans le projet.

## [0.18.0] — 2026-09-05

> **Les photos rangées par artiste.** Le dossier Photos suit désormais la méthode de
> suivi de la galerie : l'emplacement d'un fichier dit où en est une toile.

### Ajouté

- **Nouvelle arborescence du dossier Photos**, un seul dossier par artiste :
  ```
  Photos\<Artiste>\Oeuvres\disponible|en exposition|vendu|retiré\
  Photos\<Artiste>\Portraits\  (+ originaux\)
  Photos\<Artiste>\Divers\
  ```
  Les racines `artistes\` et `oeuvres\` disparaissent. Un fichier sans artiste (fiche
  supprimée) va dans `Photos\_non-rattachés\` — jamais effacé.
- **Migration unique au démarrage** (`src/db/migrer-photos.js`), avec cinq garde-fous :
  un **plan calculé avant toute modification** (collision de noms, fichier manquant →
  arrêt sans rien toucher) ; **copie, vérification par empreinte SHA-256, puis
  suppression** ; la **base réécrite seulement une fois tous les fichiers arrivés**, en une
  transaction ; un **journal** permettant de tout remettre en place
  (`annulerMigrationPhotos`). Éprouvée sur une copie des données réelles :
  **542 fichiers, 0 perdu, 0 altéré**, aller et retour.
- **La photo suit le statut** (`src/db/photos-ranger.js`). Une œuvre vendue voit sa photo
  passer dans `vendu\`, une œuvre partie en exposition dans `en exposition\`, et revenir
  ensuite. « Réservé » reste dans `disponible` (la toile est encore à la galerie) ;
  « retiré » l'emporte sur le statut.
- **Un artiste renommé emporte son dossier**, portrait compris. Sans ça, corriger une
  faute de frappe créerait un second dossier et séparerait ses photos en deux.
- **Section « Photos » sur la fiche d'artiste** : les œuvres groupées par statut (les
  vendues désaturées), le portrait, le contenu de *Divers*, le nombre et le poids total.
  **Ajouter** dépose dans *Divers* en gardant les noms d'origine ; **Copier** met l'image
  dans le presse-papier ; **Enregistrer** en fait une copie ailleurs ; **Ouvrir le
  dossier** mène à l'Explorateur. Un clic sur une œuvre ouvre sa fiche.

### Modifié

- Les **nouvelles photos** ajoutées depuis l'app sont écrites directement au bon endroit.
  Elles atterrissaient jusqu'ici à plat dans `Photos\oeuvres\` ou `Photos\artistes\`, ce
  qui aurait recréé le désordre dès la première photo suivant la migration.

### Sécurité

- Le rangement est **réconciliateur et jamais bloquant** : plutôt que de brancher un
  déplacement sur les quatorze endroits qui changent un statut — en oublier un ne se
  verrait pas — on compare l'emplacement réel à l'emplacement attendu, à chaque démarrage
  et après chaque action. Un fichier verrouillé par l'Explorateur ne fait donc **jamais
  échouer une vente** : l'écart est rattrapé au démarrage suivant.
- Les déplacements ont lieu **hors transaction** : un déplacement de fichier n'est pas
  annulable par un `ROLLBACK`, et laisserait sinon une photo déplacée pour une vente
  abandonnée.

## [0.17.0] — 2026-09-04

> **Les documents en anglais.** La présentation, le catalogue et toute la pochette de
> vente suivent maintenant la langue choisie. Le chantier bilingue est refermé :
> certificat (0.15.0) → fiches et import des textes du site (0.16.0) → documents (0.17.0).

### Ajouté

- **Présentation et catalogue d'artiste en anglais.** Une bascule **FR / EN** en tête du
  menu *Documents* de la fiche d'artiste. Un clic pour le français, comme avant ; la
  bascule **revient au français à chaque ouverture du menu**, pour qu'un choix oublié ne
  produise pas un document anglais par surprise.
  - La présentation prend les textes `_en` de l'artiste et **replie sur le français**
    quand ils manquent — un lecteur anglophone comprend un texte français, pas un blanc.
    Les sections repliées sont **nommées dans le compte rendu**.
  - Intitulés repris du site : *Biography*, *Artist's statement*, *C.V.*
  - Le catalogue traduit ses libellés (*Catalogue of works*, *Page 1 of 3*,
    *Not available*, *Price on request*), le médium, le support et l'unité des dimensions
    (`po` → `in`). **Les titres d'œuvres restent en français** : un tableau garde son titre.
  - **Le prix garde le format québécois dans les deux langues** (`2 400 $`), pour que les
    documents de la galerie restent cohérents entre eux.
  - Médiums et supports traduits par **correspondance sur la chaîne entière, jamais mot à
    mot** : sans correspondance, le français est conservé. Mesuré sur le catalogue réel :
    **supports 409/409 (100 %), médiums 477/495 (96 %)**.
  - Les **annexes A** restent en français : documents de consignation signés avec des
    artistes québécois.
- **Choix de la langue à la production de la pochette de vente** : une fenêtre
  *Français / Anglais*, préréglée sur la langue enregistrée de la vente. Le choix vaut pour
  tous les documents et ne modifie pas la vente.
- **Noms de fichiers de la pochette en anglais** quand elle l'est : `Thank-you letter`,
  `Artist presentation`, `Buyer's guide.pdf`.

### Corrigé

- **La pochette de vente n'était anglaise qu'à moitié.** Seule la lettre suivait la langue.
  - Le **certificat d'authenticité** était créé sans langue et retombait sur le français.
    Un certificat déjà délivré garde la sienne — c'est une pièce officielle numérotée — mais
    la discordance est désormais signalée.
  - La **présentation de l'artiste** était toujours produite en français.
  - La **fiche de l'œuvre** (page 2 de la lettre) s'intitulait *The artwork* mais gardait
    toutes ses lignes en français : Titre, Artiste, Année, Médium, Support, Valeur,
    N° de délivrance.
  - Les **« versions modifiées »** d'un document avaient le même angle mort.

### Modifié

- Le **guide de l'acheteur** étant rédigé bilingue, un seul fichier sert dans les deux
  langues ; seul son nom suit celle de la pochette.

## [0.16.0] — 2026-09-04

> **Le catalogue en anglais.** Les textes anglais qui existent déjà sur le site
> entrent dans l'application, une bascule FR/EN les rend visibles sur les fiches,
> et un assistant traduit ce qui manque.

### Ajouté

- **Importation des textes anglais depuis le site.** Bouton **« Importer les textes
  anglais »** dans l'écran de synchronisation. Il lit le site en anglais (`?lang=en`)
  **sans aucune clé d'accès** — l'interface publique suffit —, rapproche les artistes
  par leur nom et les œuvres par leur numéro d'inventaire, puis remplit les champs
  anglais.
  - **Ne remplit que ce qui est vide** : une traduction déjà relue et corrigée n'est
    jamais écrasée.
  - **Ne touche jamais au français**, ni dans l'application ni sur le site.
  - Le compte-rendu distingue les textes importés, ceux qui étaient déjà remplis et
    les fiches introuvables sur le site.
- **Champs anglais** pour la citation, la biographie, la démarche et le curriculum d'un
  artiste, et pour la description d'une œuvre.
- **Bascule FR / EN sur les fiches.** À droite des onglets de la carte *Présentation*
  d'un artiste, et à côté du titre du bloc *Description* d'une œuvre. Une **pastille
  dorée** signale qu'une version anglaise existe ; un **« EN » pâli** qu'il n'y en a
  aucune. Le bouton **« ⤢ »** suit la langue affichée.
  - Quand une section est vide en anglais, la fiche propose **« Traduire avec
    l'assistant »** ou **« Écrire à la main »** plutôt que de laisser un blanc.
  - L'édition a la même bascule. Les champs de l'autre langue **restent dans le
    formulaire**, simplement masqués : sans eux, enregistrer en anglais viderait le
    français, puisque `modifierArtiste` et `modifierOeuvre` réécrivent toutes les
    colonnes.
- **Traduction assistée** (`src/app/traduction.js`). Un bouton par champ anglais. Elle
  **propose** : le texte arrive dans le champ, à relire, et rien n'est enregistré avant
  un clic sur *Enregistrer*. Un texte anglais existant n'est remplacé qu'après
  confirmation. Modèle isolé dans `MODELE_TRADUCTION` (`src/ia.js`).

- **Tri par numéro d'inventaire**, dans le menu *Trier par* de la liste des œuvres :
  artiste d'abord, puis numéro. Répond à la demande « voir les toiles d'un artiste dans
  un ordre facile à suivre ».
- **Photo de l'œuvre sur les cartels d'exposition**, par une case à cocher. La photo prend
  le haut du cartel, le texte et le code QR se rangent dessous. **Cocher la case refait la
  liste des formats** : 8 et 10 par page disparaissent — une case de 96 × 51 mm ne contient
  pas d'image lisible — et il reste 2, 4 ou 6, avec **6 par défaut**. Décocher rend les
  quatre formats et remet 10. Un format impossible retombe sur le défaut de son mode plutôt
  que de casser la grille. Une œuvre sans photo garde un cartel complet, avec un blanc à la
  place de l'image.
- **Code QR optionnel sur les cartels.** Décoché, le code n'est plus calculé et
  l'avertissement sur les adresses manquantes disparaît : sans code imprimé, une adresse
  absente n'est plus un manque.
- **Compteur « En exposition »** dans l'en-tête de la fiche d'artiste, entre *Disponibles*
  et *Retirées*. En rouge quand il y en a — c'est un état temporaire, pas un total. Affiché
  même à zéro, pour que la rangée garde le même nombre de cases d'un artiste à l'autre.
- **Photo de l'œuvre vendue sur la facture artiste**, à gauche, en face du bloc de calcul —
  un espace jusque-là vide. **Le bloc de calcul ne bouge pas d'un pixel**, avec ou sans
  photo : aucune facture ne risque de passer sur une deuxième page. Une vente dont l'œuvre
  n'a pas de photo produit exactement la facture d'avant.

### Modifié

- **Cadre du certificat élargi** : la marge du papier passe de 12 à **8 mm**, parce que
  l'estampe en relief, appliquée à la main en bas à droite, mordait sur le filet rouge. Le
  cadre gagne 4 mm de chaque côté et le corps du document 8 mm de hauteur utile. ⚠ Ne pas
  descendre sous 6 mm : beaucoup d'imprimantes coupent au-delà.

### Corrigé

- **Les numéros d'inventaire étaient triés comme du texte.** Les numéros mêlent des
  lettres et un bloc de chiffres de longueur variable (`CLB565`, `CLB1236`) : le tri
  alphabétique plaçait `CLB565` **après** `CLB1236`. Mesuré sur le catalogue réel :
  **6 artistes sur 20** avaient une liste mal ordonnée. SQLite ne sait pas faire ce tri
  (`COLLATE NOCASE` reste alphabétique), donc l'ordre est refait en JavaScript après la
  requête (`trierParInventaire()` dans `requetes.js`). Corrige les **cinq** listes qui
  annonçaient un tri par numéro : catalogue imprimé, Annexe A (par artiste et par ids),
  œuvres d'une exposition — donc **l'ordre des cartels** — et œuvres éligibles à une
  exposition. Une œuvre sans numéro passe désormais en fin de liste.

### Sécurité

- L'importation et la traduction sont **à sens unique** : rien ne remonte vers le site.
  Aucune donnée de client ni de vente n'entre dans ces échanges.

## [0.15.0] — 2026-08-27

> **Préparer une exposition.** Choisir les œuvres qui partent, imprimer leurs
> cartels avec code QR, puis tout ramener d'un geste à la fin.
> *(Publiée en même temps que la 0.14.0, qui n'avait pas encore été livrée.)*

### Ajouté

- **Expositions** — nouvelle section dans la barre latérale, sous Œuvres.
  - **Créer une exposition** : nom, lieu, dates de début et de fin prévue, notes.
  - **Choisir les œuvres qui partent**, avec recherche et filtre par artiste. Seules les
    œuvres **disponibles ou réservées**, encore à la galerie et pas déjà dans une autre
    exposition en cours, sont proposées : une toile ne peut pas être à deux endroits.
  - Les œuvres parties passent au statut **« En exposition »** et le nom de l'exposition
    s'inscrit dans leur champ *Exposition actuelle*.
  - **Rendre une œuvre** isolément, ou **mettre fin à l'exposition** pour toutes les
    ramener. Chacune retrouve **exactement** le statut qu'elle avait avant de partir :
    une œuvre réservée redevient réservée, pas disponible.
  - **Une œuvre vendue pendant l'exposition reste vendue** — elle n'est jamais ramenée
    en arrière. Le compte-rendu de clôture distingue les œuvres rendues, les vendues et
    celles dont le statut avait été changé à la main.
- **Cartels d'exposition en PDF.** Format Lettre, **10 par page par défaut** (4, 6 ou 8
  au choix), avec traits de découpe. Chaque cartel porte l'artiste, le titre, le médium,
  les dimensions, le **numéro d'inventaire** et un **code QR** menant à la fiche de
  l'œuvre sur le site. Case **« Afficher le prix »**, cochée par défaut. Une œuvre sans
  adresse sur le site reçoit un cartel sans code QR plutôt qu'un code menant nulle part.
- **Certificat d'authenticité en anglais.** La fenêtre de création propose la **langue du
  document** (français ou anglais), choisie à chaque certificat. Sont traduits : les dix
  libellés imprimés, les trois textes d'attestation (peintre, sculpteur, reproduction), le
  cas du métier libre, et le format de date (« August 27, 2026 »). La langue est
  **conservée sur le certificat** : une régénération reste dans la même langue. Les
  certificats existants restent en français. *(La présentation d'artiste et le catalogue
  ne sont pas concernés : leur contenu — biographie, démarche, C.V., descriptions — est du
  français rédigé, qui demande une traduction à part.)*
- **« Récupérer les adresses du site »** (écran de synchronisation des œuvres) : remplit
  l'adresse de la fiche de chaque œuvre en la rapprochant par numéro d'inventaire = SKU.
  Passe par l'**API publique de la boutique**, donc fonctionne **sans clés REST**. Le
  bouton « Voir sur le site » de la fiche d'œuvre s'en trouve activé pour tout le
  catalogue, et c'est cette adresse que visent les codes QR des cartels.

### Modifié

- **Nouveau statut d'œuvre « En exposition »**, avec sa pastille. L'ajout a demandé une
  **reconstruction de la table des œuvres** (SQLite ne sait pas modifier une contrainte
  `CHECK`) : elle part du `CREATE TABLE` réel, ne remplace que la contrainte de statut,
  compare le nombre de lignes et vérifie les clés étrangères **avant** de valider, et
  annule tout au moindre écart. Exécutée une seule fois par base (`user_version = 3`),
  après la copie de sauvegarde automatique d'avant migration.
- La synchro web demande désormais aussi le champ `permalink` à WooCommerce — son
  absence expliquait pourquoi l'adresse des fiches n'était jamais renseignée.

### Interne

- Nouvelles tables `expositions` et `exposition_oeuvres`. La colonne `statut_avant`
  mémorise l'état de chaque œuvre au départ, ce qui permet de le lui rendre à la clôture.
- Nouvelle dépendance **`qrcode-generator`** : JavaScript pur, **aucune dépendance**,
  aucun outil de compilation. Produit du SVG vectoriel, donc net à l'impression. Tout
  reste hors ligne. Isolée dans `src/qr.js`.
- Démos : `expositions.html` (les trois écrans) et `cartels-exposition.html` (les quatre
  formats, avec de vrais codes QR).

## [0.14.0] — 2026-08-27

> **Retours d'usage des parents.** Quatre corrections issues de l'usage réel, plus
> l'aide sur l'obtention des clés du site restée en attente depuis la 0.13.0.

### Ajouté

- **Cote « Hors normes ».** Nouvelle taille dans l'éditeur de cotes d'un artiste, pour
  fixer un tarif d'exception sur des œuvres précises. Contrairement aux autres tailles,
  elle **ne se calcule jamais** à partir des dimensions : on l'attribue à la main dans le
  champ **Format** de l'œuvre, et Galeria ne l'écrase plus ensuite. Filtrable dans la
  liste des œuvres.
- **Taille manuelle au calculateur de prix** (page Outils) : le nouveau champ
  « Taille utilisée pour la cote » reste sur **Automatique** par défaut ; on peut le
  forcer, notamment sur « Hors normes » que le calcul ne propose jamais. Une ligne
  rappelle ce que le calcul aurait donné, et la **cote retenue est surlignée** dans le
  tableau des cotes de l'artiste.
- **Valeurs libres sur quatre champs** : **Style** (qui était un menu fermé), **Type** et
  **Support** de l'œuvre, **Type** de l'artiste. On y saisit ce qu'on veut, et toute valeur
  déjà employée au catalogue revient ensuite dans les suggestions — le comportement du
  champ **Médium**, désormais partagé. Format, Orientation, Langue et Étiquettes de taxes
  restent volontairement fermés : leur liste pilote un calcul.
- **Avertissement avant un certificat au type non reconnu.** Le type de l'œuvre choisit le
  texte d'attestation ; un type inédit (« Céramique », « Installation ») retombait
  silencieusement sur celui de l'artiste peintre. Galeria le signale maintenant avant de
  produire le document, en disant quel texte sera employé, et laisse continuer ou annuler.
- **Nombre d'œuvres retirées** dans l'en-tête d'une fiche d'artiste, à côté de
  « Au catalogue » et « Disponibles ».
- **Aide** : article « Obtenir les clés du site web (WordPress / WooCommerce) », en six
  étapes, et guide imprimable `docs/Guide-cles-site-web.html` (en attente depuis la 0.13.0).

### Corrigé

- **Le nombre d'œuvres d'un artiste comptait les œuvres retirées et vendues.** Le nombre
  principal affiché — sur la carte de l'artiste, dans la liste et dans l'en-tête de sa
  fiche — est désormais celui des **œuvres disponibles**, et le tri « par nombre d'œuvres »
  le suit. La statistique « Au catalogue » exclut les retirées. Le garde-fou qui empêche de
  supprimer un artiste continue, lui, de compter **toutes** ses œuvres : sans cela, un
  artiste dont tout est vendu serait devenu supprimable sans avertissement.
- **C.V. collé à la main : lignes traitées comme des titres.** Dans la présentation
  d'artiste, une **année seule sur sa ligne** ne rejoignait pas le tableau, et une **puce
  collée au tiret** (« -Musée Beaulne ») était affichée en rouge italique comme un
  intertitre. Les puces « • » subissaient le même sort. Les puces qui suivent une entrée
  s'alignent maintenant sous leur année. Vérifié sur les 21 C.V. du site : 30 lignes
  corrigées, toutes des puces, aucune autre ligne touchée.

### Interne

- Le composant du champ Médium est extrait en brique générique réutilisable
  (`champListe`, `brancherDropdownListe`, `chargerValeursConnues` dans `commun.js`) ; le
  Médium l'utilise désormais au lieu d'avoir son propre code.
- La correspondance « type d'œuvre → attestation du certificat » devient une table unique
  dans `pdf.js`, exposée à l'interface, au lieu d'être réécrite des deux côtés.
- Requêtes de valeurs distinctes pour le support, le style et le type d'artiste, avec
  `TRIM` dans le `DISTINCT` pour éviter les doublons d'espaces.

## [0.13.0] — 2026-08-10

> **Phase 5 — Synchronisation avec le site web.** Galeria peut désormais comparer
> vos fiches (œuvres *et* artistes) avec la boutique WooCommerce du site et en reprendre
> les valeurs à jour — **en lecture seule, rien n'est modifié sur le site**. Plus une
> fenêtre « Quoi de neuf » à l'ouverture, une fenêtre d'ouverture un peu plus haute, et
> l'aide mise à jour.

### Ajouté

- **Synchronisation avec le site web (WooCommerce / WordPress).** Nouvelle section
  **Réglages → Site web** : adresse + clés REST (chiffrées dans le coffre de Windows,
  jamais en clair), test de connexion. Le bouton **« Comparer les fiches avec le site… »**
  ouvre l'écran de synchronisation. **Tout est en lecture seule.**
  - **Œuvres** — rapprochement par numéro d'inventaire (= SKU du site). Comparaison
    titre, description, prix, statut ; **reprendre la valeur du site** (avec **édition
    du texte avant remplacement** pour titre/description), **garder la version de l'app**
    (choix mémorisé, ne revient plus tant que le site ne rechange pas cette valeur).
    **Filtres** par type, **reprise en lot**, sélecteur de statut.
  - **Onglets** : Différences · Seulement dans l'app · Seulement sur le site.
  - **Réconciliation « un seul côté »** : créer une fiche d'œuvre depuis un produit du
    site (image téléchargée puis recadrée, artiste choisi), **corriger un SKU** (rattacher
    une œuvre existante mal numérotée plutôt que créer un doublon) ; **retirer / vendre /
    supprimer** une œuvre absente du site.
  - **Artistes** — rapprochement par nom (pages « portfolio » du site, lues par l'API
    WordPress publique, sans clé). Comparaison **Citation, Biographie, Démarche,
    Curriculum (C.V.), Photo**. Le C.V. du site (tableau) est repris en lignes lisibles
    « année — description » ; le contenu est découpé par sections vers les bons champs.
    Création de fiche artiste depuis le site ; téléchargement de la photo.
  - **Aperçu en modale** : « Voir la fiche » (œuvre ou artiste) ouvre un aperçu en
    lecture sans quitter l'écran de synchronisation.
  - **Bouton « Comparer avec le site »** directement sur chaque **fiche** d'œuvre et
    d'artiste (comparaison d'un seul élément, mêmes actions).
- **Champ « Citation » pour les artistes** (colonne en base + champ sur la fiche +
  onglet d'affichage), et bouton **« Séparer les citations »** : range en un clic la
  citation dans son champ à partir du site et la retire de la biographie où elle était
  incluse (n'agit que sur les artistes dont la citation est encore vide).
- **Fenêtre « Quoi de neuf » à l'ouverture** : résume les nouveautés après une mise à
  jour, montrée une seule fois aux utilisateurs qui reviennent (pas à une première
  installation, où le tutoriel de bienvenue suffit).
- **Aide** : nouvelle catégorie **« Site web & synchronisation »** (5 articles) +
  articles « clic droit » et notes (retrait via annexe A, n° d'inventaire sur les cartes).

### Modifié

- **Fenêtre d'ouverture un peu plus haute** (hauteur portée à 1000 px, toujours
  plafonnée à l'espace écran) pour éviter le défilement de la barre latérale.
- **Icône** ajoutée à la catégorie **Site web** dans les Réglages.
- **Base de données** : migrations additives (colonne `citation` sur les artistes,
  tables `web_sync_ignore` et `web_sync_ignore_artiste` pour mémoriser les « garder »).
  Sans risque pour les données existantes.

## [0.12.0] — 2026-08-09

> Corrections issues de l'usage réel : coller à la souris (menu clic droit),
> numéro d'inventaire sur les cartes d'œuvres, et retrait réel des œuvres au moment
> de produire l'annexe A de retrait.

### Ajouté

- **Menu clic droit (Couper / Copier / Coller / Tout sélectionner).** Le menu
  d'édition au clic droit, disparu quand la barre de menus a été retirée en
  production, est de retour partout dans l'application — y compris dans l'éditeur
  « Modifier ce document… ». « Coller » n'apparaît que dans un champ de saisie ;
  « Copier » et « Couper » seulement lorsqu'il y a une sélection. Corrige
  l'impossibilité de coller du texte à la souris. Nouveau module partagé
  `src/menu-contextuel.js`, branché sur la fenêtre principale (`main.js`) et sur
  l'éditeur de document (`pdf.js`).
- **Numéro d'inventaire sur les cartes d'œuvres (vue grille).** Affiché en petit,
  sous le nom de l'artiste (« Nº … ») ; rien ne s'affiche si l'œuvre n'a pas de
  numéro. Il figurait déjà dans la vue liste.

### Modifié

- **Annexe A de retrait : propose de retirer réellement les œuvres.** Quand on
  produit une annexe A **de retrait** depuis la fiche artiste, l'application
  demande ensuite, avec confirmation explicite, de retirer les œuvres du catalogue
  actif (rendues à l'artiste). Les œuvres vendues sont ignorées ; le geste est
  réversible (« Réintégrer »). Refuser laisse le PDF produit sans rien retirer. La
  fiche se rafraîchit après le retrait. Le retrait **en lot** depuis la liste des
  œuvres est inchangé (il retirait déjà les œuvres).

## [0.11.0] — 2026-07-25

> Grosse version : sécurité (verrou par code + question de secours), remaniement
> issu de l'usage réel des parents (« retours d'usage »), choix et déplacement du
> dossier de données (sortie de OneDrive), et quatre calculatrices sur la page
> Outils. Rien ne change pour les données existantes ; migrations additives et
> sauvegarde de sûreté automatique avant tout déplacement.

### Ajouté

- **Quatre calculatrices rapides sur la page Outils.** La page Outils passe en
  barre latérale à deux groupes (« Liés au catalogue » : prix, commission ;
  « Calculatrices rapides » : les quatre nouvelles). Toutes calculent en direct,
  n'écrivent rien en base et ne produisent aucun PDF.
  - **Taxes** : ajouter ou retirer les taxes d'un montant. Sélecteur de
    province/territoire — Québec au taux des Réglages, autres provinces au taux de
    la config (`outils.taxes_provinces`, indicatif, à valider avec le comptable).
    Même arrondi que la facture artiste.
  - **Conversion** : longueurs (po/cm/pi/m), poids (lb/kg/oz/g) et devises
    (CAD/USD/EUR) à double sens. Taux de change **récupérés à la Banque du Canada**
    (API Valet officielle) en meilleur effort, mémorisés pour le repli hors-ligne,
    corrigeables à la main. L'appel réseau se fait côté application ; aucune donnée
    de la galerie ne sort.
  - **Plan de versements** : échéancier (acompte $ ou %, nombre, fréquence, date),
    dernier versement ajusté pour un total exact au cent, bouton « Copier le
    tableau ». Sans intérêt.
  - **Expédition (poids)** : poids estimé de l'œuvre + poids d'expédition selon le
    support, les dimensions et les options (encadré, sous verre). Facteurs dans la
    config (`outils.expedition`), **à calibrer par des pesées réelles** (avertissement
    affiché).

- **Choisir et déplacer l'emplacement du dossier de données (retour d'usage :
  dossier introuvable à cause de OneDrive).** Nouvelle carte **« Dossier de
  données Galeria »** en tête de Réglages → Données : elle affiche l'emplacement
  actuel, avertit en douceur si le dossier est **synchronisé par OneDrive**
  (données copiées dans le nuage) et propose de le déplacer vers un dossier
  **local** (par défaut `C:\Users\<nom>\Galeria`, hors OneDrive). Deux gestes :
  **« Déplacer le dossier… »** (déplace base, photos, documents et sauvegardes)
  et un lien discret **« Indiquer à Galeria où les retrouver »** (pointer vers un
  dossier Galeria déjà présent, sans rien déplacer). Le déplacement fait une
  **sauvegarde de sûreté d'abord**, s'exécute **au redémarrage, base fermée**
  (renommage instantané sur le même disque, copie vérifiée entre deux disques
  avant d'effacer l'ancien), gère les chemins verrouillés (OneDrive/Explorateur)
  avec un message clair, et ne touche à rien en cas d'échec. L'adresse du dossier
  est mémorisée hors du dossier lui-même (`userData`, jamais redirigé par
  OneDrive). *Fondations :* `src/db/paths.js` (papier d'adresse + demande de
  déplacement), `src/db/deplacer-donnees.js` (moteur vérifié par banc d'essai),
  branchement au démarrage et IPC dans `src/main.js`, écran dans
  `src/app/vues/reglages.js`. Démo `demos/reglages-donnees.html`.

### Sécurité

- **Sortie possible du nuage OneDrive.** Le déplacement du dossier de données
  vers un emplacement local permet de retirer les renseignements des clients et
  des artistes d'un dossier synchronisé dans le nuage Microsoft — conforme au
  principe « tout reste local » et à la Loi 25.

### Modifié

- **Pages Documents et Outils en barre latérale (cohérence avec les Réglages).**
  Les deux pages adoptent la disposition maître-détail introduite pour les
  Réglages. **Documents** : une barre latérale liste les types (Certificats,
  Factures artiste, Présentations, Annexes, Catalogues, Rapports, Pochettes) avec
  un compteur ; elle remplace l'ancien filtre Type et pilote **les deux vues** —
  en Liste elle filtre, en Explorateur elle restreint l'arbre au type et saute le
  niveau redondant (Année → fichiers directement). La recherche et les filtres
  Année/Artiste/Client restent en haut du panneau, et la bascule Liste/Explorateur
  aussi. **Outils** : deux entrées de barre latérale — « Calculateur de prix »
  (avec les Cotes de l'artiste, couplées) et « Calculateur de commission » (avec
  le tableau de référence). Aucune logique de calcul changée, tous les
  identifiants préservés.
- **Édition des documents plus claire et plus sûre (retour d'usage de Dave).**
  Le bouton « Version modifiée… » — qui laissait croire qu'une version modifiée
  existait déjà — devient **« Modifier ce document… »** partout (fiche de vente,
  annexe), et il apparaît désormais aussi dans la **section Documents** pour les
  certificats, factures artiste et présentations. Nouveau bouton **« Insérer un
  saut de page »** dans la fenêtre d'édition : il pousse sur une nouvelle page la
  section où se trouve le curseur (repère visuel à l'écran, neutre à
  l'impression), re-cliquer l'annule. Sur la **présentation**, « Démarche » et
  « Curriculum » commencent désormais **chacun sur une nouvelle page** (fini le
  petit bout de section en bas de page suivi de vide ; pas de page blanche si la
  biographie est absente). Enfin, « Modifier ce document » sur un **certificat**
  n'**écrase plus le PDF officiel** : la version modifiée est un fichier séparé,
  comme pour la lettre et la présentation (un certificat est un document
  numéroté).
- **Page Réglages refondue en barre latérale (retour d'usage de Dave).** La
  mosaïque de huit cartes devenait confuse : elle est remplacée par une
  disposition maître-détail — une barre latérale à gauche (**La galerie,
  Finances, Documents, Données, Sécurité, Intelligence artificielle,
  Application**) et un panneau à la fois à droite. Concept repris de la branche
  parquée (`121c01a`) mais **réappliqué à la main** sur le code actuel (le commit
  d'origine, antérieur au verrou et à la question de secours, aurait réintroduit
  un doublon de restauration et un onglet chiffrement parqué).
- **Le Profil de la galerie est fondu dans les Réglages** (catégorie « La
  galerie ») : sa page séparée et le bloc en bas de la barre latérale sont
  retirés. L'ancienne route `profil-galerie` redirige vers Réglages → La galerie
  pour ne casser aucun lien.
- **Nouvelle catégorie « Finances » réunissant toute la fiscalité** : les numéros
  d'enregistrement TPS/TVQ (qui étaient dans le Profil) rejoignent les taux de
  TPS/TVQ et la cote (qui étaient dans les Réglages), auparavant sur deux écrans
  différents.
- **Sélecteur de fichier pour le logo de la galerie.** Il fallait taper le chemin
  complet à la main ; un bouton « Choisir un fichier… » ouvre désormais un
  sélecteur (IPC `config:choisir-logo`, filtré images), avec un bouton « Retirer »
  pour revenir au logo par défaut.
- Comme tout vit dans un **seul formulaire**, changer de catégorie ne perd aucune
  saisie ; l'avertissement inter-catégorie prévu par la branche parquée est
  devenu inutile. Un indicateur « Modifications non enregistrées » s'affiche dans
  la barre du bas. Aucune logique de réglage n'a changé : mêmes champs, mêmes
  effets, tous les identifiants préservés.

### Corrigé

- **Écran de verrouillage : le pavé numérique ne répondait pas quand NumLock
  était éteint.** Signalé par Dave le 2026-07-18 (« ça marche seulement avec la
  souris »), puis reproduit en banc d'essai Electron. `clavier()` ne regardait
  que `e.key` (le caractère produit) ; or, NumLock éteint, le pavé n'envoie pas
  de chiffres mais des touches de navigation (`Numpad5` → `Clear`, `Numpad2` →
  `ArrowDown`, `Numpad1` → `End`…), que l'écran jetait **en silence, sans aucun
  message**. Défaut intermittent et déroutant : il disparaît dès que NumLock est
  rallumé par inadvertance. Nouvelle fonction `toucheVersAction()` qui lit
  d'abord `e.code` (l'emplacement physique de la touche, indépendant de
  NumLock), puis retombe sur `e.key` pour la rangée du haut. `NumpadEnter` =
  valider, `NumpadDecimal`/`Suppr` = effacer ; les raccourcis système
  (Ctrl/Alt/Meta) ne sont plus détournés.
- **Écran de verrouillage : le clavier pouvait ne pas y arriver du tout.** La
  carte reçoit maintenant le focus au verrouillage (`tabindex="-1"`) et le
  reprend quand la fenêtre redevient active — sans ça, les frappes partaient
  vers ce qui avait le focus avant, ou nulle part après un changement de
  fenêtre. Ajout d'un indice visible « Cliquez les chiffres, ou tapez le code au
  clavier. »
- **Écran de verrouillage : asymétrie souris/clavier.** Le clavier vérifiait que
  l'écran était bien verrouillé avant d'agir, mais **pas les clics du pavé**.
  Les deux chemins portent désormais la même garde — c'est exactement ce type
  d'asymétrie qui produit un écran « qui répond à la souris mais pas au
  clavier ». Démo `demos/verrou-clavier.html` (mouchard des touches + case pour
  simuler NumLock éteint). Banc d'essai Electron avec vraies frappes : vérifié
  qu'il échoue sur l'ancien code et passe sur le nouveau.

### Sécurité

- **Question de secours pour un code oublié.** Sans elle, un code perdu voulait
  dire éditer `config.json` à la main — hors de portée des propriétaires.
  Facultative mais recommandée, définie dans **Réglages → Sécurité** (5 questions
  proposées ou question libre). La réponse est protégée **comme le code**
  (empreinte scrypt salée, jamais en clair) et **normalisée avant comparaison** :
  accents, casse, espaces et ponctuation ignorés, si bien que « Sainte-Foy »,
  « sainte foy » et « SAINTEFOY » sont équivalents — sans cette tolérance, le
  secours refuserait la réponse de son propre propriétaire. Sur l'écran de
  verrouillage, **« Code oublié ? »** affiche la question, puis fait choisir un
  nouveau code : l'accès n'est jamais donné sans changer le code, donc une
  intrusion laisse une trace visible. **Freinage** après 3 mauvaises réponses
  (pause de 30 s, appliquée même à la bonne réponse). La réinitialisation est un
  **appel unique** côté processus principal qui revérifie la réponse — l'interface
  ne peut pas sauter l'étape de vérification. Retirer le code retire aussi la
  question. Nouveaux IPC `securite:definir-question`, `securite:retirer-question`,
  `securite:verifier-reponse`, `securite:reinitialiser-code` ; l'empreinte de la
  réponse est retirée de `config:get` comme celle du code. Article d'aide + article
  **Soutien** documentant le dernier recours (effacer le bloc `securite` de
  `config.json`). Démo `demos/verrou-secours.html`, **générée** depuis
  `src/app/verrou.js` et `src/styles.css` par `scripts/construire-demo-verrou.js`
  pour qu'elle ne puisse pas dériver du code livré.
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

## [0.10.0] — 2026-07-18

> **Chantier de robustesse — audit du 2026-07-06, 7 lots livrés.**
> Version entièrement consacrée à la fiabilité : aucune fonctionnalité
> nouvelle côté métier, mais l'application ne peut plus échouer en silence.
> Les huit lots de l'audit ont été traités — sept livrés et **confirmés par
> Dave dans l'app**, un (chargement de catalogue) écarté puisque les builds à
> base intégrée ne seront plus produits.
>
> **En bref, ce qui n'est plus possible** : rester figée au démarrage sans
> message · recréer un catalogue vide en silence quand la base a disparu ·
> perdre les compteurs de numéros de factures · cesser de sauvegarder sans le
> dire · enregistrer un prix négatif ou une vente à 0 $ par inadvertance ·
> créer une fiche en double sur un double-clic · afficher un code d'erreur
> technique en anglais · imprimer une année inventée sur un certificat
> d'authenticité.
>
> Le détail par lot suit, du plus récent au plus ancien.

### Lot 5 — Documents

> Corrige des données fausses ou maladroites sur les documents remis
> aux clients et aux artistes.

### Corrigé

- **Certificat : une année absente n'imprime plus « 2024 ».** Le sélecteur
  d'année du gabarit présélectionne 2024 pour l'usage autonome ; quand
  Galeria fournissait une année vide (cas fréquent, beaucoup d'œuvres n'en
  ont pas), `setOptionAnnee("")` abandonnait sans rien vider et le certificat
  imprimait **2024** — une donnée fausse sur un document officiel. Le
  certificat affiche désormais une année vide, comme le font déjà médium /
  support / dimension quand ils manquent.
  **Exception au périmètre approuvée par Dave (2026-07-18)** : la correction
  touche `gabarits/gabarit-certificat.html`, mais **uniquement la fonction
  `setOptionAnnee` du bloc « Intégration Galeria »** (couche ajoutée pour
  l'app) — aucun style, aucun élément du design d'origine, et le comportement
  du gabarit en usage autonome est inchangé. Vérifié dans un navigateur :
  année vide → vide, 2019 → 2019, retour à vide → vide, 1930 → 1930.
- **Lettre de remerciement : plus de « Bonjour , ».** Si le client n'a pas de
  prénom, la lettre se replie sur son nom de famille (`src/pdf.js`).
- **Numéro d'annexe A libéré si le document n'est pas produit.** Le numéro
  était réservé avant le rendu : un échec de génération ou une annulation de
  l'éditeur le brûlait et laissait une ligne fantôme en base (invisible dans
  la section Documents). Le numéro est maintenant rendu (`annulerAnnexe`,
  `src/db/mutations.js`), et une annexe dont le PDF existe n'est jamais
  supprimée.
- **Noms de fichiers trop longs.** Un titre d'œuvre à rallonge, ajouté au
  dossier de pochette (année / client / facture), pouvait dépasser la limite
  Windows de 260 caractères et faire échouer l'écriture du PDF. La partie
  variable du nom est tronquée proprement (sur un espace, avec « … »).

### Note

- **Fichier verrouillé (PDF ouvert dans Acrobat)** : signalé par l'audit sur
  le certificat et la facture artiste. Traité au **Lot 7** — le message est
  désormais clair en français (« Le fichier est ouvert dans un autre
  programme… »). Le repli automatique vers un fichier « (2) » n'a
  volontairement **pas** été appliqué à ces deux documents numérotés : un
  refus explicite vaut mieux qu'un doublon silencieux.

### Lot 8 — Cohérence & ménage

> Aligne ce qui pouvait diverger, et retire le code mort.

### Corrigé

- **Le calculateur de commission suit les Réglages.** Il appliquait 50 % en
  dur, alors que la facture artiste utilise la cote configurée : changer la
  cote (ex. 45 %) donnait un montant annoncé différent du montant facturé. Le
  calculateur, le menu « Type d'œuvre » et la carte « Commissions par type »
  lisent désormais la même règle que la facture (`src/app/vues/outils.js`).
- **Supprimer un client vérifie ses réservations.** La suppression n'était
  bloquée que par les ventes : on pouvait effacer un client et laisser une
  œuvre « réservée pour personne » (et des notes de réservation orphelines à
  son nom — angle Loi 25). Refus clair nommant la ou les œuvres concernées,
  avec la marche à suivre (`supprimerClient`, `src/db/mutations.js`).

### Modifié

- **Règles de calcul regroupées.** Le format d'œuvre (√(H×L), seuils
  16/30/42), l'orientation et le texte des dimensions étaient écrits en trois
  exemplaires ; les deux copies côté interface sont réunies dans
  `src/app/calcul-prix.js` (source unique pour la fiche d'œuvre et les
  Outils). La cote par type y est aussi exposée. **Aucune règle de calcul
  n'est changée** — les copies étaient identiques. La copie du processus
  principal (`src/db/mutations.js`, CommonJS, utilisée par l'édition en lot)
  subsiste faute de module partageable entre les deux mondes : les deux
  fichiers portent maintenant un avertissement croisé explicite.

### Retiré

- **15 passerelles mortes entre l'interface et le cœur** (`preload.js` +
  handlers `main.js`), vérifiées inutilisées : `dbStats`, les quatre
  `*Voisins`, `venteGet`, `certificatGet`, `certificatModifier`,
  `certificatApercuNumero`, `certificatReserverNumero`, `oeuvresStats`,
  `clientVentes`, `oeuvreVentes`, `pdfPresentationPersonnalisee`,
  `photoLireOriginale` — ainsi que les imports devenus inutiles. Les
  fonctions sous-jacentes sont conservées. Vérification croisée automatisée
  après coup : **99 passerelles, toutes utilisées, toutes branchées, aucun
  handler orphelin**.

### Lot 7 — Messages clairs & clics qui répondent

> Rend les pépins visibles et compréhensibles, et répare des boutons qui ne
> faisaient rien.

### Corrigé

- **Erreurs techniques traduites en français.** `nettoyerErreur`
  (`src/app/commun.js`) reconnaît désormais les cas courants et affiche une
  phrase claire : fichier ouvert dans un autre programme (EBUSY/EPERM — un PDF
  dans Acrobat), disque plein (ENOSPC), fichier introuvable (ENOENT), base
  occupée (SQLITE_BUSY) ou abîmée (SQLITE_CORRUPT). Bénéficie à tous les
  dialogues d'erreur de l'app.
- **Messages d'erreur bruts remplacés partout.** Les ~15 endroits qui
  affichaient encore le message technique d'origine (Réglages, Profil,
  édition en lot, import, annexes, éditeur de document, rapport, tableau de
  bord, routeur, certificat…) passent maintenant par `nettoyerErreur`.
- **« Produire un certificat » ne peut plus geler.** La préparation
  (chargement de la config + aperçu du numéro) se fait avant d'ouvrir la
  fenêtre ; un échec affiche une erreur et referme proprement, au lieu de
  laisser un bouton sans réponse (`ouvrirCreationCertificat` restructurée,
  `src/app/vues/certificat-creation.js`).
- **Bouton « Écrire au soutien » réparé.** Le handler d'ouverture d'URL
  accepte désormais les liens `mailto:` (`src/main.js`), qui étaient rejetés.
- **Bouton « + Ajouter un sujet » réparé.** Il utilisait `window.prompt`, que
  l'application Electron ne supporte pas (clic sans effet). Remplacé par une
  petite fenêtre de saisie interne au style de l'app (nouveau
  `demanderTexte`, `src/app/dialogue.js`).
- **Sélecteurs d'œuvre et de client pendant une vente** : un échec de
  chargement affiche un message dans la zone au lieu d'une liste vide sans
  explication (`src/app/vues/vente-fiche.js`). Les autres clics dont l'appel
  échoue sont déjà rattrapés par le filet global d'erreur du Lot 1.

### Lot 6 — Validation des saisies

> Empêche les mauvaises données d'entrer, en langage clair et sans jargon.

### Corrigé

- **Valeurs numériques invalides refusées au cœur de l'app** (dernier rempart,
  `src/db/mutations.js`). Prix, frais de production, dimensions (H/L/P),
  rabais, montants de taxes et valeur de certificat **négatifs** sont refusés
  avec un message nommant le champ ; l'**année** doit être un nombre à quatre
  chiffres plausible. S'applique à la création **et** à l'édition en lot
  (protège aussi tout import futur). Vérifié par banc d'essai (16 cas).
- **Nombre illisible collé** (ex. « 1 234,56 » depuis Excel, qui vidait le
  champ en silence) : détecté à l'enregistrement (œuvre, vente, certificat,
  cotes) → message clair + focus sur le champ, au lieu d'une perte muette.
- **Vente à 0 $** : demande de confirmation explicite avant d'enregistrer
  (prix oublié ?), au lieu d'un enregistrement silencieux
  (`src/app/vues/vente-fiche.js`).
- **Taux de taxe hors bornes** (0 à 100 %) refusé dans le formulaire de vente.
- **Double-clic sur « Enregistrer » : plus de fiche/vente en double.** Un
  utilitaire partagé (`soumissionUnique`, `src/app/commun.js`) ignore les
  soumissions concurrentes et désactive le bouton d'envoi pendant tout le
  traitement — appliqué aux formulaires œuvre, artiste, client, vente
  (+ modale « Nouveau client ») et certificat.
- **Édition en lot : garde-fou « modifications non enregistrées ».** Quitter
  la page (barre latérale, etc.) pendant une édition en lot non enregistrée
  demande maintenant confirmation au lieu de tout perdre
  (`src/app/vues/oeuvres-liste.js`).
- **« Modifier une vente » aussi strict que la création.** Faire pointer une
  vente vers une autre œuvre applique désormais les mêmes garde-fous :
  œuvre déjà vendue refusée, garde-fou Sage 50, et nettoyage d'une éventuelle
  réservation résiduelle (`modifierVente`, `src/db/mutations.js`).

### Lot 3 — Sauvegardes

> Le filet ultime de l'app devient fiable, vérifié, et utilisable par les
> parents eux-mêmes.

### Ajouté

- **Bouton « Restaurer une sauvegarde… »** (Réglages → Sauvegardes). Liste
  les copies des deux dossiers (défaut + personnalisé) avec leur **date lue
  du nom de fichier**, la plus récente en tête. Après confirmation
  explicite : l'intégrité de la copie choisie est vérifiée **avant** de
  toucher à la base, la base actuelle est mise de côté
  (`galerie-avant-restauration-…`), puis l'app redémarre sur les données
  restaurées. La réponse part au renderer **avant** le redémarrage (pas
  d'erreur avalée). IPC `backup:liste` / `backup:restaurer` / `backup:etat`.
- **Ligne d'état des sauvegardes** dans les Réglages : date de la dernière
  copie sur disque, nombre de copies, et avertissement si le dernier essai a
  échoué ou est parti en repli.
- **Copie automatique avant migration.** Quand la version de l'app change
  (`derniere_version_app` dans la config), la base est copiée **avant**
  l'ouverture et les migrations de schéma (`galerie-avant-migration-…`,
  avec ses fichiers `-wal`/`-shm` s'ils existent ; 3 copies conservées).
- **Sauvegarde réelle avant chaque import CSV** (`galerie-avant-import-…`,
  5 conservées) — l'aide intégrée la promettait déjà, le code ne la faisait
  pas. Si cette copie échoue, l'import est **refusé** (pas d'écriture sans
  filet).

### Corrigé

- **Copie de sauvegarde fiable et vérifiée** (`src/db/backup.js` refondu).
  La copie passe par **`VACUUM INTO`** (instantané cohérent produit par
  SQLite, indépendant de l'état du journal WAL, compacté) au lieu d'un
  `copyFile` dont le checkpoint pouvait échouer silencieusement. Chaque
  copie est ensuite **vérifiée** (taille non nulle + `PRAGMA quick_check`
  en lecture seule) ; une copie invalide est supprimée et l'erreur remontée.
  Deux copies dans la même seconde reçoivent des noms distincts, désormais
  correctement **datés et couverts par la rotation** (suffixe `-2`).
- **Échec de sauvegarde impossible à manquer.** Dossier configuré
  inaccessible (clé USB retirée) → **repli automatique sur le dossier par
  défaut** + alerte dans l'app. Les alertes ne partent qu'au **changement
  d'état** (échec, repli, retour à la normale) — pas une par heure. Échec de
  la sauvegarde de fermeture → boîte de dialogue explicite + `erreurs.log`.
  « Sauvegarder maintenant » signale aussi le repli.
- **Défaut de rétention officialisé à 50 copies** (décision Dave 2026-07-17 ;
  `CLAUDE.md` §11 mis à jour, la doc disait 30).

### Lot 2 — Réglages & compteurs

> Protège `config.json` — le fichier qui porte les compteurs de numéros de
> factures — contre la troncature et la perte silencieuse.

### Corrigé

- **Écriture atomique de `config.json`** — le fichier des réglages est écrit
  dans un fichier temporaire puis basculé d'un coup à sa place
  (`rename`). Une coupure de courant pendant l'enregistrement laisse soit
  l'ancien fichier intact, soit le nouveau complet — plus jamais un JSON
  tronqué (`src/config.js`, `ecrireFichierConfig`, appliqué aussi à la
  création initiale du fichier).
- **Config illisible : conservée et signalée.** Si `config.json` est malgré
  tout illisible, il est **copié** sous `config.json.corrompu-{date}` avant
  que l'app reparte sur les défauts, et un **message au démarrage** explique
  la réinitialisation et où retrouver l'ancien fichier — au lieu du repli
  silencieux qui écrasait tout à la première écriture suivante.

### Ajouté

- **Garde-fou anti-doublons des compteurs de numérotation**
  (`rehausserCompteursSelonBase`, `src/db/mutations.js`, appelé au
  démarrage). Si un compteur (facture client, facture artiste, certificat
  ancien format `C-2026-NNN`) est **en retard sur les numéros déjà utilisés
  en base** — config perdue, ou « Prochain numéro » abaissé par erreur dans
  les Réglages — il est rehaussé à max + 1. Plus aucun numéro de facture en
  double possible, même après une perte de configuration. Le **numéro
  composé** des nouveaux certificats (`{inventaire}-{seq}-{sage}`) est exclu
  du calcul (son dernier segment est un n° Sage), et le **compteur
  d'inventaire n'est pas touché** (numéros historiques Airtable au format
  libre ; une suggestion erronée y est visible et corrigeable à la saisie).
  Vérifié par banc d'essai d'intégration (schéma complet, idempotence, ancien
  préfixe `F-2026` compté, numéro Sage exclu).

### Lot 1 — Filets de sécurité

> Premier lot du chantier : plus aucun échec ne peut passer inaperçu.
> Aucun changement visuel, aucun changement de données.

### Corrigé

- **Démarrage protégé.** Si une étape du démarrage échoue (base de données
  illisible ou verrouillée, dossier Documents inaccessible, migration
  impossible), l'app affiche désormais un **message clair en français** et se
  ferme proprement — au lieu de rester figée pour toujours sur l'écran de
  démarrage (fenêtre non fermable et absente de la barre des tâches). Le
  renommage `GalerieApp` → `Galeria` qui échoue (dossier verrouillé par
  OneDrive/Explorateur) **ne bloque plus le démarrage** : l'app continue avec
  l'ancien dossier et retentera au prochain lancement (`src/db/paths.js`).
- **Base disparue → restauration proposée.** Si le fichier de base est absent
  ou vide alors que des **sauvegardes existent** (dossier par défaut ou dossier
  personnalisé des Réglages), l'app propose au démarrage de **restaurer la plus
  récente** (datée), au lieu de recréer silencieusement un catalogue vide. Le
  fichier abîmé éventuel est mis de côté (`galerie.db.remplace-…`), les restes
  de journal `-wal`/`-shm` sont nettoyés. La date d'une sauvegarde est lue
  depuis l'**horodatage de son nom de fichier** (repli : date de modification) —
  Windows préservant la date de modification lors d'une copie, s'y fier
  faisait proposer et afficher une date plus vieille que la vraie (constaté
  par Dave au premier essai).
- **Vue Suivi : plus d'échec muet.** Cocher/décocher une étape de préparation
  (Sage/Stock/Site) ou du cycle de vente (paiement, emballage, envoi,
  livraison) affiche maintenant un **dialogue d'erreur** si l'enregistrement
  échoue, puis repeint l'état réel — l'affichage ne peut plus laisser croire
  qu'un statut a été enregistré alors qu'il ne l'a pas été
  (`src/app/vues/suivi.js`).

### Ajouté

- **Filets globaux d'erreur.** Côté moteur : toute erreur imprévue est
  consignée dans `Documents\Galeria\erreurs.log` (horodatée, avec détail
  technique) et signalée par une boîte en français — au plus une par 10 s
  (`uncaughtException`/`unhandledRejection` dans `src/main.js`). Côté
  interface : toute promesse rejetée ou exception non attrapée affiche le
  dialogue d'erreur standard de l'app — au plus un par 5 s — au lieu d'un clic
  qui ne fait rien (`unhandledrejection`/`error` dans `src/app/app.js`). Le
  démarrage de l'interface est aussi protégé (une entête qui échoue n'empêche
  plus l'accueil de s'afficher).

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
