# Galeria — Nouveautés depuis la dernière version installée

> Petit résumé, en mots simples, de ce qui a été ajouté à l'application au fil des
> versions — **les nouveautés les plus récentes en premier**. À remettre avec la
> prochaine mise à jour.

> **Une grande partie de la version 0.10.0 ne se voit pas** : c'est un travail
> de fond pour que l'application soit solide et ne vous laisse jamais dans le
> doute. Si quelque chose ne fonctionne pas, elle vous le dit maintenant
> clairement, en français, et vous propose quoi faire.

---

## Depuis la version 0.13.0 — vos retours d'usage

Quatre choses que vous nous avez signalées en vous servant de Galeria.

**Le nombre d'œuvres d'un artiste était faux.** Il comptait aussi les œuvres
**retirées** et les œuvres **vendues**, ce qui donnait un total qui ne
correspondait à rien de visible. Désormais, le nombre affiché sur la carte d'un
artiste, dans la liste et en haut de sa fiche est celui de ses **œuvres
disponibles** — celles que vous pouvez vendre aujourd'hui. L'en-tête de la fiche
montre maintenant aussi le nombre d'œuvres **retirées**, à côté de
« Au catalogue » et « Disponibles ».

**Les C.V. collés depuis le site s'affichaient mal.** Quand vous copiiez un C.V.
à la main depuis votre site, certaines lignes ressortaient en **rouge et en
italique** comme si c'étaient des titres de section — par exemple
« -Musée Beaulne, Coaticook ». De même, une **année seule sur sa ligne** restait
en dehors du tableau au lieu de rejoindre sa description. C'est réglé : ces
lignes se placent maintenant correctement, et les points d'une même année
s'alignent sous elle.

**Une cote « Hors normes ».** Vous pouvez maintenant fixer un tarif d'exception
pour des œuvres qui sortent de l'ordinaire. Sur la fiche d'un artiste, ajoutez
une cote dont la taille est **Hors normes**. Ensuite, sur l'œuvre concernée,
choisissez **Hors normes** dans le champ *Format* — et c'est ce tarif-là qui
s'appliquera à elle seule. Galeria ne choisira **jamais** « Hors normes » toute
seule : c'est un choix qui vous appartient, œuvre par œuvre. Le calculateur de
prix de la page **Outils** a reçu un nouveau champ pour l'essayer.

**« Autre » dans les menus de choix.** Le champ **Style** était un menu fermé :
impossible d'y ajouter quoi que ce soit. Il est maintenant libre, comme le
champ Médium l'était déjà. Même chose pour le **Type** et le **Support** d'une
œuvre, et le **Type** d'un artiste. Vous tapez ce que vous voulez, et votre
valeur revient dans la liste des suggestions la fois suivante. *(Quatre champs
restent volontairement fermés — Format, Orientation, Langue et les étiquettes de
taxes — parce que Galeria s'en sert pour ses calculs.)*

**Une sécurité de plus sur les certificats.** Le type d'une œuvre détermine le
texte d'attestation du certificat. Si vous saisissez un type que Galeria ne
connaît pas — « Céramique », « Installation » — elle vous **prévient avant de
produire le document** et vous dit quel texte sera utilisé, pour que vous
puissiez corriger. Avec les types habituels, rien ne change.

**Et l'aide sur les clés du site.** L'aide contient maintenant un article
**« Obtenir les clés du site web »** qui explique la marche à suivre en six
étapes. Un guide imprimable existe aussi si vous préférez l'avoir sur papier.

---

## Depuis la version 0.12.0 — la synchronisation avec votre site web

La grande nouveauté : Galeria peut maintenant **se relier à votre site web** pour
**comparer vos fiches** avec la boutique en ligne et vous aider à les tenir à jour.
**Rien n'est jamais modifié sur le site — Galeria ne fait que le lire.**

- **Se connecter (une seule fois).** Dans **Réglages → Site web**, on entre l'adresse
  du site et les clés (fournies par la personne qui gère le site). Elles sont
  **rangées en sécurité** et cachées. Un bouton **« Tester la connexion »** confirme
  que tout va bien.
- **Comparer et mettre à jour.** Le bouton **« Comparer les fiches avec le site »**
  montre, côte à côte, ce qui diffère (titre, description, prix, statut pour les
  œuvres ; biographie, démarche, C.V., citation, photo pour les artistes). Pour
  chaque écart, vous pouvez **reprendre la valeur du site** (en ajustant le texte
  avant, si vous voulez) ou **garder la vôtre** (Galeria s'en souvient et ne vous le
  redemande plus).
- **Ce qui n'est que d'un côté.** Galeria peut **créer une fiche** à partir d'un
  produit ou d'un artiste présent seulement sur le site, ou signaler une œuvre qui
  n'est que dans l'application.
- **Depuis une fiche.** Sur **chaque fiche** d'œuvre ou d'artiste, un bouton
  **« Comparer avec le site »** vérifie cet élément tout seul, en un clic.

**Un champ « Citation » pour les artistes.** Les artistes ont maintenant un champ
dédié pour leur **citation** (la phrase en exergue), au lieu de la mettre dans la
biographie. Un bouton **« Séparer les citations »** fait le ménage automatiquement à
partir du site — à faire une seule fois.

**Une petite fenêtre « Quoi de neuf »** s'affiche après une mise à jour pour vous
présenter les nouveautés.

---

## Depuis la version 0.11.0 — trois petites améliorations

- **Coller avec la souris (clic droit).** Vous pouvez de nouveau faire un
  **clic droit** dans une case de texte pour **Coller** (ou Copier, ou Couper).
  Cela fonctionne partout dans l'application, y compris quand vous modifiez un
  document avant de l'imprimer.
- **Le numéro d'inventaire s'affiche sur les cartes d'œuvres.** Dans la page
  **Œuvres**, en affichage « grille », le numéro d'inventaire apparaît maintenant
  en petit sous le nom de l'artiste.
- **Retirer les œuvres en produisant l'annexe de retrait.** Quand vous produisez
  une **Annexe A de retrait** pour un artiste, l'application vous propose ensuite
  de **retirer ces œuvres du catalogue** (elles sont rendues à l'artiste). Elle
  demande toujours votre confirmation avant, et c'est réversible.

*(Les nouveautés ci-dessous étaient déjà dans la version 0.11.0, que vous avez
reçue.)*

---

## Quatre nouvelles calculatrices (page Outils)

La page **Outils** est maintenant classée en deux familles à gauche : les outils
liés au catalogue (calculateur de prix, de commission) et de nouvelles
**calculatrices rapides**. Elles calculent toutes seules à mesure que vous tapez,
et **rien n'est enregistré** — ce sont de simples aides.

- **Taxes** — ajoutez ou retirez les taxes d'un montant, sans créer de vente.
  Vous pouvez choisir la **province** (utile pour un client d'ailleurs au Canada) ;
  le Québec utilise vos taux des Réglages.
- **Conversion** — convertit les **longueurs** (pouces, cm, pieds, mètres), les
  **poids** (livres, kilos, onces, grammes) et les **devises** (dollars canadiens,
  américains, euros). Le taux de change est **récupéré tout seul à la Banque du
  Canada** quand vous avez Internet, et il garde le dernier taux connu sinon.
- **Plan de versements** — proposez un échéancier à un client : montant total,
  acompte, nombre de versements, fréquence, date de départ. Le tableau se calcule
  et un bouton permet de le **copier** (pour le coller dans un courriel).
- **Expédition (poids)** — donne un **poids approximatif** pour préparer un envoi,
  d'après le type d'œuvre et ses dimensions. ⚠️ C'est une **estimation à ajuster** :
  avant de vous en servir pour facturer un envoi, pesez une ou deux œuvres pour
  vérifier.

## Choisir où sont rangées vos données (et les sortir du nuage)

Vos données (catalogue, photos, documents, sauvegardes) sont dans un dossier
nommé **Galeria**. Il pouvait être difficile à retrouver, parce que **OneDrive**
déplace parfois le dossier « Documents » dans le nuage — et, du même coup, vos
renseignements de clients s'y trouvaient copiés.

Dans **Réglages → Données**, une nouvelle section **« Dossier de données
Galeria »** vous montre où sont vos données et vous permet de les ranger là où
vous voulez :

- Si vos données sont dans un dossier synchronisé par OneDrive, Galeria vous
  **prévient** et vous propose de les déplacer vers un dossier **sur votre
  ordinateur seulement** (par exemple dans votre dossier personnel).
- Le bouton **« Déplacer le dossier… »** s'occupe de tout : il fait **une
  sauvegarde d'abord**, déplace vos fichiers, puis redémarre Galeria. Rien n'est
  perdu, même si quelque chose se passe mal.
- Si votre dossier Galeria se trouve déjà ailleurs, le petit lien **« Indiquer à
  Galeria où les retrouver »** permet de pointer l'application dessus, sans rien
  déplacer.

Vous pouvez aussi voir et **ouvrir** l'emplacement actuel d'un clic pour le
retrouver dans l'Explorateur Windows.

## Modifier un document avant de l'imprimer

Le bouton pour retoucher un document s'appelle maintenant **« Modifier ce
document… »** (au lieu de « Version modifiée »). Il ouvre le document dans une
fenêtre où vous corrigez le texte, puis vous enregistrez en PDF — **vos données
ne changent pas**.

- Nouveau bouton **« Insérer un saut de page »** : placez le curseur au début de
  ce qui doit aller sur une nouvelle page, cliquez, et le texte descend à la
  page suivante. Re-cliquez pour l'enlever.
- Le bouton est aussi accessible depuis la **section Documents**, plus seulement
  depuis la fiche de vente.
- Sur la **présentation d'artiste**, la « Démarche » et le « Curriculum »
  commencent maintenant **chacun sur une nouvelle page**, pour une mise en page
  plus nette.

## Une page Réglages plus claire

La page **Réglages** était devenue chargée. Elle est maintenant organisée par
**catégories, dans une liste à gauche** : vous cliquez une catégorie et vous ne
voyez que ses réglages, un écran à la fois.

- **La galerie** — votre nom, vos coordonnées, votre adresse et votre logo.
  (C'est l'ancien « Profil de la galerie », qui vit maintenant ici.)
- **Finances** — vos numéros de TPS et de TVQ, les taux de taxes et votre
  commission, enfin **réunis au même endroit**.
- **Documents**, **Données** (sauvegardes, import), **Sécurité**,
  **Intelligence artificielle** et **Application**.

Pour le **logo**, un bouton **« Choisir un fichier… »** ouvre maintenant une
fenêtre pour sélectionner l'image — plus besoin de taper le chemin à la main.

## Lettre de remerciement embellie

- Le **logo de la galerie** apparaît en haut, avec la **date** juste en dessous.
- La **signature** est à droite, avec **un espace pour signer à la main**.
- Vos coordonnées (adresse, téléphone, courriel, **site web**) sont regroupées
  proprement dans l'en-tête.

## Petites corrections

- Sur l'**accueil**, la case du haut compte maintenant les **œuvres disponibles**
  (ce qu'il reste à vendre), et non plus toutes les œuvres.
- Sur la fiche d'un **artiste**, les boutons qui produisent des documents sont
  regroupés dans un menu **« Documents »**, plus faciles à distinguer des autres.

---

## Modifier plusieurs œuvres à la fois

Un nouveau bouton **« Édition en lot »** sur la page **Œuvres** ouvre un grand
tableau, comme un chiffrier. Vous y voyez plusieurs œuvres en lignes et vous
pouvez corriger directement le prix, le statut, le médium, l'emplacement, etc.,
sur plusieurs œuvres d'un coup.

- Vous pouvez aussi **cocher plusieurs œuvres** et leur donner **la même valeur**
  d'un seul geste (par exemple passer dix œuvres en « vendu »).
- Rien n'est enregistré tant que vous ne cliquez pas sur **« Enregistrer tout »**.

## Rédiger les descriptions d'œuvres avec l'aide de l'intelligence artificielle

Sur la fiche d'une œuvre, un bouton **« Générer la description »** demande à un
assistant de rédiger une description à votre place. L'assistant **regarde la
photo** de l'œuvre et tient compte de ses caractéristiques.

- La description s'écrit **en français puis en anglais**.
- Elle suit le **style propre à chaque artiste** (inspiré de vos descriptions
  déjà publiées) et les **consignes de la galerie**.
- Vous gardez toujours la main : la description apparaît dans le champ, vous la
  **relisez et l'ajustez** avant d'enregistrer.
- L'ancien bouton **« Copier pour ChatGPT »** reste disponible si vous préférez
  faire le copier-coller vous-même.

**À savoir :** cette aide est **facultative**. Elle s'active en entrant une fois
une clé d'accès dans **Réglages → Intelligence artificielle** (Dave s'en occupe).
Sans cette clé, l'application fonctionne exactement comme avant.

## Régler le style des descriptions

Dans **Réglages → Intelligence artificielle**, un champ **« Consignes générales
de la galerie »** vous laisse ajuster le ton, la longueur et les règles
d'écriture des descriptions. Chaque artiste a aussi ses propres consignes, sur
sa fiche (section **« Aide à la description IA »**).

## Frais de production des reproductions

Sur la fiche d'une œuvre de type **reproduction** (ou giclée), un champ **« Frais
de production »** apparaît. Quand vous le remplissez, la **facture à l'artiste**
en tient compte automatiquement : la galerie récupère d'abord ses frais, puis le
partage de la commission se fait sur le reste. Pour les autres œuvres, rien ne
change.

## L'application explique ce qui ne va pas, au lieu de se taire

Nous avons renforcé l'application pour qu'un pépin ne passe plus jamais
inaperçu :

- Si l'application **ne peut pas démarrer** (par exemple un fichier occupé par
  un autre programme), elle affiche maintenant **un message qui explique quoi
  faire**, au lieu de rester bloquée sur l'écran bleu du démarrage.
- Si le fichier de vos données était **introuvable**, l'application **propose
  d'elle-même de récupérer la sauvegarde la plus récente** (elle en garde
  toujours plusieurs, automatiquement).
- Dans la section **Suivi**, si un changement (paiement reçu, envoi, livraison)
  ne s'enregistre pas, un message vous le dit tout de suite.
- Vos **réglages et vos numéros de factures** sont maintenant à l'épreuve des
  pannes de courant : même si le fichier des réglages était abîmé,
  l'application vous préviendrait, garderait l'ancien fichier de côté, et
  s'assurerait toute seule de **ne jamais émettre deux factures avec le même
  numéro**.

## Des sauvegardes plus solides — et restaurables en deux clics

- Chaque copie de sécurité est maintenant **vérifiée** après sa création.
- Si le dossier de sauvegarde choisi devient inaccessible (une clé USB
  retirée, par exemple), les copies continuent dans le dossier habituel de
  l'ordinateur et **l'application vous avertit**.
- Une copie supplémentaire est faite automatiquement **avant chaque mise à
  jour** de l'application et **avant chaque import** de données.
- Nouveau bouton **« Restaurer une sauvegarde… »** dans les Réglages : en cas
  de pépin, vous choisissez une copie dans la liste (avec sa date), vous
  confirmez, et l'application redémarre avec vos données retrouvées — sans
  aucune manipulation de fichiers.

## Des saisies mieux protégées

L'application vous évite maintenant les erreurs de saisie les plus faciles à
commettre :

- Un **prix ou un montant négatif**, ou une **année farfelue**, sont refusés
  avec un message clair qui indique le champ à corriger.
- Si vous enregistrez une **vente à 0 $**, l'application demande d'abord si
  c'est bien voulu.
- Si vous **cliquez deux fois** sur « Enregistrer », vous n'obtenez plus deux
  fiches identiques par accident.
- En **modifiant plusieurs œuvres à la fois**, si vous quittez la page sans
  enregistrer, l'application vous prévient au lieu de tout perdre.
- Un montant **collé** depuis un tableur (avec des espaces) qui n'est pas un
  vrai nombre est signalé, au lieu de disparaître sans un mot.

## Des messages plus clairs, des boutons qui répondent

- Quand quelque chose échoue (par exemple si vous essayez de refaire un PDF
  qui est **encore ouvert dans Acrobat**), l'application l'explique maintenant
  en français simple, au lieu d'afficher un code technique.
- Le bouton **« + Ajouter un sujet »** sur une fiche d'œuvre fonctionne de
  nouveau (une petite fenêtre s'ouvre pour saisir le sujet).
- Le lien **« Écrire au soutien »** dans l'aide ouvre bien votre logiciel de
  courriel.
- Le bouton **« Produire un certificat »** ne peut plus rester sans réaction.

## Deux corrections de cohérence

- Le **calculateur de commission** (page Outils) suit maintenant le
  pourcentage inscrit dans vos Réglages. Avant, il affichait toujours 50 %,
  même si vous aviez changé la cote : le montant annoncé pouvait différer de
  celui de la facture à l'artiste.
- Vous ne pouvez plus **supprimer un client par erreur** s'il a une œuvre
  réservée : l'application vous dit laquelle et vous invite à libérer la
  réservation d'abord.

## Documents : trois corrections importantes

- **Certificat d'authenticité** : quand l'année de l'œuvre n'est pas connue,
  le certificat laissait paraître **« 2024 »** — une année inventée sur un
  document officiel. La case reste maintenant **vide**, comme les autres
  informations manquantes. *(Si vous avez produit des certificats pour des
  œuvres sans année, il peut valoir la peine de les vérifier.)*
- **Lettre de remerciement** : si un client n'a pas de prénom enregistré, la
  lettre commençait par « Bonjour , ». Elle utilise maintenant son nom.
- **Annexe A** : si le document ne se produit pas (erreur, ou vous annulez),
  son numéro n'est plus « perdu » — il est réutilisé la fois suivante.

## Installation et catalogue plus simples

L'installation a été allégée et accélérée. À l'ouverture, si un nouveau
catalogue est disponible, l'application **propose de le charger** — et fait
**une sauvegarde de vos données avant**, par sécurité.

## Verrou de l'application (nouveau)

Vous pouvez maintenant **protéger l'application par un code** court, pour
éviter qu'une personne de passage consulte les fiches de vos clients quand
l'écran est laissé sans surveillance.

- Dans **Réglages → Sécurité**, vous **choisissez un code** de 4 à 6 chiffres.
- Une fois activé, l'application **demande ce code à l'ouverture**, sur un grand
  clavier numérique facile à utiliser.
- Vous pouvez aussi la faire **se verrouiller toute seule** après un moment sans
  activité (5, 10, 15 ou 30 minutes, à votre choix), et même quand vous passez à
  un autre logiciel.
- Le verrou est **facultatif** : tant que vous ne définissez pas de code,
  l'application s'ouvre directement comme avant.

- Vous pouvez taper le code **au clavier** (le pavé de chiffres à droite
  fonctionne, que la petite lumière « NumLock » soit allumée ou éteinte) ou
  **cliquer** les chiffres à l'écran, comme vous préférez.

### Si vous oubliez le code

Vous pouvez choisir une **question de secours** (par exemple « Dans quelle ville
êtes-vous né ? ») au moment de définir votre code. Si le code vous échappe, il
suffit de cliquer **« Code oublié ? »** sur l'écran de verrouillage, de répondre
à la question, et de choisir un nouveau code. L'application s'ouvre aussitôt.

- Pas besoin d'écrire la réponse exactement comme la première fois : les
  **accents, les majuscules et les espaces n'ont pas d'importance**.
  « Sainte-Foy » et « sainte foy » sont acceptés tous les deux.
- Choisissez une réponse qu'un visiteur ne pourrait pas deviner — évitez ce qui
  se trouve sur le site ou la page Facebook de la galerie.
- La question est **facultative**. Sans elle, un code oublié demande l'aide de
  Dave.

**À savoir :** votre code n'est **jamais conservé en clair** dans l'ordinateur.
Ce verrou empêche d'**ouvrir** l'application sans le code ; la protection
complète du fichier de données (chiffrement) viendra dans une prochaine étape.
Si vous oubliez le code, Dave peut le réinitialiser.

---

*Vos données restent sur l'ordinateur. Seules les informations de catalogue
(photo et caractéristiques de l'œuvre) sont envoyées à l'assistant de
rédaction quand vous cliquez sur « Générer la description » — jamais de données
sur vos clients ou vos ventes.*
