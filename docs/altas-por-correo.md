# Solicitudes de perfil para negocios

La página pública `mudanceros.html` presenta un plan mensual de 149 MXN y un formulario de contacto. No incluye una pasarela activa, no crea cuentas ni habilita permisos. El destinatario autorizado es `iker.san.cu@gmail.com`, configurado en `src/provider-interest.js`.

## Lo que hace el solicitante

1. Completa nombre del negocio, persona de contacto, correo, WhatsApp, cobertura y tipo de servicio; las notas son opcionales.
2. Autoriza que lo contacten para gestionar el alta y prepara el mensaje.
3. Revisa la solicitud. «Abrir mi correo» abre un enlace `mailto:` con destinatario, asunto y cuerpo; debe pulsar **Enviar** en su aplicación.
4. Si no tiene una aplicación de correo configurada, puede copiar el mensaje y enviarlo desde su correo web.

El sitio no puede confirmar entrega o recepción. Nunca muestra «solicitud enviada» por abrir el enlace. El formulario no guarda borradores en el navegador, no envía información mientras se escribe y no solicita documentos, tarjetas ni contraseñas. Editar un campo invalida la revisión anterior; debe preparar de nuevo el mensaje. Recargar o volver mediante BFCache vacía el formulario.

## Lo que hace la administración

1. Revisar la bandeja de entrada y responder desde la cuenta del propietario. Valorar datos de contacto, cobertura y autorización para publicar las fotografías.
2. Explicar disponibilidad, alcance del plan y condiciones antes de contratar. El precio publicado es 149 MXN mensuales; no cobrar por un acceso que todavía no puede entregarse.
3. Una vez conectado el backend, crear la cuenta por invitación a un correo real, verificarlo y asociarla al negocio autorizado. No compartir contraseñas ni conceder permisos por un campo del formulario.
4. Mantener separados el estado del perfil, la aprobación del negocio y la vigencia de su acceso. La cuenta no se activa por recibir un correo o una captura de pago.
5. Para los cobros automáticos, seguir [la preparación de PayPal](activar-paypal.md) y [el control de planes](planes-y-cobros.md). Esta entrega aún no procesa pagos.

## Validación

`tests/provider-interest.test.js` cubre campos obligatorios, consentimiento, límites, destinatario fijo, codificación del mensaje, rechazo de datos manipulados y plan sin cobro activo. Las pruebas no envían correos. El recorrido visible se revisa hasta el mensaje preparado sin abrir el cliente de correo.
