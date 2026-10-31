# Plan mensual y operación de accesos

Estado: preparación local, 30 de octubre de 2026. La plataforma anuncia un plan de **$149 MXN al mes** y recibe solicitudes de alta por correo. Solicitar información no contrata una suscripción, no cobra y no crea una cuenta automáticamente. No hay una cuenta PayPal Business conectada ni una integración de pagos habilitada. Supabase, las cuentas reales y el correo de invitaciones también requieren activación.

## Qué queda implementado

- Catálogo de servidor `private.subscription_plans`: `monthly_149`, importe de 14 900 centavos, MXN, intervalo mensual. `checkout_enabled` inicia en `false`; modificarlo por sí solo **no implementa un cobro**.
- Los accesos temporales existentes mantienen su vencimiento y aprobación actuales. No se convierten automáticamente en suscripciones de pago.
- Cortesía administrativa sin vencimiento comercial, por **UUID de cuenta y negocio D’Curiel**, en `private.provider_complimentary_access`. No se deduce del nombre, apellido, correo, rol enviado por el navegador ni metadatos de registro.
- La cortesía conserva aprobación, pertenencia activa, estado del negocio, segundo factor y las restricciones de cada solicitud. No amplía la cuota de solicitudes, no concede otras empresas y no publica una lista de beneficiarios.
- Suspender a la cuenta o al negocio bloquea acceso. Retirar la membresía desactiva también la cortesía; volver a agregar a la persona no reactiva el beneficio silenciosamente.
- Lectura de solicitudes, notificaciones, selección de destinatarios y comprobaciones de entrega push usan el mismo criterio de acceso por negocio. El servidor vuelve a comprobarlo al entregar un aviso pendiente.

Las tablas de catálogo y cortesías están en el esquema privado, con RLS y sin acceso directo para visitantes o cuentas autenticadas. Las acciones administrativas quedan auditadas. Las concesiones no crean usuarios Auth, no verifican correos y no aceptan privacidad en nombre de una persona.

## Activar los accesos previstos

1. Conectar Supabase y aplicar todas las migraciones, incluida `20261031010000_provider_plans.sql`.
2. Crear los accesos individuales mediante invitación a correos reales. Cada titular confirma correo, acepta el aviso vigente, elige su contraseña y configura su autenticador. No compartir contraseñas.
3. Revisar a cada cuenta, aprobar su rol de proveedor y asignarla a D’Curiel. La membresía existente `is_family` es un identificador técnico de compatibilidad para ese negocio, no un permiso público de autoservicio.
4. Confirmar los UUID reales de Tere y Marco. **No están configurados ni activos en producción por añadir esta migración**: no hay UUID reales que puedan sembrarse responsablemente en el repositorio.
5. Con una sesión real del superusuario y MFA, invocar por separado `set_provider_complimentary_access({p_user_id: UUID, p_enabled: true})` para cada titular. Alternativamente, completar una copia privada de `supabase/operations/configure-complimentary.sql` y ejecutarla como propietario en SQL Editor. La plantilla vacía falla sin cambios; no copiar credenciales ni el archivo completado a GitHub.
6. Comprobar la lectura de una solicitud de prueba y una notificación con cada cuenta. La cortesía funciona con `plan_expires_at` nulo o vencido; no necesita fechas ficticias del año 9999.

Para revocar la cortesía, el superusuario con MFA invoca la misma RPC con `p_enabled: false`. Si la persona todavía tiene un acceso temporal aprobado vigente, ese permiso independiente continúa hasta vencer o suspenderse. Para cortar todo acceso, suspender su cuenta o retirar su membresía. Revocar la cortesía sigue permitido después de una suspensión.

La aprobación existente `set_provider_access` conserva su validación de vigencia temporal. Para la primera aprobación se puede usar un periodo real de preparación y después otorgar la cortesía. Ese periodo no genera cargos; la cortesía evita el vencimiento comercial mientras se mantengan las demás autorizaciones.

## Contrato de interfaz

`get_my_access_status()` no recibe argumentos y devuelve:

```json
{"access_version":1,"provider_access_active":true}
```

Solo informa sobre el usuario actual. Exige correo verificado; para un proveedor sin MFA devuelve `false` y permite que configure su autenticador. Devuelve `true` únicamente con MFA y acceso autorizado a al menos un negocio. No devuelve razones de cortesía, precios ni beneficiarios. La interfaz puede usarlo para mostrar disponibilidad, pero las reglas SQL siguen siendo la autoridad. Ante error o migración ausente, la interfaz debe cerrar el acceso y no deducir una cortesía de campos locales. Volver a consultar después de confirmar MFA.

## Conectar pagos después

PayPal permite suscripciones recurrentes con cuenta Business habilitada, producto/plan y un servidor que verifica el estado de la suscripción. El botón y su retorno al navegador no bastan para otorgar acceso. [Integración oficial de suscripciones](https://developer.paypal.com/subscriptions/integrate/v6).

Antes de cobrar:

1. El propietario crea o habilita su cuenta PayPal Business y configura personalmente su identidad, cuenta de recepción y retiro. No se presupone que el correo de solicitudes sea una cuenta de PayPal válida.
2. Completar los datos del responsable y las condiciones de suscripción, precio final, impuestos/facturación, renovación, cancelación y reembolsos. Revisarlos antes de activar contrataciones.
3. Conectar Supabase y correo de invitaciones; probar acceso, recuperación y MFA con cuentas reales de prueba.
4. Implementar primero en Sandbox el producto y plan de 149 MXN/mes, creación de suscripción desde servidor y asociación al negocio y usuario verificados. Guardar secretos solo en el servidor, nunca como variables `VITE_`.
5. Implementar comprobación servidor a servidor del beneficiario, plan, importe, moneda y estado; procesar notificaciones firmadas de forma idempotente, incluidas renovaciones, impagos, cancelaciones y reembolsos. No asignar privilegios por un parámetro `success`, captura de pantalla o un identificador arbitrario enviado por el cliente. [Verificación de webhooks de PayPal](https://developer.paypal.com/api/rest/webhooks/rest/).
6. Crear o invitar la cuenta solamente cuando la relación negocio/titular y el pago estén confirmados. El cliente debe establecer su propia contraseña; pagar no autoriza al sistema a aceptar sus términos por él.
7. Probar alta, pago duplicado, evento repetido o fuera de orden, caída del servidor, renovación, cancelación, devolución y retiro de acceso antes de pasar a producción. Publicar un proceso de cancelación accesible antes de permitir renovación automática.

PayPal descuenta comisiones por sus transacciones; el importe neto recibido no será necesariamente 149 pesos. Consultar las tarifas vigentes de la cuenta antes de estimar ingresos. [Tarifas de PayPal México](https://www.paypal.com/mx/business/paypal-business-fees). El alojamiento gratuito no convierte el procesamiento de pagos en gratuito.

## Validación

`tests/provider-plans.backend.test.js` usa PostgreSQL local mediante PGlite. Comprueba el catálogo sin checkout, administración solo por superusuario con MFA, ausencia de derechos por metadatos, concesiones a dos cuentas explícitas, aislamiento entre negocios, vencimientos, revocaciones y entrega push. Las pruebas no ejecutan transacciones de PayPal, no envían invitaciones y no activan la base de producción.
