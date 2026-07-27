// Récupération des taux de change à la Banque du Canada (API Valet, officielle,
// gratuite, sans clé). Meilleur effort : délai court, jamais bloquant. En cas
// d'échec (hors-ligne, timeout, réponse inattendue), on renvoie le dernier taux
// connu (mémorisé dans la config) — le convertisseur fonctionne toujours.
//
// L'appel réseau se fait ICI, dans le processus principal, et jamais dans
// l'interface : aucune donnée de la galerie ne sort, seule une demande de taux
// public entre. C'est le seul but de ce module.
//
// On utilise le `fetch` intégré de Node (et non net.fetch d'Electron) : c'est
// celui vérifié en banc d'essai, et il évite un comportement différent sur la
// requête. Deux appels simples (une série chacun) plutôt qu'un appel combiné,
// pour des URL sans virgule — plus sûr côté client HTTP.

const { obtenirConfig, mettreAJourConfig } = require('./config');

const BASE = 'https://www.bankofcanada.ca/valet/observations/';

function tauxMemorises() {
  const o = obtenirConfig().outils || {};
  return { usd: o.taux_change_usd_cad, eur: o.taux_change_eur_cad, maj: o.taux_change_maj || '' };
}

// Récupère une série (ex. FXUSDCAD) → { v: nombre, d: 'AAAA-MM-JJ' }.
async function lireSerie(code, signal) {
  const rep = await fetch(`${BASE}${code}/json?recent=1`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!rep.ok) throw new Error(`HTTP ${rep.status} (${code})`);
  const data = await rep.json();
  const obs = (data.observations || []).filter((o) => o && o[code]).pop();
  if (!obs || !obs[code]) throw new Error(`Aucune observation (${code})`);
  return { v: parseFloat(obs[code].v), d: typeof obs.d === 'string' ? obs.d : '' };
}

async function recupererTauxChange(timeoutMs = 8000) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (typeof fetch !== 'function') throw new Error('fetch indisponible dans cet environnement');
    const [usd, eur] = await Promise.all([
      lireSerie('FXUSDCAD', ctrl.signal),
      lireSerie('FXEURCAD', ctrl.signal),
    ]);

    const patch = {};
    let maj = '';
    if (Number.isFinite(usd.v) && usd.v > 0) { patch.taux_change_usd_cad = usd.v; maj = usd.d || maj; }
    if (Number.isFinite(eur.v) && eur.v > 0) { patch.taux_change_eur_cad = eur.v; maj = eur.d || maj; }
    if (!Object.keys(patch).length) throw new Error('Taux illisibles.');
    if (maj) patch.taux_change_maj = maj;
    mettreAJourConfig({ outils: patch });

    return { ok: true, ...tauxMemorises() };
  } catch (e) {
    // Visible dans le terminal de `npm start` — aide au diagnostic si ça échoue.
    console.error('Taux de change — récupération impossible, repli sur le dernier connu :', (e && e.message) || e);
    return { ok: false, erreur: String((e && e.message) || e), ...tauxMemorises() };
  } finally {
    clearTimeout(minuteur);
  }
}

module.exports = { recupererTauxChange, tauxMemorises };
