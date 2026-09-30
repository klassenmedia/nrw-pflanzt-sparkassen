import test from 'node:test';
import assert from 'node:assert/strict';
import { dekodieren, leseTabelle, parseCsv, pruefeDaten, TabellenFehler } from '../src/lib/tabelle.ts';

// Kopfzeile wie in Guidos Export (30.09.2026), ergänzt um die drei beschlossenen Spalten.
const KOPF_HEUTE =
  'Kommune;Kommune angemeldet;Pflanzfläche ;Schule angemeldet ;Schulakquise abgeschlossen;Onboarding-Termin;Schulen mit Unterlagen versorgt;Unternehmensadressliste an die Schulen rausgegeben;Schulaktionstag;Pflanztag;2. Pflanztag;Sparkassenvertreter zu den Aktionstagen eingeladen;;';
const KOPF_NEU = `${KOPF_HEUTE.replace(/;;$/, '')};Sparkasse;Gepflanzte Bäume;Kinder und Jugendliche`;

const zeile = (kommune: string, schul: string, pflanz: string, sparkasse: string, baeume = '', kinder = '') =>
  `${kommune};ja;ja;ja;ja;;;;${schul};${pflanz};;;${sparkasse};${baeume};${kinder}`;

const csv = (...zeilen: string[]) => [KOPF_NEU, ...zeilen].join('\r\n') + '\r\n';
const STAND = '2026-09-30';

test('Latin-1 aus Excel und UTF-8 werden beide richtig gelesen', () => {
  const text = 'Mönchengladbach;Tönisvorst;Rösrath';
  assert.equal(dekodieren(Buffer.from(text, 'latin1')), text);
  assert.equal(dekodieren(Buffer.from(text, 'utf8')), text);
  assert.equal(dekodieren(Buffer.from(`﻿${text}`, 'utf8')), text);
});

test('CSV-Parser: Semikolon, Anführungszeichen, CRLF', () => {
  assert.deepEqual(parseCsv('a;"b;c";"d ""x"""\r\n1;2;3\r\n'), [
    ['a', 'b;c', 'd "x"'],
    ['1', '2', '3'],
  ]);
});

test('Nur Zeilen mit Sparkasse werden Kacheln, Reihenfolge bleibt', () => {
  const { daten, warnungen } = leseTabelle(
    csv(
      zeile('Ahaus', '06.10.2026', '', ''),
      zeile('Bergneustadt', '13.10.2026', '24.11.2026', 'Sparkasse der Homburgischen Gemeinden', '', ''),
      zeile('Krefeld', '16.09.2026', '12.01.2027', 'Sparkasse Krefeld', '0', '140'),
    ),
    STAND,
  );
  assert.deepEqual(
    daten.eintraege.map((e) => e.kommune),
    ['Bergneustadt', 'Krefeld'],
  );
  assert.equal(daten.stand, STAND);
  assert.equal(daten.beispiel, false);
  assert.deepEqual(daten.eintraege[1], {
    sparkasse: 'Sparkasse Krefeld',
    kommune: 'Krefeld',
    schulaktionstag: '2026-09-16',
    pflanztag: '2027-01-12',
    baeumeGepflanzt: 0,
    kinder: 140,
  });
  assert.ok(warnungen.some((w) => w.includes('1 Zeile ohne Sparkasse')));
});

test('"terminieren" heißt noch kein Datum, andere Texte werden gemeldet', () => {
  const { daten, warnungen } = leseTabelle(
    csv(zeile('Burscheid', 'terminieren ', '', 'Sparkasse A'), zeile('Erftstadt', 'termnieren', 'bald', 'Sparkasse B')),
    STAND,
  );
  assert.equal(daten.eintraege[0].schulaktionstag, undefined);
  assert.equal(daten.eintraege[1].pflanztag, undefined);
  assert.equal(warnungen.filter((w) => w.includes('terminieren')).length, 0);
  assert.ok(warnungen.some((w) => w.includes('Erftstadt') && w.includes('bald')));
});

test('Tausenderpunkt und leere Zellen bei Zahlen', () => {
  const { daten } = leseTabelle(csv(zeile('Lohmar', '18.06.2026', '08.12.2026', 'KSK Köln', '1.500', '')), STAND);
  assert.equal(daten.eintraege[0].baeumeGepflanzt, 1500);
  assert.equal(daten.eintraege[0].kinder, 0);
});

test('Heutiger Export ohne Sparkassen-Spalte bricht mit klarer Meldung ab', () => {
  const heute = [KOPF_HEUTE, 'Ahaus;ja;ja;ja;ja;14.09.2026;ja;nein;06.10.2026;;;;;'].join('\r\n');
  assert.throws(() => leseTabelle(heute, STAND), (e: unknown) => e instanceof TabellenFehler && /Sparkasse/.test(e.message));
});

test('Fehlende Spalten für Bäume und Kinder: Warnung und 0', () => {
  const kopf = `${KOPF_HEUTE.replace(/;;$/, '')};Sparkasse`;
  const text = [kopf, 'Krefeld;ja;ja;ja;ja;;;;16.09.2026;12.01.2027;;;Sparkasse Krefeld'].join('\n');
  const { daten, warnungen } = leseTabelle(text, STAND);
  assert.equal(daten.eintraege[0].baeumeGepflanzt, 0);
  assert.ok(warnungen.some((w) => w.includes('Bäume')));
  assert.ok(warnungen.some((w) => w.includes('Kinder')));
});

test('Böswillige oder kaputte Zahlen stoppen den Import mit Zeilennummer', () => {
  for (const [baeume, kinder] of [
    ['-5', ''],
    ['abc', ''],
    ['1e308', ''],
    ['50001', ''],
    ['12,5', ''],
    ['', '20001'],
  ]) {
    assert.throws(
      () => leseTabelle(csv(zeile('Xanten', '15.09.2026', '', 'Sparkasse X', baeume, kinder)), STAND),
      (e: unknown) => e instanceof TabellenFehler && /Zeile 2/.test(e.message),
      `${baeume}|${kinder}`,
    );
  }
});

test('Doppelte Zeile Sparkasse plus Kommune stoppt den Import', () => {
  assert.throws(
    () => leseTabelle(csv(zeile('Kempen', '', '', 'Sparkasse K'), zeile(' kempen ', '', '', 'sparkasse  k')), STAND),
    (e: unknown) => e instanceof TabellenFehler && /doppelt/i.test(e.message),
  );
});

test('Sparkasse ohne Kommune stoppt den Import', () => {
  assert.throws(() => leseTabelle(csv(zeile('', '', '', 'Sparkasse K')), STAND), TabellenFehler);
});

test('Unmögliches Datum wird gemeldet und nicht übernommen', () => {
  const { daten, warnungen } = leseTabelle(csv(zeile('Neuss', '31.02.2026', '', 'Sparkasse N')), STAND);
  assert.equal(daten.eintraege[0].schulaktionstag, undefined);
  assert.ok(warnungen.some((w) => w.includes('31.02.2026')));
});

test('Datenprüfung beim Build lehnt manipulierte Datei ab', () => {
  const gut = { stand: STAND, beispiel: false, eintraege: [{ sparkasse: 'A', kommune: 'B', baeumeGepflanzt: 1, kinder: 2 }] };
  assert.deepEqual(pruefeDaten(gut), gut);
  const kaputt: unknown[] = [
    null,
    { ...gut, stand: 'gestern' },
    { ...gut, beispiel: 'ja' },
    { ...gut, eintraege: 'x' },
    { ...gut, eintraege: [{ ...gut.eintraege[0], baeumeGepflanzt: -1 }] },
    { ...gut, eintraege: [{ ...gut.eintraege[0], kinder: 1.5 }] },
    { ...gut, eintraege: [{ ...gut.eintraege[0], pflanztag: '24.11.2026' }] },
    { ...gut, eintraege: [{ ...gut.eintraege[0], kommune: 7 }] },
    { ...gut, eintraege: [gut.eintraege[0], { ...gut.eintraege[0], kommune: ' b ' }] },
  ];
  for (const roh of kaputt) assert.throws(() => pruefeDaten(roh), TabellenFehler, JSON.stringify(roh));
});

test('Offenes oder verirrtes Anführungszeichen stoppt den Import', () => {
  assert.throws(() => parseCsv('a;"b\n1;2\n'), TabellenFehler);
  assert.throws(() => parseCsv('a;b"c;d\n'), TabellenFehler);
  assert.throws(() => leseTabelle(csv(`"${zeile('Ahaus', '', '', 'Sparkasse A')}`, zeile('Borken', '', '', 'Sparkasse B')), STAND), TabellenFehler);
});

test('CSV-Parser: verdoppelte Anführungszeichen und leeres letztes Feld', () => {
  assert.deepEqual(parseCsv('"x""";a;\n'), [['x"', 'a', '']]);
});

test('Import ohne Sparkassen-Zeilen stoppt, statt die Seite zu leeren', () => {
  assert.throws(() => leseTabelle(`${KOPF_NEU}\r\n`, STAND), (e: unknown) => e instanceof TabellenFehler && /keine/i.test(e.message));
  assert.throws(() => leseTabelle(csv(zeile('Ahaus', '06.10.2026', '', '')), STAND), TabellenFehler);
});

test('Mehrdeutige oder doppelte Kopfspalten stoppen den Import', () => {
  const zweimalBaeume = `${KOPF_NEU};Gepflanzte Bäume`;
  assert.throws(() => leseTabelle(`${zweimalBaeume}\n${zeile('Krefeld', '', '', 'SK')};5000`, STAND), /mehrfach/);
  const zweimalKommune = `Kommune;${KOPF_NEU}`;
  assert.throws(() => leseTabelle(`${zweimalKommune}\nX;${zeile('Krefeld', '', '', 'SK')}`, STAND), /mehrfach/);
});

test('Allgemeine Spalten wie "Anzahl Bäume" oder "Kinder" zählen nicht als gepflanzt', () => {
  const kopf = `${KOPF_HEUTE.replace(/;;$/, '')};Sparkasse;Anzahl Bäume;Kinder`;
  const { daten } = leseTabelle(`${kopf}\nKrefeld;ja;ja;ja;ja;;;;16.09.2026;20.09.2026;;;SK;5000;900`, STAND);
  assert.equal(daten.eintraege[0].baeumeGepflanzt, 0);
  assert.equal(daten.eintraege[0].kinder, 0);
});

test('Pflichtspalten Schulaktionstag und Pflanztag werden verlangt', () => {
  const ohnePflanztag = KOPF_NEU.replace(';Pflanztag;', ';Irgendwas;');
  assert.throws(() => leseTabelle(`${ohnePflanztag}\n${zeile('K', '', '', 'SK')}`, STAND), /Pflanztag/);
  const ohneSchul = KOPF_NEU.replace(';Schulaktionstag;', ';Irgendwas;');
  assert.throws(() => leseTabelle(`${ohneSchul}\n${zeile('K', '', '', 'SK')}`, STAND), /Schulaktionstag/);
});

test('Nur "terminieren" gilt als offen, ein versteckter Termin wird gemeldet', () => {
  const { daten, warnungen } = leseTabelle(csv(zeile('Kempen', 'Termin: 12.10.2026', 'Terminieren', 'SK')), STAND);
  assert.equal(daten.eintraege[0].schulaktionstag, undefined);
  assert.ok(warnungen.some((w) => w.includes('Termin: 12.10.2026')));
  assert.equal(warnungen.filter((w) => w.includes('Terminieren')).length, 0);
});

test('Pflanztag vor Schulaktionstag wird gemeldet', () => {
  const { warnungen } = leseTabelle(csv(zeile('Neuss', '20.11.2026', '01.10.2026', 'SK')), STAND);
  assert.ok(warnungen.some((w) => w.includes('Neuss') && /vor dem Schulaktionstag/.test(w)));
});

test('Punkt als Tausendertrenner nur in Dreiergruppen', () => {
  assert.throws(() => leseTabelle(csv(zeile('X', '', '', 'SK', '1.5')), STAND), TabellenFehler);
  assert.throws(() => leseTabelle(csv(zeile('X', '', '', 'SK', '1.50')), STAND), TabellenFehler);
});

test('Namen: unsichtbare Zeichen raus, Formel-Präfixe und Überlänge stoppen', () => {
  const { daten } = leseTabelle(csv(zeile('Kem​pen', '', '', ' Sparkasse K ')), STAND);
  assert.equal(daten.eintraege[0].kommune, 'Kempen');
  assert.equal(daten.eintraege[0].sparkasse, 'Sparkasse K');
  for (const boese of ['=HYPERLINK("x")', '+cmd|x', '@SUM(1)', '-2+3', 'A'.repeat(121)]) {
    assert.throws(() => leseTabelle(csv(zeile(boese, '', '', 'SK')), STAND), TabellenFehler, boese);
  }
});

test('Zu viele Zeilen stoppen den Import', () => {
  const viele = Array.from({ length: 501 }, (_, i) => zeile(`Ort ${i}`, '', '', 'SK'));
  assert.throws(() => leseTabelle(csv(...viele), STAND), /Zeilen/);
});

test('Datenprüfung kopiert nur bekannte Felder und prüft Grenzen', () => {
  const roh = { stand: STAND, beispiel: false, eintraege: [{ sparkasse: 'A', kommune: 'B', baeumeGepflanzt: 1, kinder: 2, fremd: '<x>' }] };
  assert.deepEqual(pruefeDaten(roh).eintraege[0], { sparkasse: 'A', kommune: 'B', baeumeGepflanzt: 1, kinder: 2 });
  const basis = roh.eintraege[0];
  for (const kaputt of [
    { ...basis, baeumeGepflanzt: 50_001 },
    { ...basis, kommune: '  ' },
    { ...basis, schulaktionstag: '06.10.2026' },
  ]) {
    assert.throws(() => pruefeDaten({ ...roh, eintraege: [kaputt] }), TabellenFehler);
  }
});

test('Platzhalter in der Sparkassen-Spalte gelten als "ohne Sparkasse"', () => {
  const { daten, warnungen } = leseTabelle(
    csv(
      ...['keine', 'nein', 'k.A.', '?', '-', '–', '—', 'n/a', '123'].map((p, i) => zeile(`Ort ${i}`, '', '', p)),
      zeile('Krefeld', '', '', 'Sparkasse Krefeld'),
    ),
    STAND,
  );
  assert.deepEqual(daten.eintraege.map((e) => e.kommune), ['Krefeld']);
  assert.ok(warnungen.some((w) => w.includes('9 Zeilen ohne Sparkasse')));
});

test('Text direkt nach schließendem Anführungszeichen und Steuerzeichen stoppen den Import', () => {
  assert.throws(() => parseCsv('"a"b;c\n'), TabellenFehler);
  assert.throws(() => leseTabelle(csv(zeile('Kem\x1bpen', '', '', 'SK')), STAND), TabellenFehler);
});
