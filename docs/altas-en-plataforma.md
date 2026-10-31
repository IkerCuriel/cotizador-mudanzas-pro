# Solicitudes de empresa dentro de MoveFlow

La migración `20261031040000_provider_applications.sql` prepara el alta autenticada sin enviar un correo. No activa la recepción, crea usuarios de Auth, aprueba negocios ni habilita pagos por sí sola.

## Contrato

El navegador llama `submit_provider_application` con un argumento `p_payload` que contiene `company`, `contact`, `email`, `phone`, `businessLocation`, `services` (`local`, `nationwide`, `both`), `plan` (`monthly_149`, `annual_1440`), `consent: true` y `privacy_version`. `coverage`, `notes` y `businessLocationPlace: {placeId, label}` son opcionales. La selección de Google, cuando exista, debe coincidir exactamente con el texto de ubicación antes de descartarlo. No cambia el formulario ni la respuesta de la API.

La ubicación persistida tiene dos formas excluyentes:

- Con selección de Google: `businessLocationSource: 'google'` y `businessLocationPlace: {placeId}`. No se guardan `businessLocation`, `label`, nombres de POI, coordenadas ni respuestas completas de la selección.
- Sin selección: `businessLocationSource: 'user'` y el texto manual en `businessLocation`; no se guarda `businessLocationPlace`.

El servidor determina la fuente e ignora un `businessLocationSource` enviado por el navegador. Los lectores futuros deben admitir ambas formas y no esperar una dirección guardada para selecciones de Google.

La respuesta exitosa es `{status: "pending", applicationId: "UUID"}`. Solo significa que la solicitud fue guardada para revisión. No significa empresa aprobada, pago recibido, perfil público ni recepción de clientes.

La cuenta debe tener correo verificado. La primera alta convierte el rol solicitante en proveedor pendiente con el procedimiento existente `join_provider`; a partir de entonces se exige segundo factor para continuar operando como proveedor. No modifica perfiles aprobados, suspendidos o administrativos. El email del formulario es un contacto comercial, no concede autenticación ni determina la propiedad de la solicitud.

## Persistencia y acceso

- `public.provider_applications` guarda una solicitud por usuario. La identidad del titular y las fechas provienen del servidor.
- Repetir una solicitud idéntica pendiente devuelve el mismo identificador. Se permiten cambios en la misma fila una vez por minuto; una solicitud ya revisada requiere atención de soporte.
- El titular y los operadores autorizados pueden leerla con correo verificado y el segundo factor requerido. No hay lectura anónima ni edición directa desde el navegador. RLS protege los registros.
- Los roles, vigencias, importes, aprobaciones, pertenencia al equipo y fechas enviadas por el navegador no se aceptan. Ningún pago o permiso comercial nace de este formulario.
- La auditoría guarda identificación de solicitud, plan y versión del aviso, sin duplicar el texto completo ni los datos de contacto.

## Activación

1. Conectar Supabase y aplicar todas las migraciones, incluida esta. Comprobar correos verificados y configuración de segundo factor.
2. Completar identidad y domicilio del responsable, contacto comercial y aviso de privacidad. Configurar el sitio para publicar esos datos legítimos y mostrar el aviso vigente.
3. Verificar las dos formas de ubicación que siguen, revisar conservación de datos y definir quién atenderá las solicitudes pendientes. La recepción no debe habilitarse sin una operación de revisión real.
4. En SQL Editor, con la cuenta del propietario y únicamente después de los puntos anteriores, establecer `accepting_provider_applications=true` en la fila `singleton` de `private.platform_settings`. El valor inicial es `false`.
5. Verificar `public_site_config()` (`provider_applications_version: 1`, `accepting_provider_applications: true`, `privacy_version` vigente) y probar dos cuentas distintas, una sesión sin verificar y los permisos de lectura.
6. Para pausar las nuevas altas, devolver ese indicador a `false`. No borra solicitudes existentes ni revoca accesos o pagos.

La revisión administrativa del negocio y la asignación aprobada de su propietario son separadas del pago. No aprobar una empresa mediante el email que escribe, metadatos de Auth ni una captura de un comprobante. El contrato y la confirmación de pago del servidor deben aplicarse antes de conceder un periodo de acceso de pago.

## Ubicación empresarial y futuros perfiles

La [política de Places](https://developers.google.com/maps/documentation/places/web-service/policies) exceptúa los identificadores de lugar de las restricciones de caché, pero no concede una excepción general para sus direcciones. La migración valida la igualdad del texto temporal y lo descarta antes de insertar o actualizar: solo conserva el `placeId` cuando existe selección de Google. La igualdad se sigue verificando para rechazar selecciones desactualizadas; no funciona como autorización de conservación.

Para revisar una solicitud de origen Google, el futuro panel puede construir un enlace de Maps con el `placeId`; no debe inventar una dirección guardada ni reintroducir `formattedAddress` en la base. Para un futuro perfil público, conservar por separado el domicilio comercial que aporte independientemente la empresa y su procedencia. No copiar datos de la respuesta de Google a campos manuales ni asumir que un clic de confirmación los convierte en datos propios. La revisión del perfil debe usar información aportada por la empresa; no crear el catálogo copiando fichas de Maps.

La excepción para una transacción del usuario y las restricciones sobre directorios se explican, con fuentes oficiales, en [google-places.md](./google-places.md#aplicación-a-moveflow-y-pendientes-concretos). La reducción de datos está probada localmente. El backend sigue preparado con `accepting_provider_applications=false`; faltan conexión, identidad legal y operación antes de abrir altas, y no se afirma que Google haya aprobado usos futuros.
