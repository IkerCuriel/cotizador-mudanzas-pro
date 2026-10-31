# Perfil público de los mudanceros

La página `negocio.html` presenta a **Mudanzas D’Curiel** como el proveedor predeterminado de MoveFlow. Está enlazada desde la navegación y la sección de contacto de inicio. Incluye presentación, asuntos que se pueden consultar, galería y acceso a WhatsApp o al formulario de solicitud. No contiene referencias a un negocio familiar, calificaciones, reseñas, garantías, certificaciones o fotografías inventadas.

Este perfil es contenido público editado desde el código. **No crea una cuenta ni permite editar o subir archivos desde el panel.** El registro comercial, los accesos privados y las suscripciones siguen teniendo sus propias autorizaciones. La página no acredita que la empresa haya pasado una revisión documental.

## Añadir fotografías reales

1. Solicitar al negocio imágenes propias y permiso para publicarlas. Revisar que no expongan domicilios de clientes, placas, documentos o personas sin autorización.
2. Eliminar los metadatos de ubicación y reducir el peso de las imágenes antes de publicarlas. Preferir WebP o AVIF; JPEG y PNG también son compatibles.
3. Guardar los archivos en `public/businesses/d-curiel/`.
4. Añadir las entradas a `photos` de D’Curiel en `src/business-profile-data.js`. Ejemplo de formato, únicamente después de agregar la fotografía real:

```js
photos: [
  {
    src: '/businesses/d-curiel/unidad-01.webp',
    alt: 'Descripción concreta de lo que aparece en la fotografía real',
    caption: 'Pie de foto revisado con la empresa',
  },
],
```

La galería admite hasta 12 fotografías, exige texto alternativo y acepta solo rutas de imagen de la carpeta del negocio. Rechaza enlaces externos, rutas de otros negocios, archivos SVG, código, consultas y recorridos de directorios. Los textos se muestran como texto, sin insertar HTML. Este filtro evita cargas arbitrarias; **no sustituye la revisión de contenido, derechos o datos personales**.

Mientras no haya fotografías, se muestra un estado «Fotografías próximamente». No se usan fotos de archivo como si fueran unidades o personal de D’Curiel. Si una foto publicada deja de estar disponible, el visitante ve un aviso en su lugar.

## Preparación para perfiles administrables

El catálogo público se separó en `src/business-profile-data.js`, el renderizado en `src/business-profile.js` y su presentación en `src/business-profile.css`. El identificador del negocio es `d-curiel`, el mismo utilizado por el enrutamiento de solicitudes. El contacto sigue usando el WhatsApp comercial configurado; no se publican cuentas personales ni claves.

La siguiente fase debe conectar los perfiles con `businesses` y sus membresías existentes. Antes de añadir edición desde el panel:

- Separar los campos públicos revisados de los datos privados de contacto y las solicitudes.
- Autorizar cambios únicamente a integrantes autorizados de ese negocio, con segundo factor cuando corresponda; no confiar en un `business_id` enviado por el navegador.
- Subir archivos primero a almacenamiento privado, con límites de tamaño, tipos reales de imagen, cantidad y cuota por negocio. El servidor debe revisar y preparar la copia pública sin metadatos.
- Publicar solo imágenes aprobadas, registrar quién cambió el perfil y permitir retirar la publicación sin eliminar evidencias privadas necesarias.
- Verificar lectura y escritura entre dos negocios distintos y ante suspensión de membresías. Las imágenes públicas aprobadas no deben arrastrar datos privados por una consulta o permiso compartido.

No se han creado tablas, políticas de almacenamiento ni una API de cargas en esta entrega. Para incorporar otro negocio no basta con añadirlo al catálogo editorial: también deben habilitarse sus permisos, su destino de solicitudes y su selección explícita en la página.
