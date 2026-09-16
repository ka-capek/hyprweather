import * as THREE from 'three';

// GPU-positioned instanced streaks/flakes in camera space. No DOM particles or
// per-frame CPU position uploads. Every particle has stable depth and randomness.
export class Precipitation {
  constructor(renderer) {
    this.renderer=renderer;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,100);
    const geometry=new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
    geometry.setIndex([0,1,2,0,2,3]);
    const seeds=new Float32Array(6000*4);
    let state=74219;
    for(let i=0;i<seeds.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;seeds[i]=state/4294967296;}
    geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=6000;
    this.material=new THREE.ShaderMaterial({
      uniforms:{time:{value:0},rain:{value:0},snow:{value:0},wind:{value:0},flash:{value:0},aspect:{value:innerWidth/innerHeight}},
      vertexShader:`
        attribute vec4 seed;
        uniform float time,rain,snow,wind,aspect;
        varying vec2 vUv;
        varying float vAlpha,vSnow;
        void main(){
          vUv=uv;vSnow=snow;
          float depth=3.+seed.z*35.;
          float span=depth*1.35;
          float speed=mix(10.+seed.z*14.,.8+seed.z*1.5,snow);
          float age=time+seed.w*100.;
          float y=(.5-fract(seed.y+age*speed/span))*span;
          float drift=age*wind*.035;
          float x=(fract(seed.x+drift/(span*aspect))-.5)*span*aspect;
          x+=snow*sin(age*.65+seed.w*27.)*.6;
          float width=mix(.009,.018+seed.w*.035,snow);
          float height=mix(.3+seed.z*.32,width,snow);
          vec2 p=position.xy*vec2(width,height);
          p.x+=p.y*mix(wind*.008,0.,snow);
          vec3 center=vec3(x,y,-depth);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(center+vec3(p,0.),1.);
          vAlpha=mix(rain*.27,snow*.8,snow)*(1.-smoothstep(8.,40.,depth));
          if(seed.w>mix(rain,snow,snow))vAlpha=0.;
        }`,
      fragmentShader:`
        uniform float flash;
        varying vec2 vUv;
        varying float vAlpha,vSnow;
        void main(){
          float rainShape=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.)*sin(vUv.y*3.14159);
          float snowShape=1.-smoothstep(.2,.5,length(vUv-.5));
          float shape=mix(rainShape,snowShape,vSnow);
          gl_FragColor=vec4(mix(vec3(.62,.74,.91),vec3(.91,.94,1.),vSnow)+flash*.3,vAlpha*shape);
        }`,
      transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    });
    const mesh=new THREE.Mesh(geometry,this.material);mesh.frustumCulled=false;this.scene.add(mesh);
    this.boltScene=new THREE.Scene();this.boltCamera=new THREE.OrthographicCamera(0,1,1,0,-1,1);
    this.bolt=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xe4eaff,transparent:true,opacity:0,depthTest:false,toneMapped:false,side:THREE.DoubleSide}));
    this.boltGlow=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x829fff,transparent:true,opacity:0,depthTest:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    this.boltScene.add(this.boltGlow,this.bolt);
  }
  setBolt(points){
    const paths=[points];
    for(const start of [3,6,9]) {
      let {x,y}=points[start];const branch=[{x,y}];
      const sign=start===6?-1:1;
      for(let i=0;i<5;i++){x+=sign*(.008+Math.random()*.018);y+=.01+Math.random()*.021;branch.push({x,y});}
      paths.push(branch);
    }
    const makeGeometry=width=>{
      const data=[];
      for(const path of paths)for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i];
        const dx=(b.x-a.x)*innerWidth,dy=(b.y-a.y)*innerHeight;
        const len=Math.hypot(dx,dy)||1;
        const nx=-dy/len*width/innerWidth,ny=dx/len*width/innerHeight;
        const p=[a.x+nx,1-a.y-ny,0,a.x-nx,1-a.y+ny,0,b.x+nx,1-b.y-ny,0,
          a.x-nx,1-a.y+ny,0,b.x-nx,1-b.y+ny,0,b.x+nx,1-b.y-ny,0];
        data.push(...p);
      }
      return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(data,3));
    };
    this.bolt.geometry.dispose();this.boltGlow.geometry.dispose();
    this.bolt.geometry=makeGeometry(1.1);this.boltGlow.geometry=makeGeometry(4);
  }
  resize(w,h){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.material.uniforms.aspect.value=w/h;}
  render(time,rain,snow,wind,flash){
    Object.assign(this.material.uniforms.time,{value:time});
    this.material.uniforms.rain.value=rain;this.material.uniforms.snow.value=snow;
    this.material.uniforms.wind.value=wind;this.material.uniforms.flash.value=flash;
    const clear=this.renderer.autoClear;this.renderer.autoClear=false;
    if(rain+snow>.001)this.renderer.render(this.scene,this.camera);
    if(flash>.03){this.bolt.material.opacity=Math.min(1,flash);this.boltGlow.material.opacity=flash*.1;this.renderer.render(this.boltScene,this.boltCamera);}
    this.renderer.autoClear=clear;
  }
}
