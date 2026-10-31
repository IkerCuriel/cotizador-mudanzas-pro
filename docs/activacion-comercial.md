# MoveFlow: activación comercial paso a paso

Fecha: 30 de octubre de 2026. Guía del propietario para cuentas, Maps, pagos y pendientes mexicanos. El código preparado y la publicación de una web no equivalen a una certificación legal ni a una cuenta de cobro activa.

## Decisiones confirmadas

- Pago por periodo, **sin renovación automática**: 149 MXN por un mes o 1,440 MXN por doce meses. Total anunciado, sin añadir cargos sorpresa. Equivalencia anual de 120 MXN al mes, no doce cobros.
- Único correo público: **soporte.moveflow@gmail.com**. Se retiró el correo personal de los archivos públicos actuales y el alta por correo.
- El propietario conserva sus cuentas privadas. Cambiar el contacto de soporte no transfiere GitHub, alojamiento, Google, Supabase ni PayPal.
- El propietario eligió operar MoveFlow **a su nombre como persona física** y revisar con un contador la actividad adicional a salarios. La persona moral de D’Curiel no será asumida como operador ni como receptora de los pagos de MoveFlow. Faltan confirmar datos legales y obligaciones fiscales antes de cobrar.
- PayPal actual: cuenta Personal, pendiente de habilitar Business. No se han realizado pagos reales.

## 1. Google Maps: conectado al proyecto, verificar publicación

La facturación de Google Cloud ya se activó personalmente por el propietario. Se habilitaron **Maps JavaScript API**, **Places API (New)** y **Maps Embed API**. La clave existente se renombró para MoveFlow, se limitó a esas tres API y al referente `https://moveflow-mudanzas.render-inspace.chatgpt.site/*`.

La clave pública de navegador está en `.env.local`, excluido de Git. No se guardan claves de servidor en el navegador. Para otra computadora, volver a configurar ese archivo bajo tu cuenta. El entorno local no está autorizado por esta clave de producción; crear una clave separada de pruebas o autorizar expresamente los orígenes necesarios antes de probar sugerencias locales.

Después de publicar, comprobar sugerencias y selección en origen, destino, paradas y ubicación de negocio. Las restricciones pueden tardar unos minutos en propagarse. Revisar costos, cuotas, alertas y rechazos del navegador. **Una alerta de presupuesto no es un corte automático de gasto.** No se ha contratado un plan de suscripción de Maps.

Costos publicados: 10,000 Autocomplete Requests al mes sin cargo; siguiente tramo a 2.83 USD por mil. Place Details Essentials tiene su propia cuota de 10,000 y siguiente tramo de 5 USD por mil. El mapa Embed no cobra por uso. Son eventos, no usuarios, y pueden aplicar impuestos/conversión. [Precios oficiales](https://developers.google.com/maps/billing-and-pricing/pricing). Consulta [la guía de Maps](google-places.md) para restricciones, sesiones y tratamiento de direcciones.

## 2. Cuentas y recepción dentro de MoveFlow

1. Iniciar sesión en Supabase bajo una cuenta controlada por el propietario y crear/elegir el proyecto de MoveFlow. Completar personalmente cualquier contraseña, verificación o condición del proveedor.
2. Conservar región, titular, accesos y recuperación en el expediente privado. Aplicar las migraciones del repositorio, incluyendo altas y pagos. No aplicar pruebas con datos ficticios sobre una base con clientes.
3. Configurar en `.env.local` únicamente URL de Supabase y clave pública publishable/anon. Los secretos administrativos van en servidor.
4. Configurar URL pública de autenticación, correo de confirmación y recuperación y SMTP de producción. Probar registro, confirmación, recuperación y segundo factor con cuentas propias de prueba.
5. Completar los datos legales reales y revisar avisos antes de habilitar registro/recepción. El correo de soporte ya está configurado; identidad, domicilio y teléfono comercial del operador siguen pendientes.
6. Habilitar recepción de altas en servidor solo cuando se puedan atender. El negocio solicita un perfil dentro de la plataforma, se revisa y luego se asigna su propietario. Pagar no aprueba identidades ni otorga roles administrativos.
7. Las cuentas de integrantes del piloto se invitan a correos reales y cada persona elige contraseña y MFA. Los beneficios gratuitos se configuran por identificadores privados, nunca por un nombre o correo público.

Ver [altas en la plataforma](altas-en-plataforma.md), [seguridad y cuentas](seguridad-y-cuentas.md) y [lanzamiento](lanzamiento.md). Las páginas de cuenta/pago muestran preparación mientras no exista conexión válida; no simulan un alta exitosa.

## 3. PayPal: Business, banco y pruebas

1. Elegir al vendedor legal con el contador. Completar personalmente la cuenta Business con los datos de ese titular; no usar los de otra persona para superar una verificación.
2. Vincular una cuenta bancaria con CLABE de 18 dígitos a nombre del mismo titular. Una tarjeta de débito registrada no acredita por sí sola el destino de retiro. [PayPal: cuenta bancaria](https://www.paypal.com/mx/cshelp/article/%C2%BFc%C3%B3mo-puedo-asociar-una-cuenta-bancaria-a-mi-cuenta-de-paypal-help183).
3. Crear aplicación y comprador/vendedor **Sandbox**. Configurar secretos, webhook y conciliador en Supabase. Ver [instructivo PayPal](activar-paypal.md) y [configuración técnica](backend-paypal.md).
4. Probar mes/año, cancelación de aprobación, pago pendiente, fallos, duplicados, devolución y acceso aislado por negocio. Los resultados locales no sustituyen un pago Sandbox real.
5. Completar las funciones vendidas, los avisos y la operación fiscal antes de Live. El servidor debe verificar importe, moneda, receptor y captura; un retorno del navegador no activa el plan.
6. En Live usar credenciales, webhook y comercio del entorno real. Revisar junto al propietario el primer pago autorizado, su abono y la recuperación ante fallo. Nunca cobrar una prueba real sin su aprobación específica.

PayPal publica para operaciones comerciales nacionales una tarifa estándar de **3.95% + 4 MXN**, sujeta a IVA sobre comisiones. El neto será menor al total pagado. La elegibilidad de tarjetas y pago sin cuenta depende de PayPal, no puede prometerse a todos los compradores. [Comisiones oficiales](https://www.paypal.com/mx/business/paypal-business-fees).

## 4. SAT: opciones para tu caso

No es obligatorio crear una persona moral por el solo hecho de vender acceso a una web. Se puede operar como persona física con actividades y obligaciones adecuadas. Ser asalariado no impide por sí mismo agregar una actividad; un contador debe revisar tus ingresos, participación en sociedades, actividades y régimen. RESICO admite ciertos ingresos adicionales de salarios/intereses dentro de sus condiciones, pero existen límites y exclusiones. No asumir elegibilidad por facturar poco. [SAT: actividades empresariales](https://sat.gob.mx/portal/public/personas-fisicas/pf-actividades-empresariales-y-profesionales), [artículo 113-E](https://wwwmatnp.sat.gob.mx/articulo/58780/articulo-113-e).

Ruta elegida: operar a nombre del propietario como persona física. La alternativa societaria queda solo como referencia si se decide cambiar formalmente en el futuro:

| Operador de MoveFlow | Consecuencia práctica |
| --- | --- |
| Tú como persona física | Actualizar actividades/obligaciones que correspondan; PayPal, banco, CFDI y términos del servicio a tu nombre legal. El contacto público puede ser soporte. |
| La sociedad de D’Curiel | Revisar facultades y objeto/actividad con sus asesores, quién cobra y factura y quién asume obligaciones. Si el software sigue siendo tuyo, documentar licencia u otro acuerdo real. No confundir propiedad del código con ingresos de la sociedad. |

No usar un RFC ajeno como propio ni mezclar vendedor de PayPal, factura y titular bancario sin una estructura acordada. El contador debe definir ISR/IVA, CFDI, declaraciones, comprobantes y conciliación de comisiones. La tasa general de IVA sobre servicios independientes es 16%, con el tratamiento concreto sujeto a revisión. El comprobante de PayPal no sustituye el CFDI. [SAT: obligaciones](https://wwwmat.sat.gob.mx/articulo/40800/articulo-110), [Ley del IVA](https://www.diputados.gob.mx/LeyesBiblio/pdf/LIVA.pdf).

## 5. Privacidad, contratación y titularidad

Antes de anuncios que inviten a entregar datos o pagar, completar **nombre legal/razón social, domicilio válido, teléfono comercial de reclamaciones y contacto de privacidad**, finalidades, destinatarios, conservación y procedimiento ARCO. No publicar el correo personal es compatible con usar soporte, pero no permite ocultar toda la identidad del responsable. [LFPDPPP, artículo 15](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), [LFPC, artículos 7 Bis y 76 Bis](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf).

Definir qué incluye cada periodo, fecha de inicio, límites, reembolsos, atención y facturación. No garantizar clientes ni vender avisos/panel todavía inactivos. El plan actual no renueva automáticamente; si se añade esa función, implementar consentimiento separado, aviso previo de al menos cinco días naturales y cancelación inmediata cuando corresponda, no solo una frase en términos.

Código, marca, dominio y alojamiento tienen titularidad distinta. Controlar cuentas y correo no produce un certificado de derechos. Guardar aportaciones humanas, licencias, cesiones y permisos de imágenes; revisar registro de software ante INDAUTOR y marca ante IMPI. La disponibilidad de «MoveFlow» no se ha verificado. El trabajo asistido por IA no permite afirmar autoría exclusiva de todo contenido. [LFDA](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf), [registro de obra](https://www.gob.mx/public/tramites/detalleTramite.xhtml?homoclave=INDAUTOR-01-001), [IMPI](https://www.gob.mx/public/tramites/detalleTramite.xhtml?homoclave=IMPI-01-001-A).

El repositorio puede conservar commits antiguos con datos que estuvieron publicados; cambiar los archivos actuales no borra el historial. No reescribirlo ni revocar cuentas por accidente para retirar un contacto visible. Si se requiere una limpieza histórica, planearla aparte con copias y coordinación.

## 6. Operación y recuperación

Verificar que soporte recibe mensajes y protegerlo con recuperación y MFA. Guardar documentos fiscales, secretos y códigos de recuperación fuera de GitHub. Mantener copia del código, respaldo de base de datos y un procedimiento probado de restauración. Detener nuevas compras no debe detener conciliación, reembolsos ni soporte. [Manual de control y recuperación](control-y-recuperacion.md).

Esta guía deja decisiones y tareas verificables. No registra automáticamente la actividad ante SAT, una marca, el software ni una sociedad, y no sustituye una revisión fiscal/jurídica con los datos reales del operador.
