# Lanzamiento y configuración

Estado: piloto público por WhatsApp en [MoveFlow Mudanzas](https://moveflow-mudanzas.render-inspace.chatgpt.site/), alojado con Sites (OpenAI). No se ha comprado un dominio. Supabase, cuentas, avisos y cobros siguen pendientes de activación. Referencias consultadas el 30 de octubre de 2026; comprobar condiciones antes de contratar.

La publicación actual usa `.openai/hosting.json` y el origen de `site.config.js`. Un cambio en GitHub ejecuta las verificaciones, pero requiere una nueva publicación con Sites para aparecer en el enlace público. La sección 6 se conserva como alternativa de migración a Cloudflare.

## 1. Qué se publicará primero

Un piloto sin pagos para recibir solicitudes y atenderlas con el negocio familiar. Las cuentas de mudanceros se aprueban de forma controlada. El acceso de piloto no es una suscripción pagada ni crea cargos futuros.

Las direcciones y teléfonos no se muestran en un catálogo público. La incorporación posterior de proveedores debe respetar la autorización de distribución de cada solicitante.

## 2. Preparar el proyecto en VS Code

Abre la carpeta completa del repositorio con **Archivo → Abrir carpeta**. En la terminal integrada, con Node.js 22:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Configura en `.env.local`:

| Variable | Contenido |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase que usará el entorno. |
| `VITE_SUPABASE_ANON_KEY` | Clave pública de acceso del proyecto; nunca una clave privilegiada. |
| `VITE_SITE_URL` | URL pública definitiva, sin barra final. |
| `VITE_LEGAL_NAME` | Nombre completo o razón social real del responsable; se publicará. |
| `VITE_LEGAL_ADDRESS` | Domicilio real para el aviso; se publicará. |
| `VITE_PRIVACY_EMAIL` | Correo operativo para privacidad y derechos; se publicará. |
| `VITE_PRIVACY_READY` | Mantener `false` hasta completar y revisar el aviso. |
| `VITE_BUSINESS_NAME` | Nombre comercial visible del negocio. |

No subas `.env.local` a Git. **Todas las variables `VITE_` se incorporan al navegador.** La clave `service_role`, claves `sb_secret_`, credenciales SMTP, secretos de pagos y contraseñas de base de datos pertenecen solo al entorno de servidor. No uses el correo personal del propietario como correo de privacidad sin una decisión expresa.

Sin Supabase configurado, se puede revisar la interfaz y preparar información local, pero no simular una cuenta o una recepción compartida exitosa.

## 3. Crear Supabase

1. Crea una cuenta y un proyecto en [Supabase](https://supabase.com/dashboard). Guarda la contraseña de base de datos en un gestor de contraseñas.
2. Elige una región considerando a los usuarios y el tratamiento de datos por proveedores externos.
3. Mantén **deshabilitados los nuevos registros públicos** en la configuración de Auth mientras se preparan SMTP y los avisos. El bloqueo visual del formulario no reemplaza esta configuración.
4. Aplica todas las migraciones de `supabase/migrations/` en orden, primero en una base de prueba. Incluyen perfiles, solicitudes, equipo familiar con varios asesores, MFA y avisos opcionales. Revisa el resultado antes de producción; no reinicialices una base con datos reales.
5. Copia URL y clave pública a las variables correspondientes. La clave pública conecta al proyecto; las políticas del servidor deciden qué datos puede consultar cada usuario.
6. Configura las URL de retorno de autenticación para desarrollo y para el dominio público exacto. Evita comodines amplios en producción.
7. Mantén la confirmación de correo y configura SMTP. Prueba alta, confirmación, acceso, cierre de sesión y recuperación en el entorno de pruebas. En producción, prepara las primeras cuentas mediante invitaciones administrativas hasta abrir el registro público.
8. Ejecuta las pruebas de permisos y verifica el acceso con usuarios distintos. Un solicitante no debe ver fichas ajenas ni concederse roles; un mudancero no debe consultar solicitudes fuera de su autorización.

### Correo y notificaciones

El SMTP predeterminado de Supabase es para pruebas: entrega solo a integrantes del equipo del proyecto, con un límite de dos mensajes por hora. **No sirve para registrar al público.** Configura un proveedor SMTP y verifica el remitente según sus requisitos. [Documentación oficial](https://supabase.com/docs/guides/auth/auth-smtp)

Los avisos de nuevas solicitudes se consultan **dentro del panel al cargarlo o actualizarlo**, cuando se active la nube. El canal Web Push al teléfono está preparado y apagado por defecto; requiere [configuración y pruebas propias](notificaciones-telefono.md). No son correos, SMS ni WhatsApp automáticos. El correo de autenticación y las notificaciones operativas son flujos diferentes.

Para añadir correos operativos después, habrá que implementar envío, reintentos y estado de entrega. Conviene enviar solo un resumen y un enlace al panel protegido, sin domicilios completos o inventario en el asunto. Una solicitud guardada y una notificación entregada son hechos distintos.

## 4. Establecer el superusuario y el piloto familiar

El propietario utilizará el correo que ha confirmado para su cuenta. **El correo no se publica en este repositorio ni concede permisos por sí solo.**

1. Crea o invita la cuenta del propietario desde la administración de Supabase y verifica su correo. Esto permite preparar al propietario sin abrir el registro público.
2. En Supabase, comprueba esa cuenta y copia su **UUID de Auth**, verificando que `email_confirmed_at` tiene valor.
3. Abre `supabase/bootstrap-owner.sql`, revisa su contenido y sustituye el UUID indicado por el de esa cuenta. Ejecútalo mediante una conexión administrativa de confianza. No uses un UUID de ejemplo.
4. Comprueba con una nueva sesión que el propietario tiene el rol previsto y que otros usuarios no pueden asignárselo.
5. Invita a Tere y Marco a correos individuales siguiendo [seguridad y cuentas](seguridad-y-cuentas.md). Cada uno establece su contraseña y autenticador. El superusuario aprueba a cada asesor mediante `set_provider_access`, con vigencia explícita y marca de miembro del equipo familiar. No se utilizan contraseñas compartidas.
6. Revisa los demás roles desde las operaciones administrativas autorizadas y conserva trazabilidad de cambios.

La configuración privada `private.platform_settings` comienza con `accepting_requests = false` y `network_enabled = false`. Cuando estén listos los avisos, SMTP, proveedor familiar y pruebas, activa la recepción desde una operación administrativa de base de datos. **Mantén la red de terceros desactivada para el piloto familiar.** Un cambio en `VITE_PRIVACY_READY` no modifica estas restricciones de servidor.

Nadie se convierte en superusuario por declarar un correo en el formulario o por ser la primera persona registrada. No publiques contraseñas, tokens ni enlaces de inicialización. Activa autenticación multifactor en las cuentas administrativas de Supabase, Cloudflare y GitHub.

## 5. Probar localmente

```bash
npm test
npm run test:db
npm run build
npm run preview
```

`npm run test:db` ejecuta `tests/backend.integration.test.js` con PGlite, un entorno PostgreSQL local de pruebas incluido como dependencia. No requiere credenciales de producción. Estas pruebas cubren la base y sus permisos, pero no demuestran que una instalación remota haya recibido las migraciones o configuraciones correctas.

Para probar también con la pila local completa de Supabase, instala Docker y utiliza la [CLI oficial](https://supabase.com/docs/guides/local-development):

```bash
npx supabase start
npx supabase db reset
```

**`db reset` borra y reconstruye la base local de desarrollo.** Úsalo solo en el entorno de prueba. La CLI muestra los datos de conexión locales; no copies credenciales administrativas al navegador.

El archivo `supabase/tests/authorization.sql` permite verificar permisos mediante `psql` contra una base de prueba con la migración aplicada:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authorization.sql
```

`SUPABASE_DB_URL` representa una conexión privada de pruebas que configuras en tu terminal, no una variable `VITE_`. La prueba SQL usa una transacción y reversión de sus datos de prueba. No utilizar la base de clientes para pruebas o reinicios.

Comprueba además formulario móvil, errores y reintentos, separación entre usuarios, recepción del negocio, vigencia del acceso y cierre de sesión. Usa datos ficticios. Completa los pendientes de [operación y privacidad](operacion-y-privacidad.md) antes de abrir registros.

## 6. Alternativa: migrar a Cloudflare Pages

1. Crea o utiliza una cuenta de [Cloudflare](https://dash.cloudflare.com/) y abre **Workers & Pages → Crear aplicación → Pages → Conectar a Git**. Los nombres de las opciones pueden variar.
2. Autoriza el acceso al repositorio `IkerCuriel/cotizador-mudanzas-pro`. Mantén todos los secretos fuera de Git aunque el repositorio sea público.
3. Crea un proyecto y selecciona `main` como rama de producción cuando los cambios revisados estén integrados allí.
4. Configura el comando `npm run build`, salida `dist`, Node.js 22 y la raíz del repositorio como directorio del proyecto.
5. Añade las variables públicas de `.env.example` al entorno de producción de Pages. Configura aparte las vistas previas para que no usen datos reales. Las variables del navegador necesitan una nueva compilación cuando cambian.
6. Publica y verifica `https://<proyecto>.pages.dev`. El nombre depende de disponibilidad; no es una URL existente hasta crear y desplegar el proyecto.
7. Completa la URL pública del sitio, los retornos de autenticación y los metadatos sociales con el dominio obtenido; recompila si procede.
8. Desde otro dispositivo, prueba registro, confirmación, solicitud, recepción del negocio y cierre de sesión antes de difundir el enlace.

Referencia: [integración de Git con Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/git-integration/). Cloudflare Pages y GitHub Pages son servicios distintos. Conserva GitHub para código; sus [restricciones de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) excluyen este tipo de producto comercial.

### Dominio y redes sociales

El subdominio de Cloudflare permite comenzar sin comprar un dominio. Después se puede registrar uno propio, añadirlo en **Custom domains** y actualizar DNS, autenticación y metadatos. Revisa renovación además del precio inicial. [Dominios personalizados](https://developers.cloudflare.com/pages/configuration/custom-domains/)

La tarjeta social necesita título, descripción e imagen accesibles sin iniciar sesión y URL absoluta del sitio público. Comprueba el resultado antes de difundirlo. Cada red decide dónde muestra tarjetas y puede guardar una versión anterior; no se garantiza vista previa en todas las superficies de Instagram.

## 7. Costos iniciales y límites

| Servicio | Inicio | Límite relevante |
| --- | --- | --- |
| Cloudflare Pages | Plan gratuito | 500 compilaciones mensuales; las funciones dinámicas tienen cuotas distintas. [Límites](https://developers.cloudflare.com/pages/platform/limits/) |
| Supabase | Free | 50,000 usuarios activos/mes, 500 MB de base, 5 GB de transferencia; pausa por una semana inactivo. Pro desde USD 25/mes. [Precios](https://supabase.com/pricing) |
| Resend | Correo gratuito con cuota | 3,000 correos/mes, máximo 100/día. Verificar remitente. [Precios](https://resend.com/pricing) |
| Brevo | Alternativa de correo | 300 correos diarios en su oferta gratuita. [Correo transaccional](https://www.brevo.com/products/transactional-email/) |
| Dominio propio | Opcional para el sitio inicial | Precio anual y renovación dependen del nombre y proveedor. |

Estas cuotas pueden bastar para un piloto pequeño; no garantizan operación gratuita ilimitada ni disponibilidad. Prevé respaldos, soporte y costos conforme crezca el uso. [Supabase en producción](https://supabase.com/docs/guides/deployment/going-into-prod)

## 8. Suscripciones futuras

El cobro sigue desactivado. Antes de cobrar hay que definir plan, beneficios, precio, impuestos, condiciones, renovación y cancelación; completar la verificación del procesador e implementar checkout, webhooks verificados y gestión de impagos.

Referencias para México:

- Stripe publica 3.6% + MXN 3 para tarjetas nacionales y 0.7% adicional del volumen de Billing. Revisa impuestos y condiciones particulares. [Tarifas](https://stripe.com/mx/pricing)
- Mercado Pago Suscripciones publica 3.19% + IVA con disponibilidad inmediata o 2.89% + IVA a diez días. Comprueba la oferta de tu cuenta. [Suscripciones](https://www.mercadopago.com.mx/herramientas-para-vender/suscripciones)

Puede no existir mensualidad fija del procesador y aun así haber comisiones por operación. Un regreso del navegador a una URL de éxito no acredita un pago: verifica su estado y los cambios posteriores en el servidor. [Webhooks de Stripe](https://docs.stripe.com/billing/subscriptions/webhooks)

Revisa el diseño comercial, jurídico y fiscal antes del primer cobro. Esta guía no crea cuentas externas, contrata servicios ni garantiza cumplimiento legal.
