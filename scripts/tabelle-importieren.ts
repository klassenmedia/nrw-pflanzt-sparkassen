import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { heuteIso } from '../src/lib/kennzahlen.ts';
import { sparkasseHinweis, sparkasseNachName } from '../src/lib/sparkassenliste.ts';
import { dekodieren, fuerVeroeffentlichung, leseTabelle, pruefeDaten, standAusArgument, TabellenFehler } from '../src/lib/tabelle.ts';

// Aufruf: npm run import -- "<Pfad zur CSV>" [--stand=JJJJ-MM-TT]. Ohne --stand gilt heute; mit --stand lässt sich eine ältere
// Tabelle mit ihrem eigenen Datum einlesen. Bei einem Fehler bleibt die bisherige Datei unverändert.
const ZIEL = fileURLToPath(new URL('../src/data/sparkassen.json', import.meta.url));
const MAX_DATEIGROESSE = 1024 * 1024;

function main(pfad: string | undefined, standOption?: string): number {
  if (!pfad) {
    console.error('Bitte den Pfad zur CSV-Datei angeben: npm run import -- "Tabelle.csv"');
    return 2;
  }
  try {
    if (statSync(pfad).size > MAX_DATEIGROESSE) throw new TabellenFehler('Datei größer als 1 MB, das ist keine Sparkassen-Tabelle.');
    const stand = standAusArgument(standOption, heuteIso(new Date()));
    const { daten, warnungen } = leseTabelle(dekodieren(readFileSync(pfad)), stand, { sparkasse: (zelle) => sparkasseNachName(zelle)?.name, hinweis: sparkasseHinweis });
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

if (process.argv.length > 4) {
  console.error('Zu viele Argumente. Aufruf: npm run import -- "<CSV>" [--stand=JJJJ-MM-TT]');
  process.exitCode = 2;
} else {
  process.exitCode = main(process.argv[2], process.argv[3]);
}
