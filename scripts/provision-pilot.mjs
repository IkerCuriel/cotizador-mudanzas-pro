import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Ejecutar en el equipo del propietario. Este módulo nunca se importa desde la web.
class InvitationConfigurationError extends Error {}

const members = [
  { id: 'tere', name: 'Tere Curiel', phone: '+525529061098', emailVariable: 'MOVEFLOW_TERE_EMAIL', confirmationVariable: 'MOVEFLOW_TERE_EMAIL_CONFIRMED' },
  { id: 'marco', name: 'Marco Curiel', phone: '+525614492452', emailVariable: 'MOVEFLOW_MARCO_EMAIL', confirmationVariable: 'MOVEFLOW_MARCO_EMAIL_CONFIRMED' },
];

function selectedMember(id) {
  const member = members.find((candidate) => candidate.id === id);
  if (!member) throw new InvitationConfigurationError('Selecciona una sola persona con --member tere o --member marco.');
  return member;
}

export function parseInvitationArguments(args) {
  let member; let mode;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--member' && member === undefined) {
      member = selectedMember(args[++index]).id;
    } else if ((argument === '--send' || argument === '--dry-run') && mode === undefined) {
      mode = argument;
    } else {
      throw new InvitationConfigurationError('Uso: node scripts/provision-pilot.mjs [--member tere|marco] [--dry-run|--send]. Para enviar, selecciona una sola persona.');
    }
  }
  if (mode === '--send') selectedMember(member);
  return { member, send: mode === '--send' };
}

function httpsOrigin(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new InvitationConfigurationError(`Falta una URL válida para ${label}.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^\/?$/.test(url.pathname)) {
    throw new InvitationConfigurationError(`Usa el origen HTTPS de ${label}, sin credenciales ni rutas.`);
  }
  return url.origin;
}

export function prepareInvitations(env, memberId) {
  const member = selectedMember(memberId);
  if (env[member.confirmationVariable] !== 'true') throw new InvitationConfigurationError(`Confirma primero que ${member.name} controla su correo real mediante ${member.confirmationVariable}=true. Los correos provisionales y la antigua confirmación conjunta no permiten enviar invitaciones.`);
  const url = httpsOrigin(env.SUPABASE_URL, 'Supabase');
  const site = httpsOrigin(env.MOVEFLOW_SITE_URL, 'la página');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* A new secret key is not a JWT. */ }
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key) && role !== 'service_role') {
    throw new InvitationConfigurationError('Falta la clave de servidor de Supabase. Nunca uses un nombre VITE_ para ella.');
  }
  if (env.MOVEFLOW_PRIVACY_READY !== 'true') throw new InvitationConfigurationError('Completa el aviso de privacidad y activa MOVEFLOW_PRIVACY_READY antes de invitar.');
  const email = String(env[member.emailVariable] || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvitationConfigurationError(`Falta el correo individual de ${member.name}.`);
  const other = members.find((candidate) => candidate.id !== member.id);
  if (email === String(env[other.emailVariable] || '').trim().toLowerCase()) throw new InvitationConfigurationError('Tere y Marco deben usar correos distintos para conservar accesos individuales.');
  const recipients = [{ name: member.name, phone: member.phone, email }];
  return { url, key, redirectTo: `${site}/cuenta.html?mode=invite`, recipients };
}

export async function provisionPilot({ env = process.env, member, send = false, create = createClient, log = console.log } = {}) {
  const selection = member === undefined ? members : [selectedMember(member)];
  if (!send) {
    log('Modo revisión: no se crea ninguna cuenta ni se envían correos.');
    for (const person of selection) log(`${person.name}: revisión sin consultar el estado de su cuenta. Para invitar, usa --member ${person.id} --send y confirma ${person.confirmationVariable}=true solo después de verificar su correo real.`);
    log('La revisión no valida la conexión ni envía invitaciones. Los correos provisionales son referencias locales, no accesos creados. Cada persona elegirá su contraseña; el acceso requiere aprobación y segundo factor.');
    return { sent: 0, failed: 0 };
  }
  const configuration = prepareInvitations(env, member);
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
  try {
    const result = await provisionPilot(parseInvitationArguments(process.argv.slice(2)));
    if (result.failed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof InvitationConfigurationError ? error.message : 'No se pudo preparar la invitación. Revisa la configuración privada.');
    process.exitCode = 1;
  }
}
