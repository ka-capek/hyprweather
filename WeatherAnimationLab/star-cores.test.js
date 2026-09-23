import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {StarCores} from './star-cores.js';
const file=readFileSync(new URL('./public/sky/nasa-star-cores.bin',import.meta.url));
const data=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
const points=new Float32Array(data);
assert.ok(points.length/7>1000 && points.length/7<5000);
for(let i=0;i<points.length;i+=7){
 assert.ok(Math.abs(Math.hypot(...points.subarray(i,i+3))-1)<1e-6);
 assert.ok(points[i+3]>=0 && points[i+3]<=1);
}
const scene=new THREE.Scene();
const stars=new StarCores(scene,data,{});
assert.equal(stars.mesh.geometry.getAttribute('position').count,points.length/7);
stars.update(0);assert.equal(stars.mesh.visible,false);
stars.update(1);assert.equal(stars.mesh.visible,true);
assert.throws(()=>new StarCores(scene,new ArrayBuffer(3),{}));
// Match the inverse of NASA texture lookup, including wrap and negative RA.
for(const ra of [-2,-.1,0,2,5]){
 const dec=.6,sidereal=1.2;
 const p=new THREE.Vector3(Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec));
 p.applyAxisAngle(new THREE.Vector3(0,0,1),-sidereal);
 const recovered=Math.atan2(p.y,p.x)+sidereal;
 assert.ok(Math.abs(Math.sin(recovered-ra))<1e-12);
}
