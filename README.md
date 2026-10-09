# NRW pflanzt · Die rheinischen Sparkassen

Entwurf für den Onepager der Sparkassen im Rheinland bei NRW pflanzt. Projektseiten je Sparkasse folgen mit der Medien-Automatisierung.
Ziel: `https://www.nrw-pflanzt.de/projekte/sparkassen/`.

- **Stack:** Astro 7 (statisches HTML), eigenes CSS mit Tokens (`src/styles/sparkassen.css`, alles unter `.sk` gekapselt), Three.js für die 3D-Insel, Noto Sans lokal eingebunden.
- **Daten:** `src/data/sparkassen.json`, eine Zeile je Sparkasse aus Guidos Tabelle. Wird beim Build geprüft (`src/lib/tabelle.ts`). Aktuell Beispieldaten.
- **Logik:** `src/lib/kennzahlen.ts` (Status aus den Terminen, Summen, nächster Termin), Tests in `tests/`.

## Befehle

```bash
npm ci
npm run dev
npm test
npm run check
npm run build
```

## Daten aktualisieren

Excel-Tabelle „Kommunen Umsetzungs-Status“ als CSV speichern, dann:

```bash
npm run import -- "Pfad/zur/Tabelle.csv"
npm run build
```

Pflichtspalten: Kommune, Schulaktionstag, Pflanztag, Sparkasse. Dazu „Anzahl Bäume Sparkasse“ (oder „Gepflanzte Bäume“) und „Anzahl Schüler“ (oder „Kinder und Jugendliche“). „*-“ heißt „trifft nicht zu“. Stehen zwei Daten in einer Zelle, zählt das frühere. Fehlt im Sparkassennamen das Wort „Sparkasse“, wird es vorangestellt.
Alle Zeilen mit eingetragener Sparkasse erscheinen auf der Seite, in der Reihenfolge der Tabelle, auch nicht angemeldete Kommunen (als „In Planung“, Entscheidung 09.10.2026). Leer, „keine“, „nein“, „k.A.“ oder „-“ zählen als ohne Sparkasse.
Der Status ergibt sich aus den Terminen: Schulaktionstag vorbei heißt „Schulaktionstag erfolgt“, Pflanztag vorbei heißt „Gepflanzt“.
Bäume zählen erst nach dem Pflanztag, Kinder erst nach dem Schulaktionstag.
Bei einem Fehler bricht der Import ab und die bisherigen Daten bleiben stehen.

`PUBLIC_ENTWURF=false npm run build` erzeugt die Live-Fassung ohne `noindex`.

## Vorschau

GitHub Pages: https://klassenmedia.github.io/nrw-pflanzt-sparkassen/ (nur Entwurf, `noindex`).

Deployment auf Mittwald: [docs/DEPLOY-MITTWALD.md](docs/DEPLOY-MITTWALD.md). Plan und offene Punkte: [docs/plans/2026-09-27-sparkassen-onepager.md](docs/plans/2026-09-27-sparkassen-onepager.md).
