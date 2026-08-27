import { ech, sansAccents, nomComplet, brancherDropdownMedium, chargerMediumsConnus } from '../commun.js';
import {
  calculerPrixSuggere, parserCotes, TAILLES_COTES,
  calculerFormat, coteGaleriePourType,
} from '../calcul-prix.js';

export async function rendreOutils(contenu) {
  const artistes = await window.api.artistesListe({ inclureArchives: false });
  const artistesTriees = artistes
    .map((a) => ({ id: a.id, nom: nomComplet(a) || a.nom || '' }))
    .sort((a, b) => sansAccents(a.nom).localeCompare(sansAccents(b.nom)));

  // Taux de taxes pour le calculateur de commission (depuis la config).
  const config = await window.api.configGet();
  const tauxTps = config?.documents?.tps_taux ?? 5;
  const tauxTvq = config?.documents?.tvq_taux ?? 9.975;

  // Cotes affichées : elles suivent les Réglages (même règle que la facture
  // artiste), pour ne jamais annoncer un pourcentage différent de celui facturé.
  const pct = (v) => String(v).replace('.', ',');
  const cotePeinture = coteGaleriePourType('peinture', config);
  const coteSculpture = coteGaleriePourType('sculpture', config);
  const coteRepro = coteGaleriePourType('reproduction', config);

  contenu.innerHTML = `
    <div class="vue-fiche outils-vue">
      <div class="reglages-entete">
        <h1>Outils</h1>
        <p class="reglages-entete-meta">Calculateurs liés au catalogue. Choisis un outil à gauche.</p>
      </div>

      <div class="reglages-layout">
        <nav class="cat-nav" id="outils-cat-nav" aria-label="Outils">
          <div class="cat-groupe">Liés au catalogue</div>
          <button type="button" class="cat-item actif" data-cat="prix">
            <span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V7a1 1 0 0 0-1-1h-5L3 12l6 6 11-6z"/><circle cx="16" cy="9.5" r="1"/></svg></span>
            Calculateur de prix
          </button>
          <button type="button" class="cat-item" data-cat="commission">
            <span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg></span>
            Calculateur de commission
          </button>
          <div class="cat-groupe">Calculatrices rapides</div>
          <button type="button" class="cat-item" data-cat="taxes">
            <span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/></svg></span>
            Taxes
          </button>
          <button type="button" class="cat-item" data-cat="conversion">
            <span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/></svg></span>
            Conversion
          </button>
          <button type="button" class="cat-item" data-cat="versements">
            <span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="16" y2="14"/><line x1="8" y1="17" x2="8" y2="17"/><line x1="12" y1="17" x2="16" y2="17"/></svg></span>
            Plan de versements
          </button>
          <button type="button" class="cat-item" data-cat="expedition">
            <span class="cat-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><line x1="12" y1="13" x2="12" y2="21"/></svg></span>
            Expédition (poids)
          </button>
        </nav>

        <div class="cat-zone">
        <section class="cat-panneau actif" data-cat="prix">
          <div class="panneau-tete"><h2>Calculateur de prix</h2><p class="desc">Le prix suggéré à partir des cotes de l'artiste et des dimensions de l'œuvre.</p></div>
          <div class="grille-bento">

        <div class="carte zone-outil-calc">
          <h3>Calculateur de prix</h3>
          <p class="aide-champ">Sélectionne un artiste et saisis les dimensions de l'œuvre. Le prix préférentiel (sans encadrement) et courant (encadré, +2 $/po linéaire) s'affichent automatiquement à partir des cotes.</p>

          <div class="grille-form">
            <div class="form-champ">
              <label for="calc-artiste">Artiste</label>
              <select id="calc-artiste">
                <option value="">— Sélectionner —</option>
                ${artistesTriees.map((a) => `<option value="${a.id}">${ech(a.nom)}</option>`).join('')}
              </select>
            </div>
            <div class="form-champ">
              <label for="calc-medium">Médium (optionnel)</label>
              <div class="select-edit-wrap" data-medium-wrap>
                <input type="text" id="calc-medium" placeholder="Acrylique, encaustique…" autocomplete="off">
                <button type="button" class="select-edit-toggle" aria-label="Voir les médiums" tabindex="-1">▾</button>
              </div>
            </div>
          </div>

          <div class="form-champ">
            <div class="dim-entete">
              <label>Dimensions</label>
              <div class="taille-vue" role="group" aria-label="Unité de mesure">
                <button type="button" data-unite="po" class="actif">pouces</button>
                <button type="button" data-unite="cm">cm</button>
              </div>
            </div>
            <div class="dim-trio">
              <div class="dim-champ">
                <input type="number" id="calc-hauteur" min="0" step="0.1" placeholder="0">
                <span class="dim-libelle">Hauteur</span>
              </div>
              <span class="dim-mult">×</span>
              <div class="dim-champ">
                <input type="number" id="calc-largeur" min="0" step="0.1" placeholder="0">
                <span class="dim-libelle">Largeur</span>
              </div>
              <span class="dim-unite" id="calc-dim-unite">pouces</span>
            </div>
          </div>

          <div class="form-champ">
            <label for="calc-taille">Taille utilisée pour la cote</label>
            <select id="calc-taille">
              <option value="">Automatique — d'après les dimensions</option>
              ${TAILLES_COTES.map((t) => `<option value="${ech(t)}">${ech(t)}</option>`).join('')}
            </select>
          </div>
          <p class="aide-champ calc-note-taille" id="calc-note-taille"></p>

          <div id="calc-resultat" class="calc-resultat"></div>
        </div>

        <div class="carte zone-outil-cotes">
          <h3>Cotes de l'artiste</h3>
          <p class="aide-champ" style="margin-top:0">Se mettent à jour avec l'artiste choisi dans le calculateur.</p>
          <div id="calc-cotes-artiste" class="calc-cotes-artiste"></div>
        </div>

          </div>
        </section>

        <section class="cat-panneau" data-cat="commission">
          <div class="panneau-tete"><h2>Calculateur de commission</h2><p class="desc">Le net versé à l'artiste après commission et taxes.</p></div>
          <div class="grille-bento">

        <div class="carte zone-outil-commission">
          <h3>Calculateur de commission</h3>
          <p class="aide-champ">Projette le montant versé à l'artiste pour une vente. Choisis le type d'œuvre (qui fixe la cote), entre le prix de vente, et coche les taxes que l'artiste perçoit.</p>

          <div class="grille-form">
            <div class="form-champ">
              <label for="comm-type">Type d'œuvre</label>
              <select id="comm-type">
                <option value="peinture">Peinture (${pct(cotePeinture)} %)</option>
                <option value="sculpture">Sculpture (${pct(coteSculpture)} %)</option>
                <option value="reproduction">Reproduction (${pct(coteRepro)} % après frais)</option>
                <option value="autre">Autre…</option>
              </select>
            </div>
            <div class="form-champ" id="comm-cote-champ" hidden>
              <label for="comm-cote">Cote de la galerie (%)</label>
              <input type="number" id="comm-cote" min="0" max="100" step="1" value="50">
            </div>
          </div>

          <div class="form-champ">
            <label for="comm-prix">Prix de vente ($)</label>
            <input type="number" id="comm-prix" min="0" step="1" placeholder="0">
          </div>

          <div class="form-champ" id="comm-frais-champ" hidden>
            <label for="comm-frais">Frais de production ($) <span class="aide-champ" style="font-weight:400;">— récupérés par la galerie avant le partage</span></label>
            <input type="number" id="comm-frais" min="0" step="1" placeholder="0" value="0">
          </div>

          <div class="form-champ">
            <label>Taxes perçues par l'artiste</label>
            <div class="comm-taxes">
              <label><input type="checkbox" id="comm-tps" checked> TPS (${ech(String(tauxTps).replace('.', ','))} %)</label>
              <label><input type="checkbox" id="comm-tvq" checked> TVQ (${ech(String(tauxTvq).replace('.', ','))} %)</label>
            </div>
          </div>

          <h4 class="sous-titre">Rabais (optionnels)</h4>
          <div class="grille-form">
            <div class="form-champ">
              <label for="comm-rab-art">Rabais artiste ($)</label>
              <input type="number" id="comm-rab-art" min="0" step="1" placeholder="0">
            </div>
            <div class="form-champ">
              <label for="comm-rab-gal">Rabais galerie ($)</label>
              <input type="number" id="comm-rab-gal" min="0" step="1" placeholder="0">
            </div>
          </div>

          <div id="comm-resultat" class="calc-resultat"></div>
        </div>

        <div class="carte zone-outil-commission-ref">
          <h3>Commissions par type</h3>
          <table class="cotes-table">
            <thead>
              <tr><th>Type d'œuvre</th><th>Cote galerie</th></tr>
            </thead>
            <tbody>
              <tr><td class="cote-cible">Peinture</td><td class="cote-prix">${pct(cotePeinture)} %</td></tr>
              <tr><td class="cote-cible">Sculpture</td><td class="cote-prix">${pct(coteSculpture)} %</td></tr>
              <tr><td class="cote-cible">Reproduction</td><td class="cote-prix">${pct(coteRepro)} %&nbsp;*</td></tr>
            </tbody>
          </table>
          <p class="aide-champ" style="margin-top:var(--s2);">* Pour une reproduction, la galerie récupère d'abord ses frais de production, puis applique la cote (${pct(coteRepro)} %) sur le reste. Les cotes suivent les Réglages ; la sculpture est fixée à ${pct(coteSculpture)} %.</p>
        </div>

          </div>
        </section>

        <section class="cat-panneau" data-cat="taxes">
          <div class="panneau-tete"><h2>Calculateur de taxes</h2><p class="desc">Ajouter ou retirer les taxes d'un montant, sans créer de vente.</p></div>
          <div class="grille-bento">

        <div class="carte zone-outil-taxes">
          <h3>Taxes</h3>
          <div class="form-champ">
            <label>Mode</label>
            <div class="taille-vue" id="tx-mode" role="group" aria-label="Mode de calcul">
              <button type="button" data-m="ajouter" class="actif">Ajouter les taxes</button>
              <button type="button" data-m="retirer">Retirer les taxes</button>
            </div>
          </div>
          <div class="form-champ">
            <label for="tx-prov">Province / territoire</label>
            <select id="tx-prov"></select>
          </div>
          <div class="form-champ">
            <label id="tx-lib" for="tx-montant">Montant avant taxes ($)</label>
            <input type="number" id="tx-montant" min="0" step="0.01" placeholder="0">
          </div>
          <div class="form-champ">
            <label>Taxes appliquées</label>
            <div class="comm-taxes" id="tx-cases"></div>
            <p class="aide-champ" id="tx-note" style="margin-top:6px;"></p>
          </div>
        </div>

        <div class="carte zone-outil-taxes-res">
          <h3>Résultat</h3>
          <div id="tx-resultat" class="calc-resultat"></div>
        </div>

          </div>
        </section>

        <section class="cat-panneau" data-cat="conversion">
          <div class="panneau-tete"><h2>Conversion</h2><p class="desc">Longueurs, poids et devises. Modifie un champ, l'autre suit.</p></div>
          <div class="grille-bento">

        <div class="carte zone-outil-conversion">
          <div class="form-champ">
            <div class="taille-vue" id="cv-onglets" role="group" aria-label="Type de conversion">
              <button type="button" data-t="longueur" class="actif">Longueur</button>
              <button type="button" data-t="poids">Poids</button>
              <button type="button" data-t="devise">Devise</button>
            </div>
          </div>

          <div class="conv-ligne">
            <div class="conv-champ"><input type="number" id="cv-a" step="any" placeholder="0"><select id="cv-ua"></select></div>
            <div class="conv-eq">=</div>
            <div class="conv-champ"><input type="number" id="cv-b" step="any" placeholder="0"><select id="cv-ub"></select></div>
          </div>

          <div id="cv-taux-bloc" class="conv-taux" hidden>
            <div class="comm-detail">
              <div class="ligne"><span class="lib">1 USD =</span><span class="montant"><input type="number" id="cv-taux-usd" step="any" class="conv-taux-input"> CAD</span></div>
              <div class="ligne"><span class="lib">1 EUR =</span><span class="montant"><input type="number" id="cv-taux-eur" step="any" class="conv-taux-input"> CAD</span></div>
              <div class="ligne sous"><span class="lib" id="cv-taux-source">—</span><span class="montant"><button type="button" class="btn-action btn-secondaire-action" id="cv-maj">Mettre à jour</button></span></div>
            </div>
            <p class="aide-champ">Récupérés à la Banque du Canada à l'ouverture si Internet est disponible. Hors-ligne, le dernier taux connu est utilisé. Tu peux corriger un taux à la main (pour ce calcul).</p>
          </div>
        </div>

          </div>
        </section>

        <section class="cat-panneau" data-cat="versements">
          <div class="panneau-tete"><h2>Plan de versements</h2><p class="desc">Un échéancier à proposer au client. Sans intérêt. Rien n'est enregistré.</p></div>
          <div class="grille-bento">

        <div class="carte zone-outil-vers-param">
          <h3>Paramètres</h3>
          <div class="form-champ">
            <label for="vs-total">Montant total ($)</label>
            <input type="number" id="vs-total" min="0" step="0.01" placeholder="0">
          </div>
          <div class="form-champ">
            <label for="vs-acompte">Acompte initial</label>
            <div class="vers-acompte-ligne">
              <input type="number" id="vs-acompte" min="0" step="0.01" placeholder="0">
              <div class="taille-vue" id="vs-acompte-mode" role="group" aria-label="Type d'acompte">
                <button type="button" data-u="montant" class="actif">$</button>
                <button type="button" data-u="pct">%</button>
              </div>
            </div>
          </div>
          <div class="form-champ">
            <label for="vs-nb">Nombre de versements</label>
            <input type="number" id="vs-nb" min="1" step="1" value="4">
          </div>
          <div class="form-champ">
            <label for="vs-freq">Fréquence</label>
            <select id="vs-freq">
              <option value="hebdo">Hebdomadaire</option>
              <option value="2sem">Aux deux semaines</option>
              <option value="mois" selected>Mensuelle</option>
            </select>
          </div>
          <div class="form-champ">
            <label for="vs-date">Date de départ</label>
            <input type="date" id="vs-date">
          </div>
        </div>

        <div class="carte zone-outil-vers-res">
          <div class="vers-res-entete">
            <h3>Échéancier</h3>
            <button type="button" class="btn-action btn-secondaire-action" id="vs-copier">Copier le tableau</button>
          </div>
          <div id="vs-resultat" class="calc-resultat"></div>
        </div>

          </div>
        </section>

        <section class="cat-panneau" data-cat="expedition">
          <div class="panneau-tete"><h2>Estimateur de poids d'expédition</h2><p class="desc">Un poids approximatif pour préparer un envoi.</p></div>
          <div class="grille-bento">

        <div class="carte zone-outil-exp-form">
          <h3>L'œuvre</h3>
          <div class="form-champ">
            <label for="ex-support">Support</label>
            <select id="ex-support"></select>
          </div>
          <div class="form-champ">
            <div class="dim-entete">
              <label>Dimensions</label>
              <div class="taille-vue" id="ex-unite" role="group" aria-label="Unité de mesure">
                <button type="button" data-u="po" class="actif">pouces</button>
                <button type="button" data-u="cm">cm</button>
              </div>
            </div>
            <div class="exp-dims">
              <div class="dim-champ"><input type="number" id="ex-h" min="0" step="0.1" placeholder="0"><span class="dim-libelle">Hauteur</span></div>
              <div class="dim-champ"><input type="number" id="ex-l" min="0" step="0.1" placeholder="0"><span class="dim-libelle">Largeur</span></div>
              <div class="dim-champ"><input type="number" id="ex-p" min="0" step="0.1" placeholder="0"><span class="dim-libelle">Profondeur</span></div>
            </div>
            <p class="aide-champ" id="ex-prof-note" style="margin-top:6px;">La profondeur ne sert qu'aux sculptures.</p>
          </div>
          <div class="form-champ">
            <label>Options</label>
            <div class="comm-taxes">
              <label><input type="checkbox" id="ex-cadre"> Encadré</label>
              <label><input type="checkbox" id="ex-verre"> Sous verre</label>
            </div>
          </div>
        </div>

        <div class="carte zone-outil-exp-res">
          <h3>Estimation</h3>
          <div id="ex-resultat" class="calc-resultat"></div>
          <p class="aide-champ attention-secours" style="margin-top: var(--s3);"><strong>Estimation à calibrer.</strong> Ces facteurs sont des points de départ, pas des pesées. Avant de fixer des frais d'envoi, pèse deux ou trois œuvres (une toile, une sculpture) et ajuste les facteurs.</p>
        </div>

          </div>
        </section>
        </div>
      </div>
    </div>
  `;

  // Navigation entre outils (un panneau à la fois) — même patron que les Réglages.
  const outilsNav = contenu.querySelector('#outils-cat-nav');
  const outilsItems = [...outilsNav.querySelectorAll('.cat-item')];
  const outilsPanneaux = [...contenu.querySelectorAll('.cat-panneau')];
  outilsNav.addEventListener('click', (e) => {
    const b = e.target.closest('.cat-item');
    if (!b) return;
    outilsItems.forEach((i) => i.classList.toggle('actif', i === b));
    outilsPanneaux.forEach((p) => p.classList.toggle('actif', p.dataset.cat === b.dataset.cat));
  });

  const selArtiste = contenu.querySelector('#calc-artiste');
  const inMedium = contenu.querySelector('#calc-medium');
  const inHauteur = contenu.querySelector('#calc-hauteur');
  const inLargeur = contenu.querySelector('#calc-largeur');
  const zoneResultat = contenu.querySelector('#calc-resultat');
  const zoneCotes = contenu.querySelector('#calc-cotes-artiste');
  const selTaille = contenu.querySelector('#calc-taille');
  const noteTaille = contenu.querySelector('#calc-note-taille');

  let artisteCharge = null;
  let mediumsArtisteCalc = [];
  const mediumsConnus = await chargerMediumsConnus();
  brancherDropdownMedium(contenu.querySelector('[data-medium-wrap]'), {
    getMediums: () => ({ mediumsArtiste: mediumsArtisteCalc, mediumsConnus }),
    inclureTous: false,
  });

  async function chargerArtiste(id) {
    if (!id) { artisteCharge = null; mediumsArtisteCalc = []; calculer(); return; }
    try {
      artisteCharge = await window.api.artisteGet(Number(id));
    } catch {
      artisteCharge = null;
    }
    try { mediumsArtisteCalc = await window.api.oeuvresMediumsArtiste(Number(id)); }
    catch { mediumsArtisteCalc = []; }
    calculer();
  }

  // coteRetenue : la cote effectivement appliquée, surlignée dans le tableau.
  function afficherCotesArtiste(coteRetenue = null) {
    if (!artisteCharge) {
      zoneCotes.innerHTML = `<p class="aide-champ" style="font-style:italic; margin:0;">Choisis un artiste pour voir ses cotes.</p>`;
      return;
    }
    const cotes = parserCotes(artisteCharge.cotes);
    if (!cotes.length) {
      zoneCotes.innerHTML = `<p class="aide-champ" style="margin:0;">Cet artiste n'a pas de cotes configurées. Va sur sa fiche pour les définir.</p>`;
      return;
    }
    zoneCotes.innerHTML = `
      <table class="cotes-table">
        <thead>
          <tr><th>Cible</th><th>Préférentiel</th><th>Unité</th></tr>
        </thead>
        <tbody>
          ${cotes.map((c) => {
            const uniteLib = c.unite === 'carre' ? '$/po²' : '$/po lin';
            const cible = (c.medium === 'Tous' && c.taille === 'Tous')
              ? 'Toutes œuvres'
              : `${ech(c.medium)}${c.taille !== 'Tous' ? ` &middot; ${ech(c.taille)}` : ''}`;
            const estRetenue = coteRetenue
              && c.medium === coteRetenue.medium && c.taille === coteRetenue.taille
              && c.unite === coteRetenue.unite && c.prix_pref === coteRetenue.prix_pref;
            return `<tr class="${estRetenue ? 'cote-retenue' : ''}"><td class="cote-cible">${cible}</td><td class="cote-prix">${c.prix_pref} $</td><td class="cote-unite">${uniteLib}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function calculer() {
    if (!artisteCharge) {
      zoneResultat.innerHTML = `<p class="aide-champ" style="font-style:italic;">Choisis un artiste pour démarrer.</p>`;
      noteTaille.textContent = '';
      afficherCotesArtiste();
      return;
    }
    const h = calcPo.h || 0;
    const l = calcPo.l || 0;
    // Le format vient de la règle partagée (calcul-prix.js), la même que la
    // fiche d'œuvre : √(H×L) avec les seuils 16/30/42. « Hors normes » n'en
    // sort jamais : c'est une cote d'exception, d'où le choix manuel ci-dessous.
    const tailleAuto = (h > 0 && l > 0) ? (calculerFormat(h, l) || 'Très grand') : '';
    const forcee = selTaille.value;
    const taille = forcee || tailleAuto;

    // Rappel de ce que le calcul aurait donné : on doit toujours voir qu'on force.
    if (forcee) {
      noteTaille.innerHTML = `Taille forcée à <strong>${ech(forcee)}</strong>`
        + (tailleAuto ? ` — le calcul aurait donné <strong>${ech(tailleAuto)}</strong>.` : '.');
    } else if (tailleAuto) {
      noteTaille.innerHTML = `Taille calculée : <strong>${ech(tailleAuto)}</strong> (√(${h} × ${l}) = ${Math.sqrt(h * l).toFixed(1)} po).`;
    } else {
      noteTaille.textContent = '';
    }

    if (h <= 0 || l <= 0) {
      zoneResultat.innerHTML = `<p class="aide-champ" style="font-style:italic;">Entre la hauteur et la largeur pour calculer.</p>`;
      afficherCotesArtiste();
      return;
    }
    const moyGeo = Math.sqrt(h * l);

    const oeuvreVirt = { hauteur: h, largeur: l, medium: inMedium.value.trim(), format: taille };
    const res = calculerPrixSuggere({ artiste: artisteCharge, oeuvre: oeuvreVirt });
    if (!res) {
      afficherCotesArtiste();
      zoneResultat.innerHTML = `
        <div class="prix-suggere prix-suggere-aucun">
          Aucune cote ne correspond pour la taille <strong>${ech(taille)}</strong>${forcee ? '' : ` (calculée à partir de √(${h} × ${l}) = ${moyGeo.toFixed(1)} po)`}.
        </div>
      `;
      return;
    }
    afficherCotesArtiste(res.cote);
    zoneResultat.innerHTML = `
      <div class="prix-suggere prix-suggere-actif">
        <div class="prix-suggere-entete">
          <span class="prix-suggere-libelle">Prix courant (encadré)</span>
          <span class="prix-suggere-valeur">${res.prix_courant.toLocaleString('fr-CA')} $</span>
        </div>
        <p class="prix-suggere-formule">Format : <strong>${ech(taille)}</strong> · Cote utilisée : ${ech(res.cote.medium)} / ${ech(res.cote.taille)} à ${res.cote.prix_pref} ${res.cote.unite === 'carre' ? '$/po²' : '$/po lin'}.</p>
        <p class="prix-suggere-formule">${ech(res.formule_preferentiel)}<br>${ech(res.formule_courant)}</p>
        <p class="prix-suggere-formule">Préférentiel (sans cadre) : <strong>${res.prix_preferentiel.toLocaleString('fr-CA')} $</strong></p>
      </div>
    `;
  }

  // ====== Unité de mesure (pouces ⇄ cm) ======
  // La source de vérité reste en pouces (calcPo) ; l'affichage est converti.
  // Le calcul du prix utilise toujours les pouces.
  const PO_EN_CM = 2.54;
  let uniteCalc = 'po';
  const arrondi2 = (n) => Math.round(n * 100) / 100;
  const calcPo = { h: null, l: null };
  const labelUniteCalc = contenu.querySelector('#calc-dim-unite');

  function lireSaisieCalc() {
    const f = uniteCalc === 'cm' ? PO_EN_CM : 1;
    const vh = parseFloat(inHauteur.value);
    const vl = parseFloat(inLargeur.value);
    calcPo.h = Number.isFinite(vh) ? vh / f : null;
    calcPo.l = Number.isFinite(vl) ? vl / f : null;
  }
  function afficherUniteCalc() {
    const f = uniteCalc === 'cm' ? PO_EN_CM : 1;
    inHauteur.value = calcPo.h != null ? arrondi2(calcPo.h * f) : '';
    inLargeur.value = calcPo.l != null ? arrondi2(calcPo.l * f) : '';
    if (labelUniteCalc) labelUniteCalc.textContent = uniteCalc === 'cm' ? 'cm' : 'pouces';
  }

  selArtiste.addEventListener('change', () => chargerArtiste(selArtiste.value));
  inMedium.addEventListener('input', calculer);
  selTaille.addEventListener('change', calculer);
  [inHauteur, inLargeur].forEach((el) => el.addEventListener('input', () => { lireSaisieCalc(); calculer(); }));
  contenu.querySelectorAll('[data-unite]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.unite === uniteCalc) return;
      contenu.querySelectorAll('[data-unite]').forEach((x) => x.classList.toggle('actif', x === b));
      uniteCalc = b.dataset.unite;
      afficherUniteCalc();
    });
  });

  afficherCotesArtiste();
  calculer();

  // ====== Calculateur de commission (net versé à l'artiste) ======
  // Mêmes formules que gabarit-facture-artiste.html. Reproduction : la galerie
  // récupère ses frais de production avant le partage du net.
  // La cote vient de la règle partagée (calcul-prix.js), miroir de celle qui
  // produit la facture artiste : sculpture 33 %, sinon la cote configurée dans
  // Réglages — pour que le montant annoncé ici soit celui qui sera facturé.
  const commType = contenu.querySelector('#comm-type');
  const commChampCote = contenu.querySelector('#comm-cote-champ');
  const commCote = contenu.querySelector('#comm-cote');
  const commPrix = contenu.querySelector('#comm-prix');
  const commChampFrais = contenu.querySelector('#comm-frais-champ');
  const commFrais = contenu.querySelector('#comm-frais');
  const commTps = contenu.querySelector('#comm-tps');
  const commTvq = contenu.querySelector('#comm-tvq');
  const commRabArt = contenu.querySelector('#comm-rab-art');
  const commRabGal = contenu.querySelector('#comm-rab-gal');
  const commRes = contenu.querySelector('#comm-resultat');

  const commNum = (x) => { const v = parseFloat(x); return Number.isFinite(v) ? v : 0; };
  const commMoney = (v) => {
    const s = (Math.round(v * 100) / 100).toFixed(2).split('.');
    return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + s[1] + ' $';
  };
  const commMoneyNeg = (v) => '−' + commMoney(v);
  const commRate = (v) => ('' + v).replace('.', ',');

  function commCoteEffective() {
    const type = commType.value;
    commChampCote.hidden = type !== 'autre';
    commChampFrais.hidden = type !== 'reproduction';
    if (type === 'autre') return commNum(commCote.value);
    return coteGaleriePourType(type, config);
  }

  function commCalculer() {
    const cote = commCoteEffective();
    const estRepro = commType.value === 'reproduction';
    const prixReg = commNum(commPrix.value);
    const rabArt = commNum(commRabArt.value);
    const rabGal = commNum(commRabGal.value);
    const frais = estRepro ? commNum(commFrais.value) : 0;

    if (prixReg <= 0) {
      commRes.innerHTML = `<p class="aide-champ" style="font-style:italic;">Entre un prix de vente pour calculer.</p>`;
      return;
    }

    const prixVente = prixReg - rabArt - rabGal;
    const net = prixVente - frais;            // base de partage (= prixVente hors repro)
    const commission = net * cote / 100;      // commission de la galerie
    const part = net - commission;            // part de l'artiste (frais non remboursés)
    const galerieGarde = frais + commission;  // la galerie récupère frais + commission
    const mTps = commTps.checked ? part * tauxTps / 100 : 0;
    const mTvq = commTvq.checked ? part * tauxTvq / 100 : 0;
    const total = part + mTps + mTvq;

    const lignes = [];
    lignes.push(`<div class="ligne"><span class="lib">Prix de vente</span><span class="montant">${commMoney(prixReg)}</span></div>`);
    if (rabArt > 0) lignes.push(`<div class="ligne muted"><span class="lib">Rabais artiste</span><span class="montant">${commMoneyNeg(rabArt)}</span></div>`);
    if (rabGal > 0) lignes.push(`<div class="ligne muted"><span class="lib">Rabais galerie</span><span class="montant">${commMoneyNeg(rabGal)}</span></div>`);
    if (rabArt > 0 || rabGal > 0) lignes.push(`<div class="ligne sous"><span class="lib">Sous-total</span><span class="montant">${commMoney(prixVente)}</span></div>`);
    if (estRepro && frais > 0) {
      lignes.push(`<div class="ligne muted"><span class="lib">Frais de production (à la galerie)</span><span class="montant">${commMoneyNeg(frais)}</span></div>`);
      lignes.push(`<div class="ligne sous"><span class="lib">Net à partager</span><span class="montant">${commMoney(net)}</span></div>`);
    }
    lignes.push(`<div class="ligne muted"><span class="lib">Commission galerie (${commRate(cote)} %)</span><span class="montant">${commMoneyNeg(commission)}</span></div>`);
    lignes.push(`<div class="ligne sous"><span class="lib">Part de l'artiste</span><span class="montant">${commMoney(part)}</span></div>`);
    if (commTps.checked) lignes.push(`<div class="ligne"><span class="lib">TPS (${commRate(tauxTps)} %)</span><span class="montant">${commMoney(mTps)}</span></div>`);
    if (commTvq.checked) lignes.push(`<div class="ligne"><span class="lib">TVQ (${commRate(tauxTvq)} %)</span><span class="montant">${commMoney(mTvq)}</span></div>`);
    lignes.push(`<div class="ligne total"><span class="lib">Montant versé à l'artiste</span><span class="montant">${commMoney(total)}</span></div>`);

    const sousTaxe = (mTps + mTvq) > 0 ? `<small>dont ${commMoney(mTps + mTvq)} de taxes</small>` : '';
    const noteGalerie = (estRepro && frais > 0)
      ? `La galerie récupère <strong>${commMoney(frais)}</strong> de frais + <strong>${commMoney(commission)}</strong> de commission = <strong>${commMoney(galerieGarde)}</strong>.`
      : `La galerie conserve <strong>${commMoney(commission)}</strong> de commission (${commRate(cote)} % du prix de vente).`;

    commRes.innerHTML = `
      <div class="comm-tuile">
        <span class="comm-tuile-lib">Montant versé à l'artiste</span>
        <span class="comm-tuile-val">${commMoney(total)}${sousTaxe}</span>
      </div>
      <div class="comm-detail">${lignes.join('')}</div>
      <p class="comm-note">${noteGalerie}</p>
    `;
  }

  commType.addEventListener('change', commCalculer);
  [commCote, commPrix, commFrais, commRabArt, commRabGal].forEach((el) => el.addEventListener('input', commCalculer));
  [commTps, commTvq].forEach((el) => el.addEventListener('change', commCalculer));
  commCalculer();

  // ====== Calculateur de taxes (ajouter / retirer) ======
  // Québec = taux TPS/TVQ des Réglages ; autres provinces = table de la config
  // (taux indicatifs, à valider avec le comptable). Même arrondi que la facture
  // artiste (commMoney), pour ne pas créer d'écart entre les outils.
  const txProvincesConfig = config?.outils?.taxes_provinces || {};
  const TAXES_PROVINCES = {
    QC: { nom: 'Québec', config: true, taxes: [{ c: 'TPS', t: tauxTps }, { c: 'TVQ', t: tauxTvq }] },
  };
  for (const [code, p] of Object.entries(txProvincesConfig)) {
    if (!p || !p.taxes) continue;
    TAXES_PROVINCES[code] = { nom: p.nom || code, taxes: Object.entries(p.taxes).map(([c, t]) => ({ c, t: Number(t) || 0 })) };
  }

  let txMode = 'ajouter';
  const txMontant = contenu.querySelector('#tx-montant');
  const txProv = contenu.querySelector('#tx-prov');
  const txCases = contenu.querySelector('#tx-cases');
  const txNote = contenu.querySelector('#tx-note');
  const txLib = contenu.querySelector('#tx-lib');
  const txRes = contenu.querySelector('#tx-resultat');

  txProv.innerHTML = Object.entries(TAXES_PROVINCES)
    .map(([k, p]) => `<option value="${k}">${ech(p.nom)}</option>`).join('');

  function txRendreCases() {
    const p = TAXES_PROVINCES[txProv.value];
    txCases.innerHTML = p.taxes
      .map((tx, i) => `<label><input type="checkbox" data-i="${i}" checked> ${ech(tx.c)} (${commRate(tx.t)} %)</label>`)
      .join('');
    txCases.querySelectorAll('input').forEach((el) => el.addEventListener('change', txCalculer));
    txNote.textContent = p.config
      ? 'Taux TPS/TVQ des Réglages.'
      : 'Taux indicatifs — à valider avec le comptable.';
  }

  function txCalculer() {
    const p = TAXES_PROVINCES[txProv.value];
    const m = commNum(txMontant.value);
    if (m <= 0) {
      txRes.innerHTML = `<p class="aide-champ" style="font-style:italic;">Entre un montant pour calculer.</p>`;
      return;
    }
    const actives = p.taxes.filter((tx, i) => {
      const c = txCases.querySelector(`input[data-i="${i}"]`);
      return c && c.checked;
    });
    const tauxTotal = actives.reduce((s, tx) => s + tx.t, 0);
    const base = txMode === 'ajouter' ? m : m / (1 + tauxTotal / 100);
    let total = base;
    const lignes = [`<div class="ligne"><span class="lib">Sous-total</span><span class="montant">${commMoney(base)}</span></div>`];
    for (const tx of actives) {
      const mt = base * tx.t / 100;
      total += mt;
      lignes.push(`<div class="ligne"><span class="lib">${ech(tx.c)} (${commRate(tx.t)} %)</span><span class="montant">${commMoney(mt)}</span></div>`);
    }
    lignes.push(`<div class="ligne total"><span class="lib">Total</span><span class="montant">${commMoney(total)}</span></div>`);
    txRes.innerHTML = `<div class="comm-detail">${lignes.join('')}</div>`;
  }

  contenu.querySelector('#tx-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    txMode = b.dataset.m;
    contenu.querySelectorAll('#tx-mode button').forEach((x) => x.classList.toggle('actif', x === b));
    txLib.textContent = txMode === 'ajouter' ? 'Montant avant taxes ($)' : 'Montant total, taxes incluses ($)';
    txCalculer();
  });
  txProv.addEventListener('change', () => { txRendreCases(); txCalculer(); });
  txMontant.addEventListener('input', txCalculer);
  txRendreCases();
  txCalculer();

  // ====== Convertisseur (longueur, poids, devise) ======
  // Devise : taux Banque du Canada récupérés à l'ouverture de l'onglet (meilleur
  // effort), mémorisés pour le repli hors-ligne. Correction à la main possible.
  const CONV = {
    longueur: { u: { po: 0.0254, cm: 0.01, pi: 0.3048, m: 1 }, lib: { po: 'po', cm: 'cm', pi: 'pi', m: 'm' }, defA: 'po', defB: 'cm' },
    poids:    { u: { lb: 453.592, kg: 1000, oz: 28.3495, g: 1 }, lib: { lb: 'lb', kg: 'kg', oz: 'oz', g: 'g' }, defA: 'lb', defB: 'kg' },
    devise:   { lib: { CAD: 'CAD', USD: 'USD', EUR: 'EUR' }, defA: 'CAD', defB: 'USD', devise: true },
  };
  let cvT = 'longueur';
  let cvDeviseCharge = false;
  const cvA = contenu.querySelector('#cv-a');
  const cvB = contenu.querySelector('#cv-b');
  const cvSA = contenu.querySelector('#cv-ua');
  const cvSB = contenu.querySelector('#cv-ub');
  const cvBloc = contenu.querySelector('#cv-taux-bloc');
  const cvTauxUsd = contenu.querySelector('#cv-taux-usd');
  const cvTauxEur = contenu.querySelector('#cv-taux-eur');
  const cvSource = contenu.querySelector('#cv-taux-source');

  const cfgOutils = config?.outils || {};
  cvTauxUsd.value = Number(cfgOutils.taux_change_usd_cad) || 1.38;
  cvTauxEur.value = Number(cfgOutils.taux_change_eur_cad) || 1.48;

  function cvFormaterSource(maj, horsLigne) {
    if (!maj) return horsLigne ? 'Valeur enregistrée (hors ligne)' : 'Valeur par défaut';
    let d = maj;
    try { d = new Date(maj + 'T00:00:00').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { /* garde la date brute */ }
    return `Banque du Canada · ${d}${horsLigne ? ' (hors ligne)' : ''}`;
  }
  cvSource.textContent = cvFormaterSource(cfgOutils.taux_change_maj, false);

  function cvFacteur(t, u) {
    if (t === 'devise') {
      const map = { CAD: 1, USD: commNum(cvTauxUsd.value) || 1.38, EUR: commNum(cvTauxEur.value) || 1.48 };
      return map[u];
    }
    return CONV[t].u[u];
  }
  function cvRemplirSelect(sel, t, val) {
    const o = CONV[t];
    sel.innerHTML = Object.keys(o.lib).map((k) => `<option value="${k}">${o.lib[k]}</option>`).join('');
    sel.value = val;
  }
  function cvConvertir(src) {
    const t = cvT, fa = cvFacteur(t, cvSA.value), fb = cvFacteur(t, cvSB.value);
    if (!fa || !fb) return;
    if (src === 'a') { const v = parseFloat(cvA.value); cvB.value = Number.isFinite(v) ? +(v * fa / fb).toFixed(4) : ''; }
    else { const v = parseFloat(cvB.value); cvA.value = Number.isFinite(v) ? +(v * fb / fa).toFixed(4) : ''; }
  }
  async function cvRafraichirTaux() {
    cvSource.textContent = 'Récupération à la Banque du Canada…';
    try {
      const r = await window.api.outilsTauxChangeRecuperer();
      if (r && Number.isFinite(Number(r.usd))) cvTauxUsd.value = Number(r.usd);
      if (r && Number.isFinite(Number(r.eur))) cvTauxEur.value = Number(r.eur);
      cvSource.textContent = cvFormaterSource(r && r.maj, !(r && r.ok));
    } catch {
      cvSource.textContent = cvFormaterSource(cfgOutils.taux_change_maj, true);
    }
    cvConvertir('a');
  }
  function cvSetOnglet(t) {
    cvT = t;
    const o = CONV[t];
    cvRemplirSelect(cvSA, t, o.defA);
    cvRemplirSelect(cvSB, t, o.defB);
    cvBloc.hidden = !o.devise;
    cvA.value = ''; cvB.value = '';
    if (o.devise && !cvDeviseCharge) { cvDeviseCharge = true; cvRafraichirTaux(); }
  }
  contenu.querySelector('#cv-onglets').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    contenu.querySelectorAll('#cv-onglets button').forEach((x) => x.classList.toggle('actif', x === b));
    cvSetOnglet(b.dataset.t);
  });
  cvA.addEventListener('input', () => cvConvertir('a'));
  cvB.addEventListener('input', () => cvConvertir('b'));
  cvSA.addEventListener('change', () => cvConvertir('a'));
  cvSB.addEventListener('change', () => cvConvertir('a'));
  [cvTauxUsd, cvTauxEur].forEach((el) => el.addEventListener('input', () => cvConvertir('a')));
  contenu.querySelector('#cv-maj').addEventListener('click', () => cvRafraichirTaux());
  cvSetOnglet('longueur');

  // ====== Plan de versements (échéancier, sans intérêt) ======
  // Purement affichage : aucune écriture en base, aucun PDF. Le dernier versement
  // absorbe l'écart d'arrondi pour que la somme soit exacte au cent près.
  let vsAcompteMode = 'montant';
  const vsTotal = contenu.querySelector('#vs-total');
  const vsAcompte = contenu.querySelector('#vs-acompte');
  const vsNb = contenu.querySelector('#vs-nb');
  const vsFreq = contenu.querySelector('#vs-freq');
  const vsDate = contenu.querySelector('#vs-date');
  const vsRes = contenu.querySelector('#vs-resultat');
  let vsLignesTexte = [];

  // Date de départ par défaut : aujourd'hui.
  (function vsInitDate() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    vsDate.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  function vsAjouterPeriode(d, freq, i) {
    const r = new Date(d.getTime());
    if (freq === 'hebdo') r.setDate(r.getDate() + 7 * i);
    else if (freq === '2sem') r.setDate(r.getDate() + 14 * i);
    else r.setMonth(r.getMonth() + i);
    return r;
  }
  function vsFmtDate(d) {
    return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function vsCalculer() {
    const total = commNum(vsTotal.value);
    if (total <= 0) {
      vsRes.innerHTML = `<p class="aide-champ" style="font-style:italic;">Entre le montant total pour calculer.</p>`;
      vsLignesTexte = [];
      return;
    }
    let acompte = commNum(vsAcompte.value);
    if (vsAcompteMode === 'pct') acompte = total * acompte / 100;
    acompte = Math.min(Math.max(acompte, 0), total);
    const nb = Math.max(1, Math.round(commNum(vsNb.value) || 1));
    const solde = total - acompte;
    const base = Math.floor((solde / nb) * 100) / 100;   // arrondi au cent inférieur
    const d0 = vsDate.value ? new Date(vsDate.value + 'T00:00:00') : new Date();

    const rangs = [];
    if (acompte > 0) rangs.push({ nom: 'Acompte', date: d0, montant: acompte });
    for (let i = 0; i < nb; i++) {
      // Le dernier versement prend l'écart d'arrondi pour tomber juste au cent.
      const montant = i === nb - 1 ? Math.round((solde - base * (nb - 1)) * 100) / 100 : base;
      rangs.push({ nom: `Versement ${i + 1}`, date: vsAjouterPeriode(d0, vsFreq.value, i + 1), montant });
    }
    const somme = rangs.reduce((s, r) => s + r.montant, 0);

    const lignes = rangs.map((r) =>
      `<div class="ligne"><span class="lib">${ech(r.nom)} · ${ech(vsFmtDate(r.date))}</span><span class="montant">${commMoney(r.montant)}</span></div>`
    );
    lignes.push(`<div class="ligne total"><span class="lib">Total</span><span class="montant">${commMoney(somme)}</span></div>`);
    vsRes.innerHTML = `<div class="comm-detail">${lignes.join('')}</div>`;

    vsLignesTexte = rangs.map((r) => `${r.nom}\t${vsFmtDate(r.date)}\t${commMoney(r.montant)}`);
    vsLignesTexte.push(`Total\t\t${commMoney(somme)}`);
  }

  contenu.querySelector('#vs-acompte-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    vsAcompteMode = b.dataset.u;
    contenu.querySelectorAll('#vs-acompte-mode button').forEach((x) => x.classList.toggle('actif', x === b));
    vsCalculer();
  });
  [vsTotal, vsAcompte, vsNb, vsDate].forEach((el) => el.addEventListener('input', vsCalculer));
  vsFreq.addEventListener('change', vsCalculer);
  contenu.querySelector('#vs-copier').addEventListener('click', async () => {
    if (!vsLignesTexte.length) return;
    const b = contenu.querySelector('#vs-copier');
    try {
      await window.api.outilsCopierTexte(vsLignesTexte.join('\n'));
      const t = b.textContent; b.textContent = 'Copié ✓';
      setTimeout(() => { b.textContent = t; }, 1500);
    } catch { /* silencieux : le presse-papier n'est pas critique */ }
  });
  vsCalculer();

  // ====== Estimateur de poids d'expédition ======
  // Facteurs depuis la config (calibrables). surface = lb/pi² ; volume = lb/pi³.
  // Estimation volontairement approximative — l'avertissement le rappelle.
  const cfgExp = (config && config.outils && config.outils.expedition) || {};
  const EXP_SUPPORTS = cfgExp.supports || {};
  const EXP_CADRE = Number(cfgExp.facteur_cadre) || 0.3;
  const EXP_VERRE = Number(cfgExp.facteur_verre) || 3.5;
  const EXP_EMB_PCT = Number(cfgExp.emballage_pourcent) || 20;
  const EXP_EMB_MIN = Number(cfgExp.emballage_minimum) || 2;

  let exUnite = 'po';
  const exSupport = contenu.querySelector('#ex-support');
  const exH = contenu.querySelector('#ex-h');
  const exL = contenu.querySelector('#ex-l');
  const exP = contenu.querySelector('#ex-p');
  const exCadre = contenu.querySelector('#ex-cadre');
  const exVerre = contenu.querySelector('#ex-verre');
  const exRes = contenu.querySelector('#ex-resultat');
  const exProfNote = contenu.querySelector('#ex-prof-note');

  exSupport.innerHTML = Object.entries(EXP_SUPPORTS)
    .map(([k, s]) => `<option value="${k}">${ech(s.nom || k)}</option>`).join('');

  const exLb = (v) => `${v.toFixed(1).replace('.', ',')} lb`;
  const exKg = (v) => `${(v * 0.453592).toFixed(1).replace('.', ',')} kg`;

  function exCalculer() {
    const s = EXP_SUPPORTS[exSupport.value];
    const estVolume = s && s.type === 'volume';
    exProfNote.textContent = estVolume
      ? 'La profondeur est nécessaire pour cette sculpture.'
      : 'La profondeur ne sert qu\'aux sculptures.';
    const k = exUnite === 'cm' ? 1 / 2.54 : 1;
    const h = commNum(exH.value) * k, l = commNum(exL.value) * k, p = commNum(exP.value) * k;
    if (!s || h <= 0 || l <= 0) {
      exRes.innerHTML = `<p class="aide-champ" style="font-style:italic;">Entre au moins la hauteur et la largeur.</p>`;
      return;
    }
    if (estVolume && p <= 0) {
      exRes.innerHTML = `<p class="aide-champ" style="font-style:italic;">Pour une sculpture, entre aussi la profondeur.</p>`;
      return;
    }
    const surface = (h * l) / 144;          // pi²
    const volume = (h * l * p) / 1728;      // pi³
    const perimetre = 2 * (h + l) / 12;     // pieds linéaires
    const facteur = Number(s.facteur) || 0;
    let oeuvre = estVolume ? volume * facteur : surface * facteur;
    if (exCadre.checked) oeuvre += perimetre * EXP_CADRE;
    if (exVerre.checked) oeuvre += surface * EXP_VERRE;
    const emballage = Math.max(EXP_EMB_MIN, oeuvre * EXP_EMB_PCT / 100);
    const envoi = oeuvre + emballage;

    exRes.innerHTML = `<div class="comm-detail">
      <div class="ligne"><span class="lib">Poids de l'œuvre</span><span class="montant">${exLb(oeuvre)} · ${exKg(oeuvre)}</span></div>
      <div class="ligne"><span class="lib">Emballage estimé (${commRate(EXP_EMB_PCT)} %, min. ${exLb(EXP_EMB_MIN)})</span><span class="montant">${exLb(emballage)}</span></div>
      <div class="ligne total"><span class="lib">Poids d'expédition</span><span class="montant">${exLb(envoi)} · ${exKg(envoi)}</span></div>
    </div>`;
  }

  exSupport.addEventListener('change', exCalculer);
  [exH, exL, exP].forEach((el) => el.addEventListener('input', exCalculer));
  [exCadre, exVerre].forEach((el) => el.addEventListener('change', exCalculer));
  contenu.querySelectorAll('#ex-unite button').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.u === exUnite) return;
      contenu.querySelectorAll('#ex-unite button').forEach((x) => x.classList.toggle('actif', x === b));
      exUnite = b.dataset.u;
      exCalculer();
    });
  });
  exCalculer();
}
