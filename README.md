# NRW pflanzt · Die rheinischen Sparkassen

Entwurf für den Onepager und die 27 Projektseiten der Sparkassen im Rheinland bei NRW pflanzt.
Ziel: `https://www.nrw-pflanzt.de/projekte/sparkassen/`.

- **Stack:** Astro 7 (statisches HTML), eigenes CSS mit Tokens (`src/styles/sparkassen.css`, alles unter `.sk` gekapselt), Three.js für die 3D-Insel, Noto Sans lokal eingebunden.
- **Daten:** `src/data/regionen.ts` (später WordPress-Beitragstyp „Region“ mit Feld `stand`).
- **Logik:** `src/lib/projektstand.ts`, Tests in `tests/`.

## Befehle

```bash
npm ci
npm run dev
npm test
npm run check
npm run build
```

`PUBLIC_ENTWURF=false npm run build` erzeugt die Live-Fassung ohne Entwurfs-Steuerung und ohne `noindex`.

## Vorschau

GitHub Pages: https://klassenmedia.github.io/nrw-pflanzt-sparkassen/ (nur Entwurf, `noindex`).

Deployment auf Mittwald: [docs/DEPLOY-MITTWALD.md](docs/DEPLOY-MITTWALD.md). Plan und offene Punkte: [docs/plans/2026-09-27-sparkassen-onepager.md](docs/plans/2026-09-27-sparkassen-onepager.md).
