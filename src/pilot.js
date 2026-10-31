import './styles.css';
import './pilot.css';
import { loadRequests, updateRequest, importRequest, REQUESTS_KEY } from './storage.js';
import { buildRequestText, routeText, addOffer, selectOffer, restoreRequest } from './request.js';

const statusLabels = { prepared: 'Preparada', contacted: 'Contactado', negotiating: 'En conversación', agreed: 'Elección registrada' };
const contactLabels = { whatsapp: 'WhatsApp / mensaje', call: 'Llamada', either: 'Llamada o mensaje' };
const contactWindowLabels = { morning: 'Mañana', afternoon: 'Tarde', evening: 'Noche', anytime: 'Cualquier horario' };
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dateFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const list = document.querySelector('#request-list');
const detail = document.querySelector('#request-detail');
const feedback = document.querySelector('#pilot-feedback');
let requests = [];
let selectedId = null;
let storageFailed = false;
let pendingImport = null;

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function notify(message, error = false) {
  feedback.textContent = message;
  feedback.classList.toggle('pilot-feedback--error', error);
  feedback.hidden = !message;
}

function readableDate(value) {
  if (!value) return 'Fecha por acordar';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 'Fecha por acordar' : dateFormat.format(date);
}

function phoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 10 ? `52${digits}` : digits;
}

function currentRequest() {
  return requests.find((request) => request.id === selectedId);
}

function renderList() {
  document.querySelector('#request-count').textContent = storageFailed ? '—' : requests.length;
  if (storageFailed) {
    list.innerHTML = '<div class="pilot-empty-small"><strong>No pudimos leer las solicitudes.</strong><p>Los datos guardados no se modificaron. Revisa el aviso y vuelve a intentarlo.</p></div>';
    return;
  }
  if (!requests.length) {
    list.innerHTML = '<div class="pilot-empty-small"><strong>Aún no hay solicitudes aquí.</strong><p>Prepara una desde el formulario o importa un archivo recibido.</p><a href="./index.html">Preparar una solicitud →</a></div>';
    return;
  }
  list.innerHTML = [...requests].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((request) => {
    const fields = request.fields || {};
    return `<button class="pilot-request${request.id === selectedId ? ' is-selected' : ''}" type="button" data-request-id="${escapeHtml(request.id)}" aria-pressed="${request.id === selectedId}">
      <span class="pilot-request-top"><span class="pilot-status pilot-status--${escapeHtml(request.status)}">${escapeHtml(statusLabels[request.status] || 'Preparada')}</span><span>${escapeHtml(readableDate(fields.moveDate))}</span></span>
      <strong>${escapeHtml(fields.customerName || 'Sin nombre')}</strong>
      <span class="pilot-request-route">${escapeHtml(routeText(fields))}</span>
      <span class="pilot-request-bottom">${Number(request.totals?.totalItems) || 0} artículos · ${(request.offers || []).length} propuestas</span>
    </button>`;
  }).join('');
}

function renderOffers(request) {
  const offers = request.offers || [];
  if (!offers.length) return '<div class="pilot-empty-small"><strong>La primera propuesta empieza con una conversación.</strong><p>Cuando el negocio haya revisado los detalles con el cliente, registra aquí el importe y lo que incluye.</p></div>';
  return offers.map((offer) => {
    const selected = request.selectedOfferId === offer.id;
    return `<article class="pilot-offer${selected ? ' pilot-offer--selected' : ''}">
      <div class="pilot-offer-head"><h4>${escapeHtml(offer.company)}</h4>${selected ? '<span class="pilot-status pilot-status--agreed">Elección del cliente</span>' : ''}</div>
      <p class="pilot-offer-price">${money.format(offer.amount)} <small>MXN</small></p>
      <p class="pilot-offer-notes">${escapeHtml(offer.notes || 'Sin condiciones registradas; confirmar con el cliente.')}</p>
      ${offer.contact ? `<p class="pilot-small">Contacto de quien ofrece: ${escapeHtml(offer.contact)}</p>` : ''}
      <button type="button" class="pilot-button ${selected ? 'pilot-button--outline' : 'pilot-button--dark'}" data-select-offer="${escapeHtml(offer.id)}" ${selected ? 'disabled' : ''}>${selected ? 'Elección registrada' : 'Registrar elección del cliente'}</button>
    </article>`;
  }).join('');
}

function renderDetail() {
  const request = currentRequest();
  if (!request) {
    detail.innerHTML = `<div class="pilot-empty-detail"><span aria-hidden="true">↗</span><p class="pilot-eyebrow">Cada mudanza tiene sus detalles</p><h2>${storageFailed ? 'El guardado necesita atención.' : 'Prepara la conversación.'}</h2><p>${storageFailed ? 'No se ha sobrescrito ni borrado información. Corrige el problema de almacenamiento y pulsa Actualizar.' : 'Selecciona una solicitud para revisar domicilios, inventario y servicios. El precio se define hablando con el cliente.'}</p></div>`;
    return;
  }
  const fields = request.fields || {};
  const digits = phoneDigits(fields.phone);
  const canContact = digits.length >= 10 && digits.length <= 15;
  const whatsapp = `https://wa.me/${digits}?text=${encodeURIComponent(`Hola ${fields.customerName || ''}, te contactamos sobre tu solicitud de mudanza de ${fields.origin} a ${fields.destination}. Quisiéramos revisar los detalles contigo para ofrecerte una propuesta.`)}`;
  detail.innerHTML = `<div class="pilot-detail-head"><div><p class="pilot-eyebrow">${escapeHtml(request.id)}</p><h2>${escapeHtml(fields.customerName || 'Solicitud de mudanza')}</h2><p>${escapeHtml(routeText(fields))}</p></div><span class="pilot-status pilot-status--${escapeHtml(request.status)}">${escapeHtml(statusLabels[request.status] || 'Preparada')}</span></div>
    <div class="pilot-facts"><div><span>Fecha de mudanza</span><strong>${escapeHtml(readableDate(fields.moveDate))}</strong></div><div><span>Teléfono</span><strong>${escapeHtml(fields.phone || 'No indicado')}</strong></div><div><span>Contacto preferido</span><strong>${escapeHtml(contactLabels[fields.contactMethod] || 'Por acordar')}</strong></div><div><span>Horario de contacto</span><strong>${escapeHtml(contactWindowLabels[fields.contactWindow] || 'Por acordar')}</strong></div></div>
    <div class="pilot-contact-actions">${canContact ? `<a class="pilot-button pilot-button--dark" href="tel:+${digits}">Llamar al cliente</a><a class="pilot-button pilot-button--outline" href="${whatsapp}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` : '<p class="pilot-small">Revisa el teléfono antes de contactar al cliente.</p>'}<button class="pilot-button pilot-button--outline" id="download-request" type="button">Descargar solicitud</button></div>
    <p class="pilot-small">Abrir una llamada o WhatsApp no cambia el estado. Marca el avance cuando hayas hablado con el cliente.</p>
    <div class="pilot-progress-actions"><span>Seguimiento:</span><button class="pilot-status-button" data-status="contacted" type="button" ${['contacted', 'agreed'].includes(request.status) ? 'disabled' : ''}>Marcar contactado</button><button class="pilot-status-button" data-status="negotiating" type="button" ${['negotiating', 'agreed'].includes(request.status) ? 'disabled' : ''}>Marcar en conversación</button></div>
    <details class="pilot-request-summary" open><summary>Ver solicitud completa</summary><pre id="request-full-text"></pre></details>
    <section class="pilot-offers-section" aria-labelledby="offers-title"><div class="pilot-section-heading"><h3 id="offers-title">Propuestas conversadas</h3><span>${(request.offers || []).length} registradas</span></div><p class="pilot-small">Registra ofertas reales recibidas por llamada o mensaje. El cliente elige considerando precio, disponibilidad y condiciones; la página no recomienda automáticamente la más barata.</p><div class="pilot-offers">${renderOffers(request)}</div><p class="pilot-choice-note">La elección registrada es una nota de seguimiento. No genera una reserva, pago o contrato.</p></section>
    <form id="offer-form" class="pilot-offer-form"><h3>Registrar una propuesta</h3><p>Captura el importe que acordó ofrecer el negocio tras revisar esta mudanza.</p><div class="pilot-form-grid"><label>Negocio o persona que ofrece<input name="company" required maxlength="120" autocomplete="organization" placeholder="Nombre del negocio" /></label><label>Importe propuesto (MXN)<input name="amount" type="number" required min="1" max="100000000" step="0.01" inputmode="decimal" placeholder="0.00" /></label><label class="pilot-form-wide">Condiciones y servicios incluidos<textarea name="notes" required maxlength="2000" rows="4" placeholder="Fecha disponible, tipo de unidad, empaque, maniobras, forma de pago y condiciones por confirmar…"></textarea></label><label class="pilot-form-wide">Contacto de quien ofrece <span>(opcional)</span><input name="contact" maxlength="160" placeholder="Nombre y teléfono" /></label></div><button class="pilot-button pilot-button--dark" type="submit">Guardar propuesta manual</button></form>`;
  detail.querySelector('#request-full-text').textContent = buildRequestText(request);
}

function render() {
  renderList();
  renderDetail();
}

function refresh(announce = false) {
  try {
    requests = loadRequests();
    storageFailed = false;
    if (!requests.some((request) => request.id === selectedId)) selectedId = requests[0]?.id || null;
    if (announce) notify('Solicitudes locales actualizadas.');
  } catch (error) {
    requests = [];
    selectedId = null;
    storageFailed = true;
    notify(`No se pudieron leer las solicitudes: ${error.message}. Los datos existentes no se han borrado.`, true);
  }
  render();
}

function mutateRequest(updater, message) {
  if (!selectedId || storageFailed) return;
  try {
    updateRequest(selectedId, updater);
    refresh();
    notify(message);
  } catch (error) {
    notify(`No se guardó el cambio: ${error.message}`, true);
  }
}

function downloadRequest(request = currentRequest()) {
  if (!request) return;
  const blob = new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `solicitud-${String(request.id).replace(/[^a-z0-9_-]/gi, '')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Archivo preparado para descargar, con las propuestas registradas. Compártelo solo con quien dará seguimiento.');
}

list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-request-id]');
  if (!button) return;
  selectedId = button.dataset.requestId;
  render();
});

detail.addEventListener('click', (event) => {
  const statusButton = event.target.closest('[data-status]');
  if (statusButton) {
    mutateRequest((request) => ({ ...request, status: statusButton.dataset.status, selectedOfferId: null }), 'Seguimiento actualizado en este navegador.');
    return;
  }
  const choiceButton = event.target.closest('[data-select-offer]');
  if (choiceButton) {
    mutateRequest((request) => selectOffer(request, choiceButton.dataset.selectOffer), 'Elección del cliente registrada. Confirma directamente con el negocio las condiciones del servicio.');
    return;
  }
  if (event.target.closest('#download-request')) downloadRequest();
});

detail.addEventListener('submit', (event) => {
  if (event.target.id !== 'offer-form') return;
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  mutateRequest((request) => addOffer(request, {
    company: String(data.get('company')).trim(),
    amount: Number(data.get('amount')),
    notes: String(data.get('notes')).trim(),
    contact: String(data.get('contact')).trim(),
  }), 'Propuesta registrada en este navegador. No se ha enviado ningún mensaje al cliente.');
});

document.querySelector('#refresh-requests').addEventListener('click', () => refresh(true));
document.querySelector('#import-request').addEventListener('click', () => document.querySelector('#import-file').click());

function completeImport(json) {
  const imported = importRequest(json);
  selectedId = imported.id;
  refresh();
  notify('Solicitud importada en este navegador. No se ha enviado ni publicado.');
}

document.querySelector('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('El archivo supera el límite de 2 MB');
    const json = await file.text();
    let parsed;
    try { parsed = JSON.parse(json); }
    catch { throw new Error('El archivo no contiene JSON válido'); }
    const valid = restoreRequest(parsed);
    const existing = loadRequests().find((request) => request.id === valid.id);
    if (existing) {
      pendingImport = { json, existing };
      document.querySelector('#replace-description').textContent = `${existing.fields.customerName || 'Solicitud'} · ${existing.id}. La copia actual tiene ${existing.offers.length} propuestas y la importada tiene ${valid.offers.length}.`;
      document.querySelector('#replace-dialog').showModal();
    } else {
      completeImport(json);
    }
  } catch (error) {
    notify(`No se importó el archivo: ${error.message}. Las solicitudes guardadas se conservan.`, true);
  } finally {
    event.target.value = '';
  }
});

document.querySelector('#backup-existing').addEventListener('click', () => {
  if (pendingImport) downloadRequest(pendingImport.existing);
});
document.querySelector('#replace-existing').addEventListener('click', () => {
  if (!pendingImport) return;
  try {
    completeImport(pendingImport.json);
    pendingImport = null;
    document.querySelector('#replace-dialog').close();
  } catch (error) {
    notify(`No se combinaron las copias: ${error.message}. La copia actual se conserva.`, true);
    document.querySelector('#replace-dialog').close();
  }
});
document.querySelector('#cancel-import').addEventListener('click', () => document.querySelector('#replace-dialog').close());
document.querySelector('#replace-dialog').addEventListener('close', () => { pendingImport = null; });

window.addEventListener('storage', (event) => {
  if (event.key === REQUESTS_KEY || event.key === null) refresh();
});

refresh();
