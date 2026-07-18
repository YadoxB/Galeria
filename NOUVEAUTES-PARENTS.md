# Galeria — Nouveautés depuis la dernière version installée

> Petit résumé, en mots simples, de ce qui a été ajouté à l'application
> **depuis la version 0.5.0**. À remettre avec la prochaine mise à jour.
> Document mis à jour au fil du développement.

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

---

*Vos données restent sur l'ordinateur. Seules les informations de catalogue
(photo et caractéristiques de l'œuvre) sont envoyées à l'assistant de
rédaction quand vous cliquez sur « Générer la description » — jamais de données
sur vos clients ou vos ventes.*
