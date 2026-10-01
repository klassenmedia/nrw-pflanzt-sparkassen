import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

function baue(env: Record<string, string>): string {
  const ziel = mkdtempSync(join(tmpdir(), 'sk-build-'));
  const lauf = spawnSync('npx', ['astro', 'build', '--outDir', ziel], { cwd: WURZEL, env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(lauf.status, 0, lauf.stderr);
  const html = readFileSync(join(ziel, 'index.html'), 'utf8');
  rmSync(ziel, { recursive: true, force: true });
  return html;
}

test('Entwurf ist noindex, Live-Build nicht; kein Inline-Skript', { timeout: 120_000 }, () => {
  const { PUBLIC_ENTWURF: _entfernt, ...ohneEntwurf } = process.env;
  process.env = ohneEntwurf;
  const entwurf = baue({});
  const live = baue({ PUBLIC_ENTWURF: 'false' });
  assert.match(entwurf, /<meta name="robots" content="noindex"/);
  // Beispieldaten, Stand 30.09.2026: 4 von 9 Sparkassen aktiv, 2.200 Bäume, 415 Kinder.
  for (const zahl of ['4 / 9', '2.200', '415']) assert.ok(live.includes(zahl), zahl);
  assert.doesNotMatch(live, /noindex/);
  for (const html of [entwurf, live]) {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
    assert.deepEqual(inline, [], 'CSP erlaubt nur Skripte aus eigenen Dateien');
  }
});
