import test from 'node:test';
import assert from 'node:assert/strict';
import { SPARKASSEN_RHEINLAND, gruppiereKacheln, sparkasseNachName } from '../src/lib/sparkassenliste.ts';
import { leseTabelle } from '../src/lib/tabelle.ts';

test('Die Liste hat 27 Sparkassen im Rheinland, alphabetisch nach Ort, ohne Doppelte', () => {
  assert.equal(SPARKASSEN_RHEINLAND.length, 27);
  assert.equal(new Set(SPARKASSEN_RHEINLAND.map((s) => s.name)).size, 27);
  assert.equal(SPARKASSEN_RHEINLAND[0].name, 'Sparkasse Aachen');
  assert.equal(SPARKASSEN_RHEINLAND[26].name, 'Stadtsparkasse Wuppertal');
});

test('Schreibweisen aus der Tabelle führen zur selben Sparkasse', () => {
  for (const [roh, name] of [
    ['Aachen', 'Sparkasse Aachen'],
    ['Sparkasse Aachen', 'Sparkasse Aachen'],
    ['  sparkasse   aachen ', 'Sparkasse Aachen'],
    ['Düsseldorf', 'Stadtsparkasse Düsseldorf'],
    ['Kreissparkasse Düsseldorf', 'Kreissparkasse Düsseldorf'],
    ['Kreissparkasse Köln', 'Kreissparkasse Köln'],
    ['Mönchengladbach', 'Stadtsparkasse Mönchengladbach'],
    ['Sparkasse am Niederrhein', 'Sparkasse am Niederrhein'],
    ['Niederrheinische Sparkasse RheinLippe', 'Niederrheinische Sparkasse RheinLippe'],
    ['Solingen', 'Stadt-Sparkasse Solingen'],
  ] as const) {
    assert.equal(sparkasseNachName(roh)?.name, name, roh);
  }
});

test('Sparkassen aus anderen Regionalverbänden sind nicht in der Liste', () => {
  for (const roh of ['Borken', 'Sparkasse Borken', 'Kaiserstuhl', 'Sparkasse Münsterland Ost', '*-', '']) {
    assert.equal(sparkasseNachName(roh), undefined, roh);
  }
});

const zeile = (sparkasse: string, kommune: string) => ({ sparkasse, kommune });

test('Kacheln: nach Sparkasse sortiert, eine Nummer je Sparkasse, Orte alphabetisch', () => {
  const kacheln = gruppiereKacheln([zeile('Sparkasse Krefeld', 'Viersen'), zeile('Sparkasse Aachen', 'Herzogenrath'), zeile('Sparkasse Krefeld', 'Kempen'), zeile('Sparkasse Aachen', 'Aachen')]);
  const aachen = kacheln.filter((k) => k.sparkasse === 'Sparkasse Aachen');
  const krefeld = kacheln.filter((k) => k.sparkasse === 'Sparkasse Krefeld');
  assert.deepEqual(aachen.map((k) => [k.nr, k.eintrag?.kommune]), [[1, 'Aachen'], [1, 'Herzogenrath']]);
  assert.deepEqual(krefeld.map((k) => [k.nr, k.eintrag?.kommune]), [[14, 'Kempen'], [14, 'Viersen']]);
});

test('Kacheln: Sparkassen ohne Zeile bekommen eine eigene Kachel, alle 27 Nummern kommen vor', () => {
  const kacheln = gruppiereKacheln([zeile('Sparkasse Aachen', 'Aachen')]);
  assert.deepEqual([...new Set(kacheln.map((k) => k.nr))], Array.from({ length: 27 }, (_, i) => i + 1));
  const duren = kacheln.find((k) => k.sparkasse === 'Sparkasse Düren');
  assert.equal(duren?.eintrag, undefined);
  assert.equal(kacheln.filter((k) => k.nr === 3).length, 1);
});

test('Kacheln: Reihenfolge folgt der Liste, Nummern steigen nie', () => {
  const kacheln = gruppiereKacheln([zeile('Stadtsparkasse Wuppertal', 'Wuppertal'), zeile('Sparkasse Aachen', 'Aachen'), zeile('Sparkasse Essen', 'Essen')]);
  const nummern = kacheln.map((k) => k.nr);
  assert.deepEqual(nummern, [...nummern].sort((a, b) => a - b));
});

test('Kacheln: unbekannte Sparkasse bricht ab, damit nichts Fremdes auf die Seite kommt', () => {
  assert.throws(() => gruppiereKacheln([zeile('Sparkasse Borken', 'Borken')]), /Borken/);
});

const KOPF = 'Kommune;Sparkasse;Anzahl Bäume Sparkasse;Kommune angemeldet;Schulaktionstag;Pflanztag;Anzahl Schüler';

test('Import mit Liste: Namen werden vereinheitlicht, fremde Sparkassen übersprungen und gemeldet', () => {
  const text = [KOPF, 'Aachen;Aachen;;ja;;;', 'Düsseldorf;Düsseldorf;;ja;;;', 'Borken;Sparkasse Borken;;ja;;;', 'Kempen;Krefeld;;ja;;;'].join('\n');
  const { daten, warnungen } = leseTabelle(text, '2026-11-10', { sparkasse: (zelle) => sparkasseNachName(zelle)?.name });
  assert.deepEqual(daten.eintraege.map((e) => e.sparkasse), ['Sparkasse Aachen', 'Stadtsparkasse Düsseldorf', 'Sparkasse Krefeld']);
  assert.ok(warnungen.some((w) => /Borken/.test(w) && /Liste/.test(w)), warnungen.join('\n'));
});

test('Import ohne Liste bleibt wie bisher (beliebige Namen)', () => {
  const { daten } = leseTabelle([KOPF, 'Lindenau;KSK Musterkreis;;ja;;;'].join('\n'), '2026-11-10');
  assert.equal(daten.eintraege[0].sparkasse, 'Sparkasse KSK Musterkreis');
});
