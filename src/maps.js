import { createGooglePlacesClient } from './google-places.js';
import { MAX_ADDITIONAL_DESTINATIONS, normalizeLocationSelection, normalizeAdditionalDestinations } from './locations.js';

const configuredKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '';
// Fixed hosts: user input is always an encoded search term, never a navigation URL.
export function mapLinks(value, { placeId, apiKey = '' } = {}) {
  const query = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (query.length < 3) return { query, error: 'Escribe una colonia, ciudad o dirección para consultar el mapa.' };
  const selected = normalizeLocationSelection({ placeId, label: query }, query);
  const search = new URL('https://www.google.com/maps/search/');
  search.searchParams.set('api', '1'); search.searchParams.set('query', query);
  if (selected) search.searchParams.set('query_place_id', selected.placeId);
  const officialEmbed = selected && /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
  const embed = new URL(officialEmbed ? 'https://www.google.com/maps/embed/v1/place' : 'https://www.google.com/maps');
  if (officialEmbed) {
    embed.searchParams.set('key', apiKey); embed.searchParams.set('q', `place_id:${selected.placeId}`); embed.searchParams.set('language', 'es');
  } else {
    embed.searchParams.set('q', query); embed.searchParams.set('output', 'embed'); embed.searchParams.set('hl', 'es');
  }
  if (search.href.length > 2048 || embed.href.length > 2048) return {
    query, error: 'La ubicación es muy larga para el mapa. Usa colonia, ciudad y estado; conserva otros detalles para hablar con el negocio.',
  };
  return { query, searchUrl: search.href, embedUrl: embed.href, error: '' };
}

export function setupLocationMaps(root = document, { apiKey = configuredKey, places = createGooglePlacesClient({ apiKey }) } = {}) {
  const controls = new Map();
  const rows = [];
  let nextId = 0;
  const list = root.getElementById('additionalDestinations');
  const addButton = root.getElementById('addDestination');
  const preference = root.getElementById('mapsEnabled');
  const enabled = () => preference?.checked !== false;
  const event = () => new root.defaultView.Event('input', { bubbles: true });

  function attach(input, card, title) {
    const button = card.querySelector('[data-map-preview]');
    const link = card.querySelector('[data-map-link]');
    const status = card.querySelector('[data-map-status]');
    const host = card.querySelector('[data-map-frame]');
    const searchField = input.closest('.location-search');
    const dropdown = root.createElement('div'); dropdown.className = 'place-results'; dropdown.hidden = true;
    const options = root.createElement('div'); options.id = `${input.id}-suggestions`; options.setAttribute('role', 'listbox'); options.setAttribute('aria-label', 'Ubicaciones sugeridas');
    const attribution = root.createElement('div'); attribution.className = 'place-results__attribution'; attribution.textContent = 'Google Maps'; attribution.setAttribute('translate', 'no');
    dropdown.append(options, attribution); searchField.append(dropdown);
    input.setAttribute('autocomplete', 'off');
    if (places.available) {
      input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', options.id); input.setAttribute('aria-expanded', 'false');
    }
    let selection, activated = false, revision = 0, timer, sessionPromise, activeOption = -1, suggestions = [], committing = false, disposed = false;
    let lastValue = input.value;
    let frameUrl = '';
    function closeSuggestions() {
      dropdown.hidden = true; options.replaceChildren(); suggestions = []; activeOption = -1;
      input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    }
    function endSession() {
      const ending = sessionPromise; sessionPromise = null;
      ending?.then((token) => places.endSession?.(token)).catch(() => {});
    }
    function clearFrame() { frameUrl = ''; host.replaceChildren(); host.hidden = true; button.setAttribute('aria-expanded', 'false'); }
    function linksForInput() { return mapLinks(input.value, { apiKey, placeId: normalizeLocationSelection(selection, input.value.trim())?.placeId }); }
    function update() {
      if (lastValue !== input.value) {
        lastValue = input.value;
        selection = normalizeLocationSelection(selection, input.value.trim());
        clearFrame();
      }
      const links = linksForInput();
      link.hidden = Boolean(links.error);
      if (links.error) link.removeAttribute('href'); else link.href = links.searchUrl;
      button.disabled = Boolean(links.error) || !enabled();
      button.textContent = activated ? 'Actualizar mapa' : 'Ver mapa';
      if (!activated) status.textContent = enabled() ? 'El mapa aparecerá al entrar al campo de ubicación.' : 'Mapas desactivados. Tu dirección se conserva en la ficha.';
    }
    function showMap() {
      if (disposed || !enabled()) return;
      activated = true; update();
      const links = input.value.trim() ? linksForInput() : mapLinks('México');
      if (links.error) { clearFrame(); status.textContent = links.error; return; }
      if (frameUrl !== links.embedUrl) {
        const iframe = root.createElement('iframe'); iframe.title = `Mapa: ${title()}`; iframe.referrerPolicy = 'origin'; iframe.allowFullscreen = true; iframe.src = links.embedUrl;
        host.replaceChildren(iframe); host.hidden = false; frameUrl = links.embedUrl;
        iframe.addEventListener('error', () => { if (iframe.isConnected) status.textContent = 'Puedes revisar esta ubicación con «Abrir en Google Maps».'; });
      }
      button.setAttribute('aria-expanded', 'true');
      status.textContent = selection ? 'Ubicación seleccionada. Confirma el acceso exacto con tu asesor.' : input.value.trim() ? 'Vista orientativa: comprueba que el mapa corresponda a tu dirección.' : 'Escribe una dirección para acercar el mapa a tu ubicación.';
    }
    async function choose(index) {
      const item = suggestions[index]; if (!item) return;
      const current = ++revision; clearTimeout(timer); closeSuggestions(); status.textContent = 'Consultando la ubicación…';
      const selectedSession = sessionPromise; sessionPromise = null;
      try {
        const chosen = await places.select(item.prediction);
        // Editing/removing the field while Google responds invalidates this selection.
        if (disposed || current !== revision) return;
        input.value = chosen.label; selection = normalizeLocationSelection(chosen, chosen.label); lastValue = input.value;
        clearFrame(); showMap();
        committing = true; input.dispatchEvent(event()); committing = false;
      } catch {
        if (current === revision && !disposed) status.textContent = 'No pudimos seleccionar esa ubicación. Escribe la dirección o intenta buscar de nuevo.';
      } finally { selectedSession?.then((token) => places.endSession?.(token)).catch(() => {}); }
    }
    function highlight(index) {
      activeOption = index;
      [...options.children].forEach((option, position) => option.setAttribute('aria-selected', String(position === index)));
      const option = options.children[index]; if (option) { input.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({ block: 'nearest' }); }
    }
    async function search(current, query) {
      if (!enabled() || !places.available || query.length < 3 || query.length > 200 || selection) return;
      try {
        sessionPromise ??= places.createSession();
        const token = await sessionPromise;
        if (current !== revision || disposed || root.activeElement !== input) return;
        const results = await places.fetchSuggestions(query, token);
        if (current !== revision || disposed || input.value.trim() !== query || root.activeElement !== input) return;
        closeSuggestions(); suggestions = results.slice(0, 5);
        suggestions.forEach((item, index) => {
          const option = root.createElement('div'); option.className = 'place-results__option'; option.id = `${input.id}-option-${index}`; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false'); option.textContent = item.label;
          option.addEventListener('mousedown', (e) => e.preventDefault());
          option.addEventListener('click', () => choose(index)); options.append(option);
        });
        dropdown.hidden = !suggestions.length; input.setAttribute('aria-expanded', String(Boolean(suggestions.length)));
        status.textContent = suggestions.length ? 'Selecciona una ubicación de la lista o completa tu dirección.' : 'No encontramos sugerencias. Puedes escribir la dirección y revisarla en el mapa.';
      } catch {
        if (current === revision && !disposed) { closeSuggestions(); endSession(); status.textContent = 'Las sugerencias no están disponibles ahora. Puedes escribir tu dirección y revisar el mapa.'; }
      }
    }
    function schedule() {
      const current = ++revision; clearTimeout(timer); closeSuggestions();
      const query = input.value.trim();
      timer = setTimeout(() => { if (activated) showMap(); search(current, query); }, places.available ? 350 : 700);
    }
    input.addEventListener('focus', () => { showMap(); if (places.available) { const current = ++revision; search(current, input.value.trim()); } });
    input.addEventListener('input', () => { if (committing) return; selection = undefined; update(); schedule(); });
    input.addEventListener('blur', closeSuggestions);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { revision++; closeSuggestions(); return; }
      if (!suggestions.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); highlight(activeOption === -1 ? (e.key === 'ArrowDown' ? 0 : suggestions.length - 1) : (activeOption + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length); }
      if (e.key === 'Enter' && activeOption >= 0) { e.preventDefault(); choose(activeOption); }
    });
    button.addEventListener('click', showMap);
    update();
    return {
      update,
      selection: () => normalizeLocationSelection(selection, input.value.trim()),
      restore(value) { selection = normalizeLocationSelection(value, input.value.trim()); lastValue = input.value; update(); },
      reset() { revision++; clearTimeout(timer); activated = false; selection = undefined; endSession(); closeSuggestions(); clearFrame(); update(); },
      pause() { revision++; clearTimeout(timer); activated = false; endSession(); closeSuggestions(); clearFrame(); update(); },
      dispose() { disposed = true; revision++; clearTimeout(timer); endSession(); closeSuggestions(); clearFrame(); dropdown.remove(); },
    };
  }
  for (const card of root.querySelectorAll('[data-location-map]')) {
    const side = card.dataset.locationMap;
    controls.set(side, attach(root.getElementById(side), card, () => side === 'origin' ? 'origen' : 'primer destino'));
  }
  function changed() { root.getElementById('origin').dispatchEvent(new root.defaultView.Event('change', { bubbles: true })); }
  function renumber() {
    rows.forEach((row, index) => {
      const number = index + 2; row.label.textContent = `Destino ${number} *`; row.heading.textContent = `Parada ${number}`;
      row.remove.setAttribute('aria-label', `Quitar destino ${number}`); row.up.setAttribute('aria-label', `Subir destino ${number}`); row.down.setAttribute('aria-label', `Bajar destino ${number}`);
      row.up.disabled = index === 0; row.down.disabled = index === rows.length - 1;
      row.element.querySelector('iframe')?.setAttribute('title', `Mapa: destino ${number}`);
      row.element.querySelector('[data-map-preview]').setAttribute('aria-label', `Actualizar mapa del destino ${number}`);
      if (list.children[index] !== row.element) list.insertBefore(row.element, list.children[index] || null);
    });
    if (addButton) addButton.disabled = rows.length >= MAX_ADDITIONAL_DESTINATIONS;
    root.getElementById('destinationLabel').textContent = rows.length ? 'Destino 1 *' : 'Destino *';
    root.getElementById('routeStopsStatus').textContent = rows.length ? `${rows.length} de ${MAX_ADDITIONAL_DESTINATIONS} destinos adicionales. Las entregas siguen este orden; describe abajo los muebles y accesos de cada parada.` : '';
  }
  function addDestination(data = {}, focus = true) {
    if (!list || rows.length >= MAX_ADDITIONAL_DESTINATIONS) return;
    const id = `extraDestination${++nextId}`;
    const element = root.createElement('section'); element.className = 'route-stop';
    // Static template; addresses and notes are assigned only with value/textContent.
    element.innerHTML = `<header class="route-stop__heading"><h5></h5><div class="route-stop__actions"><button type="button" class="text-button" data-up>↑ Subir</button><button type="button" class="text-button" data-down>↓ Bajar</button><button type="button" class="text-button" data-remove>Quitar</button></div></header><div class="location-search field"><label></label><input type="text" minlength="3" maxlength="500" autocomplete="off" placeholder="Busca una colonia, ciudad o dirección" required /><small class="field-error"></small></div><div class="location-map"><div class="location-map__actions"><button type="button" class="button button--secondary" data-map-preview aria-expanded="false">Ver mapa</button><a data-map-link class="text-button" target="_blank" rel="noopener noreferrer" hidden>Abrir en Google Maps ↗</a></div><p class="location-map__status" data-map-status role="status" aria-live="polite"></p><div class="location-map__frame" data-map-frame hidden></div></div><label class="field route-stop__notes"><span>Detalles de esta parada <em>Opcional</em></span><textarea maxlength="300" rows="2" placeholder="Qué se entrega aquí, piso, elevador, acceso…"></textarea></label>`;
    const input = element.querySelector('input'); input.id = id; input.value = data.address || ''; input.setAttribute('aria-describedby', 'locationSearchHelp');
    const label = element.querySelector('.location-search label'); label.htmlFor = id;
    element.querySelector('.field-error').dataset.errorFor = id;
    const notes = element.querySelector('textarea'); notes.id = `${id}Notes`; notes.value = data.notes || '';
    const row = { element, input, label, notes, heading: element.querySelector('h5'), up: element.querySelector('[data-up]'), down: element.querySelector('[data-down]'), remove: element.querySelector('[data-remove]') };
    rows.push(row); list.append(element);
    row.control = attach(input, element.querySelector('.location-map'), () => `destino ${rows.indexOf(row) + 2}`); row.control.restore(data.place);
    row.remove.addEventListener('click', () => { row.control.dispose(); rows.splice(rows.indexOf(row), 1); element.remove(); renumber(); changed(); addButton.focus(); });
    const move = (offset) => { const from = rows.indexOf(row); const to = from + offset; if (to < 0 || to >= rows.length) return; [rows[from], rows[to]] = [rows[to], rows[from]]; renumber(); changed(); const focusTarget = offset < 0 ? row.up : row.down; (focusTarget.disabled ? row.remove : focusTarget).focus(); };
    row.up.addEventListener('click', () => move(-1)); row.down.addEventListener('click', () => move(1));
    renumber(); if (focus) { changed(); input.focus(); }
  }
  addButton?.addEventListener('click', () => addDestination());
  preference?.addEventListener('change', () => { controls.forEach((control) => control.pause()); rows.forEach((row) => row.control.pause()); });
  return {
    update() { controls.forEach((control) => control.update()); rows.forEach((row) => row.control.update()); },
    collect() {
      const fields = {};
      for (const side of ['origin', 'destination']) { const place = controls.get(side)?.selection(); if (place) fields[`${side}Place`] = place; }
      if (rows.length) fields.additionalDestinations = rows.map((row) => ({ address: row.input.value, notes: row.notes.value, ...(row.control.selection() ? { place: row.control.selection() } : {}) }));
      return fields;
    },
    restore(fields) {
      controls.forEach((control, side) => control.restore(fields[`${side}Place`]));
      rows.splice(0).forEach((row) => { row.control.dispose(); row.element.remove(); });
      normalizeAdditionalDestinations(fields.additionalDestinations).forEach((stop) => addDestination(stop, false)); renumber();
    },
    reset() { controls.forEach((control) => control.reset()); rows.splice(0).forEach((row) => { row.control.dispose(); row.element.remove(); }); renumber(); },
  };
}
