import { restoreRequest } from "./request.js";

export const REQUESTS_KEY = "moveflow-requests-v1";

function checkStorage(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("El almacenamiento local no está disponible. Puedes conservar la ficha descargándola.");
  }
  return storage;
}

export function loadRequests(storage = globalThis.localStorage) {
  const local = checkStorage(storage);
  let raw;
  try { raw = local.getItem(REQUESTS_KEY); }
  catch { throw new Error("No se pudo leer el almacenamiento local. Revisa los permisos del navegador."); }
  if (raw === null) return [];
  try {
    const records = JSON.parse(raw);
    if (!Array.isArray(records) || records.length > 100) throw new Error("Formato incorrecto");
    const requests = records.map(restoreRequest);
    if (new Set(requests.map((request) => request.id)).size !== requests.length) throw new Error("Referencias duplicadas");
    return requests;
  } catch {
    // No borrar ni reemplazar registros anteriores ante corrupción o versión desconocida.
    throw new Error("Las solicitudes guardadas no se pueden leer. No se han sobrescrito; conserva una copia del almacenamiento antes de restaurarlo.");
  }
}

export function saveRequest(request, storage = globalThis.localStorage) {
  const validated = restoreRequest(request);
  const existing = loadRequests(storage);
  const requests = [validated, ...existing.filter((item) => item.id !== validated.id)];
  if (requests.length > 100) throw new Error("Ya hay 100 solicitudes guardadas. Conserva una copia y elimina las que no necesites antes de guardar otra.");
  try { storage.setItem(REQUESTS_KEY, JSON.stringify(requests)); }
  catch { throw new Error("No se pudo guardar la solicitud en este navegador. Descarga la ficha para conservarla."); }
  return requests;
}

export function updateRequest(id, updater, storage = globalThis.localStorage) {
  const current = loadRequests(storage).find((request) => request.id === id);
  if (!current) throw new Error("No se encontró esa solicitud en este navegador.");
  if (typeof updater !== "function") throw new Error("La actualización de la solicitud no es válida.");
  const updated = restoreRequest(updater(current));
  if (updated.id !== id) throw new Error("No se puede cambiar la referencia de una solicitud al actualizarla.");
  saveRequest(updated, storage);
  return updated;
}

export function importRequest(json, storage = globalThis.localStorage) {
  let data;
  try { data = typeof json === "string" ? JSON.parse(json) : json; }
  catch { throw new Error("El archivo no contiene JSON válido. Selecciona una ficha descargada desde MoveFlow."); }
  const imported = restoreRequest(data);
  const existing = loadRequests(storage).find((request) => request.id === imported.id);
  if (!existing) {
    saveRequest(imported, storage);
    return imported;
  }
  // Las fichas preparadas son inmutables: editar una mudanza genera otra referencia.
  // Una copia más antigua sí puede traer propuestas nuevas sin borrar el seguimiento local.
  for (const key of ["createdAt", "fields", "rooms", "inventory"]) {
    if (JSON.stringify(existing[key]) !== JSON.stringify(imported[key])) {
      throw new Error("Esta referencia ya existe con datos distintos de la mudanza. No se cambió la copia local; prepara una solicitud nueva para los datos corregidos.");
    }
  }
  const offers = new Map(existing.offers.map((offer) => [offer.id, offer]));
  for (const offer of imported.offers) {
    const previous = offers.get(offer.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(offer)) {
      throw new Error("Una propuesta tiene la misma referencia pero un importe o condiciones distintos. No se modificó el historial; revisa ambas copias.");
    }
    offers.set(offer.id, offer);
  }
  if (existing.selectedOfferId && imported.selectedOfferId && existing.selectedOfferId !== imported.selectedOfferId) {
    throw new Error("Las copias registran elecciones de oferta diferentes. No se modificó el historial; confirma la elección del cliente antes de combinar.");
  }
  const selectedOfferId = existing.selectedOfferId ?? imported.selectedOfferId;
  const progress = ["prepared", "contacted", "negotiating", "agreed"];
  const status = selectedOfferId ? "agreed" : progress[Math.max(progress.indexOf(existing.status), progress.indexOf(imported.status), offers.size ? 2 : 0)];
  const merged = restoreRequest({ ...existing, offers: [...offers.values()], selectedOfferId, status });
  saveRequest(merged, storage);
  return merged;
}
