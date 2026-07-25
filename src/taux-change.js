// Récupération des taux de change à la Banque du Canada (API Valet, officielle,
// gratuite, sans clé). Meilleur effort : délai court, jamais bloquant. En cas
// d'échec (hors-ligne, timeout, réponse inattendue), on renvoie le dernier taux
// connu (mémorisé dans la config) — le convertisseur fonctionne toujours.
//
// L'appel réseau se fait ICI, dans le processus principal (net.fetch), et jamais
// dans l'interface : aucune donnée de la galerie ne sort, seule une demande de
// taux public entre. C'est le seul but de ce module.

const { net } = require('electron');
const { obtenirConfig, mettreAJourConfig } = require('./config');

// Séries : USD→CAD (FXUSDCAD) et EUR→CAD (FXEURCAD), dernière observation.
const URL_VALET =
  'https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXEURCAD/json?recent=1';

function tauxMemorises() {
  const o = obtenirConfig().outils || {};
  return { usd: o.taux_change_usd_cad, eur: o.taux_change_eur_cad, maj: o.taux_change_maj || '' };
}

async function recupererTauxChange(timeoutMs = 6000) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const rep = await net.fetch(URL_VALET, { signal: ctrl.signal });
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    const data = await rep.json();
    const obs = (data.observations || []).filter((o) => o && (o.FXUSDCAD || o.FXEURCAD)).pop();
    if (!obs) throw new Error('Aucune observation dans la réponse.');
    const usd = parseFloat(obs.FXUSDCAD && obs.FXUSDCAD.v);
    const eur = parseFloat(obs.FXEURCAD && obs.FXEURCAD.v);
    const maj = typeof obs.d === 'string' ? obs.d : '';

    const patch = {};
    if (Number.isFinite(usd) && usd > 0) patch.taux_change_usd_cad = usd;
    if (Number.isFinite(eur) && eur > 0) patch.taux_change_eur_cad = eur;
    if (maj) patch.taux_change_maj = maj;
    if (!Number.isFinite(usd) && !Number.isFinite(eur)) throw new Error('Taux illisibles.');
    mettreAJourConfig({ outils: patch });

    return { ok: true, ...tauxMemorises() };
  } catch (e) {
    return { ok: false, erreur: String((e && e.message) || e), ...tauxMemorises() };
  } finally {
    clearTimeout(minuteur);
  }
}

module.exports = { recupererTauxChange, tauxMemorises };
