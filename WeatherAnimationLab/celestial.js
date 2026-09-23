import * as THREE from 'three';
import {siderealAngle} from './sidereal.js';
import {LunarState} from './lunar-state.js';

// This pass belongs INSIDE the sky scene, before the volumetric-cloud composite.
// Cloud transmittance therefore hides stars and the complete moon halo together.
export class CelestialSky {
  constructor(scene, seed, starMap, moonMap) {
    this.lunar = new LunarState();
    this.moonRotation = new THREE.Quaternion();
    this.moonMatrix = new THREE.Matrix4();
    this.moonInverse = new THREE.Matrix3();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        starMap:{value:starMap},sidereal:{value:0},
        moonMap:{value:moonMap},moonDirection:{value:new THREE.Vector3()},
        lunarSun:{value:new THREE.Vector3()},lunarSurface:{value:new THREE.Matrix3()},
        moonRadius:{value:.0045},moonFraction:{value:0},
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
        uniform sampler2D starMap, moonMap;
        uniform vec3 moonDirection, lunarSun;
        uniform mat3 lunarSurface;
        uniform float moonRadius, moonFraction;
        uniform mat4 projectionInverse;
        uniform mat3 cameraRotation;
        uniform float sidereal;
        uniform float time, night, seed, pixel, sunAmount, moonAmount, warmth, snowAmount;
        uniform vec2 lightPosition;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
        void main(){
          // Use the active render target, not cached DOM dimensions/interpolated UVs.
          vec2 screen=(gl_FragCoord.xy-viewport.xy)/viewport.zw;
          vec2 p=(gl_FragCoord.xy-viewport.xy)/viewport.w;
          vec2 d=p-lightPosition*vec2(viewport.z/viewport.w,1.);
          float r=length(d);
          vec3 base=mix(vec3(.012,.025,.058),vec3(.003,.008,.025),screen.y);
          vec3 stars=vec3(0.);
          vec4 viewRay=projectionInverse*vec4(screen*2.-1.,1.,1.);
          vec3 earthRay=normalize(cameraRotation*viewRay.xyz);
          if(night>.001){
            float ra=atan(earthRay.y,earthRay.x)+sidereal;
            vec2 mapUv=vec2(fract(.5-ra/6.28318530718),asin(clamp(earthRay.z,-1.,1.))/3.14159265359+.5);
            // Preserve diffuse Milky Way/detail; compact bright cores are separate points.
            stars=texture2D(starMap,mapUv).rgb*1.65;
          }
          float chord=length(earthRay-moonDirection);
          float edge=max(fwidth(chord),.00001);
          float disk=(1.-smoothstep(moonRadius-edge,moonRadius+edge,chord))*moonAmount;
          vec3 moon=vec3(0.);
          if(disk>0.){
            float along=dot(earthRay,moonDirection);
            float radius=sin(moonRadius);
            float distance=along-sqrt(max(0.,along*along-1.+radius*radius));
            vec3 normal=normalize(earthRay*distance-moonDirection);
            vec3 surfaceNormal=lunarSurface*normal;
            vec2 moonUv=vec2(atan(surfaceNormal.y,surfaceNormal.x)/6.28318530718+.5,
              asin(clamp(surfaceNormal.z,-1.,1.))/3.14159265359+.5);
            vec3 albedo=texture2D(moonMap,moonUv).rgb;
            float lit=max(0.,dot(normal,lunarSun));
            float facing=max(.001,dot(normal,-earthRay));
            // A rough lunar surface: retain detail at full moon, with a real
            // moving terminator and a very faint earthshine on the dark side.
            float reflectance=lit/(lit+facing+.001);
            moon=albedo*(7.*reflectance+.006*(1.-moonFraction))*disk;
          }
          float halo=exp(-chord/max(moonRadius,.0001)*2.5)*moonFraction*moonAmount*.08;
          moon+=vec3(.72,.81,1.)*halo;
          float moonAlpha=max(disk,halo);
          vec3 sun=vec3(0.);
          float sunAlpha=0.;
          if(sunAmount!=0.){
            float sunRadius=mix(.021,.044,snowAmount);
            float sunDisk=1.-smoothstep(sunRadius*(1.-snowAmount*.65),sunRadius,r);
            vec3 sunColor=mix(vec3(1.,.95,.83),vec3(1.,.58,.24),warmth);
            float sunlight=(sunDisk*3.5+exp(-r*30.)*.7+exp(-r*8.)*.16)*sunAmount;
            sun=sunColor*sunlight;
            sunAlpha=clamp((sunDisk+exp(-r*18.)*.32)*sunAmount,0.,1.);
          }
          float alpha=max(max(night,sunAlpha),moonAlpha);
          vec3 rgb=(base+stars*(1.-disk))*night+moon+sun;
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
    this.lunar.update(now, camera.position);
    this.mesh.visible = state.night !== 0 || light.sun !== 0 || state.blizzard !== 1;
    if (!this.mesh.visible) return;
    const u = this.material.uniforms;
    u.time.value = time;
    u.projectionInverse.value.copy(camera.projectionMatrixInverse);
    u.cameraRotation.value.setFromMatrix4(camera.matrixWorld);
    u.sidereal.value=siderealAngle(now);
    u.night.value = state.night;
    u.lightPosition.value.set(light.x, light.y);
    u.sunAmount.value = light.sun;
    u.moonAmount.value = light.moon;
    // Relocate the whole lunar frame, including sunlight and surface normals:
    // the real phase and near-side texture survive artistic screen placement.
    u.moonDirection.value.set(light.x*2-1,Math.max(.78,light.y)*2-1,.5)
      .unproject(camera).sub(camera.position).normalize();
    this.moonRotation.setFromUnitVectors(this.lunar.direction,u.moonDirection.value);
    u.lunarSun.value.copy(this.lunar.sunDirection).applyQuaternion(this.moonRotation);
    this.moonMatrix.makeRotationFromQuaternion(this.moonRotation);
    this.moonInverse.setFromMatrix4(this.moonMatrix).transpose();
    u.lunarSurface.value.copy(this.lunar.surfaceRotation).multiply(this.moonInverse);
    // Modest visual magnification preserves readable surface detail at widget
    // size; phase, libration and distance variation remain real.
    u.moonRadius.value = this.lunar.angularRadius*2.4;
    u.moonFraction.value = this.lunar.fraction;
    u.warmth.value = light.warmth;
    u.snowAmount.value = state.snow;
  }
}
