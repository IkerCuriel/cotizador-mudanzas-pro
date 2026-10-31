# Envío y comienzo de una nueva solicitud

## Comportamiento visible

Preparar una ficha abre la revisión y conserva el formulario. Cerrar esa revisión, copiar la ficha, descargarla o imprimirla permite seguir revisando la misma solicitud.

Al pulsar **Continuar en WhatsApp**, la página abre el enlace de la ficha y prepara un formulario nuevo, vacío, desde el primer paso. La ficha anterior queda accesible mediante **Ver ficha anterior**, con su referencia `MF-…`. El cliente confirma el envío dentro de WhatsApp. Abrir el enlace no demuestra que WhatsApp haya enviado o entregado el mensaje, y el comprobante de la página no lo afirma.

El reinicio vacía domicilios, destinos adicionales, selecciones de mapa, muebles, habitaciones, servicios, notas, datos de contacto, fecha y consentimientos; los controles vuelven a sus valores iniciales. Los datos no reaparecen al recargar la página si el navegador permite guardar o eliminar el borrador. Si falla el almacenamiento, la ficha anterior sigue recuperable en memoria durante esa visita y se indica que debe descargarse antes de cerrar.

Un segundo envío de **la misma ficha anterior** mantiene la referencia y los detalles originales, para reconocer duplicados en WhatsApp. Abrirla no rellena ni borra una nueva solicitud que ya esté en curso. Preparar una solicitud nueva genera otra referencia, aunque se escriban datos parecidos.

## Guardado en el panel

Cuando la nube esté configurada y habilitada, el formulario se limpia únicamente después de recibir una confirmación de guardado. Un fallo o resultado incierto conserva el formulario y permite reintentar la misma referencia. El servidor mantiene sus comprobaciones de idempotencia.

La respuesta de una solicitud anterior puede llegar tarde. El código captura la ficha enviada antes de esperar la respuesta y compara su referencia y contenido con el borrador activo. Si el cliente ya empezó otro borrador, no lo borra ni cambia sus datos.

## Almacenamiento y recuperación

- `moveflow-request-draft-v1` contiene el borrador activo y vuelve a un formulario vacío tras el traspaso.
- `moveflow-quote-draft` solo se elimina al retirar ese borrador, para no recuperar datos de la versión antigua por accidente.
- `moveflow-requests-v1` conserva las fichas locales existentes.
- `moveflow-last-submission-v1` guarda exclusivamente referencia, canal, fecha y un indicador del retiro del borrador. No duplica teléfonos, domicilios o inventarios. Se usa para recuperar la ficha desde el historial local.

La operación no usa `localStorage.clear()` ni modifica sesiones de autenticación, permisos o datos de otras aplicaciones. El historial local sigue sujeto a sus límites y manejo de errores existentes; no se sobrescribe información ilegible para aparentar un guardado correcto.

## Pruebas

`tests/submission-lifecycle.test.js` comprueba aislamiento del borrador, referencias estables al reenviar, respuestas tardías, recuperación después de recargar, conservación de historial/sesión, metadatos inválidos y fallos de almacenamiento. Las pruebas no envían mensajes de WhatsApp ni demuestran entrega remota. Para comprobar la interfaz sin contactar al negocio, el entorno de pruebas puede interceptar localmente la navegación después de ejecutar el controlador real.
