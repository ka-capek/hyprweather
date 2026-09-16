import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRandom, createCloudField, cloudVelocity } from './motion.js';

test('a reported seed reproduces all initial cloud fields', () => {
  assert.deepEqual(createCloudField(createRandom(17)), createCloudField(createRandom(17)));
  assert.notDeepEqual(createCloudField(createRandom(17)), createCloudField(createRandom(18)));
});

test('gusts stay smooth, finite and downwind across an hour', () => {
  for (const seed of [0, 17, 4294967295]) {
    const { phase } = createCloudField(createRandom(seed));
    let previous = cloudVelocity(0, 65, phase);
    for (let t = 1; t < 3600; t++) {
      const v = cloudVelocity(t, 65, phase);
      assert.ok(v.x > 0 && Number.isFinite(v.y));
      assert.ok(Math.hypot(v.x - previous.x, v.y - previous.y) < 1);
      previous = v;
    }
    assert.equal(Math.hypot(...Object.values(cloudVelocity(10, 0, phase))), 0);
  }
});
