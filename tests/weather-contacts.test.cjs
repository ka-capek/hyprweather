const assert=require('node:assert/strict');
const {ContactField}=require('../js/weather-contacts.js');
let seed=123;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const field=new ContactField(random);
const slots=[...field.items];
field.resize(1316,1440,[{left:100,right:1200,top:800}]);
field.setWeather({rain:1,wind:15,night:1});
let glass=false,splash=false;
for(let frame=0;frame<60*120;frame++){
 field.update(1/60);
 glass ||= field.items.some(p=>p.active && p.kind==='glass');
 splash ||= field.items.some(p=>p.active && p.kind==='spray');
 assert.ok(field.items.filter(p=>p.active).length<=64);
 assert.ok(field.items.every((p,i)=>p===slots[i]),'Slots are reused rather than growing over time');
}
assert.ok(glass && splash,'Rain produces both glass beads and UI splashes');
field.setWeather({});assert.equal(field.update(1/60),false);
assert.ok(field.items.every(p=>!p.active),'Dry weather clears contacts');
field.setWeather({snow:1});
let settled=false;
for(let i=0;i<60*45;i++){field.update(1/60);settled ||= field.items.some(p=>p.active && p.kind==='settled');}
assert.ok(settled,'Snow briefly rests on a UI edge');
assert.ok(field.items.filter(p=>p.active).every(p=>p.snow));
field.resize(800,900,[{left:100,right:700,top:450}]);
assert.ok(field.items.every(p=>!p.active),'Resize removes particles from obsolete edges');
// A direct crossing must hit the top edge, not pass through or use its old X.
field.credit=0;
const incoming=field.add({kind:'incoming',snow:false,x:200,y:449,vx:20,vy:200,radius:1,life:2});
field.update(.02);
assert.ok(field.items.some(p=>p.active && p.kind==='spray' && Math.abs(p.y-449)<.01));
assert.ok(field.items.filter(p=>p.active).every(p=>p.kind!=='incoming'));
field.setWeather({rain:NaN,snow:Infinity});assert.equal(field.update(.05),false);
console.log('Contact pooling, rain/snow, edge collision, resize and dry-idle checks passed');
