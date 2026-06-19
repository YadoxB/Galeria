// Preload de la fenêtre d'édition de document (« version modifiée »).
// Expose au document éditable deux actions, reliées au processus principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('editeur', {
  enregistrer: () => ipcRenderer.send('editeur:enregistrer'),
  annuler: () => ipcRenderer.send('editeur:annuler'),
});
