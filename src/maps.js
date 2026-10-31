// Fixed Google hosts: the entered location is a search term, never a navigation URL.
// The embedded preview is best effort; the documented Maps search link is always offered.
export function mapLinks(value) {
  const query = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (query.length < 3) return { query, error: 'Escribe una colonia, ciudad o dirección para consultar el mapa.' };
  const search = new URL('https://www.google.com/maps/search/');
  search.searchParams.set('api', '1');
  search.searchParams.set('query', query);
  const embed = new URL('https://www.google.com/maps');
  embed.searchParams.set('q', query);
  embed.searchParams.set('output', 'embed');
  embed.searchParams.set('hl', 'es');
  // Google documents a 2,048-character limit for Maps URLs. Never silently cut a location.
  if (search.href.length > 2048 || embed.href.length > 2048) return {
    query, error: 'La ubicación es muy larga para el mapa. Usa colonia, ciudad y estado; conserva otros detalles para hablar con el negocio.',
  };
  return { query, searchUrl: search.href, embedUrl: embed.href, error: '' };
}

export function setupLocationMaps(root = document) {
  const controls = [...root.querySelectorAll('[data-location-map]')].map((card) => {
    const side = card.dataset.locationMap;
    const input = root.getElementById(side);
    const button = card.querySelector('[data-map-preview]');
    const link = card.querySelector('[data-map-link]');
    const status = card.querySelector('[data-map-status]');
    const host = card.querySelector('[data-map-frame]');
    let previousQuery = null;
    let links = mapLinks(input.value);

    function clearPreview() {
      host.replaceChildren();
      host.hidden = true;
      button.textContent = 'Ver mapa';
      button.setAttribute('aria-expanded', 'false');
    }
    function update() {
      links = mapLinks(input.value);
      if (links.query !== previousQuery) {
        clearPreview();
        status.textContent = links.error || 'Consulta la vista previa y comprueba que corresponde a la ubicación que escribiste.';
        previousQuery = links.query;
      }
      button.disabled = Boolean(links.error);
      link.hidden = Boolean(links.error);
      if (links.error) link.removeAttribute('href');
      else link.href = links.searchUrl;
    }
    button.addEventListener('click', () => {
      update();
      if (links.error) return;
      const iframe = root.createElement('iframe');
      iframe.title = `Vista previa en Google Maps: ${side === 'origin' ? 'origen' : 'destino'}`;
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'origin';
      iframe.allowFullscreen = true;
      iframe.src = links.embedUrl;
      // No third-party request occurs before this explicit action.
      host.replaceChildren(iframe);
      host.hidden = false;
      button.textContent = 'Volver a cargar mapa';
      button.setAttribute('aria-expanded', 'true');
      status.textContent = 'Comprueba que el resultado corresponde a tu ubicación. Si no aparece o no coincide, abre Google Maps o corrige el texto.';
      iframe.addEventListener('error', () => {
        if (!iframe.isConnected) return;
        status.textContent = 'No se pudo mostrar la vista previa. Puedes revisar la ubicación con «Abrir en Google Maps».';
      });
    });
    update();
    return { update, reset() { previousQuery = null; clearPreview(); update(); } };
  });
  return {
    update() { controls.forEach((control) => control.update()); },
    reset() { controls.forEach((control) => control.reset()); },
  };
}
