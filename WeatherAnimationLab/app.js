import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode, BloomEffect, Effect } from 'postprocessing';
import { SkyMaterial, PrecomputedTexturesLoader, AerialPerspectiveEffect, StarsGeometry, StarsMaterial } from '@takram/three-atmosphere';
import { CloudsEffect } from '@takram/three-clouds';
import { STBNLoader, Geodetic, Ellipsoid } from '@takram/three-geospatial';
import { Precipitation } from './precipitation.js';

const $ = id => document.getElementById(id);
const errors = [];
const originalError = console.error.bind(console);
console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
const rad = THREE.MathUtils.degToRad;
const presets = {
  sunset: { title: 'The last light', index: '01', elevation: -.9, azimuth: -12, coverage: .28, exposure: 10, wind: 12, rain: 0, snow: 0, night: 0, temp: 21, condition: 'Partly cloudy', density: .1, height: 750 },
  sunrise: { title: 'Before the world wakes', index: '02', elevation: 2, azimuth: 18, coverage: .17, exposure: 9, wind: 7, rain: 0, snow: 0, night: 0, temp: 14, condition: 'Mostly clear', density: .065, height: 550 },
  storm: { title: 'A sky coming undone', index: '03', elevation: -10, azimuth: -12, coverage: .48, exposure: 1.6, wind: 44, rain: 1, snow: 0, night: 1, temp: 18, condition: 'Thunderstorms', density: .14, height: 1500 },
  snow: { title: 'The quiet hours', index: '04', elevation: 1, azimuth: 24, coverage: .4, exposure: 6, wind: 10, rain: 0, snow: 1, night: .22, temp: -3, condition: 'Snow showers', density: .1, height: 1000 },
};
let key = 'sunset', current, target, paused = false, cycle = false, frames = 0, elapsed = 0, fps = 0;
let flashAge = 99, nextFlash = 6, boltPoints = [];
let renderer, camera, composer, clouds, skyMaterial, atmosphere, particles, grade, bloom, starsMaterial, stars;
let localFrame;

// A restrained display-space grade, plus a spatial lightning pulse. Weather
// volumes and their illumination are rendered by Takram before this pass.
class WeatherGrade extends Effect {
  constructor() {
    super('WeatherGrade', `
      uniform float nightAmount, flashAmount;
      uniform vec2 flashPosition;
      void mainImage(const in vec4 c, const in vec2 uv, out vec4 outColor) {
        float luminance=dot(c.rgb,vec3(.2126,.7152,.0722));
        vec3 vivid=mix(vec3(luminance),c.rgb,1.16);
        vec3 night = vivid * vec3(.26,.38,.60) + vec3(.004,.007,.013);
        vec3 color = mix(vivid, night, nightAmount);
        float glow = exp(-length((uv-flashPosition)*vec2(1.,1.2))*5.);
        float structure = .2 + dot(c.rgb,vec3(.25,.5,.25));
        color += flashAmount * glow * structure * vec3(.48,.57,.88);
        float noise = fract(sin(dot(uv*vec2(1316.,1396.),vec2(12.9898,78.233)))*43758.5453)-.5;
        color += noise/255.;
        outColor = vec4(color,c.a);
      }`, { uniforms: new Map([['nightAmount', new THREE.Uniform(0)], ['flashAmount', new THREE.Uniform(0)], ['flashPosition', new THREE.Uniform(new THREE.Vector2(.7,.65))]]) });
  }
}

async function texture2D(url) {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}
async function texture3D(url, size) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== size ** 3) throw new Error(`Invalid cloud texture: ${url}`);
  const texture = new THREE.Data3DTexture(bytes, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function setScene(name, immediate = false) {
  if (!presets[name]) return;
  key = name;
  target = { ...presets[name] };
  if (immediate || !current) current = { ...target };
  cycle = false;
  $('cycle').setAttribute('aria-pressed', false);
  $('title').textContent = target.title;
  $('eyebrow').textContent = `STUDY ${target.index}`;
  $('temperature').textContent = target.temp + '°';
  $('condition').textContent = target.condition;
  $('sun').value = target.elevation;
  $('clouds').value = target.coverage;
  $('cycle').textContent = name === 'sunrise' || name === 'snow' ? 'Play sunrise' : 'Play sunset';
  document.querySelectorAll('[data-scene]').forEach(button => button.classList.toggle('active', button.dataset.scene === name));
  updateLabels();
  flashAge = 99;
  nextFlash = elapsed + 6;
}
function updateLabels() {
  $('sun-value').textContent = `${Number(target.elevation).toFixed(1)}°`;
  $('cloud-value').textContent = `${Math.round(target.coverage * 100)}%`;
}
function togglePause() { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', paused); }
function toggleOverlay() { $('weather').classList.toggle('hidden'); $('overlay').setAttribute('aria-pressed', !$('weather').classList.contains('hidden')); }

function triggerFlash() {
  if (key !== 'storm') return;
  flashAge = 0;
  const x = .24 + Math.random()*.52;
  const y = .14 + Math.random()*.18;
  grade.uniforms.get('flashPosition').value.set(x, 1-y);
  boltPoints = [{ x, y }];
  let px = x, py = y;
  for (let i=0; i<15; i++) { px += (Math.random()-.48)*.025; py += .013+Math.random()*.012; boltPoints.push({x:px,y:py}); }
  particles.setBolt(boltPoints);
}

async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NoToneMapping;
  $('scene').append(renderer.domElement);
  camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 1, 350000);
  camera.position.copy(new Geodetic(rad(14.42),rad(50.08),180).toECEF());
  camera.up.copy(Ellipsoid.WGS84.getSurfaceNormal(camera.position));
  localFrame=Ellipsoid.WGS84.getEastNorthUpFrame(camera.position);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,Math.cos(rad(18)),Math.sin(rad(18))).transformDirection(localFrame).multiplyScalar(10000)));
  const scene = new THREE.Scene();
  const [textures, weather, shape, detail, turbulence, stbn, starBytes] = await Promise.all([
    new PrecomputedTexturesLoader({ format: 'binary', combinedScattering: true, higherOrderScattering: true }).loadAsync('./atmosphere'),
    texture2D('./clouds/local_weather.png'), texture3D('./clouds/shape.bin',128), texture3D('./clouds/shape_detail.bin',32),
    texture2D('./clouds/turbulence.png'), new STBNLoader().loadAsync('./clouds/stbn.bin'),
    fetch('./atmosphere/stars.bin').then(r=>r.arrayBuffer()),
  ]);
  skyMaterial = new SkyMaterial({ ...textures, ground: true, groundAlbedo: new THREE.Color(.015,.017,.02), moon: false, sunAngularRadius: .008 });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2,2), skyMaterial);
  sky.frustumCulled = false;
  scene.add(sky);
  starsMaterial = new StarsMaterial({ ...textures });
  starsMaterial.intensity = 2;
  stars = new THREE.Points(new StarsGeometry(starBytes), starsMaterial);
  stars.frustumCulled = false;
  scene.add(stars);
  clouds = new CloudsEffect(camera);
  Object.assign(clouds, textures);
  clouds.localWeatherTexture = weather; clouds.shapeTexture = shape; clouds.shapeDetailTexture = detail;
  clouds.turbulenceTexture = turbulence; clouds.stbnTexture = stbn;
  clouds.qualityPreset = 'high';
  clouds.temporalUpscale = true;
  // Current upstream light-shaft cascade boundaries are visible near sunrise.
  // Keep cloud self-shadowing; omit that extra pass for this first study.
  clouds.lightShafts = false;
  clouds.shadow.cascadeCount = 1;
  clouds.shadow.mapSize.set(1024,1024);
  clouds.shadow.maxFar = 120000;
  clouds.clouds.maxIterationCount = 280;
  clouds.clouds.maxShadowLengthIterationCount = 120;
  clouds.shapeOffset.set(120,40,60);
  clouds.shapeRepeat.setScalar(.00055);
  clouds.localWeatherOffset.set(.13,.27);
  atmosphere = new AerialPerspectiveEffect(camera, { ...textures, sky: false, ground: false, moon: false });
  atmosphere.stbnTexture = stbn;
  const routeClouds = () => {
    atmosphere.overlay = clouds.atmosphereOverlay;
    atmosphere.shadow = clouds.atmosphereShadow;
    atmosphere.shadowLength = clouds.atmosphereShadowLength;
  };
  clouds.events.addEventListener('change',routeClouds);
  routeClouds();
  composer = new EffectComposer(renderer,{ frameBufferType:THREE.HalfFloatType, multisampling:0 });
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new EffectPass(camera,clouds,atmosphere));
  bloom = new BloomEffect({ intensity:.35, luminanceThreshold:1.5, luminanceSmoothing:.5, mipmapBlur:true });
  composer.addPass(new EffectPass(camera,bloom,new ToneMappingEffect({ mode:ToneMappingMode.AGX })));
  grade = new WeatherGrade();
  composer.addPass(new EffectPass(camera,grade));
  particles = new Precipitation(renderer);
  setScene(new URLSearchParams(location.search).get('scene') || 'sunset',true);
  window.addEventListener('resize',()=>{
    camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); particles.resize(innerWidth,innerHeight);
  });
  window.lab = { ready:true, setScene, flash:triggerFlash, freezeFlash:false,
    diagnostics:()=>({ frames, fps:Math.round(fps), errors, scroll:document.documentElement.scrollHeight>innerHeight || document.documentElement.scrollWidth>innerWidth,
      width:innerWidth,height:innerHeight,scene:key,renderer:renderer.getContext().getParameter(renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL || renderer.getContext().RENDERER),
      textures:renderer.info.memory.textures,programs:renderer.info.programs.length,paused,elapsed }) };
  $('loading').classList.add('hidden');
  let previous=performance.now(), sampleStart=previous, sampleFrames=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-previous)/1000,.08); previous=now;
    if (!paused) {
      elapsed+=dt;
      if(cycle) {
        const direction=key==='sunrise'||key==='snow'?1:-1;
        target.elevation+=direction*dt*.18;
        if(target.elevation>12 || target.elevation< -12) { cycle=false; $('cycle').setAttribute('aria-pressed',false); }
        $('sun').value=target.elevation;updateLabels();
      }
      for(const field of ['elevation','azimuth','coverage','exposure','wind','rain','snow','night','density','height'])
        current[field]=THREE.MathUtils.damp(current[field],target[field],1.25,dt);
      if(key==='storm'&&elapsed>nextFlash) { triggerFlash();nextFlash=elapsed+7+Math.random()*11; }
      if(!window.lab.freezeFlash) flashAge+=dt;
    }
    const flash = flashAge<.8 ? (Math.exp(-flashAge*12)+.65*Math.exp(-Math.pow((flashAge-.17)*25,2))) : 0;
    const elev=rad(current.elevation), az=rad(current.azimuth);
    const sun=new THREE.Vector3(Math.sin(az)*Math.cos(elev),Math.cos(az)*Math.cos(elev),Math.sin(elev)).transformDirection(localFrame);
    skyMaterial.sunDirection.copy(sun); atmosphere.sunDirection.copy(sun); starsMaterial.sunDirection.copy(sun);
    stars.visible=current.elevation < -4;
    // Night storm: use an artistic low-intensity overhead illumination on the
    // cloud volume; the astronomical sky remains at the actual lab sun angle.
    clouds.sunDirection.copy(sun).lerp(new THREE.Vector3(-.7,.69,.15).transformDirection(localFrame),current.night).normalize();
    clouds.skyLightScale=THREE.MathUtils.lerp(1,.22,current.night);
    clouds.coverage=current.coverage;
    clouds.cloudLayers[0].densityScale=current.density;
    clouds.cloudLayers[1].densityScale=current.density*.7;
    clouds.cloudLayers[1].height=current.height;
    clouds.localWeatherVelocity.set(current.wind*.000025,current.wind*.000007);
    clouds.shapeVelocity.set(current.wind*.00015,0,current.wind*.00003);
    clouds.shapeDetailVelocity.set(current.wind*.0002,current.wind*.0001,0);
    renderer.toneMappingExposure=current.exposure;
    grade.uniforms.get('nightAmount').value=current.night*.94;
    grade.uniforms.get('flashAmount').value=flash;
    composer.render(paused?0:dt);
    particles.render(elapsed,current.rain,current.snow,current.wind,flash);
    frames++;sampleFrames++;
    if(now-sampleStart>1000){fps=sampleFrames*1000/(now-sampleStart);$('fps').textContent=`${Math.round(fps)} FPS · WEBGL2`;sampleStart=now;sampleFrames=0;}
  });
}

document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>setScene(button.dataset.scene)));
$('sun').addEventListener('input',e=>{target.elevation=+e.target.value;cycle=false;$('cycle').setAttribute('aria-pressed',false);updateLabels();});
$('clouds').addEventListener('input',e=>{target.coverage=+e.target.value;updateLabels();});
$('pause').addEventListener('click',togglePause);
$('overlay').addEventListener('click',toggleOverlay);
$('cycle').addEventListener('click',()=>{cycle=!cycle;$('cycle').setAttribute('aria-pressed',cycle);});
$('close').addEventListener('click',()=>window.close());
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement) return;
  if(['1','2','3','4'].includes(e.key))setScene(Object.keys(presets)[+e.key-1]);
  if(e.key.toLowerCase()==='h')document.body.classList.toggle('clean');
  if(e.key.toLowerCase()==='u')toggleOverlay();
  if(e.code==='Space'){e.preventDefault();togglePause();}
  if(e.key.toLowerCase()==='l')triggerFlash();
});
init().catch(error=>{ window.labError=String(error.stack||error); console.error(error);$('loading').querySelector('p').textContent='The sky could not load';$('loading').querySelector('small').textContent=error.message; });
