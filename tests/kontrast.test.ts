import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Liest die Farbwerte direkt aus dem Stylesheet, damit eine Farbänderung den Kontrast nicht still verschlechtert.
const CSS = readFileSync(new URL('../src/styles/sparkassen.css', import.meta.url), 'utf8');
const AA_TEXT = 4.5;
// Weiße Herzen mit höchstens 13 % Deckkraft hellen den Hero-Hintergrund stellenweise auf.
const HERZ_DECKKRAFT = 0.13;

function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  assert.ok(start >= 0, `Regel fehlt: ${selector}`);
  return CSS.slice(start, CSS.indexOf('\n}', start));
}

function wert(rumpf: string, name: string): string {
  const treffer = new RegExp(`${name}:\\s*([^;]+);`).exec(rumpf);
  assert.ok(treffer, `Wert fehlt: ${name}`);
  return treffer[1].trim();
}

const hell = block(':root');
const dunkel = block(":root[data-theme='dark']");
const token = (name: string, rumpf = hell) => wert(rumpf, name);

function kanal(wert: number): number {
  const s = wert / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): number[] {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `keine Hex-Farbe: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function helligkeit(hex: string): number {
  const [r, g, b] = rgb(hex).map(kanal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string): number {
  const [hi, lo] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mitWeiss(hex: string, anteil: number): string {
  return `#${rgb(hex)
    .map((c) => Math.round(c * (1 - anteil) + 255 * anteil).toString(16).padStart(2, '0'))
    .join('')}`;
}

test('Weiße Schrift auf roten Buttons und aktivem Filter', () => {
  assert.ok(kontrast('#ffffff', token('--sk-accent')) >= AA_TEXT);
  assert.ok(kontrast('#ffffff', token('--sk-accent-hover')) >= AA_TEXT);
});

test('Rote Schrift auf weißem Grund und auf der Abschnitts-Tönung', () => {
  for (const grund of ['#ffffff', token('--sk-tint')]) {
    assert.ok(kontrast(token('--sk-accent-text'), grund) >= AA_TEXT, grund);
    assert.ok(kontrast(token('--sk-ink-2'), grund) >= AA_TEXT, grund);
  }
});

test('Weißer Hero-Button: rote Schrift fest, damit sie auch im Dunkelmodus lesbar bleibt', () => {
  const regel = block('.sk-hero .sk-btn:not(.sk-btn--ghost)');
  const schrift = wert(regel, '--btn-fg');
  assert.match(schrift, /^#/, 'Schriftfarbe muss fest sein, nicht aus einer Variable');
  assert.ok(kontrast(schrift, wert(regel, '--btn-bg')) >= AA_TEXT);
});

test('Weiße Schrift im Hero bleibt auch über den Herzen lesbar', () => {
  const verlauf = token('--sk-grad-red');
  const farben = verlauf.match(/#[0-9a-f]{6}/gi) ?? [];
  assert.ok(farben.length >= 2, 'Verlauf ohne Hex-Farben');
  for (const farbe of farben) {
    assert.ok(kontrast('#ffffff', mitWeiss(farbe, HERZ_DECKKRAFT)) >= AA_TEXT, farbe);
  }
});

test('Dunkelmodus: rote Schrift auf dunklem Grund', () => {
  for (const grund of [token('--sk-bg', dunkel), token('--sk-surface', dunkel), token('--sk-tint', dunkel)]) {
    assert.ok(kontrast(token('--sk-accent-text', dunkel), grund) >= AA_TEXT, grund);
  }
});

test('Hero: Rot und Herzen liegen auf der Textspalte, Fokusrahmen dort weiß', () => {
  const textspalte = block('.sk-hero__copy');
  assert.match(textspalte, /herzmuster\.png/);
  assert.match(textspalte, /var\(--sk-grad-red\)/);
  assert.match(block('.sk-header :focus-visible,\n.sk-hero :focus-visible'), /outline-color:\s*#ffffff/);
});

test('Termin-Kärtchen über der dunklen Insel: rotes Label bleibt lesbar', () => {
  const deckkraft = Number(/rgb\(255 255 255 \/ ([\d.]+)\)/.exec(block('.sk-float'))?.[1]);
  assert.ok(deckkraft >= 0.95, 'Kärtchen muss weitgehend deckend sein');
  const flaeche = mitWeiss('#1a1414', deckkraft);
  assert.ok(kontrast(token('--sk-accent-text'), flaeche) >= AA_TEXT, flaeche);
});

test('Dunkler Zählerbereich: Zahlen und Texte lesbar auf dem hellsten Ton des Verlaufs', () => {
  const band = block('.sk-band');
  const hellsterGrund = '#3a2c2c';
  assert.ok(band.includes(hellsterGrund), 'Verlauf des Zählerbereichs geändert, Test anpassen');
  for (const name of ['--sk-ink-2', '--sk-accent-text']) {
    assert.ok(kontrast(wert(band, name), hellsterGrund) >= AA_TEXT, name);
  }
});
