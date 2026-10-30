import './styles.css';
import './account.css';
import './dashboard.css';
import { supabase, isCloudConfigured, getSession, getProfile, accountUrl, cloudErrorMessage } from './cloud.js';
import { buildRequestText } from './request.js';
import { BUSINESS, buildWhatsAppUrl } from './config.js';

const statusLabels = { submitted: 'Recibida', contacted: 'Contactado', negotiating: 'En conversación', completed: 'Finalizada', cancelled: 'Cancelada' };
const roleLabels = { applicant: 'Cliente', provider: 'Negocio de mudanzas', admin: 'Administración', superadmin: 'Superadministración' };
const providerLabels = { pending: 'Pendiente de revisión', approved: 'Aprobado', suspended: 'Suspendido', expired: 'Vigencia vencida' };
const byId = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const state = { session: null, profile: null, requests: [], notifications: [], providers: [], users: [], selectedId: null, page: 0, hasNext: false, loading: false, tab: 'requests' };
let loadGeneration = 0;
let accessExpiryTimer = null;
let hasUnsavedEdits = false;
let activeUserId = null;
const pageSize = 20;
const isAdmin = () => ['admin', 'superadmin'].includes(state.profile?.role);
const isSuperadmin = () => state.profile?.role === 'superadmin';
const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });
function formatDate(value) {
  if (!value) return 'Por confirmar';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 'Por confirmar' : dateFormat.format(date);
}
function dateValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
function notify(message = '', error = false) {
  const element = byId('dashboard-feedback');
  element.textContent = message;
  element.classList.toggle('cloud-feedback--error', error);
  element.hidden = !message;
}
function setTab(tab) {
  const allowed = ['requests', 'notifications', 'profile', ...(isAdmin() ? ['providers'] : []), ...(isSuperadmin() ? ['users'] : [])];
  state.tab = allowed.includes(tab) ? tab : 'requests';
  document.querySelectorAll('[data-panel]').forEach((button) => {
    const active = button.dataset.panel === state.tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    byId(`panel-${button.dataset.panel}`).hidden = !active;
  });
}
function gate(title, description, actions = '') {
  byId('dashboard-content').hidden = true;
  byId('dashboard-gate').hidden = false;
  byId('dashboard-gate').innerHTML = `<div class="cloud-empty"><span class="cloud-empty-icon" aria-hidden="true">↗</span><h1>${esc(title)}</h1><p>${esc(description)}</p><div class="dashboard-actions">${actions}</div></div>`;
}
function getCurrentRequest() { return state.requests.find((request) => request.id === state.selectedId); }
function clearPrivateData() {
  loadGeneration += 1;
  activeUserId = null;
  state.loading = false;
  hasUnsavedEdits = false;
  if (accessExpiryTimer) clearTimeout(accessExpiryTimer);
  accessExpiryTimer = null;
  state.session = null; state.profile = null; state.requests = []; state.notifications = []; state.providers = []; state.users = []; state.selectedId = null;
  for (const id of ['cloud-request-list', 'cloud-request-detail', 'cloud-notifications', 'cloud-providers', 'cloud-users', 'profile-side', 'provider-plan']) byId(id).replaceChildren();
  byId('profile-form').reset();
  byId('profile-email').value = '';
  byId('dashboard-content').hidden = true;
  byId('dashboard-signout').hidden = true;
  byId('dashboard-gate').hidden = false;
  byId('dashboard-gate').innerHTML = '<div class="cloud-empty"><span class="cloud-loading" aria-hidden="true"></span><h1>Actualizando tu acceso…</h1></div>';
}
function effectiveProviderStatus(profile) {
  return profile.provider_status === 'approved' && (!profile.plan_expires_at || new Date(profile.plan_expires_at).getTime() <= Date.now()) ? 'expired' : profile.provider_status;
}
function renderPlan() {
  if (accessExpiryTimer) clearTimeout(accessExpiryTimer);
  accessExpiryTimer = null;
  const profile = state.profile;
  if (profile.role !== 'provider') { byId('provider-plan').innerHTML = ''; return; }
  const status = effectiveProviderStatus(profile);
  if (status === 'approved' && profile.plan_expires_at) {
    const remaining = new Date(profile.plan_expires_at).getTime() - Date.now();
    accessExpiryTimer = setTimeout(() => { clearPrivateData(); refresh(); }, Math.min(Math.max(remaining + 1000, 1000), 2147483647));
  }
  const explanation = status === 'approved' ? `Tu acceso al piloto está vigente hasta el ${formatDate(profile.plan_expires_at)}. Aquí aparecen las solicitudes que se te asignen.` : status === 'pending' ? 'Tu negocio está pendiente de revisión. Aún no puede recibir ni consultar datos de clientes.' : status === 'expired' ? 'Tu vigencia terminó. Solicita una revisión para volver a recibir oportunidades.' : 'El acceso a las solicitudes está suspendido. Contacta al equipo para revisar tu caso.';
  byId('provider-plan').innerHTML = `<section class="dashboard-plan"><div><p class="cloud-eyebrow">Plan piloto · sin costo</p><h2>${esc(providerLabels[status] || 'Acceso por revisar')}</h2><p>${esc(explanation)} No hay renovación ni cobros automáticos.</p></div><a class="button button--secondary" href="${esc(buildWhatsAppUrl(`Hola, quisiera revisar el acceso al piloto de mi negocio ${profile.company_name || profile.display_name}.`))}" target="_blank" rel="noopener noreferrer">Consultar mi acceso</a></section>`;
}
function renderRequestList() {
  byId('request-page-label').textContent = `Página ${state.page + 1}`;
  byId('requests-heading').textContent = isAdmin() ? 'Solicitudes recibidas' : state.profile.role === 'provider' ? 'Solicitudes asignadas' : 'Mis solicitudes';
  byId('requests-previous').disabled = state.page === 0 || state.loading;
  byId('requests-next').disabled = !state.hasNext || state.loading;
  byId('cloud-request-list').innerHTML = state.requests.length ? state.requests.map((request) => {
    const fields = request.payload?.fields || {};
    return `<button type="button" class="dashboard-request${request.id === state.selectedId ? ' is-selected' : ''}" data-cloud-request="${esc(request.id)}" aria-pressed="${request.id === state.selectedId}"><span class="dashboard-status dashboard-status--${esc(request.status)}">${esc(statusLabels[request.status] || 'Recibida')}</span><strong>${esc(fields.customerName || request.reference)}</strong><p>${esc(fields.origin)} → ${esc(fields.destination)}</p><small>Mudanza: ${esc(formatDate(fields.moveDate))} · ${esc(request.reference)}</small></button>`;
  }).join('') : `<div class="dashboard-empty-small"><strong>${state.profile.role === 'provider' ? 'Aún no tienes solicitudes disponibles.' : 'Aún no hay solicitudes aquí.'}</strong>${state.profile.role === 'provider' ? 'Revisa el estado y la vigencia de tu acceso. Las solicitudes aparecen cuando se te asignan.' : 'Las solicitudes enviadas desde tu cuenta aparecerán aquí para darles seguimiento.'}</div>`;
}
function renderRequestDetail() {
  const request = getCurrentRequest();
  const detail = byId('cloud-request-detail');
  if (!request) {
    detail.innerHTML = '<div class="cloud-empty"><span class="cloud-empty-icon" aria-hidden="true">↗</span><p class="cloud-eyebrow">Cada detalle cuenta</p><h2>Una conversación bien preparada.</h2><p>Selecciona una solicitud para consultar su información y seguimiento. El precio se acuerda directamente con el negocio.</p></div>';
    return;
  }
  const fields = request.payload?.fields || {};
  let digits = String(fields.phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `52${digits}`;
  const canContact = /^\d{10,15}$/.test(digits);
  const contactAllowed = ['provider', 'admin', 'superadmin'].includes(state.profile.role) && canContact && request.status !== 'cancelled';
  const terminal = ['completed', 'cancelled'].includes(request.status);
  const ownRequest = request.owner_id === state.session.user.id;
  detail.innerHTML = `<header class="dashboard-detail-head"><div><p class="cloud-eyebrow">${esc(request.reference)}</p><h2>${esc(fields.customerName || 'Solicitud de mudanza')}</h2><p>${esc(fields.origin)} → ${esc(fields.destination)}</p></div><span class="dashboard-status dashboard-status--${esc(request.status)}">${esc(statusLabels[request.status] || request.status)}</span></header>
    <div class="dashboard-meta"><div><span>Fecha de mudanza</span><strong>${esc(formatDate(fields.moveDate))}</strong></div><div><span>Fecha de recepción</span><strong>${esc(formatDate(request.created_at))}</strong></div><div><span>Compartida con</span><strong>${request.audience === 'network' ? 'Red de mudanceros autorizada' : 'Negocio familiar'}</strong></div></div>
    ${contactAllowed ? `<div class="dashboard-actions"><a href="tel:+${digits}" class="button button--primary">Llamar al cliente</a><a href="${esc(buildWhatsAppUrl(`Hola ${fields.customerName || ''}, te contacto sobre tu solicitud de mudanza ${request.reference}. Me gustaría revisar los detalles contigo.`, digits))}" target="_blank" rel="noopener noreferrer" class="button button--secondary">Abrir WhatsApp</a></div><p class="cloud-small">El mensaje se envía desde WhatsApp cuando lo confirmes. Abrir el enlace no cambia el estado de la solicitud.</p>` : ''}
    <details class="dashboard-request-text" open><summary>Detalles de la mudanza</summary><pre id="cloud-request-text"></pre></details>
    ${isAdmin() && !terminal ? `<form id="request-status-form" class="cloud-form dashboard-status-form"><label>Actualizar seguimiento<select name="status" required>${['contacted', 'negotiating', 'completed', 'cancelled'].map((status) => `<option value="${status}"${status === request.status ? ' selected' : ''}>${statusLabels[status]}</option>`).join('')}</select></label><button type="submit" class="button button--secondary">Guardar seguimiento</button><p class="cloud-small">Finalizar o cancelar cierra el seguimiento. No registra pagos ni reservas.</p></form>` : ''}
    ${ownRequest && !terminal ? '<details class="dashboard-cancel"><summary>Cancelar esta solicitud</summary><p>Los negocios dejarán de poder consultar esta solicitud. Esto no cancela contratos o acuerdos que ya hayas hecho fuera de la plataforma; avisa también directamente al negocio.</p><button type="button" id="cancel-cloud-request" class="button button--secondary">Confirmar cancelación</button></details>' : ''}`;
  detail.querySelector('#cloud-request-text').textContent = buildRequestText({ ...request.payload, id: request.reference });
}
function renderNotifications() {
  const unread = state.notifications.filter((notification) => !notification.read_at).length;
  byId('notification-count').textContent = unread || '0';
  byId('cloud-notifications').innerHTML = state.notifications.length ? state.notifications.map((notification) => `<article class="dashboard-notification${notification.read_at ? '' : ' is-unread'}"><div><h3>${esc(notification.title)}</h3><p>${esc(formatDate(notification.created_at))} · ${notification.read_at ? 'Leída' : 'Sin leer'}</p></div><div class="dashboard-actions">${notification.request_id ? `<button type="button" class="cloud-text-button" data-notification-request="${esc(notification.request_id)}" data-notification-id="${esc(notification.id)}">Ver solicitud</button>` : ''}${!notification.read_at ? `<button type="button" class="button button--secondary" data-notification-read="${esc(notification.id)}">Marcar leída</button>` : ''}</div></article>`).join('') : '<div class="dashboard-empty-small"><strong>Todo al día.</strong>Aquí aparecerán las novedades de tus solicitudes y tu cuenta.</div>';
}
function renderProfile() {
  const form = byId('profile-form');
  for (const field of ['display_name', 'phone', 'company_name']) form.elements[field].value = state.profile[field] || '';
  byId('profile-email').value = state.session.user.email || '';
  byId('profile-side').innerHTML = `<p class="cloud-eyebrow">Tu tipo de cuenta</p><h2>${esc(roleLabels[state.profile.role])}</h2><p>El acceso a solicitudes y funciones depende de los permisos de tu cuenta.</p>${state.profile.role === 'applicant' ? '<hr /><h2>¿Tienes un negocio de mudanzas?</h2><p>Solicita acceso al piloto sin costo. El equipo revisará tu negocio antes de asignarte solicitudes.</p><form id="join-provider-form" class="cloud-form"><label>Nombre del negocio<input name="company_name" required minlength="2" maxlength="120" autocomplete="organization" /></label><button type="submit" class="button button--secondary">Solicitar acceso al piloto</button></form>' : '<p class="cloud-small">La administración revisa los accesos. Los permisos no se cambian editando el perfil.</p>'}`;
}
function renderProviders() {
  if (!isAdmin()) { byId('cloud-providers').innerHTML = ''; return; }
  byId('cloud-providers').innerHTML = state.providers.length ? state.providers.map((profile) => {
    const status = effectiveProviderStatus(profile);
    return `<article class="dashboard-provider"><header><div><h3>${esc(profile.company_name || profile.display_name || 'Negocio sin nombre')}</h3><p>${esc(profile.display_name)}${profile.phone ? ` · ${esc(profile.phone)}` : ''}</p></div><span class="dashboard-status dashboard-status--${esc(status)}">${esc(providerLabels[status] || 'Por revisar')}</span></header><p class="cloud-small">Plan piloto · ${profile.plan_expires_at ? `vigencia al ${esc(formatDate(profile.plan_expires_at))}` : 'sin vigencia aprobada'}${profile.is_family ? ' · negocio familiar' : ''}</p><form class="cloud-form" data-provider-form="${esc(profile.id)}"><label>Estado de acceso<select name="status">${['pending', 'approved', 'suspended'].map((option) => `<option value="${option}"${option === profile.provider_status ? ' selected' : ''}>${providerLabels[option]}</option>`).join('')}</select></label><label>Vigencia hasta<input type="date" name="expires" value="${esc(dateValue(profile.plan_expires_at))}" /><small>Para aprobar, elige una fecha futura dentro de los próximos 366 días.</small></label><label class="cloud-check"><input type="checkbox" name="is_family"${profile.is_family ? ' checked' : ''}${isSuperadmin() ? '' : ' disabled'} /><span>Es el negocio familiar que recibe solicitudes directas${isSuperadmin() ? '' : ' (lo asigna superadministración)'}</span></label><button type="submit" class="button button--secondary">Guardar acceso</button></form></article>`;
  }).join('') : '<div class="dashboard-empty-small"><strong>Aún no hay negocios registrados.</strong>Las solicitudes de acceso aparecerán aquí cuando se complete el registro.</div>';
}
function renderUsers() {
  if (!isSuperadmin()) { byId('cloud-users').innerHTML = ''; return; }
  byId('cloud-users').innerHTML = state.users.length ? state.users.map((profile) => `<article class="dashboard-user"><div><h3>${esc(profile.display_name || profile.company_name || 'Cuenta sin nombre')}</h3><p>${esc(roleLabels[profile.role] || profile.role)} · ${esc(profile.phone || profile.id)}</p></div>${profile.role === 'superadmin' ? '<span class="dashboard-status">Acceso protegido</span>' : `<form class="dashboard-role-form" data-role-form="${esc(profile.id)}"><label class="sr-only" for="role-${esc(profile.id)}">Nuevo rol de ${esc(profile.display_name)}</label><select name="role" id="role-${esc(profile.id)}">${['applicant', 'provider', 'admin'].map((role) => `<option value="${role}"${role === profile.role ? ' selected' : ''}>${roleLabels[role]}</option>`).join('')}</select><button type="submit" class="button button--secondary">Cambiar rol</button></form>`}</article>`).join('') : '<div class="dashboard-empty-small">No hay cuentas disponibles para administrar.</div>';
}
function render() {
  byId('dashboard-gate').hidden = true;
  byId('dashboard-content').hidden = false;
  byId('dashboard-signout').hidden = false;
  byId('dashboard-role').textContent = roleLabels[state.profile.role] || 'Mi cuenta';
  byId('dashboard-name').textContent = `Hola, ${state.profile.display_name || 'bienvenido'}.`;
  byId('dashboard-description').textContent = isAdmin() ? 'Revisa las solicitudes y los accesos del equipo.' : state.profile.role === 'provider' ? 'Conecta con los clientes de las solicitudes que tienes asignadas.' : 'La información de tu mudanza, siempre a la mano.';
  byId('providers-tab').hidden = !isAdmin();
  byId('users-tab').hidden = !isSuperadmin();
  renderPlan(); renderRequestList(); renderRequestDetail(); renderNotifications(); renderProfile(); renderProviders(); renderUsers();
  setTab(state.tab);
}
async function queryRows(query) { const { data, error } = await query; if (error) throw error; return data || []; }
async function refresh(announce = false) {
  if (state.loading) return;
  const generation = ++loadGeneration;
  state.loading = true;
  byId('refresh-dashboard').disabled = true;
  try {
    const session = await getSession();
    if (generation !== loadGeneration) return;
    if (!session) {
      clearPrivateData();
      byId('dashboard-signout').hidden = true;
      gate('Tu mudanza tiene su espacio.', 'Entra a tu cuenta para consultar solicitudes y notificaciones.', `<a class="button button--primary" href="${esc(accountUrl('panel.html'))}">Entrar a mi cuenta</a><a class="button button--secondary" href="./index.html">Preparar una solicitud</a>`);
      return;
    }
    if (activeUserId && activeUserId !== session.user.id) {
      clearPrivateData();
      activeUserId = session.user.id;
      setTimeout(() => refresh(), 0);
      return;
    }
    activeUserId = session.user.id;
    const profile = await getProfile(session);
    if (generation !== loadGeneration) return;
    if (!Object.hasOwn(roleLabels, profile?.role)) throw new Error('Tu cuenta todavía no tiene un perfil disponible. Contacta al equipo.');
    const admin = ['admin', 'superadmin'].includes(profile.role);
    const [rows, notifications, providers, users] = await Promise.all([
      queryRows(supabase.from('move_requests').select('id,reference,owner_id,payload,audience,status,created_at').order('created_at', { ascending: false }).range(state.page * pageSize, state.page * pageSize + pageSize)),
      queryRows(supabase.from('notifications').select('id,user_id,request_id,title,read_at,created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50)),
      admin ? queryRows(supabase.from('profiles').select('*').eq('role', 'provider').order('display_name').limit(100)) : [],
      profile.role === 'superadmin' ? queryRows(supabase.from('profiles').select('*').order('display_name').limit(100)) : [],
    ]);
    if (generation !== loadGeneration) return;
    state.session = session; state.profile = profile;
    state.hasNext = rows.length > pageSize; state.requests = rows.slice(0, pageSize);
    state.notifications = notifications; state.providers = providers; state.users = users;
    if (!state.requests.some((request) => request.id === state.selectedId)) state.selectedId = state.requests[0]?.id || null;
    hasUnsavedEdits = false;
    render();
    if (announce) notify('Información actualizada.');
  } catch (error) {
    if (generation !== loadGeneration) return;
    gate('No pudimos cargar tu cuenta.', 'Revisa tu conexión y vuelve a intentarlo.', '<button class="button button--primary" id="retry-dashboard" type="button">Volver a intentar</button><a class="button button--secondary" href="./cuenta.html">Revisar mi acceso</a>');
    notify(cloudErrorMessage(error), true);
  } finally {
    if (generation !== loadGeneration) return;
    state.loading = false;
    byId('refresh-dashboard').disabled = false;
    byId('requests-previous').disabled = state.page === 0;
    byId('requests-next').disabled = !state.hasNext;
  }
}
async function mutate(element, action, success) {
  if (element.dataset.busy === 'true') return;
  element.dataset.busy = 'true';
  const buttons = element.matches('button') ? [element] : [...element.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  notify();
  const generation = loadGeneration;
  try {
    await action();
    if (generation !== loadGeneration) return;
    await refresh();
    notify(success);
  } catch (error) { notify(cloudErrorMessage(error), true); }
  finally { element.dataset.busy = 'false'; buttons.forEach((button) => { button.disabled = false; }); }
}
async function rpc(name, args) { const { data, error } = await supabase.rpc(name, args); if (error) throw error; return data; }

document.querySelectorAll('[data-panel]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.panel)));
byId('refresh-dashboard').addEventListener('click', () => refresh(true));
byId('dashboard-gate').addEventListener('click', (event) => { if (event.target.closest('#retry-dashboard')) refresh(); });
byId('requests-previous').addEventListener('click', () => { if (state.page > 0 && !state.loading) { state.page -= 1; refresh(); } });
byId('requests-next').addEventListener('click', () => { if (state.hasNext && !state.loading) { state.page += 1; refresh(); } });
byId('cloud-request-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-cloud-request]');
  if (!button) return;
  state.selectedId = button.dataset.cloudRequest;
  renderRequestList(); renderRequestDetail();
});
byId('cloud-request-detail').addEventListener('click', (event) => {
  const button = event.target.closest('#cancel-cloud-request');
  if (!button) return;
  const request = getCurrentRequest();
  if (request) mutate(button, () => rpc('cancel_request', { p_request_id: request.id }), 'Solicitud cancelada. Si tenías un acuerdo fuera de la plataforma, comunícate también con el negocio.');
});
byId('cloud-request-detail').addEventListener('submit', (event) => {
  if (event.target.id !== 'request-status-form') return;
  event.preventDefault();
  const request = getCurrentRequest();
  if (request && event.target.reportValidity()) mutate(event.target, () => rpc('set_request_status', { p_request_id: request.id, p_status: event.target.elements.status.value }), 'Seguimiento actualizado.');
});
byId('cloud-notifications').addEventListener('click', async (event) => {
  const read = event.target.closest('[data-notification-read]');
  if (read) { mutate(read, () => rpc('mark_notification_read', { p_notification_id: read.dataset.notificationRead }), 'Notificación marcada como leída.'); return; }
  const button = event.target.closest('[data-notification-request]');
  if (!button) return;
  button.disabled = true;
  const generation = loadGeneration;
  try {
    const { data, error } = await supabase.from('move_requests').select('id,reference,owner_id,payload,audience,status,created_at').eq('id', button.dataset.notificationRequest).maybeSingle();
    if (error) throw error;
    if (generation !== loadGeneration) return;
    if (!data) throw new Error('Esta solicitud ya no está disponible para tu cuenta.');
    if (!state.requests.some((request) => request.id === data.id)) state.requests.unshift(data);
    state.selectedId = data.id;
    await rpc('mark_notification_read', { p_notification_id: button.dataset.notificationId });
    if (generation !== loadGeneration) return;
    const notice = state.notifications.find((item) => item.id === button.dataset.notificationId);
    if (notice) notice.read_at = new Date().toISOString();
    renderRequestList(); renderRequestDetail(); renderNotifications(); setTab('requests'); notify();
  } catch (error) { notify(cloudErrorMessage(error), true); }
  finally { button.disabled = false; }
});
byId('profile-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const payload = Object.fromEntries(['display_name', 'phone', 'company_name'].map((field) => [field, form.elements[field].value.trim()]));
  if (payload.display_name.length < 2) { notify('Escribe tu nombre para guardar el perfil.', true); return; }
  mutate(form, async () => {
    const { error } = await supabase.from('profiles').update(payload).eq('id', state.session.user.id).select('id').single();
    if (error) throw error;
  }, 'Tu perfil se actualizó. Las fichas ya enviadas conservan sus datos originales.');
});
byId('profile-side').addEventListener('submit', (event) => {
  if (event.target.id !== 'join-provider-form') return;
  event.preventDefault();
  if (event.target.reportValidity()) mutate(event.target, () => rpc('join_provider', { p_company_name: event.target.elements.company_name.value.trim() }), 'Solicitud de acceso registrada. El equipo revisará tu negocio.');
});
byId('cloud-providers').addEventListener('submit', (event) => {
  const form = event.target.closest('[data-provider-form]');
  if (!form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  const profile = state.providers.find((item) => item.id === form.dataset.providerForm);
  if (!profile) return;
  const status = form.elements.status.value;
  const expiryValue = form.elements.expires.value;
  const expiryDate = expiryValue ? new Date(`${expiryValue}T23:59:59`) : null;
  if (status === 'approved' && (!expiryDate || expiryDate.getTime() <= Date.now() || expiryDate.getTime() > Date.now() + 366 * 86400000)) { notify('Para aprobar el acceso, elige una vigencia futura de hasta 366 días.', true); return; }
  mutate(form, () => rpc('set_provider_access', { p_user_id: profile.id, p_status: status, p_expires_at: expiryDate?.toISOString() || null, p_is_family: isSuperadmin() ? form.elements.is_family.checked : profile.is_family === true }), 'Acceso del negocio actualizado.');
});
byId('cloud-users').addEventListener('submit', (event) => {
  const form = event.target.closest('[data-role-form]');
  if (!form) return;
  event.preventDefault();
  mutate(form, () => rpc('set_user_role', { p_user_id: form.dataset.roleForm, p_role: form.elements.role.value }), 'Permisos de la cuenta actualizados.');
});
byId('dashboard-signout').addEventListener('click', async () => {
  const button = byId('dashboard-signout');
  button.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearPrivateData();
    await refresh(); notify('Sesión cerrada.');
  } catch (error) { notify(cloudErrorMessage(error), true); }
  finally { button.disabled = false; }
});

if (!isCloudConfigured) {
  gate('Estamos preparando las cuentas.', 'Por ahora puedes preparar tu ficha y comunicarte con el negocio por WhatsApp.', `<a class="button button--primary" href="${esc(buildWhatsAppUrl('Hola, quisiera información sobre una mudanza.', BUSINESS.whatsapp))}" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a><a class="button button--secondary" href="./index.html">Preparar una solicitud</a>`);
} else {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearPrivateData();
      setTimeout(() => refresh(), 0);
    }
    if (event === 'SIGNED_IN' && session?.user.id) {
      if (activeUserId && session.user.id !== activeUserId) {
        clearPrivateData();
        activeUserId = session.user.id;
        setTimeout(() => refresh(), 0);
      } else activeUserId = session.user.id;
    }
  });
  const refreshIfIdle = () => { if (!document.hidden && !hasUnsavedEdits && !state.loading) refresh(); };
  window.addEventListener('focus', refreshIfIdle);
  document.addEventListener('visibilitychange', refreshIfIdle);
  document.addEventListener('input', (event) => { if (event.target.closest('#dashboard-content form')) hasUnsavedEdits = true; });
  setInterval(refreshIfIdle, 60000);
  refresh();
}
