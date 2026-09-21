import assert from 'node:assert/strict';
import { HDRLightning } from './hdr-lightning.js';
let display={matches:false,addEventListener(){}};
globalThis.matchMedia=()=>display;
let adapterRequests=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter(){adapterRequests++;throw Error('Must not allocate on SDR');}}}});
const host={append(){}};
const sdr=new HDRLightning(host);
assert.equal(adapterRequests,0);
assert.equal(sdr.enabled,false);

// Moving to an HDR display while pipeline creation is pending must not enable
// rendering against incomplete GPU resources; returning to SDR must win the race.
display={matches:true,addEventListener(){}};
let finishPipeline;
const pipelineReady=new Promise(resolve=>{finishPipeline=resolve;});
let destroyed=false;
const device={
 createShaderModule(){return {};},createRenderPipelineAsync(){return pipelineReady;},
 createBuffer(){return {destroy(){}};},createBindGroup(){return {};},
 lost:new Promise(()=>{}),addEventListener(){},destroy(){destroyed=true;},
 queue:{writeBuffer(){}},createCommandEncoder(){return {};},
};
const context={configure(){},getConfiguration(){return {toneMapping:{mode:'extended'}};},getCurrentTexture(){return {createView(){}};}};
globalThis.document={createElement(){return {hidden:false,style:{},setAttribute(){},getContext(){return context;},remove(){}};}};
globalThis.GPUBufferUsage={UNIFORM:1,COPY_DST:2,VERTEX:4};
navigator.gpu.requestAdapter=async()=>({requestDevice:async()=>device});
const hdr=new HDRLightning(host);
await Promise.resolve();await Promise.resolve();await Promise.resolve();
hdr.refresh();assert.equal(hdr.enabled,false,'Incomplete pipeline must stay disabled');
display.matches=false;hdr.refresh();
finishPipeline({getBindGroupLayout(){return {};}});
await hdr.pending;
assert.equal(hdr.enabled,false,'Completed initialization must respect a changed display');
display.matches=true;hdr.refresh();assert.equal(hdr.enabled,true);
hdr.render({meshes:[]},0,64,64);assert.equal(hdr.canvas.hidden,true);

// A late swapchain failure must disable only the optional HDR layer, not throw
// out of the application's animation loop.
context.getCurrentTexture=()=>{throw Error('F16 swapchain unavailable');};
const attribute={getX(){return 0;},getY(){return 0;}};
const geometry={index:{count:3,array:[0,1,2]},attributes:{position:attribute,uv:attribute,strength:attribute}};
assert.doesNotThrow(()=>hdr.render({meshes:[{geometry}]},1,64,64));
assert.equal(hdr.enabled,false);assert.equal(destroyed,true);
assert.match(hdr.reason,/F16 swapchain/);
