import { loadEnv } from 'vite';
import { readCloudConfig } from '../src/cloud.js';
import { readLegalConfig } from '../src/legal-config.js';
import { assertPublicEnvironment } from './public-env.mjs';
import { PUBLIC_SITE_URL } from '../site.config.js';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const failures = [];
try { assertPublicEnvironment(env); } catch (error) { failures.push(error.message); }
if (!readCloudConfig(env).configured) failures.push('Conectar URL y clave pública de Supabase.');
if (!readLegalConfig(env).ready) failures.push('Completar identidad, domicilio y teléfono comercial del operador, y correo público de soporte; revisar avisos antes de marcar VITE_PRIVACY_READY=true.');
let url;
try { url = new URL(env.VITE_SITE_URL || env.CF_PAGES_URL || PUBLIC_SITE_URL); } catch {}
if (!url || url.protocol !== 'https:' || url.pathname !== '/' || url.username || url.password || url.search || url.hash) failures.push('Definir VITE_SITE_URL con el origen HTTPS final para la vista previa social.');
if (failures.length) { console.error('Pendientes para abrir el registro público:\n- ' + failures.join('\n- ')); process.exitCode = 1; }
else console.log('Configuración local completa. Aún debes verificar SMTP, confirmación de correo, RLS y migraciones remotas, proveedor piloto y aceptación de solicitudes en el servidor. Este chequeo no certifica cumplimiento legal ni prueba la conexión.');
