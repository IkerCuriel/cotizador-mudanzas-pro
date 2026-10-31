# Solicitudes de perfil para negocios

La página pública `mudanceros.html` presenta los planes mensual de 149 MXN y anual de 1,440 MXN en un solo pago por 12 meses (equivalente a 120 MXN al mes) y un formulario de contacto. No incluye una pasarela activa, no crea cuentas ni habilita permisos. El destinatario autorizado es `iker.san.cu@gmail.com`, configurado en `src/provider-interest.js`.

## Lo que hace el solicitante

1. Completa nombre del negocio, persona de contacto, correo, WhatsApp, ubicación base, tipo de servicio y el plan de interés. Las otras zonas de cobertura y notas son opcionales. La ubicación base representa un solo lugar y no sustituye la lista de ciudades donde da servicio. Puede indicar colonia o ciudad sin revelar un domicilio privado.
2. Autoriza que lo contacten para gestionar el alta y prepara el mensaje.
3. Revisa la solicitud. «Abrir mi correo» abre un enlace `mailto:` con destinatario, asunto y cuerpo; debe pulsar **Enviar** en su aplicación.
4. Si no tiene una aplicación de correo configurada, puede copiar el mensaje y enviarlo desde su correo web.

El sitio no puede confirmar entrega o recepción. Nunca muestra «solicitud enviada» por abrir el enlace. El formulario no guarda borradores en el navegador, no envía información a administración mientras se escribe y no solicita documentos, tarjetas ni contraseñas. Editar un campo invalida la revisión anterior; debe preparar de nuevo el mensaje. Recargar o volver mediante BFCache vacía el formulario, el plan vuelve al mensual y se descarta la selección del mapa.

El mapa aparece al entrar al campo y se actualiza al escribir. El usuario puede desactivarlo antes de buscar para no consultar Google. Sin una clave habilitada hay vista orientativa y enlace externo; el desplegable real de Google requiere activar Maps/Places. Cuando está disponible, seleccionar una sugerencia incorpora su identificador al enlace del correo; cambiar el texto descarta ese identificador. No se guarda una respuesta completa de Google ni se afirma que un domicilio esté verificado. El mensaje distingue lugar seleccionado de referencia por revisar.

## Lo que hace la administración

1. Revisar la bandeja de entrada y responder desde la cuenta del propietario. Valorar datos de contacto, cobertura y autorización para publicar las fotografías.
2. Explicar disponibilidad, alcance del plan y condiciones antes de contratar. Los precios publicados son 149 MXN mensuales o 1,440 MXN por 12 meses en un solo pago, equivalente a 120 MXN mensuales y con ahorro anual de 348 MXN frente a 12 mensualidades. La equivalencia no es un cargo mensual de 120 MXN; no cobrar por un acceso que todavía no puede entregarse.
3. Una vez conectado el backend, crear la cuenta por invitación a un correo real, verificarlo y asociarla al negocio autorizado. No compartir contraseñas ni conceder permisos por un campo del formulario.
4. Mantener separados el estado del perfil, la aprobación del negocio y la vigencia de su acceso. La cuenta no se activa por recibir un correo o una captura de pago.
5. Para los cobros automáticos, seguir [la preparación de PayPal](activar-paypal.md) y [el control de planes](planes-y-cobros.md). Esta entrega aún no procesa pagos.

## Validación

`tests/provider-interest.test.js` cubre campos obligatorios, consentimiento, límites, destinatario fijo, codificación del mensaje, rechazo de datos manipulados, códigos de plan desconocidos, precio exacto de ambos planes sin cobro activo, ubicación requerida, cobertura opcional y selección del mapa invalidada al editar su texto. Las pruebas no envían correos. El recorrido visible se revisa hasta el mensaje preparado sin abrir el cliente de correo.
