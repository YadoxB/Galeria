import { confirmer, alerter } from './dialogue.js';

export async function fluxImport() {
  const choix = await window.api.importChoisirFichier();
  if (!choix || choix.cancelled) return false;

  if (choix.error) {
    await alerter({
      type: 'error',
      title: 'Erreur de lecture',
      message: 'Impossible de lire le fichier.',
      detail: choix.error,
    });
    return false;
  }

  if (!choix.type) {
    await alerter({
      type: 'error',
      title: 'Type de fichier non reconnu',
      message: "Ce fichier ne ressemble pas à un export Airtable d'Artistes ou d'Œuvres.",
      detail: `Colonnes détectées : ${(choix.headers || []).slice(0, 6).join(', ')}…`,
    });
    return false;
  }

  const tableLabel = choix.type === 'artistes' ? 'artiste(s)' : 'œuvre(s)';
  const reponse = await confirmer({
    type: 'question',
    title: 'Comment importer ?',
    message: `${choix.count} ${tableLabel} détecté(e)s dans :\n${choix.nomFichier}`,
    detail:
      '« Mettre à jour » : les fiches déjà présentes voient leurs champs remplacés par ceux du CSV (les champs non importés comme les numéros de taxes restent intacts).\n' +
      '« Ajouter seul les nouveaux » : les fiches existantes sont sautées.\n' +
      (choix.type === 'oeuvres'
        ? "\nLes œuvres dont l'artiste n'existe pas encore dans la base seront listées à part."
        : ''),
    buttons: ['Mettre à jour', 'Ajouter seul les nouveaux', 'Annuler'],
    defaultId: 0,
    cancelId: 2,
  });
  if (reponse === 2) return false;
  const mode = reponse === 0 ? 'mettre_a_jour' : 'ajouter';

  let result;
  try {
    result = await window.api.importExecuter(choix.path, mode);
  } catch (err) {
    await alerter({
      type: 'error',
      title: "Erreur pendant l'import",
      message: "L'importation a échoué. Aucun changement n'a été enregistré.",
      detail: err.message,
    });
    return false;
  }

  const lignes = [];
  if (result.imported) lignes.push(`${result.imported} ${tableLabel} ajouté(e)s.`);
  if (result.updated) lignes.push(`${result.updated} ${tableLabel} mis(es) à jour.`);
  if (result.skipped?.length) lignes.push(`${result.skipped.length} doublon(s) sauté(s).`);
  if (result.orphans?.length) lignes.push(`${result.orphans.length} œuvre(s) orpheline(s) — artiste introuvable.`);
  if (result.errors?.length) lignes.push(`${result.errors.length} erreur(s) de ligne.`);
  if (!lignes.length) lignes.push('Rien à importer.');

  let detail = '';
  if (result.orphans?.length) {
    const echantillon = result.orphans.slice(0, 12).map((o) => `• ${o.titre} — ${o.raison}`).join('\n');
    detail = `Œuvres orphelines :\n${echantillon}`;
    if (result.orphans.length > 12) detail += `\n…et ${result.orphans.length - 12} autre(s).`;
  }

  await alerter({
    type: result.errors?.length || result.orphans?.length ? 'warning' : 'succes',
    title: 'Import terminé',
    message: lignes.join('\n'),
    detail: detail || undefined,
  });
  return true;
}
