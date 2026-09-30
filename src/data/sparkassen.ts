import roh from './sparkassen.json';
import { pruefeDaten } from '../lib/tabelle.ts';

// sparkassen.json schreibt `npm run import -- <datei.csv>`. Bis Guidos Tabelle alle Spalten hat: Beispieldaten.
export const datenstand = pruefeDaten(roh);
export const eintraege = datenstand.eintraege;
export const BEISPIELDATEN = datenstand.beispiel;
