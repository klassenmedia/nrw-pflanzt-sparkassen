import { TREE_GOAL, bereinigt, istDatum, normalisiert, type Eintrag } from './kennzahlen.ts';

// Liest Guidos Sparkassen-Tabelle (CSV-Export aus Excel) und prüft die Daten, bevor sie auf die Seite kommen.

export interface Datenstand {
  stand: string;
  beispiel: boolean;
  eintraege: Eintrag[];
}

export class TabellenFehler extends Error {
  override name = 'TabellenFehler';
}

// Grobe Plausibilitätsgrenzen pro Zeile; mehr ist sicher ein Tippfehler.
const MAX_BAEUME_PRO_ZEILE = TREE_GOAL;
const MAX_KINDER_PRO_ZEILE = 20_000;
const MAX_ZEILEN = 500;
const MAX_NAMENSLAENGE = 120;

const SPALTEN = {
  kommune: ['kommune'],
  schulaktionstag: ['schulaktionstag'],
  pflanztag: ['pflanztag', '1. pflanztag'],
  sparkasse: ['sparkasse', 'name der sparkasse'],
  // Nur eindeutige Namen, damit etwa "Anzahl Bäume" (zugesagt) nie als gepflanzt zählt.
  baeume: ['gepflanzte bäume', 'bäume gepflanzt', 'gepflanzte baeume'],
  kinder: ['kinder und jugendliche', 'kinder und jugendliche dabei'],
} as const;

type Spalte = keyof typeof SPALTEN;
const PFLICHT: readonly Spalte[] = ['kommune', 'schulaktionstag', 'pflanztag', 'sparkasse'];
const SPALTEN_NAME: Record<Spalte, string> = {
  kommune: 'Kommune',
  schulaktionstag: 'Schulaktionstag',
  pflanztag: 'Pflanztag',
  sparkasse: 'Sparkasse',
  baeume: 'Gepflanzte Bäume',
  kinder: 'Kinder und Jugendliche',
};

// Excel speichert CSV unter Windows meist als Windows-1252, neuere Versionen als UTF-8.
export function dekodieren(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/, '');
}

// Kaputte Anführungszeichen würden Zeilen verschmelzen; deshalb dort abbrechen statt raten.
export function parseCsv(text: string, trenner = ';'): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let inQuotes = false;
  let nachQuote = false;
  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i];
    if (inQuotes) {
      if (zeichen === '"' && text[i + 1] === '"') {
        feld += '"';
        i++;
      } else if (zeichen === '"') {
        inQuotes = false;
        nachQuote = true;
      } else feld += zeichen;
    } else if (zeichen === trenner) {
      zeile.push(feld);
      feld = '';
      nachQuote = false;
    } else if (zeichen === '\n' || zeichen === '\r') {
      if (zeichen === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld);
      zeilen.push(zeile);
      zeile = [];
      feld = '';
      nachQuote = false;
    } else if (nachQuote || (zeichen === '"' && feld)) {
      throw new TabellenFehler(`Zeile ${zeilen.length + 1}: Anführungszeichen mitten im Feld.`);
    } else if (zeichen === '"') inQuotes = true;
    else feld += zeichen;
  }
  if (inQuotes) throw new TabellenFehler(`Zeile ${zeilen.length + 1}: Anführungszeichen nicht geschlossen.`);
  if (feld || zeile.length) {
    zeile.push(feld);
    zeilen.push(zeile);
  }
  return zeilen;
}

function spaltenIndex(kopf: readonly string[]): Partial<Record<Spalte, number>> {
  const namen = kopf.map(normalisiert);
  const index: Partial<Record<Spalte, number>> = {};
  for (const spalte of Object.keys(SPALTEN) as Spalte[]) {
    const treffer = namen.flatMap((n, i) => ((SPALTEN[spalte] as readonly string[]).includes(n) ? [i] : []));
    if (treffer.length > 1) throw new TabellenFehler(`Spalte „${SPALTEN_NAME[spalte]}“ steht mehrfach in der Kopfzeile.`);
    if (treffer.length === 1) index[spalte] = treffer[0];
  }
  return index;
}

const DEUTSCHES_DATUM = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
// Guidos Platzhalter, auch mit dem häufigen Tippfehler "termnieren".
const NOCH_OFFEN = /^termi?nieren$/i;

function datumAus(zelle: string, ort: string, warnungen: string[]): string | undefined {
  const text = zelle.trim();
  if (!text || NOCH_OFFEN.test(text)) return undefined;
  const match = DEUTSCHES_DATUM.exec(text);
  const iso = match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
  if (istDatum(iso)) return iso;
  warnungen.push(`${ort}: „${text}“ ist kein Datum, wird ignoriert.`);
  return undefined;
}

const GANZZAHL = /^\d{1,3}(\.\d{3})*$|^\d+$/;

function zahlAus(zelle: string, max: number, ort: string): number {
  const text = zelle.trim();
  if (!text) return 0;
  if (!GANZZAHL.test(text)) throw new TabellenFehler(`${ort}: „${text}“ ist keine ganze Zahl.`);
  const wert = Number(text.replaceAll('.', ''));
  if (wert > max) throw new TabellenFehler(`${ort}: ${wert} ist unplausibel hoch (höchstens ${max}).`);
  return wert;
}

const FORMEL_ODER_STEUERZEICHEN = /^[=+\-@]|\p{Cc}/u;
// Was Guido statt einer Sparkasse einträgt, wenn keine zuständig ist; ohne Buchstaben ist es nie ein Name.
const KEINE_SPARKASSE = new Set(['keine', 'nein', 'k.a.', 'k. a.', 'n/a', 'n.a.', 'offen']);

function hatSparkasse(zelle: string): boolean {
  const name = bereinigt(zelle);
  return /\p{L}/u.test(name) && !KEINE_SPARKASSE.has(name.toLocaleLowerCase('de'));
}

function nameAus(zelle: string, ort: string): string {
  const name = bereinigt(zelle);
  if (FORMEL_ODER_STEUERZEICHEN.test(name)) throw new TabellenFehler(`${ort}: „${name.slice(0, 40)}“ sieht nach Formel oder Steuerzeichen aus.`);
  if (name.length > MAX_NAMENSLAENGE) throw new TabellenFehler(`${ort}: Name länger als ${MAX_NAMENSLAENGE} Zeichen.`);
  return name;
}

function eintragAus(werte: readonly string[], index: Partial<Record<Spalte, number>>, nr: number, warnungen: string[]): Eintrag {
  const zelle = (spalte: Spalte) => (index[spalte] === undefined ? '' : (werte[index[spalte]] ?? ''));
  const kommune = nameAus(zelle('kommune'), `Zeile ${nr}, Kommune`);
  if (!kommune) throw new TabellenFehler(`Zeile ${nr}: Sparkasse ohne Kommune.`);
  const ort = `Zeile ${nr} (${kommune})`;
  const eintrag: Eintrag = {
    sparkasse: nameAus(zelle('sparkasse'), `${ort}, Sparkasse`),
    kommune,
    baeumeGepflanzt: zahlAus(zelle('baeume'), MAX_BAEUME_PRO_ZEILE, `${ort}, ${SPALTEN_NAME.baeume}`),
    kinder: zahlAus(zelle('kinder'), MAX_KINDER_PRO_ZEILE, `${ort}, ${SPALTEN_NAME.kinder}`),
  };
  const schulaktionstag = datumAus(zelle('schulaktionstag'), `${ort}, Schulaktionstag`, warnungen);
  const pflanztag = datumAus(zelle('pflanztag'), `${ort}, Pflanztag`, warnungen);
  if (schulaktionstag) eintrag.schulaktionstag = schulaktionstag;
  if (pflanztag) eintrag.pflanztag = pflanztag;
  if (schulaktionstag && pflanztag && pflanztag < schulaktionstag) {
    warnungen.push(`${ort}: Pflanztag liegt vor dem Schulaktionstag, bitte prüfen.`);
  }
  return eintrag;
}

function pruefeDubletten(eintraege: readonly Eintrag[]) {
  const gesehen = new Set<string>();
  for (const e of eintraege) {
    const schluessel = `${normalisiert(e.sparkasse)}|${normalisiert(e.kommune)}`;
    if (gesehen.has(schluessel)) throw new TabellenFehler(`${e.sparkasse} mit ${e.kommune} steht doppelt in der Tabelle.`);
    gesehen.add(schluessel);
  }
}

export function leseTabelle(text: string, stand: string): { daten: Datenstand; warnungen: string[] } {
  const [kopf = [], ...zeilen] = parseCsv(text);
  const index = spaltenIndex(kopf);
  const fehlend = PFLICHT.filter((s) => index[s] === undefined).map((s) => SPALTEN_NAME[s]);
  if (fehlend.length) throw new TabellenFehler(`Spalte fehlt: ${fehlend.join(', ')}. Gefunden: ${kopf.filter(Boolean).join(' | ')}`);
  const warnungen: string[] = [];
  for (const spalte of ['baeume', 'kinder'] as const) {
    if (index[spalte] === undefined) warnungen.push(`Spalte „${SPALTEN_NAME[spalte]}“ fehlt, zähle überall 0.`);
  }
  const mitInhalt = zeilen.map((werte, i) => ({ werte, nr: i + 2 })).filter(({ werte }) => werte.some((w) => w.trim()));
  if (mitInhalt.length > MAX_ZEILEN) throw new TabellenFehler(`${mitInhalt.length} Zeilen, erwartet höchstens ${MAX_ZEILEN}.`);
  const eintraege: Eintrag[] = [];
  let ohneSparkasse = 0;
  for (const { werte, nr } of mitInhalt) {
    if (!hatSparkasse(werte[index.sparkasse!] ?? '')) ohneSparkasse++;
    else eintraege.push(eintragAus(werte, index, nr, warnungen));
  }
  if (ohneSparkasse) warnungen.push(`${ohneSparkasse} ${ohneSparkasse === 1 ? 'Zeile' : 'Zeilen'} ohne Sparkasse übersprungen.`);
  if (!eintraege.length) throw new TabellenFehler('Die Tabelle enthält keine Zeile mit eingetragener Sparkasse.');
  pruefeDubletten(eintraege);
  return { daten: { stand, beispiel: false, eintraege }, warnungen };
}

function istZahl(value: unknown, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
}

function pruefeEintrag(roh: unknown, nr: number): Eintrag {
  const e = roh as Record<string, unknown> | null;
  const ok =
    typeof e === 'object' &&
    e !== null &&
    typeof e.sparkasse === 'string' &&
    typeof e.kommune === 'string' &&
    e.kommune.trim() !== '' &&
    istZahl(e.baeumeGepflanzt, MAX_BAEUME_PRO_ZEILE) &&
    istZahl(e.kinder, MAX_KINDER_PRO_ZEILE) &&
    (e.schulaktionstag === undefined || istDatum(e.schulaktionstag)) &&
    (e.pflanztag === undefined || istDatum(e.pflanztag));
  if (!ok) throw new TabellenFehler(`Eintrag ${nr} in den Sparkassen-Daten ist ungültig.`);
  const eintrag: Eintrag = {
    sparkasse: e.sparkasse as string,
    kommune: e.kommune as string,
    baeumeGepflanzt: e.baeumeGepflanzt as number,
    kinder: e.kinder as number,
  };
  if (e.schulaktionstag !== undefined) eintrag.schulaktionstag = e.schulaktionstag as string;
  if (e.pflanztag !== undefined) eintrag.pflanztag = e.pflanztag as string;
  return eintrag;
}

// Läuft bei jedem Build, damit eine von Hand geänderte Datei nichts Falsches veröffentlicht.
export function pruefeDaten(roh: unknown): Datenstand {
  const d = roh as Record<string, unknown> | null;
  if (typeof d !== 'object' || d === null || !istDatum(d.stand) || typeof d.beispiel !== 'boolean' || !Array.isArray(d.eintraege)) {
    throw new TabellenFehler('Sparkassen-Daten: Stand, Beispiel-Kennzeichen oder Einträge fehlen.');
  }
  const eintraege = d.eintraege.map((e, i) => pruefeEintrag(e, i + 1));
  pruefeDubletten(eintraege);
  return { stand: d.stand, beispiel: d.beispiel, eintraege };
}
