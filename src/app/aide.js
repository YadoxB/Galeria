// Section d'aide (#22) — base de connaissance cherchable, ouverte par un bouton
// « ? » flottant présent sur toutes les pages. Panneau à deux volets : catégories
// collapsibles + recherche à gauche, article complet à droite. Tout est local.
//
// Le bouton « Revoir le tutoriel » est prêt mais le tutoriel de 1re ouverture
// (#13) n'est pas encore bâti : il affiche un message « à venir » pour l'instant.

import { alerter } from './dialogue.js';

const CATS = [
  ['demarrage', 'Premiers pas'], ['artistes', 'Artistes'], ['oeuvres', 'Œuvres & catalogue'],
  ['prix', 'Cotes & prix'], ['clients', 'Clients'], ['ventes', 'Ventes'],
  ['documents', 'Documents'], ['suivi', 'Suivi & cycle de vie'], ['sauvegardes', 'Sauvegardes & données'],
  ['reglages', 'Réglages & profil'], ['securite', 'Sécurité & confidentialité'],
  ['depannage', 'Problèmes courants'], ['glossaire', 'Glossaire'], ['soutien', 'Soutien'],
];
const CAT_LIB = Object.fromEntries(CATS);

let _n = 0;
const A = (cat, titre, motscles, corps) => ({ id: 'a' + (_n++), cat, titre, motscles, corps });

const ARTICLES = [
  // ═══════ PREMIERS PAS ═══════
  A('demarrage', 'Bienvenue — comment utiliser l\'aide', 'accueil aide recherche bouton point interrogation chercher trouver',
    `<p>Cette aide répond à la plupart des questions sur Galeria.</p>
     <ul><li><b>Cherche</b> un mot dans la barre à gauche (ex. « prix », « sauvegarde », « vente refusée ») ;</li>
     <li>ou <b>parcours</b> les catégories (clique un titre de catégorie pour la déplier) et choisis un sujet.</li></ul>
     <p>Le bouton <b>« ? »</b> en bas à droite ouvre cette aide depuis n'importe quelle page. Ferme avec ✕, un clic à l'extérieur, ou la touche Échap.</p>`),
  A('demarrage', 'Vue d\'ensemble de Galeria', 'sections sidebar barre latérale navigation catalogue ventes documents outils réglages',
    `<p>Galeria s'organise en zones, dans la barre de gauche :</p>
     <ul><li><b>Accueil</b> — tableau de bord (statistiques, œuvres et ventes récentes, à préparer, à relancer).</li>
     <li><b>Catalogue</b> — <b>Artistes</b> et <b>Œuvres</b>.</li>
     <li><b>Ventes</b> — <b>Clients</b>, <b>Ventes</b> et <b>Suivi</b> des commandes.</li>
     <li><b>Archives</b> — <b>Documents</b> produits et <b>Rapport</b> journalier.</li>
     <li><b>Outils</b> — calculateurs de prix et de commission.</li>
     <li>Le <b>bloc profil</b> (bas) ouvre le Profil de la galerie ; <b>Réglages</b> juste au-dessus.</li></ul>`),
  A('demarrage', 'Le tableau de bord (accueil)', 'accueil statistiques tableau bord œuvres récentes ventes réservées préparation commandes',
    `<p>L'accueil rassemble :</p>
     <ul><li><b>4 statistiques</b> : œuvres au total, artistes, clients actifs, ventes du mois (avec variation).</li>
     <li><b>Œuvres récemment ajoutées</b> et <b>Ventes récentes</b> (cliquables).</li>
     <li><b>Œuvres réservées</b> à relancer.</li>
     <li><b>Commandes non complétées</b> (avancement Paiement → Emballage → Envoi → Livraison).</li>
     <li><b>Œuvres en préparation</b> (Sage 50 → Stock → Site web).</li></ul>
     <p>Clique n'importe quelle vignette pour ouvrir la fiche correspondante.</p>`),
  A('demarrage', 'Galeria fonctionne hors ligne', 'internet local connexion réseau confidentialité données nuage cloud',
    `<p>Tout est sur cet ordinateur ; tu peux travailler <b>sans connexion</b>. Aucune donnée n'est envoyée en ligne. Les seules exceptions, optionnelles et explicites : la <b>mise à jour</b> de l'application et « <b>Copier pour ChatGPT</b> » (qui n'envoie que des informations d'œuvre, jamais de client).</p>`),
  A('demarrage', 'Naviguer : recherche, archivés, fiches voisines', 'recherche filtre archivé navigation précédent suivant trouver',
    `<p>Dans chaque liste : une <b>recherche</b> en haut, et sur les fiches des flèches <b>Précédent / Suivant</b> (ordre alphabétique). Les fiches <b>archivées</b> ou <b>retirées</b> sont masquées par défaut — coche « Inclure les archivés / retirées » pour les revoir.</p>`),

  // ═══════ ARTISTES ═══════
  A('artistes', 'Ajouter un artiste', 'créer artiste nouveau prénom nom type peintre sculpteur enchaîner œuvres',
    `<ol><li><b>Artistes → + Ajouter un artiste</b>.</li>
     <li>Saisis le <b>prénom</b> (optionnel) et le <b>nom</b> (obligatoire), puis le <b>type</b> (peintre, sculpteur…).</li>
     <li>Au besoin : photo, biographie, démarche, CV, coordonnées, cotes, fiscalité.</li>
     <li><b>Créer seulement</b>, ou <b>Créer + ajouter les œuvres</b> pour enchaîner la saisie des œuvres.</li></ol>`),
  A('artistes', 'Préfixe d\'inventaire de l\'artiste', 'préfixe inventaire numéro automatique lettres code',
    `<p>Chaque artiste a un <b>préfixe</b> (ex. « JOU » pour Joe Untel) qui sert à numéroter ses œuvres. Il se <b>calcule tout seul</b> (2 lettres du prénom + 1 du nom, sans accents) tant que tu ne le modifies pas à la main. Tu peux le corriger ; il cesse alors de se recalculer.</p>`),
  A('artistes', 'Photo de l\'artiste', 'photo portrait image remplacer recadrer retirer pleine résolution',
    `<p>Sur la fiche en édition, la zone photo offre trois actions en survol : <b>Remplacer</b>, <b>Recadrer</b> (carré) et <b>Retirer</b>. Galeria garde aussi l'<b>original pleine résolution</b> pour pouvoir recadrer à nouveau plus tard.</p>
     <div class="astuce">La photo peut être ajoutée dès la création de l'artiste.</div>`),
  A('artistes', 'Biographie, démarche, curriculum', 'bio biographie démarche cv curriculum présentation texte onglets',
    `<p>Ces trois textes s'affichent en onglets sur la fiche (bouton <b>⤢</b> pour les voir en grand). Ils alimentent la <b>Présentation PDF</b> de l'artiste et la pochette de vente. Le CV est mis en forme en frise (années à gauche) dans le PDF.</p>`),
  A('artistes', 'Numéros de taxes de l\'artiste (TPS / TVQ)', 'taxes tps tvq numéro percoit fiscalité validation format facture artiste',
    `<p>Dans la fiscalité de la fiche artiste : coche « <b>Perçoit les taxes</b> » et saisis les numéros. Ils apparaissent sur la facture artiste et déclenchent le calcul des taxes.</p>
     <h4>Formats exigés (validés à l'enregistrement)</h4>
     <ul><li><b>TPS</b> : 9 chiffres + <code>RT</code> + 4 chiffres (ex. <code>123456789 RT 0001</code>).</li>
     <li><b>TVQ</b> : 10 chiffres + <code>TQ</code> + 4 chiffres (ex. <code>1234567890 TQ 0001</code>).</li></ul>
     <p>Les espaces sont ignorés. Les autres étiquettes (TVH, étranger…) et les champs vides ne bloquent jamais.</p>`),
  A('artistes', 'Aide à la description (ChatGPT)', 'ia chatgpt description copier presse-papier custom gpt consignes prompt',
    `<p>Sur une œuvre, « <b>Copier pour ChatGPT</b> » assemble un texte (consignes générales de la galerie + consignes propres à l'artiste + caractéristiques de l'œuvre) à coller dans ChatGPT, plus l'image. <b>Aucune donnée de client</b> n'est incluse. Les consignes par artiste et le lien vers son Custom GPT se règlent sur sa fiche (section Aide IA) ; les consignes générales dans Réglages.</p>`),
  A('artistes', 'Archiver ou supprimer un artiste', 'archiver supprimer artiste dépendances œuvres refus impossible',
    `<p><b>Archiver</b> retire l'artiste des listes sans rien perdre (réversible). <b>Supprimer</b> est définitif et <b>refusé</b> s'il a des œuvres : réattribue ou supprime d'abord ses œuvres, ou archive-le.</p>`),
  A('artistes', 'Documents d\'un artiste (présentation, catalogue, annexe)', 'présentation catalogue annexe pdf artiste imprimer documents',
    `<p>Sur la fiche artiste, le groupe <b>Documents</b> :</p>
     <ul><li><b>Présentation PDF</b> — bio + démarche + CV (réutilisée si le profil n'a pas changé) ;</li>
     <li><b>Catalogue PDF</b> — ses œuvres (6 par page) ; nécessite au moins une œuvre ;</li>
     <li><b>Annexe A</b> — document de dépôt ou de retrait d'œuvres (sélection des œuvres) ; nécessite au moins une œuvre.</li></ul>`),

  // ═══════ ŒUVRES ═══════
  A('oeuvres', 'Ajouter une œuvre', 'créer œuvre titre dimensions médium prix photo inventaire artiste',
    `<ol><li><b>Œuvres → + Ajouter</b>, puis choisis l'artiste (un numéro d'inventaire se pré-remplit).</li>
     <li>Saisis le titre, les dimensions <b>H / L / P</b> (pouces), le <b>médium</b> (via le menu ▾ de préférence) et le support.</li>
     <li>Le format, l'orientation et souvent le prix se calculent seuls.</li>
     <li>Ajoute une photo, recadre, puis <b>Enregistrer</b>.</li></ol>
     <div class="astuce">« Créer + ajouter les œuvres » sur la fiche artiste enchaîne plusieurs œuvres d'affilée.</div>`),
  A('oeuvres', 'Numéro d\'inventaire', 'inventaire numéro séquence préfixe automatique',
    `<p>Le numéro se compose du <b>préfixe de l'artiste</b> + un <b>numéro séquentiel global</b> à la galerie. Il se pré-remplit ; si tu le laisses tel quel, le compteur avance. Le prochain numéro se règle dans <b>Réglages → Documents</b>.</p>`),
  A('oeuvres', 'Dimensions, format et orientation', 'hauteur largeur profondeur pouces cm format orientation petit moyen grand très grand',
    `<p>Saisis les dimensions en pouces (un sélecteur <b>po / cm</b> convertit l'affichage ; l'enregistrement reste toujours en pouces). Galeria en déduit :</p>
     <ul><li>l'<b>orientation</b> (verticale si H > L, horizontale si L > H, sinon carrée) ;</li>
     <li>le <b>format</b> : Petit (≤ 16"), Moyen (≤ 30"), Grand (≤ 42"), Très grand (> 42"), calculé sur √(H × L).</li></ul>
     <p>Les deux s'arrêtent de se recalculer dès que tu les modifies à la main. Le <b>format</b> sert ensuite à choisir la cote pour le prix.</p>
     <div class="attention">La <b>profondeur</b> (épaisseur du châssis) n'entre pas dans le calcul du format.</div>`),
  A('oeuvres', 'Médium, support et style : différences', 'médium support style figuratif abstrait toile huile acrylique différence prix',
    `<ul><li><b>Médium</b> (acrylique, huile…) : <b>influence le prix</b> via les cotes de l'artiste.</li>
     <li><b>Support</b> (toile, papier…) : descriptif seulement.</li>
     <li><b>Style</b> (Figuratif / Abstrait / Mi-figuratif) : descriptif et filtre ; <b>n'influence pas le prix</b> et se saisit à la main.</li></ul>
     <div class="attention">Si tu attendais un prix automatique, vérifie le <b>médium</b> (pas le style) : c'est lui qui doit correspondre à une cote.</div>`),
  A('oeuvres', 'Statut d\'une œuvre (disponible, réservé, vendu, prêté)', 'statut disponible réservé vendu prêté changer',
    `<p>Le statut indique où en est l'œuvre. Il passe à <b>vendu</b> automatiquement à l'enregistrement d'une vente. « Réservé » sert à mettre de côté (l'œuvre apparaît dans « à relancer » du tableau de bord).</p>`),
  A('oeuvres', 'Préparation : Sage 50, Stock, Site web', 'préparation sage stock site web cycle cocher étape',
    `<p>Sur la fiche œuvre, la carte <b>Préparation</b> suit trois étapes éditables d'un clic : <b>Sage 50</b> → <b>Stock</b> → <b>Site web</b> (la date se met à aujourd'hui à la coche).</p>
     <div class="attention"><b>Sage 50 est obligatoire avant de vendre</b> l'œuvre (voir « Vente refusée »).</div>`),
  A('oeuvres', 'Sujets (mots-clés de l\'œuvre)', 'sujets thèmes chips marine portrait paysage mots-clés',
    `<p>Dans le formulaire, les <b>sujets</b> sont des pastilles cliquables (marine, portrait, paysage…). Tu peux en ajouter. Ils servent à décrire et retrouver l'œuvre.</p>`),
  A('oeuvres', 'Photo de l\'œuvre', 'photo image importer recadrer carré visionner agrandir original',
    `<p>Choisis une image, puis recadre-la (carré). Galeria garde l'<b>original pleine résolution</b>. Sur la fiche, un clic sur l'image l'ouvre en grand. La photo sert aussi au certificat, au catalogue et à la pochette.</p>
     <div class="attention">Pense à <b>Enregistrer</b> après avoir ajouté/recadré la photo, sinon elle n'est pas conservée.</div>`),
  A('oeuvres', 'Lien vers la fiche du site web', 'url site web lien woocommerce boutique voir en ligne',
    `<p>Le champ <b>URL de la fiche sur le site</b> ajoute un bouton « Voir sur le site › » sous le prix, qui ouvre la page dans le navigateur.</p>`),
  A('oeuvres', 'Retirer une œuvre (la rendre à l\'artiste)', 'retrait retirer rendre extrant sortir catalogue réintégrer lot motif',
    `<p><b>Retirer</b> = sortir une œuvre du catalogue actif (ex. reprise par l'artiste), sans que ce soit une vente.</p>
     <ol><li>Fiche de l'œuvre → <b>Retirer</b> → date + motif.</li>
     <li>Badge « Retirée », masquée des listes par défaut. Tu peux la <b>Réintégrer</b>.</li>
     <li>Retrait <b>en lot</b> : sur la liste, active le mode sélection puis « Retirer ».</li></ol>
     <div class="attention">Une œuvre <b>vendue</b> ne peut pas être retirée.</div>`),
  A('oeuvres', 'Trouver une œuvre (recherche, filtres, tri, affichage)', 'recherche filtre tri grille liste vignette taille statut format style',
    `<p>En haut : la <b>recherche</b> (titre, artiste, n° d'inventaire). Le bouton <b>Filtres</b> ouvre statut, artiste, type, format, style, et « Inclure les retirées ». Le <b>Tri</b> et la bascule <b>Grille / Liste</b> (avec taille des vignettes) sont à côté.</p>`),
  A('oeuvres', 'Archiver ou supprimer une œuvre', 'archiver supprimer œuvre vente refus impossible dépendance',
    `<p><b>Supprimer</b> est définitif et <b>refusé si l'œuvre a une vente</b> (historique comptable). Dans ce cas, <b>retire</b>-la ou archive-la plutôt.</p>`),

  // ═══════ COTES & PRIX ═══════
  A('prix', 'Comment Galeria calcule le prix d\'une œuvre', 'prix calcul cote préférentiel courant formule po linéaire carré médium taille format priorité',
    `<p>Le prix peut se calculer <b>automatiquement</b> à partir des <b>cotes de l'artiste</b> et des <b>dimensions</b>.</p>
     <h4>1. La cote utilisée</h4>
     <p>Une cote = un tarif par unité, défini par <b>médium</b> (ex. Acrylique, ou « Tous ») × <b>taille</b> (Petit / Moyen / Grand / Très grand, ou « Toutes »), avec une <b>unité</b> : pouce <b>linéaire</b> (H + L) ou pouce <b>carré</b> (H × L).</p>
     <p>Galeria prend la cote <b>la plus précise</b> qui correspond, dans cet ordre : (1) médium exact + taille exacte ; (2) « Tous » + taille exacte ; (3) médium exact + « Toutes » ; (4) « Tous » + « Toutes ».</p>
     <h4>2. Les deux prix</h4>
     <ul><li><b>Préférentiel</b> (sans cadre) = cote × base ;</li><li><b>Courant</b> (encadré) = (cote <b>+ 2 $</b> par unité) × base.</li></ul>
     <p>Exemple : cote 25 $/po linéaire, œuvre 24 × 36 (base 60) → préférentiel 1 500 $, courant 1 620 $.</p>
     <div class="astuce">Les deux prix apparaissent sur la fiche ; le prix retenu se remplit tant que tu ne l'écris pas à la main.</div>
     <div class="voir-aussi"><b>Voir aussi :</b> <a data-go="Pourquoi le prix ne se calcule pas automatiquement ?">Pourquoi le prix ne se calcule pas</a> · <a data-go="Configurer les cotes d'un artiste">Configurer les cotes</a></div>`),
  A('prix', 'Configurer les cotes d\'un artiste', 'cote configurer ajouter médium taille unité prix tarif tous repli fallback',
    `<p>Les cotes se définissent sur la <b>fiche de l'artiste</b>, section <b>Conditions galerie</b>.</p>
     <ol><li><b>+ Ajouter une cote</b>.</li><li>Choisis le <b>médium</b> (précis ou « Tous »), la <b>taille</b> (précise ou « Toutes »), l'<b>unité</b> (linéaire / carré) et le <b>tarif</b> par unité.</li></ol>
     <p>Seules les cotes avec un tarif > 0 sont enregistrées.</p>
     <div class="astuce"><b>Conseil :</b> crée toujours une cote de <b>repli</b> « Tous médiums / Toutes tailles ». Ainsi un prix est proposé même pour un médium inhabituel ou mal orthographié.</div>
     <div class="voir-aussi"><b>Voir aussi :</b> <a data-go="Comment Galeria calcule le prix d'une œuvre">Comment le prix est calculé</a></div>`),
  A('prix', 'Le calculateur de prix (Outils)', 'outils calculateur prix dimensions simulation estimer',
    `<p><b>Outils → Calculateur de prix</b> : choisis un artiste et entre des dimensions pour voir les prix préférentiel et courant, avec la formule détaillée — sans créer d'œuvre. Le sélecteur po / cm est disponible.</p>`),
  A('prix', 'Le calculateur de commission (net versé à l\'artiste)', 'commission cote galerie versement net tps tvq reproduction frais peinture sculpture type',
    `<p><b>Outils → Calculateur de commission</b> projette le montant versé à l'artiste, taxes comprises.</p>
     <h4>La cote dépend du type d'œuvre</h4>
     <ul><li><b>Peinture</b> : 50 %</li><li><b>Sculpture</b> : 33 %</li><li><b>Reproduction</b> : 50 % <b>après déduction des frais de production</b> (la galerie récupère ses frais, puis 50/50 sur le reste)</li><li><b>Autre</b> : pourcentage libre</li></ul>
     <p>Coche les taxes que l'artiste perçoit ; ajoute les rabais éventuels. Le résultat affiche la part de l'artiste, les taxes et le total versé.</p>
     <div class="voir-aussi"><b>Voir aussi :</b> <a data-go="Produire la facture artiste">Facture artiste</a></div>`),

  // ═══════ CLIENTS ═══════
  A('clients', 'Ajouter un client', 'créer client nouveau adresse courriel téléphone vente nouveau',
    `<ol><li><b>Clients → + Ajouter</b> (ou « + Nouveau client » pendant une vente).</li>
     <li>Saisis nom (obligatoire), prénom, adresse (pays / province), courriel, téléphone.</li>
     <li>Coche le <b>consentement courriel</b> si le client accepte d'être contacté.</li></ol>`),
  A('clients', 'Adresse du client (pays, province, code postal)', 'adresse pays province état code postal civique rue ville héritée',
    `<p>L'adresse est en champs séparés (numéro civique, rue, app., ville, pays, province/état, code postal). Le menu <b>Pays</b> ajuste la liste des provinces/états. Une ancienne adresse en texte libre, si présente, est affichée pour t'aider à la recopier.</p>`),
  A('clients', 'Consentement courriel (Loi 25)', 'consentement courriel loi 25 infolettre vernissage date contacter',
    `<p>Avant d'envoyer des courriels (invitations, infolettre), le client doit avoir donné son <b>consentement</b> : coche la case et la date (mise à aujourd'hui automatiquement). Un badge ✉ l'indique dans la liste. Ne coche que si le consentement est explicite.</p>`),
  A('clients', 'Le téléphone se met en forme tout seul', 'téléphone format numéro automatique',
    `<p>Saisis les 10 chiffres ; Galeria les met en forme <code>(xxx) xxx-xxxx</code> quand tu quittes le champ.</p>`),
  A('clients', 'Historique d\'achat d\'un client', 'historique achat ventes client total dépensé',
    `<p>La fiche client montre ses <b>achats</b> (œuvre, date, mode de paiement, n° de facture, total) et des statistiques (nombre d'achats, total dépensé, dernier achat, client depuis). Chaque ligne ouvre la fiche de l'œuvre.</p>`),
  A('clients', 'Supprimer une fiche client (Loi 25)', 'supprimer effacer client loi 25 vie privée refus vente comptable',
    `<p>Le droit à l'effacement (Loi 25) est respecté : tu peux <b>Supprimer</b> une fiche client. Mais si le client a des <b>ventes</b>, la suppression est <b>refusée</b> (raison comptable) — archive-le alors.</p>`),

  // ═══════ VENTES ═══════
  A('ventes', 'Enregistrer une vente', 'vendre vente prix taxes paiement facture client œuvre',
    `<ol><li>Sur une œuvre disponible : <b>Vendre</b> (ou <b>Ventes → + Ajouter</b>).</li>
     <li>Choisis l'œuvre et le client (ou « + Nouveau client »).</li>
     <li>Vérifie le prix (pré-rempli), les taxes, les rabais, le mode de paiement.</li>
     <li><b>Enregistrer</b> : l'œuvre passe « vendue » et un numéro de facture est réservé.</li>
     <li>Galeria propose ensuite de <b>produire la pochette de vente</b>.</li></ol>
     <div class="voir-aussi"><b>Voir aussi :</b> <a data-go="La vente est refusée : « œuvre pas dans Sage 50 »">Vente refusée (Sage 50)</a></div>`),
  A('ventes', 'Prix, rabais et taxes d\'une vente', 'prix rabais artiste galerie taxes tps tvq sous-total total',
    `<p>Le <b>prix de vente</b> est pré-rempli depuis l'œuvre. Tu peux ajouter un <b>rabais artiste</b> et/ou un <b>rabais galerie</b> (bloc « Rabais (optionnels) »). La <b>TPS</b> et la <b>TVQ</b> s'activent avec leurs taux (depuis Réglages). Le total se recalcule en direct.</p>`),
  A('ventes', 'Numéro de facture', 'numéro facture séquence préfixe réservé',
    `<p>Le numéro (ex. <code>F-2026-001</code>) est proposé automatiquement et <b>réservé</b> à l'enregistrement. Tu peux le modifier. Le préfixe et le prochain numéro se règlent dans <b>Réglages → Documents</b>.</p>`),
  A('ventes', 'Type d\'achat, cadeau, langue', 'achat web personne cadeau langue lettre remerciement pochette français anglais',
    `<p>La vente note le <b>type d'achat</b> (en personne / web), si c'est un <b>cadeau</b>, et la <b>langue</b> (FR / EN). Ces trois choix déterminent quelle <b>lettre de remerciement</b> ira dans la pochette de vente.</p>`),
  A('ventes', 'Mode de paiement', 'paiement comptant chèque carte interac virement mode',
    `<p>Choisis le mode (comptant, chèque, carte, Interac, virement…). Pour le <b>suivi</b> des paiements échelonnés, utilise plutôt le statut de paiement (À faire / Partiel / Reçu) du cycle de vie.</p>`),
  A('ventes', 'Modifier ou annuler une vente', 'modifier supprimer annuler vente erreur corriger pochette dossier',
    `<p><b>Modifier</b> pour corriger une vente. <b>Supprimer</b> pour l'annuler : l'œuvre redevient disponible, les certificats sont conservés (détachés), et Galeria propose d'<b>effacer le dossier de pochette</b> associé.</p>`),
  A('ventes', 'Suivre une commande après la vente', 'suivi paiement emballage envoi livraison cycle commande complétée',
    `<p>Sur la fiche de vente (et dans la section <b>Suivi</b>), suis l'avancement : <b>Paiement</b> (À faire / Partiel / Reçu), <b>Emballage</b>, <b>Envoi</b>, <b>Livraison</b>, éditables d'un clic. Une commande est « complétée » quand le paiement est reçu et la livraison faite.</p>`),

  // ═══════ DOCUMENTS ═══════
  A('documents', 'La section Documents', 'documents section liste index pdf tous types année filtres',
    `<p>La section <b>Documents</b> (barre de gauche) réunit les PDF produits, avec recherche, filtres et actions <b>Voir</b> / <b>Dossier</b> / <b>Re-générer</b>. Tous les PDF sont au <b>format Lettre</b>.</p>`),
  A('documents', 'Produire la pochette de vente', 'pochette documents lettre certificat présentation guide dossier client acheteur',
    `<p>La pochette réunit, dans un dossier par client/facture, tout ce qu'on remet à l'acheteur.</p>
     <ol><li>Fiche de la vente → <b>Produire la pochette de vente</b> (proposé aussi juste après l'enregistrement).</li>
     <li>Galeria assemble : <b>lettre de remerciement + fiche de l'œuvre</b>, <b>certificat</b> d'authenticité, <b>présentation</b> de l'artiste et <b>guide de l'acheteur</b>.</li>
     <li>Chaque document a <b>Voir</b> et <b>Ouvrir le dossier</b>.</li></ol>
     <div class="astuce">Le certificat manquant est créé automatiquement (valeur = prix de vente) ; la présentation est réutilisée si elle n'a pas changé.</div>`),
  A('documents', 'Produire un certificat d\'authenticité', 'certificat authenticité pdf œuvre numéro valeur signataire',
    `<p>Depuis la fiche d'œuvre ou de vente : crée un certificat (numéro auto, valeur, signataire, particularité). Le PDF se génère automatiquement. Une œuvre peut avoir plusieurs certificats ; un certificat peut exister sans vente.</p>`),
  A('documents', 'Produire la facture artiste', 'facture artiste versement commission relevé cote type taxes',
    `<p>Fiche de vente → <b>Produire la facture artiste</b> : le relevé du versement à l'artiste après commission et taxes. La <b>cote</b> dépend du type de l'œuvre (sculpture 33 %, sinon 50 %), et les taxes dépendent du régime fiscal de l'artiste.</p>`),
  A('documents', 'Catalogue, annexe A, présentation, rapport', 'catalogue annexe dépôt retrait présentation rapport pdf artiste imprimer',
    `<p>Depuis la fiche <b>artiste</b> : <b>Catalogue PDF</b> (6 œuvres/page), <b>Annexe A</b> (dépôt en rouge / retrait en bleu), <b>Présentation PDF</b>. Le <b>Rapport</b> journalier s'exporte depuis la section Rapport. Tous sont rangés par type dans le dossier de l'année.</p>`),
  A('documents', 'Modifier un document avant de l\'imprimer', 'version modifiée éditer corriger texte pdf wysiwyg retoucher',
    `<p>La plupart des documents proposent <b>« version modifiée »</b> : une fenêtre éditable où tu corriges le texte (ex. enlever une ligne du CV), puis tu enregistres en PDF. <b>Les données de l'app ne changent pas</b> ; seul ce PDF est ajusté. Pour un document de pochette, la version modifiée remplace le fichier dans le dossier.</p>`),
  A('documents', 'Re-générer un document', 'regénérer mettre à jour pdf actualiser document',
    `<p>Dans la section Documents (ou sur la fiche), <b>Re-générer</b> recrée le PDF avec les données actuelles (utile après une correction). L'ancien fichier est remplacé.</p>`),
  A('documents', 'Où sont rangés les documents', 'dossier fichiers pdf emplacement année type explorateur trouver',
    `<p>Dans <code>Documents\\Galeria\\Documents\\{année}\\{type}\\</code> — un sous-dossier par type : Certificats, Factures artiste, Catalogues, Annexes, Présentations, Rapports, Pochettes. Le bouton <b>Dossier</b> ouvre directement l'emplacement.</p>`),

  // ═══════ SUIVI ═══════
  A('suivi', 'La section Suivi', 'suivi cycle de vie actif complétées files attente préparation expédition',
    `<p><b>Suivi</b> rassemble les œuvres <b>à préparer</b> et les ventes <b>en cours</b>, avec un onglet <b>Complétées</b>. Un bandeau résume les files d'attente (à créer dans Sage, à mettre en stock, à publier, à encaisser, à emballer, à expédier, à livrer). Tout est éditable d'un clic et se sauvegarde aussitôt.</p>`),

  // ═══════ SAUVEGARDES & DONNÉES ═══════
  A('sauvegardes', 'Faire une sauvegarde maintenant', 'sauvegarde backup copie manuelle sauvegarder',
    `<p><b>Réglages → Sauvegardes → Sauvegarder maintenant</b>. Une copie horodatée est créée immédiatement.</p>`),
  A('sauvegardes', 'Sauvegardes automatiques', 'sauvegarde automatique fréquence rétention nombre copies dossier',
    `<p>Galeria sauvegarde tout seul à intervalle réglable (60 min par défaut) et <b>à la fermeture</b>. Tu choisis la <b>fréquence</b> (min. 5 min), le <b>nombre de copies</b> conservées (50 par défaut, les plus anciennes sont supprimées) et le <b>dossier</b> de destination.</p>`),
  A('sauvegardes', 'Restaurer une sauvegarde', 'restaurer récupérer perte données backup restore galerie.db revenir',
    `<ol><li><b>Ferme Galeria.</b></li>
     <li>Ouvre le dossier des sauvegardes (chemin indiqué dans <b>Réglages → Sauvegardes</b>).</li>
     <li>Repère la sauvegarde voulue (le nom contient la date).</li>
     <li>Copie-la par-dessus le fichier <code>galerie.db</code> du dossier de données (<code>Documents\\Galeria</code>).</li>
     <li>Rouvre Galeria.</li></ol>
     <div class="attention">Une restauration <b>écrase</b> les données actuelles. Dans le doute, contacte le soutien avant de remplacer un fichier.</div>`),
  A('sauvegardes', 'Où sont mes données', 'dossier données emplacement base galerie.db photos documents config',
    `<p>Tout vit dans <code>Documents\\Galeria</code> : la base <code>galerie.db</code>, les <b>Photos</b>, les <b>Documents</b> (PDF par année) et les <b>Sauvegardes</b>. <b>Réglages → À propos</b> affiche le chemin et un bouton pour l'ouvrir.</p>`),
  A('sauvegardes', 'Importer des données (CSV)', 'import csv airtable mettre à jour ajouter doublons artistes œuvres',
    `<p><b>Réglages → Import</b> : choisis le fichier CSV (artistes ou œuvres), vois l'aperçu, puis « <b>Ajouter seulement les nouveaux</b> » ou « <b>Mettre à jour</b> ». Galeria évite les doublons par nom et numéro d'inventaire, et fait une sauvegarde avant d'écrire.</p>`),

  // ═══════ RÉGLAGES & PROFIL ═══════
  A('reglages', 'Modifier les coordonnées de la galerie', 'profil galerie nom adresse logo tps tvq entête bas de page coordonnées',
    `<p>Bloc <b>profil</b> (bas de la barre) → <b>Profil de la galerie</b> : nom, adresse, téléphone, courriel, site, numéros TPS/TVQ, logo. Ces informations alimentent l'entête et le bas de page de <b>tous</b> les documents — modifie ici une fois, c'est répercuté partout.</p>`),
  A('reglages', 'Numéros de factures et de certificats', 'numéro préfixe facture certificat inventaire séquence prochain nomenclature',
    `<p><b>Réglages → Documents</b> : préfixe et prochain numéro pour factures client (F-…), factures artiste (A-…), certificats (C-…), et le prochain numéro d'inventaire. Modifiable à tout moment, sans rien casser.</p>`),
  A('reglages', 'Taux de taxes et cote par défaut', 'tps tvq taux cote pourcentage commission défaut',
    `<p><b>Réglages → Documents</b> : activer/désactiver et régler la <b>TPS</b> (5 % par défaut), la <b>TVQ</b> (9,975 %), et le <b>pourcentage de cote</b> galerie par défaut (50 %).</p>`),
  A('reglages', 'Régler la taille de l\'affichage (zoom)', 'zoom affichage taille texte agrandir interface',
    `<p><b>Réglages → Affichage</b> : choisis le niveau de zoom de l'interface (de 80 % à 150 %). C'est appliqué immédiatement et retenu au prochain démarrage.</p>`),
  A('reglages', 'Mettre à jour l\'application', 'mise à jour update version installer nouvelle redémarrer',
    `<p>Quand une mise à jour existe, un avis discret apparaît en bas à droite : <b>tu choisis</b> quand télécharger et redémarrer (rien ne se fait sans ton accord). Tu peux aussi vérifier dans <b>Réglages → À propos → Vérifier les mises à jour</b>.</p>`),

  // ═══════ SÉCURITÉ ═══════
  A('securite', 'Confidentialité et Loi 25', 'loi 25 vie privée consentement données personnelles local effacement',
    `<p>Galeria garde tout en local et respecte la Loi 25 : suivi du <b>consentement courriel</b>, possibilité de <b>supprimer</b> une fiche client, aucune donnée envoyée en ligne.</p>`),
  A('securite', 'Protéger l\'ordinateur de la galerie', 'sécurité mot de passe session bitlocker verrouillage vol chiffrement',
    `<p>Comme l'ordinateur contient des renseignements de clients, protège-le : <b>mot de passe de session</b> Windows, <b>verrouillage automatique</b> après inactivité, et chiffrement <b>BitLocker</b> du disque. Garde aussi une sauvegarde hors site (clé USB chiffrée).</p>`),

  // ═══════ PROBLÈMES COURANTS ═══════
  A('depannage', 'Pourquoi le prix ne se calcule pas automatiquement ?', 'prix auto ne se remplit pas cote manquante médium typo faute frappe format hors normes manuel style',
    `<p>Le prix proposé apparaît <b>seulement si</b> : l'artiste a des cotes, la hauteur et la largeur sont saisies, une cote correspond, et « cote hors-normes » n'est pas cochée. Causes possibles et solutions :</p>
     <h4>1. L'artiste n'a pas de cotes</h4><p>Fiche artiste → Conditions galerie → ajoute au moins une cote.</p>
     <h4>2. Hauteur ou largeur manquante</h4><p>Le calcul a besoin des <b>deux</b> (en pouces).</p>
     <h4>3. Le médium ne correspond à aucune cote — le piège le plus fréquent</h4>
     <p>La comparaison ignore <b>majuscules, accents et espaces</b> (« Acrylique » = « acrylique »), <b>mais</b> une <b>faute de frappe</b> (« acryllique ») ou une <b>variante</b> (« Acrylique sur toile » ≠ « Acrylique ») ne correspond pas.</p>
     <p><b>Solutions :</b> corrige le médium ; ou choisis-le dans le <b>menu ▾</b> (évite les typos) ; ou ajoute une cote pour ce médium ; ou crée une cote de repli <b>« Tous médiums »</b>.</p>
     <h4>4. Aucune cote ne couvre ce format</h4><p>Ajoute la cote du format manquant, ou une cote « Toutes tailles ».</p>
     <h4>5. « Cote hors-normes » est cochée</h4><p>Elle force un prix manuel ; décoche-la pour réactiver.</p>
     <h4>6. Un prix est déjà saisi</h4><p>Galeria n'écrase jamais un prix tapé à la main ; efface-le pour récupérer la suggestion.</p>
     <div class="attention">C'est le <b>médium</b> qui détermine le prix, <b>pas le « Style »</b> (Figuratif/Abstrait).</div>
     <div class="voir-aussi"><b>Voir aussi :</b> <a data-go="Comment Galeria calcule le prix d'une œuvre">Comment le prix est calculé</a> · <a data-go="Configurer les cotes d'un artiste">Configurer les cotes</a></div>`),
  A('depannage', 'Le prix automatique a « gelé » et n\'évolue plus', 'prix figé gelé bloqué manuel format orientation ne change plus',
    `<p>C'est normal : dès que tu <b>modifies à la main</b> le prix (ou le format / l'orientation), Galeria <b>cesse</b> de le recalculer pour ne pas écraser ton choix. Efface la valeur saisie pour récupérer l'automatisme.</p>`),
  A('depannage', 'La vente est refusée : « œuvre pas dans Sage 50 »', 'vente refusée bloquée sage 50 garde-fou erreur enregistrer préparation',
    `<p>Une œuvre doit être marquée <b>« Créée dans Sage 50 »</b> avant d'être vendue.</p>
     <ol><li>Ouvre la fiche de l'œuvre.</li><li>Carte <b>Préparation</b> → marque l'étape <b>Sage 50</b>.</li><li>Reprends la vente.</li></ol>
     <p>L'avertissement apparaît dès la sélection de l'œuvre et indique son nom de référence (= numéro d'item Sage).</p>`),
  A('depannage', 'Impossible de vendre une œuvre déjà vendue', 'déjà vendue double vente statut vendu impossible',
    `<p>Une œuvre au statut <b>vendu</b> ne peut pas être revendue. Si la première vente était une erreur, <b>supprime-la</b> d'abord (l'œuvre redevient disponible), puis refais la vente.</p>`),
  A('depannage', 'Je ne trouve plus une œuvre, un artiste ou un client', 'introuvable disparu archivé retiré filtre recherche caché masqué',
    `<p>Vérifie, dans l'ordre :</p>
     <ol><li>une <b>recherche</b> ou un <b>filtre</b> encore actif (réinitialise) ;</li>
     <li>la fiche est peut-être <b>archivée</b> ou <b>retirée</b> (masquées par défaut) : ouvre les <b>Filtres</b> et coche « Inclure les archivés / retirées » ;</li>
     <li>essaie une partie du nom seulement.</li></ol>`),
  A('depannage', 'Impossible de supprimer (œuvre, artiste, client)', 'suppression refusée bloquée dépendances liées ventes œuvres certificats archiver',
    `<p>La suppression est <b>bloquée</b> quand des éléments dépendent de la fiche : un artiste avec des œuvres, une œuvre ou un client avec des ventes/certificats. <b>Archive</b> la fiche (elle disparaît des listes sans casser l'historique), ou retire d'abord les éléments liés.</p>`),
  A('depannage', 'Acrobat affiche « Font Capture » à l\'ouverture d\'un PDF', 'pdf acrobat erreur font capture plante lecteur edge ouvre',
    `<p>C'est un <b>avertissement connu d'Acrobat</b> qui apparaît quelques secondes après l'ouverture de n'importe quel PDF généré. <b>Le PDF est valide</b> et imprimable. Si l'avis te gêne, ouvre le PDF avec <b>Microsoft Edge</b>.</p>`),
  A('depannage', '« Impossible de générer/remplacer le PDF »', 'pdf verrouillé occupé ebusy fermer visionneur régénérer',
    `<p>Le fichier est probablement <b>encore ouvert</b> dans un lecteur (Acrobat). <b>Ferme</b> le PDF puis réessaie. Galeria ajoute aussi un horodatage aux noms pour éviter les conflits.</p>`),
  A('depannage', 'La photo de l\'œuvre ne s\'affiche pas', 'photo image manquante vide ne s\'affiche pas recadrage enregistrer',
    `<p>Le plus souvent, l'image a été choisie mais pas <b>enregistrée</b> : après l'avoir recadrée, clique <b>Enregistrer</b>. Si le fichier d'origine a été déplacé hors du dossier Photos, ré-importe-le.</p>`),
  A('depannage', 'Les taxes sont absentes ou fausses sur la facture artiste', 'taxes tps tvq manquantes facture artiste percoit taux numéros',
    `<p>Elles dépendent de l'<b>artiste</b> : ouvre sa fiche et vérifie qu'il <b>perçoit les taxes</b> et que ses <b>numéros TPS/TVQ</b> sont saisis et valides. Les <b>taux</b> viennent de <b>Réglages → Documents</b>.</p>`),
  A('depannage', 'La reproduction est facturée sans déduire les frais', 'reproduction frais production commission facture artiste 50',
    `<p>La déduction automatique des frais de production sur la <b>facture artiste</b> est <b>en cours de développement</b>. En attendant, utilise le <b>calculateur de commission</b> (Outils) pour le montant exact, ou la « version modifiée » de la facture.</p>`),
  A('depannage', 'Le format / l\'orientation restent vides', 'format orientation vide saisie héritée dimensions texte ancien',
    `<p>Pour les œuvres anciennes dont les dimensions étaient en <b>texte libre</b> (« Saisie héritée : … »), le format et l'orientation ne se calculent pas. Saisis les dimensions en <b>H / L / P</b> (champs séparés) pour réactiver le calcul.</p>`),
  A('depannage', 'L\'application ne démarre pas', 'démarrage plantage ouvre pas bloqué splash écran',
    `<ol><li>Ferme complètement et relance.</li><li>Redémarre l'ordinateur.</li><li>Vérifie l'espace disque disponible.</li><li>Si le problème persiste, contacte le soutien — ne supprime rien dans le dossier de données.</li></ol>`),
  A('depannage', 'Le téléphone ne se met pas en forme', 'téléphone format numéro mise en forme chiffres',
    `<p>Le formatage s'applique en <b>quittant</b> le champ. Saisis seulement les chiffres ; Galeria ajoute les séparateurs.</p>`),

  // ═══════ GLOSSAIRE ═══════
  A('glossaire', 'Cote — les deux sens', 'glossaire cote définition commission tarif',
    `<p><b>1. Cote de tarif</b> (artiste) : le prix par unité (médium × taille) qui sert à calculer le prix d'une œuvre.<br><b>2. Cote de la galerie</b> : la commission en % prélevée sur une vente (apparaît sur la facture artiste).</p>`),
  A('glossaire', 'Préférentiel vs courant', 'glossaire préférentiel courant prix encadré sans cadre',
    `<p><b>Préférentiel</b> = prix sans encadrement. <b>Courant</b> = prix encadré ; il ajoute 2 $ par unité à la cote.</p>`),
  A('glossaire', 'Format (Petit / Moyen / Grand / Très grand)', 'glossaire format taille petit moyen grand très grand seuils',
    `<p>Catégorie de taille calculée sur √(H × L) : Petit ≤ 16", Moyen ≤ 30", Grand ≤ 42", Très grand > 42". Sert à choisir la cote.</p>`),
  A('glossaire', 'Cote hors-normes', 'glossaire cote hors normes exception prix manuel',
    `<p>Case sur l'œuvre indiquant un cas exceptionnel : le prix est <b>saisi à la main</b> et le calcul automatique est désactivé.</p>`),
  A('glossaire', 'Facture artiste vs facture client', 'glossaire facture artiste client différence',
    `<p><b>Facture artiste</b> (A-…) : relevé du versement de la galerie à l'artiste après commission.<br><b>Facture client</b> (F-…) : facture de la galerie à l'acheteur.</p>`),
  A('glossaire', 'Pochette de vente', 'glossaire pochette dossier documents acheteur',
    `<p>Le dossier de documents remis à l'acheteur : lettre + fiche de l'œuvre, certificat, présentation de l'artiste, guide.</p>`),
  A('glossaire', 'Annexe A (dépôt / retrait)', 'glossaire annexe consignation dépôt retrait',
    `<p>Document signé artiste + galeriste confirmant la <b>consignation</b> (dépôt) ou la <b>reprise</b> (retrait) d'œuvres.</p>`),

  // ═══════ SOUTIEN ═══════
  A('soutien', 'Contacter le soutien', 'soutien contact aide courriel support version dossier données',
    `<p>Pour toute question que cette aide ne couvre pas :</p>
     <ul><li><b>Courriel :</b> <a data-mail>belisledave@gmail.com</a></li>
     <li><b>Version de l'application :</b> Galeria <span data-version>—</span> (voir Réglages → À propos)</li>
     <li><b>Dossier des données :</b> <a data-dossier>Ouvrir dans l'Explorateur</a></li></ul>
     <div class="astuce">En cas de souci de données, fais d'abord une <b>sauvegarde</b> et n'efface rien dans le dossier de données.</div>`),
];

// ── Outils ──
const COURRIEL_SOUTIEN = 'belisledave@gmail.com';
const sansAccents = (s) => String(s || '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
const txtBrut = (html) => html.replace(/<[^>]+>/g, ' ');
const echapReg = (q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let infosApp = { version: '', dataDir: '' };
let selId = ARTICLES[0].id;
let query = '';
let ouverts = new Set([ARTICLES[0].cat]);
let overlay, elListe, elArticle, elQ;

const svgChev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

function score(a, q) {
  const t = sansAccents(a.titre), k = sansAccents(a.motscles), c = sansAccents(txtBrut(a.corps));
  if (t.includes(q)) return 3; if (k.includes(q)) return 2; if (c.includes(q)) return 1; return 0;
}
function resultats() {
  return ARTICLES.map((a) => ({ a, s: score(a, query) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s);
}
function itemNav(a) {
  const prob = a.cat === 'depannage' ? '<span class="pastille">⚠</span>' : '';
  return `<button class="aide-nav-item ${a.id === selId ? 'actif' : ''}" data-id="${a.id}">${prob}${a.titre}</button>`;
}

function rendreNav() {
  if (query) {
    const res = resultats();
    if (!res.length) { elListe.innerHTML = `<div class="aide-nav-vide">Aucune réponse. Essaie d'autres mots, ou écris au soutien.</div>`; return; }
    elListe.innerHTML = `<div class="aide-res-cat">${res.length} résultat${res.length > 1 ? 's' : ''}</div>` + res.map(({ a }) => itemNav(a)).join('');
  } else {
    let html = '';
    for (const [cat, lib] of CATS) {
      const items = ARTICLES.filter((a) => a.cat === cat);
      if (!items.length) continue;
      const open = ouverts.has(cat);
      html += `<div class="aide-cat ${open ? 'ouvert' : ''}" data-cat="${cat}">
        <button class="aide-cat-tete" data-cat="${cat}">${svgChev}<span>${lib}</span><span class="cnt">${items.length}</span></button>
        <div class="aide-cat-items">${items.map(itemNav).join('')}</div>
      </div>`;
    }
    elListe.innerHTML = html;
    elListe.querySelectorAll('.aide-cat-tete').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.cat; if (ouverts.has(c)) ouverts.delete(c); else ouverts.add(c); rendreNav();
    }));
  }
  elListe.querySelectorAll('.aide-nav-item').forEach((b) => b.addEventListener('click', () => {
    selId = b.dataset.id;
    const a = ARTICLES.find((x) => x.id === selId); if (a) ouverts.add(a.cat);
    rendre();
  }));
}

function surligner(html, q) {
  if (!q) return html;
  const re = new RegExp('(' + echapReg(q) + ')', 'ig');
  return html.replace(/>([^<]+)</g, (m, t) => '>' + t.replace(re, '<mark>$1</mark>') + '<');
}

function rendreArticle() {
  const a = ARTICLES.find((x) => x.id === selId) || ARTICLES[0];
  const corps = query ? surligner(a.corps, query) : a.corps;
  elArticle.innerHTML = `
    <span class="aide-art-cat">${CAT_LIB[a.cat]}</span>
    <h3 class="aide-art-titre">${a.titre}</h3>
    <div class="aide-art-corps">${corps}</div>`;
  // Liens « voir aussi » → ouvrent l'article cible
  elArticle.querySelectorAll('[data-go]').forEach((lien) => lien.addEventListener('click', (e) => {
    e.preventDefault();
    const cible = ARTICLES.find((x) => x.titre === lien.dataset.go);
    if (cible) { selId = cible.id; ouverts.add(cible.cat); query = ''; elQ.value = ''; rendre(); }
  }));
  // Article Soutien : version + liens dynamiques
  const elVersion = elArticle.querySelector('[data-version]');
  if (elVersion) elVersion.textContent = infosApp.version || '—';
  const elMail = elArticle.querySelector('[data-mail]');
  if (elMail) elMail.addEventListener('click', (e) => { e.preventDefault(); window.api.ouvrirUrl('mailto:' + COURRIEL_SOUTIEN); });
  const elDossier = elArticle.querySelector('[data-dossier]');
  if (elDossier) elDossier.addEventListener('click', (e) => { e.preventDefault(); if (infosApp.dataDir) window.api.ouvrirDossier(infosApp.dataDir); });
  elArticle.scrollTop = 0;
}

function rendre() { rendreNav(); rendreArticle(); }

function ouvrir(o) {
  overlay.style.display = o ? 'flex' : 'none';
  if (o) setTimeout(() => elQ && elQ.focus(), 50);
}

function construirePanneau() {
  overlay = document.createElement('div');
  overlay.className = 'overlay-modale aide';
  overlay.id = 'aide-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="aide-panneau" role="dialog" aria-label="Aide">
      <div class="aide-entete">
        <h2>Aide</h2>
        <button class="aide-fermer" id="aide-fermer" type="button" aria-label="Fermer">✕</button>
      </div>
      <div class="aide-corps">
        <div class="aide-nav">
          <div class="aide-nav-haut">
            <div class="aide-recherche">
              <svg class="loupe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
              <input type="search" id="aide-q" placeholder="Rechercher de l'aide…" autocomplete="off">
            </div>
            <button class="aide-tuto-btn" id="aide-tuto" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Revoir le tutoriel
            </button>
          </div>
          <div class="aide-liste" id="aide-liste"></div>
          <div class="aide-nav-pied">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>
            <span>Besoin d'aide ? <a href="#" id="aide-pied-mail">${COURRIEL_SOUTIEN}</a></span>
          </div>
        </div>
        <div class="aide-article" id="aide-article"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  elListe = overlay.querySelector('#aide-liste');
  elArticle = overlay.querySelector('#aide-article');
  elQ = overlay.querySelector('#aide-q');

  overlay.querySelector('#aide-fermer').addEventListener('click', () => ouvrir(false));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) ouvrir(false); });
  elQ.addEventListener('input', (e) => {
    query = sansAccents(e.target.value);
    const res = resultats();
    if (res.length && !res.some(({ a }) => a.id === selId)) selId = res[0].a.id;
    rendre();
  });
  overlay.querySelector('#aide-tuto').addEventListener('click', () => {
    alerter({ type: 'info', title: 'Tutoriel de bienvenue', message: 'La visite guidée arrivera dans une prochaine version.' });
  });
  overlay.querySelector('#aide-pied-mail').addEventListener('click', (e) => {
    e.preventDefault(); window.api.ouvrirUrl('mailto:' + COURRIEL_SOUTIEN);
  });
}

export function initialiserAide() {
  // Bouton « ? » flottant, présent sur toutes les pages.
  const fab = document.createElement('button');
  fab.className = 'aide-fab';
  fab.id = 'aide-fab';
  fab.type = 'button';
  fab.title = 'Aide';
  fab.setAttribute('aria-label', 'Aide');
  fab.textContent = '?';
  document.body.appendChild(fab);

  construirePanneau();
  rendre();

  // Récupère version + dossier de données (pour l'article Soutien).
  window.api.appInfos().then((i) => { if (i) { infosApp = i; if (overlay.style.display !== 'none') rendreArticle(); } }).catch(() => {});

  fab.addEventListener('click', () => ouvrir(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.style.display !== 'none') ouvrir(false); });
}
