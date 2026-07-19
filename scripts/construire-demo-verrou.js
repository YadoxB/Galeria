// Assemble demos/verrou-secours.html en INLINANT le vrai src/app/verrou.js et
// les vrais styles de src/styles.css. La démo exécute donc exactement le code
// livré — aucune dérive possible. Elle s'ouvre en double-cliquant (file://),
// sans serveur, comme les autres démos du projet.
//
// Regénérer après toute modification de verrou.js :
//   node <scratchpad>/construire-demo.js
const fs = require('node:fs');

// --- Le vrai module, débarrassé de ses `export` (la démo n'est pas un module) ---
const verrouSrc = fs.readFileSync('src/app/verrou.js', 'utf8')
  .replace(/^export\s+/gm, '');

// --- Les vrais styles de l'écran de verrouillage ---
const css = fs.readFileSync('src/styles.css', 'utf8');
const debut = css.indexOf('/* ===== Écran de verrouillage');
if (debut < 0) throw new Error('Bloc de styles du verrou introuvable dans styles.css');
const styles = css.slice(debut);

// Garde-fous : si l'extraction rate, on préfère échouer bruyamment.
for (const [quoi, present] of [
  ['le volet de secours (markup)', verrouSrc.includes('verrou-secours')],
  ['la fonction toucheVersAction', verrouSrc.includes('function toucheVersAction')],
  ['les styles du volet de secours', styles.includes('.verrou-secours')],
  ['les styles du pavé', styles.includes('.verrou-touche')],
]) {
  if (!present) throw new Error('Extraction incomplète : ' + quoi + ' est absent.');
}

const page = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Galeria — Démo Question de secours</title>
  <link rel="stylesheet" href="../src/theme.css">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--soft-ivory); color: var(--ink); font-family: var(--font-ui); }
    .demo-bar {
      position: sticky; top: 0; z-index: 10;
      display: flex; justify-content: space-between; align-items: center;
      gap: var(--s3); padding: var(--s2) var(--s4);
      background: var(--deep-navy); color: var(--soft-ivory);
    }
    .demo-bar .titre { font-family: var(--font-titre); font-size: 18px; }
    .demo-bar .titre .marque { color: var(--warm-gold); font-style: italic; }
    main { max-width: 820px; margin: 0 auto; padding: var(--s4); }
    h2 { font-family: var(--font-titre); font-size: 26px; color: var(--gallery-navy); margin: 0 0 8px; }
    p.intro { font-size: 14.5px; line-height: 1.6; color: var(--slate); margin: 0 0 18px; }
    .encart { background: #fff; border: 1px solid var(--mist); border-radius: 12px; padding: 16px 18px; margin: 0 0 18px; font-size: 14px; line-height: 1.6; }
    .encart h3 { margin: 0 0 8px; font-size: 15px; color: var(--gallery-navy); }
    .encart ol { margin: 8px 0 0; padding-left: 20px; }
    .encart li { margin-bottom: 6px; }
    .rappel { background: rgba(201,154,61,0.10); border-left: 3px solid var(--warm-gold); border-radius: 0 6px 6px 0; padding: 10px 12px; font-size: 13.5px; line-height: 1.6; }
    .btn-ouvrir { background: var(--warm-gold); color: var(--soft-ivory); border: none; border-radius: 10px; padding: 12px 22px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: var(--font-ui); }
    table.essais { width: 100%; border-collapse: collapse; font-size: 13.5px; margin-top: 10px; }
    table.essais th, table.essais td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--mist); }
    table.essais th { color: var(--gallery-navy); }
    code.rep { background: var(--porcelain); border: 1px solid var(--mist); border-radius: 4px; padding: 1px 6px; font-family: monospace; }
    .genere { font-size: 12px; color: var(--stone); margin-top: 28px; }

/* ══════════════════════════════════════════════════════════════════════
   Styles ci-dessous : COPIÉS AUTOMATIQUEMENT de src/styles.css.
   Ne pas modifier ici — régénérer la démo.
   ══════════════════════════════════════════════════════════════════════ */
${styles}
  </style>
</head>
<body>
  <div class="demo-bar">
    <div class="titre"><span class="marque">Galeria</span> — Démo : question de secours</div>
  </div>

  <main>
    <h2>Reprendre la main sur un code oublié</h2>
    <p class="intro">
      Sans cette porte de sortie, un code oublié voudrait dire un appel à Dave et
      une modification de fichier à la main. La question de secours permet aux
      propriétaires de s'en sortir seuls — sans que la réponse soit jamais
      conservée en clair dans l'ordinateur.
    </p>

    <div class="encart">
      <h3>Comment tester</h3>
      <ol>
        <li>Clique <strong>« Verrouiller l'écran »</strong>.</li>
        <li>Clique <strong>« Code oublié ? »</strong> en bas de l'écran.</li>
        <li>Essaie d'abord une <strong>mauvaise</strong> réponse : le nombre d'essais restants s'affiche.</li>
        <li>Puis une bonne réponse, dans n'importe quelle graphie (voir le tableau).</li>
        <li>Choisis un nouveau code de 4 à 6 chiffres → l'écran s'ouvre.</li>
        <li>Reverrouille : le code est bien celui que tu viens de choisir.</li>
      </ol>
      <p style="margin:12px 0 0"><strong>À vérifier aussi :</strong> le bouton « Retour » ramène au pavé, et le pavé doit y refonctionner (essaie NumLock éteint). Après 3 mauvaises réponses, une pause de 30 secondes est imposée — même à la bonne réponse.</p>
    </div>

    <div class="encart">
      <h3>Tolérance à la saisie — la réponse est « Sainte-Foy »</h3>
      <p style="margin:0">Toutes ces graphies sont acceptées. C'est ce qui fait la différence entre un secours utilisable et un secours qui refuse la réponse de son propre propriétaire.</p>
      <table class="essais">
        <tr><th>Ce qui est tapé</th><th>Résultat</th></tr>
        <tr><td><code class="rep">Sainte-Foy</code></td><td>accepté</td></tr>
        <tr><td><code class="rep">sainte foy</code></td><td>accepté</td></tr>
        <tr><td><code class="rep">SAINTEFOY</code></td><td>accepté</td></tr>
        <tr><td><code class="rep">&nbsp;&nbsp;Sainte-Foy&nbsp;&nbsp;</code></td><td>accepté</td></tr>
        <tr><td><code class="rep">Montréal</code></td><td>refusé</td></tr>
      </table>
    </div>

    <p class="rappel">
      <strong>Rappel de portée :</strong> ce verrou protège contre une personne
      de passage qui voudrait consulter les fiches de clients. Il ne protège pas
      contre quelqu'un de compétent ayant accès à l'ordinateur — c'est le rôle de
      BitLocker et du chiffrement de la base (volet 2).
    </p>

    <p><button class="btn-ouvrir" id="btn-verrouiller">Verrouiller l'écran</button></p>
    <p style="font-size:13px;color:var(--slate)">Code de cette démo : <strong id="code-actuel">2580</strong></p>

    <p class="genere">Cette page est <strong>générée</strong> à partir de <code>src/app/verrou.js</code> et <code>src/styles.css</code> : elle exécute le code réel de l'application, pas une imitation.</p>
  </main>

<script>
// ═══════════════════════════════════════════════════════════════════════
// Faux « processus principal » : rejoue la logique de src/securite.js
// (normalisation, freinage, réinitialisation). Dans l'application, tout ceci
// vit côté main et ne descend jamais dans l'interface.
// ═══════════════════════════════════════════════════════════════════════
let codeDemo = '2580';
const QUESTION = 'Dans quelle ville êtes-vous né ?';
const norm = (t) => String(t == null ? '' : t)
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');
const REPONSE_NORM = norm('Sainte-Foy');
let tentatives = 0, bloqueJusqua = 0;

window.api = {
  securiteEtat: async () => ({
    code_defini: true, verrou_actif: true, inactivite_minutes: 0,
    verrouiller_au_demarrage: false, verrouiller_au_blur: false,
    question_definie: true, question: QUESTION,
  }),
  securiteVerifierCode: async (c) => ({ ok: c === codeDemo }),
  securiteVerifierReponse: async (r) => {
    const reste = bloqueJusqua - Date.now();
    if (reste > 0) return { ok: false, pause_secondes: Math.ceil(reste / 1000) };
    const n = norm(r);
    if (n.length < 2) return { ok: false };
    if (n === REPONSE_NORM) { tentatives = 0; bloqueJusqua = 0; return { ok: true }; }
    tentatives += 1;
    if (tentatives >= 3) { tentatives = 0; bloqueJusqua = Date.now() + 30000; return { ok: false, pause_secondes: 30 }; }
    return { ok: false, tentatives_restantes: 3 - tentatives };
  },
  securiteReinitialiserCode: async (r, code) => {
    const v = await window.api.securiteVerifierReponse(r);
    if (!v.ok) return v;
    if (!/^\\d{4,6}$/.test(code)) throw new Error('Le code doit comporter de 4 à 6 chiffres.');
    codeDemo = code;
    document.getElementById('code-actuel').textContent = code;
    return { ok: true };
  },
  onSecuriteVerrouiller: () => {},
};
</script>

<script>
/* ══════════════════════════════════════════════════════════════════════
   Ci-dessous : src/app/verrou.js COPIÉ INTÉGRALEMENT (mots-clés « export »
   retirés). Ne pas modifier ici — régénérer la démo.
   ══════════════════════════════════════════════════════════════════════ */
${verrouSrc}

// --- Amorce de la démo ---
initialiserVerrou().then(() => {
  document.getElementById('btn-verrouiller').addEventListener('click', verrouiller);
});
</script>
</body>
</html>
`;

fs.writeFileSync('demos/verrou-secours.html', page);
console.log('demos/verrou-secours.html écrit :', page.length, 'octets');
