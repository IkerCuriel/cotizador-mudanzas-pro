import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { readCloudConfig } from "./src/cloud.js";
import { assertPublicEnvironment } from "./scripts/public-env.mjs";
import { PUBLIC_SITE_URL } from "./site.config.js";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  assertPublicEnvironment(env);
  const config = readCloudConfig(env);
  if (config.error) throw new Error(config.error + ' Usa exclusivamente la clave pública anon/publishable de Supabase.');
  const siteUrl = env.VITE_SITE_URL || env.CF_PAGES_URL || PUBLIC_SITE_URL;
  let origin;
  if (siteUrl) {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('VITE_SITE_URL debe ser un origen HTTPS sin rutas ni credenciales.');
    origin = parsed.origin;
  }
  return {
  base: "./",
  plugins: [{
    name: 'social-preview',
    transformIndexHtml(html, context) {
      const tags = context.server ? [] : [{
        tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://places.googleapis.com https://maps.gstatic.com; frame-src https://www.google.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" }, injectTo: 'head-prepend',
      }];
      if (!context.filename.endsWith('/index.html')) return { html, tags };
      tags.push(
        { tag: 'link', attrs: { rel: 'icon', href: './favicon.svg', type: 'image/svg+xml' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:locale', content: 'es_MX' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'MoveFlow' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:title', content: 'MoveFlow | Cambia de casa. Empieza tranquilo.' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:description', content: 'Prepara tu mudanza y conversa con Mudanzas D’Curiel por WhatsApp. Atención personal para acordar el servicio contigo.' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
      );
      if (origin) tags.push(
        { tag: 'link', attrs: { rel: 'canonical', href: origin + '/' }, injectTo: 'head' },
        ...[['og:url', origin + '/'], ['og:image', origin + '/social-preview.png'], ['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:alt', 'MoveFlow. Cambia de casa. Empieza tranquilo.']].map(([property, content]) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' })),
      );
      return { html, tags };
    },
  }],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        solicitud: fileURLToPath(new URL("./index.html", import.meta.url)),
        mudanceros: fileURLToPath(new URL("./mudanceros.html", import.meta.url)),
        pago: fileURLToPath(new URL("./pago.html", import.meta.url)),
        soporte: fileURLToPath(new URL("./soporte.html", import.meta.url)),
        negocio: fileURLToPath(new URL("./negocio.html", import.meta.url)),
        cuenta: fileURLToPath(new URL("./cuenta.html", import.meta.url)),
        panel: fileURLToPath(new URL("./panel.html", import.meta.url)),
        privacidad: fileURLToPath(new URL("./privacidad.html", import.meta.url)),
        terminos: fileURLToPath(new URL("./terminos.html", import.meta.url)),
      },
    },
  },
  };
});
