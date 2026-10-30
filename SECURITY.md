# Seguridad de MoveFlow

No publiques datos de clientes, contraseñas, enlaces de recuperación, claves de API ni códigos de autenticador en issues o comentarios.

Si encontraste una vulnerabilidad, usa **Security → Report a vulnerability** en este repositorio. El canal privado de reporte está habilitado. Incluye una descripción, impacto y pasos reproducibles con datos ficticios. No accedas a fichas ajenas, no hagas pruebas destructivas y no envíes solicitudes masivas.

El propietario revisa reportes y cambios de dependencias antes de publicar. El repositorio tiene escaneo de secretos, protección de pushes y propuestas de actualización de seguridad activadas; estas herramientas no encuentran todos los problemas ni certifican ausencia de vulnerabilidades. No hay un programa de recompensas ni plazo de respuesta garantizado.

El piloto público atiende por WhatsApp. Las cuentas, permisos MFA y avisos Web Push están preparados en el código y requieren configuración real de Supabase, correo y dispositivos. No confundas pruebas locales con una auditoría del sistema de producción.

Si sospechas de una intrusión, sigue [control y recuperación](docs/control-y-recuperacion.md). Mantén cuentas y secretos bajo control del propietario, aplica las migraciones en orden, verifica separación entre usuarios y prueba la recuperación antes de operar con datos reales.
