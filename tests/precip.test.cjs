const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function render(series, timezone='UTC'){
  const context={window:{},Date,Intl};
  for(const file of ['bar-shapes','precip'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,`../js/${file}.js`),'utf8'),context);
  const host={clientWidth:1200,clientHeight:184};
  context.window.renderPrecip(host,{series,stepMinutes:30,tickEveryMinutes:120,timezone,startISO:'2026-09-16T00:00:00Z',barShape:'hatched-uniform',levels:[{label:'Light',from:.1},{label:'Moderate',from:2.5},{label:'Heavy',from:7.6}]},'bands');
  return host.innerHTML;
}
test('dry, missing, light and heavy rain retain three evenly spaced bands',()=>{
  for(const value of [null,0,.4,5,7.6,16]){
    const svg=render(Array(24).fill(value));
    const labels=[...svg.matchAll(/<text class="y-label"[^>]+y="([\d.-]+)"[^>]*>(\w+)<\/text>/g)];
    assert.deepEqual(labels.map(x=>x[2]),['HEAVY','MODERATE','LIGHT']);
    const y=labels.map(x=>+x[1]);
    assert.ok(y[1]-y[0]>40);assert.ok(Math.abs((y[1]-y[0])-(y[2]-y[1]))<.2);
    assert.ok(!/NaN|Infinity/.test(svg));
  }
});
test('precipitation labels follow the selected city, including quarter-hour zones',()=>{
  const series=Array(24).fill(0);
  assert.match(render(series,'Asia/Tokyo'),/>12:00</);
  assert.match(render(series,'Asia/Kathmandu'),/>08:00</);
  assert.doesNotMatch(render(series,'Asia/Kathmandu'),/>08:45</);
});
