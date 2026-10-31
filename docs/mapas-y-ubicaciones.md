# Ubicaciones y vista previa de mapas

El formulario ofrece una vista previa independiente para origen y destino. Cada persona escribe colonia, ciudad o dirección y decide cuándo consultar Google. No se usa ubicación GPS ni se requiere API de autocompletado o geocodificación.

## Comportamiento

- Escribir no hace peticiones a Google. «Ver mapa» carga un iframe solo para la ubicación seleccionada.
- «Abrir en Google Maps» es un enlace de búsqueda documentado que puede usarse aunque el navegador bloquee el iframe.
- Editar una ubicación elimina su vista anterior. Hay que volver a pulsar «Ver mapa» para consultar el texto actualizado.
- La ficha conserva el texto escrito, no coordenadas supuestamente verificadas. El mapa puede mostrar una zona o una coincidencia aproximada: confirmar la dirección con el negocio.
- No se calculan distancia de carretera ni precios a partir del mapa.
- La consulta se codifica como texto en un dominio fijo. El largo del enlace se limita; si la dirección no cabe, se solicita una ubicación más breve para la consulta.

## Inserción y dependencia externa

La vista utiliza `https://www.google.com/maps?q=…&output=embed&hl=es` como inserción de mejor esfuerzo, sin claves ni facturación configuradas por este proyecto. Ese formato no se presenta como una API con contrato de estabilidad: Google puede cambiarlo o bloquearlo. El enlace de búsqueda oficial se mantiene disponible y la solicitud funciona sin el mapa.

Para una integración formal futura puede utilizarse **Maps Embed API v1**, con una clave restringida al dominio y a esa API. Google indica que Embed no tiene cargo por uso, pero su activación requiere clave y configuración de Google Cloud/facturación. No activar otros servicios o restricciones de pago suponiendo que comparten esas condiciones.

Fuentes oficiales consultadas el 30 de octubre de 2026:

- [Maps URLs: búsqueda mediante `api=1&query=`, sin clave y con límite de URL](https://developers.google.com/maps/documentation/urls/get-started).
- [Compartir o insertar mapas concretos desde Google Maps](https://support.google.com/maps/answer/7101463?hl=es).
- [Maps Embed API: uso y facturación](https://developers.google.com/maps/documentation/embed/usage-and-billing).
- [Configuración de Maps Embed API](https://developers.google.com/maps/documentation/embed/quickstart).

## Privacidad y seguridad

La interfaz informa antes de cargar el mapa que se compartirá la ubicación con Google. El aviso de privacidad describe el servicio externo y la opción de continuar sin él. No precargar iframes, no insertar URL proporcionadas por el cliente y no enviar el inventario o los datos de contacto en la consulta. La política de contenido permite únicamente `https://www.google.com` como origen de frames; no se amplían permisos de scripts, GPS o servidor.

## Otro inmueble en origen

El campo `originProperty=other` requiere `originPropertyOther`, texto de 1 a 120 caracteres tras limpiar y recortar espacios. Se conserva en el borrador, resumen, ficha de WhatsApp, descarga y panel. Al seleccionar un tipo normal deja de formar parte de la ficha. Destino conserva el catálogo anterior.

Antes de activar el guardado remoto, aplicar la migración `202610300005_other_property.sql` después de 001–004. Amplía la validación del servidor sin aceptar campos de permisos ni controles del cliente. Las cuentas y la conexión remota tienen una activación independiente de los mapas.
