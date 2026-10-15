// @ts-check
import { defineConfig } from 'astro/config';

// Standard: www.nrw-pflanzt.de/projekte/sparkassen/ (Mittwald). Für die Entwurfsvorschau auf
// GitHub Pages setzt der Workflow SITE_URL und BASE_PATH.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://www.nrw-pflanzt.de',
  base: process.env.BASE_PATH ?? '/projekte/sparkassen',
  trailingSlash: 'always',
  compressHTML: true,
  build: { assets: 'assets' },
  // Fotos des Laufbands in einen eigenen Unterordner, damit assets/ auf dem Server übersichtlich bleibt.
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (info) => {
            const original = info.names?.[0] ?? 'datei';
            // Astro hängt intern „@_@astro“ an den CSS-Namen; ohne Abschneiden hieße die Datei index@_@astro.css.
            const name = original.replace(/\.[^.]+$/, '').replace(/@_@.*$/, '');
            return `${/\.webp$/i.test(original) ? 'assets/fotos' : 'assets'}/${name}.[hash][extname]`;
          },
        },
      },
    },
  },
});
