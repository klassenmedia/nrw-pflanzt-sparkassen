import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filterTags, fortschrittProzent, heuteIso, kachelText, kennzahlen, stichtag, zaehlerLabel } from '../src/lib/kennzahlen.ts';
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
  const roh = JSON.parse(readFileSync(join(WURZEL, 'src/data/sparkassen.json'), 'utf8'));
  const daten = pruefeDaten(roh);
  const stand = stichtag(heuteIso(new Date()), daten.stand);
  const k = kennzahlen(daten.eintraege, stand);
  const fmt = new Intl.NumberFormat('de-DE');
  // Zusagen kommen roh aus der Datei, damit ein Fehler in pruefeDaten hier auffällt.
  const zugesagt = fmt.format(roh.baeumeZugesagt);
  const ziel = fmt.format(50_000);
  const label = zaehlerLabel(k.gepflanzt);
  const davon = k.gepflanzt > 0 ? `, davon ${fmt.format(k.gepflanzt)} gepflanzt` : '';
  const erwartet = [
    `${label}</span>`,
    `>${zugesagt} von ${ziel}<`,
    `data-count="${roh.baeumeZugesagt}">${zugesagt}<`,
    `${zugesagt} von ${ziel} Bäumen bereit zur Pflanzung${davon}"`,
    `aria-valuenow="${fortschrittProzent(roh.baeumeZugesagt)}"`,
    `--sk-progress:${fortschrittProzent(roh.baeumeZugesagt)}%`,
    `${fmt.format(k.sparkassenProjekte)}</span><span>Sparkassen-Projekte`,
    `${fmt.format(k.kommunenDabei)}</span><span>Städte und Gemeinden dabei`,
    `${fmt.format(k.kinder)}</span><span>Kinder und Jugendliche dabei`,
    ...daten.eintraege.map((e) => `<span class="sk-tile__status">${kachelText(e, stand).termin}</span>`),
    ...daten.eintraege.map((e) => `data-filter-tags="${filterTags(e, stand).join(' ')}"`),
    ...daten.eintraege.map((e) => kachelText(e, stand).baeume).filter(Boolean).map((t) => `<span class="sk-tile__baeume">${t}</span>`),
  ];
  if (k.pflanztageGeplant > 0) erwartet.push(`${k.pflanztageGeplant} ${k.pflanztageGeplant === 1 ? 'Pflanztag' : 'Pflanztage'} geplant`);
  else assert.doesNotMatch(live, /Pflanztage? geplant/);
  for (const text of erwartet) assert.ok(live.includes(text), text);
  // Eine Kachel pro Zeile der Tabelle; „davon gepflanzt“ erst, wenn etwas gepflanzt ist.
  assert.equal([...live.matchAll(/<li class="sk-tile"/g)].length, daten.eintraege.length);
  assert.equal(live.includes('davon gepflanzt'), k.gepflanzt > 0);
  assert.equal([...live.matchAll(/<li class="sk-step"/g)].length, 3);
  // „Gepflanzt“ und „zugesagt“ stehen nie als Beschriftung der Hauptzahl.
  assert.doesNotMatch(live, /Gepflanzte Bäume|Bäume zugesagt|Bäumen zugesagt/);
  assert.doesNotMatch(live, /noindex/);
  // Keine Platzhalter oder internen Notizen auf der Live-Seite.
  const sichtbarerText = live.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const muster of [/\[(Zitat|Name|Vorname|Funktion|Schule|Kommune|Datum|Anzahl|Ort|x)\b/i, /Platz für/i, /abgleichen/i, /Beispieldaten/i, /Partnerschild/i, /Jeder Fortschritt erscheint/i]) {
    assert.doesNotMatch(sichtbarerText, muster, `Live-Seite enthält ${muster}`);
  }
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
