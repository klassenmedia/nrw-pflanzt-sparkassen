import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTERS,
  STATUS_LABEL,
  datumLang,
  filterTags,
  fortschrittProzent,
  heuteIso,
  istDatum,
  kachelText,
  kennzahlen,
  naechsterTermin,
  parseKandidaten,
  statusAm,
  stichtag,
  terminKandidaten,
  terminText,
  treesForProgress,
  zaehlerLabel,
  type Eintrag,
} from '../src/lib/kennzahlen.ts';

const HEUTE = '2026-09-30';
const zeile = (teil: Partial<Eintrag>): Eintrag => ({
  sparkasse: 'Sparkasse Test',
  kommune: 'Testdorf',
  baeumeGepflanzt: 0,
  kinder: 0,
  ...teil,
});

test('Status folgt den Terminen: erst Schulaktionstag, dann Pflanztag', () => {
  assert.equal(statusAm(zeile({}), HEUTE), 'geplant');
  assert.equal(statusAm(zeile({ schulaktionstag: '2026-10-06' }), HEUTE), 'geplant');
  assert.equal(statusAm(zeile({ schulaktionstag: HEUTE }), HEUTE), 'aktion');
  assert.equal(statusAm(zeile({ schulaktionstag: '2026-09-16', pflanztag: '2027-01-12' }), HEUTE), 'aktion');
  assert.equal(statusAm(zeile({ schulaktionstag: '2026-09-16', pflanztag: HEUTE }), HEUTE), 'gepflanzt');
  assert.equal(statusAm(zeile({ pflanztag: '2026-09-01' }), HEUTE), 'gepflanzt');
});

test('Kaputtes Datum oder kaputtes Heute behauptet keinen Fortschritt', () => {
  assert.equal(statusAm(zeile({ pflanztag: '01.09.2026' }), HEUTE), 'geplant');
  assert.equal(statusAm(zeile({ pflanztag: '2026-09-01' }), ''), 'geplant');
  assert.equal(statusAm(zeile({ pflanztag: '2026-09-01' }), 'quatsch'), 'geplant');
});

test('Status-Texte sind die drei beschlossenen Stufen', () => {
  assert.deepEqual(STATUS_LABEL, { geplant: 'In Planung', aktion: 'Schulaktionstag erfolgt', gepflanzt: 'Gepflanzt' });
});

test('Bäume zählen nur nach dem Pflanztag, Kinder nur nach dem Schulaktionstag', () => {
  const k = kennzahlen(
    [
      zeile({ kommune: 'A', schulaktionstag: '2026-09-01', pflanztag: '2026-09-20', baeumeGepflanzt: 1500, kinder: 140 }),
      zeile({ kommune: 'B', schulaktionstag: '2026-09-15', baeumeGepflanzt: 900, kinder: 60 }),
      zeile({ kommune: 'C', schulaktionstag: '2026-10-06', baeumeGepflanzt: 800, kinder: 120 }),
    ],
    HEUTE,
  );
  assert.equal(k.gepflanzt, 1500);
  assert.equal(k.kinder, 200);
  assert.equal(k.schulaktionstage, 2);
  assert.equal(k.kommunenTeilgenommen, 2);
});

test('Sparkassen werden eindeutig gezählt, auch mit mehreren Kommunen', () => {
  const k = kennzahlen(
    [
      zeile({ sparkasse: 'Kreissparkasse Köln', kommune: 'Lohmar', schulaktionstag: '2026-06-18' }),
      zeile({ sparkasse: ' kreissparkasse  köln ', kommune: 'Pulheim' }),
      zeile({ sparkasse: 'Sparkasse Krefeld', kommune: 'Krefeld' }),
    ],
    HEUTE,
  );
  assert.equal(k.sparkassenGesamt, 2);
  assert.equal(k.sparkassenAktiv, 1);
});

test('Kommunen: Schreibweise egal, leere Namen zählen nicht', () => {
  const aktiv = { schulaktionstag: '2026-09-01' };
  const k = kennzahlen(
    [
      zeile({ ...aktiv, kommune: 'Burscheid', sparkasse: 'A' }),
      zeile({ ...aktiv, kommune: ' burscheid ', sparkasse: 'B' }),
      zeile({ ...aktiv, kommune: 'Bad  Honnef', sparkasse: 'C' }),
      zeile({ ...aktiv, kommune: 'Bad Honnef', sparkasse: 'D' }),
      zeile({ ...aktiv, kommune: '', sparkasse: 'E' }),
    ],
    HEUTE,
  );
  assert.equal(k.kommunenTeilgenommen, 2);
});

test('Kaputte Zahlen verfälschen nichts, Brüche werden abgerundet', () => {
  const gepflanzt = { schulaktionstag: '2026-09-01', pflanztag: '2026-09-20' };
  const k = kennzahlen(
    [
      zeile({ ...gepflanzt, baeumeGepflanzt: -500, kinder: Number.NaN }),
      zeile({ ...gepflanzt, baeumeGepflanzt: 10.6, kinder: Number.POSITIVE_INFINITY }),
    ],
    HEUTE,
  );
  assert.equal(k.gepflanzt, 10);
  assert.equal(k.kinder, 0);
});

test('Leere Liste ergibt überall null', () => {
  assert.deepEqual(kennzahlen([], HEUTE), {
    gepflanzt: 0,
    kinder: 0,
    sparkassenGesamt: 0,
    sparkassenProjekte: 0,
    sparkassenAktiv: 0,
    schulaktionstage: 0,
    schulaktionstageGeplant: 0,
    pflanztageGeplant: 0,
    kommunenTeilgenommen: 0,
    kommunenDabei: 0,
  });
});

test('Datumsprüfung verlangt genau JJJJ-MM-TT und echte Kalendertage', () => {
  for (const gut of ['2026-10-06', '2028-02-29', '2000-02-29']) assert.ok(istDatum(gut), gut);
  for (const schlecht of ['2026-10-06x', ' 2026-10-06', '12026-10-06', '2026-02-29', '2100-02-29', '2026-13-01', '2026-00-10', '', null, 20261006]) {
    assert.equal(istDatum(schlecht), false, String(schlecht));
  }
});

test('Nächster Termin ist der früheste ab heute, heute zählt mit', () => {
  const liste = [
    { kommune: 'Ahaus', datum: '2026-10-06' },
    { kommune: 'Vorbei', datum: '2026-09-01' },
    { kommune: 'Später', datum: '2026-11-20' },
  ];
  assert.deepEqual(naechsterTermin(liste, HEUTE), { datum: '2026-10-06', kommunen: ['Ahaus'] });
  assert.deepEqual(naechsterTermin(liste, '2026-10-06'), { datum: '2026-10-06', kommunen: ['Ahaus'] });
  assert.deepEqual(naechsterTermin(liste, '2026-10-07'), { datum: '2026-11-20', kommunen: ['Später'] });
  assert.equal(naechsterTermin(liste, '2026-12-01'), null);
});

test('Zwei Termine am selben Tag nennen beide Kommunen', () => {
  const liste = [
    { kommune: 'Kempen', datum: '2026-11-03' },
    { kommune: 'Viersen', datum: '2026-11-03' },
    { kommune: 'Kempen', datum: '2026-11-03' },
  ];
  assert.deepEqual(naechsterTermin(liste, HEUTE), { datum: '2026-11-03', kommunen: ['Kempen', 'Viersen'] });
});

test('Ungültige Kandidaten und ungültiges Heute liefern keinen Termin', () => {
  const liste = [
    { kommune: 'Kaputt', datum: '24.11.2026' },
    { kommune: 'Unmöglich', datum: '2026-02-31' },
    { kommune: 42, datum: '2026-10-01' },
    { kommune: '', datum: '2026-10-01' },
    { kommune: 'Gut', datum: '2026-12-01' },
  ];
  assert.deepEqual(naechsterTermin(liste, HEUTE), { datum: '2026-12-01', kommunen: ['Gut'] });
  assert.equal(naechsterTermin(liste, ''), null);
  assert.equal(naechsterTermin(liste, 'quatsch'), null);
});

test('Termin-Kandidaten enthalten nur gültige Daten der gewählten Art', () => {
  const liste = [
    zeile({ kommune: 'Ahaus', schulaktionstag: '2026-10-06' }),
    zeile({ kommune: 'Bergneustadt', schulaktionstag: '2026-10-13', pflanztag: '2026-11-24' }),
  ];
  assert.deepEqual(terminKandidaten(liste, 'pflanztag'), [{ datum: '2026-11-24', kommune: 'Bergneustadt' }]);
  assert.equal(terminKandidaten(liste, 'schulaktionstag').length, 2);
});

test('Termin-JSON aus dem HTML wird misstrauisch gelesen', () => {
  assert.equal(parseKandidaten('{kaputt'), null);
  assert.equal(parseKandidaten(undefined), null);
  assert.equal(parseKandidaten('{"a":1}'), null);
  assert.equal(parseKandidaten('"text"'), null);
  assert.deepEqual(parseKandidaten('[null, 3, "x", {"kommune":"A","datum":"2026-10-01"}]'), [{ kommune: 'A', datum: '2026-10-01' }]);
});

test('Termintext nennt Kommunen und ausgeschriebenes Datum', () => {
  assert.equal(terminText({ datum: '2026-10-06', kommunen: ['Ahaus'] }), 'Ahaus · 6. Oktober 2026');
  assert.equal(terminText({ datum: '2026-11-03', kommunen: ['Kempen', 'Viersen'] }), 'Kempen und Viersen · 3. November 2026');
});

test('Datum wird deutsch ausgeschrieben, ohne Verschiebung durch Zeitzonen', () => {
  assert.equal(datumLang('2026-10-06'), '6. Oktober 2026');
  assert.equal(datumLang('2026-02-31'), '');
  assert.equal(datumLang('2026-10-06x'), '');
});

test('"Heute" richtet sich nach deutscher Zeit, nicht nach UTC', () => {
  assert.equal(heuteIso(new Date('2026-09-30T21:59:00Z')), '2026-09-30');
  assert.equal(heuteIso(new Date('2026-09-30T22:30:00Z')), '2026-10-01');
  assert.equal(heuteIso(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  assert.equal(heuteIso(new Date('2026-03-29T00:30:00Z')), '2026-03-29');
});

test('Fortschritt rundet ab, voll erst beim Ziel', () => {
  assert.equal(fortschrittProzent(0), 0);
  assert.equal(fortschrittProzent(19_000), 38);
  assert.equal(fortschrittProzent(49_750), 99);
  assert.equal(fortschrittProzent(49_999), 99);
  assert.equal(fortschrittProzent(50_000), 100);
  assert.equal(fortschrittProzent(80_000), 100);
  assert.equal(fortschrittProzent(-1), 0);
  assert.equal(fortschrittProzent(Number.NaN), 0);
});

test('Bäume auf der 3D-Insel: 3 bis 26, wachsen mit dem Fortschritt', () => {
  assert.equal(treesForProgress(0), 3);
  assert.equal(treesForProgress(100), 26);
  assert.equal(treesForProgress(500), 26);
  assert.ok(treesForProgress(100) > treesForProgress(38));
});

test('Pflanztag ohne Schulaktionstag zählt nicht als Schulaktionstag', () => {
  const k = kennzahlen([zeile({ pflanztag: '2026-09-01', baeumeGepflanzt: 10 })], HEUTE);
  assert.equal(k.schulaktionstage, 0);
  assert.equal(k.sparkassenAktiv, 1);
});

test('Stichtag ist der Tabellenstand, nicht ein späteres Build-Datum', () => {
  assert.equal(stichtag('2026-12-15', '2026-09-30'), '2026-09-30');
  assert.equal(stichtag('2026-09-01', '2026-09-30'), '2026-09-01');
  const liste = [zeile({ schulaktionstag: '2026-10-06', pflanztag: '2026-11-24', baeumeGepflanzt: 500, kinder: 80 })];
  assert.equal(kennzahlen(liste, stichtag('2026-12-15', '2026-09-30')).gepflanzt, 0);
});

test('Unsichtbare Zeichen und Unicode-Varianten zählen als dieselbe Kommune', () => {
  const aktiv = { schulaktionstag: '2026-09-01' };
  const k = kennzahlen(
    [
      zeile({ ...aktiv, kommune: 'Kempen', sparkasse: 'A' }),
      zeile({ ...aktiv, kommune: 'Kem​pen', sparkasse: 'B' }),
      zeile({ ...aktiv, kommune: 'Köln', sparkasse: 'C' }),
      zeile({ ...aktiv, kommune: 'Köln', sparkasse: 'D' }),
    ],
    HEUTE,
  );
  assert.equal(k.kommunenTeilgenommen, 2);
});

test('Kinder zählen nur nach einem Schulaktionstag, nicht schon nach dem Pflanztag', () => {
  const k = kennzahlen([zeile({ pflanztag: '2026-09-01', kinder: 100 }), zeile({ kommune: 'B', schulaktionstag: '2026-09-02', kinder: 30 })], HEUTE);
  assert.equal(k.kinder, 30);
});

test('Geplante Termine: Datum nach dem Stichtag, "terminieren" ohne Datum zählt nicht', () => {
  const k = kennzahlen(
    [
      zeile({ kommune: 'A', schulaktionstag: '2026-09-16', pflanztag: '2027-01-12' }),
      zeile({ kommune: 'B', schulaktionstag: '2026-10-13', pflanztag: '2026-11-24' }),
      zeile({ kommune: 'C', pflanztag: '2026-11-18' }),
      zeile({ kommune: 'D', pflanztag: '2026-09-01' }),
      zeile({ kommune: 'E' }),
    ],
    HEUTE,
  );
  assert.equal(k.schulaktionstage, 1);
  assert.equal(k.schulaktionstageGeplant, 1);
  assert.equal(k.pflanztageGeplant, 3);
});

test('Termin genau am Stichtag ist erledigt, nicht geplant', () => {
  const k = kennzahlen([zeile({ schulaktionstag: HEUTE, pflanztag: HEUTE })], HEUTE);
  assert.equal(k.schulaktionstage, 1);
  assert.equal(k.schulaktionstageGeplant, 0);
  assert.equal(k.pflanztageGeplant, 0);
});

test('Städte und Gemeinden dabei: alle, eindeutig, ohne leere', () => {
  const k = kennzahlen(
    [zeile({ kommune: 'Kempen' }), zeile({ kommune: ' kempen ', sparkasse: 'B' }), zeile({ kommune: 'Viersen', schulaktionstag: '2026-09-01' }), zeile({ kommune: '' })],
    HEUTE,
  );
  assert.equal(k.kommunenDabei, 2);
  assert.equal(k.kommunenTeilgenommen, 1);
});

test('Eine Zeile mit mehreren Gemeinden zählt jede Gemeinde einzeln', () => {
  const k = kennzahlen(
    [zeile({ kommune: 'Schwalmtal/Brüggen/Niederkrüchten' }), zeile({ kommune: 'Brüggen', sparkasse: 'B' }), zeile({ kommune: 'Kempen' })],
    HEUTE,
  );
  assert.equal(k.kommunenDabei, 4);
});

test('Sparkassen-Projekte zählen jede Zeile, auch mehrere Städte derselben Sparkasse', () => {
  const k = kennzahlen([zeile({ kommune: 'Kempen' }), zeile({ kommune: 'Viersen' }), zeile({ kommune: 'Neuss', sparkasse: 'B' })], HEUTE);
  assert.equal(k.sparkassenProjekte, 3);
  assert.equal(k.sparkassenGesamt, 2);
});

test('Kachel nennt den nächsten Schritt mit Datum', () => {
  assert.equal(kachelText(zeile({}), HEUTE).termin, 'In Planung');
  assert.equal(kachelText(zeile({ schulaktionstag: '2026-10-13', pflanztag: '2026-11-24' }), HEUTE).termin, 'Schulaktionstag am 13. Oktober 2026');
  assert.equal(kachelText(zeile({ pflanztag: '2026-11-18' }), HEUTE).termin, 'Pflanztag am 18. November 2026');
  assert.equal(kachelText(zeile({ schulaktionstag: '2026-09-15', pflanztag: '2027-01-20' }), HEUTE).termin, 'Pflanztag am 20. Januar 2027');
  assert.equal(kachelText(zeile({ schulaktionstag: '2026-09-15' }), HEUTE).termin, 'Schulaktionstag erfolgt');
});

test('Kachel: Bäume der Sparkasse stehen darunter, sobald ein Pflanztag eingetragen ist (Andreas, 09.10.2026)', () => {
  assert.deepEqual(kachelText(zeile({ pflanztag: '2026-11-18', baeumeGepflanzt: 1234 }), HEUTE), { termin: 'Pflanztag am 18. November 2026', baeume: '1.234 Bäume geplant' });
  assert.deepEqual(kachelText(zeile({ schulaktionstag: '2026-10-13', pflanztag: '2026-11-24', baeumeGepflanzt: 1 }), HEUTE), {
    termin: 'Schulaktionstag am 13. Oktober 2026',
    baeume: '1 Baum geplant',
  });
  assert.equal(kachelText(zeile({ baeumeGepflanzt: 500 }), HEUTE).baeume, '', 'ohne Pflanztag keine Zahl');
  assert.equal(kachelText(zeile({ pflanztag: '2026-11-18' }), HEUTE).baeume, '', 'ohne Bäume keine Zeile');
});

test('Kachel nach dem Pflanztag: „Gepflanzt am …“ und darunter die Bäume', () => {
  assert.deepEqual(kachelText(zeile({ schulaktionstag: '2026-03-25', pflanztag: '2026-09-20', baeumeGepflanzt: 1234 }), HEUTE), {
    termin: 'Gepflanzt am 20. September 2026',
    baeume: '1.234 Bäume',
  });
  assert.deepEqual(kachelText(zeile({ pflanztag: '2026-09-20', baeumeGepflanzt: 1 }), HEUTE), { termin: 'Gepflanzt am 20. September 2026', baeume: '1 Baum' });
  assert.deepEqual(kachelText(zeile({ pflanztag: '2026-09-20' }), HEUTE), { termin: 'Gepflanzt am 20. September 2026', baeume: '' });
});

test('Kachel: Pflanztag genau heute gilt als gepflanzt', () => {
  assert.equal(kachelText(zeile({ pflanztag: HEUTE }), HEUTE).termin, 'Gepflanzt am 30. September 2026');
});

test('Kachel: liegt der Pflanztag vor dem Schulaktionstag, nennt sie den früheren Termin', () => {
  assert.equal(kachelText(zeile({ schulaktionstag: '2026-11-01', pflanztag: '2026-10-09' }), HEUTE).termin, 'Pflanztag am 9. Oktober 2026');
});

test('Filter: „Pflanztag“ statt „Gepflanzt“, trifft jede Kachel mit eingetragenem Pflanztag', () => {
  assert.deepEqual(FILTERS.map((f) => f.label), ['Alle', 'In Planung', 'Schulaktionstag', 'Pflanztag']);
  assert.deepEqual(filterTags(zeile({}), HEUTE), ['geplant']);
  assert.deepEqual(filterTags(zeile({ pflanztag: '2026-11-18' }), HEUTE), ['geplant', 'pflanztag']);
  assert.deepEqual(filterTags(zeile({ schulaktionstag: '2026-09-15', pflanztag: '2027-01-20' }), HEUTE), ['aktion', 'pflanztag']);
  assert.deepEqual(filterTags(zeile({ pflanztag: '2026-09-20' }), HEUTE), ['gepflanzt', 'pflanztag']);
});

test('Beschriftung der Hauptzahl wechselt mit dem ersten gepflanzten Baum', () => {
  assert.equal(zaehlerLabel(0), 'Bereit zur Pflanzung ab November');
  assert.equal(zaehlerLabel(1), 'Bereit zur Pflanzung');
});
