const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => record(value) && Object.hasOwn(value, key) ? value[key] : undefined;
const text = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';

export const MAX_ADDITIONAL_DESTINATIONS = 5;

// Store only the selected identifier and the customer-facing text, never a Google
// response object, coordinates, photos, or an assertion that the address is verified.
export function normalizeLocationSelection(value, label) {
  const placeId = own(value, 'placeId');
  const selectedLabel = own(value, 'label');
  const address = text(label, 500);
  if (typeof placeId !== 'string' || !/^[A-Za-z0-9_-]{1,300}$/.test(placeId)
    || typeof selectedLabel !== 'string' || !address || selectedLabel !== address) return undefined;
  return { placeId, label: address };
}

export function normalizeAdditionalDestinations(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Los destinos adicionales deben ser una lista.');
  if (value.length > MAX_ADDITIONAL_DESTINATIONS) throw new Error('Una solicitud admite hasta 5 destinos adicionales. Divide la ruta antes de continuar.');
  return Array.from(value, (stop) => {
    if (!record(stop)) throw new Error('Cada destino adicional debe contener una ubicación.');
    const address = text(own(stop, 'address'), 500);
    const result = { address };
    const notes = text(own(stop, 'notes'), 300);
    const place = normalizeLocationSelection(own(stop, 'place'), address);
    if (notes) result.notes = notes;
    if (place) result.place = place;
    return result;
  });
}

export function routeText(fields = {}, { origin = 'Origen', destination = 'Destino' } = {}) {
  return [text(own(fields, 'origin'), 500) || origin, text(own(fields, 'destination'), 500) || destination,
    ...normalizeAdditionalDestinations(own(fields, 'additionalDestinations')).map((stop, index) => stop.address || `Destino ${index + 2} por definir`),
  ].join(' → ');
}
