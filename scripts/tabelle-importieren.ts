import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { heuteIso } from '../src/lib/kennzahlen.ts';
import { dekodieren, fuerVeroeffentlichung, leseTabelle, pruefeDaten, TabellenFehler } from '../src/lib/tabelle.ts';

// Aufruf: npm run import -- "<Pfad zur CSV>". Bei einem Fehler bleibt die bisherige Datei unverändert.
const ZIEL = fileURLToPath(new URL('../src/data/sparkassen.json', import.meta.url));
const MAX_DATEIGROESSE = 1024 * 1024;

function main(pfad: string | undefined): number {
  if (!pfad) {
    console.error('Bitte den Pfad zur CSV-Datei angeben: npm run import -- "Tabelle.csv"');
    return 2;
  }
  try {
    if (statSync(pfad).size > MAX_DATEIGROESSE) throw new TabellenFehler('Datei größer als 1 MB, das ist keine Sparkassen-Tabelle.');
    const { daten, warnungen } = leseTabelle(dekodieren(readFileSync(pfad)), heuteIso(new Date()));
    for (const w of warnungen) console.warn(`Hinweis: ${w}`);
    // Erst prüfen, dann über eine Zwischendatei ersetzen, damit nie eine halbe Datei stehen bleibt.
    const json = `${JSON.stringify(pruefeDaten(fuerVeroeffentlichung(daten)), null, 2)}\n`;
    writeFileSync(`${ZIEL}.tmp`, json);
    renameSync(`${ZIEL}.tmp`, ZIEL);
    console.log(`${daten.eintraege.length} Sparkassen-Zeilen übernommen, Stand ${daten.stand}.`);
    return 0;
  } catch (error) {
    if (error instanceof TabellenFehler) {
      console.error(`Import abgebrochen: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

process.exitCode = main(process.argv[2]);
