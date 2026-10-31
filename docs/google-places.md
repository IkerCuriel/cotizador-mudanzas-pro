# Sugerencias de ubicaciones con Google Places

La integración está **preparada, todavía sin activar**. El propietario indicó que aún no tiene el proyecto de Google Cloud. No se ha creado una cuenta de facturación, contratado un servicio ni configurado una clave. Sin clave válida, el módulo no carga el SDK ni consulta sugerencias. La escritura manual y la vista previa de Google Maps siguen siendo el recurso disponible.

## Activación cuando el propietario decida

1. Crear o elegir un proyecto de Google Cloud bajo una cuenta del propietario y completar personalmente sus términos y facturación. Habilitar **Maps JavaScript API**, **Places API (New)** y **Maps Embed API** en ese proyecto. Google requiere facturación y clave para estas integraciones; las condiciones y cobros de Places son distintos a los de Embed. Consultar [uso y facturación de Places](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) y [Maps Embed](https://developers.google.com/maps/documentation/embed/usage-and-billing).
2. Crear una clave de navegador con restricción de aplicación **Sitios web / referentes HTTP**. Autorizar solamente `https://moveflow-mudanzas.render-inspace.chatgpt.site/*` y, si hace falta durante pruebas, los orígenes locales concretos. Restringir además la clave a las tres API anteriores. Usar otra clave para servicios de servidor; nunca publicar una clave de servidor.
3. Establecer cuotas acordes al piloto y alertas de presupuesto. Una alerta de presupuesto **no es un límite de gasto**. Revisar el costo real de consultas abandonadas y selección de detalles, además del tráfico esperado; no prometer autocompletado gratuito o ilimitado. La agrupación por sesión sigue las [reglas de facturación de sesiones](https://developers.google.com/maps/documentation/javascript/session-pricing).
4. Revisar el apartado de conservación que sigue, y el aviso de privacidad y términos de la página. Las consultas escritas se envían a Google; el cliente debe conocerlo antes de usar la búsqueda. No pedir GPS para esta función.
5. Añadir `VITE_GOOGLE_MAPS_API_KEY` en `.env.local` del proyecto. Es una **clave pública de navegador**, protegida mediante restricciones, no mediante ocultarla. No pegarla en chats, documentación, incidencias o capturas. Recompilar y publicar después de configurarla.
6. Probar en el dominio publicado las sugerencias y selección para origen, destino y destinos adicionales; comprobar que la dirección elegida se refleja en la ficha, que escribir de nuevo descarta la selección anterior y que no se envían respuestas antiguas. Revisar también errores, cuota agotada, navegación por teclado, retorno al borrador y falta de conexión.
7. Revisar los rechazos de la política de contenido (CSP) con la clave real. El adaptador carga desde `maps.googleapis.com`; Google puede cargar componentes y hacer consultas desde otros dominios documentados. No ampliar permisos a `https:`, scripts inline o evaluación dinámica indiscriminadamente para ocultar un error. La [guía oficial de CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy) recomienda nonces y revisar los dominios vigentes. Esta comprobación externa sigue pendiente.

Eliminar la clave del entorno y volver a publicar desactiva el autocompletado. Si se compromete, revocarla o rotarla en Google Cloud; cambiar solo el archivo local no revoca una clave que ya se haya publicado.

## Contrato del módulo

`src/google-places.js` usa [Autocomplete Data API de Maps JavaScript](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data), no los endpoints heredados de Places ni consultas extraídas de la web pública de Maps.

```js
const client = createGooglePlacesClient({ apiKey });
if (client.available) {
  const session = await client.createSession();
  const choices = await client.fetchSuggestions(text, session);
  // Tras la selección explícita de una opción:
  const selected = await client.select(choices[index].prediction);
  // selected = { placeId, label }
}
```

- Importar el módulo o crear el cliente no inicia peticiones. El SDK se carga al pedir la primera sesión; carga única por ventana, con error y tiempo máximo de espera.
- Cada campo usa su propia sesión. Consultas de menos de tres caracteres no llegan a Google. La interfaz debe esperar una pausa al escribir y descartar respuestas si cambió el texto o el campo dejó de estar activo.
- Seleccionar llama `toPlace()` y `fetchFields({fields: ['id', 'formattedAddress']})`. No solicita fotos, reseñas, valoraciones, nombres comerciales, coordenadas ni rutas. Después se crea un token nuevo para una búsqueda nueva. `endSession(token)` permite invalidar una sesión abandonada.
- Los resultados son referencias temporales del SDK. No guardarlos en el borrador, registros, analítica ni base de datos. Los errores del proveedor se reemplazan por mensajes sin claves ni consultas privadas.
- Sin clave, ante fallo del servicio o sin coincidencias, la ubicación puede seguir escribiéndose manualmente. Eso no representa una coincidencia validada por Google.

## Atribución y conservación

El desplegable debe mostrar atribución **Google Maps** cerca de las sugerencias y dentro del mismo contenedor, separadas visualmente del contenido propio. Preferir el logotipo oficial; para la interfaz compacta puede usarse el texto con `translate="no"`, sin saltos, peso normal, fuente sans serif, tamaño de 12–16 px y contraste suficiente. No atribuir a Google resultados inventados, manuales o de otra fuente. La vista de mapa mantiene la atribución incluida. [Requisitos de atribución](https://developers.google.com/maps/documentation/javascript/policies).

Los **place IDs** se pueden conservar según su [documentación oficial](https://developers.google.com/maps/documentation/places/web-service/place-id). El proyecto no debe convertir las sugerencias en un catálogo propio, almacenar respuestas completas ni conservar coordenadas o fotografías de Places.

**Pendiente antes de activar con datos reales:** revisar que la conservación de la dirección obtenida de Google en borradores, solicitudes, fichas descargadas y WhatsApp sea compatible con el contrato aplicable. Los [términos específicos actuales](https://cloud.google.com/maps-platform/terms/maps-service-terms) distinguen Places de Address Validation: la excepción relativa a una dirección confirmada o corregida por el usuario está en Address Validation, y no es una autorización general para guardar `formattedAddress` de Places indefinidamente. No se ha verificado una excepción que cubra este uso de Places. Copiar el resultado al formulario o llamarlo «confirmado por el cliente» no se presenta aquí como una exención. Hasta resolverlo, mantener la integración desactivada y usar la ubicación escrita por el cliente.

Las pruebas automatizadas del adaptador verifican carga diferida, sesiones, campos solicitados y errores usando dobles de prueba. **No prueban una cuenta real de Google, cuotas, facturación ni entrega de resultados en producción.** Fuentes revisadas el 30 de octubre de 2026.
