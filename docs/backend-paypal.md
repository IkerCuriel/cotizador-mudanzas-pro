# Backend de pagos por periodo

Preparado el 30 de octubre de 2026. **No está conectado a una cuenta real ni autoriza cobros por estar incluido en el repositorio.** La integración es PayPal Orders v2: 149 MXN por un mes o 1,440 MXN por doce meses, pagados una vez. No crea suscripciones recurrentes, no guarda tarjetas y no hace cargos al finalizar un periodo.

## Componentes y permisos

- `20261031030000_paypal_prepaid.sql` añade compras privadas, permisos y periodos por empresa. Mantiene cerrado el catálogo comercial existente. El pago nunca aprueba empresas, crea roles, anula suspensiones ni asigna personas a negocios.
- `paypal-checkout` autentica cada petición con Supabase Auth. Las RPC también exigen correo verificado, segundo factor `aal2`, empresa y proveedor aprobados y membresía activa de propietario. Los miembros sin permiso de propietario no compran en nombre del negocio.
- `20261031050000_paypal_reconciliation.sql` añade cola con leases e incidencias privadas. `paypal-reconcile` ofrece conciliación programable y recuperación de pagos pendientes.
- `paypal-webhook` verifica la firma con PayPal y consulta el estado vigente de la orden/captura. Captura automáticamente una orden aprobada solo si corresponde a una compra interna que todavía puede pagar. Un pago completado concede el periodo sin esperar a que el navegador regrese.
- El navegador no decide precio, importe, moneda, receptor, duración ni acceso. El servidor comprueba el identificador interno en `reference_id`, `custom_id` e `invoice_id`, el comercio esperado y la captura correspondiente.
- Solo se permite una compra pendiente por empresa, protegida por bloqueo e índice único. Los reintentos reutilizan la misma orden y `PayPal-Request-Id`. Capturas repetidas no suman periodos. Un reembolso/reversión no se deshace con una notificación completada que llegue tarde.
- Un nuevo periodo comienza al final del último periodo pagado de la empresa o ahora si no lo hay. Las cortesías existentes siguen operando; sus destinatarios no pasan por checkout.

## Secretos del servidor

Configurar en **Supabase → Edge Functions → Secrets**, nunca en `VITE_`, navegador, GitHub, documentación o chats:

| Nombre | Configuración |
| --- | --- |
| `PAYPAL_MODE` | `sandbox` para pruebas; `live` solo después de validar la cuenta y el lanzamiento. |
| `PAYPAL_CLIENT_ID` | Identificador de la aplicación REST del entorno correspondiente. |
| `PAYPAL_CLIENT_SECRET` | Secreto de esa aplicación. |
| `PAYPAL_MERCHANT_ID` | Identificador de comercio de la cuenta receptora del mismo entorno. No es un correo ni una tarjeta. |
| `PAYPAL_WEBHOOK_ID` | ID real del webhook creado dentro de esa aplicación. |
| `MOVEFLOW_SITE_ORIGIN` | `https://moveflow-mudanzas.render-inspace.chatgpt.site`, sin ruta. |
| `PAYPAL_CHECKOUT_ENABLED` | `false` inicialmente; `true` abre nuevas compras si el resto de controles está listo. |
| `PAYPAL_RECONCILE_SECRET` | Secreto aleatorio dedicado de al menos 32 caracteres para la tarea programada. No reutilizar las claves de Supabase o PayPal. |
| `PAYPAL_LIVE_APPROVED` | `false` inicialmente; producción requiere `true` explícito además del control anterior. |

Supabase proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` al entorno de Functions. La clave administrativa nunca se comparte con el sitio estático. No se necesita cargar el SDK de PayPal en el navegador: la aprobación ocurre en su página oficial.

## Despliegue y prueba

1. Tener Supabase remoto conectado, migraciones aplicadas, Auth/SMTP/MFA operativos, responsable legal configurado y solicitudes reales probadas. No cobrar por funciones aún indisponibles.
2. Crear una aplicación PayPal **Sandbox** y cuentas comprador/vendedor de prueba en la cuenta del propietario. La futura cuenta Live debe ser Business y estar habilitada para recibir los pagos que se ofrecerán.
3. Aplicar las migraciones y desplegar:

   ```bash
   supabase functions deploy paypal-checkout --no-verify-jwt
   supabase functions deploy paypal-webhook --no-verify-jwt
   supabase functions deploy paypal-reconcile --no-verify-jwt
   ```

   `--no-verify-jwt` desactiva la validación del gateway, no la autenticación de la aplicación: `paypal-checkout` llama a Auth y sus RPC verifican al usuario; el webhook verifica la firma de PayPal. Ninguna función acepta un pago como legítimo por el contenido de la petición solamente.
4. En la aplicación Sandbox de PayPal crear el webhook HTTPS `https://TU-PROYECTO.supabase.co/functions/v1/paypal-webhook` y suscribir `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED` y `PAYMENT.CAPTURE.REVERSED`. Configurar su ID real en los secretos.
5. En la base de pruebas, habilitar expresamente `private.subscription_plans.checkout_enabled` para los dos planes y `private.platform_settings.accepting_requests`. Crear un negocio aprobado con propietario verificado y segundo factor. No copiar usuarios ni clientes reales al entorno Sandbox.
6. Configurar `PAYPAL_CHECKOUT_ENABLED=true` en Sandbox y completar ambas compras ficticias desde `/pago.html`. Verificar webhook, retorno, límites, moneda, receptor y acceso exacto del negocio.
7. Probar aprobación cancelada, cierre de la pestaña tras aprobar, reintentos, pérdida de respuesta, firmas inválidas, captura pendiente, reembolso completo y parcial, reversión y retirada de un integrante. Verificar que una compra nunca amplía permisos de otra empresa.
8. Para Live se necesitan credenciales, Merchant ID y Webhook ID propios. Hacer una validación final con el propietario antes de habilitar cobros reales; cumplir los pendientes operativos y legales descritos abajo.

El simulador de webhooks no sustituye un pago Sandbox real. La verificación remota de firma no funciona con los eventos ficticios del simulador, según PayPal. Las pruebas de este repositorio usan dobles explícitos y PostgreSQL local: no prueban entrega remota ni disponibilidad de una cuenta de pagos.

## Contrato del cliente

RPC `get_my_billing_businesses()` devuelve `business_id`, `name`, `complimentary` y `paid_until` para las empresas que el usuario puede administrar.

POST autenticado a `/functions/v1/paypal-checkout`:

- `{action:'status'}` → `{enabled,mode}`. No presentar un pago activo si `enabled` no es exactamente `true`.
- `{action:'create',businessId,planCode,requestId,consentVersion:'prepaid-v1'}` → `{purchaseId,approvalUrl}`. `planCode` admite `monthly_149` o `annual_1440`; `requestId` es un UUID para reintentos. Solo se redirige al host HTTPS oficial de PayPal del entorno correspondiente.
- Una creación repetida puede devolver `{purchaseId,status,paidUntil}` sin URL si el pago ya se procesó. Consultar esa compra mediante la acción siguiente, sin crear otra orden.
- `{action:'capture',purchaseId}` → `{status:'paid'|'pending'|'revoked'|'voided',paidUntil}`. La consulta usa la orden guardada en servidor; no confía en los parámetros que PayPal o el visitante agreguen a la URL.

Retorno: `/pago.html?purchase=UUID`. Cancelación de aprobación: `/pago.html?cancelled=1&purchase=UUID`. Volver o cancelar desde PayPal no representa un reembolso ni el final de una transacción ya capturada. El usuario puede volver a consultar la misma compra.

## Operación y límites antes de producción

- Las notificaciones duplicadas son seguras porque la captura y la concesión del periodo son idempotentes. PayPal reintenta mensajes fallidos; una respuesta 503 pide reintento. No borrar referencias de compras o capturas para «desatascar» una incidencia.
- El usuario autenticado puede reconciliar una compra con «Consultar pago». El reconciliador del servidor procesa hasta diez compras por llamada con leases de cinco minutos; varias ejecuciones no reclaman simultáneamente la misma fila. Las compras pendientes se revisan cada hora, las incidencias transitorias se reintentan después de quince minutos y las pagadas se revisan diariamente. Programar el endpoint y supervisar la cola antes del lanzamiento. No elimina los datos al terminar un periodo.
- Una aprobación cancelada en el navegador conserva la orden y permite retomarla sin un segundo cargo. Solo una respuesta canónica `VOIDED` de PayPal, sin capturas, permite marcarla como cerrada y liberar la empresa para otra compra. El tiempo transcurrido, un error de red o un 404 no prueban que haya vencido; esos casos quedan en la cola de incidencias para revisión con PayPal. Una compra pagada nunca se cierra mediante esa operación.
- Los eventos `CUSTOMER.DISPUTE.*` no tienen un flujo de resolución automática en esta versión. Requieren seguimiento y decisión de soporte desde PayPal. Las reversiones de captura sí revocan el periodo correspondiente. Configurar notificaciones operativas y procedimientos antes de producción.
- Un reembolso parcial también marca el periodo como revocado, pendiente de revisión humana. Definir y comunicar la política contractual que corresponda; la función no calcula reembolsos ni los emite.
- El cobro no emite CFDI, no registra al propietario ante el SAT ni comprueba el cumplimiento legal del negocio. Completar facturación, condiciones, datos del responsable, privacidad, soporte, reembolsos y las funciones ofrecidas antes de activar Live.
- Para detener nuevas compras, poner `PAYPAL_CHECKOUT_ENABLED=false`. Mantener desplegado el webhook, sus credenciales y los datos de compras para conciliar pagos ya aprobados, reembolsos y reversiones. Apagar el sitio estático no cancela ni devuelve pagos.

## Programar la conciliación y revisar incidencias

1. Configurar `PAYPAL_RECONCILE_SECRET` en Edge Functions y conservar el mismo valor dentro de **Supabase Vault** con el nombre `moveflow_paypal_reconcile_secret`. Introducirlo personalmente en esos gestores; no insertarlo en archivos, comandos del historial ni chats.
2. Configurar en **Supabase Cron** una tarea HTTP POST al endpoint `https://TU-PROYECTO.supabase.co/functions/v1/paypal-reconcile`, por ejemplo cada cinco minutos durante el piloto, con la cabecera `x-moveflow-paypal-reconcile-secret` obtenida de Vault. Usar `pg_net` para ejecutar la llamada. La tarea no lleva datos de clientes ni identificadores de compra: el servidor reclama su lote. Consultar la [guía oficial para programar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
3. Ejecutarla manualmente primero en Sandbox. Verificar respuesta `{reviewed,issues,deferred}`, entradas en `private.paypal_reconciliation_queue` y que dos llamadas simultáneas no procesen la misma compra. Un secreto ausente o incorrecto responde 401; un error al finalizar el lote responde 503 para reintentar.
4. Las incidencias se registran en `private.paypal_operational_issues` y la auditoría conserva únicamente referencia interna y código de error; no guarda cuerpos de PayPal, tarjetas ni datos del cliente. `get_paypal_operational_summary()` permite a un administrador con correo verificado y MFA consultar cantidades y última revisión. Revisar estos indicadores y los resultados HTTP de Cron; el sistema no envía correos automáticamente.
5. El apagado de nuevas contrataciones no apaga la conciliación. Conservar la tarea y el webhook mientras existan pagos que puedan requerir confirmación, devolución o reversión. Ajustar frecuencia y lotes con métricas cuando crezca el volumen; la configuración del piloto no promete cubrir millones de compras sin recursos adicionales.

El código de la tarea está preparado; la programación remota y una prueba real siguen dependiendo de conectar Supabase y PayPal. Las incidencias sobre órdenes no localizadas requieren comprobar la cuenta y el entorno de PayPal, sin crear otra compra a ciegas. [Estados y tiempos de Orders](https://developer.paypal.com/sdk/orders/v2/definitions/order/) y [errores de órdenes](https://developer.paypal.com/serversdk/php/api-endpoints/orders/errors).

Fuentes oficiales consultadas: [Checkout estándar](https://developer.paypal.com/studio/checkout/standard/integrate), [Orders v2](https://developer.paypal.com/api/orders/v2), [Payments v2](https://developer.paypal.com/api/payments/v2), [verificación y reintentos de webhooks](https://developer.paypal.com/api/rest/webhooks/rest/). La conexión real y las pruebas Sandbox siguen pendientes.
