import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas: funciona dentro de https://usuario.github.io/repositorio/
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
