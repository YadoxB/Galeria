; Personnalisation de l'installateur NSIS de Galeria.
; electron-builder inclut automatiquement ce fichier (build/installer.nsh).
;
; Affiche le détail des fichiers pendant l'installation : sans ça, l'écran
; « Installing, please wait… » reste muet pendant l'extraction des ~540 fichiers
; de photos du catalogue (~218 Mo) et donne l'impression d'être figé. Avec
; « ShowInstDetails show », la liste « Extract: … » défile et rassure l'utilisateur.
!macro customHeader
  ShowInstDetails show
!macroend
