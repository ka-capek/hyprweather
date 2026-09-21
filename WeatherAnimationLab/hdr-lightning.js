// An optional extended-range presentation layer. The SDR scene and bloom remain
// intact; this draws only the bolt's bright core, with no pixel readback/copy.
const shader = `
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) strength: f32,
};
@group(0) @binding(0) var<uniform> pulse: vec4f;
@vertex fn vertexMain(@location(0) position: vec2f, @location(1) uv: vec2f,
                     @location(2) strength: f32) -> VertexOut {
  var out: VertexOut;
  out.position=vec4f(position*2.-1.,0.,1.);
  out.uv=uv;out.strength=strength;
  return out;
}
@fragment fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  let d=abs(in.uv.x*2.-1.);
  let core=exp(-d*d*800.);
  let alpha=core*in.strength*min(pulse.x,1.);
  return vec4f(vec3f(3.2,3.7,4.5)*alpha,alpha);
}`;

export class HDRLightning {
  constructor(host) {
    this.host=host;
    this.enabled=false;
    this.reason='SDR display';
    this.display=matchMedia('(dynamic-range: high)');
    this.display.addEventListener('change',()=>this.refresh());
    this.refresh();
  }
  refresh() {
    if(!this.display.matches){
      this.enabled=false;this.reason='SDR display';
      if(this.canvas)this.canvas.hidden=true;
      return;
    }
    if(this.device && this.pipeline){this.enabled=true;this.reason='extended-range WebGPU';return;}
    if(!this.pending)this.pending=this.initialize().finally(()=>{this.pending=null;});
  }
  async initialize() {
    if(!navigator.gpu){this.reason='WebGPU unavailable';return;}
    try {
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(!adapter){this.reason='No WebGPU adapter';return;}
      const device=await adapter.requestDevice();
      this.device=device;
      const canvas=document.createElement('canvas');
      canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
      canvas.style.pointerEvents='none';
      this.canvas=canvas;
      const context=canvas.getContext('webgpu');
      context.configure({device,format:'rgba16float',colorSpace:'srgb',
        toneMapping:{mode:'extended'},alphaMode:'premultiplied'});
      if(context.getConfiguration?.().toneMapping?.mode!=='extended'){
        this.fail('Extended-range canvas unsupported');return;
      }
      // Some drivers accept configuration but cannot allocate an F16 swapchain.
      // Probe before enabling the layer so the existing SDR renderer survives.
      context.getCurrentTexture().createView();
      this.context=context;
      const module=device.createShaderModule({code:shader});
      this.pipeline=await device.createRenderPipelineAsync({
        layout:'auto',vertex:{module,entryPoint:'vertexMain',buffers:[{arrayStride:20,
          attributes:[{shaderLocation:0,offset:0,format:'float32x2'},
            {shaderLocation:1,offset:8,format:'float32x2'},
            {shaderLocation:2,offset:16,format:'float32'}]}]},
        fragment:{module,entryPoint:'fragmentMain',targets:[{format:'rgba16float',blend:{
          color:{srcFactor:'one',dstFactor:'one',operation:'add'},
          alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},
        primitive:{topology:'triangle-list'},
      });
      this.uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
      this.binding=device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:{buffer:this.uniform}}]});
      this.pulseData=new Float32Array(4);
      device.lost.then(info=>{if(this.device===device)this.fail('WebGPU device lost: '+info.reason);});
      device.addEventListener('uncapturederror',event=>this.fail(event.error.message));
      this.host.append(canvas);
      this.enabled=this.display.matches;
      this.reason=this.enabled?'extended-range WebGPU':'SDR display';
    } catch(error) {this.fail(error.message || String(error));}
  }
  fail(reason) {
    this.enabled=false;this.reason=reason;
    if(this.canvas){this.canvas.hidden=true;this.canvas.remove();}
    this.vertex?.destroy();this.uniform?.destroy();
    // Do not retry every animation frame after a driver/device failure.
    const device=this.device;this.device=null;
    this.pipeline=null;this.meshes=null;this.vertex=null;this.uniform=null;
    if(device)device.destroy();
  }
  updateGeometry(meshes) {
    this.meshes=meshes;
    this.vertex?.destroy();
    this.count=meshes.reduce((sum,mesh)=>sum+mesh.geometry.index.count,0);
    const data=new Float32Array(this.count*5);
    let offset=0;
    for(const mesh of meshes){
      const {position,uv,strength}=mesh.geometry.attributes;
      for(const index of mesh.geometry.index.array){
        data[offset++]=position.getX(index);data[offset++]=position.getY(index);
        data[offset++]=uv.getX(index);data[offset++]=uv.getY(index);
        data[offset++]=strength.getX(index);
      }
    }
    this.vertex=this.device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
    this.device.queue.writeBuffer(this.vertex,0,data);
  }
  render(lightning,pulse,width,height) {
    if(!this.enabled)return;
    try {this.draw(lightning,pulse,width,height);}
    catch(error) {this.fail(error.message || String(error));}
  }
  draw(lightning,pulse,width,height) {
    if(pulse<=.002 || lightning.meshes.length===0){this.canvas.hidden=true;return;}
    if(this.canvas.width!==width)this.canvas.width=width;
    if(this.canvas.height!==height)this.canvas.height=height;
    if(this.meshes!==lightning.meshes)this.updateGeometry(lightning.meshes);
    this.pulseData[0]=pulse;
    this.device.queue.writeBuffer(this.uniform,0,this.pulseData);
    const encoder=this.device.createCommandEncoder();
    const pass=encoder.beginRenderPass({colorAttachments:[{
      view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:0},
      loadOp:'clear',storeOp:'store',
    }]});
    pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.binding);
    pass.setVertexBuffer(0,this.vertex);pass.draw(this.count);pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.canvas.hidden=false;
  }
  diagnostics() {return {enabled:this.enabled,reason:this.reason};}
}
