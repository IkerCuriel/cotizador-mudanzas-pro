# Operación, privacidad y preparación comercial

**Borrador de trabajo interno.** Organiza decisiones y pendientes; no sustituye un aviso de privacidad público, un contrato ni la revisión jurídica y fiscal. Las medidas técnicas y las políticas de base de datos no certifican legalidad.

## Etapa inicial

El negocio familiar atiende las solicitudes del piloto. El sitio reúne la información para facilitar una conversación; la persona y la empresa acuerdan por separado el servicio, precio y condiciones. No hay tarifa automática, seguro incluido, reserva confirmada ni cobro de membresías.

Cuando se incorpore una red, se distinguirá a la plataforma que conecta oportunidades de la empresa que presta cada mudanza. Escribir «solo somos intermediarios» no elimina por sí mismo obligaciones: el comportamiento real, las ofertas y los contratos deben ser coherentes.

## Identidad pendiente antes del registro público

| Dato | Estado |
| --- | --- |
| Nombre comercial definitivo | Pendiente; MoveFlow es provisional. |
| Nombre completo o razón social del responsable de los datos | Pendiente de confirmación. |
| Domicilio del responsable para el aviso | Pendiente de confirmación. |
| Correo y procedimiento para derechos ARCO | Pendientes; no usar automáticamente el correo personal del propietario. |
| Nombre e identidad de quien presta cada mudanza | Pendientes de confirmación. |
| Canal operativo del negocio | WhatsApp 55 2906 1098. |
| Dominio y proveedores de alojamiento/correo activos | Pendientes de configuración. |
| Persona que atenderá solicitudes y reclamaciones | Pendiente de designación. |

No inventar razón social, domicilio, RFC, inscripción, certificación ni garantía. El teléfono de atención no completa por sí solo todos los datos del responsable.

## Referencia normativa de privacidad

La LFPDPPP exige informar identidad y domicilio del responsable, datos tratados, finalidades, límites de uso o divulgación, procedimientos ARCO y cambios del aviso. Debe existir aviso al recabar información, además de medidas de seguridad y confidencialidad. Transferir datos a otros mudanceros requiere analizar finalidad, información y consentimiento aplicable. ARCO contempla respuesta en 20 días hábiles y ejecución procedente en 15 más. Las referencias a autoridades deben ajustarse a la ley actual. [LFPDPPP, arts. 14–20, 28–35; reforma del 14 de noviembre de 2025](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf)

## Decisiones de producto propuestas

Estas decisiones operativas requieren revisión e implementación; no son una transcripción de la ley:

1. **Finalidad principal:** preparar y atender la mudanza solicitada, administrar la cuenta y mantener su seguimiento.
2. **Atención familiar:** informar que el negocio familiar recibe la solicitud y por qué canales puede contactar.
3. **Red de mudanceros:** usar una autorización adicional, separada y desmarcada por defecto, para distribuir oportunidades a otros proveedores aprobados. No incluirla implícitamente en la aceptación del aviso ni en publicidad.
4. **Publicidad:** si se incorpora, solicitar autorización aparte y permitir retirarla. Un aviso operativo y una campaña comercial tienen propósitos diferentes.
5. **Trazabilidad:** conservar versión del aviso y condiciones, fecha de aceptación, identidad de cuenta y autorización de distribución. Registrar qué proveedores reciben cada solicitud.
6. **Exposición mínima:** mostrar solo el resumen necesario. Revelar contacto y domicilios a personas autorizadas que los necesiten para atender el servicio.
7. **Sin directorio de hogares:** no publicar teléfonos, fechas de ausencia, inventarios ni direcciones de solicitantes en buscadores, tarjetas sociales o páginas abiertas.

No habilitar la red hasta concretar destinatarios, asignaciones, términos para proveedores y retirada de autorización. Una membresía concede acceso conforme a estas reglas; no otorga derechos ilimitados sobre los datos.

## Gestión diaria

- Designar quién revisa solicitudes y quién cubre su ausencia.
- Registrar seguimiento, propuestas y elección sin confundirlos con aceptación contractual o reserva.
- Acordar por escrito alcance, fechas, importe, maniobras, exclusiones, pago y responsabilidades.
- Aprobar proveedores antes de asignarles solicitudes; no usar «verificado» sin una comprobación definida.
- Registrar reclamaciones y correcciones; evitar prometer plazos que el negocio no pueda sostener.
- Revocar acceso al terminar una colaboración y revisar periódicamente roles y proveedores.

Las notificaciones actuales se consultan en el panel al cargarlo o actualizarlo. No se debe prometer atención inmediata por correo o WhatsApp sin implementar y comprobar esos canales.

## Conservación, derechos y seguridad

Definir una política documentada de conservación: plazo necesario por tipo de dato, personas autorizadas, bloqueo o eliminación y tratamiento de respaldos y obligaciones de conservación. No presentar un plazo arbitrario como requisito legal universal.

El proceso de derechos debe cubrir recepción, verificación proporcional de identidad, seguimiento, respuesta y ejecución. Evitar pedir identificaciones sin necesidad. Al eliminar una cuenta, contemplar solicitudes, asignaciones y datos derivados, con las excepciones legalmente documentadas.

Configurar permisos en el servidor y políticas por fila —RLS—, proteger secretos, limitar administración, conservar registros necesarios y preparar respuesta a incidentes. Probar accesos indebidos con distintos roles. **RLS reduce accesos no autorizados; no reemplaza consentimiento, avisos, contratos ni atención de derechos.**

Revisar condiciones y contratos de Supabase, Cloudflare, correo y procesadores efectivamente utilizados, incluidos países de tratamiento y funciones de cada proveedor. No afirmar que los datos permanecen en México si la infraestructura no lo acredita.

## Planes para mudanceros

El acceso inicial es un **piloto gratuito**, concedido por administración al negocio familiar. No renueva a un plan pagado ni registra tarjetas. Distinguir aprobación de proveedor, rol administrativo y vigencia del acceso: son decisiones diferentes.

Antes de vender una suscripción, definir:

- Beneficios reales: zonas, tipos de oportunidad, herramientas y límites.
- Precio, moneda, impuestos, frecuencia, fecha de cobro y prueba, si la hubiera.
- Renovación, cancelación, suspensión por impago, reembolsos y controversias.
- Uso permitido de los datos: contacto por la mudanza autorizada, confidencialidad, no reventa y cooperación al atender derechos.
- Tratamiento de las oportunidades abiertas cuando venza el acceso.

La LFPC exige claridad comercial y confidencialidad. El artículo 76 Bis incorpora consentimiento expreso para cargos recurrentes, información de monto, periodicidad y fecha, aviso de renovación con cinco días naturales y cancelación inmediata. Revisar su aplicación al contrato concreto entre plataforma y proveedores. [LFPC vigente, reforma de diciembre de 2025](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf)

La integración de pagos debe verificar eventos en el servidor, evitar duplicados y actualizar acceso por pago, impago o cancelación. Mantener evidencia del consentimiento y comunicaciones. Utilizar el flujo del procesador sin guardar tarjetas en la aplicación.

## Preparación fiscal y comercial

Revisar con un contador actividad, RFC, régimen, impuestos y comprobantes de la plataforma y del negocio de mudanzas. No asumir que un recibo del procesador sustituye el comprobante que corresponda emitir. La identidad de quien cobra y el modelo de ingresos deben coincidir con la operación. [Orientación del SAT sobre actividad empresarial](https://wwwmat.sat.gob.mx/consulta/04950/conoce-el-regimen-de-actividad-empresarial-y-profesional)

Antes del registro público, completar identidad, revisar avisos y condiciones, configurar SMTP y comprobar el recorrido con datos ficticios. Mantener deshabilitadas las altas en Supabase Auth y la recepción en el servidor hasta entonces. Esta preparación no garantiza cumplimiento jurídico futuro ni autoriza seguros, servicios o afirmaciones inexistentes.
