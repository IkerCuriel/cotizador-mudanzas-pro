import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
import { genericPushPayload, isAllowedPushEndpoint, notificationFilter, pushResult, webhookSecretMatches } from './validation.js';

// Solo webhook/cron del servidor. El cliente nunca llama a este endpoint.
// Desplegar con --no-verify-jwt: la autenticación real es el secreto dedicado.
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const hookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!webhookSecretMatches(request.headers.get('x-moveflow-push-secret'), hookSecret)) return new Response('Unauthorized', { status: 401 });
  if (Deno.env.get('WEB_PUSH_ENABLED') !== 'true') return Response.json({ enabled: false }, { headers: { 'Cache-Control': 'no-store' } });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!url || !serviceKey || !publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) return new Response('Push is not configured', { status: 503 });
  let filter: string | null;
  try {
    // No se confía en el destinatario, endpoint o texto del webhook; solo en su ID.
    const raw = await request.text();
    if (raw.length > 16000) return new Response('Payload too large', { status: 413 });
    filter = notificationFilter(JSON.parse(raw));
  } catch { return new Response('Invalid trigger', { status: 400 }); }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: jobs, error } = await db.rpc('claim_push_jobs', { p_limit: 10, p_notification_id: filter });
  if (error) return new Response('Queue unavailable', { status: 503 });
  let accepted = 0;
  let deferred = 0;
  // Hasta diez avisos en paralelo, cada uno con límite de diez segundos.
  await Promise.all((jobs || []).map(async (job: Record<string, any>) => {
    let result = 'rejected';
    try {
      const { data: current, error: currentError } = await db.rpc('push_job_is_current', { p_id: job.id, p_lease_token: job.lease_token });
      if (currentError) result = 'retry';
      else if (!current) result = 'skipped';
      else if (isAllowedPushEndpoint(job.endpoint)) {
        const details = webpush.generateRequestDetails({ endpoint: job.endpoint, keys: job.keys }, genericPushPayload(job.notification_id), {
          vapidDetails: { subject, publicKey, privateKey }, TTL: 300, urgency: 'high', contentEncoding: 'aes128gcm',
          topic: job.notification_id.replaceAll('-', '').slice(0, 32),
        });
        // No seguir redirecciones: un endpoint no puede convertirse en SSRF.
        const response = await fetch(job.endpoint, { method: 'POST', headers: details.headers, body: details.body, redirect: 'error', signal: AbortSignal.timeout(10000) });
        result = pushResult(response.status);
        await response.body?.cancel();
      }
    } catch { result = 'retry'; }
    const { error: finishError } = await db.rpc('finish_push_job', { p_id: job.id, p_lease_token: job.lease_token, p_result: result });
    if (result === 'accepted' && !finishError) accepted += 1;
    if (result === 'retry' || finishError) deferred += 1;
  }));
  // Sin logs de endpoints, claves, payloads, datos de clientes o errores del proveedor.
  return Response.json({ processed: jobs?.length || 0, accepted, deferred }, { headers: { 'Cache-Control': 'no-store' } });
});
