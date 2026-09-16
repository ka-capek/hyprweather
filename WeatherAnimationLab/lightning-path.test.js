import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRandom} from './motion.js';
import {lightningPaths,lightningPulse} from './lightning-path.js';
test('long bolts cross a full viewport and keep stable branching',()=>{
 for(let seed=0;seed<30;seed++){
  const paths=lightningPaths(createRandom(seed));
  assert.deepEqual(paths,lightningPaths(createRandom(seed)));
  const trunk=paths[0].points,a=trunk[0],b=trunk.at(-1);
  assert.ok(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))>1);
  assert.equal(trunk.length,65);
  for(const path of paths)for(const p of path.points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
 }
 assert.equal(lightningPulse(1),0);assert.ok(lightningPulse(.13)>lightningPulse(.08));
});
