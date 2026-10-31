# MoveFlow — Plataforma de solicitudes de mudanza

[![Verificar MoveFlow](https://github.com/IkerCuriel/cotizador-mudanzas-pro/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/IkerCuriel/cotizador-mudanzas-pro/actions/workflows/verify.yml)

Proyecto de una plataforma que conecta a quien necesita mudarse con empresas de mudanzas. **No calcula un precio automático:** la empresa revisa la solicitud, contacta a la persona y acuerda con ella el precio y las condiciones.

La primera operación se realiza con **Mudanzas D’Curiel**. **MoveFlow es el nombre provisional de la plataforma.** El dominio propio, los datos legales del responsable y la apertura a más proveedores quedan pendientes.

## Estado de esta entrega

El piloto público se aloja en [MoveFlow Mudanzas](https://moveflow-mudanzas.render-inspace.chatgpt.site/), con un enlace que no incluye el nombre personal del propietario. La página presenta la atención como **Mudanzas D’Curiel**, sin tarjetas personales ni selector de asesor. El cliente prepara su ficha, la revisa en el modal y abre WhatsApp con el mensaje dirigido a la línea principal de la empresa. **Debe pulsar Enviar en WhatsApp para entregarlo.** Los botones de contacto directo preparan un mensaje general cuando no se ha completado el formulario.

**La base de datos, las cuentas y las notificaciones aún no están activadas en una nube de producción.** La recepción compartida en el panel requiere configurar Supabase y sus permisos. Preparar una ficha por sí solo no la entrega al negocio. No está integrada la API de WhatsApp ni se envían copias automáticas a otros integrantes del equipo. El contacto manual por WhatsApp no necesita una cuenta de MoveFlow ni Supabase.

El apartado [para mudanceros](https://moveflow-mudanzas.render-inspace.chatgpt.site/mudanceros.html) presenta **$149 MXN por un mes** y **$1,440 MXN por 12 meses** (equivalente a $120 al mes). La incorporación se solicita desde una cuenta verificada, cuando se active la nube; ya no se prepara un correo de alta. El pago PayPal y la concesión de vigencia se verifican en servidor para negocios aprobados. **Los cobros reales siguen desactivados** hasta conectar cuentas, completar la operación legal y validar pagos reales de prueba. La integración inicial es por periodo, sin renovación automática; no vende funciones todavía inactivas. Quien solicita una mudanza no paga esta membresía. No se garantizan contrataciones, ingresos ni un número de solicitudes.

El único correo público de atención es **soporte.moveflow@gmail.com**. La página [Soporte](https://moveflow-mudanzas.render-inspace.chatgpt.site/soporte.html) prepara un mensaje con empresa, nombre, correo de cuenta, referencia opcional y problema. El usuario revisa y envía el correo; no se simula un ticket recibido. Las cuentas privadas del propietario no se cambian por actualizar este contacto. Consulta [activación paso a paso](docs/activacion-comercial.md).

El buscador de ubicaciones y el mapa se comparten entre la ruta del cliente y la ubicación base del negocio. Las sugerencias reales de Google requieren activar Maps y Places y configurar una clave restringida; mientras tanto se puede escribir y revisar la referencia en el mapa. Consulta [la guía de activación](docs/google-places.md).

## Arquitectura por negocio

Cada negocio tiene una identidad separada de las cuentas de su equipo. D’Curiel usa `d-curiel`; cada integrante tendrá su acceso individual. Una solicitud se dirige a **un negocio**, no a todos los mudanceros. La cuarta migración prepara aislamiento, membresías, cupos y asignaciones acotadas; no crea cuentas de Auth ni activa servicios por sí sola.

El panel consulta 20 resúmenes por página y carga la ficha completa al seleccionarla. La navegación usa un cursor; no hay una consulta automática cada minuto por cada usuario. Las notificaciones se conservan en la base y los avisos al dispositivo siguen siendo opcionales. El uso masivo necesita pruebas de carga y presupuesto: no se garantiza una operación gratuita con millones de usuarios.

Consulta la [arquitectura, flujo de datos y costos](docs/arquitectura-y-costos.md) y el [contrato del backend](docs/backend.md). Los cobros futuros pertenecerán al negocio, con verificación en servidor; todavía no hay una pasarela ni suscripciones activas.

## Perfiles de acceso

| Perfil | Finalidad |
| --- | --- |
| Solicitante | Preparar su mudanza y consultar sus propias solicitudes. |
| Mudancero | Atender solicitudes asignadas, sujeto a aprobación y vigencia del acceso. |
| Administrador | Dar seguimiento y administrar la operación autorizada. |
| Superusuario | Administrar permisos, proveedores y configuración de la plataforma. |

El servidor debe aplicar los permisos. Mostrar u ocultar botones no protege una solicitud. Nadie puede concederse un rol administrativo desde el registro público.

Los contactos públicos representan a la empresa. La línea principal recibe los mensajes enviados desde los botones públicos y la ficha. La recepción dentro de cuentas, cuando se active, asigna la solicitud a los miembros aprobados del negocio. Proveedores y administradores requieren un segundo factor para consultar información de clientes. Esta entrega no modifica sus cuentas de WhatsApp ni vincula dispositivos.

## Desarrollo local en VS Code

1. Abre en VS Code `MoveFlow.code-workspace` o la carpeta completa `cotizador-mudanzas-pro`, no únicamente `docs/`.
2. Usa Node.js 22 y abre la terminal integrada.
3. Instala las dependencias:

   ```bash
   npm ci
   ```

4. Copia `.env.example` a `.env.local` y completa la configuración de tu entorno siguiendo la guía de lanzamiento.
5. Inicia la aplicación:

   ```bash
   npm run dev
   ```

Abre la dirección indicada por Vite, habitualmente `http://localhost:5173`. Sin conexión configurada, las funciones de nube deben indicar que aún no están disponibles; no simulan cuentas ni entregas exitosas.

## Verificación

```bash
npm test
npm run test:db
npm run build
npm run preview
```

Consulta los requisitos de las pruebas de permisos en [lanzamiento](docs/lanzamiento.md). Las pruebas del antiguo motor de precios se conservan como referencia; ese motor no participa en la solicitud pública. La compilación genera `dist/`; compilar no publica ni crea una base de datos.

## La solicitud

Incluye ruta local o foránea, modalidad directa o compartida, domicilios y fecha, inmuebles y accesos, acarreos, habitaciones, muebles con variantes, artículos especiales, empaque y maniobras, además de datos y preferencias de contacto.

La solicitud no calcula peso ni volumen: la empresa evalúa la carga, el personal y el almacenaje durante la conversación. La vista inicial muestra todos los muebles; sillones individuales, sillas comunes y sillas de escritorio tienen cantidades propias. La ficha no confirma reserva, seguro ni contrato.

Los contactos se configuran en `src/config.js`. Los enlaces públicos de WhatsApp usan la línea principal de la empresa y preparan la ficha o este mensaje general: «Hola, Mudanzas D’Curiel. Me interesa un servicio de mudanza. ¿Me pueden ayudar con disponibilidad y una propuesta?». El cliente aún debe enviarlo. No se enviaron mensajes de prueba a los asesores.

Los avisos del panel y el canal Web Push están implementados, pero no activos en producción. Web Push requiere la función de servidor, sus claves, el disparador y el permiso de cada dispositivo; no es un envío automático de WhatsApp ni SMS. La [guía de WhatsApp del negocio](docs/whatsapp-negocio.md) explica las opciones para atender una misma cuenta desde ambos teléfonos o desarrollar avisos automáticos a dos números.

## Documentación vigente

- [Mapas, ubicaciones y otro tipo de inmueble](docs/mapas-y-ubicaciones.md).
- [Arquitectura por negocio, flujo de datos y costos](docs/arquitectura-y-costos.md).
- [Lanzamiento, infraestructura, cuentas y costos](docs/lanzamiento.md).
- [Operación, privacidad y preparación comercial](docs/operacion-y-privacidad.md).
- [Manual del propietario: publicar, pausar y recuperar](docs/control-y-recuperacion.md).
- [Seguridad, invitaciones y segundo factor](docs/seguridad-y-cuentas.md).
- [Avisos al teléfono: activación y comprobación](docs/notificaciones-telefono.md).
- [WhatsApp de Mudanzas D’Curiel: contacto actual y automatización futura](docs/whatsapp-negocio.md).
- [Marca, dominio, software y pendientes legales](docs/marco-legal-y-titularidad.md).
- [Condiciones para los profesionales](docs/condiciones-proveedores.md).
- [Reportar un problema de seguridad](SECURITY.md).

Para preparar una pausa usa `npm run build:maintenance`; para respaldar el código guardado, `npm run backup:source`. Ninguno cambia Internet por sí solo. El flujo manual de Cloudflare en GitHub está preparado como alternativa; requiere conectar tu propia cuenta y no sustituye automáticamente el sitio actual de Sites.

`docs/flujo-solicitudes.md`, `docs/tarifas.md`, las capturas anteriores y el panel de almacenamiento local describen etapas previas. Son historial, no evidencia de recepción remota o servicios activos. No importar datos reales de pruebas a producción sin revisar su procedencia y autorización.

## Publicación

El alojamiento actual del piloto es **Sites (OpenAI)**. `.openai/hosting.json` conserva su identidad y declara `dist` como salida estática. `site.config.js` guarda el origen público para la tarjeta social; `VITE_SITE_URL` permite sustituirlo al cambiar de dominio. El código continúa en este repositorio de GitHub. Las actualizaciones públicas se empaquetan y publican con Sites; un envío a GitHub no publica por sí solo.

Cada cambio enviado al repositorio ejecuta las pruebas de permisos y la compilación en GitHub Actions. Una ejecución exitosa guarda `moveflow-web` durante siete días para revisión. Ese archivo es una compilación de comprobación sin las conexiones de producción: no activa cuentas, no recibe solicitudes y no publica la página.

Si se migra a Cloudflare, deberá construir su propia versión desde `main` con las variables de su entorno. Solo se admiten las variables públicas `VITE_` enumeradas en `.env.example`; las demás se rechazan para evitar incorporar credenciales por error. Nunca coloques claves privadas de Supabase, SMTP o pagos en ese grupo.

Se conserva la guía de **Cloudflare Pages como alternativa de alojamiento, junto con Supabase para cuentas y datos**. GitHub Pages no es el destino del producto comercial: sus [límites de uso](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) excluyen negocios online y SaaS comercial.

Es posible empezar con cuotas gratuitas y un subdominio `pages.dev`. Un dominio propio es opcional al principio. Los correos, el uso y los futuros cobros tienen condiciones y límites.

No abrir registros públicos hasta configurar el correo de autenticación, completar los avisos con los datos reales del responsable y verificar los permisos. Las guías son preparación técnica y operativa, **no una certificación de cumplimiento legal**.

### Ubicaciones y perfil público

- [Mapas y múltiples destinos](docs/mapas-y-ubicaciones.md).
- [Activar Google Places cuando se configure Google Cloud](docs/google-places.md).
- [Perfil de empresa y fotografías reales](docs/perfiles-de-negocio.md).

- [Envío, recuperación de la ficha y nueva solicitud](docs/envio-y-nueva-solicitud.md).

## Altas de negocios y cobros

- [Preparar la cuenta PayPal Business y activar pagos](docs/activar-paypal.md).
- [Planes, accesos internos y cobros](docs/planes-y-cobros.md).
- [Gestión de solicitudes de perfil por correo](docs/altas-por-correo.md).
