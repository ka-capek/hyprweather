import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode, BloomEffect, Effect } from 'postprocessing';
import { SkyMaterial, PrecomputedTexturesLoader, AerialPerspectiveEffect } from '@takram/three-atmosphere';
import { CloudsEffect } from '@takram/three-clouds';
import { STBNLoader, Geodetic, Ellipsoid } from '@takram/three-geospatial';
import { CelestialSky } from './celestial.js';
import { framingSettings, lightComposition } from './composition.js';
import { Precipitation } from './precipitation.js';
import { createRandom, createCloudField, cloudVelocity } from './motion.js';

const $ = id => document.getElementById(id);
const errors = [];
const originalError = console.error.bind(console);
console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
const rad = THREE.MathUtils.degToRad;
const params = new URLSearchParams(location.search);
const softwareCheck = params.get('quality') === 'low';
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0];
const random = createRandom(seed);
const cloudField = createCloudField(random);
let framing = params.get('view') === 'wide' ? 'wide' : 'flat';
const presets = {
  sunset: { title: 'The last light', index: '01', elevation: -.9, azimuth: -12, coverage: .28, exposure: 10, wind: 12, rain: 0, snow: 0, night: 0, temp: 21, condition: 'Partly cloudy', density: .1, height: 750 },
  sunrise: { title: 'Before the world wakes', index: '02', elevation: 2, azimuth: 18, coverage: .17, exposure: 9, wind: 7, rain: 0, snow: 0, night: 0, temp: 14, condition: 'Mostly clear', density: .065, height: 550 },
  storm: { title: 'A sky coming undone', index: '03', elevation: -10, azimuth: -12, coverage: .48, exposure: 1.6, wind: 44, rain: 1, snow: 0, night: 1, temp: 18, condition: 'Thunderstorms', density: .14, height: 1500 },
  snow: { title: 'The quiet hours', index: '04', elevation: 1, azimuth: 24, coverage: .4, exposure: 6, wind: 10, rain: 0, snow: .28, night: 0, temp: -3, condition: 'Light snow', density: .1, height: 1000 },
};
presets.fog = { title: 'Everything slows down', index: '05', elevation: 5, azimuth: 8, coverage: .6, exposure: 5, wind: 4, rain: 0, snow: 0, night: 0, temp: 8, condition: 'Fog', density: .08, height: 550 };
presets.wind = { title: 'The restless sky', index: '06', elevation: 12, azimuth: -15, coverage: .32, exposure: 8, wind: 65, rain: 0, snow: 0, night: 0, temp: 16, condition: 'Strong wind', density: .08, height: 750 };
presets.blizzard = { title: 'Lost in the snowfall', index: '07', elevation: 3, azimuth: 15, coverage: .98, exposure: 3.8, wind: 38, rain: 0, snow: 1, night: 0, temp: -7, condition: 'Heavy snow', density: .17, height: 650 };
presets.night = { title: 'A thousand quiet lights', index: '08', elevation: -12, azimuth: 14, coverage: .06, exposure: 1.4, wind: 5, rain: 0, snow: 0, night: 1, temp: 9, condition: 'Clear night', density: .055, height: 750 };
presets['cloudy-night'] = { ...presets.night, title: 'Moonlight between clouds', index: '09', coverage: .62, wind: 16, density: .12, condition: 'Cloudy night' };
for (const [name, preset] of Object.entries(presets)) {
  preset.fog = name === 'fog' ? 1 : 0;
  preset.blizzard = name === 'blizzard' ? 1 : 0;
}
let key = 'sunset', current, target, paused = false, cycle = false, frames = 0, elapsed = 0, fps = 0;
let flashAge = 99, nextFlash = 6, boltPoints = [];
let renderer, camera, composer, clouds, skyMaterial, atmosphere, particles, grade, bloom, celestial;
let localFrame;

// A restrained display-space grade, plus a spatial lightning pulse. Weather
// volumes and their illumination are rendered by Takram before this pass.
class WeatherGrade extends Effect {
  constructor() {
    super('WeatherGrade', `
      uniform float nightAmount, flashAmount, fogAmount, motionTime, snowHaze;
      uniform vec3 snowFogColor;
      uniform vec2 fogDrift;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise2(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);
      }
      uniform vec2 flashPosition;
      void mainImage(const in vec4 c, const in vec2 uv, out vec4 outColor) {
        float luminance=dot(c.rgb,vec3(.2126,.7152,.0722));
        vec3 vivid=mix(vec3(luminance),c.rgb,1.16);
        vec3 night = vivid * vec3(.26,.38,.60) + vec3(.004,.007,.013);
        vec3 color = mix(vivid, night, nightAmount);
        float glow = exp(-length((uv-flashPosition)*vec2(1.,1.2))*5.);
        float structure = .2 + dot(c.rgb,vec3(.25,.5,.25));
        color += flashAmount * glow * structure * vec3(.48,.57,.88);
        // Slow, overlapping screen-space veils, not a horizon wall or a particle emitter.
        vec2 fp=uv*vec2(3.,5.)+fogDrift+vec2(motionTime*.012,0.);
        float veil=.65*noise2(fp)+.35*noise2(fp*2.1+vec2(8.,motionTime*.007));
        vec3 fogColor=mix(vec3(.44,.52,.60),vec3(.68,.73,.77),uv.y);
        color=mix(color,fogColor,fogAmount*(.76+veil*.18));
        // Distant snowfall extinguishes the sky before foreground flakes are drawn.
        float snowVeil=clamp(snowHaze*(.92+.08*veil),0.,.98);
        color=mix(color,snowFogColor,snowVeil);
        float noise = fract(sin(dot(uv*vec2(1316.,1396.),vec2(12.9898,78.233)))*43758.5453)-.5;
        color += noise/255.;
        outColor = vec4(color,c.a);
      }`, { uniforms: new Map([['snowHaze', new THREE.Uniform(0)], ['snowFogColor', new THREE.Uniform(new THREE.Color(.39,.44,.51))], ['fogAmount', new THREE.Uniform(0)], ['motionTime', new THREE.Uniform(0)], ['fogDrift', new THREE.Uniform(new THREE.Vector2(random()*100, random()*100))], ['nightAmount', new THREE.Uniform(0)], ['flashAmount', new THREE.Uniform(0)], ['flashPosition', new THREE.Uniform(new THREE.Vector2(.7,.65))]]) });
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
  $('condition-icon').classList.toggle('hidden', !['fog','wind'].includes(name));
  $('condition-icon-use').setAttribute('href', `#icon-${name}`);
  $('sun').value = target.elevation;
  $('clouds').value = target.coverage;
  $('cycle').textContent = name === 'sunrise' || name === 'snow' ? 'Play sunrise' : 'Play sunset';
  if (name === 'night' || name === 'cloudy-night') $('cycle').textContent = 'Move moon';
  document.querySelectorAll('[data-scene]').forEach(button => button.classList.toggle('active', button.dataset.scene === name));
  updateLabels();
  flashAge = 99;
  nextFlash = elapsed + 5 + random()*9;
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
  const x = .24 + random()*.52;
  const y = .14 + random()*.18;
  grade.uniforms.get('flashPosition').value.set(x, 1-y);
  boltPoints = [{ x, y }];
  let px = x, py = y;
  for (let i=0; i<15; i++) { px += (random()-.48)*.025; py += .013+random()*.012; boltPoints.push({x:px,y:py}); }
  particles.setBolt(boltPoints);
}

function applyFraming() {
  const flat = framing === 'flat';
  const settings = framingSettings(framing);
  camera.fov = settings.fov;
  const tilt = rad(settings.tilt);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,Math.cos(tilt),Math.sin(tilt)).transformDirection(localFrame).multiplyScalar(10000)));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  $('framing').textContent = flat ? 'View: layered' : 'View: wide';
  $('framing').setAttribute('aria-pressed', String(flat));
}
function toggleFraming() { framing = framing === 'flat' ? 'wide' : 'flat'; applyFraming(); }

async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(softwareCheck ? .5 : Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NoToneMapping;
  $('scene').append(renderer.domElement);
  camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 1, 350000);
  camera.position.copy(new Geodetic(rad(14.42),rad(50.08),180).toECEF());
  camera.up.copy(Ellipsoid.WGS84.getSurfaceNormal(camera.position));
  localFrame=Ellipsoid.WGS84.getEastNorthUpFrame(camera.position);
  applyFraming();
  const scene = new THREE.Scene();
  const [textures, weather, shape, detail, turbulence, stbn] = await Promise.all([
    new PrecomputedTexturesLoader({ format: 'binary', combinedScattering: true, higherOrderScattering: true }).loadAsync('./atmosphere'),
    texture2D('./clouds/local_weather.png'), texture3D('./clouds/shape.bin',128), texture3D('./clouds/shape_detail.bin',32),
    texture2D('./clouds/turbulence.png'), new STBNLoader().loadAsync('./clouds/stbn.bin'),
  ]);
  skyMaterial = new SkyMaterial({ ...textures, ground: false, sun: false, groundAlbedo: new THREE.Color(.015,.017,.02), moon: false, sunAngularRadius: .008 });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2,2), skyMaterial);
  sky.frustumCulled = false;
  scene.add(sky);
  celestial = new CelestialSky(scene, seed);
  clouds = new CloudsEffect(camera);
  Object.assign(clouds, textures);
  clouds.localWeatherTexture = weather; clouds.shapeTexture = shape; clouds.shapeDetailTexture = detail;
  clouds.turbulenceTexture = turbulence; clouds.stbnTexture = stbn;
  clouds.qualityPreset = softwareCheck ? 'low' : 'high';
  clouds.temporalUpscale = true;
  // Current upstream light-shaft cascade boundaries are visible near sunrise.
  // Keep cloud self-shadowing; omit that extra pass for this first study.
  clouds.lightShafts = false;
  clouds.shadow.cascadeCount = 1;
  clouds.shadow.mapSize.setScalar(softwareCheck ? 256 : 1024);
  clouds.shadow.maxFar = 120000;
  clouds.clouds.maxIterationCount = softwareCheck ? 80 : 280;
  clouds.clouds.maxShadowLengthIterationCount = softwareCheck ? 24 : 120;
  clouds.shapeOffset.fromArray(cloudField.shape);
  clouds.shapeDetailOffset.fromArray(cloudField.detail);
  clouds.shapeRepeat.setScalar(.00055);
  clouds.localWeatherOffset.fromArray(cloudField.weather);
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
  particles = new Precipitation(renderer, createRandom(seed ^ 0x9e3779b9));
  setScene(presets[params.get('scene')] ? params.get('scene') : 'sunset',true);
  window.addEventListener('resize',()=>{
    camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); particles.resize(innerWidth,innerHeight);
  });
  window.lab = { ready:true, setScene, flash:triggerFlash, freezeFlash:false,
    settleFrame: () => new Promise(resolve => requestAnimationFrame(() => {
      renderer.getContext().finish();
      requestAnimationFrame(resolve);
    })),
    diagnostics:()=>({ frames, fps:Math.round(fps), errors, scroll:document.documentElement.scrollHeight>innerHeight || document.documentElement.scrollWidth>innerWidth,
      width:innerWidth,height:innerHeight,scene:key,seed,framing,horizonClearance:framingSettings(framing).tilt-camera.fov/2,light:lightComposition(current.elevation,current.azimuth,current.night,current.blizzard,current.snow),snow:current.snow,blizzard:current.blizzard,night:current.night,cloudOffset:clouds.localWeatherOffset.toArray(),shapeOffset:clouds.shapeOffset.toArray(),renderer:renderer.getContext().getParameter(renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL || renderer.getContext().RENDERER),
      textures:renderer.info.memory.textures,programs:renderer.info.programs.length,paused,elapsed }) };
  $('loading').classList.add('hidden');
  let previous=performance.now(), sampleStart=previous, sampleFrames=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-previous)/1000,.08); previous=now;
    if (!paused) {
      elapsed+=dt;
      if(cycle) {
        const direction=['sunrise','snow','night','cloudy-night'].includes(key)?1:-1;
        target.elevation+=direction*dt*.18;
        if(target.elevation>12 || target.elevation< -12) { cycle=false; $('cycle').setAttribute('aria-pressed',false); }
        $('sun').value=target.elevation;updateLabels();
      }
      for(const field of ['elevation','azimuth','coverage','exposure','wind','rain','snow','night','density','height','fog','blizzard'])
        current[field]=THREE.MathUtils.damp(current[field],target[field],1.25,dt);
      if(key==='storm'&&elapsed>nextFlash) { triggerFlash();nextFlash=elapsed+7+random()*11; }
      if(!window.lab.freezeFlash) flashAge+=dt;
    }
    const flash = flashAge<.8 ? (Math.exp(-flashAge*12)+.65*Math.exp(-Math.pow((flashAge-.17)*25,2))) : 0;
    const light = lightComposition(current.elevation,current.azimuth,current.night,current.blizzard,current.snow);
    const elev=rad(current.elevation), az=rad(current.azimuth);
    const sun=new THREE.Vector3(Math.sin(az)*Math.cos(elev),Math.cos(az)*Math.cos(elev),Math.sin(elev)).transformDirection(localFrame);
    skyMaterial.sunDirection.copy(sun); atmosphere.sunDirection.copy(sun);
    // Night storm: use an artistic low-intensity overhead illumination on the
    // cloud volume; the astronomical sky remains at the actual lab sun angle.
    const moonDirection = new THREE.Vector3(light.x*2-1,light.y*2-1,.5).unproject(camera).sub(camera.position).normalize();
    clouds.sunDirection.copy(sun).lerp(moonDirection,current.night).normalize();
    clouds.skyLightScale=THREE.MathUtils.lerp(1,.22,current.night);
    clouds.coverage=current.coverage;
    clouds.cloudLayers[0].densityScale=current.density;
    clouds.cloudLayers[1].densityScale=current.density*.7;
    clouds.cloudLayers[1].height=current.height;
    const velocity = cloudVelocity(elapsed, current.wind, cloudField.phase);
    clouds.localWeatherVelocity.set(velocity.x*.000025,velocity.y*.000025);
    clouds.shapeVelocity.set(velocity.x*.00015,velocity.y*.00015,.000025*current.wind);
    clouds.shapeDetailVelocity.set(velocity.x*.00019,velocity.y*.00019,.000037*current.wind);
    celestial.update(elapsed,current,light,innerWidth,innerHeight);
    const snowFog = new THREE.Color().setRGB(.39+light.warmth*.045*(1-current.blizzard)-current.blizzard*.19,.44-current.blizzard*.20,.51-light.warmth*.045*(1-current.blizzard)-current.blizzard*.205);
    grade.uniforms.get('snowHaze').value=light.haze;
    grade.uniforms.get('snowFogColor').value.copy(snowFog);
    renderer.toneMappingExposure=current.exposure;
    grade.uniforms.get('fogAmount').value=current.fog;
    grade.uniforms.get('motionTime').value=elapsed;
    grade.uniforms.get('nightAmount').value=current.night*.58;
    grade.uniforms.get('flashAmount').value=flash;
    composer.render(paused?0:dt);
    particles.render(elapsed,current.rain,current.snow,current.wind,flash,light,snowFog,current.blizzard);
    frames++;sampleFrames++;
    if(now-sampleStart>1000){fps=sampleFrames*1000/(now-sampleStart);$('fps').textContent=`${Math.round(fps)} FPS · WEBGL2`;sampleStart=now;sampleFrames=0;}
  });
}

document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>setScene(button.dataset.scene)));
$('sun').addEventListener('input',e=>{target.elevation=+e.target.value;cycle=false;$('cycle').setAttribute('aria-pressed',false);updateLabels();});
$('clouds').addEventListener('input',e=>{target.coverage=+e.target.value;updateLabels();});
$('framing').addEventListener('click',toggleFraming);
$('pause').addEventListener('click',togglePause);
$('overlay').addEventListener('click',toggleOverlay);
$('cycle').addEventListener('click',()=>{cycle=!cycle;$('cycle').setAttribute('aria-pressed',cycle);});
$('close').addEventListener('click',()=>window.close());
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement) return;
  if(['1','2','3','4','5','6','7','8','9'].includes(e.key))setScene(Object.keys(presets)[+e.key-1]);
  if(e.key.toLowerCase()==='h')document.body.classList.toggle('clean');
  if(e.key.toLowerCase()==='u')toggleOverlay();
  if(e.code==='Space'){e.preventDefault();togglePause();}
  if(e.key.toLowerCase()==='v')toggleFraming();
  if(e.key.toLowerCase()==='l')triggerFlash();
});
init().catch(error=>{ window.labError=String(error.stack||error); console.error(error);$('loading').querySelector('p').textContent='The sky could not load';$('loading').querySelector('small').textContent=error.message; });
