let cacheConfig = null;

export async function chargerConfig() {
  if (cacheConfig) return cacheConfig;
  cacheConfig = await window.api.configGet();
  return cacheConfig;
}

export function invaliderCacheConfig() {
  cacheConfig = null;
}

export async function rafraichirEntete() {
  const c = await chargerConfig();
  const elProfilNom = document.getElementById('profil-nom-galerie');
  if (elProfilNom) elProfilNom.textContent = c.galerie.nom || 'Galerie';
}

function sectionDe(nomVue) {
  if (!nomVue) return '';
  if (nomVue === 'accueil') return 'accueil';
  if (nomVue.startsWith('artiste')) return 'artistes';
  if (nomVue.startsWith('oeuvre'))  return 'oeuvres';
  if (nomVue.startsWith('client'))  return 'clients';
  if (nomVue.startsWith('vente'))   return 'ventes';
  return '';
}

// Marque l'entrée du menu de la sidebar correspondant à la vue courante.
export function majSidebarActif(nomVue) {
  const sectionActuelle = sectionDe(nomVue);
  document.querySelectorAll('#barre-laterale .entree-sidebar[data-vue]').forEach((btn) => {
    const sec = sectionDe(btn.dataset.vue);
    btn.classList.toggle('actif', sec === sectionActuelle);
  });
}
