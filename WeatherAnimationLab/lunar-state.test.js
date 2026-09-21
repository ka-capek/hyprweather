import assert from 'node:assert/strict';
import { Geodetic } from '@takram/three-geospatial';
import { LunarState } from './lunar-state.js';
const rad=Math.PI/180;
const prague=new Geodetic(14.42*rad,50.08*rad,180).toECEF();
const moon=new LunarState();
// Independent event fixtures: 2024-04-08 solar eclipse / 2024-03-25 lunar eclipse.
moon.update(Date.parse('2024-04-08T18:00:00Z'),prague);
assert.ok(moon.fraction<.001,'Solar eclipse must have a new Moon');
moon.update(Date.parse('2024-03-25T07:00:00Z'),prague);
assert.ok(moon.fraction>.999,'Lunar eclipse must have a full Moon');
for(const date of ['2026-09-21T20:00:00Z','2026-09-27T00:00:00Z','2026-10-04T00:00:00Z']){
 moon.update(Date.parse(date),prague);
 assert.ok(Math.abs(moon.direction.length()-1)<1e-12);
 assert.ok(Math.abs(moon.surfaceRotation.determinant()-1)<1e-10);
 const renderedFraction=(1-moon.direction.dot(moon.sunDirection))/2;
 assert.ok(Math.abs(renderedFraction-moon.fraction)<.01,'Rendered terminator must agree with astronomical phase');
 const face=moon.direction.clone().negate().applyMatrix3(moon.surfaceRotation);
 assert.ok(face.x>.97,'The NASA near-side meridian must face Earth, including libration');
 assert.ok(moon.angularRadius>.004 && moon.angularRadius<.0051);
}
const now=Date.parse('2026-09-21T20:00:00Z');
moon.update(now,prague);const first=moon.direction.clone();
const endpoint=moon.nextDirection.clone();
moon.update(now+1000,prague);
assert.ok(moon.nextDirection.equals(endpoint),'Minute cache should reuse ephemeris endpoints');
assert.ok(moon.direction.angleTo(first)>0 && moon.direction.angleTo(first)<.0001,'Moon should move smoothly between cached minute endpoints');
const sydney=new Geodetic(151.2*rad,-33.87*rad,180).toECEF();
moon.update(now,sydney);assert.ok(!moon.direction.equals(first),'City changes invalidate the observer cache');
assert.ok(Math.abs(moon.altitude)<Math.PI/2);
