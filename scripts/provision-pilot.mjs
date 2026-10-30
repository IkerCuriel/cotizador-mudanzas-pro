import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Ejecutar en el equipo del propietario. Este módulo nunca se importa desde la web.
class InvitationConfigurationError extends Error {}

const members = [
  { name: 'Tere Curiel', phone: '+525529061098', emailVariable: 'MOVEFLOW_TERE_EMAIL' },
  { name: 'Marco Curiel', phone: '+525614492452', emailVariable: 'MOVEFLOW_MARCO_EMAIL' },
];

function httpsOrigin(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new InvitationConfigurationError(`Falta una URL válida para ${label}.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^\/?$/.test(url.pathname)) {
    throw new InvitationConfigurationError(`Usa el origen HTTPS de ${label}, sin credenciales ni rutas.`);
  }
  return url.origin;
}

export function prepareInvitations(env) {
  if (env.MOVEFLOW_EMAILS_CONFIRMED !== 'true') throw new InvitationConfigurationError('Confirma primero que cada persona controla su correo real. Los correos provisionales no permiten enviar invitaciones.');
  const url = httpsOrigin(env.SUPABASE_URL, 'Supabase');
  const site = httpsOrigin(env.MOVEFLOW_SITE_URL, 'la página');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* A new secret key is not a JWT. */ }
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key) && role !== 'service_role') {
    throw new InvitationConfigurationError('Falta la clave de servidor de Supabase. Nunca uses un nombre VITE_ para ella.');
  }
  if (env.MOVEFLOW_PRIVACY_READY !== 'true') throw new InvitationConfigurationError('Completa el aviso de privacidad y activa MOVEFLOW_PRIVACY_READY antes de invitar.');
  const recipients = members.map((member) => {
    const email = String(env[member.emailVariable] || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvitationConfigurationError(`Falta el correo individual de ${member.name}.`);
    return { name: member.name, phone: member.phone, email };
  });
  if (recipients[0].email === recipients[1].email) throw new InvitationConfigurationError('Tere y Marco deben usar correos distintos para conservar accesos individuales.');
  return { url, key, redirectTo: `${site}/cuenta.html?mode=invite`, recipients };
}

export async function provisionPilot({ env = process.env, send = false, create = createClient, log = console.log } = {}) {
  if (!send) {
    log('Modo revisión: no se crea ninguna cuenta ni se envían correos.');
    for (const member of members) log(`${member.name}: invitación individual pendiente de correo y conexión de Supabase.`);
    log('Los correos provisionales son referencias locales, no accesos creados. Antes de --send, sustituye esos correos y confirma MOVEFLOW_EMAILS_CONFIRMED=true. Cada persona elegirá su contraseña; el acceso requiere aprobación y segundo factor.');
    return { sent: 0, failed: 0 };
  }
  const configuration = prepareInvitations(env);
  const client = create(configuration.url, configuration.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  let sent = 0; let failed = 0;
  for (const person of configuration.recipients) {
    const { error } = await client.auth.admin.inviteUserByEmail(person.email, {
      redirectTo: configuration.redirectTo,
      data: { display_name: person.name, phone: person.phone, interest: 'provider' },
    });
    if (error) {
      failed += 1;
      // Los errores de un proveedor pueden contener información sensible. No volcarlos al terminal.
      log(`No se envió la invitación de ${person.name}. Revisa Auth y SMTP en Supabase. Si ya tiene cuenta, usa recuperación de contraseña; no se modifica su acceso.`);
    } else { sent += 1; log(`Invitación enviada a ${person.name}. Aún falta que la acepte, solicite acceso y configure su autenticador.`); }
  }
  return { sent, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--send')) {
    console.error('Uso: node scripts/provision-pilot.mjs [--send]');
    process.exitCode = 1;
  } else {
    try {
      const result = await provisionPilot({ send: args.includes('--send') });
      if (result.failed) process.exitCode = 1;
    } catch (error) {
      console.error(error instanceof InvitationConfigurationError ? error.message : 'No se pudo preparar la invitación. Revisa la configuración privada.');
      process.exitCode = 1;
    }
  }
}
