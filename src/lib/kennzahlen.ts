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

// Schulaktionstag und Pflanztag zeigen jede Kachel mit eingetragenem Termin, vergangen oder geplant (Andreas, 09.10.2026).
export type FilterWert = 'alle' | 'geplant' | 'schulaktionstag' | 'pflanztag';
export const FILTERS: ReadonlyArray<{ value: FilterWert; label: string }> = [
  { value: 'alle', label: 'Alle' },
  { value: 'geplant', label: 'In Planung' },
  { value: 'schulaktionstag', label: 'Schulaktionstag' },
  { value: 'pflanztag', label: 'Pflanztag' },
];

// Was die Kachel zeigt, hängt am Filter: nächster Schritt oder die Angaben zum gewählten Termin.
export const ANSICHTEN = ['standard', 'schulaktionstag', 'pflanztag'] as const;
export type Ansicht = (typeof ANSICHTEN)[number];

const ANSICHT_NAME: Record<Ansicht, string> = { standard: 'den nächsten Schritt', schulaktionstag: 'den Schulaktionstag', pflanztag: 'den Pflanztag' };

// Für Screenreader: Der Filter ändert auch den Text der Kacheln, das soll angesagt werden.
export function filterAnsage(treffer: number, gesamt: number, ansicht: Ansicht): string {
  return `${treffer} von ${gesamt} Sparkassen hervorgehoben, Kacheln zeigen ${ANSICHT_NAME[ansicht]}`;
}

export function ansichtFuer(filter: string): Ansicht {
  return filter === 'schulaktionstag' || filter === 'pflanztag' ? filter : 'standard';
}

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
  // Jede Zeile ist eine Sparkasse in einer Stadt; eine Sparkasse kann mehrere haben.
  sparkassenProjekte: number;
  sparkassenAktiv: number;
  schulaktionstage: number;
  schulaktionstageGeplant: number;
  pflanztageGeplant: number;
  kommunenTeilgenommen: number;
  kommunenDabei: number;
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
export function erreicht(datum: unknown, heute: string): boolean {
  return istDatum(datum) && istDatum(heute) && datum <= heute;
}

function geplant(datum: unknown, heute: string): boolean {
  return istDatum(datum) && istDatum(heute) && datum > heute;
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

// Eine Zeile wie „Schwalmtal/Brüggen/Niederkrüchten“ steht für mehrere Gemeinden.
function gemeinden(kommunen: readonly string[]): string[] {
  return kommunen.flatMap((k) => k.split('/'));
}

export function kennzahlen(liste: readonly Eintrag[], heute: string): Kennzahlen {
  const mitStatus = liste.map((e) => ({ e, status: statusAm(e, heute) }));
  const aktiv = mitStatus.filter((x) => x.status !== 'geplant').map((x) => x.e);
  const gepflanzt = mitStatus.filter((x) => x.status === 'gepflanzt').map((x) => x.e);
  return {
    gepflanzt: gepflanzt.reduce((sum, e) => sum + anzahl(e.baeumeGepflanzt), 0),
    kinder: liste.filter((e) => erreicht(e.schulaktionstag, heute)).reduce((sum, e) => sum + anzahl(e.kinder), 0),
    sparkassenGesamt: eindeutig(liste.map((e) => e.sparkasse)),
    sparkassenProjekte: liste.length,
    sparkassenAktiv: eindeutig(aktiv.map((e) => e.sparkasse)),
    schulaktionstage: liste.filter((e) => erreicht(e.schulaktionstag, heute)).length,
    schulaktionstageGeplant: liste.filter((e) => geplant(e.schulaktionstag, heute)).length,
    pflanztageGeplant: liste.filter((e) => geplant(e.pflanztag, heute)).length,
    kommunenTeilgenommen: eindeutig(gemeinden(aktiv.map((e) => e.kommune))),
    kommunenDabei: eindeutig(gemeinden(liste.map((e) => e.kommune))),
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
const ZAHL = new Intl.NumberFormat('de-DE');

export function heuteIso(jetzt: Date): string {
  const teile = Object.fromEntries(teileInBerlin.formatToParts(jetzt).map((t) => [t.type, t.value]));
  return `${teile.year}-${teile.month}-${teile.day}`;
}

export function datumLang(iso: string): string {
  return istDatum(iso) ? deutschLang.format(new Date(`${iso}T00:00:00Z`)) : '';
}

export function filterTags(eintrag: Eintrag, heute: string): string[] {
  const tags: string[] = [statusAm(eintrag, heute)];
  if (istDatum(eintrag.schulaktionstag)) tags.push('schulaktionstag');
  if (istDatum(eintrag.pflanztag)) tags.push('pflanztag');
  return tags;
}

// Gleiche Regel wie im Browser-Skript: nur ganze Tags, „alle“ trifft immer.
export function filterTrifft(tags: string | undefined, filter: string): boolean {
  if (filter === 'alle') return true;
  return filter !== '' && (tags ?? '').split(' ').includes(filter);
}

export interface KachelText {
  termin: string;
  // Zweite Zeile: Bäume oder Kinder, leer wenn nichts Öffentliches da ist.
  zusatz: string;
}

// Bäume der Sparkasse stehen auf der Kachel, sobald ein Pflanztag eingetragen ist (Andreas, 09.10.2026).
function baeumeText(eintrag: Eintrag, heute: string): string {
  const baeume = anzahl(eintrag.baeumeGepflanzt);
  if (baeume === 0 || !istDatum(eintrag.pflanztag)) return '';
  const text = `${ZAHL.format(baeume)} ${baeume === 1 ? 'Baum' : 'Bäume'}`;
  return erreicht(eintrag.pflanztag, heute) ? text : `${text} geplant`;
}

// Text unter der Sparkasse auf der Kachel: der nächste Schritt mit Datum, nach dem Pflanztag das Ergebnis.
export function kachelText(eintrag: Eintrag, heute: string): KachelText {
  return { termin: terminZeile(eintrag, heute), zusatz: baeumeText(eintrag, heute) };
}

function kinderText(eintrag: Eintrag, heute: string): string {
  const kinder = anzahl(eintrag.kinder);
  if (kinder === 0 || !erreicht(eintrag.schulaktionstag, heute)) return '';
  return kinder === 1 ? '1 Kind' : `${ZAHL.format(kinder)} Kinder und Jugendliche`;
}

export function kachelAnsicht(eintrag: Eintrag, heute: string, ansicht: Ansicht): KachelText {
  const { schulaktionstag, pflanztag } = eintrag;
  if (ansicht === 'schulaktionstag') {
    if (!istDatum(schulaktionstag)) return { termin: 'Schulaktionstag noch offen', zusatz: '' };
    const termin = erreicht(schulaktionstag, heute) ? `Schulaktionstag war am ${datumLang(schulaktionstag)}` : `Schulaktionstag am ${datumLang(schulaktionstag)}`;
    return { termin, zusatz: kinderText(eintrag, heute) };
  }
  if (ansicht === 'pflanztag') {
    if (!istDatum(pflanztag)) return { termin: 'Pflanztag noch offen', zusatz: '' };
    const termin = erreicht(pflanztag, heute) ? `Gepflanzt am ${datumLang(pflanztag)}` : `Pflanztag am ${datumLang(pflanztag)}`;
    return { termin, zusatz: baeumeText(eintrag, heute) };
  }
  return kachelText(eintrag, heute);
}

function terminZeile(eintrag: Eintrag, heute: string): string {
  const { schulaktionstag, pflanztag } = eintrag;
  if (erreicht(pflanztag, heute)) return `Gepflanzt am ${datumLang(pflanztag!)}`;
  const kommende = [
    { art: 'Schulaktionstag', datum: schulaktionstag },
    { art: 'Pflanztag', datum: pflanztag },
  ].filter((t): t is { art: string; datum: string } => geplant(t.datum, heute));
  // Bei vertauschten Terminen in der Tabelle zählt der frühere.
  const naechster = kommende.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0))[0];
  return naechster ? `${naechster.art} am ${datumLang(naechster.datum)}` : STATUS_LABEL[statusAm(eintrag, heute)];
}

// Kinder, deren Schulaktionstag noch aussteht; die Summe kommt aus der Tabelle, je Zeile sind sie bis dahin nicht öffentlich.
export function kinderGeplant(kinderGesamt: number, kinderDabei: number): number {
  return Math.max(0, kinderGesamt - kinderDabei);
}

// Übergangsbegriff bis zum ersten Pflanztag (Guido, 09.10.2026); danach ohne „ab November“.
export function zaehlerLabel(gepflanzt: number): string {
  return gepflanzt > 0 ? 'Bereit zur Pflanzung' : 'Bereit zur Pflanzung ab November';
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
