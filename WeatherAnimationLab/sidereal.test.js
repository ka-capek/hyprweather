import {test} from 'node:test';
import assert from 'node:assert/strict';
import {siderealAngle} from './sidereal.js';
test('sidereal rotation matches J2000 and advances by one turn per sidereal day',()=>{
 const epoch=Date.parse('2000-01-01T12:00:00Z');
 assert.ok(Math.abs(siderealAngle(epoch)*180/Math.PI-280.46061837)<1e-8);
 const delta=Math.abs(siderealAngle(epoch+86164091)-siderealAngle(epoch));
 assert.ok(delta<1e-5);
 for(const offset of [-1e12,0,1e12])assert.ok(siderealAngle(epoch+offset)>=0 && siderealAngle(epoch+offset)<Math.PI*2);
});
