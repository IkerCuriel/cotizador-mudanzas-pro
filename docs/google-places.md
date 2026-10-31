# Sugerencias de ubicaciones con Google Places

La facturación ya fue activada personalmente por el propietario. Se habilitaron Maps JavaScript API, Places API (New) y Maps Embed API; la clave de navegador quedó restringida a esas tres API y al dominio público de MoveFlow, y se configuró en `.env.local` (ignorado por Git). La comprobación real de sugerencias debe realizarse después de publicar. El código no carga el SDK si falta la clave. No se contrató un plan de suscripción de Maps.

## Costo de la integración actual

Precios globales de pago por uso revisados el 30 de octubre de 2026; no son una cotización ni un límite contractual de gasto:

| Uso | Cuota mensual sin cargo publicada | Siguiente tramo, USD por 1,000 eventos |
| --- | --- | --- |
| Autocomplete Requests | 10,000 | $2.83 |
| Place Details Essentials (dirección seleccionada) | 10,000 | $5.00 |
| Maps Embed API | Sin cargo por uso | Sin cargo por uso |

Se cuentan eventos de cada producto, no usuarios: escribir en varios campos puede generar varias consultas. La integración agrupa consultas por sesión; las primeras 12 de una sesión terminada en Place Details Essentials cuentan como Autocomplete Requests y las posteriores de esa sesión tienen tratamiento distinto. Las sesiones abandonadas siguen contabilizando consultas. El precio efectivo depende del uso, los campos pedidos, impuestos, moneda y condiciones de la cuenta. No presupuestar cero por tener pocos visitantes ni confundirlo con el antiguo crédito mensual universal.

Fuentes: [tabla oficial de precios](https://developers.google.com/maps/billing-and-pricing/pricing), [sesiones y tarifas](https://developers.google.com/maps/documentation/javascript/session-pricing), [Maps Embed](https://developers.google.com/maps/documentation/embed/usage-and-billing).

Una alerta de presupuesto avisa, **no detiene automáticamente la facturación**. Configurar cuotas admitidas por cada API, restricciones de clave y alertas, revisar consumo real y reducir tráfico abusivo. [Presupuestos de Google Cloud](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## Activación cuando el propietario decida

1. Crear o elegir un proyecto de Google Cloud bajo una cuenta del propietario y completar personalmente sus términos y facturación. Habilitar **Maps JavaScript API**, **Places API (New)** y **Maps Embed API** en ese proyecto. Google requiere facturación y clave para estas integraciones; las condiciones y cobros de Places son distintos a los de Embed. Consultar [uso y facturación de Places](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) y [Maps Embed](https://developers.google.com/maps/documentation/embed/usage-and-billing).
2. Crear una clave de navegador con restricción de aplicación **Sitios web / referentes HTTP**. Autorizar solamente `https://moveflow-mudanzas.render-inspace.chatgpt.site/*` y, si hace falta durante pruebas, los orígenes locales concretos. Restringir además la clave a las tres API anteriores. Usar otra clave para servicios de servidor; nunca publicar una clave de servidor.
3. Establecer cuotas acordes al piloto y alertas de presupuesto. Una alerta de presupuesto **no es un límite de gasto**. Revisar el costo real de consultas abandonadas y selección de detalles, además del tráfico esperado; no prometer autocompletado gratuito o ilimitado. La agrupación por sesión sigue las [reglas de facturación de sesiones](https://developers.google.com/maps/documentation/javascript/session-pricing).
4. Revisar el apartado de conservación que sigue, y el aviso de privacidad y términos de la página. Las consultas escritas se envían a Google; el cliente debe conocerlo antes de usar la búsqueda. No pedir GPS para esta función.
5. Añadir `VITE_GOOGLE_MAPS_API_KEY` en `.env.local` del proyecto. Es una **clave pública de navegador**, protegida mediante restricciones, no mediante ocultarla. No pegarla en chats, documentación, incidencias o capturas. Recompilar y publicar después de configurarla.
6. Probar en el dominio publicado las sugerencias y selección para origen, destino, destinos adicionales y ubicación base de la empresa; comprobar que la dirección elegida se refleja en la ficha, que escribir de nuevo descarta la selección anterior y que no se envían respuestas antiguas. Revisar también errores, cuota agotada, navegación por teclado y toque, cambio de campo durante la selección, limpieza del formulario y falta de conexión.
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
- La misma búsqueda se usa para origen, destinos y ubicación de una empresa. No se filtran tipos: la API puede sugerir direcciones y establecimientos (por ejemplo restaurantes) según la consulta real. No se mantiene una lista local de comercios. Al elegir se conserva la dirección y el identificador del lugar, no su nombre comercial.
- Cada campo usa su propia sesión. Consultas de menos de tres caracteres no llegan a Google. La interfaz debe esperar una pausa al escribir y descartar respuestas si cambió el texto o el campo dejó de estar activo.
- Seleccionar llama `toPlace()` y `fetchFields({fields: ['id', 'formattedAddress']})`. No solicita fotos, reseñas, valoraciones, nombres comerciales, coordenadas ni rutas. Después se crea un token nuevo para una búsqueda nueva. `endSession(token)` permite invalidar una sesión abandonada.
- Los resultados son referencias temporales del SDK. No guardarlos en el borrador, registros, analítica ni base de datos. Los errores del proveedor se reemplazan por mensajes sin claves ni consultas privadas.
- Sin clave, ante fallo del servicio o sin coincidencias, la ubicación puede seguir escribiéndose manualmente. Eso no representa una coincidencia validada por Google.

## Atribución y conservación

El desplegable debe mostrar atribución **Google Maps** cerca de las sugerencias y dentro del mismo contenedor, separadas visualmente del contenido propio. Preferir el logotipo oficial; para la interfaz compacta puede usarse el texto con `translate="no"`, sin saltos, peso normal, fuente sans serif, tamaño de 12–16 px y contraste suficiente. No atribuir a Google resultados inventados, manuales o de otra fuente. La vista de mapa mantiene la atribución incluida. [Requisitos de atribución](https://developers.google.com/maps/documentation/javascript/policies).

Los **place IDs** pueden conservarse indefinidamente; Google recomienda actualizar los que tengan más de doce meses. Esa excepción no se extiende automáticamente a su dirección o nombre. [Guía oficial de place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id).

La [excepción «Autocomplete for end user addresses»](https://developers.google.com/maps/documentation/javascript/policies#autocomplete-for-end-user-addresses) alcanza únicamente la dirección postal seleccionada que el usuario habría proporcionado completa y correctamente sin Autocomplete, y solo para su transacción concreta. No alcanza la lista de sugerencias ni otros contenidos; tampoco las funciones de búsqueda de POI o direcciones de otros servicios. No existe una autorización general para conservar toda respuesta de Places. Los [términos específicos, B.14.3](https://cloud.google.com/maps-platform/terms/maps-service-terms) permiten treinta días para coordenadas de Places; esa regla no autoriza treinta días de almacenamiento de cualquier campo ni debe confundirse con las condiciones de Address Validation o Geocoding, que esta integración no usa.

### Aplicación a MoveFlow y pendientes concretos

- **Ficha de mudanza:** nuestra interpretación es que la excepción puede cubrir origen y destinos aportados como direcciones del usuario para esa mudanza. Verificar los requisitos anteriores antes de conservarlos o incluirlos en WhatsApp y fichas descargadas. Elegir un restaurante por nombre no acredita que su dirección postal fuera conocida por el usuario. El adaptador actual acepta establecimientos y solo conserva `formattedAddress`: eliminar el nombre comercial no resuelve por sí mismo la procedencia del dato.
- **Alta de una empresa:** el RPC valida la selección temporal y guarda únicamente `businessLocationPlace.placeId` con `businessLocationSource: 'google'`; elimina del contenido persistido tanto `businessLocation` como `label`. Sin selección de Google, conserva el texto aportado manualmente en `businessLocation` y marca `businessLocationSource: 'user'`. La fuente la establece el servidor. No se añade ningún campo al formulario. El operador podrá abrir Google Maps mediante el identificador; la dirección de Google no se convierte en domicilio permanente del perfil. Ver [altas-en-plataforma.md](./altas-en-plataforma.md).
- **Perfiles y catálogo público:** solicitar revisión del uso propuesto antes de incorporar contenido de Google a un directorio o publicidad. La sección 3.2.3 de los [términos generales](https://cloud.google.com/maps-platform/terms) restringe extracción, caché y utilización en servicios de directorio/publicidad. Conservar un `placeId` no elimina las demás restricciones del producto.

La reducción de datos del alta está implementada; no constituye una certificación contractual de usos futuros. Antes de publicar perfiles, mantener la información aportada independientemente por la empresa separada del contenido de Google y revisar el uso de directorio. `accepting_provider_applications` sigue en `false` por los pendientes de conexión, identidad legal y operación de altas. La activación técnica de la clave no activa Supabase ni concede permiso general para almacenar o redistribuir contenido de Google.

Los [términos de Google, sección 3.2.2(a)](https://cloud.google.com/maps-platform/terms), requieren avisar que la aplicación incorpora Google Maps y vincular sus términos para usuarios finales y su política de privacidad. `terminos.html` contiene ambos enlaces; `privacidad.html` explica el envío de búsquedas y enlaza la política de Google. Mantener estos avisos públicamente accesibles y la atribución visible. Esta revisión aplica al contrato general para facturación fuera del EEE; comprobar el contrato de la cuenta si cambia la región de facturación.

Las pruebas automatizadas del adaptador y del control verifican carga diferida, sesiones, campos solicitados, teclado, selección táctil, cambios durante respuestas pendientes, limpieza y errores usando dobles de prueba. **No prueban una cuenta real de Google, cuotas, facturación ni entrega de resultados en producción.** Fuentes revisadas el 30 de octubre de 2026.
