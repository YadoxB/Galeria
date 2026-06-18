// Wrapper de release : récupère le token GitHub via `gh auth token` puis
// enchaîne le build public (catalogue + photos vides) et la publication
// sur GitHub Releases via electron-builder. Évite d'avoir à manipuler un
// token en clair à chaque release.
//
// Prérequis : GitHub CLI installé (`winget install --id GitHub.cli`) et
// authentifié (`gh auth login`). Sinon ce script affiche un message clair
// et s'arrête.

const { execSync, spawnSync } = require('node:child_process');

function fail(msg) {
  console.error(`\n[release] ${msg}\n`);
  process.exit(1);
}

// 1. Récupérer le token via gh
let token;
try {
  token = execSync('gh auth token', { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
} catch (err) {
  fail(
    [
      'Impossible de récupérer le token GitHub via `gh auth token`.',
      'Vérifie que :',
      '  1. GitHub CLI est installé    →  winget install --id GitHub.cli',
      '  2. Tu es authentifié          →  gh auth login',
      '',
      `Détail : ${err.message.split('\n')[0]}`,
    ].join('\n'),
  );
}
if (!token || !/^(gh[pousr]_|github_pat_)/.test(token)) {
  fail('Le token retourné par `gh auth token` est invalide ou vide.');
}

// 2. Exécuter le build public puis electron-builder avec --publish=always.
//    On passe le token via l'environnement uniquement (pas en argument de
//    ligne de commande, qui pourrait être loggé).
const env = { ...process.env, GH_TOKEN: token };

function run(label, cmd, args) {
  console.log(`\n[release] ${label}…`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: true });
  if (r.status !== 0) {
    fail(`Étape « ${label} » a échoué (exit ${r.status}).`);
  }
}

run('préparation des assets (catalogue + photos vides)',
    'npm', ['run', 'prepare:assets:public']);
run('build + publication GitHub Releases',
    'electron-builder', ['--win', '--publish=always']);

// 3. electron-builder crée la release en BROUILLON. On la publie (draft=false)
//    pour qu'elle devienne visible et que l'auto-update la détecte. Sans cette
//    étape, il fallait dé-brouillonner à la main après chaque release.
const version = require('../package.json').version;
const tag = `v${version}`;
try {
  console.log(`\n[release] publication de la release ${tag} (draft → public)…`);
  execSync(`gh release edit ${tag} --draft=false`, { stdio: 'inherit', env });
} catch (err) {
  fail(
    [
      `La release ${tag} a été créée mais n'a pas pu être publiée automatiquement.`,
      `Publie-la à la main :  gh release edit ${tag} --draft=false`,
      '',
      `Détail : ${err.message.split('\n')[0]}`,
    ].join('\n'),
  );
}

console.log(`\n[release] ✓ Release ${tag} publiée avec succès.\n`);
