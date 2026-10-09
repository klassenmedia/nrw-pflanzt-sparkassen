import test from 'node:test';
import assert from 'node:assert/strict';
import { dekodieren, fuerVeroeffentlichung, leseTabelle, parseCsv, pruefeDaten, TabellenFehler } from '../src/lib/tabelle.ts';

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
  assert.equal(daten.baeumeZugesagt, 0);
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
  const gut = {
    stand: STAND,
    beispiel: false,
    baeumeZugesagt: 1,
    eintraege: [{ sparkasse: 'A', kommune: 'B', schulaktionstag: '2026-09-01', pflanztag: '2026-09-20', baeumeGepflanzt: 1, kinder: 2 }],
  };
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
  const roh = {
    stand: STAND,
    beispiel: false,
    baeumeZugesagt: 1,
    eintraege: [{ sparkasse: 'A', kommune: 'B', schulaktionstag: '2026-09-01', pflanztag: '2026-09-20', baeumeGepflanzt: 1, kinder: 2, fremd: '<x>' }],
  };
  assert.deepEqual(pruefeDaten(roh).eintraege[0], {
    sparkasse: 'A',
    kommune: 'B',
    schulaktionstag: '2026-09-01',
    pflanztag: '2026-09-20',
    baeumeGepflanzt: 1,
    kinder: 2,
  });
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

// Kopfzeile von Guidos Export am 07.10.2026 (gekürzt um die Spalten, die der Import nicht nutzt).
const KOPF_0710 =
  'Kommune;Sparkasse;Anzahl Bäume Sparkasse;Kommune angemeldet;Schulaktionstag;Schulaktionstag geplant;Sparkasse zu Schulaktionstag eingeladen;Pflanztag;Pflanztag geplant;Sparkasse zu Pflanztag eingeladen;Anzahl Schüler;;';

test('Export vom 07.10.: Spalten "Anzahl Bäume Sparkasse" und "Anzahl Schüler" werden erkannt', () => {
  const text = [
    KOPF_0710,
    'Musterstadt;Musterhausen;321;ja;13.10.2026;ja;ja;24.11.2026;nein;nein;70;;',
    'Ahaus;*-;;ja;06.10.2026;ja;*-;;nein;*-;*-;;',
    ';;999;;;;;;;;456;;',
  ].join('\r\n');
  const { daten, warnungen } = leseTabelle(text, STAND);
  assert.deepEqual(daten.eintraege, [
    {
      sparkasse: 'Sparkasse Musterhausen',
      kommune: 'Musterstadt',
      schulaktionstag: '2026-10-13',
      pflanztag: '2026-11-24',
      baeumeGepflanzt: 321,
      kinder: 70,
    },
  ]);
  assert.equal(warnungen.filter((w) => /Spalte .* fehlt/.test(w)).length, 0);
});

test('"*-" in Zahlenspalten heißt "trifft nicht zu" und zählt als 0', () => {
  const { daten } = leseTabelle([KOPF_0710, 'Beispieldorf;Sparkasse Beispiel;*-;ja;;;;;;;*-;;'].join('\n'), STAND);
  assert.equal(daten.eintraege[0].baeumeGepflanzt, 0);
  assert.equal(daten.eintraege[0].kinder, 0);
});

test('Mehrere Pflanztage in einer Zelle: der früheste zählt', () => {
  const { daten, warnungen } = leseTabelle(
    [KOPF_0710, 'Waldheim;Waldheim;;ja;16.09.2026;ja;ja;"12.01.2027\n13.01.2027";nein;nein;90;;'].join('\n'),
    STAND,
  );
  assert.equal(daten.eintraege[0].pflanztag, '2027-01-12');
  assert.ok(warnungen.some((w) => w.includes('Waldheim') && /2 Termine/.test(w)), 'Mehrere Termine müssen gemeldet werden');
});

test('Sparkassennamen bekommen "Sparkasse" vorangestellt, wenn das Wort fehlt', () => {
  const zeilen = ['Aachen', 'Kreissparkasse Köln', 'Niederrheinische Sparkasse RheinLippe', 'Stadtsparkasse Düsseldorf', 'Rhein-Maas'].map(
    (sk, i) => `Ort ${i};${sk};;ja;;;;;;;;;`,
  );
  const { daten } = leseTabelle([KOPF_0710, ...zeilen].join('\n'), STAND);
  assert.deepEqual(
    daten.eintraege.map((e) => e.sparkasse),
    ['Sparkasse Aachen', 'Kreissparkasse Köln', 'Niederrheinische Sparkasse RheinLippe', 'Stadtsparkasse Düsseldorf', 'Sparkasse Rhein-Maas'],
  );
});

test('Allgemeine Spalte "Anzahl Bäume" bleibt weiter unberücksichtigt', () => {
  const kopf = KOPF_0710.replace('Anzahl Bäume Sparkasse', 'Anzahl Bäume');
  const { daten } = leseTabelle([kopf, 'Lindenau;KSK Musterkreis;222;ja;18.06.2026;ja;nein;08.12.2026;nein;ja;70;;'].join('\n'), STAND);
  assert.equal(daten.eintraege[0].baeumeGepflanzt, 0);
});

test('Mehrere Termine: Reihenfolge und Trenner egal, Hinweis immer', () => {
  for (const zelle of ['"03.12.2026\n01.10.2026"', '01.10.2026, 03.12.2026', '01.10.2026 und 03.12.2026', '03.12.2026 01.10.2026']) {
    const { daten, warnungen } = leseTabelle([KOPF_0710, `Neuss;Neuss;;ja;;;;${zelle};nein;nein;;;`].join('\n'), STAND);
    assert.equal(daten.eintraege[0].pflanztag, '2026-10-01', zelle);
    assert.ok(warnungen.some((w) => /2 Termine/.test(w)), zelle);
  }
  const { daten, warnungen } = leseTabelle([KOPF_0710, 'Neustadt;Neustadt;;ja;;;;und;nein;nein;;;'].join('\n'), STAND);
  assert.equal(daten.eintraege[0].pflanztag, undefined);
  assert.ok(warnungen.some((w) => w.includes('„und“')));
});

test('Termine vor Projektbeginn sind Tippfehler und werden nicht übernommen', () => {
  const { daten, warnungen } = leseTabelle([KOPF_0710, 'Birkenau;Birkenau;1234;ja;06.07.2026;ja;ja;03.12.2025;nein;nein;80;;'].join('\n'), STAND);
  assert.equal(daten.eintraege[0].pflanztag, undefined);
  assert.ok(warnungen.some((w) => w.includes('03.12.2025') && /vor Projektbeginn/.test(w)));
});

test('"*-" nur genau so; "5-" oder "*-5" stoppen den Import', () => {
  for (const zahl of ['5-', '*-5', '-5']) {
    assert.throws(() => leseTabelle([KOPF_0710, `Neuss;Neuss;${zahl};ja;;;;;;;;;`].join('\n'), STAND), TabellenFehler, zahl);
  }
});

test('Spaltennamen in ae/ue-Schreibweise werden erkannt', () => {
  const kopf = KOPF_0710.replace('Anzahl Bäume Sparkasse', 'Anzahl Baeume Sparkasse').replace('Anzahl Schüler', 'Anzahl Schueler');
  const { daten } = leseTabelle([kopf, 'Neustadt;Neustadt;12;ja;;;;;;;34;;'].join('\n'), STAND);
  assert.equal(daten.eintraege[0].baeumeGepflanzt, 12);
  assert.equal(daten.eintraege[0].kinder, 34);
});

test('Summenzeile mit Beschriftung wird nicht als Sparkasse gezählt', () => {
  const { daten, warnungen } = leseTabelle(
    [KOPF_0710, 'Neustadt;Neustadt;12;ja;;;;;;;34;;', 'Summe;Gesamt;12;ja;;;;;;;34;;', 'Waldheim gesamt;Waldheim;12;ja;;;;;;;34;;', 'Zwischensumme;Waldheim;12;ja;;;;;;;34;;'].join('\n'),
    STAND,
  );
  assert.deepEqual(daten.eintraege.map((e) => e.kommune), ['Neustadt']);
  assert.ok(warnungen.some((w) => w.includes('Summe')));
});

test('Übersprungene Kommunen werden namentlich genannt', () => {
  const { warnungen } = leseTabelle([KOPF_0710, 'Ahaus;*-;;ja;06.10.2026;;;;;;;;', 'Neustadt;Neustadt;;ja;;;;;;;;;'].join('\n'), STAND);
  assert.ok(warnungen.some((w) => w.includes('Ahaus')));
});

test('Hinweis, welche Zeilen zum Stand als gepflanzt zählen', () => {
  const { warnungen } = leseTabelle([KOPF_0710, 'Eichendorf;KSK Musterkreis;1234;ja;25.03.2026;;;20.09.2026;;;40;;'].join('\n'), STAND);
  assert.ok(warnungen.some((w) => w.includes('Eichendorf') && w.includes('1.234') && /gepflanzt/.test(w)));
});

test('Alle Zeilen mit Sparkasse werden übernommen, auch nicht angemeldete (Guido/Dieter, 09.10.2026)', () => {
  const { daten } = leseTabelle(
    [
      KOPF_0710,
      'Lindenau;Kreissparkasse Musterkreis;222;ja;18.06.2026;;;08.12.2026;;;70;;',
      'Nordheim;Nordheim;;nein;;;;;;;;;',
      'Südheim;Südheim;;;;;;;;;;;',
    ].join('\n'),
    STAND,
  );
  assert.deepEqual(daten.eintraege.map((e) => e.kommune), ['Lindenau', 'Nordheim', 'Südheim']);
});

test('Ohne Spalte "Kommune angemeldet" läuft der Import trotzdem', () => {
  const kopf = KOPF_0710.replace('Kommune angemeldet', 'Irgendwas');
  const { daten } = leseTabelle([kopf, 'Lindenau;KSK Musterkreis;;ja;;;;;;;;;'].join('\n'), STAND);
  assert.equal(daten.eintraege.length, 1);
});

test('Veröffentlicht wird nur, was die Seite zum Stand zeigt', () => {
  const daten = {
    stand: STAND,
    beispiel: false,
    baeumeZugesagt: 2110,
    eintraege: [
      { sparkasse: 'A', kommune: 'Eichendorf', schulaktionstag: '2026-03-25', pflanztag: '2026-09-20', baeumeGepflanzt: 1234, kinder: 40 },
      { sparkasse: 'B', kommune: 'Waldheim', schulaktionstag: '2026-09-15', pflanztag: '2027-01-20', baeumeGepflanzt: 555, kinder: 90 },
      { sparkasse: 'C', kommune: 'Musterstadt', schulaktionstag: '2026-10-13', pflanztag: '2026-11-24', baeumeGepflanzt: 321, kinder: 70 },
    ],
  };
  const oeffentlich = fuerVeroeffentlichung(daten);
  assert.deepEqual(oeffentlich.eintraege.map((e) => [e.baeumeGepflanzt, e.kinder]), [[1234, 40], [0, 90], [0, 0]]);
  assert.equal(oeffentlich.eintraege[2].pflanztag, '2026-11-24', 'Termine bleiben für die Anzeige erhalten');
  assert.equal(daten.eintraege[1].baeumeGepflanzt, 555, 'Eingabe bleibt unverändert');
});

test('Build-Prüfung lehnt Zahlen ab, die zum Stand noch nicht öffentlich sein dürfen', () => {
  const basis = { sparkasse: 'A', kommune: 'B', schulaktionstag: '2026-10-13', pflanztag: '2026-11-24' };
  for (const e of [{ ...basis, baeumeGepflanzt: 321, kinder: 0 }, { ...basis, baeumeGepflanzt: 0, kinder: 70 }]) {
    assert.throws(() => pruefeDaten({ stand: STAND, beispiel: false, baeumeZugesagt: 0, eintraege: [e] }), /noch nicht/, JSON.stringify(e));
  }
  assert.doesNotThrow(() => pruefeDaten({ stand: STAND, beispiel: false, baeumeZugesagt: 0, eintraege: [{ ...basis, baeumeGepflanzt: 0, kinder: 0 }] }));
});

test('Veröffentlichung: Pflanztag erreicht, aber kein Schulaktionstag → Kinder 0', () => {
  const oeffentlich = fuerVeroeffentlichung({
    stand: STAND,
    beispiel: false,
    baeumeZugesagt: 0,
    eintraege: [{ sparkasse: 'A', kommune: 'B', pflanztag: '2026-09-20', baeumeGepflanzt: 10, kinder: 30 }],
  });
  assert.deepEqual([oeffentlich.eintraege[0].baeumeGepflanzt, oeffentlich.eintraege[0].kinder], [10, 0]);
});

test('Projektbeginn: 01.01.2026 gilt, ein früheres Datum in der Zelle nicht', () => {
  const ok = leseTabelle([KOPF_0710, 'Neustadt;Neustadt;;ja;01.01.2026;;;;;;;;'].join('\n'), STAND);
  assert.equal(ok.daten.eintraege[0].schulaktionstag, '2026-01-01');
  const gemischt = leseTabelle([KOPF_0710, 'Neustadt;Neustadt;;ja;;;;31.12.2025 und 12.01.2027;;;;;'].join('\n'), STAND);
  assert.equal(gemischt.daten.eintraege[0].pflanztag, undefined);
  assert.ok(gemischt.warnungen.some((w) => /vor Projektbeginn/.test(w)));
});

test('Steuerzeichen und überlange Namen erscheinen nicht roh in den Hinweisen', () => {
  const { warnungen } = leseTabelle(
    [KOPF_0710, `Nord\u001b[31mheim${'x'.repeat(60)};*-;;ja;;;;;;;;;`, 'Waldheim;Waldheim;;ja;;;;;;;;;'].join('\n'),
    STAND,
  );
  const hinweis = warnungen.find((w) => w.includes('ohne Sparkasse')) ?? '';
  assert.doesNotMatch(hinweis, /\p{Cc}/u);
  assert.ok(hinweis.length < 120, hinweis);
});

test('Summe der zugesagten Bäume: alle Zeilen mit Sparkasse, eigene Rechnung statt Summenzeile', () => {
  const { daten } = leseTabelle(
    [
      KOPF_0710,
      'Musterstadt;Musterhausen;321;ja;13.10.2026;;;24.11.2026;;;70;;',
      'Lindenau;KSK Musterkreis;222;ja;18.06.2026;;;08.12.2026;;;70;;',
      'Nordheim;Nordheim;999;nein;;;;;;;;;',
      'Beispieldorf;*-;888;ja;;;;;;;;;',
      ';;9999;;;;;;;;;;',
    ].join('\n'),
    STAND,
  );
  assert.equal(daten.baeumeZugesagt, 1542);
});

test('Veröffentlichung behält nur die Summe, nicht die Zusage je Sparkasse', () => {
  const oeffentlich = fuerVeroeffentlichung({
    stand: STAND,
    beispiel: false,
    baeumeZugesagt: 543,
    eintraege: [{ sparkasse: 'A', kommune: 'B', schulaktionstag: '2026-10-13', pflanztag: '2026-11-24', baeumeGepflanzt: 321, kinder: 70 }],
  });
  assert.equal(oeffentlich.baeumeZugesagt, 543);
  assert.equal(oeffentlich.eintraege[0].baeumeGepflanzt, 0);
});

test('Build-Prüfung: Summe der Zusagen ist Pflicht, ganzzahlig und nie kleiner als das Gepflanzte', () => {
  const gepflanzt = { sparkasse: 'A', kommune: 'B', schulaktionstag: '2026-09-01', pflanztag: '2026-09-20', baeumeGepflanzt: 100, kinder: 0 };
  const basis = { stand: STAND, beispiel: false, eintraege: [gepflanzt] };
  assert.doesNotThrow(() => pruefeDaten({ ...basis, baeumeZugesagt: 100 }));
  for (const zugesagt of [undefined, -1, 1.5, '100', 99, 2_000_000]) {
    assert.throws(() => pruefeDaten({ ...basis, baeumeZugesagt: zugesagt }), TabellenFehler, String(zugesagt));
  }
});

test('Build-Prüfung gibt die Summe der Zusagen unverändert weiter und lehnt -0 ab', () => {
  const basis = {
    stand: STAND,
    beispiel: false,
    eintraege: [{ sparkasse: 'A', kommune: 'B', schulaktionstag: '2026-09-01', pflanztag: '2026-09-20', baeumeGepflanzt: 1, kinder: 0 }],
  };
  assert.equal(pruefeDaten({ ...basis, baeumeZugesagt: 5 }).baeumeZugesagt, 5);
  assert.throws(() => pruefeDaten({ ...basis, eintraege: [], baeumeZugesagt: -0 }), TabellenFehler);
});
