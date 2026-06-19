import { ech, sansAccents, nomComplet, brancherDropdownMedium, chargerMediumsConnus } from '../commun.js';
import { calculerPrixSuggere, parserCotes, TAILLES_COTES } from '../calcul-prix.js';

export async function rendreOutils(contenu) {
  const artistes = await window.api.artistesListe({ inclureArchives: false });
  const artistesTriees = artistes
    .map((a) => ({ id: a.id, nom: nomComplet(a) || a.nom || '' }))
    .sort((a, b) => sansAccents(a.nom).localeCompare(sansAccents(b.nom)));

  // Taux de taxes pour le calculateur de commission (depuis la config).
  const config = await window.api.configGet();
  const tauxTps = config?.documents?.tps_taux ?? 5;
  const tauxTvq = config?.documents?.tvq_taux ?? 9.975;

  contenu.innerHTML = `
    <div class="vue-fiche vue-fiche-bento">
      <div class="reglages-entete">
        <h1>Outils</h1>
        <p class="reglages-entete-meta">Calculateurs et utilitaires liés au catalogue.</p>
      </div>

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

          <div id="calc-resultat" class="calc-resultat"></div>
        </div>

        <div class="carte zone-outil-cotes">
          <h3>Cotes de l'artiste</h3>
          <div id="calc-cotes-artiste" class="calc-cotes-artiste"></div>
        </div>

        <div class="carte zone-outil-commission">
          <h3>Calculateur de commission</h3>
          <p class="aide-champ">Projette le montant versé à l'artiste pour une vente. Choisis le type d'œuvre (qui fixe la cote), entre le prix de vente, et coche les taxes que l'artiste perçoit.</p>

          <div class="grille-form">
            <div class="form-champ">
              <label for="comm-type">Type d'œuvre</label>
              <select id="comm-type">
                <option value="peinture">Peinture (50 %)</option>
                <option value="sculpture">Sculpture (33 %)</option>
                <option value="reproduction">Reproduction (50 % après frais)</option>
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
              <tr><td class="cote-cible">Peinture</td><td class="cote-prix">50 %</td></tr>
              <tr><td class="cote-cible">Sculpture</td><td class="cote-prix">33 %</td></tr>
              <tr><td class="cote-cible">Reproduction</td><td class="cote-prix">50 %&nbsp;*</td></tr>
            </tbody>
          </table>
          <p class="aide-champ" style="margin-top:var(--s2);">* Pour une reproduction, la galerie récupère d'abord ses frais de production, puis partage le reste 50/50 avec l'artiste.</p>
        </div>

      </div>
    </div>
  `;

  const selArtiste = contenu.querySelector('#calc-artiste');
  const inMedium = contenu.querySelector('#calc-medium');
  const inHauteur = contenu.querySelector('#calc-hauteur');
  const inLargeur = contenu.querySelector('#calc-largeur');
  const zoneResultat = contenu.querySelector('#calc-resultat');
  const zoneCotes = contenu.querySelector('#calc-cotes-artiste');

  let artisteCharge = null;
  let mediumsArtisteCalc = [];
  const mediumsConnus = await chargerMediumsConnus();
  brancherDropdownMedium(contenu.querySelector('[data-medium-wrap]'), {
    getMediums: () => ({ mediumsArtiste: mediumsArtisteCalc, mediumsConnus }),
    inclureTous: false,
  });

  async function chargerArtiste(id) {
    if (!id) { artisteCharge = null; mediumsArtisteCalc = []; afficherCotesArtiste(); calculer(); return; }
    try {
      artisteCharge = await window.api.artisteGet(Number(id));
    } catch {
      artisteCharge = null;
    }
    try { mediumsArtisteCalc = await window.api.oeuvresMediumsArtiste(Number(id)); }
    catch { mediumsArtisteCalc = []; }
    afficherCotesArtiste();
    calculer();
  }

  function afficherCotesArtiste() {
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
            return `<tr><td class="cote-cible">${cible}</td><td class="cote-prix">${c.prix_pref} $</td><td class="cote-unite">${uniteLib}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function calculer() {
    if (!artisteCharge) {
      zoneResultat.innerHTML = `<p class="aide-champ" style="font-style:italic;">Choisis un artiste pour démarrer.</p>`;
      return;
    }
    const h = calcPo.h || 0;
    const l = calcPo.l || 0;
    if (h <= 0 || l <= 0) {
      zoneResultat.innerHTML = `<p class="aide-champ" style="font-style:italic;">Entre la hauteur et la largeur pour calculer.</p>`;
      return;
    }
    // On calcule directement à partir des cotes en simulant une œuvre.
    // Pour récupérer la « taille » (format), on utilise la même logique
    // que calculerFormat dans oeuvre-fiche : √(H×L), seuils 16/30/42.
    const moyGeo = Math.sqrt(h * l);
    let taille = 'Très grand';
    if (moyGeo <= 16) taille = 'Petit';
    else if (moyGeo <= 30) taille = 'Moyen';
    else if (moyGeo <= 42) taille = 'Grand';

    const oeuvreVirt = { hauteur: h, largeur: l, medium: inMedium.value.trim(), format: taille };
    const res = calculerPrixSuggere({ artiste: artisteCharge, oeuvre: oeuvreVirt });
    if (!res) {
      zoneResultat.innerHTML = `
        <div class="prix-suggere prix-suggere-aucun">
          Aucune cote ne correspond. Format calculé : <strong>${taille}</strong> (à partir de √(${h} × ${l}) = ${moyGeo.toFixed(1)} po).
        </div>
      `;
      return;
    }
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
  // récupère ses frais de production avant le partage 50/50 du net.
  const COMM_COTE_DEFAUT = { peinture: 50, sculpture: 33, reproduction: 50 };
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
    return COMM_COTE_DEFAUT[type] ?? 50;
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
}
