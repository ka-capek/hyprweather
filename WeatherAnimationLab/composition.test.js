import { test } from 'node:test';
import assert from 'node:assert/strict';
import { framingSettings, lightComposition } from './composition.js';

test('both lenses exclude the horizon with twelve degrees to spare', () => {
  for (const mode of ['flat', 'wide']) {
    const { fov, tilt } = framingSettings(mode);
    assert.equal(tilt - fov / 2, 12);
  }
});

test('light follows a continuous upper-third arc outside the temperature column', () => {
  for (const azimuth of [-12, 18]) {
    let previous;
    for (let elevation = -14; elevation <= 35; elevation += .1) {
      const light = lightComposition(elevation, azimuth, 0, 0, 0);
      assert.ok(light.y >= .72 && light.y <= .82);
      assert.ok(Math.abs(light.x - .5) >= .16);
      if (previous) assert.ok(Math.hypot(light.x - previous.x, light.y - previous.y) < .002);
      previous = light;
    }
  }
});

test('heavy snow extinguishes sunlight and distant flakes; light snow keeps warm light', () => {
  const gentle = lightComposition(1, 24, 0, 0, .28);
  const heavy = lightComposition(3, 15, 0, 1, 1);
  assert.ok(gentle.sun > .8 && gentle.lightColor[0] > gentle.lightColor[2]);
  assert.equal(heavy.sun, 0);
  assert.ok(heavy.haze > .9 && heavy.extinction > gentle.extinction * 5);
  assert.ok(Math.exp(-70 * heavy.extinction) < .02);
  const night = lightComposition(-12, 14, 1, 0, 0);
  assert.equal(night.sun, 0);
  assert.equal(night.moon, 1);
});


test('switching from a left to a right light does not teleport through the middle', () => {
  let previous = lightComposition(2, -12, 0, 0, 0);
  for (let azimuth = -11.9; azimuth <= 18; azimuth += .1) {
    const light = lightComposition(2, azimuth, 0, 0, 0);
    assert.ok(Math.abs(light.x - previous.x) < .004);
    previous = light;
  }
});
