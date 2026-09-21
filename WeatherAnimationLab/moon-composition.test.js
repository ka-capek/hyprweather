import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Geodetic, Ellipsoid} from '@takram/three-geospatial';
import {CelestialSky} from './celestial.js';
const sky=new CelestialSky(new THREE.Scene(),123,null,null);
const camera=new THREE.PerspectiveCamera(38,1316/1396,1,1e9);
camera.position.copy(new Geodetic(14.42*Math.PI/180,50.08*Math.PI/180,180).toECEF());
camera.up.copy(Ellipsoid.WGS84.getSurfaceNormal(camera.position));
camera.lookAt(camera.position.clone().add(camera.up));camera.updateMatrixWorld();
let belowHorizon=false;
for(let hour=0;hour<24;hour++){
 sky.update(0,{night:1,blizzard:0,snow:0},{x:.69,y:.80,sun:0,moon:1,warmth:0},camera,Date.parse('2026-09-21T00:00:00Z')+hour*3600000);
 const u=sky.material.uniforms;
 const projected=u.moonDirection.value.clone().multiplyScalar(1e6).add(camera.position).project(camera);
 assert.ok(Math.abs(projected.x-.38)<1e-8 && Math.abs(projected.y-.60)<1e-8,'Moon stays in composed screen position');
 assert.ok(Math.abs((1-u.moonDirection.value.dot(u.lunarSun.value))/2-sky.lunar.fraction)<.01,'Relocation preserves the real phase');
 const before=sky.lunar.direction.clone().negate().applyMatrix3(sky.lunar.surfaceRotation);
 const after=u.moonDirection.value.clone().negate().applyMatrix3(u.lunarSurface.value);
 assert.ok(before.distanceTo(after)<1e-9,'Relocation preserves the visible lunar surface');
 if(sky.lunar.altitude<0){belowHorizon=true;assert.equal(u.moonAmount.value,1);}
}
assert.ok(belowHorizon,'Fixture includes a Moon below the real horizon');
