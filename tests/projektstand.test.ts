import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projektstand,
  standIndex,
  statusForStand,
  filterRegionen,
  plantedTrees,
  treesForProgress,
} from '../src/lib/projektstand.ts';
import { regionen } from '../src/data/regionen.ts';

test('Stand "Fläche in Planung": kein Schritt erledigt, keine Medien', () => {
  const view = projektstand('Fläche in Planung');
  assert.deepEqual(view.steps.map((s) => s.state), ['open', 'open', 'open', 'open']);
  assert.equal(view.hasMedia, false);
  assert.equal(view.planted, false);
});

test('Stand "Fläche gefunden": nur die Fläche ist erledigt', () => {
  const view = projektstand('Fläche gefunden');
  assert.deepEqual(view.steps.map((s) => s.state), ['done', 'open', 'open', 'open']);
  assert.equal(view.steps[0].tag, 'Ja');
  assert.equal(view.steps[1].tag, 'Noch offen');
});

test('Stand "Schulaktionstag erfolgt": zwei Schritte, Medien vom Aktionstag', () => {
  const view = projektstand('Schulaktionstag erfolgt');
  assert.deepEqual(view.steps.map((s) => s.state), ['done', 'done', 'open', 'open']);
  assert.equal(view.hasMedia, true);
  assert.equal(view.mediaLabel, 'Schulaktionstag');
});

test('Stand "Pflanztag erfolgt": Pflege läuft, Bäume gepflanzt', () => {
  const view = projektstand('Pflanztag erfolgt');
  assert.deepEqual(view.steps.map((s) => s.state), ['done', 'done', 'done', 'running']);
  assert.equal(view.steps[3].tag, 'Läuft');
  assert.equal(view.planted, true);
  assert.equal(view.mediaLabel, 'Pflanztag');
});

test('Unbekannter oder manipulierter Stand fällt auf den Anfang zurück', () => {
  for (const bad of ['', 'Pflanztag', '<script>', null, undefined, 42, {}]) {
    assert.equal(standIndex(bad), 0, `Eingabe ${String(bad)}`);
  }
});

test('Kachel-Status folgt dem Stand', () => {
  assert.equal(statusForStand('Fläche in Planung'), 'geplant');
  assert.equal(statusForStand('Fläche gefunden'), 'geplant');
  assert.equal(statusForStand('Schulaktionstag erfolgt'), 'aktion');
  assert.equal(statusForStand('Pflanztag erfolgt'), 'gepflanzt');
});

test('Filter blendet nur passende Regionen ein, unbekannter Filter zeigt alle', () => {
  const planted = filterRegionen(regionen, 'gepflanzt');
  assert.ok(planted.filter((r) => r.shown).every((r) => r.status === 'gepflanzt'));
  assert.ok(planted.some((r) => !r.shown));
  assert.ok(filterRegionen(regionen, 'alle').every((r) => r.shown));
  assert.ok(filterRegionen(regionen, 'quatsch').every((r) => r.shown));
});

test('Fortschritt wird auf 0–100 begrenzt und in Bäume umgerechnet', () => {
  assert.equal(plantedTrees(38), 19000);
  assert.equal(plantedTrees(-5), 0);
  assert.equal(plantedTrees(250), 50000);
  assert.equal(plantedTrees(Number.NaN), 0);
});

test('Bäume auf der 3D-Insel wachsen mit dem Fortschritt', () => {
  assert.ok(treesForProgress(0) >= 1);
  assert.ok(treesForProgress(100) > treesForProgress(38));
  assert.equal(treesForProgress(500), treesForProgress(100));
});

test('Regionendaten: 27 eindeutige Slugs, nur gültige Stände', () => {
  assert.equal(regionen.length, 27);
  assert.equal(new Set(regionen.map((r) => r.slug)).size, 27);
  for (const r of regionen) {
    assert.match(r.slug, /^[a-z0-9-]+$/);
    assert.notEqual(standIndex(r.stand), -1);
  }
});
