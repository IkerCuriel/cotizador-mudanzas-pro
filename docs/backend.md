# Backend de cuentas y solicitudes

Se implementó Supabase Auth + PostgreSQL con permisos en la base de datos. La página usa únicamente la URL y la clave pública de Supabase; no requiere ni debe incluir una clave `service_role`. La migración no publica servicios, crea cuentas reales ni envía mensajes por sí sola.

## Qué funciona al conectar Supabase

- Registro por correo y contraseña con confirmación del correo.
- Rol inicial `applicant` para todos los registros, independientemente de los metadatos enviados por el navegador. El trigger solo copia nombre, teléfono y empresa al perfil como texto de contacto limitado; nunca roles ni acceso. Si el registro declara `privacy_accepted=true` y la versión del aviso coincide con la vigente, guarda una evidencia independiente en la auditoría privada con fecha del servidor.
- Solicitudes privadas del usuario y bandeja de las empresas a las que se asignaron.
- Notificaciones dentro del panel guardadas en la misma transacción que la solicitud.
- Aprobación manual de empresas con plan piloto gratuito y fecha de vencimiento.
- Administradores y superusuario con permisos comprobados en el servidor.
- Límites de cinco solicitudes por diez minutos y veinte por día por cuenta verificada.

No hay pagos, suscripciones cobradas, correo de novedades, notificaciones push ni mensajes automáticos a WhatsApp. La renovación del piloto es manual; no equivale a cobrar una suscripción. La notificación persiste en el panel aunque el destinatario esté desconectado, pero no despierta el teléfono.

## Entorno local

1. Instalar Docker y la CLI de Supabase según su [guía oficial](https://supabase.com/docs/guides/local-development).
2. En la carpeta del proyecto ejecutar `npx supabase start`. La configuración está en `supabase/config.toml`.
3. En un entorno local nuevo, aplicar `npx supabase db reset`. **Este comando borra y reconstruye la base local**; no utilizarlo para conservar datos. Para bases existentes usar las migraciones con respaldo y revisión.
4. Copiar la URL y la clave pública locales a `.env.local` con los nombres `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Revisar `.env.example` para el resto de la configuración.
5. Abrir la aplicación, registrarse y confirmar el correo en el buzón de pruebas de Supabase, normalmente `http://127.0.0.1:54324`.

Las pruebas automáticas no necesitan Docker: `npm test` usa PostgreSQL en WebAssembly (PGlite) para ejecutar la migración y las políticas reales. La simulación se limita a la tabla y la identificación del servicio Auth; no prueba el envío de correo, GoTrue, PostgREST o la infraestructura de Supabase.

También puede ejecutarse `supabase/tests/authorization.sql` contra un Supabase local/de pruebas ya migrado:

```sh
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authorization.sql
```

El archivo abre una transacción, crea usuarios sintéticos, cambia al rol `authenticated` o `anon`, comprueba aislamiento y hace `ROLLBACK`. No ejecutarlo en producción. Los UUID de prueba son fijos y una colisión hace fallar la prueba sin sobrescribir registros.

## Primer superusuario y negocio familiar

1. Crear la cuenta de Iker, verificar su correo y comprobarla en Authentication > Users. Utilizar el correo confirmado del propietario; **el correo no concede un rol**.
2. Copiar el UUID de esa cuenta verificada.
3. Revisar `supabase/bootstrap-owner.sql`, reemplazar el UUID vacío y ejecutarlo en SQL Editor con el rol `postgres`. El archivo se detiene si ya hay un superusuario; no existe un botón público para crear otro.
4. Abrir otra cuenta para el negocio familiar, confirmar su correo y solicitar el rol de empresa con `join_provider` desde la página. No usar la cuenta de superusuario como cuenta de empresa.
5. Como superusuario, aprobar la empresa con plan piloto, una fecha de vencimiento y la opción de negocio familiar. Esto configura el destinatario familiar de manera atómica. Los administradores pueden aprobar/vencer planes, pero solo el superusuario puede cambiar cuál es el negocio familiar.
6. Completar nombre y domicilio del responsable, contacto para privacidad, aviso y consentimiento en la página. Revisar los datos reales y las finalidades antes de habilitar recepción.
7. Solo entonces activar recepción en SQL Editor:

```sql
update private.platform_settings
set accepting_requests = true
where singleton;
```

La migración crea `accepting_requests=false`, `network_enabled=false` y `privacy_version='2026-10-30'`. Sin una empresa familiar aprobada con plan vigente, el envío falla y no guarda una falsa confirmación. La versión del aviso debe coincidir con la que envía la web. Si cambia el aviso, actualizar ambos valores y volver a pedir consentimiento.

## Esquema público y contrato del cliente

Todas las lecturas están protegidas por RLS. No usar una clave privilegiada en las consultas del navegador.

| Tabla | Datos principales | Lectura |
| --- | --- | --- |
| `profiles` | `id`, `role`, `display_name`, `phone`, `company_name`, `provider_status`, `plan_code`, `plan_expires_at`, `is_family` | Perfil propio; operadores pueden leer todos |
| `move_requests` | `id` UUID, `reference`, `owner_id`, `payload`, `audience`, `status`, `privacy_version`, fechas | Dueño; operadores; empresa asignada con aprobación y plan vigentes |
| `request_recipients` | `request_id`, `provider_id`, `created_at` | Operadores; empresa asignada todavía autorizada |
| `notifications` | `id`, `user_id`, `request_id`, `title`, `read_at`, `created_at` | Solo destinatario; el título no contiene datos del cliente |

Los campos `role`, `provider_status`, `plan_code`, `plan_expires_at` e `is_family` no se pueden editar directamente desde el navegador. El usuario puede modificar únicamente `display_name`, `phone` y `company_name` de su propio perfil con `profiles.update(...)`. Todas las demás escrituras usan funciones autorizadas.

| RPC | Parámetros | Resultado / permiso |
| --- | --- | --- |
| `public_site_config` | Ninguno | Objeto `{accepting_requests, network_enabled, privacy_version}`; público, sin datos personales |
| `submit_request` | `p_reference`, `p_payload`, `p_audience='family'`, `p_privacy_version='2026-10-30'` | Fila `move_requests`; cuenta con correo confirmado |
| `join_provider` | `p_company_name` | Perfil; convierte solicitante en empresa pendiente, no concede acceso a contactos |
| `set_provider_access` | `p_user_id`, `p_status`, `p_expires_at`, `p_is_family=false` | Perfil; administrador o superusuario. Solo superusuario cambia `is_family` |
| `set_user_role` | `p_user_id`, `p_role` | Perfil; solo superusuario, destino `applicant`, `provider` o `admin`. Nunca crea otro superusuario ni modifica uno existente |
| `cancel_request` | `p_request_id` | Solicitud; solo dueño, excepto ya finalizada |
| `set_request_status` | `p_request_id`, `p_status` | Solicitud; operadores; `contacted`, `negotiating`, `completed`, `cancelled` |
| `mark_notification_read` | `p_notification_id` | Notificación; solo destinatario |

`submit_request` acepta `p_payload={fields,rooms,inventory}` del modelo normalizado. Los límites del catálogo, los tamaños, las cantidades, los domicilios, el contacto, los servicios y el consentimiento se comprueban en PostgreSQL. Se descartan campos de control ajenos al contrato. El servidor decide dueño, UUID, estado, fechas y destinatarios.

La referencia `MF-...` es única **por dueño**. Reenviar la misma referencia con los mismos datos devuelve la misma solicitud sin duplicar avisos; reutilizarla con datos distintos falla. El contacto de la solicitud pertenece a quien la crea; la verificación del correo de la cuenta no demuestra que el teléfono de contacto sea suyo.

## Red de empresas y suscripciones futuras

El piloto entrega cada solicitud familiar únicamente a la cuenta familiar vigente. Activar `network_enabled` requiere definir las reglas de la red y actualizar el aviso antes de compartir datos con terceros. El cliente debe elegir `audience='network'` y dar **además** `payload.fields.networkConsent=true`; el consentimiento general no basta. La asignación se realiza en ese momento a las empresas aprobadas con plan vigente. No hay inscripción automática de empresas nuevas en solicitudes antiguas.

Si un plan vence o se suspende, RLS retira inmediatamente el acceso a los datos de solicitudes. Cancelar una solicitud también retira acceso a las empresas; la plataforma no puede borrar copias que una empresa ya haya recibido. Solicitudes finalizadas o canceladas no se reabren desde el panel.

Para cobrar después: agregar un procesador, verificación de firmas de webhooks en un servidor, eventos de pago idempotentes, productos/precios reales y acceso derivado del estado de cobro. Nunca aceptar `plan=paid`, precios o fechas de vigencia enviados por el cliente. El esquema actual solo admite `plan_code='pilot'` para impedir que el prototipo aparente un cobro real.

## Operación y límites

- En el proyecto remoto mantener desactivado el registro público de Supabase Auth hasta completar privacidad y la configuración. El bloqueo de la interfaz no impide llamadas directas a Auth. Las cuentas de preparación pueden crearse de manera administrativa; `enable_signup=true` en el archivo local es para pruebas.
- Configurar URL de producción y redirecciones permitidas en Supabase Auth. `config.toml` local no configura automáticamente el proyecto remoto.
- Mantener activada la confirmación por correo. Para registros públicos configurar un proveedor SMTP y protección antiabuso acorde al volumen; no asumir que el correo predeterminado sirve para clientes externos.
- Revisar copias de seguridad, conservación, atención de derechos de privacidad y eliminación de datos antes de operar. Borrar una cuenta de Auth borra en cascada su perfil, sus solicitudes, asignaciones y notificaciones. Los eventos de auditoría conservan UUID y acción, sin domicilios/teléfonos; deben tener su propia política de conservación.
- `private.audit_events` registra cambios de rol/acceso, estado y aceptación del aviso de registro. El evento `account_privacy_accepted` guarda la versión vigente y la fecha del servidor; no usa fechas enviadas por el cliente. Cambiar después `user_metadata` no modifica ni elimina esa evidencia. Una invitación administrativa, ausencia de aceptación o versión no coincidente no genera evidencia: no se presume consentimiento. Es un registro de la declaración de aceptación, no una verificación adicional de identidad. Solo operación mediante SQL puede leer esta auditoría; no contiene texto de solicitudes.
- Un operador con acceso a SQL o una clave privilegiada puede eludir RLS: proteger esas credenciales y habilitar MFA en las cuentas del proveedor.
- La aprobación piloto es una decisión del negocio; no representa una verificación de calidad, seguro o garantía sobre la empresa.

Referencias técnicas: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones y seguridad](https://supabase.com/docs/guides/database/functions), [datos de usuario y triggers](https://supabase.com/docs/guides/auth/managing-user-data), [pruebas de correo local](https://supabase.com/docs/guides/auth/testing-auth-flows).
