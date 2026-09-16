import * as THREE from 'three';
import {siderealAngle} from './sidereal.js';

// This pass belongs INSIDE the sky scene, before the volumetric-cloud composite.
// Cloud transmittance therefore hides stars and the complete moon halo together.
export class CelestialSky {
  constructor(scene, seed, starMap) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        starMap:{value:starMap},sidereal:{value:0},
        projectionInverse:{value:new THREE.Matrix4()},cameraRotation:{value:new THREE.Matrix3()},
        viewport: { value: new THREE.Vector4(0,0,1,1) }, time: { value: 0 }, night: { value: 0 },
        seed: { value: (seed % 10000) / 100 }, pixel: { value: 1 / 1396 },
        lightPosition: { value: new THREE.Vector2(.74, .78) },
        sunAmount: { value: 1 }, moonAmount: { value: 0 }, warmth: { value: 1 },
        snowAmount: { value: 0 },
      },
      vertexShader: `void main(){gl_Position=vec4(position.xy,1.,1.);}`,
      fragmentShader: `
        uniform vec4 viewport;
        uniform sampler2D starMap;
        uniform mat4 projectionInverse;
        uniform mat3 cameraRotation;
        uniform float sidereal;
        uniform float time, night, seed, pixel, sunAmount, moonAmount, warmth, snowAmount;
        uniform vec2 lightPosition;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
        float noise(vec2 p){
          vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
        }
        void main(){
          // Use the active render target, not cached DOM dimensions/interpolated UVs.
          vec2 screen=(gl_FragCoord.xy-viewport.xy)/viewport.zw;
          vec2 p=(gl_FragCoord.xy-viewport.xy)/viewport.w;
          vec2 d=p-lightPosition*vec2(viewport.z/viewport.w,1.);
          float r=length(d);
          vec3 base=mix(vec3(.012,.025,.058),vec3(.003,.008,.025),screen.y);
          vec3 stars=vec3(0.);
          if(night>.001){
            vec4 viewRay=projectionInverse*vec4(screen*2.-1.,1.,1.);
            vec3 earthRay=normalize(cameraRotation*viewRay.xyz);
            float ra=atan(earthRay.y,earthRay.x)+sidereal;
            vec2 mapUv=vec2(fract(.5-ra/6.28318530718),asin(clamp(earthRay.z,-1.,1.))/3.14159265359+.5);
            stars=texture2D(starMap,mapUv).rgb*3.2;
            stars*=.97+.03*sin(time*1.1+hash(floor(mapUv*8192.))*60.);
          }
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
    this.mesh.onBeforeRender = renderer => {
      renderer.getCurrentViewport(this.material.uniforms.viewport.value);
      this.material.uniforms.pixel.value=1/this.material.uniforms.viewport.value.w;
    };
    scene.add(this.mesh);
  }
  update(time, state, light, camera, now) {
    const u = this.material.uniforms;
    u.time.value = time;
    u.projectionInverse.value.copy(camera.projectionMatrixInverse);
    u.cameraRotation.value.setFromMatrix4(camera.matrixWorld);
    u.sidereal.value=siderealAngle(now);
    u.night.value = state.night;
    u.lightPosition.value.set(light.x, light.y);
    u.sunAmount.value = light.sun;
    u.moonAmount.value = light.moon;
    u.warmth.value = light.warmth;
    u.snowAmount.value = state.snow;
  }
}
