// Drei Stufen, wie im Call mit Guido festgelegt (30.09.2026). Abgeleitet aus den Terminen der Tabelle.
export const STATUS_WERTE = ['geplant', 'aktion', 'gepflanzt'] as const;
export type Status = (typeof STATUS_WERTE)[number];

export const TREE_GOAL = 50_000;
const MIN_ISLAND_TREES = 3;
const MAX_ISLAND_TREES = 26;

export const STATUS_LABEL: Record<Status, string> = {
  geplant: 'In Planung',
  aktion: 'Schulaktionstag erfolgt',
  gepflanzt: 'Gepflanzt',
};

export const FILTERS: ReadonlyArray<{ value: 'alle' | Status; label: string }> = [
  { value: 'alle', label: 'Alle' },
  { value: 'geplant', label: 'In Planung' },
  { value: 'aktion', label: 'Schulaktionstag' },
  { value: 'gepflanzt', label: 'Gepflanzt' },
];

// Eine Zeile der Sparkassen-Tabelle. Reihenfolge der Liste = Zeilenreihenfolge der Tabelle.
export interface Eintrag {
  sparkasse: string;
  kommune: string;
  schulaktionstag?: string;
  pflanztag?: string;
  baeumeGepflanzt: number;
  kinder: number;
}

export interface Kennzahlen {
  gepflanzt: number;
  kinder: number;
  sparkassenGesamt: number;
  sparkassenAktiv: number;
  schulaktionstage: number;
  kommunenTeilgenommen: number;
}

export type TerminArt = 'schulaktionstag' | 'pflanztag';

export interface Kandidat {
  datum: unknown;
  kommune: unknown;
}

export interface Termin {
  datum: string;
  kommunen: string[];
}

const ISO_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

export function istDatum(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATUM.exec(value);
  if (!match) return false;
  const [, jahr, monat, tag] = match.map(Number);
  const datum = new Date(Date.UTC(jahr, monat - 1, tag));
  return datum.getUTCFullYear() === jahr && datum.getUTCMonth() === monat - 1 && datum.getUTCDate() === tag;
}

// ISO-Daten lassen sich als Text vergleichen.
function erreicht(datum: unknown, heute: string): boolean {
  return istDatum(datum) && istDatum(heute) && datum <= heute;
}

// Ohne gültiges Datum bleibt es bei "geplant", damit nie ein Fortschritt behauptet wird.
export function statusAm(eintrag: Eintrag, heute: string): Status {
  if (erreicht(eintrag.pflanztag, heute)) return 'gepflanzt';
  if (erreicht(eintrag.schulaktionstag, heute)) return 'aktion';
  return 'geplant';
}

const UNSICHTBAR = /[\u200B-\u200D\u2060\uFEFF]/g;

// Bereinigt Schreibweisen aus Excel: Unicode-Varianten, unsichtbare Zeichen, mehrfache Leerzeichen.
export function bereinigt(text: string): string {
  return text.normalize('NFKC').replace(UNSICHTBAR, '').replace(/\s+/g, ' ').trim();
}

export function normalisiert(text: string): string {
  return bereinigt(text).toLocaleLowerCase('de');
}

// Zahlen und Status beziehen sich auf den Tabellenstand, auch wenn später neu gebaut wird.
export function stichtag(heute: string, stand: string): string {
  return istDatum(stand) && stand < heute ? stand : heute;
}

function anzahl(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function eindeutig(texte: readonly string[]): number {
  return new Set(texte.map(normalisiert).filter(Boolean)).size;
}

export function kennzahlen(liste: readonly Eintrag[], heute: string): Kennzahlen {
  const mitStatus = liste.map((e) => ({ e, status: statusAm(e, heute) }));
  const aktiv = mitStatus.filter((x) => x.status !== 'geplant').map((x) => x.e);
  const gepflanzt = mitStatus.filter((x) => x.status === 'gepflanzt').map((x) => x.e);
  return {
    gepflanzt: gepflanzt.reduce((sum, e) => sum + anzahl(e.baeumeGepflanzt), 0),
    kinder: aktiv.reduce((sum, e) => sum + anzahl(e.kinder), 0),
    sparkassenGesamt: eindeutig(liste.map((e) => e.sparkasse)),
    sparkassenAktiv: eindeutig(aktiv.map((e) => e.sparkasse)),
    schulaktionstage: liste.filter((e) => erreicht(e.schulaktionstag, heute)).length,
    kommunenTeilgenommen: eindeutig(aktiv.map((e) => e.kommune)),
  };
}

export function terminKandidaten(liste: readonly Eintrag[], art: TerminArt): { datum: string; kommune: string }[] {
  return liste.flatMap((e) => {
    const datum = e[art];
    return istDatum(datum) ? [{ datum, kommune: e.kommune }] : [];
  });
}

// Liest die Kandidaten, die der Build ins HTML schreibt; alles Unerwartete wird verworfen.
export function parseKandidaten(json: string | undefined): Kandidat[] | null {
  if (json === undefined) return null;
  let roh: unknown;
  try {
    roh = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(roh)) return null;
  return roh.filter((k): k is Kandidat => typeof k === 'object' && k !== null && !Array.isArray(k));
}

// Heute zählt noch als "nächster" Termin. Mehrere Termine am selben Tag nennen alle Kommunen.
export function naechsterTermin(kandidaten: readonly Kandidat[], heute: string): Termin | null {
  if (!istDatum(heute)) return null;
  let naechster: Termin | null = null;
  for (const { datum, kommune } of kandidaten) {
    if (!istDatum(datum) || datum < heute || typeof kommune !== 'string' || !kommune.trim()) continue;
    if (!naechster || datum < naechster.datum) naechster = { datum, kommunen: [kommune] };
    else if (datum === naechster.datum && !naechster.kommunen.includes(kommune)) naechster.kommunen.push(kommune);
  }
  return naechster;
}

const ZEITZONE = 'Europe/Berlin';
const teileInBerlin = new Intl.DateTimeFormat('en-GB', { timeZone: ZEITZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const deutschLang = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const aufzaehlung = new Intl.ListFormat('de-DE', { type: 'conjunction' });

export function heuteIso(jetzt: Date): string {
  const teile = Object.fromEntries(teileInBerlin.formatToParts(jetzt).map((t) => [t.type, t.value]));
  return `${teile.year}-${teile.month}-${teile.day}`;
}

export function datumLang(iso: string): string {
  return istDatum(iso) ? deutschLang.format(new Date(`${iso}T00:00:00Z`)) : '';
}

export function terminText(termin: Termin): string {
  return `${aufzaehlung.format(termin.kommunen)} · ${datumLang(termin.datum)}`;
}

function clampPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

// Abrunden, damit der Balken erst beim Erreichen des Ziels voll ist.
export function fortschrittProzent(gepflanzt: number): number {
  return Math.floor(clampPercent((gepflanzt / TREE_GOAL) * 100));
}

export function treesForProgress(progress: number): number {
  return Math.round(MIN_ISLAND_TREES + ((MAX_ISLAND_TREES - MIN_ISLAND_TREES) * clampPercent(progress)) / 100);
}
