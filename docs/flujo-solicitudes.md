# Flujo de solicitudes · piloto familiar

## Cambio de enfoque

MoveFlow prepara una solicitud para que una persona venda y acuerde el servicio. El cliente describe lo que necesita y decide con quién contratar después de hablar con el negocio. Se retiraron del flujo público los banderazos, los cargos por volumen o distancia, el rango de precio y el cálculo automático de cotizaciones.

El motor anterior permanece en `src/pricing.js` y sus criterios se conservan en `docs/tarifas.md` como historial. No se utiliza para poner precio a las solicitudes actuales.

## Información de la mudanza

- **Tipo:** local o foráneo. El foráneo admite directo, compartido o por definir con el asesor.
- **Origen y destino:** domicilio, tipo de inmueble, piso y acceso en cada extremo.
- **Inmuebles:** departamento, casa, bodega, casa dúplex, residencial, residencial plus y oficina.
- **Niveles y acceso:** planta baja y pisos superiores; elevador, escaleras o un recorrido combinado. Se puede indicar cuántos niveles cubre el elevador.
- **Acarreo:** tramos de hasta 10 m, 11–20 m, 21–30 m, más de 30 m o por confirmar. El último tramo admite distancia informada. Los intervalos son excluyentes, para evitar que 1–10 y 1–20 signifiquen lo mismo.
- **Traspaleo:** necesidad o incertidumbre en cada domicilio y servicio a revisar. La página no deduce esta maniobra a partir de un umbral arbitrario de metros; el negocio confirma las condiciones de acceso y la viabilidad.
- **Habitaciones:** número de salas, comedores, recámaras, bodegas, salas de estar, estudios, cocinas, cuartos de lavado, cuartos de servicio, vestidores y terrazas.
- **Inventario:** «Todos los muebles» es la vista inicial del catálogo y se mantiene al agregar habitaciones. Los filtros cambian lo que se muestra; el botón `+` agrega cada artículo. El contador indica lo que realmente se llevará y comienza con una instrucción, no con «0 artículos». Los sofás y sillones individuales tienen tarjetas separadas; las sillas usan un contador general y otro para sillas de escritorio. Las variantes de refrigerador, cama y otros muebles conservan sus cantidades al cambiar de opción.
- **Muebles especiales:** selección de artículos como pianos y cajas fuertes, más notas sobre dificultades de acceso. El equipo confirma peso, medidas y maniobras directamente con el cliente.
- **Servicios:** empaque, cajas por empacar, volados de subida y bajada, traspaleo y desmontaje/montaje. El personal necesario lo decide la empresa. La disponibilidad y duración de almacenamiento se acuerdan durante la conversación; el cliente puede mencionarlo en las notas.
- **Contacto:** nombre, teléfono, correo opcional, llamada o mensaje preferido y horario de contacto.

La aplicación no estima el peso ni el volumen de las solicitudes. Los totales contienen únicamente cantidades de artículos, habitaciones y artículos de manejo especial. Ni la ficha de WhatsApp, ni la impresión, ni el panel, ni los archivos nuevos incluyen cálculos de medidas o campos para cargadores y días de almacenamiento. El negocio revisa los datos antes de hacer una propuesta.

La simplificación conserva todos los IDs de artículos históricos: `chair-dining` identifica ahora el contador general de sillas, `chair-office` el de escritorio y `chair-folding` sigue siendo válido al importar una ficha anterior. No se fusionan los contadores históricos, evitando perder cantidades cuando ambos ya estaban en su máximo. El modelo de solicitud admite abrir archivos existentes y recalcula solo cantidades; descarta los antiguos totales de peso/volumen y decisiones operativas. No se modifican los registros que ya están en la base de datos ni se requiere una migración para estos cambios. El motor anterior `src/pricing.js` se conserva aislado como referencia histórica y no forma parte del formulario público.

Si el cliente elige no contratar empaque, la aplicación pide reconocer que no se recogen artículos sueltos y presenta una guía de preparación. La selección de un servicio solo comunica la necesidad; no garantiza disponibilidad ni determina un cargo.

## Preparación y envío de la ficha

La solicitud se guarda en el navegador con una referencia propia. La ficha compartible incluye el recorrido, condiciones de acceso, inventario, servicios y datos de contacto. No contiene una tarifa calculada.

El botón de WhatsApp abre el chat con el negocio configurado y prepara el texto. **El usuario debe revisar y enviar el mensaje desde WhatsApp.** El sitio no sabe si se envió, entregó o respondió. Copiar o descargar tampoco comunica automáticamente la solicitud al negocio.

La configuración actual utiliza el WhatsApp proporcionado por el usuario, `525529061098`. Se modifica en `src/config.js`. Si no hay número configurado, se abre el selector de destinatario de WhatsApp en lugar de simular un contacto.

## Panel local de seguimiento

En `piloto.html` aparecen las solicitudes preparadas o importadas en ese navegador. El panel arranca vacío: no se agregan clientes, empresas, testimonios ni ofertas ficticias para aparentar actividad.

Cada solicitud permite revisar la ficha, abrir una llamada o WhatsApp al cliente y actualizar su seguimiento manualmente:

| Estado visible | Cuándo usarlo |
| --- | --- |
| Preparada | Existe una ficha local; no implica que el negocio la haya recibido. |
| Contactado | Una persona confirmó que ya contactó al cliente. |
| En conversación | Se están revisando condiciones o ya hay propuestas manuales. |
| Elección registrada | Se anotó qué propuesta eligió el cliente. |

Las propuestas se escriben después de la conversación: nombre del negocio o persona, importe en MXN, servicios/condiciones y contacto opcional. La aplicación compara lo registrado sin calcular un precio ni ordenar por un supuesto “mejor ofertador”. La disponibilidad, condiciones y calidad del servicio siguen siendo parte de la decisión del cliente.

**Registrar la elección del cliente no hace una reserva, cobra, contrata ni envía mensajes.** Solo conserva una nota de la decisión. El negocio y el cliente deben confirmar directamente el acuerdo y los siguientes pasos.

## Guardado y transferencia entre equipos

Los registros usan `localStorage`, bajo `moveflow-requests-v1`, en el mismo origen y perfil del navegador. `localhost`, `127.0.0.1` y GitHub Pages tienen almacenamientos distintos; otro navegador o dispositivo tampoco comparte sus datos. Borrar datos del sitio elimina las copias locales.

Para revisar una ficha en otro equipo, hay que descargar su archivo `.json`, compartirlo e importarlo en el panel de destino. Las descargas del panel incluyen el seguimiento y las ofertas manuales. El archivo no sincroniza los equipos: después de cambiarlo en un equipo, el otro conserva su copia anterior hasta recibir un archivo actualizado.

El panel valida los archivos antes de guardarlos, recalcula los totales descriptivos y muestra un error si el formato o los datos guardados no se pueden leer. Ante un fallo de lectura no borra ni sustituye el contenido anterior. También comunica los fallos de guardado, para que no se confunda una interacción con un registro persistido.

Si la referencia importada ya existe, el panel muestra cuántas propuestas contiene cada copia y permite combinarlas o conservar la actual. También permite descargar la copia actual antes de continuar. Al combinar se agregan las propuestas nuevas y se conserva el seguimiento más avanzado. Si cambian los datos de la mudanza, una misma propuesta tiene contenido distinto o hay elecciones incompatibles, se rechaza la importación sin alterar lo guardado. El negocio debe revisar esas diferencias antes de continuar.

Esta versión admite hasta 100 solicitudes locales y hasta 100 propuestas por solicitud. No es un archivo histórico empresarial ni una copia de seguridad. Conviene exportar los registros que se quieran conservar antes de limpiar el navegador.

## Alcance público y privacidad

`piloto.html` es una página accesible mediante su URL. La etiqueta para evitar indexación no reemplaza autenticación. El panel no tiene cuentas ni contraseñas y cualquier persona que use el mismo perfil del navegador puede consultar esos registros.

Guardar una ficha local no sube sus domicilios, inventario ni contacto a GitHub. Sí quedan datos personales en el dispositivo y en cada archivo exportado. Los archivos y los mensajes deben compartirse únicamente con quien atenderá esa mudanza.

La autorización para contacto está limitada al flujo actual del negocio familiar. No equivale a consentir distribución masiva a una red futura de mudanceros.

## Pendiente para una plataforma comercial

El piloto no incluye recepción centralizada de solicitudes, base de datos compartida, autenticación, permisos por empresa, registro o validación de proveedores, distribución de oportunidades, suscripciones, notificaciones, pagos, reservas o contratos. Esas piezas requieren diseño e implementación antes de ofrecer la plataforma como un mercado operativo.

La siguiente validación con el negocio familiar debe responder: qué datos faltan para cotizar por teléfono, cuáles puede aportar un cliente sin visita, cuándo se pide evidencia de accesos, quién recibe cada solicitud y cómo se registran los acuerdos. El nombre y la URL pública se definirán en otra etapa.
