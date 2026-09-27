import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUrl } from '../src/lib/ziel.ts';

test('Canonical und Share-Link zeigen immer auf nrw-pflanzt.de', () => {
  assert.equal(productionUrl('/projekte/sparkassen/', '/projekte/sparkassen/'), 'https://www.nrw-pflanzt.de/projekte/sparkassen/');
  assert.equal(
    productionUrl('/nrw-pflanzt-sparkassen/sparkasse-04/', '/nrw-pflanzt-sparkassen/'),
    'https://www.nrw-pflanzt.de/projekte/sparkassen/sparkasse-04/',
  );
  assert.equal(
    productionUrl('/projekte/sparkassen/sparkasse-01/', '/projekte/sparkassen'),
    'https://www.nrw-pflanzt.de/projekte/sparkassen/sparkasse-01/',
  );
});

test('Manipulierte Pfade verlassen weder Domain noch Projektordner', () => {
  for (const bad of ['//evil.example/x/', '///evil.example/x', '/basis///evil.example/', '\\\\evil.example/']) {
    const url = new URL(productionUrl(bad, '/basis/'));
    assert.equal(url.origin, 'https://www.nrw-pflanzt.de', bad);
    assert.ok(url.pathname.startsWith('/projekte/sparkassen/'), bad);
  }
  for (const bad of ['https://evil.example/', 'javascript:alert(1)', '../../wp-admin/']) {
    assert.throws(() => productionUrl(bad, '/basis/'), bad);
  }
});
