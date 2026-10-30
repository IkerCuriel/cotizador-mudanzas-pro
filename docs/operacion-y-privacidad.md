# Operación y privacidad del piloto

Estado revisado: **30 de octubre de 2026**. Guía interna. Se complementa con [marco legal y titularidad](./marco-legal-y-titularidad.md), [condiciones para profesionales](./condiciones-proveedores.md) y los avisos públicos. Una página publicada y unas pruebas técnicas correctas no certifican cumplimiento legal.

## Qué funciona y qué sigue pendiente

La página prepara una ficha local y permite que el solicitante elija enviar su información por WhatsApp a **Tere Curiel (+52 55 2906 1098)** o **Marco Curiel (+52 56 1449 2452)**. Elegir un contacto no envía automáticamente a ambos. Las cuentas y recepción en Supabase requieren configuración externa; las notificaciones automáticas al teléfono y los cobros no están activos.

El nombre de producto es **MoveFlow**. Falta confirmar quién opera la plataforma, quién presta y cobra la mudanza y quién es responsable de los datos. No son necesariamente la misma persona. No inventar razón social, RFC, domicilio, garantías, certificaciones o pólizas.

| Pendiente | Qué debe aportar el propietario | Motivo |
| --- | --- | --- |
| Identidad del operador | Nombre completo de persona física o razón social exacta | Términos, contacto y responsabilidad |
| Responsable de datos | Identidad y domicilio real para el aviso | LFPDPPP art. 15 |
| Canal de privacidad | Correo que se atienda y persona responsable | Derechos ARCO, reclamaciones y privacidad |
| Prestador de mudanza | Identidad, RFC y datos de contratación del negocio | Presupuesto, contrato y comprobantes |
| Participación de asesores | Confirmar si Tere y Marco actúan para el mismo responsable | Permisos, confidencialidad y posibles transferencias |
| Titularidad de infraestructura | Cuentas de GitHub, alojamiento, base de datos, correo y dominio | Control, recuperación y continuidad |
| Activación de cuentas | Cuenta cloud, remitente de correo y pruebas reales de acceso | No ofrecer un registro que no funciona |

**Antes de iniciar pruebas con clientes reales, incluso por WhatsApp, completa el aviso y establece su atención efectiva.** Mientras falta esa información, realiza pruebas con datos ficticios. La obligación de informar no se evita porque el almacenamiento inicial sea local o porque el cliente confirme el envío en otra aplicación. El destinatario debe facilitar su aviso al recabar datos.

La bandera `VITE_PRIVACY_READY` no se debe cambiar solo para retirar un mensaje. Es un control operativo; exige identidad y contacto válidos, pero no comprueba por sí misma cumplimiento. Mantén deshabilitada la recepción remota y las altas cloud hasta completar identidad, procesos y conexión. Antes de activarlas, ajusta también los párrafos de los avisos que describen funciones pendientes.

## Procedimiento diario

1. El asesor confirma recepción y registra la referencia de la solicitud. Una ficha generada todavía no acredita recepción ni contratación.
2. Confirma qué información necesita; inicialmente basta zona o colonia para evaluar la ruta. Solicita domicilio exacto solo cuando sea necesario. No pidas códigos de acceso a viviendas en formularios abiertos.
3. Verifica inventario, accesos y maniobras con la persona. No prometas precio definitivo con estimaciones de volumen.
4. Identifica al prestador y entrega por escrito alcance, precio total, impuestos, fecha, vehículo, personal, extras, anticipos, pago restante, cancelación, responsabilidad y reclamaciones.
5. Confirma los cambios por escrito antes de cobrar extras. No describas el piloto como seguro incluido, proveedor verificado, contratación garantizada o atención de emergencias permanente.
6. Al cerrar, conserva únicamente lo justificado. No añadas el teléfono a campañas ni reenvíes la ficha fuera del equipo autorizado.

Cada persona debe usar una cuenta individual. Los perfiles comerciales «Tere Curiel» y «Marco Curiel» describen usuarios; no acreditan quién es el prestador legal. Los teléfonos no son credenciales de acceso. Las contraseñas no deben almacenarse en documentación, repositorios, mensajes compartidos ni código del navegador.

## Consentimiento y destinatarios

El formulario debe enlazar el aviso antes de compartir, explicar qué información saldrá y a quién, y pedir una autorización expresa para la ficha, que puede incluir información patrimonial. La futura difusión a una red y la publicidad requieren elecciones separadas; no deben quedar premarcadas ni condicionar la atención familiar. Conservar versión, fecha, usuario cuando exista y destinatarios de cada envío.

Antes de abrir la red, definir por contrato si cada participante trata datos por instrucciones del operador o como responsable independiente. Esa calificación depende de las funciones reales, no solo del nombre del contrato. Documentar finalidad, destinatarios, comunicaciones del aviso, consentimiento o excepción aplicable, prohibición de reventa y colaboración en derechos e incidentes. **No existe un directorio público de hogares.**

La suscripción compra herramientas y acceso autorizado a oportunidades; no compra la propiedad de las personas ni permiso para usar sus datos sin límites.

## Derechos ARCO y revocación

Proceso a ejecutar por la persona designada:

1. Registrar fecha de recepción, petición y canal seguro de respuesta; asignar un folio interno sin publicar datos.
2. Verificar identidad o representación de forma proporcional. Solicitar únicamente lo necesario; evitar almacenar una identificación completa si existe una alternativa suficiente.
3. Localizar datos en mensajes, fichas, base de datos, descargas y destinatarios autorizados. Determinar corrección, entrega, bloqueo, cancelación u oposición que corresponda.
4. Comunicar la determinación dentro de **20 días hábiles**; ejecutar lo procedente dentro de **15 días hábiles** posteriores. Cualquier ampliación única por periodo igual necesita justificación. Documentar las excepciones y comunicaciones.
5. Extender los cambios a encargados y destinatarios cuando proceda; no prometer borrado inmediato de registros sujetos a conservación legal ni omitir el tratamiento de respaldos.

Cancelar una solicitud comercial y ejercer cancelación de datos son gestiones diferentes. Recibir un contacto comercial no autoriza publicidad. La revocación no es retroactiva. La legislación actual atribuye competencias en datos de particulares a la Secretaría Anticorrupción y Buen Gobierno; no reutilizar sin revisar formatos antiguos dirigidos al extinto INAI. [LFPDPPP, arts. 2, 7, 14–20, 28–36 y 38; texto con reforma 14-11-2025](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf).

## Conservación y respuesta a incidentes

El responsable debe aprobar una matriz con cada categoría, finalidad, ubicación, acceso, plazo justificado, bloqueo/eliminación y tratamiento de copias. No hay un plazo único de conservación aplicable a todos los datos de una mudanza. No presentar una eliminación automática como activa si solo existe en un documento.

| Categoría | Decisión que falta documentar |
| --- | --- |
| Solicitudes no contratadas | Cuándo deja de ser necesario el seguimiento y cómo se eliminan mensajes y descargas |
| Mudanzas contratadas | Plazos contractuales, fiscales y de reclamación aplicables al prestador |
| Cuentas y permisos | Cierre de cuenta, retiro de asignaciones y conservación justificada de evidencias |
| Consentimientos y auditoría | Evidencia mínima necesaria para atender controversias sin conservar inventarios de más |
| Respaldos | Acceso, cifrado, caducidad y cómo evitar restaurar datos cuya eliminación procede |

Ante un incidente: restringir acceso afectado, revocar sesiones y credenciales comprometidas, preservar evidencia mínima en un lugar privado, determinar alcance, corregir la causa y probar la restauración. Informar de inmediato a las personas afectadas cuando se actualice el supuesto del artículo 19 de la LFPDPPP; no esperar a tener todo reconstruido para evaluar esa obligación. Informar a otros responsables o proveedores según los acuerdos aplicables.

**El código fuente no recupera por sí mismo la base de datos, cuentas, mensajes o secretos.** Los respaldos operativos deben guardarse cifrados fuera del repositorio, con un procedimiento de restauración probado. Los registros técnicos no deben copiar contraseñas ni fichas completas innecesariamente.

## Proveedores y mensajería

Alojamiento actual: Sites (OpenAI). Supabase está previsto para cuentas y datos. WhatsApp es un canal elegido por quien comparte. Antes de habilitar cualquier proveedor adicional, registrar servicio, función, datos, ubicación/región, subencargados, condiciones de tratamiento, medidas, exportación y eliminación. No afirmar residencia exclusiva en México sin evidencia.

Las notificaciones del panel solo existen cuando la nube está conectada y la solicitud fue aceptada. Para alertas al teléfono hacen falta servicio de mensajería/push, permisos de destinatarios, configuración y pruebas de entrega. Un enlace `wa.me` abre un mensaje para que la persona confirme; no es una notificación automática ni garantiza lectura. No enviar inventarios o domicilios completos en alertas de pantalla bloqueada; preferir referencia y enlace autenticado al expediente.

## Lista previa a pruebas con clientes

- [ ] Identidad, domicilio, contacto de privacidad y prestador confirmados.
- [ ] Avisos revisados y coherentes con el flujo efectivamente publicado.
- [ ] Tere y Marco aceptaron confidencialidad, uso permitido y atención de derechos.
- [ ] Ambos números probaron recepción con datos ficticios y las fichas no se envían sin elección.
- [ ] Hay persona asignada a reclamaciones y un sustituto.
- [ ] Se documentaron conservación, proveedores y recuperación.
- [ ] Si se abren cuentas: verificación de correo, recuperación, permisos y bajas probados en producción con cuentas de prueba.
- [ ] La publicidad describe funciones reales y evita afirmar disponibilidad o seguridad absolutas.

Antes de cobrar planes, completar además el diseño contractual, fiscal y técnico descrito en [marco legal y titularidad](./marco-legal-y-titularidad.md). No se ha realizado inscripción ante autoridades ni certificación de legalidad con esta documentación.
