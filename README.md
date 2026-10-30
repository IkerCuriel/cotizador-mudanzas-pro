# MoveFlow — Plataforma de solicitudes de mudanza

[![Verificar MoveFlow](https://github.com/IkerCuriel/cotizador-mudanzas-pro/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/IkerCuriel/cotizador-mudanzas-pro/actions/workflows/verify.yml)

Proyecto de una plataforma que conecta a quien necesita mudarse con empresas de mudanzas. **No calcula un precio automático:** la empresa revisa la solicitud, contacta a la persona y acuerda con ella el precio y las condiciones.

La primera operación se realizará con el negocio familiar. **MoveFlow es un nombre provisional.** El dominio, la identidad comercial y la apertura a más proveedores quedan pendientes.

## Estado de esta entrega

El proyecto se desarrolla y prueba localmente. **La base de datos, las cuentas y las notificaciones aún no están activadas en una nube de producción.** Tener el formulario publicado no demuestra que las solicitudes lleguen al negocio. La recepción compartida requiere configurar Supabase y sus permisos.

El piloto no cobra suscripciones. La futura membresía será para los **mudanceros que reciben oportunidades**; quien solicita una mudanza tendrá una cuenta gratuita. No se garantizan contrataciones, ingresos ni un número de solicitudes.

## Perfiles de acceso

| Perfil | Finalidad |
| --- | --- |
| Solicitante | Preparar su mudanza y consultar sus propias solicitudes. |
| Mudancero | Atender solicitudes asignadas, sujeto a aprobación y vigencia del acceso. |
| Administrador | Dar seguimiento y administrar la operación autorizada. |
| Superusuario | Administrar permisos, proveedores y configuración de la plataforma. |

El servidor debe aplicar los permisos. Mostrar u ocultar botones no protege una solicitud. Nadie puede concederse un rol administrativo desde el registro público.

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

Los volúmenes y pesos del catálogo describen la carga. Son estimaciones que revisa la empresa, no una tarifa. La ficha no confirma reserva, seguro ni contrato.

El WhatsApp del negocio familiar es **55 2906 1098**, configurado como `525529061098` en `src/config.js`. Un enlace de WhatsApp prepara el mensaje: la persona aún debe enviarlo. Las notificaciones implementadas para cuentas pertenecen al panel; los avisos por correo, SMS o WhatsApp requieren una integración adicional.

## Documentación vigente

- [Lanzamiento, infraestructura, cuentas y costos](docs/lanzamiento.md).
- [Operación, privacidad y preparación comercial](docs/operacion-y-privacidad.md).

`docs/flujo-solicitudes.md`, `docs/tarifas.md`, las capturas anteriores y el panel de almacenamiento local describen etapas previas. Son historial, no evidencia de recepción remota o servicios activos. No importar datos reales de pruebas a producción sin revisar su procedencia y autorización.

## Publicación prevista

Cada cambio enviado al repositorio ejecuta las pruebas de permisos y la compilación en GitHub Actions. Una ejecución exitosa guarda `moveflow-web` durante siete días para revisión. Ese archivo es una compilación de comprobación sin las conexiones de producción: no activa cuentas, no recibe solicitudes y no publica la página.

Cloudflare debe construir su propia versión desde `main` con las variables de su entorno. Solo se admiten las variables públicas `VITE_` enumeradas en `.env.example`; las demás se rechazan para evitar incorporar credenciales por error. Nunca coloques claves privadas de Supabase, SMTP o pagos en ese grupo.

Se conserva GitHub para el código y se prepara **Cloudflare Pages para el sitio, junto con Supabase para cuentas y datos**. GitHub Pages no es el destino del producto comercial: sus [límites de uso](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) excluyen negocios online y SaaS comercial.

Es posible empezar con cuotas gratuitas y un subdominio `pages.dev`. Un dominio propio es opcional al principio. Los correos, el uso y los futuros cobros tienen condiciones y límites.

No abrir registros públicos hasta configurar el correo de autenticación, completar los avisos con los datos reales del responsable y verificar los permisos. Las guías son preparación técnica y operativa, **no una certificación de cumplimiento legal**.
