// Lance l'édition WYSIWYG d'un document (« version modifiée ») : ouvre le
// document dans une fenêtre éditable, puis propose d'ouvrir le PDF produit.
// spec : { type, ...identifiants } — ex. { type:'presentation', artiste_id },
//        { type:'lettre', vente_id }, { type:'certificat', certificat_id },
//        { type:'facture-artiste', vente_id }, { type:'catalogue', artiste_id }.
import { confirmer } from './dialogue.js';

export async function lancerEditionDocument(spec) {
  try {
    const res = await window.api.pdfEditerDocument(spec);
    if (!res || !res.pdf_path) return null; // annulé par l'utilisateur
    const rep = await confirmer({
      type: 'succes',
      title: 'Version modifiée produite',
      message: 'Le document modifié a été enregistré en PDF (les données ne sont pas changées).',
      buttons: ['Ouvrir le PDF', 'Fermer'],
      defaultId: 0,
      cancelId: 1,
    });
    if (rep === 0) { try { await window.api.pdfOuvrir(res.pdf_path); } catch {} }
    return res;
  } catch (err) {
    await confirmer({ type: 'error', title: 'Échec', message: (err && err.message) || String(err), buttons: ['OK'] });
    return null;
  }
}
