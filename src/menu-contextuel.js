// Menu contextuel (clic droit) partagé par les fenêtres de l'app.
//
// Le menu applicatif est désactivé (Menu.setApplicationMenu(null)) pour retirer
// la barre de menus et les raccourcis d'outils de dev en production. Effet de
// bord : Chromium n'offre plus « Coller » au clic droit. On reconstruit ici un
// menu d'édition minimal, en français, activé selon le contexte :
//   - Coller : seulement dans un champ éditable,
//   - Couper / Copier : seulement s'il y a une sélection.
// Les rôles (cut/copy/paste/selectAll) agissent sur l'élément focalisé de la
// fenêtre, sans que les pages aient à faire quoi que ce soit.

const { Menu } = require('electron');

function brancherMenuContextuel(win) {
  win.webContents.on('context-menu', (_event, params) => {
    const f = params.editFlags || {};
    const aSelection = !!(params.selectionText && params.selectionText.trim());
    const items = [];
    if (params.isEditable || aSelection) {
      items.push({ label: 'Couper', role: 'cut', enabled: params.isEditable && f.canCut && aSelection });
      items.push({ label: 'Copier', role: 'copy', enabled: f.canCopy && aSelection });
      items.push({ label: 'Coller', role: 'paste', enabled: params.isEditable && f.canPaste });
      items.push({ type: 'separator' });
      items.push({ label: 'Tout sélectionner', role: 'selectAll', enabled: f.canSelectAll !== false });
    }
    if (!items.length) return;
    Menu.buildFromTemplate(items).popup({ window: win });
  });
}

module.exports = { brancherMenuContextuel };
