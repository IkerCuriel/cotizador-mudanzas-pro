# Envío y comienzo de una nueva solicitud

## Comportamiento visible

Cada nueva carga, recarga o regreso mediante la navegación del navegador abre un formulario vacío en el primer paso. Esto también se aplica cuando el navegador recupera la página desde su memoria de navegación (BFCache). No se rellenan automáticamente datos de visitas anteriores.

El borrador existe únicamente en memoria durante la visita actual. Puedes cambiar de paso, revisar la ficha o cambiar momentáneamente de aplicación o pestaña sin borrarlo. Si cierras, recargas o navegas fuera de la página, el borrador no se recuperará al volver. Preparar una ficha abre la revisión y guarda una copia separada en el historial local, si el navegador lo permite. Cerrar esa revisión, copiar la ficha, descargarla o imprimirla permite seguir revisando la misma solicitud durante esa visita.

Al pulsar **Continuar en WhatsApp**, la página abre el enlace de la ficha y prepara un formulario nuevo, vacío, desde el primer paso. La ficha anterior queda accesible mediante **Ver ficha anterior**, con su referencia `MF-…`. El cliente confirma el envío dentro de WhatsApp. Abrir el enlace no demuestra que WhatsApp haya enviado o entregado el mensaje, y el comprobante de la página no lo afirma.

El reinicio vacía domicilios, destinos adicionales, selecciones de mapa, muebles, habitaciones, servicios, notas, datos de contacto, fecha y consentimientos; los controles vuelven a sus valores iniciales. La página no lee borradores guardados por versiones anteriores, incluso si el navegador impide eliminarlos. Si falla el guardado de una ficha preparada, la copia sigue recuperable en memoria durante esa visita y se indica que debe descargarse antes de cerrar.

Un segundo envío de **la misma ficha anterior** mantiene la referencia y los detalles originales, para reconocer duplicados en WhatsApp. La ficha solo se abre cuando el cliente la elige; abrirla no rellena ni borra una nueva solicitud que ya esté en curso. Preparar una solicitud nueva genera otra referencia, aunque se escriban datos parecidos.

## Guardado en el panel

Cuando la nube esté configurada y habilitada, la acción de enviar al panel limpia el formulario después de recibir una confirmación de guardado. Un fallo o resultado incierto conserva el formulario durante la visita actual y permite reintentar la misma referencia. Recargar o salir sigue iniciando un formulario vacío al volver. El servidor mantiene sus comprobaciones de idempotencia.

La respuesta de una solicitud anterior puede llegar tarde. El código captura la ficha enviada antes de esperar la respuesta y compara su referencia y contenido con el borrador activo. Si el cliente ya empezó otro borrador, no lo borra ni cambia sus datos.

## Almacenamiento y recuperación

- El borrador activo no se escribe en almacenamiento persistente ni se restaura automáticamente.
- `moveflow-request-draft-v1` y `moveflow-quote-draft` son claves de versiones anteriores. Al iniciar se intenta eliminar únicamente esas dos claves, sin leer ni restaurar su contenido.
- `moveflow-requests-v1` conserva las fichas locales existentes.
- `moveflow-last-submission-v1` guarda exclusivamente referencia, canal, fecha y un indicador del retiro del borrador. No duplica teléfonos, domicilios o inventarios. Se usa para recuperar la ficha desde el historial local.

La limpieza no usa `localStorage.clear()` ni elimina el historial, el recibo o las sesiones de autenticación; tampoco modifica permisos ni datos de otras aplicaciones. Las fichas guardadas siguen disponibles para consulta explícita. El historial local sigue sujeto a sus límites y manejo de errores existentes; no se sobrescribe información ilegible para aparentar un guardado correcto.

## Pruebas

`tests/submission-lifecycle.test.js` comprueba aislamiento del borrador, referencias estables al reenviar, respuestas tardías, recuperación del recibo después de recargar, conservación de historial/sesión, metadatos inválidos y fallos de almacenamiento. Para verificar el inicio limpio, comprobar además una visita con claves antiguas pobladas, una recarga y un regreso mediante Atrás, así como que cambiar momentáneamente de pestaña no borre el formulario activo. Las pruebas no envían mensajes de WhatsApp ni demuestran entrega remota. Para comprobar la interfaz sin contactar al negocio, el entorno de pruebas puede interceptar localmente la navegación después de ejecutar el controlador real.
