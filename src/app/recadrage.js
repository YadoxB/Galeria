// Modale de recadrage pour photo d'artiste. Recadre en carré (1:1).
// Usage : const dataUrl = await recadrerCarre(sourceDataUrl);
// Retourne la data URL JPEG du recadrage, ou null si annulé.

const TAILLE_SORTIE = 800;
const QUALITE_JPEG = 0.9;

export function recadrerCarre(sourceDataUrl) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale';
    overlay.innerHTML = `
      <div class="modale-recadrage" role="dialog" aria-label="Cadrer la photo">
        <h3>Cadrer la photo</h3>
        <p class="aide-modale">Glisse le cadre pour le positionner. Ajuste la taille avec la barre.</p>
        <div class="zone-recadrage" id="zone-recadrage">
          <img id="img-source" alt="" draggable="false">
          <div class="cadre-selection" id="cadre-selection"></div>
        </div>
        <div class="controles-recadrage">
          <label for="ctrl-taille">Taille du cadre</label>
          <input type="range" id="ctrl-taille" min="25" max="100" value="100">
        </div>
        <div class="actions-modale">
          <button type="button" class="btn-action btn-secondaire-action" id="btn-cadre-annuler">Annuler</button>
          <button type="button" class="btn-action btn-principal" id="btn-cadre-ok">Cadrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const img = overlay.querySelector('#img-source');
    const cadre = overlay.querySelector('#cadre-selection');
    const zone = overlay.querySelector('#zone-recadrage');
    const ctrlTaille = overlay.querySelector('#ctrl-taille');

    let imgW = 0, imgH = 0;
    let x = 0, y = 0, taille = 0;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function appliquer() {
      cadre.style.left = x + 'px';
      cadre.style.top = y + 'px';
      cadre.style.width = taille + 'px';
      cadre.style.height = taille + 'px';
    }

    function recalculerDepuisSlider() {
      const pourcent = Number(ctrlTaille.value) / 100;
      const maxBase = Math.min(imgW, imgH);
      const nouvelleTaille = Math.max(40, maxBase * pourcent);
      const cx = x + taille / 2;
      const cy = y + taille / 2;
      taille = nouvelleTaille;
      x = clamp(cx - taille / 2, 0, imgW - taille);
      y = clamp(cy - taille / 2, 0, imgH - taille);
      appliquer();
    }

    function fermer(resultat) {
      window.removeEventListener('keydown', onEsc);
      overlay.remove();
      resolve(resultat);
    }

    function onEsc(e) {
      if (e.key === 'Escape') fermer(null);
    }
    window.addEventListener('keydown', onEsc);

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) fermer(null);
    });

    cadre.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = zone.getBoundingClientRect();
      const offX = e.clientX - rect.left - x;
      const offY = e.clientY - rect.top - y;
      const onMove = (ev) => {
        x = clamp(ev.clientX - rect.left - offX, 0, imgW - taille);
        y = clamp(ev.clientY - rect.top - offY, 0, imgH - taille);
        appliquer();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    ctrlTaille.addEventListener('input', recalculerDepuisSlider);

    overlay.querySelector('#btn-cadre-annuler').addEventListener('click', () => fermer(null));

    overlay.querySelector('#btn-cadre-ok').addEventListener('click', () => {
      const ratio = img.naturalWidth / imgW;
      const srcX = x * ratio;
      const srcY = y * ratio;
      const srcTaille = taille * ratio;

      const canvas = document.createElement('canvas');
      canvas.width = TAILLE_SORTIE;
      canvas.height = TAILLE_SORTIE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, srcX, srcY, srcTaille, srcTaille, 0, 0, TAILLE_SORTIE, TAILLE_SORTIE);
      fermer(canvas.toDataURL('image/jpeg', QUALITE_JPEG));
    });

    img.onload = () => {
      imgW = img.offsetWidth;
      imgH = img.offsetHeight;
      taille = Math.min(imgW, imgH);
      x = (imgW - taille) / 2;
      y = (imgH - taille) / 2;
      appliquer();
    };
    img.src = sourceDataUrl;
  });
}
