import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDestinationMedia, validateDestinationMedia, validateAirlineMedia, isHttpsMediaPath } from '../src/features/discovery/media-paths.ts';

test('an explicit bundled destination path chooses that picture instead of the airport fallback', () => {
  assert.deepEqual(resolveDestinationMedia('destinations/da-nang.jpg', 'HAN'), { bundleCode: 'DAD' });
  assert.deepEqual(resolveDestinationMedia('destinations/pqc.jpg', 'DAD'), { bundleCode: 'PQC' });
  assert.deepEqual(resolveDestinationMedia(null, 'HAN'), { bundleCode: 'HAN' });
  assert.deepEqual(resolveDestinationMedia('https://example.com/photo.jpg', 'HAN'), { uri: 'https://example.com/photo.jpg' });
});

test('unknown relative and unsafe media paths fail validation with an actionable error', () => {
  for (const path of ['destinations/unknown.jpg', 'http://example.com/a.jpg', 'file:///a.jpg', 'https://', 'https://user:secret@example.com/a.jpg']) {
    assert.equal(validateDestinationMedia(path).valid, false, path);
    assert.equal(isHttpsMediaPath(path), false);
  }
  assert.equal(validateDestinationMedia('destinations/ha-noi.jpg').valid, true);
  assert.equal(validateDestinationMedia('').valid, true);
  assert.equal(resolveDestinationMedia('destinations/unknown.jpg', 'HAN'), null);
});

test('airlines accept HTTPS logos and allow unchanged legacy references only as initial fallbacks', () => {
  assert.equal(validateAirlineMedia('https://example.com/logo.svg').valid, true);
  assert.equal(validateAirlineMedia('airlines/vn.png').valid, false);
  assert.equal(validateAirlineMedia('airlines/vn.png', 'airlines/vn.png').valid, true);
  assert.equal(validateAirlineMedia('airlines/vj.png', 'airlines/vn.png').valid, false);
});
