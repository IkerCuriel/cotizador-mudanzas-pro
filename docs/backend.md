# Backend de cuentas y solicitudes

Se implementó Supabase Auth + PostgreSQL con permisos en la base de datos. La página usa únicamente la URL y la clave pública de Supabase; no requiere ni debe incluir una clave `service_role`. **La nube de producción, las cuentas y los avisos al teléfono siguen pendientes de activación.** Las migraciones no publican servicios, crean cuentas reales ni envían mensajes por sí solas.

Aplicar en orden `202610300001_platform.sql` (cuentas y solicitudes), `202610300002_family_team_security.sql` (varios asesores familiares y segundo factor), `202610300003_push_notifications.sql` (dispositivos y cola de avisos), `202610300004_business_routing.sql` (negocios, equipos y cuotas), `202610300005_other_property.sql` (otro inmueble en origen), `20261031001155_route_destinations.sql` (hasta cinco destinos adicionales en orden e identificadores de ubicaciones seleccionadas) y `20261031010000_provider_plans.sql` (catálogo mensual preparado, cortesías por integrante y consulta de elegibilidad). La migración de destinos conserva solicitudes anteriores, valida las nuevas paradas y no guarda coordenadas ni respuestas completas de Google; no activa recepción ni modifica permisos. Anuncia `route_destinations_version=1` en `public_site_config` para que la web no envíe rutas nuevas a una base que aún las descartaría. La migración de planes no activa pagos ni concede cortesías automáticamente; incorpora `get_my_access_status`, que requiere la interfaz actual para habilitar accesos de proveedor. No volver a ejecutar migraciones ya aplicadas ni reinicializar una base con datos reales.

## Destino por negocio y costo acotado

La migración 004 crea `businesses`, `business_memberships` y el contador privado `business_monthly_usage`; añade `business_id` a cada solicitud directa. D’Curiel tiene el identificador `d-curiel`. Este registro comercial no crea cuentas Auth ni acredita una verificación legal: la recepción global sigue cerrada y requiere integrantes aprobados con correo confirmado y segundo factor.

Cada solicitud se guarda una sola vez. El servidor resuelve hasta **10 integrantes activos** del negocio; crea asignaciones y avisos dentro de la misma transacción. Solo el personal asignado, aún autorizado y vigente, puede consultar la ficha. Agregar un integrante después no le concede solicitudes anteriores. Suspender el negocio o retirar la membresía revoca lecturas y la elegibilidad de los avisos pendientes.

El cupo inicial del piloto es **300 solicitudes por mes UTC por negocio**, configurable por administración en servidor; no es una oferta comercial ni un cobro. Un reintento idéntico no vuelve a consumir cuota. Cancelar no libera cuota. Sin destinatarios, toda la operación se revierte. La base bloquea la fila del negocio durante la asignación y el consumo para serializar esos cambios; las pruebas locales no sustituyen una prueba de concurrencia con conexiones reales.

`submit_request(..., 'family', ...)` conserva compatibilidad hacia D’Curiel. `network` falla explícitamente incluso si se cambia el antiguo interruptor: no existe difusión a todos los mudanceros. El frontend actual solicita `submit_business_request` con un destino fijo; el catálogo y las páginas públicas de otros negocios quedan para otra etapa. `public_site_config` publica `business_routing_version=1`, requisito de esta web para ofrecer el guardado en línea.

Para incorporar otro negocio por administración, revisar `supabase/operations/setup-business.sql`. Sus valores vacíos abortan por defecto y requiere identidades verificadas. No se debe pegar una dirección de correo como si fuera el UUID de Auth ni otorgar pertenencia por nombre comercial.

La lista del panel proyecta solo nombre, ruta y fecha, hasta 20 filas más una para decidir si existe otra página, con cursor `(created_at,id)` e índices de negocio/propietario. La ficha completa se carga al seleccionar. La bandeja de proveedores se delimita por negocio y la del cliente por propietario antes de RLS. No se mantiene una consulta periódica por cada usuario; actualización manual o al regresar a la pestaña con límite temporal. Las listas administrativas todavía muestran solo las primeras 100 cuentas y requieren una búsqueda/paginación administrativa antes de operación masiva.

## Qué funciona al conectar Supabase

- Registro por correo y contraseña con confirmación del correo.
- Rol inicial `applicant` para todos los registros, independientemente de los metadatos enviados por el navegador. El trigger solo copia nombre, teléfono y empresa al perfil como texto de contacto limitado; nunca roles ni acceso. Si el registro declara `privacy_accepted=true` y la versión del aviso coincide con la vigente, guarda una evidencia independiente en la auditoría privada con fecha del servidor.
- Solicitudes privadas del usuario y bandeja de las empresas a las que se asignaron.
- Notificaciones dentro del panel guardadas en la misma transacción que la solicitud.
- Aprobación manual de empresas con plan piloto gratuito y fecha de vencimiento.
- Asesores familiares con cuentas individuales: una solicitud nueva puede asignarse a Tere y Marco si ambos están aprobados y vigentes.
- Segundo factor obligatorio para asesores, administradores y superusuario, comprobado por RLS y funciones de servidor mediante `aal2`.
- Límites de cinco solicitudes por diez minutos y veinte por día por cuenta verificada.

No hay pagos, suscripciones cobradas, correo de novedades ni mensajes automáticos a WhatsApp. La renovación del piloto es manual; no equivale a cobrar una suscripción. Las notificaciones persisten en el panel. El canal **Web Push está preparado y apagado por defecto**: requiere claves de servidor, función, webhook, reintentos y permiso de cada dispositivo. Su implementación no demuestra entrega real ni inmediata; seguir la [guía de avisos al teléfono](notificaciones-telefono.md).

## Entorno local

1. Instalar Docker y la CLI de Supabase según su [guía oficial](https://supabase.com/docs/guides/local-development).
2. En la carpeta del proyecto ejecutar `npx supabase start`. La configuración está en `supabase/config.toml`.
3. En un entorno local nuevo, aplicar `npx supabase db reset`. **Este comando borra y reconstruye la base local**; no utilizarlo para conservar datos. Para bases existentes usar las migraciones con respaldo y revisión.
4. Copiar la URL y la clave pública locales a `.env.local` con los nombres `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Revisar `.env.example` para el resto de la configuración.
5. Abrir la aplicación, registrarse y confirmar el correo en el buzón de pruebas de Supabase, normalmente `http://127.0.0.1:54324`.

Las pruebas automáticas no necesitan Docker: `npm test` usa PostgreSQL en WebAssembly (PGlite) para ejecutar las migraciones y las políticas reales. La simulación se limita a la tabla y la identificación del servicio Auth; no prueba el envío de correo, GoTrue, PostgREST, la entrega al teléfono o la infraestructura de Supabase.

También puede ejecutarse `supabase/tests/authorization.sql` contra un Supabase local/de pruebas ya migrado:

```sh
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authorization.sql
```

El archivo abre una transacción, crea usuarios sintéticos, cambia al rol `authenticated` o `anon`, comprueba aislamiento y hace `ROLLBACK`. No ejecutarlo en producción. Los UUID de prueba son fijos y una colisión hace fallar la prueba sin sobrescribir registros.

## Primer superusuario y negocio familiar

1. Crear la cuenta del propietario, verificar su correo y comprobarla en Authentication > Users. Utilizar su correo confirmado; **el correo no concede un rol**.
2. Copiar el UUID de esa cuenta verificada.
3. Revisar `supabase/bootstrap-owner.sql`, reemplazar el UUID vacío y ejecutarlo en SQL Editor con el rol `postgres`. El archivo se detiene si ya hay un superusuario; no existe un botón público para crear otro.
4. Invitar primero a Tere con su correo real siguiendo [seguridad y cuentas](seguridad-y-cuentas.md); Marco queda pendiente hasta confirmar su propio correo real. El script exige seleccionar un integrante y confirmar su dirección individualmente. Cada persona acepta el aviso, elige su contraseña, solicita acceso mediante `join_provider` y configura su autenticador. No usar la cuenta de superusuario como cuenta de asesor ni compartir contraseñas.
5. Como superusuario, verificar el segundo factor y aprobar cada cuenta activada con un periodo inicial real de preparación y pertenencia al equipo de D’Curiel (`is_family=true`). Después, configurar para los UUID verificados de Tere y Marco la cortesía administrativa descrita en [planes y cobros](planes-y-cobros.md), sin fecha ficticia ni cargo. La migración no adivina ni crea sus cuentas. Tere puede empezar sin esperar la activación de Marco. La migración 002 sustituye el destinatario único anterior por varios miembros. La 004 sincroniza ese permiso con la membresía de D’Curiel, sin asignar pertenencia a otras empresas. Los administradores pueden aprobar/vencer planes, pero solo el superusuario cambia la pertenencia familiar. Agregar un asesor no le asigna solicitudes anteriores.
6. Completar nombre y domicilio del responsable, contacto para privacidad, aviso y consentimiento en la página. Revisar los datos reales y las finalidades antes de habilitar recepción.
7. Solo entonces activar recepción en SQL Editor:

```sql
update private.platform_settings
set accepting_requests = true
where singleton;
```

La migración crea `accepting_requests=false`, `network_enabled=false` y `privacy_version='2026-10-30'`. Sin una empresa familiar aprobada con plan vigente, el envío falla y no guarda una falsa confirmación. La versión del aviso debe coincidir con la que envía la web. Si cambia el aviso, actualizar ambos valores y volver a pedir consentimiento.

## Esquema público y contrato del cliente

Todas las lecturas están protegidas por RLS. Para el equipo, consultar solicitudes, asignaciones y notificaciones exige `aal2`; se permite leer el perfil propio antes de MFA para configurar el autenticador. Los operadores necesitan el segundo factor para consultar otros perfiles o administrar. No usar una clave privilegiada en las consultas del navegador.

| Tabla | Datos principales | Lectura |
| --- | --- | --- |
| `profiles` | `id`, `role`, `display_name`, `phone`, `company_name`, `provider_status`, `plan_code`, `plan_expires_at`, `is_family` | Perfil propio; operadores pueden leer todos |
| `businesses` | `id`, `slug`, `name`, `whatsapp`, `status`, `plan_code`, `monthly_request_limit` | Integrantes autorizados y operadores; no escritura pública |
| `business_memberships` | `business_id`, `user_id`, `member_role`, `active` | Pertenencia propia autorizada y operadores; no autoasignación |
| `move_requests` | `business_id`, `id` UUID, `reference`, `owner_id`, `payload`, `audience`, `status`, `privacy_version`, fechas | Dueño; operadores; empresa asignada con aprobación y plan vigentes |
| `request_recipients` | `request_id`, `provider_id`, `created_at` | Operadores; empresa asignada todavía autorizada |
| `notifications` | `id`, `user_id`, `request_id`, `title`, `read_at`, `created_at` | Solo destinatario; el título no contiene datos del cliente |
| `push_devices` | Dispositivo, endpoint, claves de suscripción, vigencia | Solo dispositivos propios del equipo con acceso autorizado y segundo factor |

Los campos `role`, `provider_status`, `plan_code`, `plan_expires_at` e `is_family` no se pueden editar directamente desde el navegador. El usuario puede modificar únicamente `display_name`, `phone` y `company_name` de su propio perfil con `profiles.update(...)`. Todas las demás escrituras usan funciones autorizadas.

| RPC | Parámetros | Resultado / permiso |
| --- | --- | --- |
| `public_site_config` | Ninguno | Objeto `{accepting_requests, network_enabled:false, privacy_version, default_business_slug, business_routing_version:1}`; público, sin datos personales |
| `submit_business_request` | `p_reference`, `p_payload`, `p_business_slug='d-curiel'`, `p_privacy_version` | Solicitud directa atómica; cuenta verificada, negocio habilitado, cuota y equipo disponible |
| `get_my_businesses` | Ninguno | Hasta 20 negocios autorizados; equipo con segundo factor |
| `get_my_access_status` | Ninguno | Elegibilidad del usuario actual, sin motivos privados; correo verificado, `false` sin MFA |
| `set_provider_complimentary_access` | `p_user_id`, `p_enabled` | Cortesía solo para un integrante aprobado de D’Curiel; exige superusuario con MFA y audita el cambio |
| `submit_request` | `p_reference`, `p_payload`, `p_audience='family'`, `p_privacy_version='2026-10-30'` | Compatibilidad familiar hacia D’Curiel; la red general se rechaza |
| `join_provider` | `p_company_name` | Perfil; convierte solicitante en empresa pendiente, no concede acceso a contactos |
| `set_provider_access` | `p_user_id`, `p_status`, `p_expires_at`, `p_is_family=false` | Perfil; administrador o superusuario. Solo superusuario cambia `is_family` |
| `set_user_role` | `p_user_id`, `p_role` | Perfil; solo superusuario, destino `applicant`, `provider` o `admin`. Nunca crea otro superusuario ni modifica uno existente |
| `cancel_request` | `p_request_id` | Solicitud; solo dueño, excepto ya finalizada |
| `set_request_status` | `p_request_id`, `p_status` | Solicitud; operadores; `contacted`, `negotiating`, `completed`, `cancelled` |
| `mark_notification_read` | `p_notification_id` | Notificación; solo destinatario |

`submit_request` acepta `p_payload={fields,rooms,inventory}` del modelo normalizado. Los límites del catálogo, los tamaños, las cantidades, los domicilios, el contacto, los servicios y el consentimiento se comprueban en PostgreSQL. Se descartan campos de control ajenos al contrato. El servidor decide dueño, UUID, estado, fechas y destinatarios.

La referencia `MF-...` es única **por dueño**. Reenviar la misma referencia con los mismos datos devuelve la misma solicitud sin duplicar avisos; reutilizarla con datos distintos falla. El contacto de la solicitud pertenece a quien la crea; la verificación del correo de la cuenta no demuestra que el teléfono de contacto sea suyo.

## Red de empresas y suscripciones futuras

Cada solicitud se entrega únicamente a los integrantes autorizados del negocio elegido, con aprobación y vigencia activas en ese momento; el piloto tiene como destino fijo D’Curiel. La migración 004 rechaza `audience='network'` incluso si se cambia `network_enabled`: no existe difusión general que pueda activarse con un interruptor o consentimiento adicional. Incorporar otros negocios requiere configurar sus equipos y ofrecer una selección explícita del destinatario, además de revisar el aviso y las reglas comerciales. No hay inscripción automática de empresas nuevas en solicitudes antiguas. Retirar a un asesor del equipo familiar revoca su acceso a las solicitudes familiares previamente asignadas.

Si vence el acceso temporal y no hay otra concesión válida, RLS retira el acceso a los datos de solicitudes. Una suspensión bloquea también a quienes tengan cortesía. Cancelar una solicitud también retira acceso a las empresas; la plataforma no puede borrar copias que una empresa ya haya recibido. Solicitudes finalizadas o canceladas no se reabren desde el panel.

Para cobrar después: agregar un procesador, verificación de firmas de webhooks en un servidor, eventos de pago idempotentes, productos/precios reales y acceso derivado del estado de cobro. Nunca aceptar `plan=paid`, precios o fechas de vigencia enviados por el cliente. Los perfiles y negocios mantienen `plan_code='pilot'`; el catálogo privado `monthly_149` reserva el precio de 149 MXN/mes con checkout deshabilitado. La preparación no aparenta un cobro real. Ver [planes y cobros](planes-y-cobros.md) para el alcance y las condiciones de activación.

## Operación y límites

La migración 003 mantiene `private.push_settings.enabled=false`. Los dispositivos se registran mediante RPC, con segundo factor, comprobación de la cuenta y máximo de cinco dispositivos activos. `private.push_outbox` solo se procesa desde el servidor autorizado; no es una bandeja pública. La función revalida permisos, vigencia y pertenencia familiar antes de cada aviso y envía texto genérico, sin información del cliente. El detalle de activación, reintentos, revocación y limitaciones está en [notificaciones al teléfono](notificaciones-telefono.md).

- En el proyecto remoto mantener desactivado el registro público de Supabase Auth hasta completar privacidad y la configuración. El bloqueo de la interfaz no impide llamadas directas a Auth. Las cuentas de preparación pueden crearse de manera administrativa; `enable_signup=true` en el archivo local es para pruebas.
- Configurar URL de producción y redirecciones permitidas en Supabase Auth. `config.toml` local no configura automáticamente el proyecto remoto.
- Mantener activada la confirmación por correo. Para registros públicos configurar un proveedor SMTP y protección antiabuso acorde al volumen; no asumir que el correo predeterminado sirve para clientes externos.
- Revisar copias de seguridad, conservación, atención de derechos de privacidad y eliminación de datos antes de operar. Borrar una cuenta de Auth borra en cascada su perfil, sus solicitudes, asignaciones y notificaciones. Los eventos de auditoría conservan UUID y acción, sin domicilios/teléfonos; deben tener su propia política de conservación.
- `private.audit_events` registra cambios de rol/acceso, estado y aceptación del aviso de registro. El evento `account_privacy_accepted` guarda la versión vigente y la fecha del servidor; no usa fechas enviadas por el cliente. Cambiar después `user_metadata` no modifica ni elimina esa evidencia. Enviar una invitación administrativa no genera aceptación: el titular la registra posteriormente mediante `accept_account_privacy` al crear su contraseña. La ausencia de aceptación o una versión no coincidente no se consideran consentimiento. Es un registro de la declaración, no una verificación adicional de identidad. Solo operación mediante SQL puede leer esta auditoría; no contiene texto de solicitudes.
- Un operador con acceso a SQL o una clave privilegiada puede eludir RLS: proteger esas credenciales y habilitar MFA en las cuentas del proveedor.
- La aprobación piloto es una decisión del negocio; no representa una verificación de calidad, seguro o garantía sobre la empresa.

Referencias técnicas: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones y seguridad](https://supabase.com/docs/guides/database/functions), [datos de usuario y triggers](https://supabase.com/docs/guides/auth/managing-user-data), [pruebas de correo local](https://supabase.com/docs/guides/auth/testing-auth-flows).
