# Ubicaciones, mapas y destinos adicionales

El formulario mantiene un origen, un primer destino y hasta cinco destinos adicionales, en orden de entrega. El mapa se abre al entrar al campo y se actualiza tras una pausa al escribir. El cliente puede desmarcar «Mostrar mapas al buscar» antes de entrar en los campos para escribir sin consultar Google. No se usa GPS ni se calculan automáticamente precios o distancias por carretera.

## Estado publicado

- Las direcciones pueden escribirse manualmente y revisarse en un mapa. No se cargan mapas al abrir la página ni al restaurar el borrador: la primera consulta ocurre al enfocar un campo o pulsar «Ver mapa».
- Editar la dirección elimina la referencia seleccionada anterior y el mapa viejo. Los textos se codifican; nunca se navega a una URL aportada por el cliente.
- «Añadir destino» crea una parada posterior al primer destino. Puede cambiarse el orden de las paradas adicionales o quitarse una; el primer destino conserva su posición. Una parada añadida requiere dirección antes de continuar. Sus notas permiten precisar muebles, piso o acceso.
- El orden y los detalles se conservan en borrador, resumen, WhatsApp, descarga, impresión y detalle del panel. No se guarda una solicitud en la nube por el simple hecho de completar el formulario.
- El enlace «Abrir en Google Maps» sigue disponible si falla el mapa. Cambiar un punto dentro del iframe no modifica el formulario: solo una selección del desplegable integrado o la edición del campo pueden hacerlo.

## Autocompletado preparado, pendiente de activar

El propietario confirmó que todavía no tiene proyecto de Google Cloud. No hay clave configurada ni sugerencias reales activadas en producción. No se muestran opciones inventadas como resultados de Google.

La integración usa la API nueva de Places. Al activarla, cada campo muestra un desplegable con atribución Google Maps; puede seleccionarse con clic o flechas y Enter. La selección actualiza el texto y conserva el identificador del lugar. Las respuestas de consultas anteriores se descartan; una sesión pertenece a un solo campo. Se limita la consulta a cinco sugerencias y se espera una pausa de escritura. No hay consultas al teclear menos de tres caracteres.

Antes de activar: seguir [Google Places](google-places.md), configurar la cuenta, las restricciones y cuotas, verificar la política de contenido con la clave real y resolver las condiciones de conservación del contenido de Places. No se debe considerar que una dirección de Google pueda guardarse indefinidamente solo por copiarla al formulario. Las pruebas de la integración usan dobles de prueba; no prueban facturación ni resultados reales de Google.

## Vista incrustada

Sin clave se conserva `https://www.google.com/maps?q=…&output=embed&hl=es` como vista de mejor esfuerzo. No es una API con contrato de estabilidad: Google puede cambiarla o bloquearla. Si hay clave y selección de lugar se utiliza Maps Embed API v1 con `q=place_id:…`, que requiere habilitar esa API y restringir la clave.

Las consultas van a hosts fijos de Google. La política de contenido permite `www.google.com` para iframes y los hosts concretos necesarios para preparar la integración de Places. No se envían nombre, teléfono ni inventario en la búsqueda. El aviso de privacidad explica el comportamiento automático y la opción de desactivarlo.

Referencias oficiales revisadas el 30 de octubre de 2026: [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [Embed API](https://developers.google.com/maps/documentation/embed/embedding-map), [Places Autocomplete Data](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data).

## Contrato y base de datos

`src/locations.js` normaliza `originPlace`, `destinationPlace` y `additionalDestinations`. Una selección contiene exclusivamente `{placeId,label}` y se descarta si la etiqueta no coincide con el texto actual. Las paradas contienen `{address,notes?,place?}`; no se guardan coordenadas ni respuestas completas del proveedor. Los campos opcionales ausentes se omiten para conservar compatibilidad e idempotencia de fichas anteriores. Más de cinco paradas se rechazan, nunca se recortan silenciosamente al importar.

Aplicar la migración `20261031001155_route_destinations.sql` después de 001–005 antes de activar la nube. `public_site_config` debe anunciar `route_destinations_version=1`; la página bloquea el envío a un servidor que no conserve los nuevos campos. La migración valida estructura, tamaños y tipos sin ampliar permisos. Las pruebas SQL usan PGlite; no se ha aplicado a una base remota.

`originProperty=other` sigue requiriendo `originPropertyOther` de 1 a 120 caracteres. El texto se descarta al elegir una opción normal; destino conserva el catálogo anterior.
