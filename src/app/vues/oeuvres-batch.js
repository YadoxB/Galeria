// Éditeur « Édition en lot » des œuvres : tableur multi-lignes + remplissage
// groupé sur une sélection. Monté dans un hôte par oeuvres-liste.js.
// Validé d'abord en démo standalone : demos/edition-batch.html.
import { ech, sansAccents, STATUTS, pluriel } from '../commun.js';
import { confirmer, alerter } from '../dialogue.js';

// Colonnes du tableur. `col` = nom de colonne en base (= data-champ, = clé du
// payload). `groupe` null = colonne d'ancrage toujours visible.
const COLONNES = [
  { col: 'numero_inventaire', th: 'N° inventaire', kind: 'text', groupe: null, w: 'w-inv' },
  { col: 'titre',             th: 'Titre',         kind: 'text', groupe: null, w: 'w-titre' },
  { col: 'annee',             th: 'Année',         kind: 'num',  groupe: 'ident', w: 'w-annee' },
  { col: 'type',              th: 'Type',          kind: 'text', groupe: 'ident', w: 'w-type', liste: 'dl-type' },
  { col: 'medium',            th: 'Médium',        kind: 'text', groupe: 'mat', w: 'w-medium', liste: 'dl-medium' },
  { col: 'support',           th: 'Support',       kind: 'text', groupe: 'mat', w: 'w-support', liste: 'dl-support' },
  { col: 'hauteur',           th: 'H', titreInfo: 'Hauteur (po)', kind: 'num', groupe: 'mat', w: 'w-dim' },
  { col: 'largeur',           th: 'L', titreInfo: 'Largeur (po)', kind: 'num', groupe: 'mat', w: 'w-dim' },
  { col: 'profondeur',        th: 'P', titreInfo: 'Profondeur (po)', kind: 'num', groupe: 'mat', w: 'w-dim' },
  { col: 'prix',              th: 'Prix',          kind: 'num',  groupe: 'com', w: 'w-prix' },
  { col: 'statut',            th: 'Statut',        kind: 'statut', groupe: 'com', w: 'w-statut' },
  { col: 'emplacement',       th: 'Emplacement',   kind: 'text', groupe: 'loc', w: 'w-empl', liste: 'dl-empl' },
  { col: 'exposition_actuelle', th: 'Exposition',  kind: 'text', groupe: 'loc', w: 'w-expo', liste: 'dl-expo' },
  { col: 'style',             th: 'Style',         kind: 'text', groupe: 'loc', w: 'w-style', liste: 'dl-style' },
];

// Champs proposés au remplissage groupé (« appliquer à la sélection »).
const CHAMPS_BATCH = [
  { col: 'statut', lbl: 'Statut' },
  { col: 'type', lbl: "Type d'œuvre" },
  { col: 'medium', lbl: 'Médium' },
  { col: 'support', lbl: 'Support' },
  { col: 'annee', lbl: 'Année' },
  { col: 'prix', lbl: 'Prix ($)' },
  { col: 'emplacement', lbl: 'Emplacement' },
  { col: 'exposition_actuelle', lbl: 'Exposition actuelle' },
  { col: 'style', lbl: 'Style' },
];

const GROUPES = [
  { id: 'ident', lbl: 'Identité' },
  { id: 'mat', lbl: 'Matériel' },
  { id: 'com', lbl: 'Commerce' },
  { id: 'loc', lbl: 'Localisation' },
];

// Normalise pour comparer la valeur saisie à l'originale.
function memeValeur(a, b) {
  const na = a == null ? '' : String(a);
  const nb = b == null ? '' : String(b);
  return na === nb;
}

export function monterEditeurLot({ hote, oeuvres, types = [], surFermer }) {
  const lignes = oeuvres.map((o) => ({ ...o }));
  const modifs = new Map();      // id -> { col: nouvelleValeur }
  const selection = new Set();   // ids cochés
  const groupesActifs = new Set(['ident', 'mat', 'com', 'loc']);
  let filtre = '';

  const distinct = (col) => [...new Set(lignes.map((o) => o[col]).filter(Boolean))]
    .sort((a, b) => sansAccents(String(a)).localeCompare(sansAccents(String(b))));
  const datalists = {
    'dl-type':   [...new Set([...(types || []), ...distinct('type')])],
    'dl-medium': distinct('medium'),
    'dl-support': distinct('support'),
    'dl-empl':   distinct('emplacement'),
    'dl-expo':   distinct('exposition_actuelle'),
    'dl-style':  distinct('style'),
  };

  const valCourante = (o, col) => {
    const m = modifs.get(o.id);
    return (m && col in m) ? m[col] : o[col];
  };
  const estMod = (id, col) => { const m = modifs.get(id); return !!(m && col in m); };

  // ===== Squelette =====
  hote.innerHTML = `
    <div class="editeur-lot">
      <div class="lot-entete">
        <div class="lot-titre-bloc">
          <h2>Édition en lot</h2>
          <p class="lot-sous-titre">Modifie plusieurs œuvres d'un coup. Rien n'est enregistré tant que tu ne cliques pas sur « Enregistrer tout ».</p>
        </div>
        <div class="lot-recherche">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="lot-filtre" type="search" placeholder="Filtrer : titre, artiste, n° d'inventaire…" autocomplete="off">
        </div>
        <button type="button" class="btn-action btn-secondaire-action" id="lot-quitter">Quitter l'édition en lot</button>
      </div>

      <div class="lot-barre-outils">
        <div class="lot-groupes">
          <span class="lot-etiq">Colonnes</span>
          ${GROUPES.map((g) => `<button type="button" class="lot-chip g-${g.id} actif" data-groupe="${g.id}"><span class="pastille"></span>${ech(g.lbl)}</button>`).join('')}
        </div>
        <div class="lot-nb"><strong id="lot-nb-affiche">0</strong> œuvre(s) affichée(s)</div>
      </div>

      <div class="lot-bandeau" id="lot-bandeau">
        <span class="lot-nb-sel"><span class="puce" id="lot-puce">0</span> sélectionnée(s)</span>
        <span class="lot-sep"></span>
        <label class="lot-mini">Champ</label>
        <select id="lot-champ">${CHAMPS_BATCH.map((c) => `<option value="${c.col}">${ech(c.lbl)}</option>`).join('')}</select>
        <label class="lot-mini">Valeur</label>
        <span id="lot-zone-valeur"></span>
        <button type="button" class="btn-action btn-principal" id="lot-appliquer">Appliquer à la sélection</button>
        <button type="button" class="btn-lien lot-deselect" id="lot-deselect">Tout désélectionner</button>
      </div>

      <div class="lot-cadre">
        <div class="lot-defil">
          <table class="lot-grille">
            <thead>
              <tr>
                <th class="lot-c-case"><input type="checkbox" id="lot-case-tout" title="Tout cocher"></th>
                <th class="w-inv">N° inventaire</th>
                <th class="w-titre">Titre</th>
                <th class="w-artiste">Artiste</th>
                ${COLONNES.filter((c) => c.groupe).map((c) => `<th class="${c.w} col-${c.groupe}"${c.titreInfo ? ` title="${ech(c.titreInfo)}"` : ''}>${ech(c.th)}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="lot-corps"></tbody>
          </table>
        </div>
      </div>

      <div class="lot-barre-save" id="lot-barre-save">
        <div class="lot-resume"><strong id="lot-nb-modif">0</strong> œuvre(s) modifiée(s) — non enregistrées</div>
        <div class="lot-save-actions">
          <button type="button" class="btn-action btn-secondaire-action" id="lot-annuler">Annuler les changements</button>
          <button type="button" class="btn-action btn-principal" id="lot-enregistrer">Enregistrer tout</button>
        </div>
      </div>

      ${Object.entries(datalists).map(([id, vals]) =>
        `<datalist id="${id}">${vals.map((v) => `<option value="${ech(v)}"></option>`).join('')}</datalist>`).join('')}
    </div>
  `;

  const $ = (sel) => hote.querySelector(sel);
  const corps = $('#lot-corps');

  // ===== Rendu d'une cellule =====
  function celluleHtml(o, c) {
    const v = valCourante(o, c.col);
    const mod = estMod(o.id, c.col) ? ' modifiee' : '';
    const cls = c.groupe ? ` col-${c.groupe}` : '';
    if (c.kind === 'statut') {
      const opts = Object.entries(STATUTS).map(([val, s]) =>
        `<option value="${val}" ${val === v ? 'selected' : ''}>${ech(s.libelle)}</option>`).join('');
      return `<td class="${c.w}${cls}"><select class="lot-in st-${v}${mod}" data-champ="${c.col}">${opts}</select></td>`;
    }
    const num = c.kind === 'num' ? ' num' : '';
    const liste = c.liste ? ` list="${c.liste}"` : '';
    const valAff = v == null ? '' : v;
    return `<td class="${c.w}${cls}"><input class="lot-in${num}${mod}" data-champ="${c.col}" type="${c.kind === 'num' ? 'number' : 'text'}"${liste} value="${ech(valAff)}"></td>`;
  }

  function ligneHtml(o) {
    const coche = selection.has(o.id);
    const cellules = COLONNES.map((c) => celluleHtml(o, c)).join('');
    // numero_inventaire + titre sont les 2 premières de COLONNES (ancrage)
    const [cInv, cTitre, ...reste] = COLONNES;
    return `
      <tr data-id="${o.id}" class="${coche ? 'selectionnee' : ''} ${modifs.has(o.id) ? 'modifiee' : ''}">
        <td class="lot-c-case"><div class="lot-case"><input type="checkbox" class="lot-case-ligne" ${coche ? 'checked' : ''}></div></td>
        ${celluleHtml(o, cInv)}
        ${celluleHtml(o, cTitre)}
        <td class="lot-lecture w-artiste"><span>${ech(o.artiste_nom || '')}</span></td>
        ${reste.map((c) => celluleHtml(o, c)).join('')}
      </tr>`;
  }

  function lignesFiltrees() {
    if (!filtre) return lignes;
    const f = sansAccents(filtre);
    return lignes.filter((o) => sansAccents(
      [o.titre, o.artiste_nom, o.numero_inventaire].filter(Boolean).join(' ')).includes(f));
  }

  function rendreCorps() {
    const liste = lignesFiltrees();
    corps.innerHTML = liste.length
      ? liste.map(ligneHtml).join('')
      : `<tr><td colspan="${COLONNES.length + 2}" class="lot-vide">Aucune œuvre ne correspond.</td></tr>`;
    $('#lot-nb-affiche').textContent = liste.length;
    majSelection();
    appliquerGroupes();
  }

  // ===== Suivi des modifications =====
  function noter(id, col, valeur, valeurOrig) {
    let m = modifs.get(id);
    if (memeValeur(valeur, valeurOrig)) {
      if (m) { delete m[col]; if (Object.keys(m).length === 0) modifs.delete(id); }
    } else {
      if (!m) { m = {}; modifs.set(id, m); }
      m[col] = valeur;
    }
  }

  corps.addEventListener('input', (e) => {
    const cell = e.target.closest('.lot-in');
    if (!cell) return;
    const tr = e.target.closest('tr');
    const id = Number(tr.dataset.id);
    const col = cell.dataset.champ;
    const o = lignes.find((x) => x.id === id);
    let val = cell.value;
    if (cell.type === 'number') val = val === '' ? null : Number(val);
    noter(id, col, val, o[col]);
    cell.classList.toggle('modifiee', estMod(id, col));
    tr.classList.toggle('modifiee', modifs.has(id));
    if (col === 'statut') cell.className = 'lot-in st-' + val + (estMod(id, col) ? ' modifiee' : '');
    majSave();
  });

  // ===== Sélection =====
  corps.addEventListener('change', (e) => {
    if (!e.target.classList.contains('lot-case-ligne')) return;
    const tr = e.target.closest('tr');
    const id = Number(tr.dataset.id);
    if (e.target.checked) selection.add(id); else selection.delete(id);
    tr.classList.toggle('selectionnee', e.target.checked);
    majSelection();
  });

  $('#lot-case-tout').addEventListener('change', (e) => {
    const ids = lignesFiltrees().map((o) => o.id);
    if (e.target.checked) ids.forEach((id) => selection.add(id));
    else ids.forEach((id) => selection.delete(id));
    rendreCorps();
  });

  function majSelection() {
    const n = selection.size;
    $('#lot-puce').textContent = n;
    $('#lot-bandeau').classList.toggle('visible', n > 0);
    const ids = lignesFiltrees().map((o) => o.id);
    const tout = $('#lot-case-tout');
    const tousCoches = ids.length > 0 && ids.every((id) => selection.has(id));
    tout.checked = tousCoches;
    tout.indeterminate = !tousCoches && ids.some((id) => selection.has(id));
  }

  $('#lot-deselect').addEventListener('click', () => { selection.clear(); rendreCorps(); });

  // ===== Appliquer à la sélection =====
  const champBatch = $('#lot-champ');
  const zoneValeur = $('#lot-zone-valeur');
  function rendreValeurBatch() {
    const col = champBatch.value;
    if (col === 'statut') {
      zoneValeur.innerHTML = `<select id="lot-val">${Object.entries(STATUTS).map(([v, s]) => `<option value="${v}">${ech(s.libelle)}</option>`).join('')}</select>`;
    } else if (col === 'annee' || col === 'prix') {
      zoneValeur.innerHTML = `<input id="lot-val" type="number" placeholder="${col === 'prix' ? 'ex. 1500' : 'ex. 2024'}">`;
    } else {
      const liste = { type: 'dl-type', medium: 'dl-medium', support: 'dl-support', emplacement: 'dl-empl', exposition_actuelle: 'dl-expo', style: 'dl-style' }[col];
      zoneValeur.innerHTML = `<input id="lot-val" type="text" placeholder="nouvelle valeur"${liste ? ` list="${liste}"` : ''}>`;
    }
  }
  champBatch.addEventListener('change', rendreValeurBatch);
  rendreValeurBatch();

  $('#lot-appliquer').addEventListener('click', () => {
    if (selection.size === 0) return;
    const col = champBatch.value;
    const ctrl = $('#lot-val');
    let val = ctrl.value;
    if (ctrl.type === 'number') val = val === '' ? null : Number(val);
    selection.forEach((id) => {
      const o = lignes.find((x) => x.id === id);
      noter(id, col, val, o[col]);
    });
    rendreCorps();
    majSave();
    toast(`Valeur appliquée à ${pluriel(selection.size, 'œuvre')} — pense à enregistrer`);
  });

  // ===== Barre d'enregistrement =====
  function majSave() {
    const n = modifs.size;
    $('#lot-nb-modif').textContent = n;
    $('#lot-barre-save').classList.toggle('visible', n > 0);
  }

  $('#lot-annuler').addEventListener('click', async () => {
    if (!modifs.size) return;
    const r = await confirmer({
      type: 'question', title: 'Annuler les changements ?',
      message: `Abandonner les modifications non enregistrées de ${pluriel(modifs.size, 'œuvre')} ?`,
      buttons: ['Annuler les changements', 'Continuer l\'édition'], defaultId: 1, cancelId: 1,
    });
    if (r !== 0) return;
    modifs.clear();
    rendreCorps();
    majSave();
    toast('Changements annulés');
  });

  $('#lot-enregistrer').addEventListener('click', async () => {
    if (!modifs.size) return;
    const payload = [...modifs.entries()].map(([id, champs]) => ({ id, champs }));
    const btn = $('#lot-enregistrer');
    btn.disabled = true;
    try {
      const res = await window.api.oeuvresModifierLot(payload);
      // Commit local : applique les modifs aux lignes de travail.
      for (const [id, champs] of modifs.entries()) {
        const o = lignes.find((x) => x.id === id);
        if (o) Object.assign(o, champs);
      }
      modifs.clear();
      rendreCorps();
      majSave();
      toast(`${pluriel(res.modifiees || 0, 'œuvre')} enregistrée(s) ✓`);
    } catch (err) {
      await alerter({ type: 'error', title: 'Échec de l\'enregistrement', message: err.message });
    } finally {
      btn.disabled = false;
    }
  });

  // ===== Groupes de colonnes =====
  function appliquerGroupes() {
    ['ident', 'mat', 'com', 'loc'].forEach((g) => {
      const visible = groupesActifs.has(g);
      hote.querySelectorAll('.col-' + g).forEach((el) => el.classList.toggle('lot-masque', !visible));
    });
  }
  hote.querySelectorAll('.lot-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const g = chip.dataset.groupe;
      if (groupesActifs.has(g)) groupesActifs.delete(g); else groupesActifs.add(g);
      chip.classList.toggle('actif', groupesActifs.has(g));
      appliquerGroupes();
    });
  });

  // ===== Recherche / quitter =====
  $('#lot-filtre').addEventListener('input', (e) => { filtre = e.target.value.trim(); rendreCorps(); });

  $('#lot-quitter').addEventListener('click', async () => {
    if (modifs.size) {
      const r = await confirmer({
        type: 'warning', title: 'Quitter sans enregistrer ?',
        message: `${pluriel(modifs.size, 'œuvre')} modifiée(s) ne sont pas enregistrées.`,
        detail: 'Si tu quittes maintenant, ces changements seront perdus.',
        buttons: ['Quitter sans enregistrer', 'Rester'], defaultId: 1, cancelId: 1,
      });
      if (r !== 0) return;
    }
    if (typeof surFermer === 'function') surFermer();
  });

  // ===== Toast =====
  let toastTimer;
  function toast(msg) {
    let t = hote.querySelector('.lot-toast');
    if (!t) { t = document.createElement('div'); t.className = 'lot-toast'; hote.appendChild(t); }
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('visible'), 2200);
  }

  rendreCorps();
  setTimeout(() => $('#lot-filtre').focus(), 0);

  return { aDesModifs: () => modifs.size > 0 };
}
