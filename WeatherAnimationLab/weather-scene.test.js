import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WMO,weatherScene,solarElevation} from './weather-scene.js';
test('28 WMO codes have finite parameters in both day and night',()=>{
  assert.equal(Object.keys(WMO).length,28);
  for(const weatherCode of Object.keys(WMO).map(Number))for(const isDay of [true,false]){
    const s=weatherScene({weatherCode,isDay});
    assert.equal(s.night,isDay?0:1);
    assert.equal(s.lightning,weatherCode>=95?1:0);
    for(const k of ['elevation','coverage','wind','rain','snow','fog','blizzard','density'])assert.ok(Number.isFinite(s[k]),`${weatherCode}: ${k}`);
  }
});
test('unknown conditions and invalid coordinates do not invent daylight',()=>{
  assert.equal(weatherScene({weatherCode:123,isDay:true}),null);
  assert.equal(weatherScene({weatherCode:0}),null);
  assert.equal(weatherScene({weatherCode:0},null),null);
  assert.equal(solarElevation(95,0),null);
  assert.equal(solarElevation(0,0,NaN),null);
  assert.ok(solarElevation(0,0,Date.parse('2026-03-20T12:00:00Z'))>85);
  assert.ok(solarElevation(0,0,Date.parse('2026-03-20T00:00:00Z'))< -85);
});
