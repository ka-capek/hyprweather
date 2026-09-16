import * as THREE from 'three';

// GPU-positioned instanced streaks/flakes in camera space. No DOM particles or
// per-frame CPU position uploads. Every particle has stable depth and randomness.
export class Precipitation {
  constructor(renderer, random = Math.random) {
    this.renderer=renderer;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,100);
    const geometry=new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
    geometry.setIndex([0,1,2,0,2,3]);
    const seeds=new Float32Array(6000*4);
    this.random = random;
    for(let i=0;i<seeds.length;i++)seeds[i]=random();
    geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=6000;
    this.rainMaterial=this.makeMaterial(0);
    this.snowMaterial=this.makeMaterial(1);
    this.rainMesh=new THREE.Mesh(geometry,this.rainMaterial);
    this.snowMesh=new THREE.Mesh(geometry,this.snowMaterial);
    for(const mesh of [this.rainMesh,this.snowMesh]) { mesh.frustumCulled=false;this.scene.add(mesh); }
    this.boltScene=new THREE.Scene();this.boltCamera=new THREE.OrthographicCamera(0,1,1,0,-1,1);
    this.bolt=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xe4eaff,transparent:true,opacity:0,depthTest:false,toneMapped:false,side:THREE.DoubleSide}));
    this.boltGlow=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x829fff,transparent:true,opacity:0,depthTest:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    this.boltScene.add(this.boltGlow,this.bolt);
  }
  makeMaterial(kind) {
    return new THREE.ShaderMaterial({
      uniforms:{time:{value:0},amount:{value:0},kind:{value:kind},drift:{value:0},slant:{value:0},flash:{value:0},aspect:{value:innerWidth/innerHeight},
        lightPosition:{value:new THREE.Vector2(.73,.78)},lightColor:{value:new THREE.Color(1,.85,.65)},
        fogColor:{value:new THREE.Color(.39,.44,.51)},extinction:{value:.009},directLight:{value:1}},
      vertexShader:`
        attribute vec4 seed;
        uniform float time,amount,kind,drift,slant,aspect,extinction;
        varying vec2 vUv,vScreen;
        varying float vAlpha,vFog,vNear;
        void main(){
          vUv=uv;
          // Only 0.25% of snow slots are close; the field is mainly fine distant snow.
          float nearSlot=1.-step(.0025,seed.z);
          float snowDepth=mix(14.+seed.z*72.,5.+seed.z*170.,nearSlot);
          float depth=mix(12.+seed.z*18.,snowDepth,kind);
          float span=depth*1.35;
          float speed=mix(10.+seed.z*14.,.65+seed.w*1.2,kind);
          float age=time+seed.w*100.;
          float fall=seed.y+age*speed/span;
          float y=(.5-fract(fall))*span;
          float x=(fract(seed.x+drift*.035/(span*aspect))-.5)*span*aspect;
          x+=kind*sin(age*.65+seed.w*27.)*.45;
          float width=mix(.018+seed.z*.014,.045+seed.w*.055,kind);
          float height=mix(.3+seed.z*.32,width,kind);
          vec2 p=position.xy*vec2(width,height);
          p.x+=p.y*mix(slant*.008,0.,kind);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(vec3(x,y,-depth)+vec3(p,0.),1.);
          vScreen=gl_Position.xy/gl_Position.w*.5+.5;
          vNear=nearSlot*kind;
          vFog=1.-exp(-depth*extinction*kind);
          float present=1.-smoothstep(amount-.035,amount,seed.w);
          vAlpha=mix(.52,.7,kind)*present*mix(1.,.65,vNear);
          // Far flakes merge with the veil rather than shining through it.
          vAlpha*=mix(1.,exp(-depth*extinction)*(.9-.2*seed.z),kind);
        }`,
      fragmentShader:`
        uniform float kind,flash,aspect,directLight;
        uniform vec2 lightPosition;
        uniform vec3 lightColor,fogColor;
        varying vec2 vUv,vScreen;
        varying float vAlpha,vFog,vNear;
        void main(){
          float rainShape=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.)*sin(vUv.y*3.14159);
          float radius=length(vUv-.5);
          float snowShape=(1.-smoothstep(mix(.17,.03,vNear),.5,radius));
          snowShape*=mix(1.,exp(-radius*radius*7.),vNear);
          float lit=exp(-length((vScreen-lightPosition)*vec2(aspect,1.))*2.4)*directLight;
          vec3 snowColor=mix(vec3(.75,.8,.86),lightColor,clamp(.2+lit*.8,0.,1.));
          snowColor=mix(snowColor,fogColor,vFog*.8);
          vec3 rainColor=mix(vec3(.76,.87,1.),lightColor,lit*.25);
          vec3 color=mix(rainColor,snowColor,kind)+flash*.3;
          gl_FragColor=vec4(color,vAlpha*mix(rainShape,snowShape,kind));
          #include <colorspace_fragment>
        }`,
      transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    });
  }
  setBolt(points){
    const paths=[points];
    for(const start of [3,6,9]) {
      let {x,y}=points[start];const branch=[{x,y}];
      const sign=start===6?-1:1;
      for(let i=0;i<5;i++){x+=sign*(.008+this.random()*.018);y+=.01+this.random()*.021;branch.push({x,y});}
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
  resize(w,h){
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    for(const material of [this.rainMaterial,this.snowMaterial])material.uniforms.aspect.value=w/h;
  }
  render(time,rain,snow,wind,flash,light,fogColor,blizzard){
    const dt = Math.max(0, time - (this.previousTime ?? time));
    this.previousTime = time;
    this.drift = (this.drift || 0) + dt*wind;
    for(const [material,amount] of [[this.rainMaterial,rain],[this.snowMaterial,snow]]){
      const u=material.uniforms;
      u.time.value=time;u.amount.value=amount;u.drift.value=this.drift;
      u.slant.value=wind;u.flash.value=flash;
      u.lightPosition.value.set(light.x,light.y);
      u.lightColor.value.setRGB(...light.lightColor);
      u.directLight.value=(light.sun+light.moon*.55)*(1-blizzard);
      u.fogColor.value.copy(fogColor);u.extinction.value=light.extinction;
    }
    this.rainMesh.visible=rain>.001;this.snowMesh.visible=snow>.001;
    const clear=this.renderer.autoClear;this.renderer.autoClear=false;
    if(rain+snow>.001)this.renderer.render(this.scene,this.camera);
    if(flash>.03){this.bolt.material.opacity=Math.min(1,flash);this.boltGlow.material.opacity=flash*.1;this.renderer.render(this.boltScene,this.boltCamera);}
    this.renderer.autoClear=clear;
  }
}
