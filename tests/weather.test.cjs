const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../js/weather.js'),'utf8');
function setup(responses,place={latitude:50,longitude:14}) {
  const requests=[];
  const context={window:{appStore:{get:()=>place,set:()=>{}}},Date,AbortController,URLSearchParams,
    setTimeout:()=>1,clearTimeout:()=>{},fetch:async url=>{
      requests.push(url);return {ok:true,json:async()=>responses.shift()};
    }};
  vm.runInNewContext(code,context);
  return {weather:context.window.Weather,requests};
}
function fixture() {
  const start=new Date();start.setMinutes(0,0,0);
  return {current:{temperature_2m:5,weather_code:0}, minutely_15:{
    time:Array.from({length:64},(_,i)=>new Date(+start+i*900000).toISOString()),
    precipitation:Array.from({length:64},(_,i)=>i%2?null:1)
  }};
}
test('partial missing precipitation stays missing, unknown day is not night',async()=>{
  const {weather}=setup([fixture()]);
  await new Promise((resolve,reject)=>{const stop=weather.start(m=>{
    try {assert.equal(m.current.isDay,null);assert.equal(m.current.icon,'sun');assert.ok(m.precip.series.length>=12);
      assert.ok(m.precip.series.every(x=>x===null));stop();resolve();}catch(e){reject(e);}
  },reject);});
});
test('zero latitude is a valid IP location',async()=>{
  const {weather,requests}=setup([{success:true,latitude:0,longitude:10,city:'Equator'},fixture()],null);
  await new Promise((resolve,reject)=>{const stop=weather.start(m=>{
    try {assert.equal(m.location.latitude,0);assert.equal(requests.length,2);stop();resolve();}catch(e){reject(e);}
  },reject);});
});
test('live model retains the conditions needed by the renderer',async()=>{
  const d=fixture();d.current={weather_code:63,is_day:0,cloud_cover:42,wind_speed_10m:27,precipitation:1.2};
  const {weather,requests}=setup([d]);
  await new Promise((resolve,reject)=>{const stop=weather.start(m=>{
    try {assert.equal(m.current.weatherCode,63);assert.equal(m.current.isDay,false);
      assert.equal(m.current.cloudCover,42);assert.equal(m.current.windSpeed,27);
      assert.equal(m.current.precipitation,1.2);
      assert.match(requests[0],/cloud_cover,wind_speed_10m/);stop();resolve();}catch(e){reject(e);}
  },reject);});
});
test('absolute API timestamps survive mapping in a distant time zone',async()=>{
  const start=Math.floor(Date.now()/3600000)*3600;
  const d={timezone:'Asia/Tokyo',current:{weather_code:0,is_day:1},
    hourly:{time:Array.from({length:30},(_,i)=>start+i*3600),temperature_2m:Array(30).fill(20)},
    daily:{time:[start],temperature_2m_min:[10],temperature_2m_max:[20]}};
  const {weather,requests}=setup([d]);
  await new Promise((resolve,reject)=>{const stop=weather.start(m=>{
    try{assert.equal(m.hourly[0].timeISO,new Date(start*1000).toISOString());
      assert.equal(m.hourly[1].timeISO,new Date((start+10800)*1000).toISOString());
      assert.equal(m.precip.timezone,'Asia/Tokyo');assert.match(requests[0],/timeformat=unixtime/);stop();resolve();}catch(e){reject(e);}
  },reject);});
});
