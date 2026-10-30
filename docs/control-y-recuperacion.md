# Manual del propietario: control, publicación y recuperación

Actualizado: 30 de octubre de 2026. Este manual corresponde al proyecto **MoveFlow**, cuyo nombre comercial sigue sujeto a confirmación y búsqueda de marca.

## 1. Qué tienes y dónde está

| Recurso | Ubicación / control |
| --- | --- |
| Proyecto completo en tu Mac | `/Users/ikercuriel/Documents/Ingenier_IA/PROYECTOS/cotizador-mudanzas-pro` |
| Espacio de trabajo VS Code | `MoveFlow.code-workspace`, dentro de esa carpeta |
| Código e historial remoto | `https://github.com/IkerCuriel/cotizador-mudanzas-pro` |
| Sitio público actual | `https://moveflow-mudanzas.render-inspace.chatgpt.site/` |
| Alojamiento actual | Sites, vinculado a tu cuenta; la consulta de acceso confirma el rol de propietario |
| Datos y cuentas del negocio | Supabase: pendientes de conexión y activación; no se guardan en GitHub |
| Contactos del piloto | Tere Curiel: 55 2906 1098; Marco Curiel: 56 1449 2452 |

El código está en tu computadora y en tu repositorio. Puedes llevarlo a otro alojamiento. El subdominio `chatgpt.site` pertenece al proveedor; conservar una dirección propia al migrar requiere un dominio registrado bajo tu control. Tener el código no equivale a ser propietario de las marcas de terceros ni a tener registrada una marca o un dominio.

El repositorio es público: cualquiera puede ver y copiar lo publicado conforme a los derechos y condiciones aplicables. No almacenes datos de clientes, contraseñas, claves privadas ni respaldos de la base allí. Hacer público un repositorio no lo convierte por sí solo en software de código abierto. Revisa `docs/marco-legal-y-titularidad.md`.

## 2. Abrir, trabajar y detener la copia local

1. En VS Code, abre `MoveFlow.code-workspace` desde la carpeta del proyecto.
2. En **Terminal → Nueva terminal**, usa Node.js 22 y ejecuta:

   ```bash
   npm ci
   npm run dev
   ```

3. Abre la dirección que aparece, normalmente `http://localhost:5173`.
4. Detén esa terminal con **Control + C** cuando termines. Esto detiene únicamente la copia local: **no apaga el sitio público**.
5. Para trabajar con cuentas reales, configura `.env.local` a partir de `.env.example`. Nunca guardes ese archivo en Git. Las variables `VITE_` son públicas en el navegador; solo deben contener datos públicos.

Puedes utilizar las tareas de VS Code con **Terminal → Ejecutar tarea** para desarrollar, verificar, preparar publicación, generar mantenimiento o crear respaldo.

## 3. Publicación actual en Sites

El archivo `.openai/hosting.json` identifica el sitio ya existente. Conserva su `project_id` y no crees otro sitio para cada actualización. `site.config.js` conserva el origen de las tarjetas sociales; si migras, configura `VITE_SITE_URL` con la dirección real.

En la integración de Sites de Codex, puedes solicitar: «Publica los cambios revisados de este proyecto en su sitio existente», «Restringe el sitio a mi cuenta para retirarlo del acceso público» o «Restaura la versión publicada anterior». Son operaciones distintas de guardar archivos o subir código a GitHub. Comprueba el enlace en otro navegador después de cada cambio.

Las credenciales de publicación de Sites son temporales. No las guardes en Git, en un instructivo o como una contraseña permanente de GitHub Actions. El enlace público continúa funcionando aunque cierres VS Code o apagues tu Mac.

Para una pausa visible, puedes generar la página de mantenimiento:

```bash
npm run build:maintenance
```

Esto prepara `dist/` con un aviso sin formulario y sin los archivos anteriores del cliente. **Todavía tienes que publicarlo en Sites** para que cambie Internet. Para recuperar la aplicación, ejecuta `npm run build` y publica otra vez. Compilar mantenimiento no borra el código, no cancela servicios ya contratados y no cierra por sí solo una base de datos activa.

## 4. Control desde GitHub en tu propia cuenta de alojamiento

Está preparado el flujo **Control manual de publicación (Cloudflare)**. No está conectado ni cambia el sitio actual de Sites. Te permite decidir cuándo publicar y cuándo mostrar mantenimiento desde **Actions → Control manual de publicación → Run workflow** después de configurar tu cuenta.

Configuración única:

1. Crea una cuenta de Cloudflare que controles tú, con autenticación de dos factores, y un proyecto Pages para carga directa. Elige el nombre disponible que represente a tu negocio. No compres un plan por defecto.
2. Crea un token limitado a **Cloudflare Pages: Edit** en la cuenta necesaria; conserva la titularidad y recuperación de esa cuenta. No uses la clave global.
3. En GitHub, **Settings → Environments**, crea `production` y restringe la publicación a `main`; configura revisión por el propietario si tu plan lo permite.
4. En ese entorno guarda como secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`. Guarda como variable `CLOUDFLARE_PAGES_PROJECT` el nombre exacto del proyecto.
5. Añade las variables públicas de `.env.example`, especialmente `VITE_SITE_URL` con la nueva URL. Deja avisos y cuentas desactivados hasta completar su configuración. Los datos legales deben ser reales.
6. En **Actions**, selecciona la rama `main`, acción `publicar` y ejecuta. Una ejecución fallida no significa que se haya publicado.
7. Comprueba formulario, contacto, páginas legales y tarjeta social en la nueva URL. Si habilitas cuentas, añade esa URL exacta a los retornos permitidos de Supabase.

Para pausar, ejecuta el mismo flujo con `mantenimiento`. Para reabrir, elige `publicar`. No hay publicación automática con cada commit. Si usas integración Git nativa de Cloudflare, desactiva sus despliegues automáticos para que no compitan con este control manual.

GitHub aloja el código y ejecuta las verificaciones. **GitHub Pages no es el alojamiento propuesto para el producto comercial**, por sus límites de uso. El flujo preparado despliega en tu cuenta de Cloudflare, no en Pages de GitHub.

Referencias: [carga directa con integración continua](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [desactivar despliegues automáticos](https://developers.cloudflare.com/pages/configuration/git-integration/), [límites de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## 5. Pausa de emergencia cuando haya datos reales

1. Desde la administración confiable de Supabase, ejecuta `supabase/operations/pause-intake.sql`. Comprueba `accepting_requests = false`. Esto bloquea nuevas solicitudes en el servidor, incluso desde versiones anteriores del navegador.
2. Publica mantenimiento o restringe el acceso al sitio. No basta cerrar tu computadora ni esconder un botón.
3. Si hay indicios de intrusión, conserva registros y evidencia, revoca sesiones y accesos comprometidos, rota los secretos afectados y revisa integraciones. No borres la base ni los registros para «limpiar» el problema.
4. Atiende servicios ya contratados por el canal acordado; una pausa de la web no anula contratos ni obligaciones de privacidad.
5. Para reabrir, corrige la causa, verifica permisos con cuentas distintas y restaura el despliegue revisado. Activa `accepting_requests` solo cuando identidad, avisos, correo y asesores estén listos. No actives la red de terceros por accidente.

Una página de mantenimiento no revoca una sesión de Supabase ni retira datos ya enviados por WhatsApp. La revocación y atención de incidentes deben hacerse también en esos sistemas.

## 6. Respaldar el código

Guarda los cambios en un commit antes de ejecutar:

```bash
npm run backup:source
```

Se crea una carpeta fechada dentro de `backups/`, excluida de Git. Contiene el historial Git (`moveflow-source.bundle`), el código del commit (`moveflow-source.tar.gz`), comprobantes SHA-256 y las instrucciones de restauración. El proceso verifica el bundle y rechaza trabajar con cambios sin guardar para no producir un respaldo incompleto inadvertidamente.

También puedes elegir una carpeta nueva en un disco externo:

```bash
npm run backup:source -- --output /ruta/nueva/para-el-respaldo
```

Conserva una copia en otro dispositivo y otra fuera del equipo, con acceso restringido. Los respaldos de código no son una copia de las cuentas, la base, los archivos de clientes, DNS, secretos o configuración externa. El bundle conserva todo lo que se haya versionado, incluido cualquier secreto que alguien hubiera subido por error: no es un procedimiento de sanitización. Revisa el historial y rota credenciales expuestas antes de compartir un respaldo.

## 7. Recuperar el código en una carpeta nueva

Desde la carpeta del respaldo:

```bash
shasum -a 256 -c SHA256SUMS.txt
git clone moveflow-source.bundle moveflow-restaurado
cd moveflow-restaurado
npm ci
npm test
npm run dev
```

Compara el commit de `respaldo.json` con `git rev-parse HEAD`. Revisa el código antes de conectar credenciales. El remoto inicial del clon es el archivo del respaldo; para reconectar TU repositorio:

```bash
git remote set-url origin https://github.com/IkerCuriel/cotizador-mudanzas-pro.git
git fetch origin
```

Compara los cambios antes de hacer push. No uses `--force` ni borres el historial como mecanismo de recuperación. Si prefieres recuperar solo archivos sin historial, descomprime `moveflow-source.tar.gz` en una carpeta vacía.

## 8. Respaldar y recuperar datos, cuentas y secretos

Antes de operar con clientes reales, configura respaldos de Supabase y una prueba de restauración en un proyecto separado. Documenta qué incluye tu plan: no presupongas recuperación puntual o respaldos descargables. Las políticas de seguridad, cuentas Auth, archivos de Storage y funciones pueden necesitar procedimientos distintos.

Mantén copias cifradas de datos exclusivamente donde el responsable haya autorizado, con plazos de conservación. No pongas exportaciones SQL, listados de clientes, códigos MFA ni claves en GitHub. Guarda secretos y códigos de recuperación en un gestor de contraseñas bajo tu control. La pérdida de claves privadas de notificaciones obliga a registrar de nuevo dispositivos; los tokens de pago y de correo requieren sus propios procedimientos.

Prueba restauración con datos ficticios antes del lanzamiento. Define cuánto historial podrías perder y cuánto tiempo puedes permanecer fuera de servicio. La recuperación de código se puede comprobar sin garantizar recuperación de cuentas o datos que nunca se respaldaron.

Referencias: [respaldos Supabase](https://supabase.com/docs/guides/platform/backups), [exportación con CLI](https://supabase.com/docs/reference/cli/supabase-db-dump).

## 9. Lista de salida del piloto

- Identidad, domicilio y correo del responsable confirmados; aviso y condiciones revisados para la operación real.
- Cuenta de propietario y recuperación de GitHub, alojamiento, dominio, correo y base bajo tu control.
- Tere y Marco invitados a correos individuales, con contraseña propia y segundo factor; ninguna contraseña guardada en el repositorio.
- Solicitud ficticia visible solo para el cliente, los asesores asignados y administración autorizada.
- Avisos al teléfono probados en los dispositivos concretos; confirmación de recepción antes de prometer ese canal.
- Respaldo de código verificado y restauración de datos de prueba documentada.
- Contacto, cancelación, privacidad y reclamaciones operativos. Ningún cobro recurrente activo durante el piloto.

No existe una configuración que garantice cero ataques. El objetivo es reducir accesos indebidos, detectar problemas, limitar su alcance y poder recuperar la operación.
