import { confirmer } from './dialogue.js';

// Au démarrage : si un catalogue est livré avec cette installation et qu'il
// diffère de celui de la base actuelle (et n'a pas été refusé), proposer de le
// charger. La logique de comparaison et le remplacement sont côté main.
export async function proposerCatalogueLivreSiNouveau() {
  let info;
  try {
    info = await window.api.catalogueVerifier();
  } catch {
    return; // en cas de souci, on ne bloque jamais le démarrage
  }
  if (!info || !info.offrir) return;

  const reponse = await confirmer({
    type: 'question',
    title: 'Nouveau catalogue disponible',
    message: 'Un catalogue (artistes et œuvres) est fourni avec cette version.',
    detail:
      "Le charger remplacera le catalogue actuel par celui qui est livré. " +
      "Votre base actuelle sera d'abord sauvegardée dans le dossier « Sauvegardes », " +
      "puis l'application redémarrera et préparera les photos.",
    buttons: ['Charger le nouveau catalogue', 'Plus tard'],
    defaultId: 0,
    cancelId: 1,
  });

  if (reponse === 0) {
    // catalogueCharger redémarre l'application : le renderer est arrêté, rien à faire ensuite.
    try { await window.api.catalogueCharger(); } catch { /* relaunch : sans suite */ }
  } else {
    try { await window.api.catalogueRefuser(info.id); } catch {}
  }
}
