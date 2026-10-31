# Planes y operación de accesos

Estado: integración preparada, 30 de octubre de 2026. El propietario eligió pago por periodo: **$149 MXN por un mes** o **$1,440 MXN por 12 meses** (equivalente a $120 mensuales), **sin renovación automática**. Las solicitudes de alta pasan a la plataforma; se retiró el correo de alta. La conexión Supabase/PayPal y las pruebas reales siguen pendientes. Ningún flag de interfaz ni la publicación del código activa cobros.

## Qué queda implementado

- Catálogo de servidor `private.subscription_plans`: `monthly_149`, 14 900 centavos, MXN, intervalo `month`; y `annual_1440`, 144 000 centavos, MXN, intervalo `year` (12 meses). Ambos conservan `checkout_enabled = false`; modificarlo por sí solo **no implementa un cobro**. No existe un plan de cargos mensuales de $120.
- Los accesos temporales existentes mantienen su vencimiento y aprobación actuales. No se convierten automáticamente en suscripciones de pago.
- Cortesía administrativa sin vencimiento comercial, por **UUID de cuenta y negocio D’Curiel**, en `private.provider_complimentary_access`. No se deduce del nombre, apellido, correo, rol enviado por el navegador ni metadatos de registro.
- La cortesía conserva aprobación, pertenencia activa, estado del negocio, segundo factor y las restricciones de cada solicitud. No amplía la cuota de solicitudes, no concede otras empresas y no publica una lista de beneficiarios.
- Suspender a la cuenta o al negocio bloquea acceso. Retirar la membresía desactiva también la cortesía; volver a agregar a la persona no reactiva el beneficio silenciosamente.
- Lectura de solicitudes, notificaciones, selección de destinatarios y comprobaciones de entrega push usan el mismo criterio de acceso por negocio. El servidor vuelve a comprobarlo al entregar un aviso pendiente.

Las tablas de catálogo y cortesías están en el esquema privado, con RLS y sin acceso directo para visitantes o cuentas autenticadas. Las acciones administrativas quedan auditadas. Las concesiones no crean usuarios Auth, no verifican correos y no aceptan privacidad en nombre de una persona.

## Activar los accesos previstos

1. Conectar Supabase y aplicar todas las migraciones, incluidas `20261031010000_provider_plans.sql` y `20261031021000_annual_plan.sql`.
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

## Conectar los pagos preparados

La integración usa PayPal Orders v2 y vigencias por negocio, con captura verificada y webhooks firmados. Los secretos solo van en servidor. Cada compra requiere una cuenta verificada, MFA, empresa aprobada y membresía de propietario; no crea permisos por un correo ni por una página de retorno.

Consulta [activar PayPal](activar-paypal.md) para el propietario y [backend de pagos](backend-paypal.md) para configuración, contrato, idempotencia, conciliación y pruebas. La cuenta actual es Personal: debe completar la habilitación comercial antes de cobrar. La emisión de CFDI y las obligaciones fiscales no las realiza esta integración.

Los periodos pagados se guardan en tablas privadas por empresa. Las cortesías y permisos temporales conservan su comportamiento anterior. Los reembolsos/reversiones revocan el periodo afectado y deben conciliarse según la política comercial publicada. No se prometen funciones ni solicitudes que todavía estén inactivas.

## Validación

`tests/provider-plans.backend.test.js` y `tests/annual-plan.backend.test.js` usan PostgreSQL local mediante PGlite. La prueba anual aplica la nueva migración sobre el catálogo previo, conserva el mensual, verifica los 144 000 centavos por año y rechaza periodos, moneda y cantidades inválidas. También comprueba que el catálogo sigue privado. Comprueba el catálogo sin checkout, administración solo por superusuario con MFA, ausencia de derechos por metadatos, concesiones a dos cuentas explícitas, aislamiento entre negocios, vencimientos, revocaciones y entrega push. Las pruebas no ejecutan transacciones de PayPal, no envían invitaciones y no activan la base de producción.
