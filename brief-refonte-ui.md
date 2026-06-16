# Brief visuel — Refonte UI de l'application Galeria

Ce document accompagne le mockup `Mockup-UI.png` et le guide de style `guide-style-ui.pdf`. Il donne à Claude Code tout ce qu'il faut pour appliquer la nouvelle identité visuelle à l'application, sans toucher à la logique ni aux données.

---

## Étape préalable obligatoire : créer une sauvegarde du travail actuel

Avant de modifier quoi que ce soit à l'apparence, fais deux choses dans l'ordre.

**1. Commit Git de l'état actuel.**
Dans le terminal, depuis le dossier du projet :
```
git add -A
git commit -m "Avant refonte UI - état stable Phase 3"
```

**2. Créer une branche de sauvegarde.**
```
git branch sauvegarde-avant-ui
```

Cela crée un point de retour nommé `sauvegarde-avant-ui`. Si la refonte tourne mal, on pourra y revenir exactement. Ne pas supprimer cette branche.

---

## Ce qu'on change (et ce qu'on ne touche pas)

**On change uniquement :**
- Les couleurs, polices, espacements, ombres et arrondis dans le fichier de style central.
- La structure visuelle des écrans (disposition, cartes, navigation, boutons).
- Les composants UI (badges de statut, champs de formulaire, tableaux, modales).

**On ne touche pas :**
- La logique de l'application (calculs, enregistrements, sauvegardes, imports).
- La base de données.
- Les gabarits des documents PDF (certificat, factures) : ils ont leur propre style d'impression, distinct de l'interface.

---

## Fichier de style central

Toutes les valeurs visuelles doivent vivre dans un seul fichier (par exemple `theme.css` ou `variables.css`), sous forme de variables CSS. Aucune couleur, police ou taille ne doit être écrite en dur dans les fichiers d'écrans. Exemple de structure attendue :

```css
:root {
  /* Couleurs principales */
  --deep-navy:    #071A2F;
  --gallery-navy: #10263E;
  --soft-ivory:   #F4EBDD;
  --porcelain:    #FAF7F1;
  --warm-gold:    #C99A3D;
  --terracotta:   #B9562F;

  /* Neutres */
  --ink:   #111827;
  --slate: #5D6875;
  --stone: #A79E91;
  --mist:  #D8D2C8;
  --cloud: #EFE8DE;

  /* Fonctionnels */
  --succes:       #4F8A5B;
  --avertissement:#D49B32;
  --erreur:       #B6423C;
  --info:         #3D6F9F;

  /* Typographie */
  --font-titre: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
  --font-ui:    'Inter', system-ui, sans-serif;

  /* Espacements (grille de 8px) */
  --s1: 4px; --s2: 8px; --s3: 16px; --s4: 24px; --s5: 32px; --s6: 48px;

  /* Arrondis */
  --r-btn:    10px;
  --r-carte:  14px;
  --r-panel:  16px;
  --r-modal:  18px;
  --r-badge:  999px;

  /* Ombres (toujours légères, en navy) */
  --ombre-carte:   0 4px 14px rgba(7,26,47,0.06);
  --ombre-elevee:  0 8px 24px rgba(7,26,47,0.10);
  --ombre-modal:   0 18px 48px rgba(7,26,47,0.18);
}
```

---

## Palette appliquée par zone

| Zone | Couleur de fond | Texte | Accent |
|---|---|---|---|
| Navigation latérale | Deep Navy #071A2F | Soft Ivory #F4EBDD | Warm Gold #C99A3D (élément actif) |
| Fond principal | Soft Ivory #F4EBDD | Ink #111827 | — |
| Cartes et formulaires | Porcelain #FAF7F1 | Ink #111827 | — |
| Bouton primaire | Warm Gold #C99A3D | Deep Navy #071A2F | — |
| Bouton secondaire | Porcelain ou transparent | Ink #111827 | Bordure Mist |
| En-têtes de tableau | #F0E8DC | Slate #5D6875 | — |
| Lignes de tableau | Soft Ivory | Ink | Hover : Cloud |

---

## Typographie

- **Titres de page, nom de la galerie, grands chiffres statistiques :** Cormorant Garamond ou Playfair Display (chargées depuis Google Fonts, gratuites). Poids 400 ou 600 selon le contexte.
- **Tout le reste (navigation, boutons, tableaux, formulaires, fiches, messages) :** Inter. Chargée depuis Google Fonts.
- Ne pas utiliser de serif pour les étiquettes de champs, les métadonnées ou les tableaux. La lisibilité quotidienne prime.

Hiérarchie :
- Titre de page : 32px, 600
- Titre de panneau : 18px, 600
- Sous-titre / métadonnées : 14px, 400, couleur Slate
- Texte courant : 14 à 16px, 400
- Label de champ : 13px, 500, Slate
- Métadonnées discrètes : 12 à 13px, 400, Stone
- Boutons : 14px, 600

---

## Structure de l'écran (d'après le mockup)

### Navigation latérale (environ 250px de large)
- Fond : Deep Navy #071A2F.
- Logo de la galerie en haut, avec le nom en serif doré.
- Entrées de menu : icône + texte, couleur Soft Ivory à l'état normal, fond Gallery Navy et texte Warm Gold à l'état actif.
- Informations de l'utilisateur connecté en bas (avatar, nom, rôle).
- Pas de bordure droite lourde : une ombre douce suffit à séparer.

### Zone de contenu principale
- Fond : Soft Ivory #F4EBDD.
- En-tête de page : titre de section (32px, serif ou sans-serif selon contexte) + barre de recherche centrée + bouton filtre + bouton primaire « + Ajouter » aligné à droite.
- Rangée de statistiques : quatre cartes Porcelain avec icône, valeur en grand, libellé, et variation mensuelle en petit (couleur Succès si positive).
- Grille d'œuvres : 4 colonnes, cartes avec image dominante (ratio 4:3), titre, artiste, prix, badge de statut, menu contextuel discret (…).
- Contrôles de vue : boutons grille / liste en haut à gauche de la grille, tri en haut à droite.
- Pagination en bas de page.

### Badges de statut
| Statut | Fond | Texte |
|---|---|---|
| Disponible | #DDEEDB | #2F6B3A |
| Réservée | #F7E8C4 | #8A5E13 |
| Vendue | #F3D7D3 | #8E2F29 |
| Archivée | #E7E3DD | #6B6258 |

Radius : 999px. Padding : 4px 10px. Taille texte : 12 à 13px.

### Boutons
- **Primaire :** fond Warm Gold, texte Deep Navy, radius 10px, hauteur 40 à 44px, poids 600. Hover : #D9AE55. Pressed : #B88932.
- **Secondaire :** fond Porcelain ou transparent, bordure Mist, texte Ink, radius 10px. Hover : Cloud.
- **Fantôme :** fond transparent, texte Deep Navy ou Slate, hover très subtil.
- **Danger :** fond #B6423C, texte blanc. Toujours précédé d'une confirmation.

### Champs de formulaire
- Fond : blanc ou Porcelain. Bordure : Mist. Radius : 10px. Hauteur : 40 à 44px.
- Focus : bordure Warm Gold + halo `rgba(201,154,61,0.18)`.
- Erreur : bordure Erreur + message court sous le champ.

### Modales
- Fond : Porcelain. Radius : 18px. Largeur : 520 à 720px. Padding : 24px.
- Overlay : `rgba(7,26,47,0.45)`.
- Actions alignées à droite.
- Réserver aux actions importantes. Préférer les panneaux latéraux pour les fiches et éditions fréquentes.

### Panneaux latéraux (fiches et éditions)
- Largeur : 420 à 560px. Fond : Soft Ivory. Bordure gauche : Mist. Ombre douce.
- Header fixe. Actions en bas ou en haut selon le contexte.

---

## Icônes
- Style : Lucide Icons (déjà inclus dans le projet si utilisé). Traits simples, épaisseur 1.75 à 2px.
- Couleurs : Slate à l'état inactif, Warm Gold ou Soft Ivory à l'état actif, Erreur pour le danger, Succès pour la confirmation.

---

## Images d'œuvres
- Ne pas recadrer agressivement. Préserver le ratio original dans les vues détaillées.
- Dans la grille : ratio 4:3 fixe, coins arrondis 10px, fond neutre.
- Miniatures dans les tableaux : carré 48 à 56px.
- Laisser au moins 12 à 16px entre l'image et les textes.

---

## À éviter absolument
- Warm Gold utilisé partout : uniquement pour l'action principale, l'état actif et les détails de marque.
- Ombres fortes ou noires.
- Fonds complètement blancs et froids.
- Coins trop ronds.
- Tableaux trop denses.
- Typographie serif dans les formulaires, tableaux ou messages.
- Doré utilisé comme décoration.

---

## Ordre de travail suggéré

Procéder dans cet ordre pour limiter le risque et tester au fur et à mesure :

1. Créer le fichier de style central avec toutes les variables CSS.
2. Charger les polices Inter et Cormorant Garamond depuis Google Fonts.
3. Appliquer la navigation latérale (fond navy, menu, élément actif doré).
4. Appliquer le fond et l'en-tête de la zone principale.
5. Refaire les cartes (couleurs, ombres, arrondis, badges de statut).
6. Refaire les boutons.
7. Refaire les champs de formulaire.
8. Refaire les tableaux.
9. Refaire les modales et panneaux latéraux.
10. Vérifier l'ensemble sur tous les écrans existants.

Présente ton plan pour l'étape 1 en mots simples avant de coder, et attends mon accord.

---

## Note finale sur les documents imprimés

Les gabarits HTML des certificats et factures (dans le dossier `gabarits/`) ont leur propre style pensé pour l'impression, avec fond crème, police Garamond et doré #b9912f. Ne pas leur appliquer le thème de l'interface. Ils restent inchangés.
