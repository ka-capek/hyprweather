import * as THREE from 'three';

// This pass belongs INSIDE the sky scene, before the volumetric-cloud composite.
// Cloud transmittance therefore hides stars and the complete moon halo together.
export class CelestialSky {
  constructor(scene, seed) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }, aspect: { value: 1 }, night: { value: 0 },
        seed: { value: (seed % 10000) / 100 }, pixel: { value: 1 / 1396 },
        lightPosition: { value: new THREE.Vector2(.74, .78) },
        sunAmount: { value: 1 }, moonAmount: { value: 0 }, warmth: { value: 1 },
        snowAmount: { value: 0 },
      },
      vertexShader: `varying vec2 vUv;
        void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time, aspect, night, seed, pixel, sunAmount, moonAmount, warmth, snowAmount;
        uniform vec2 lightPosition;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
        float noise(vec2 p){
          vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
        }
        vec3 starLayer(vec2 p,float cells,float keep,float size){
          vec2 grid=p*cells, cell=floor(grid);
          float h=hash(cell+cells);
          vec2 center=.2+.6*vec2(hash(cell+3.),hash(cell+8.));
          vec2 d=(fract(grid)-center)/cells;
          float radius=pixel*size*(.65+.6*h);
          float core=exp(-dot(d,d)/(radius*radius));
          float halo=exp(-length(d)/(radius*2.8))*.045;
          float twinkle=.91+.055*sin(time*(.7+h)+h*72.)+.035*sin(time*1.73+h*31.);
          vec3 tint=mix(vec3(.64,.79,1.),vec3(1.,.83,.65),hash(cell+17.));
          return tint*(core+halo)*step(1.-keep,h)*twinkle;
        }
        void main(){
          vec2 p=vUv*vec2(aspect,1.);
          vec2 d=(vUv-lightPosition)*vec2(aspect,1.);
          float r=length(d);
          vec3 base=mix(vec3(.012,.025,.058),vec3(.003,.008,.025),vUv.y);
          // Restrained diffuse star band; stars themselves remain crisp and varied.
          float band=exp(-pow((p.x*.6+p.y-.84)*3.5,2.));
          base+=vec3(.011,.014,.025)*band*noise(p*9.);
          vec3 stars=starLayer(p,65.,.19,.4)*1.1
                    +starLayer(p+9.,38.,.1,.65)*1.9
                    +starLayer(p+27.,19.,.04,1.)*3.;
          float moonRadius=.027;
          float disk=1.-smoothstep(moonRadius-pixel,moonRadius+pixel,r);
          float relief=.78+.12*noise(d*440.)+.1*noise(d*930.);
          float limb=sqrt(max(0.,1.-pow(r/moonRadius,2.)));
          vec3 moon=vec3(.81,.88,1.)*(disk*relief*(1.7+.6*limb)
                    +.24*exp(-r*36.)+.1*exp(-r*12.))*moonAmount;
          float sunRadius=mix(.021,.044,snowAmount);
          float sunDisk=1.-smoothstep(sunRadius*(1.-snowAmount*.65),sunRadius,r);
          vec3 sunColor=mix(vec3(1.,.95,.83),vec3(1.,.58,.24),warmth);
          float sunlight=(sunDisk*3.5+exp(-r*30.)*.7+exp(-r*8.)*.16)*sunAmount;
          float sunAlpha=clamp((sunDisk+exp(-r*18.)*.32)*sunAmount,0.,1.);
          float alpha=max(night,sunAlpha);
          vec3 rgb=(base+stars*(1.-disk*moonAmount)+moon)*night+sunColor*sunlight;
          gl_FragColor=vec4(rgb/max(alpha,.0001),alpha);
        }`,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }
  update(time, state, light, width, height) {
    const u = this.material.uniforms;
    u.time.value = time;
    u.aspect.value = width / height;
    u.pixel.value = 1 / height;
    u.night.value = state.night;
    u.lightPosition.value.set(light.x, light.y);
    u.sunAmount.value = light.sun;
    u.moonAmount.value = light.moon;
    u.warmth.value = light.warmth;
    u.snowAmount.value = state.snow;
  }
}
