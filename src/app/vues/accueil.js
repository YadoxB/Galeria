import { naviguer } from '../router.js';
import { ech, pluriel, formaterPrix, formaterDate, badgeStatut, urlPhoto, nomComplet } from '../commun.js';
import { chargerConfig } from '../marque.js';

// Icônes du stepper « Commandes non complétées » (SVG inline, stroke courant)
const ICONE_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const etapes = [
  { lbl: 'Paiement',  icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
  { lbl: 'Emballage', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>' },
  { lbl: 'Envoi',     icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>' },
  { lbl: 'Livraison', icone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
];

function formaterEntier(n) {
  return (Number(n) || 0).toLocaleString('fr-CA');
}

function formaterMontantCourt(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return Math.round(v).toLocaleString('fr-CA') + ' $';
  return v.toFixed(2) + ' $';
}

function formaterMois(s) {
  if (!s) return '';
  const [, mois] = s.split('-');
  const noms = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return noms[Math.max(0, Math.min(11, Number(mois) - 1))] || '';
}

function carteStat({ libelle, valeur, delta, deltaPositif, deltaNeutre, classeTuile, svg }) {
  const deltaClasse = deltaPositif ? '' : (deltaNeutre ? 'neutre' : 'negatif');
  return `
    <div class="stat-carte">
      <div class="stat-tuile ${classeTuile}" aria-hidden="true">${svg}</div>
      <div class="stat-corps">
        <p class="stat-libelle">${ech(libelle)}</p>
        <p class="stat-valeur">${valeur}</p>
        <p class="stat-delta ${deltaClasse}">${ech(delta)}</p>
      </div>
    </div>
  `;
}

function svgIcone(d) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

const ICO_OEUVRES  = svgIcone('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M21 16l-5-5L5 21"/>');
const ICO_ARTISTES = svgIcone('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>');
const ICO_CLIENTS  = svgIcone('<circle cx="9" cy="8" r="3.5"/><path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="3"/><path d="M22 20c0-2.5-2-4.5-4.5-4.5"/>');
const ICO_DOLLAR   = svgIcone('<line x1="12" y1="3" x2="12" y2="21"/><path d="M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>');

export async function rendreAccueil(contenu) {
  contenu.innerHTML = `
    <div class="vue-accueil-dashboard">
      <header class="dashboard-entete">
        <img src="../gabarits/actifs/logo-gvsj.png" alt="" class="dashboard-logo">
        <div class="dashboard-titres">
          <h1>Tableau de bord</h1>
          <p id="dashboard-sous-titre" class="dashboard-sous-titre">Chargement…</p>
        </div>
      </header>

      <div class="stats-row" id="dashboard-stats">
        <div class="dashboard-attente">Chargement des statistiques…</div>
      </div>

      <div class="dashboard-grille">
        <section class="dashboard-bloc bloc-oeuvres">
          <header class="dashboard-bloc-entete">
            <h2>Œuvres récemment ajoutées</h2>
            <button class="btn-lien" data-vue="oeuvres-liste">Voir tout</button>
          </header>
          <div class="dashboard-bloc-corps" id="dashboard-oeuvres"></div>
        </section>

        <section class="dashboard-bloc bloc-ventes">
          <header class="dashboard-bloc-entete">
            <h2>Ventes récentes</h2>
            <button class="btn-lien" data-vue="ventes-liste">Voir tout</button>
          </header>
          <div class="dashboard-bloc-corps" id="dashboard-ventes"></div>
        </section>

        <section class="dashboard-bloc bloc-commandes">
          <header class="dashboard-bloc-entete">
            <h2>Commandes non complétées</h2>
            <span class="dashboard-bloc-aide">à compléter</span>
          </header>
          <div class="dashboard-bloc-corps" id="dashboard-commandes"></div>
        </section>

        <section class="dashboard-bloc bloc-reservees">
          <header class="dashboard-bloc-entete">
            <h2>Œuvres réservées</h2>
            <span class="dashboard-bloc-aide">à relancer</span>
          </header>
          <div class="dashboard-bloc-corps" id="dashboard-reservees"></div>
        </section>

        <section class="dashboard-bloc bloc-catalogue">
          <header class="dashboard-bloc-entete">
            <h2>Résumé du catalogue</h2>
          </header>
          <div class="dashboard-bloc-corps" id="dashboard-catalogue"></div>
        </section>
      </div>
    </div>
  `;

  contenu.querySelectorAll('[data-vue]').forEach((btn) => {
    btn.addEventListener('click', () => naviguer(btn.dataset.vue));
  });

  const config = await chargerConfig();
  const nomGalerie = config.galerie?.nom || 'Galeria';
  const sousTitreEl = contenu.querySelector('#dashboard-sous-titre');
  if (sousTitreEl) sousTitreEl.textContent = `Bienvenue. Voici un aperçu de ${nomGalerie}.`;

  try {
    const d = await window.api.accueilDonnees();
    remplirStats(contenu, d.stats);
    remplirOeuvresRecentes(contenu, d.oeuvresRecentes);
    remplirVentesRecentes(contenu, d.ventesRecentes);
    remplirCommandesNonCompletees(contenu, d.commandesNonCompletees);
    remplirReservees(contenu, d.oeuvresReservees);
    remplirCatalogue(contenu, d.stats, d.ventesParMois);
  } catch (err) {
    const zone = contenu.querySelector('#dashboard-stats');
    if (zone) zone.innerHTML = `<p class="erreur">Impossible de charger le tableau de bord : ${ech(err.message)}</p>`;
  }
}

function remplirStats(contenu, s) {
  const deltaO = s.totalDeltaMois > 0 ? `+${s.totalDeltaMois} ce mois-ci` : 'aucune nouvelle ce mois';
  const deltaA = s.artistesDeltaMois > 0 ? `+${s.artistesDeltaMois} ce mois-ci` : 'aucun nouveau ce mois';
  const deltaC = s.clientsDeltaMois > 0 ? `+${s.clientsDeltaMois} ce mois-ci` : `${formaterEntier(s.clientsActifs)} ayant déjà acheté`;
  const deltaV = s.ventesDeltaPct == null
    ? formaterMontantCourt(s.ventesMoisMontant)
    : `${s.ventesDeltaPct >= 0 ? '+' : ''}${s.ventesDeltaPct}% vs mois dernier`;

  contenu.querySelector('#dashboard-stats').innerHTML = `
    ${carteStat({
      libelle: 'Œuvres au total',
      valeur: formaterEntier(s.total),
      delta: deltaO,
      deltaPositif: s.totalDeltaMois > 0,
      deltaNeutre: s.totalDeltaMois === 0,
      classeTuile: 'tuile-doree',
      svg: ICO_OEUVRES,
    })}
    ${carteStat({
      libelle: 'Artistes représentés',
      valeur: formaterEntier(s.artistes),
      delta: deltaA,
      deltaPositif: s.artistesDeltaMois > 0,
      deltaNeutre: s.artistesDeltaMois === 0,
      classeTuile: 'tuile-saumon',
      svg: ICO_ARTISTES,
    })}
    ${carteStat({
      libelle: 'Clients actifs',
      valeur: formaterEntier(s.clientsActifs),
      delta: deltaC,
      deltaPositif: s.clientsDeltaMois > 0,
      deltaNeutre: s.clientsDeltaMois === 0,
      classeTuile: 'tuile-terracotta',
      svg: ICO_CLIENTS,
    })}
    ${carteStat({
      libelle: 'Ventes ce mois',
      valeur: formaterEntier(s.ventesMois),
      delta: deltaV,
      deltaPositif: s.ventesDeltaPct != null && s.ventesDeltaPct > 0,
      deltaNeutre: s.ventesDeltaPct == null || s.ventesDeltaPct === 0,
      classeTuile: 'tuile-navy',
      svg: ICO_DOLLAR,
    })}
  `;
}

function remplirOeuvresRecentes(contenu, oeuvres) {
  const zone = contenu.querySelector('#dashboard-oeuvres');
  if (!oeuvres || !oeuvres.length) {
    zone.innerHTML = `<p class="dashboard-vide">Aucune œuvre encore au catalogue.</p>`;
    return;
  }
  zone.innerHTML = `<div class="dashboard-galerie">${oeuvres.map((o) => `
    <article class="dashboard-vignette" data-id="${o.id}" role="button" tabindex="0">
      <div class="dashboard-vignette-image">
        ${o.image_path
          ? `<img src="${urlPhoto(o.image_path)}" loading="lazy" alt="">`
          : `<span class="dashboard-vignette-vide">&#9635;</span>`}
      </div>
      <div class="dashboard-vignette-info">
        <p class="dashboard-vignette-titre">${ech(o.titre)}</p>
        <p class="dashboard-vignette-meta">${ech(o.artiste_nom)}${o.annee ? ' &middot; ' + o.annee : ''}</p>
        <div class="dashboard-vignette-pied">
          ${badgeStatut(o.statut)}
          ${o.prix != null ? `<span class="dashboard-vignette-prix">${formaterPrix(o.prix)}</span>` : ''}
        </div>
      </div>
    </article>
  `).join('')}</div>`;
  zone.querySelectorAll('.dashboard-vignette').forEach((el) => {
    const goto = () => naviguer('oeuvre-fiche', { id: Number(el.dataset.id) });
    el.addEventListener('click', goto);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goto(); } });
  });
}

function remplirVentesRecentes(contenu, ventes) {
  const zone = contenu.querySelector('#dashboard-ventes');
  if (!ventes || !ventes.length) {
    zone.innerHTML = `<p class="dashboard-vide">Aucune vente enregistrée.</p>`;
    return;
  }
  zone.innerHTML = `<div class="dashboard-liste-compacte">${ventes.map((v) => {
    const client = v.client_nom || '—';
    const total = (Number(v.prix_vente) || 0) + (Number(v.tps) || 0) + (Number(v.tvq) || 0);
    return `
      <button class="dashboard-ligne" data-id="${v.id}">
        <div class="dashboard-ligne-vignette">
          ${v.image_path
            ? `<img src="${urlPhoto(v.image_path)}" loading="lazy" alt="">`
            : `<span>&#9635;</span>`}
        </div>
        <div class="dashboard-ligne-corps">
          <p class="dashboard-ligne-titre">${ech(v.oeuvre_titre)}</p>
          <p class="dashboard-ligne-meta">${ech(client)}</p>
        </div>
        <div class="dashboard-ligne-droite">
          <p class="dashboard-ligne-montant">${formaterMontantCourt(total)}</p>
          <p class="dashboard-ligne-date">${ech(formaterDate(v.date_vente))}</p>
        </div>
      </button>
    `;
  }).join('')}</div>`;
  zone.querySelectorAll('.dashboard-ligne').forEach((btn) => {
    btn.addEventListener('click', () => naviguer('vente-fiche', { id: Number(btn.dataset.id) }));
  });
}

function remplirCommandesNonCompletees(contenu, commandes) {
  const zone = contenu.querySelector('#dashboard-commandes');
  if (!zone) return;
  if (!commandes || !commandes.length) {
    zone.innerHTML = `<p class="dashboard-vide">Toutes les commandes sont complétées 🎉</p>`;
    return;
  }
  const stepper = (v) => {
    const etats = [
      v.paiement_statut === 'recu' ? 'fait' : v.paiement_statut === 'partiel' ? 'partiel' : 'attente',
      v.emballage_date ? 'fait' : 'attente',
      v.envoi_date ? 'fait' : 'attente',
      v.livraison_date ? 'fait' : 'attente',
    ];
    return etapes.map((e, i) => {
      const etat = etats[i];
      const icone = etat === 'fait' ? ICONE_CHECK : e.icone;
      const conn = i < etapes.length - 1
        ? `<span class="commande-conn ${etat === 'fait' && etats[i + 1] === 'fait' ? 'fait' : ''}"></span>`
        : '';
      return `<span class="commande-step ${etat}"><span class="rond">${icone}</span><span class="lbl">${e.lbl}</span></span>${conn}`;
    }).join('');
  };
  zone.innerHTML = `<div class="dashboard-liste-compacte">${commandes.map((v) => {
    const client = v.client_nom || '—';
    return `
      <button class="dashboard-ligne-commande" data-id="${v.id}" title="Voir la vente">
        <div class="commande-haut">
          <div class="dashboard-ligne-vignette">
            ${v.image_path
              ? `<img src="${urlPhoto(v.image_path)}" loading="lazy" alt="">`
              : `<span>&#9635;</span>`}
          </div>
          <div class="dashboard-ligne-corps">
            <p class="dashboard-ligne-titre">${ech(v.oeuvre_titre)}</p>
            <p class="dashboard-ligne-meta">${ech(client)}${v.numero_facture ? ' · ' + ech(v.numero_facture) : ''}</p>
          </div>
        </div>
        <div class="commande-stepper" aria-label="Étapes du cycle de vie">${stepper(v)}</div>
      </button>
    `;
  }).join('')}</div>`;
  zone.querySelectorAll('.dashboard-ligne-commande').forEach((btn) => {
    btn.addEventListener('click', () => naviguer('vente-fiche', { id: Number(btn.dataset.id) }));
  });
}

function remplirReservees(contenu, oeuvres) {
  const zone = contenu.querySelector('#dashboard-reservees');
  if (!oeuvres || !oeuvres.length) {
    zone.innerHTML = `<p class="dashboard-vide">Aucune œuvre actuellement réservée.</p>`;
    return;
  }
  zone.innerHTML = `<div class="dashboard-liste-compacte">${oeuvres.map((o) => `
    <button class="dashboard-ligne" data-id="${o.id}">
      <div class="dashboard-ligne-vignette">
        ${o.image_path
          ? `<img src="${urlPhoto(o.image_path)}" loading="lazy" alt="">`
          : `<span>&#9635;</span>`}
      </div>
      <div class="dashboard-ligne-corps">
        <p class="dashboard-ligne-titre">${ech(o.titre)}</p>
        <p class="dashboard-ligne-meta">${ech(o.artiste_nom)}</p>
      </div>
      <div class="dashboard-ligne-droite">
        ${o.prix != null ? `<p class="dashboard-ligne-montant">${formaterPrix(o.prix)}</p>` : ''}
      </div>
    </button>
  `).join('')}</div>`;
  zone.querySelectorAll('.dashboard-ligne').forEach((btn) => {
    btn.addEventListener('click', () => naviguer('oeuvre-fiche', { id: Number(btn.dataset.id) }));
  });
}

function remplirCatalogue(contenu, stats, ventesParMois) {
  const zone = contenu.querySelector('#dashboard-catalogue');
  const valeurFmt = (() => {
    const v = Number(stats.valeurCatalogue) || 0;
    return v.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  })();

  const moisCible = [];
  const maintenant = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    moisCible.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const carte = new Map((ventesParMois || []).map((r) => [r.mois, Number(r.montant) || 0]));
  const valeurs = moisCible.map((m) => carte.get(m) || 0);
  const max = Math.max(...valeurs, 1);

  const W = 320, H = 70, P = 6;
  const pas = valeurs.length > 1 ? (W - 2 * P) / (valeurs.length - 1) : 0;
  const points = valeurs.map((v, i) => {
    const x = P + i * pas;
    const y = H - P - (v / max) * (H - 2 * P);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const pointsAire = `${P},${H - P} ${points} ${(P + (valeurs.length - 1) * pas).toFixed(1)},${H - P}`;

  zone.innerHTML = `
    <div class="catalogue-cle">
      <p class="catalogue-libelle">Valeur du catalogue disponible</p>
      <p class="catalogue-valeur">${ech(valeurFmt)}</p>
    </div>
    <div class="catalogue-graph">
      <p class="catalogue-graph-libelle">Ventes des 12 derniers mois</p>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="catalogue-svg" aria-hidden="true">
        <polygon points="${pointsAire}" fill="var(--warm-gold)" opacity="0.18"/>
        <polyline points="${points}" fill="none" stroke="var(--warm-gold)" stroke-width="2"/>
      </svg>
      <div class="catalogue-graph-axe">
        <span>${ech(formaterMois(moisCible[0]))}</span>
        <span>${ech(formaterMois(moisCible[moisCible.length - 1]))}</span>
      </div>
    </div>
  `;
}
