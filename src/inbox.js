// List pages intentionally omit contact details, notes and the complete inventory.
// Every read still uses the current user's session and database row policies.
export const INBOX_PAGE_SIZE = 20;
export const REQUEST_SUMMARY_COLUMNS = 'id,reference,owner_id,audience,status,created_at,business_id,customer_name:payload->fields->>customerName,origin:payload->fields->>origin,destination:payload->fields->>destination,move_date:payload->fields->>moveDate';
const DETAIL_COLUMNS = 'id,reference,owner_id,payload,audience,status,created_at,business_id';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export function requestCursor(row) {
  if (!row || !uuid.test(row.id) || !timestamp.test(row.created_at) || !Number.isFinite(Date.parse(row.created_at))) {
    throw new Error('No se pudo continuar la lista. Actualiza las solicitudes.');
  }
  // Keep PostgreSQL microseconds: converting to Date here can repeat/skip rows.
  return { id: row.id, created_at: row.created_at };
}

export function requestPageQuery(client, { cursor = null, businessId = null, ownerId = null } = {}) {
  let query = client.from('move_requests').select(REQUEST_SUMMARY_COLUMNS)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(INBOX_PAGE_SIZE + 1);
  if (businessId) {
    if (!uuid.test(businessId)) throw new Error('El negocio seleccionado no es válido.');
    query = query.eq('business_id', businessId);
  }
  if (ownerId) {
    if (!uuid.test(ownerId)) throw new Error('La cuenta seleccionada no es válida.');
    query = query.eq('owner_id', ownerId);
  }
  if (cursor) {
    const safe = requestCursor(cursor);
    query = query.or(`created_at.lt.${safe.created_at},and(created_at.eq.${safe.created_at},id.lt.${safe.id})`);
  }
  return query;
}

export async function loadRequestPage(client, options = {}) {
  const { data, error } = await requestPageQuery(client, options);
  if (error) throw error;
  const rows = (data || []).slice(0, INBOX_PAGE_SIZE);
  const hasNext = (data || []).length > INBOX_PAGE_SIZE;
  return { rows, hasNext, nextCursor: hasNext ? requestCursor(rows.at(-1)) : null };
}

export async function loadRequestDetail(client, requestId) {
  if (!uuid.test(requestId || '')) throw new Error('La solicitud no es válida.');
  const { data, error } = await client.from('move_requests').select(DETAIL_COLUMNS).eq('id', requestId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Esta solicitud ya no está disponible para tu cuenta.');
  return data;
}
