import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { heuteIso, kennzahlen, stichtag } from '../src/lib/kennzahlen.ts';
import { pruefeDaten } from '../src/lib/tabelle.ts';

const WURZEL = new URL('..', import.meta.url).pathname;

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    return statSync(pfad).isDirectory() ? dateien(pfad) : [pfad];
  });
}

// Wächter: Daten gelangen nur als Text auf die Seite, nie als HTML.
// Ausnahme Icon.astro: setzt nur fest eingebaute SVG-Pfade, der Name ist ein fester Typ.
const HTML_ERLAUBT = new Set([join(WURZEL, 'src/components/Icon.astro')]);

test('Quellcode fügt nirgends HTML aus Variablen ein', () => {
  const verboten = /set:html|innerHTML|outerHTML|insertAdjacentHTML|document\.write/;
  const treffer = dateien(join(WURZEL, 'src')).filter(
    (d) => /\.(astro|ts)$/.test(d) && !HTML_ERLAUBT.has(d) && verboten.test(readFileSync(d, 'utf8')),
  );
  assert.deepEqual(treffer, []);
});

function baue(env: Record<string, string>): { html: string; css: string } {
  const ziel = mkdtempSync(join(tmpdir(), 'sk-build-'));
  const lauf = spawnSync('npx', ['astro', 'build', '--outDir', ziel], { cwd: WURZEL, env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(lauf.status, 0, lauf.stderr);
  // Vite baut trotz fehlender Bilddatei weiter und warnt nur; hier soll das auffallen.
  assert.doesNotMatch(`${lauf.stdout}${lauf.stderr}`, /didn't resolve at build time/, 'Fehlender Pfad im CSS');
  const html = readFileSync(join(ziel, 'index.html'), 'utf8');
  const css = dateien(ziel)
    .filter((d) => d.endsWith('.css'))
    .map((d) => readFileSync(d, 'utf8'))
    .join('\n');
  rmSync(ziel, { recursive: true, force: true });
  return { html, css };
}

test('Entwurf ist noindex, Live-Build nicht; kein Inline-Skript', { timeout: 120_000 }, () => {
  const { PUBLIC_ENTWURF: _entfernt, ...ohneEntwurf } = process.env;
  process.env = ohneEntwurf;
  const entwurf = baue({}).html;
  const { html: live, css } = baue({ PUBLIC_ENTWURF: 'false' });
  assert.match(entwurf, /<meta name="robots" content="noindex"/);
  // Die Seite zeigt genau die Zahlen, die die Logik aus der Datendatei berechnet.
  const daten = pruefeDaten(JSON.parse(readFileSync(join(WURZEL, 'src/data/sparkassen.json'), 'utf8')));
  const k = kennzahlen(daten.eintraege, stichtag(heuteIso(new Date()), daten.stand));
  const fmt = new Intl.NumberFormat('de-DE');
  for (const zahl of [`${k.sparkassenAktiv} / ${k.sparkassenGesamt}`, `>${fmt.format(k.gepflanzt)}<`, `>${fmt.format(k.kinder)}<`]) {
    assert.ok(live.includes(zahl), zahl);
  }
  assert.doesNotMatch(live, /noindex/);
  for (const html of [entwurf, live]) {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
    assert.deepEqual(inline, [], 'CSP erlaubt nur Skripte aus eigenen Dateien');
  }

  // Keine fremden Server: GitHub Pages hat keine CSP, eine externe Schrift ginge sonst an Dritte (DSGVO).
  assert.doesNotMatch(css, /@import|url\(\s*['"]?(https?:)?\/\//, 'CSS lädt nichts von fremden Servern');
  const extern = [...live.matchAll(/<(?:link|script|img|source|iframe)\b[^>]*\b(?:src|href|srcset)="(?:https?:)?\/\/[^"]*"/g)]
    .map((m) => m[0])
    .filter((tag) => !/rel="canonical"/.test(tag));
  assert.deepEqual(extern, [], 'HTML lädt nichts von fremden Servern');

  // Jede benutzte Klasse und Variable ist im CSS definiert.
  const klassen = new Set([...live.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((k) => k.startsWith('sk-')));
  const ohneRegel = [...klassen].filter((k) => !new RegExp(`\\.${k}(?![\\w-])`).test(css));
  assert.deepEqual(ohneRegel, [], 'Klassen ohne CSS-Regel');
  const inlineVars = new Set([...live.matchAll(/style="[^"]*?(--sk-[\w-]+):/g)].map((m) => m[1]));
  const genutzt = new Set([...css.matchAll(/var\((--sk-[\w-]+)/g)].map((m) => m[1]));
  const undefiniert = [...genutzt].filter((v) => !inlineVars.has(v) && !css.includes(`${v}:`));
  assert.deepEqual(undefiniert, [], 'Variablen ohne Wert');
  assert.match(css, /:focus-visible\{[^}]*outline:[^};]*solid/, 'Fokusrahmen vorhanden');
});
