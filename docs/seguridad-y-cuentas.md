# Cuentas, seguridad y recuperación

Estado de preparación: 30 de octubre de 2026. El código y las pruebas locales están preparados; las cuentas reales requieren conectar Supabase, aplicar las migraciones y configurar el correo. Ningún sistema ofrece una garantía de «cero hackeos». Los controles siguientes reducen riesgos y permiten recuperar el servicio.

## Cuentas individuales del piloto

| Persona | Teléfono de atención | Cuenta prevista | Pendiente |
| --- | --- | --- | --- |
| Asesor principal | +52 55 2906 1098 | Usuario individual de Mudanzas D’Curiel | Correo individual e invitación |
| Asesor adicional | +52 56 1449 2452 | Usuario individual de Mudanzas D’Curiel | Correo individual e invitación |

El teléfono de contacto no es una contraseña ni un identificador suficiente para crear una cuenta. Cada persona tendrá un correo propio, contraseña elegida por ella y autenticador. No se guardan contraseñas compartidas ni contraseñas iniciales en el repositorio. Una contraseña compartida por chat debe considerarse expuesta y no reutilizarse.

La web pública muestra la identidad y el contacto de la empresa. Los nombres y accesos individuales se administran en el entorno privado. El rol visible de proveedor se llama **Asesor de mudanzas**. Durante el piloto, ambos asesores pueden pertenecer al mismo equipo de Mudanzas D’Curiel y recibir cada nueva solicitud dirigida a ese equipo. La vigencia y aprobación se revisan por cuenta; el piloto no cobra suscripciones.

## Lo que controla el servidor

- Cliente: consulta y cancela sus propias solicitudes; no ve otros clientes.
- Asesor: consulta únicamente solicitudes que le fueron asignadas, con aprobación y vigencia activas y segundo factor confirmado.
- Administrador: gestiona solicitudes y accesos de proveedores, con segundo factor. No puede asignar personas al equipo de Mudanzas D’Curiel ni crear administradores.
- Superusuario: gestiona roles y miembros del equipo de Mudanzas D’Curiel, con segundo factor. La web no permite crear otro superusuario ni degradar al propio superusuario.

Los permisos se verifican en PostgreSQL mediante RLS y funciones protegidas. Cambiar el HTML, el almacenamiento del navegador o los metadatos de una cuenta no concede permisos. Las claves administrativas jamás deben tener prefijo `VITE_` ni llegar al navegador.

La migración `202610300002_family_team_security.sql` exige `aal2` para el equipo; la contraseña sola no permite leer contactos ni administrar accesos. El propio perfil puede leerse para preparar el segundo factor. Esta migración reemplaza el antiguo destinatario único `family_provider_id` por varios perfiles `is_family=true`. No comparte solicitudes anteriores con personas añadidas posteriormente. Retirar a alguien del equipo de Mudanzas D’Curiel revoca también su acceso a solicitudes anteriores del negocio; suspender su cuenta retira el acceso a todas las solicitudes asignadas.

## Activar el piloto, en orden

1. Crea el proyecto de Supabase en una organización bajo tu cuenta. Activa segundo factor también en Supabase y GitHub y guarda sus códigos de recuperación fuera del repositorio.
2. Aplica **todas** las migraciones de `supabase/migrations/` en orden. No vuelvas a ejecutar la primera sobre una base ya inicializada. Usa el historial de migraciones de Supabase para las siguientes actualizaciones.
3. Configura autenticación por correo, confirmación de correo, longitud mínima de contraseña de 12 caracteres, límites de intentos y correo SMTP propio. Recomienda frases de al menos 15 caracteres, únicas, o contraseñas generadas por un gestor. No compartas credenciales.
4. Habilita TOTP en Authentication/MFA. El panel del equipo exige configurar y verificar un autenticador antes de mostrar datos de clientes. No desactives ese requisito para resolver un problema de acceso.
5. Configura la dirección pública real como Site URL y añade el retorno `https://TU-DOMINIO/cuenta.html` con los parámetros de invitación, confirmación y recuperación que utiliza la aplicación. Para desarrollo, añade únicamente los retornos locales necesarios. Comprueba los correos reales antes de lanzar campañas; el SMTP predeterminado de Supabase tiene restricciones y no es suficiente para el registro público general.
6. Completa los datos del responsable y publica los avisos vigentes antes de abrir registro o enviar invitaciones. Una invitación no inventa consentimiento: su titular acepta el aviso al elegir su contraseña; la aceptación guarda fecha del servidor y versión del aviso.
7. Registra y confirma tu cuenta de propietario. Ejecuta `supabase/bootstrap-owner.sql` sustituyendo su UUID de ejemplo por el UUID verificado de esa cuenta. Revisa la identidad antes de ejecutarlo; un correo escrito en el código no otorga propiedad. Configura tu autenticador al entrar.
8. Invita únicamente a la persona cuyo correo real se haya confirmado con el procedimiento siguiente. Invita primero al asesor cuyo correo esté verificado; el segundo acceso permanece pendiente hasta confirmar su correo individual. Cada titular confirma el correo, elige contraseña, solicita el acceso de negocio y configura el autenticador.
9. Entra como superusuario: **Panel → Negocios**. Aprueba la cuenta activada, fija una vigencia y asigna su pertenencia al equipo de Mudanzas D’Curiel desde las opciones de administración. Comprueba el nombre y teléfono con la persona. Repite el proceso con el asesor adicional cuando tenga correo propio. Las invitaciones y permisos se gestionan individualmente; agregar otra persona no desactiva la cuenta ya aprobada.
10. Abre recepción únicamente después de completar las pruebas del apartado final. Los avisos al teléfono tienen su configuración independiente; una notificación guardada en el panel no demuestra que se haya entregado al teléfono.

## Invitación sin contraseñas temporales

`scripts/provision-pilot.mjs` solo se ejecuta en tu computadora. Sin `--send`, o con `--dry-run`, muestra un plan y **no conecta, valida la conexión ni manda correos**. Para enviar exige además `--member primary` o `--member additional`: cada ejecución invita a una sola persona, nunca a ambas. Usa la API administrativa de Supabase y nunca asigna permisos ni aprueba negocios automáticamente.

Crea un archivo local **`.env.invites.local`** en la raíz del proyecto. Está excluido de Git por `.gitignore`. Completa estos valores directamente en tu editor; no pegues claves en chat, capturas, incidencias o comandos que queden en el historial:

```dotenv
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
MOVEFLOW_SITE_URL=https://TU-DOMINIO
MOVEFLOW_PRIMARY_EMAIL=
MOVEFLOW_PRIMARY_EMAIL_CONFIRMED=false
MOVEFLOW_ADDITIONAL_EMAIL=
MOVEFLOW_ADDITIONAL_EMAIL_CONFIRMED=false
MOVEFLOW_PRIVACY_READY=false
```

La clave es una clave secreta de servidor `sb_secret_…` o una `service_role` legada. No es la clave pública del navegador. Los correos individuales se configuran solo en `.env.invites.local`, excluido de Git y con permisos privados. No son cuentas creadas, credenciales verificadas ni direcciones autorizadas para enviar correo. Para la cuenta principal, completa su correo real en `MOVEFLOW_PRIMARY_EMAIL` y marca `MOVEFLOW_PRIMARY_EMAIL_CONFIRMED=true` solo después de comprobar que lo controla. Mantén `MOVEFLOW_ADDITIONAL_EMAIL_CONFIRMED=false` mientras el asesor adicional no tenga correo real; puedes dejar vacío su correo. El envío al asesor principal no exige configurar ni confirmar el del asesor adicional. Cuando corresponda, usa un correo distinto y confirma la cuenta adicional por separado.

El script admite los identificadores y variables de versiones anteriores por compatibilidad; utiliza los nombres de rol mostrados aquí para configuraciones nuevas.

**Cambio desde la versión anterior:** `MOVEFLOW_EMAILS_CONFIRMED` ya no autoriza envíos; elimínala del archivo privado y añade las dos confirmaciones individuales. El formato del correo no demuestra que sea real ni reemplaza esta comprobación. `--send` sin `--member` se rechaza antes de conectar. Activa `MOVEFLOW_PRIVACY_READY=true` solamente cuando el aviso esté completo y publicado. El retorno `/cuenta.html?mode=invite` debe estar permitido en Supabase. No se modifica la configuración pública al cambiar este archivo.

En la terminal del proyecto:

```sh
chmod 600 .env.invites.local
node scripts/provision-pilot.mjs
node scripts/provision-pilot.mjs --member primary --dry-run
node --env-file=.env.invites.local scripts/provision-pilot.mjs --member primary --send
```

El último comando envía realmente la invitación; ejecútalo solo después de completar los pasos anteriores. Para la cuenta adicional, repite después con `--member additional --send` y su confirmación individual. Revisa Auth antes de reintentar un envío. Si una cuenta ya existe, la invitación no la sobrescribe: utiliza **Olvidé mi contraseña**. El script no imprime claves, contraseñas, enlaces de acceso ni respuestas privadas del proveedor. El archivo secreto debe permanecer local y fuera de respaldos sin cifrar.

Antes de probar cuentas reales, faltan la conexión al proyecto remoto, las migraciones, SMTP y redirecciones, los datos completos del responsable y la publicación con `VITE_SUPABASE_URL`, clave pública `VITE_SUPABASE_ANON_KEY` y configuración legal. Las variables `VITE_` son públicas: nunca contienen la clave administrativa. Cambiarlas requiere volver a compilar y publicar. `supabase/config.toml` configura las pruebas locales, no el proyecto remoto; mantén allí el registro público cerrado durante la preparación. La invitación individual no abre la recepción de solicitudes ni activa avisos al teléfono.

## Recuperación de acceso

**Contraseña olvidada:** la propia persona utiliza el enlace de recuperación enviado a su correo, elige una nueva contraseña y vuelve a entrar. La respuesta del formulario no revela si un correo existe. Al guardar se revocan las sesiones de actualización mediante cierre global. Un token de acceso ya emitido puede seguir válido hasta que expire; configura un periodo prudente en Supabase y considera ese intervalo en incidentes.

**Autenticador perdido:** recuperar la contraseña no elimina el segundo factor. Primero usa el respaldo cifrado o recuperación de tu aplicación autenticadora. Si no existe, el propietario debe verificar personalmente la identidad y revocar el factor perdido desde la administración de Supabase o su API administrativa de MFA. Registra quién autorizó la recuperación y cuándo; no entregues claves a una persona sin verificar solo por un mensaje. La cuenta vuelve a necesitar un autenticador antes de leer solicitudes. No hay una contraseña maestra dentro del código.

**Propietario sin acceso:** la recuperación comienza por el correo, GitHub y la organización de Supabase. Conserva sus códigos y llaves de recuperación en un gestor y una copia de emergencia fuera de la computadora. GitHub conserva código; no contiene las cuentas, contraseñas cifradas ni la base de datos de Supabase. Clonar el código no recupera los datos de clientes ni sustituye el control de las cuentas de infraestructura.

**Cuenta comprometida:** suspende al asesor o retira temporalmente los permisos, cierra recepción si procede, revoca sesiones/factores afectados, cambia contraseñas y rota cualquier secreto expuesto. Revisa accesos, solicitudes y auditoría. Mantén evidencia del incidente. La suspensión del perfil o el vencimiento retira acceso a contactos en las consultas posteriores, incluso si la sesión anterior todavía está abierta.

## Respaldos, mantenimiento y pruebas

Guarda el código en tu GitHub y una copia fuera de la computadora; guarda la base de datos y las claves necesarias para restaurarla en respaldos cifrados separados. Los respaldos de clientes no pertenecen a un repositorio público. Prueba una restauración en un proyecto aislado antes de necesitarla por emergencia. Revisa periódicamente colaboradores, dependencias, configuraciones, facturas y vigencias. Nunca pruebes borrados o restauraciones directamente sobre producción.

Antes de trabajar con datos reales, ejecuta `npm test` y `npm run build`, y prueba en el proyecto conectado:

1. Registro/confirmación, invitación, contraseña olvidada y cierre de sesión en dos dispositivos.
2. Los asesores del negocio reciben por separado una solicitud nueva; otro proveedor no puede consultarla ni adivinar su referencia.
3. Contraseña sin autenticador no permite consultar la solicitud o administrar usuarios, incluso mediante una llamada directa a la API.
4. Suspender o vencer al asesor adicional retira su acceso y conserva el del asesor principal. Cancelar una solicitud retira el acceso de ambos.
5. Alertas del teléfono con la pantalla bloqueada, permiso denegado, navegador cerrado, conexión interrumpida y reintento. No anunciar entrega inmediata garantizada.
6. Restauración del código y de una copia de datos ficticios en una infraestructura independiente.

Las pruebas locales ejecutan SQL y RLS en PostgreSQL mediante PGlite. No sustituyen estas pruebas reales de Auth, SMTP, autenticadores y dispositivos ni una auditoría externa antes de cobrar y aumentar el volumen.

## Fuentes oficiales consultadas

- [Supabase: MFA y políticas de autorización](https://supabase.com/docs/guides/auth/auth-mfa).
- [Supabase: autenticador TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp).
- [Supabase: invitaciones administrativas](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).
- [Supabase: cierre de sesión y vigencia de tokens](https://supabase.com/docs/reference/javascript/auth-signout).
- [Supabase: correo SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- [OWASP: autenticación](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [recuperación de contraseña](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) y [MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).
