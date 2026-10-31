# Activar PayPal para MoveFlow

Revisado el 30 de octubre de 2026. El propietario confirmó que su cuenta actual es **Personal** y eligió **pago por periodo, sin renovación automática**. Los pagos aún no están conectados ni habilitados en producción.

## Paso a paso del propietario

1. Decide con tu contador quién venderá el acceso: tú como persona física con las actividades fiscales adecuadas, o una sociedad con la que exista un acuerdo real. La cuenta receptora, banco, facturación y términos deben corresponder al operador elegido. No usar el RFC de D’Curiel como si fuera personal.
2. Entra en [PayPal México](https://www.paypal.com/mx/business/open-business-account). Desde la configuración de tu cuenta revisa la opción para pasar a Empresas; si PayPal ofrece abrir una cuenta Business separada, sigue su proceso. Completa personalmente titular, actividad, verificaciones y aceptación. No inventar razón social ni afirmar que Business exige necesariamente constituir una sociedad.
3. En Cartera → Asociar cuenta bancaria, registra personalmente la **CLABE de 18 dígitos a nombre del mismo titular**. Una tarjeta de débito guardada no acredita por sí sola el destino bancario de retiro. [Guía oficial de vinculación](https://www.paypal.com/mx/cshelp/article/%C2%BFc%C3%B3mo-puedo-asociar-una-cuenta-bancaria-a-mi-cuenta-de-paypal-help183).
4. Confirma que la cuenta está habilitada para recibir ventas, sin limitaciones pendientes. Configura recuperación y segundo factor. Revisa el nombre y contacto comercial que PayPal mostrará al comprador; cambiar el correo de soporte de MoveFlow no modifica esos datos en PayPal.
5. Abre [PayPal Developer](https://developer.paypal.com/dashboard/), crea una aplicación **Sandbox** y usa comprador/vendedor de prueba. La integración usa Orders v2: **149 MXN por un mes** o **1,440 MXN por 12 meses**; no requiere crear planes recurrentes. El cliente aprueba cada compra y el servidor verifica el cobro para conceder el periodo.
6. Configura los secretos y webhooks en Supabase según [backend de pagos](backend-paypal.md). No pegues Client Secret, contraseñas, CLABE ni tokens en chats ni en GitHub; ningún secreto PayPal usa prefijo `VITE_`.
7. Prueba ambas compras ficticias, cierre de pestaña tras aprobar, duplicados, fallo de red, cuenta ajena, importe erróneo, pago pendiente, devolución y reconciliación. Confirma que la vigencia se aplica solo al negocio autorizado.
8. Completa identidad/domicilio/teléfono del operador, privacidad, condiciones, facturación y reembolsos. Verifica que el panel y las funciones vendidas ya funcionen. Luego configura la aplicación **Live**, sus identificadores y una validación final de cobro/retorno con el propietario.

Los formularios de tarjeta o cuenta se procesan en PayPal. Las opciones que se muestran —incluida tarjeta sin cuenta PayPal— dependen del país, producto, cuenta y elegibilidad del comprador; MoveFlow no puede garantizarlas a todos. Nunca recopilar números de tarjeta en el formulario propio.

## Costos

La tarifa estándar publicada para ventas nacionales es **3.95% + $4 MXN**, con IVA sobre las comisiones. Hay diferencias por tipo de operación, volumen, país y moneda. PayPal descuenta comisiones: no se reciben íntegros 149 o 1,440 pesos. No sumar la comisión inesperadamente al comprador; los precios anunciados deben ser totales. [Tarifas oficiales vigentes](https://www.paypal.com/mx/business/paypal-business-fees).

El comprobante PayPal no sustituye un CFDI ni las declaraciones del operador. El correo público para soporte es **soporte.moveflow@gmail.com**; no es por sí mismo una cuenta conectada para cobrar.

## Control del servicio

El registro de una cuenta, la aprobación del negocio y el pago son pasos distintos. Un pago no crea privilegios administrativos ni acepta términos por el usuario. Los permisos gratuitos existentes siguen configurados de forma privada.

La implementación no autorrenueva. Si más adelante se ofrecen cargos recurrentes, desarrollar consentimiento específico, aviso al menos cinco días naturales antes de renovación y cancelación inmediata, conforme al régimen aplicable. No basta cambiar un nombre en la página. [LFPC, artículo 76 Bis](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf).

Desactivar nuevas compras no debe detener webhooks, consultas de compras existentes ni aclaraciones. Consulta los controles y límites reales en [backend-paypal.md](backend-paypal.md).
