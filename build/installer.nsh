; Personnalisation de l'installateur NSIS de Galeria.
; electron-builder inclut automatiquement ce fichier (build/installer.nsh).
;
; Note : electron-builder décompresse l'application via « Nsis7z::Extract », une
; archive 7z extraite d'un seul bloc — il n'y a pas de commandes « File » par
; fichier, donc impossible d'afficher les noms de fichiers un par un. Seule la
; barre de progression avance pendant l'extraction des ~218 Mo de photos.
; On règle donc le texte de la page d'installation pour rassurer sur la durée.
!macro customHeader
  !ifdef MUI_TEXT_INSTALLING_SUBTITLE
    !undef MUI_TEXT_INSTALLING_SUBTITLE
  !endif
  !define MUI_TEXT_INSTALLING_SUBTITLE "Copie du catalogue et des photos en cours — cela peut prendre 1 à 2 minutes. Merci de patienter (la barre de progression avance)."
!macroend
