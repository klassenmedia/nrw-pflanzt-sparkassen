import test from 'node:test';
import assert from 'node:assert/strict';
import { productionUrl } from '../src/lib/ziel.ts';

test('Canonical und Share-Link zeigen immer auf nrw-pflanzt.de', () => {
  assert.equal(productionUrl('/projekte/sparkassen/', '/projekte/sparkassen/'), 'https://www.nrw-pflanzt.de/projekte/sparkassen/');
  assert.equal(
    productionUrl('/nrw-pflanzt-sparkassen/sparkasse-04/', '/nrw-pflanzt-sparkassen/'),
    'https://www.nrw-pflanzt.de/projekte/sparkassen/sparkasse-04/',
  );
});

test('Fremder Pfad kann die Zieldomain nicht verlassen', () => {
  assert.ok(productionUrl('//evil.example/x/', '/basis/').startsWith('https://www.nrw-pflanzt.de/'));
});
