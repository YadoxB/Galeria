import { ech, sansAccents, nomComplet, brancherDropdownMedium, chargerMediumsConnus } from '../commun.js';
import { calculerPrixSuggere, parserCotes, TAILLES_COTES } from '../calcul-prix.js';

export async function rendreOutils(contenu) {
  const artistes = await window.api.artistesListe({ inclureArchives: false });
  const artistesTriees = artistes
    .map((a) => ({ id: a.id, nom: nomComplet(a) || a.nom || '' }))
    .sort((a, b) => sansAccents(a.nom).localeCompare(sansAccents(b.nom)));

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
}
