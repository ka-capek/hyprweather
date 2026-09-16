const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
test('failed refresh marks cached data stale and recovery clears startup error',()=>{
  const nodes=new Map();let onModel,onError;
  const ctx={document:{getElementById:id=>{
    if(!nodes.has(id))nodes.set(id,{clientWidth:0,clientHeight:0});return nodes.get(id);
  }},Date,URLSearchParams,location:{search:'?notmock=1'},setInterval:()=>{},
    window:{MOCK:{},addEventListener:()=>{},Weather:{cached:()=>null,start:(m,e)=>{onModel=m;onError=e;}}}};
  vm.runInNewContext(code,ctx);
  assert.equal(typeof onModel,'function','unrelated query must not select mock mode');
  onError(new Error('offline'));
  assert.match(nodes.get('badge').textContent,/unavailable/);
  const model={current:{},location:{},hourly:[],daily:[],precip:{},meta:{source:'Open-Meteo',fetchedAt:Date.now(),stale:false}};
  onModel(model);assert.match(nodes.get('badge').textContent,/Open-Meteo/);
  onError(new Error('offline'));assert.equal(model.meta.stale,true);assert.match(nodes.get('badge').textContent,/Offline/);
  onModel({...model,meta:{...model.meta,stale:false}});assert.match(nodes.get('badge').textContent,/Open-Meteo/);
});
