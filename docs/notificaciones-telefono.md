# Avisos al teléfono de Tere, Marco y los negocios autorizados

Estado del canal Web Push: **preparado en el código, pendiente de conexión y prueba real**. No se han creado claves ni enviado notificaciones. Escribir un teléfono en una cuenta no activa avisos automáticos.

La web pública presenta una sola atención, **Mudanzas D’Curiel**, sin tarjetas personales ni selector. Sus botones de contacto abren la línea de Tere con un mensaje general; la ficha revisada en el modal abre esa misma línea con los datos completados. En ambos casos, el cliente debe pulsar **Enviar** dentro de WhatsApp. Marco sigue previsto como integrante del equipo, pero no recibe una copia automática. No se han cambiado cuentas de WhatsApp, vinculado teléfonos ni enviado mensajes de prueba.

La [guía de WhatsApp del negocio](whatsapp-negocio.md) describe el funcionamiento actual y las dos opciones siguientes: vincular un teléfono de Marco a la misma cuenta de WhatsApp Business de Tere, o construir una integración de servidor con WhatsApp Business Platform para avisar a dos números independientes. Esta integración no está implementada ni activada; es distinta del canal Web Push de esta guía.

## Qué verá cada asesor

Desde su propia cuenta, después de verificar su correo y segundo factor, podrá pulsar **Activar avisos en este dispositivo** y aceptar el permiso del navegador. Se permiten hasta cinco dispositivos activos por cuenta. El permiso es voluntario y no se pide al abrir la página.

El aviso dice: «Hay una nueva solicitud disponible. Entra a tu panel para revisarla». No incluye nombre, teléfono, domicilio, inventario ni precio del cliente. Al tocarlo abre el panel, que exige la cuenta y el segundo factor. El sistema operativo puede mostrar este texto genérico en la pantalla bloqueada.

**No se garantiza entrega inmediata.** Depende de Internet, el navegador, las restricciones de batería, el permiso, el modo de concentración y los servicios de Google, Mozilla o Apple. El panel es la fuente de seguimiento; un aviso aceptado por el servicio push no confirma que la persona lo leyó. WhatsApp Business automático o SMS requieren otra integración y sus propias condiciones/costos; no forman parte de esta implementación.

Para una solicitud familiar recibida en Supabase, el sistema intentará enviar a Tere y Marco su aviso si ambos tienen cuentas distintas, están aprobados, pertenecen al equipo familiar, tienen vigencia y han activado un dispositivo. El enlace manual de WhatsApp del piloto prepara el mensaje únicamente para Tere y requiere que el cliente lo envíe; no genera una solicitud en Supabase ni un aviso Web Push.

## Requisitos antes de activarlo

1. Conectar el proyecto de Supabase y aplicar las migraciones `001`, `002` y `003` en orden. No usar una clave administrativa en variables `VITE_`.
2. Completar identidad legal, aviso de privacidad y consentimiento del servicio; habilitar recepción solo cuando corresponda.
3. Crear/invitar las cuentas reales con correos individuales. Cada asesor establece una contraseña propia y configura su segundo factor. Aprobar el acceso, vigencia y pertenencia al equipo familiar desde el superusuario.
4. Publicar el sitio por HTTPS, con el manifest y los iconos incluidos en el proyecto. Mantener el mismo origen: mover el sitio a otro dominio exige volver a activar los avisos en los teléfonos.
5. Configurar la función, las claves, el webhook y el reintento periódico descritos abajo. Probar primero con cuentas y solicitudes identificadas como pruebas y con consentimiento de sus participantes.

## Claves y configuración

Generar **una sola pareja VAPID** para este sitio. Puede usarse la herramienta oficial del paquete fijado `web-push@3.6.7`:

```sh
npm exec --package=web-push@3.6.7 -- web-push generate-vapid-keys --json
```

Guardar la clave privada y el secreto del webhook en un gestor de contraseñas del propietario y en **Supabase → Edge Functions → Secrets**. No copiarlos al repositorio, a una captura pública, a la carpeta `public`, a GitHub Actions sin protección ni a variables `VITE_`. No renovar VAPID en cada despliegue: perder la pareja obliga a volver a suscribir los dispositivos.

| Nombre | Dónde | Contenido |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | Secrets de la función | Clave pública VAPID |
| `VAPID_PRIVATE_KEY` | Secrets de la función | Clave privada VAPID |
| `VAPID_SUBJECT` | Secrets de la función | `mailto:` del responsable o URL HTTPS pública de contacto real |
| `PUSH_WEBHOOK_SECRET` | Secrets de la función y configuración protegida del webhook | Secreto aleatorio dedicado, mínimo 32 caracteres, máximo 256 |
| `WEB_PUSH_ENABLED` | Secrets de la función | `true` únicamente al activar |
| `VITE_WEB_PUSH_PUBLIC_KEY` | Configuración del sitio | La misma clave **pública** VAPID |
| `VITE_WEB_PUSH_ENABLED` | Configuración del sitio | `true` únicamente al activar |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son credenciales internas de la función provistas por Supabase. Nunca se envían al navegador. El secreto del webhook es distinto de la clave administrativa y de las contraseñas de los asesores.

## Desplegar el servicio de avisos

Desde la copia local y después de enlazar la CLI con el proyecto correcto:

```sh
supabase functions deploy send-push --no-verify-jwt
```

El flag permite recibir el webhook sin un JWT de usuario; **no deja el servicio abierto**: el código exige el encabezado `x-moveflow-push-secret` y lo compara con el secreto dedicado. Un JWT público o la clave anónima no sirven. No cambiar este control por una clave `VITE_` o por un secreto incluido en el enlace.

La función usa dependencias fijadas `@supabase/supabase-js@2.118.0` y `web-push@3.6.7` mediante imports `npm:`. Incluye `deno.lock` formato 4 y pasó comprobación de tipos con Deno 2.1.4, compatible con la versión anunciada por Supabase. Debe completarse una prueba en el runtime real de Supabase antes de activar producción; las pruebas locales verifican lógica y PostgreSQL, pero no sustituyen esa entrega real.

## Conectar el evento de la base de datos

En **Supabase → Database → Webhooks**, crear un webhook llamado `moveflow_push_on_notification`:

- Tabla: `public.notifications`.
- Evento: solo `INSERT`.
- Método: `POST`.
- Destino: la URL HTTPS real de la función `send-push` del proyecto.
- Encabezados: `Content-Type: application/json` y `x-moveflow-push-secret` con el secreto dedicado.
- No añadir endpoints de teléfonos ni datos del cliente al URL.

El webhook de Supabase ya incluye el evento y el ID. La función ignora el texto, destinatario y endpoint del cuerpo externo: reclama trabajos que existen realmente en la cola y consulta nuevamente permisos y vigencia antes de cada envío. Los encabezados de un webhook pueden quedar en su definición SQL; tratar los respaldos de la base como secretos. Para una instalación con mayor control, construir el disparador con Vault y `pg_net` siguiendo la documentación oficial.

Habilitar el interruptor del servidor desde SQL Editor del propietario, solo después de configurar la función:

```sql
update private.push_settings set enabled = true where singleton;
```

Publicar después el sitio con las dos variables públicas habilitadas. No se envían retrospectivamente solicitudes anteriores a la activación o a la suscripción del teléfono.

## Reintentos y supervisión

El webhook inicia el aviso al crearse una notificación. Los errores transitorios necesitan un trabajo periódico que invoque la misma función con `{"retry":true}` y el mismo encabezado secreto. Sin ese trabajo, los fallos quedan pendientes y no hay recuperación automática.

En Supabase habilitar Cron y `pg_net` desde las integraciones oficiales; estas extensiones **no se activan** en las migraciones portables del repositorio. Guardar mediante la interfaz de Vault dos secretos: `moveflow_push_function_url` (URL real de la función) y `moveflow_push_webhook_secret` (el mismo secreto dedicado). Después, programar:

```sql
select cron.schedule('moveflow-push-retry', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'moveflow_push_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-moveflow-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'moveflow_push_webhook_secret')
    ),
    body := '{"retry":true}'::jsonb,
    timeout_milliseconds := 15000
  );
$$);
```

Se procesan hasta diez dispositivos por llamada. La cola limita cada entrega a cinco intentos, aumenta el intervalo entre intentos y evita reclamar dos veces el mismo trabajo simultáneamente. Cada intento verifica que la solicitud siga visible para el destinatario, sin cancelación, sin lectura previa y con menos de 24 horas. Retirar a alguien del equipo familiar corta sus avisos familiares pendientes.

Una caída justo después de que el proveedor acepte el mensaje y antes de registrar el resultado puede producir una repetición: no se promete entrega «exactamente una vez». El identificador del aviso permite agruparlo/reemplazarlo en el teléfono. Los errores 404/410 desactivan ese dispositivo. No se registran nombres, direcciones, claves ni endpoints en los logs de la función.

La revocación se comprueba antes de enviar, pero no puede retirar un aviso ya aceptado por Google, Mozilla o Apple ni eliminar la pequeña carrera entre esa comprobación y el envío. Por eso el texto es genérico y los datos de clientes solo se consultan tras verificar permisos dentro del panel.

Revisar desde SQL Editor, sin publicar el resultado:

```sql
select status, count(*) from private.push_outbox group by status;
select last_result, count(*) from private.push_outbox where status = 'failed' group by last_result;
```

Definir la retención con el responsable de privacidad. Para la operación piloto, programar revisión y borrado de metadatos de entrega finalizados después de 30 días y de dispositivos inactivos después de 90 días; preservar primero evidencia necesaria de un incidente concreto. No convertir la cola en un historial permanente de navegación.

## Activar en cada teléfono

**Android:** abrir el enlace HTTPS en un navegador compatible, iniciar sesión, verificar el segundo factor y pulsar el botón del panel. Aceptar el permiso. Se recomienda fijar el sitio en la pantalla de inicio para acceder fácilmente.

**iPhone/iPad:** iOS/iPadOS 16.4 o posterior permite Web Push para aplicaciones añadidas a la pantalla de inicio. En Safari: compartir → Añadir a pantalla de inicio; abrir MoveFlow desde ese icono, iniciar sesión, verificar el segundo factor y activar avisos. Si no aparece el permiso, revisar versión y ajustes del sistema. La implementación no necesita pagar Apple Developer.

**Computadora:** también puede activarse desde un navegador compatible. No hacerlo en equipos compartidos. Cada navegador/perfil cuenta como un dispositivo distinto.

La lista actual contempla los endpoints de Chrome/Chromium, Firefox y Safari indicados en el código. Microsoft Edge cuando utiliza Windows Notification Service (`*.notify.windows.com`) y otros proveedores fuera de esa lista no están soportados: el registro fallará de forma segura. Revisar un nuevo proveedor antes de ampliarla.

Para desactivar: usar el botón del panel o retirar el permiso en ajustes del navegador. Cerrar sesión desuscribe este navegador; los otros dispositivos deben desactivarse por separado. Si no hay conexión al servidor, la aplicación intenta cortar la suscripción local; revisar después los dispositivos registrados si persiste un error.

## Apagar los avisos o responder a un incidente

1. Cambiar `WEB_PUSH_ENABLED=false` en Secrets y ejecutar `update private.push_settings set enabled=false where singleton;`.
2. Pausar el webhook y desprogramar `moveflow-push-retry` en Supabase Cron. Cambiar también `VITE_WEB_PUSH_ENABLED=false` y volver a publicar para ocultar la activación.
3. Si se filtró el secreto del webhook, rotarlo tanto en la función como en webhook/Vault. Revisar accesos y registros. Si se filtró VAPID privada, crear otra pareja y volver a suscribir los dispositivos.
4. Si se comprometió una cuenta, suspenderla y revocar sus sesiones, además de recuperar contraseña y segundo factor por el procedimiento del propietario. Las solicitudes quedan protegidas por las políticas del servidor.

El código fuente permite reconstruir el servicio, pero **no recupera por sí solo** la base de datos, claves, cuentas, dominios ni permisos del teléfono. Respaldar por separado el código, la base y los secretos del propietario.

## Pruebas incluidas

```sh
node --test tests/push.test.js tests/push.backend.test.js
```

Cubren roles, AAL2, expiración, aislamiento, máximo de dispositivos, destinos SSRF, cambio de cuenta, revocación de pertenencia familiar, cola privada, arrendamientos de entrega y reintentos limitados. El service worker se prueba para impedir que un payload cambie el texto o abra un dominio externo. No tiene controlador `fetch`, caché ni modo sin conexión para el panel.

Antes del lanzamiento real: verificar entrega en los teléfonos de ambos asesores, clic con sesión cerrada, desactivación, suspensión/expiración, fallo temporal del proveedor, ausencia del webhook y recuperación con Cron. Verificar también el costo/límite vigente del plan de Supabase si crece el volumen.

## Fuentes oficiales consultadas — 30 de octubre de 2026

- [PushSubscription y contexto HTTPS — MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription).
- [Web Push en iOS/iPadOS, pantalla de inicio y permiso por acción — WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- [Webhooks de base de datos y manejo de sus encabezados — Supabase](https://supabase.com/docs/guides/database/webhooks).
- [Autenticación de Edge Functions — Supabase](https://supabase.com/docs/guides/functions/auth).
- [Programación de funciones con Cron, pg_net y Vault — Supabase](https://supabase.com/docs/guides/functions/schedule-functions).
- [Dependencias npm y APIs Node en Edge Functions — Supabase](https://supabase.com/docs/guides/functions/dependencies).
- [Web Push, cifrado, VAPID y generación de peticiones — repositorio oficial web-push](https://github.com/web-push-libs/web-push).
- [Endpoints de producción de Firefox — Mozilla](https://mozilla-services.github.io/autopush-rs/).
- [Endpoint Web Push de Chromium — código oficial](https://chromium.googlesource.com/chromium/src/+/refs/tags/148.0.7734.4/components/push_messaging/push_messaging_constants.cc).

Los dominios permitidos son deliberadamente exactos. Si un navegador introduce otro hostname, revisar su documentación y añadirlo explícitamente al validador y a SQL; no ampliar la lista a cualquier URL HTTPS.
