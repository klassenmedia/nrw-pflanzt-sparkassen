import test from 'node:test';
import assert from 'node:assert/strict';
import { GALERIE, fremdeDateien, galerieBilder } from '../src/lib/galerie.ts';

const bild = (name: string) => ({ src: `/x/${name}`, width: 960, height: 720 });

test('Galerie folgt der festen Reihenfolge, fehlende Dateien fallen weg', () => {
  const vorhanden = {
    '../assets/galerie/b.webp': bild('b'),
    '../assets/galerie/a.webp': bild('a'),
  };
  const liste = [
    { datei: 'a.webp', sparkasse: true, alt: 'A' },
    { datei: 'fehlt.webp', sparkasse: true, alt: 'F' },
    { datei: 'b.webp', sparkasse: true, alt: 'B' },
  ];
  assert.deepEqual(
    galerieBilder(vorhanden, liste).map((e) => e.alt),
    ['A', 'B'],
  );
});

test('Galerie zeigt nur Bilder aus der Liste, nie zufällig abgelegte Dateien', () => {
  const vorhanden = { '../assets/galerie/a.webp': bild('a'), '../assets/galerie/privat.webp': bild('privat') };
  assert.deepEqual(galerieBilder(vorhanden, [{ datei: 'a.webp', sparkasse: true, alt: 'A' }]).map((e) => e.bild.src), ['/x/a']);
});

test('Ohne Bilder bleibt die Galerie leer (z. B. frischer Checkout ohne Fotos)', () => {
  assert.deepEqual(galerieBilder({}), []);
});

test('Jedes Galeriebild hat einen Alternativtext und kommt nur einmal vor', () => {
  assert.ok(GALERIE.length > 0);
  for (const e of GALERIE) assert.ok(e.alt.trim().length > 10, e.datei);
  assert.equal(new Set(GALERIE.map((e) => e.datei)).size, GALERIE.length);
});

test('Liste mit leerem Alternativtext wird abgelehnt', () => {
  assert.throws(() => galerieBilder({ '../assets/galerie/a.webp': bild('a') }, [{ datei: 'a.webp', sparkasse: true, alt: ' ' }]), /Alternativtext/);
});

test('Nicht gelistete Fotos im Ordner werden gemeldet, damit der Build abbricht', () => {
  const liste = [{ datei: 'a.webp', sparkasse: true, alt: 'A' }];
  assert.deepEqual(fremdeDateien(['../assets/galerie/a.webp', '../assets/galerie/privat.webp'], liste), ['privat.webp']);
  assert.deepEqual(fremdeDateien(['../assets/galerie/a.webp'], liste), []);
});

test('Sparkassen-Fotos sind verteilt: nie zwei Bilder ohne Sparkasse hintereinander, auch nicht am Übergang zum Anfang', () => {
  const s = GALERIE.map((e) => e.sparkasse);
  s.forEach((mit, i) => assert.ok(mit || s[(i + 1) % s.length], `${GALERIE[i].datei} und ${GALERIE[(i + 1) % s.length].datei} ohne Sparkasse`));
});
