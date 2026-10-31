# Activar cobros de MoveFlow con PayPal

Fecha de revisión: 30 de octubre de 2026.

## Estado real de esta versión

MoveFlow anuncia un plan de **$149 MXN al mes** y permite preparar una solicitud de alta por correo para `iker.san.cu@gmail.com`. La persona interesada confirma el envío desde su programa de correo. No se ha creado una cuenta PayPal Business, no se han configurado credenciales de pago y no existe un cobro activo ni una activación automática de perfiles. El correo de administración no se ha registrado como destinatario de pagos.

Este documento describe trabajo pendiente. La base preparada en el proyecto no sustituye la conexión de Supabase, las invitaciones de acceso, la operación de soporte ni una integración de pagos probada. Consultar también [planes y cobros](planes-y-cobros.md), [seguridad y cuentas](seguridad-y-cuentas.md) y [lanzamiento](lanzamiento.md).

## 1. Crear y conservar la cuenta del propietario

1. Abre una cuenta Empresas desde el [sitio oficial de PayPal México](https://www.paypal.com/mx/business/open-business-account). Usa los datos legales reales de la persona o empresa que cobrará la suscripción y medios de recuperación que controles.
2. Completa personalmente los requisitos que PayPal muestre: datos del negocio, verificación, aceptación de términos y acceso. Activa segundo factor si está disponible y conserva los códigos de recuperación fuera del repositorio.
3. Vincula una cuenta bancaria bajo el mismo titular. PayPal México indica que la CLABE vinculada debe corresponder a quien registró la cuenta; la asociación se realiza dentro de PayPal, no en MoveFlow. [Asociar una cuenta bancaria](https://www.paypal.com/mx/cshelp/article/%C2%BFc%C3%B3mo-puedo-asociar-una-cuenta-bancaria-a-mi-cuenta-de-paypal-help183).
4. Confirma que la cuenta puede recibir pagos y que tiene habilitado el producto Subscriptions. No presupongas que abrir una cuenta aprueba todos los productos. PayPal exige cuenta Business elegible, credenciales, un plan y un servidor para su integración de suscripciones. [Requisitos de Subscriptions](https://developer.paypal.com/docs/subscriptions/integrate/).

No pegues contraseñas, CLABE, documentos de verificación, códigos MFA ni secretos de API en chats, capturas, archivos públicos o GitHub. Las credenciales de servidor se configurarán en el alojamiento del backend mediante su gestor de secretos. No usar prefijos `VITE_` para secretos: el contenido de esas variables puede terminar en el navegador.

## 2. Confirmar el producto que se venderá

El plan solicitado es una suscripción **recurrente mensual de $149.00 MXN**, no una venta a meses sin intereses. El importe anunciado al público debe ser el total que pagará el negocio; antes de activar pagos, confirmar con contabilidad el desglose de impuestos y la facturación, sin añadir cargos inesperados al precio mostrado.

La aprobación del negocio, las funciones disponibles y los límites deben estar claros antes de pedir dinero. Completar los datos legales del operador, condiciones de uso, privacidad, contacto de soporte, cancelación y reembolso. No vender como disponible el panel o las notificaciones mientras su recepción real no esté conectada y probada. No prometer un número de clientes o ingresos. Preparar también el aviso previo de renovación automática con al menos cinco días naturales y un mecanismo accesible de cancelación, conforme al alcance de la LFPC. Estos controles deben operar, no solo aparecer en los términos. [Orientación oficial de Profeco sobre suscripciones](https://www.gob.mx/profeco/prensa/que-las-suscripciones-digitales-no-afecten-tu-presupuesto-profeco-te-orienta?idiom=es-MX).

La comisión estándar publicada para transacciones comerciales nacionales es **3.95% + $4 MXN**, y PayPal señala que los importes y porcentajes están sujetos a IVA. No debe confundirse esa comisión con un impuesto adicional cobrado automáticamente al suscriptor. Las condiciones pueden variar por cuenta, operación y divisa; consultar el coste efectivo antes de fijar el margen. [Comisiones oficiales de PayPal México](https://www.paypal.com/mx/business/paypal-business-fees).

## 3. Flujo de alta recomendado

1. El negocio solicita un perfil y administración revisa sus datos.
2. Una invitación individual permite verificar el correo y crear una contraseña propia. No crear accesos con contraseñas compartidas o enviadas por chat.
3. El negocio aprobado revisa el plan, el total y las condiciones de renovación y cancelación.
4. El servidor crea o reutiliza una suscripción asociada a ese negocio y a una cuenta autenticada. El navegador solo inicia la aprobación en PayPal.
5. El servidor comprueba la operación con PayPal y registra el resultado antes de conceder o ampliar vigencia.
6. Las renovaciones, fallos, cancelaciones y reembolsos actualizan el acceso de forma controlada. Suspender un negocio o retirar a un integrante sigue revocando sus permisos aunque exista un periodo pagado o una cortesía.

Estas son decisiones de arquitectura propuestas para la siguiente fase; la versión actual no ejecuta estos seis pasos automáticamente. La futura suscripción financiará el uso de MoveFlow, no cobrará ni repartirá el precio de las mudanzas.

## 4. Integración técnica pendiente

Crear una aplicación **Sandbox** en PayPal Developer, con comprador y vendedor de pruebas, y un producto y plan mensual en MXN. Mantener separadas las credenciales, identificadores de plan y datos de Sandbox y producción. Para producción se necesitan otros identificadores: no basta con cambiar una bandera del navegador. El SDK requiere un servidor que cree la suscripción y verifique su estado antes de activar el servicio. [Integrar Subscriptions](https://developer.paypal.com/docs/subscriptions/integrate/).

El backend deberá comprobar usuario autenticado, negocio autorizado, cuenta receptora esperada, moneda, importe, plan permitido y vínculo interno con la suscripción. No aceptar precio, vigencia, rol, cortesía o identificador de negocio enviados por el navegador como autoridad. La página de retorno, un parámetro `success`, el evento de aprobación del navegador o una captura de pago no prueban por sí solos el derecho de acceso.

Configurar un receptor HTTPS de notificaciones de PayPal y verificar cada mensaje según su documentación. Guardar identificadores únicos para procesar reintentos una sola vez, consultar el estado vigente cuando lleguen eventos fuera de orden y reconciliar operaciones que no hayan llegado. PayPal puede reintentar entregas fallidas; el sistema no debe duplicar cuentas, cobros, recibos ni meses de acceso. El simulador no sustituye los eventos de una transacción Sandbox real. [Verificación y pruebas de webhooks](https://developer.paypal.com/api/rest/webhooks/rest/).

No registrar secretos, cabeceras completas de autenticación, mensajes íntegros de clientes o datos de pago innecesarios. No guardar números de tarjeta ni credenciales del pagador en Supabase. PayPal gestiona la aprobación del pago; MoveFlow conserva solo referencias y estados necesarios para el contrato y soporte.

## 5. Pruebas antes del primer cobro real

- Registro, correo verificado, invitación y segundo factor del operador; rechazo de una cuenta sin permisos.
- Suscripción correcta de 149 MXN; rechazo de otro plan, importe, moneda, receptor o negocio.
- Aprobación cancelada, pago pendiente o fallido, doble clic, red interrumpida y reintento sin duplicar efectos.
- Renovación, notificación duplicada o fuera de orden, firma inválida y reconciliación de notificaciones ausentes.
- Cancelación accesible y confirmada, fecha efectiva de fin de acceso, reembolso y disputa; sin reactivar un negocio suspendido.
- Cuenta con beneficio interno gratuito: sin checkout ni cobros, manteniendo todas las validaciones de acceso.
- Datos privados aislados entre negocios; recuperación de cuenta y restauración de respaldo verificadas.

Documentar los resultados, revisar condiciones comerciales y activar primero un grupo limitado de prueba. El propietario autoriza los cobros de prueba reales y verifica personalmente que el pago llega a su cuenta y que puede cancelarse. Mantener una forma de detener nuevas contrataciones sin borrar las suscripciones existentes ni interrumpir cancelaciones o soporte.

## Qué falta para activar

Cuenta PayPal Business elegible del propietario; Supabase remoto y autenticación operativos; invitaciones y correo configurados; identidad y condiciones legales completas; funciones contratadas disponibles; integración de servidor y webhooks implementada; pruebas Sandbox y validación final del propietario. Hasta completar esos puntos, mantener el botón público como **solicitud de alta**, sin botón de pago activo ni mensajes de cuenta creada automáticamente.
