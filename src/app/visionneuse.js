export function visionner(srcUrl) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay-modale overlay-visionneuse';
    overlay.innerHTML = `
      <button type="button" class="btn-fermer-visionneuse" aria-label="Fermer">&times;</button>
      <img class="image-visionneuse" alt="">
    `;

    const img = overlay.querySelector('.image-visionneuse');
    img.src = srcUrl;

    function fermer() {
      window.removeEventListener('keydown', onEsc);
      overlay.remove();
      resolve();
    }

    function onEsc(e) {
      if (e.key === 'Escape') fermer();
    }

    window.addEventListener('keydown', onEsc);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fermer();
    });
    overlay.querySelector('.btn-fermer-visionneuse').addEventListener('click', fermer);

    document.body.appendChild(overlay);
  });
}
