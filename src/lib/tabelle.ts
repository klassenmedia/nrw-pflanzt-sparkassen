import { TREE_GOAL, bereinigt, erreicht, istDatum, normalisiert, statusAm, type Eintrag } from './kennzahlen.ts';

// Liest Guidos Sparkassen-Tabelle (CSV-Export aus Excel) und prüft die Daten, bevor sie auf die Seite kommen.

export interface Datenstand {
  stand: string;
  beispiel: boolean;
  // Summe der Bäume, die die Sparkassen zugesagt haben. Öffentlich nur als Summe, nie je Sparkasse.
  baeumeZugesagt: number;
  eintraege: Eintrag[];
}

export class TabellenFehler extends Error {
  override name = 'TabellenFehler';
}

// Grobe Plausibilitätsgrenzen pro Zeile; mehr ist sicher ein Tippfehler.
const MAX_BAEUME_PRO_ZEILE = TREE_GOAL;
const MAX_KINDER_PRO_ZEILE = 20_000;
const MAX_ZEILEN = 500;
const MAX_BAEUME_GESAMT = 1_000_000;
const MAX_NAMENSLAENGE = 120;

const SPALTEN = {
  kommune: ['kommune'],
  // Optional: nur für den Hinweis beim Import, nicht als Sperre.
  angemeldet: ['kommune angemeldet'],
  schulaktionstag: ['schulaktionstag'],
  pflanztag: ['pflanztag', '1. pflanztag'],
  sparkasse: ['sparkasse', 'name der sparkasse'],
  // Nur eindeutige Namen. "Anzahl Bäume Sparkasse" ist ein Sollwert je Sparkasse: Er zählt als gepflanzt,
  // sobald der Pflanztag erreicht ist. Das Datum ist die einzige Sperre, darum meldet der Import jede solche Zeile.
  baeume: ['gepflanzte bäume', 'bäume gepflanzt', 'gepflanzte baeume', 'anzahl bäume sparkasse', 'anzahl baeume sparkasse'],
  kinder: ['kinder und jugendliche', 'kinder und jugendliche dabei', 'anzahl schüler', 'anzahl schueler'],
} as const;

type Spalte = keyof typeof SPALTEN;
const PFLICHT: readonly Spalte[] = ['kommune', 'schulaktionstag', 'pflanztag', 'sparkasse'];
const SPALTEN_NAME: Record<Spalte, string> = {
  kommune: 'Kommune',
  angemeldet: 'Kommune angemeldet',
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
// Frühere Daten sind Tippfehler (z. B. 2025 statt 2026) und würden sonst sofort als erledigt zählen.
const FRUEHESTES_DATUM = '2026-01-01';
const ZAHL_DE = new Intl.NumberFormat('de-DE');

function deutsch(iso: string): string {
  const [jahr, monat, tag] = iso.split('-');
  return `${tag}.${monat}.${jahr}`;
}

function isoAus(teil: string): string {
  const match = DEUTSCHES_DATUM.exec(teil);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

// Mehrere Termine in einer Zelle (z. B. zwei Pflanztage in Krefeld): der früheste zählt.
function datumAus(zelle: string, ort: string, warnungen: string[]): string | undefined {
  const text = zelle.trim();
  if (!text || NOCH_OFFEN.test(text)) return undefined;
  const daten = text.split(/\s*(?:\n|,|;|\bund\b)\s*|\s+/).filter(Boolean).map(isoAus);
  if (!daten.length || !daten.every(istDatum)) {
    warnungen.push(`${ort}: „${text.replace(/\s+/g, ' ')}“ ist kein Datum, wird ignoriert.`);
    return undefined;
  }
  const fruehestes = [...daten].sort()[0];
  if (fruehestes < FRUEHESTES_DATUM) {
    warnungen.push(`${ort}: „${deutsch(fruehestes)}“ liegt vor Projektbeginn, wird ignoriert.`);
    return undefined;
  }
  if (daten.length > 1) warnungen.push(`${ort}: ${daten.length} Termine, nehme den frühesten (${deutsch(fruehestes)}).`);
  return fruehestes;
}

const GANZZAHL = /^\d{1,3}(\.\d{3})*$|^\d+$/;
// Guidos Zeichen für "trifft nicht zu".
const NICHT_ZUTREFFEND = /^\*?-$/;

function zahlAus(zelle: string, max: number, ort: string): number {
  const text = zelle.trim();
  if (!text || NICHT_ZUTREFFEND.test(text)) return 0;
  if (!GANZZAHL.test(text)) throw new TabellenFehler(`${ort}: „${text}“ ist keine ganze Zahl.`);
  const wert = Number(text.replaceAll('.', ''));
  if (wert > max) throw new TabellenFehler(`${ort}: ${wert} ist unplausibel hoch (höchstens ${max}).`);
  return wert;
}

// Auch Zeichen, die die Leserichtung umdrehen (Bidi), damit kein Name auf der Seite anders aussieht, als er ist.
const STEUERZEICHEN = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu;
const FORMEL_ODER_STEUERZEICHEN = /^[=+\-@]|[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;
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

// In der Tabelle steht oft nur der Ort ("Aachen"); auf der Seite soll "Sparkasse Aachen" stehen.
function mitSparkasse(name: string): string {
  return /sparkasse/i.test(name) ? name : `Sparkasse ${name}`;
}

function eintragAus(werte: readonly string[], index: Partial<Record<Spalte, number>>, nr: number, warnungen: string[]): Eintrag {
  const zelle = (spalte: Spalte) => (index[spalte] === undefined ? '' : (werte[index[spalte]] ?? ''));
  const kommune = nameAus(zelle('kommune'), `Zeile ${nr}, Kommune`);
  if (!kommune) throw new TabellenFehler(`Zeile ${nr}: Sparkasse ohne Kommune.`);
  const ort = `Zeile ${nr} (${kommune})`;
  const eintrag: Eintrag = {
    sparkasse: mitSparkasse(nameAus(zelle('sparkasse'), `${ort}, Sparkasse`)),
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

const SUMMENZEILE = /(^|[\s(])(summe|summen|zwischensumme|gesamt|total)($|[\s):])/i;
const MAX_HINWEIS_NAME = 40;

// Namen aus übersprungenen Zeilen laufen nicht durch nameAus; fürs Terminal entschärfen und kürzen.
function hinweisName(text: string): string {
  const sauber = bereinigt(text).replace(STEUERZEICHEN, '');
  return sauber.length > MAX_HINWEIS_NAME ? `${sauber.slice(0, MAX_HINWEIS_NAME)}…` : sauber;
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
  const ohneSparkasse: string[] = [];
  const nichtAngemeldet: string[] = [];
  for (const { werte, nr } of mitInhalt) {
    const kommune = bereinigt(werte[index.kommune!] ?? '');
    const sparkasse = bereinigt(werte[index.sparkasse!] ?? '');
    if (SUMMENZEILE.test(kommune) || SUMMENZEILE.test(sparkasse)) {
      warnungen.push(`Zeile ${nr}: Summenzeile („${hinweisName(kommune || sparkasse)}“) übersprungen.`);
    } else if (!hatSparkasse(sparkasse)) {
      ohneSparkasse.push(hinweisName(kommune) || `Zeile ${nr}`);
    } else {
      // Auch nicht angemeldete Kommunen erscheinen als „In Planung“ (Guido und Dieter, 09.10.2026).
      // Der Hinweis nennt die Sparkassen-Zelle, damit eine Notiz dort vor dem Hochladen auffällt.
      if (index.angemeldet !== undefined && normalisiert(werte[index.angemeldet] ?? '') !== 'ja') {
        nichtAngemeldet.push(`${hinweisName(kommune) || `Zeile ${nr}`} (${hinweisName(mitSparkasse(sparkasse))})`);
      }
      eintraege.push(eintragAus(werte, index, nr, warnungen));
    }
  }
  if (ohneSparkasse.length) {
    const anzahl = ohneSparkasse.length;
    warnungen.push(`${anzahl} ${anzahl === 1 ? 'Zeile' : 'Zeilen'} ohne Sparkasse übersprungen: ${ohneSparkasse.join(', ')}.`);
  }
  if (nichtAngemeldet.length) {
    warnungen.push(`${nichtAngemeldet.length} nicht angemeldet, als „In Planung“ veröffentlicht: ${nichtAngemeldet.join(', ')}.`);
  }
  for (const e of eintraege) {
    if (e.baeumeGepflanzt > 0 && statusAm(e, stand) === 'gepflanzt') {
      warnungen.push(`${e.kommune}: zählt ${ZAHL_DE.format(e.baeumeGepflanzt)} Bäume als gepflanzt (Pflanztag ${deutsch(e.pflanztag!)}).`);
    }
  }
  if (!eintraege.length) throw new TabellenFehler('Die Tabelle enthält keine Zeile mit eingetragener Sparkasse.');
  pruefeDubletten(eintraege);
  // Eigene Summe statt Guidos Summenzeile: zählt nur übernommene Zeilen mit Sparkasse.
  const baeumeZugesagt = eintraege.reduce((summe, e) => summe + e.baeumeGepflanzt, 0);
  return { daten: { stand, beispiel: false, baeumeZugesagt, eintraege }, warnungen };
}

// Die Datei liegt in einem öffentlichen Repo: Bäume erst ab Pflanztag, Kinder erst ab Schulaktionstag.
// Die Seite rechnet mit dem Tabellenstand, darum ändert das an der Anzeige nichts.
export function fuerVeroeffentlichung(daten: Datenstand): Datenstand {
  return {
    ...daten,
    eintraege: daten.eintraege.map((e) => ({
      ...e,
      baeumeGepflanzt: statusAm(e, daten.stand) === 'gepflanzt' ? e.baeumeGepflanzt : 0,
      kinder: erreicht(e.schulaktionstag, daten.stand) ? e.kinder : 0,
    })),
  };
}

function istZahl(value: unknown, max: number): value is number {
  return Number.isInteger(value) && !Object.is(value, -0) && (value as number) >= 0 && (value as number) <= max;
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
  if (!istZahl(d.baeumeZugesagt, MAX_BAEUME_GESAMT)) {
    throw new TabellenFehler('Sparkassen-Daten: Summe der zugesagten Bäume fehlt oder ist ungültig.');
  }
  const zugesagt = d.baeumeZugesagt;
  const eintraege = d.eintraege.map((e, i) => pruefeEintrag(e, i + 1));
  const stand = d.stand;
  // Schutz für das öffentliche Repo, auch wenn die Datei von Hand geändert wurde.
  eintraege.forEach((e, i) => {
    if (e.baeumeGepflanzt > 0 && statusAm(e, stand) !== 'gepflanzt') {
      throw new TabellenFehler(`Eintrag ${i + 1}: Bäume vor dem Pflanztag sind noch nicht öffentlich.`);
    }
    if (e.kinder > 0 && !erreicht(e.schulaktionstag, stand)) {
      throw new TabellenFehler(`Eintrag ${i + 1}: Kinder vor dem Schulaktionstag sind noch nicht öffentlich.`);
    }
  });
  pruefeDubletten(eintraege);
  const gepflanzt = eintraege.reduce((summe, e) => summe + e.baeumeGepflanzt, 0);
  if (gepflanzt > zugesagt) throw new TabellenFehler('Sparkassen-Daten: mehr Bäume gepflanzt als zugesagt.');
  return { stand: d.stand, beispiel: d.beispiel, baeumeZugesagt: zugesagt, eintraege };
}
