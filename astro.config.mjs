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
});
