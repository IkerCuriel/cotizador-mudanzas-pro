# WhatsApp de Mudanzas D’Curiel

Estado: **contacto manual preparado; automatización por API no integrada**. La atención pública se presenta como Mudanzas D’Curiel. MoveFlow conserva la función de plataforma y el enlace actual del piloto.

## Cómo funciona la página ahora

La página ya no presenta tarjetas personales de Tere y Marco ni pide elegir un asesor. Todos los botones públicos de contacto de WhatsApp se dirigen a la línea principal del negocio, atendida por **Tere: +52 55 2906 1098**.

- Si el cliente completa el formulario, revisa la ficha en el modal y abre WhatsApp con esa información precargada para Tere.
- Si quiere conversar sin completar el formulario, el botón prepara el mensaje general indicado abajo.
- El cliente puede revisar o editar el texto y debe pulsar **Enviar en WhatsApp**. Abrir el chat, preparar una ficha o pulsar un botón de la página no confirma que el negocio recibió el mensaje.
- Marco, **+52 56 1449 2452**, se conserva en la configuración del equipo para la siguiente etapa. No recibe una copia automática ni aparece como alternativa en el formulario público.

Mensaje general exacto:

> Hola, Mudanzas D’Curiel. Me interesa un servicio de mudanza. ¿Me pueden ayudar con disponibilidad y una propuesta?

Este contacto manual no necesita Supabase ni una cuenta del cliente en MoveFlow. Los datos de la ficha se incluyen en el enlace de WhatsApp al abrirlo; mantener informado al cliente y no solicitar datos sensibles innecesarios. La configuración de contactos está en `src/config.js`.

**No se configuró una API de WhatsApp, no se modificaron las cuentas de Tere o Marco, no se vincularon teléfonos y no se enviaron mensajes de prueba.** La validación de la web comprueba el destinatario y el texto del enlace; no acredita recepción en los teléfonos.

## Opción 1: atender una misma cuenta desde ambos teléfonos

Para el piloto, la opción más sencilla es usar la cuenta de **WhatsApp Business** del negocio con el número de Tere y vincular un teléfono de Marco como dispositivo adicional. Ambos podrán atender las conversaciones de esa cuenta.

Esto comparte una misma bandeja: **no entrega mensajes a los dos números independientes**. El cliente sigue escribiendo al número principal. Debe revisarse que la cuenta sea apropiada para uso compartido; el teléfono vinculado tendrá acceso a las conversaciones que WhatsApp sincronice, por lo que no conviene compartir una cuenta que mezcle asuntos personales.

Procedimiento del propietario, siguiendo la ayuda oficial:

1. En el teléfono adicional, abrir WhatsApp Business y elegir la opción para vincularlo como dispositivo adicional, en lugar de registrar el número de Marco como sustituto de la cuenta principal.
2. En el teléfono principal de Tere, abrir **Dispositivos vinculados → Vincular un dispositivo** y escanear el código QR mostrado en el teléfono adicional.
3. Comprobar los dispositivos autorizados y los permisos de notificación en ambos teléfonos. Retirar cualquier dispositivo que ya no deba acceder.
4. Realizar una prueba acordada: un participante envía un mensaje de prueba y ambos confirman su recepción y respuesta desde la misma cuenta.

La ayuda consultada admite hasta cuatro dispositivos vinculados sin mantener conectado el teléfono principal; requiere usar ese teléfono periódicamente. No hace falta contratar la API para este flujo. La disponibilidad de avisos depende de Internet y de los ajustes del dispositivo; no se promete una alerta inmediata en todo momento.

Fuente: [vincular dispositivos y teléfonos en WhatsApp Business](https://faq.whatsapp.com/878854700132604/?cms_platform=android).

## Opción 2: avisos automáticos a los dos números

Es posible desarrollar el siguiente flujo con **WhatsApp Business Platform**: el cliente confirma el formulario, un servidor valida y guarda la solicitud, y el servidor solicita a la API un aviso separado para cada destinatario autorizado. Es una propuesta de implementación, no una función activa del sitio.

Los avisos saldrían del número empresarial configurado para la API, no de la cuenta personal del cliente. Debe elegirse y habilitarse el remitente antes de comprometer los dos números actuales. No basta con instalar WhatsApp Business ni con configurar los teléfonos en JavaScript.

Requisitos para una implementación posterior:

1. Preparar la cuenta empresarial y la aplicación de Meta, habilitar un número remitente para WhatsApp Business Platform y completar las verificaciones que solicite la plataforma.
2. Implementar la recepción en un servidor con validación, control de abuso y una cola que evite duplicados. Guardar las credenciales solo en secretos del servidor; nunca en `src/`, `public/`, un repositorio o variables `VITE_`.
3. Obtener la aceptación de Tere y Marco para recibir esos avisos y mantener vigente la autorización de acceso a las solicitudes. Informar al cliente de quién atenderá sus datos y para qué, mediante el aviso de privacidad y el consentimiento que corresponda.
4. Solicitar la aprobación de las plantillas necesarias. La política permite iniciar conversaciones mediante plantillas aprobadas; fuera de la ventana de atención de 24 horas también exige plantillas. Completar un formulario web no abre por sí mismo una conversación de WhatsApp con ninguno de los asesores.
5. Confirmar costos y condiciones vigentes, probar con destinatarios autorizados y supervisar estados de entrega. Una petición aceptada por la API no demuestra que el mensaje fue entregado o leído.

Se recomienda que el aviso solo indique que hay una nueva solicitud y enlace al panel protegido, en vez de incluir domicilios, teléfono e inventario del cliente en una notificación visible en la pantalla bloqueada. La categoría y aprobación final de la plantilla corresponden a Meta; no están garantizadas.

La API puede generar cargos por mensajes entregados y un proveedor intermediario puede cobrar servicios adicionales. **No se promete una automatización gratuita ni una tarifa fija.** Consultar las condiciones vigentes en la cuenta antes de habilitar pagos. No usar bots que automaticen WhatsApp Web ni servicios que pidan copiar una sesión fuera de las aplicaciones oficiales.

Fuentes oficiales consultadas el 30 de octubre de 2026:

- [Política de mensajería: permisos, plantillas, ventana de atención y protección de datos](https://whatsappbusiness.com/policy/).
- [Precios de WhatsApp Business Platform](https://whatsappbusiness.com/products/platform-pricing/).
- [Ejemplo oficial de Meta de envío de una plantilla a un destinatario](https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive). El ejemplo describe la estructura de envío; una integración nueva debe usar la versión vigente de la API, no copiar una versión antigua del ejemplo.

## Diferencia con los avisos del panel

El repositorio incluye una implementación separada de **Web Push**, descrita en [avisos al teléfono](notificaciones-telefono.md). Cuando se conecte y verifique, podrá avisar en el navegador a los miembros autorizados del equipo familiar que activen su dispositivo. No envía mensajes de WhatsApp y no se dispara al abrir el enlace manual.

Para la operación actual se recomienda mantener el botón único hacia Tere y, si el negocio lo decide, compartir la cuenta mediante dispositivos vinculados. La automatización de WhatsApp requiere una fase adicional de configuración, desarrollo y pruebas reales.

Referencia del comportamiento actual: [enlaces de WhatsApp con mensaje precargado](https://faq.whatsapp.com/5913398998672934).
