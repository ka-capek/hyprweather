import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode, BloomEffect, Effect } from 'postprocessing';
import { SkyMaterial, PrecomputedTexturesLoader, AerialPerspectiveEffect, AtmosphereParameters } from '@takram/three-atmosphere';
import { CloudsEffect } from '@takram/three-clouds';
import { STBNLoader, Geodetic, Ellipsoid } from '@takram/three-geospatial';
import { weatherScene, WMO } from './weather-scene.js';
import { CelestialSky } from './celestial.js';
import { StarCores } from './star-cores.js';
import { framingSettings, lightComposition } from './composition.js';
import { Lightning } from './lightning.js';
import { HDRLightning } from './hdr-lightning.js';
import { lightningPulse } from './lightning-path.js';
import { Precipitation } from './precipitation.js';
import { createRandom, createCloudField, cloudVelocity } from './motion.js';

const $ = id => document.getElementById(id);
const errors = [];
const originalError = console.error.bind(console);
const recordError = message => { errors.push(message); if(errors.length>100)errors.shift(); };
console.error = (...args) => { recordError(args.map(String).join(' ')); originalError(...args); };
window.addEventListener('error', e => recordError(e.message));
window.addEventListener('unhandledrejection', e => recordError(String(e.reason)));
const rad = THREE.MathUtils.degToRad;
const params = new URLSearchParams(location.search);
const embedded = params.has('embedded');
if (embedded) document.body.classList.add('embedded');
let liveModel = null, lastLiveMinute = -1, notifyRendered = false;
let previewIndex = -1;
const previewScenes = Object.keys(WMO).flatMap(code => [true, false].map(isDay => ({weatherCode:Number(code),isDay})));
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
presets.fog = { title: 'Everything slows down', index: '05', elevation: 5, azimuth: 8, coverage: .22, exposure: 4, wind: 4, rain: 0, snow: 0, night: 0, temp: 8, condition: 'Fog', density: .045, height: 550 };
presets.wind = { title: 'The restless sky', index: '06', elevation: 12, azimuth: -15, coverage: .32, exposure: 8, wind: 65, rain: 0, snow: 0, night: 0, temp: 16, condition: 'Strong wind', density: .08, height: 750 };
presets.blizzard = { title: 'Lost in the snowfall', index: '07', elevation: 3, azimuth: 15, coverage: .98, exposure: 3.8, wind: 38, rain: 0, snow: 1, night: 0, temp: -7, condition: 'Heavy snow', density: .17, height: 650 };
presets.night = { title: 'A thousand quiet lights', index: '08', elevation: -12, azimuth: 14, coverage: .06, exposure: 1.4, wind: 5, rain: 0, snow: 0, night: 1, temp: 9, condition: 'Clear night', density: .055, height: 750 };
presets['cloudy-night'] = { ...presets.night, title: 'Moonlight between clouds', index: '09', coverage: .42, wind: 16, density: .12, condition: 'Cloudy night' };
presets['light-rain'] = { ...presets.sunrise, title:'A passing drizzle', index:'10', condition:'Light rain', rain:.24, coverage:.5, elevation:12 };
presets.rain = { ...presets['light-rain'], title:'Rain on a quiet day', index:'11', condition:'Rain', rain:.55, coverage:.7 };
presets.downpour = { ...presets.rain, title:'The sky opens', index:'12', condition:'Heavy rain', rain:1, coverage:.94, exposure:4 };
presets.storm = { ...presets.storm, night:0, elevation:10, exposure:4, coverage:.9 };
for (const [name, preset] of Object.entries(presets)) {
  preset.fog = name === 'fog' ? .8 : 0;
  preset.lightning = name === 'storm' ? 1 : 0;
  preset.blizzard = name === 'blizzard' ? 1 : 0;
}
let key = 'sunset', current, target, paused = false, cycle = false, frames = 0, elapsed = 0, fps = 0;
let flashAge = 99, nextFlash = 6;
let renderer, camera, composer, clouds, skyMaterial, atmosphere, particles, grade, bloom, celestial, lightning, lightningPass, cloudAtmosphere, hdrLightning;
let localFrame;
const viewAim=new THREE.Vector3();
function aimCamera() {
  const tilt=rad(framingSettings(framing).tilt);
  viewAim.set(0,Math.cos(tilt),Math.sin(tilt));
  viewAim.transformDirection(localFrame).multiplyScalar(10000).add(camera.position);
  camera.lookAt(viewAim);camera.updateMatrixWorld(true);
}


// A restrained display-space grade, plus a spatial lightning pulse. Weather
// volumes and their illumination are rendered by Takram before this pass.
class WeatherGrade extends Effect {
  constructor() {
    super('WeatherGrade', `
      uniform float nightAmount, flashAmount, fogAmount, snowHaze, viewAspect;
      uniform vec2 fogMotion;
      uniform sampler2D cloudOpacity;
      uniform highp sampler3D fogVolume;
      uniform float nightOvercast;
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
        if(flashAmount>0.){
          float glow = exp(-length((uv-flashPosition)*vec2(1.,1.2))*5.);
          float structure = .2 + dot(c.rgb,vec3(.25,.5,.25));
          color += flashAmount * glow * structure * vec3(.48,.57,.88);
        }
        // Integrate a moving 3D density field along perspective rays. Height
        // falloff creates a distant mist bank, without a ground/sea silhouette.
        if(fogAmount>.001){
          vec3 ray=normalize(vec3((uv.x-.5)*viewAspect*.72,(uv.y-.46)*.72,1.));
          vec3 drift=vec3(fogMotion.x*18.,0.,fogMotion.y*12.);
          vec3 offset=vec3(fogDrift.x,0.,fogDrift.y);
          float transmittance=1.;
          vec3 scattering=vec3(0.);
          float previous=0.;
          float backlight=exp(-length((uv-vec2(.72,.8))*vec2(viewAspect,1.))*3.);
          float nightBlend=clamp(nightAmount/.42,0.,1.);
          for(int i=0;i<16;i++){
            float t=(float(i)+1.)/16.;
            float distance=4.+t*t*160.;
            float stepLength=distance-previous;
            vec3 p=vec3(0.,5.,0.)+ray*(distance-stepLength*.5);
            vec3 q=(p+drift)*vec3(.0035,.026,.0016)+offset;
            float coarse=texture(fogVolume,q).r;
            float detail=texture(fogVolume,q*2.13+vec3(3.1,7.7,1.9)).r;
            float density=smoothstep(.71,.88,coarse*.78+detail*.22);
            float height=exp(-max(p.y-3.,0.)*.055);
            density=(density*1.25+.025)*height*fogAmount;
            float opacity=1.-exp(-density*stepLength*.032);
            // A nearby sample towards the light gives soft self-shading. Far
            // banks blend toward cooler haze; foreground wisps stay distinct.
            float shade=texture(fogVolume,q+vec3(.04,.075,-.03)).r;
            float illumination=clamp(.72+(coarse-shade)*2.5+backlight*.32,.38,1.2);
            vec3 day=mix(vec3(.16,.22,.28),vec3(.43,.49,.54),t)*illumination;
            day+=vec3(.055,.042,.023)*backlight;
            vec3 night=mix(vec3(.025,.043,.066),vec3(.080,.110,.15),t)*illumination;
            vec3 bank=mix(day,night,nightBlend)+flashAmount*vec3(.18,.22,.30);
            scattering+=transmittance*opacity*bank;
            transmittance*=1.-opacity;
            previous=distance;
            if(transmittance<.025)break;
          }
          color=color*transmittance+scattering;
        }
        // Dramatic scattered sky glow: moving highlights restricted to
        // the renderer's cloud opacity, never painted across clear star gaps.
        if(nightOvercast>.001){
          vec2 q=uv*vec2(viewAspect,1.)*3.2+fogDrift+fogMotion*.35;
          float bank=.68*noise2(q)+.23*noise2(q*2.07+7.)+.09*noise2(q*4.13);
          float highlight=pow(smoothstep(.30,.76,bank),1.4);
          float fill=highlight*texture2D(cloudOpacity,uv).a*nightOvercast;
          color+=vec3(.048,.071,.105)*fill;
        }
        // Fine distant snow uses a much cheaper extinction field.
        float snowVeil=snowHaze;
        if(snowHaze>.001)snowVeil*=.94+.06*noise2(uv*vec2(viewAspect,1.)*4.+fogMotion);
        color=mix(color,snowFogColor,clamp(snowVeil,0.,.98));
        float noise = fract(sin(dot(uv*vec2(1316.,1396.),vec2(12.9898,78.233)))*43758.5453)-.5;
        color += noise/255.;
        outColor = vec4(color,c.a);
      }`, { uniforms: new Map([['fogVolume', new THREE.Uniform(null)], ['cloudOpacity', new THREE.Uniform(null)], ['nightOvercast', new THREE.Uniform(0)], ['viewAspect', new THREE.Uniform(1)], ['fogMotion', new THREE.Uniform(new THREE.Vector2())], ['snowHaze', new THREE.Uniform(0)], ['snowFogColor', new THREE.Uniform(new THREE.Color(.39,.44,.51))], ['fogAmount', new THREE.Uniform(0)], ['fogDrift', new THREE.Uniform(new THREE.Vector2(random()*100, random()*100))], ['nightAmount', new THREE.Uniform(0)], ['flashAmount', new THREE.Uniform(0)], ['flashPosition', new THREE.Uniform(new THREE.Vector2(.7,.65))]]) });
  }
  update() {
    // Clouds swaps temporal targets during its own update earlier in the frame.
    this.uniforms.get('cloudOpacity').value=clouds.atmosphereOverlay?.map ?? null;
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
  $('day-night').textContent = target.night > .5 ? 'Night' : 'Day';
  $('day-night').setAttribute('aria-pressed',target.night > .5);
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
  if (!target?.lightning) return;
  flashAge = 0;
  const point=lightning.trigger();
  grade.uniforms.get('flashPosition').value.set(point.x,1-point.y);
}

function applyFraming() {
  const flat = framing === 'flat';
  const settings = framingSettings(framing);
  camera.fov = settings.fov;
  aimCamera();
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
  const [textures, weather, shape, detail, turbulence, stbn, starMap, moonMap, starCoresData] = await Promise.all([
    new PrecomputedTexturesLoader({ format: 'binary', combinedScattering: true, higherOrderScattering: true }).loadAsync('./atmosphere'),
    texture2D('./clouds/local_weather.png'), texture3D('./clouds/shape.bin',128), texture3D('./clouds/shape_detail.bin',32),
    texture2D('./clouds/turbulence.png'), new STBNLoader().loadAsync('./clouds/stbn.bin'),
    new THREE.TextureLoader().loadAsync('./sky/nasa-starmap-8k.jpg'),
    new THREE.TextureLoader().loadAsync('./sky/nasa-moon-2k.jpg'),
    fetch('./sky/nasa-star-cores.bin').then(response=>{if(!response.ok)throw new Error('Unable to load star cores');return response.arrayBuffer();}),
  ]);
  skyMaterial = new SkyMaterial({ ...textures, ground: false, sun: false, groundAlbedo: new THREE.Color(.015,.017,.02), moon: false, sunAngularRadius: .008 });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2,2), skyMaterial);
  sky.frustumCulled = false;
  scene.add(sky);
  starMap.colorSpace=THREE.SRGBColorSpace;
  starMap.wrapS=THREE.RepeatWrapping;starMap.wrapT=THREE.ClampToEdgeWrapping;
  // Isotropic mip selection near the celestial pole smears stars radially.
  starMap.minFilter=THREE.LinearFilter;starMap.generateMipmaps=false;
  moonMap.colorSpace=THREE.SRGBColorSpace;
  moonMap.wrapS=THREE.RepeatWrapping;
  celestial = new CelestialSky(scene, seed, starMap, moonMap);
  const starCores = new StarCores(scene,starCoresData,celestial.material.uniforms);
  cloudAtmosphere = new AtmosphereParameters();
  clouds = new CloudsEffect(camera,undefined,cloudAtmosphere);
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
  lightning = new Lightning(createRandom(seed ^ 0x85ebca6b));
  lightningPass = new RenderPass(lightning.scene,lightning.camera);
  lightningPass.clearPass.enabled=false;
  composer.addPass(lightningPass);
  bloom = new BloomEffect({ intensity:.35, luminanceThreshold:1.5, luminanceSmoothing:.5, mipmapBlur:true });
  grade = new WeatherGrade();
  grade.uniforms.get('fogVolume').value=shape;
  // Preserve bloom → tone mapping → grade ordering in one shader, avoiding a
  // full-resolution half-float framebuffer write/read between the last two.
  composer.addPass(new EffectPass(camera,bloom,new ToneMappingEffect({ mode:ToneMappingMode.AGX }),grade));
  particles = new Precipitation(renderer, createRandom(seed ^ 0x9e3779b9));
  hdrLightning = new HDRLightning($('scene'));
  setScene(presets[params.get('scene')] ? params.get('scene') : 'sunset',true);
  const resize = () => {
    const width=Math.max(1,$('scene').clientWidth),height=Math.max(1,$('scene').clientHeight);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    composer.setSize(width,height);particles.resize(width,height);lightning.resize(width,height);
    grade.uniforms.get('viewAspect').value=width/height;
  };
  new ResizeObserver(resize).observe($('scene'));
  resize();
  window.lab = { ready:true, setScene, flash:triggerFlash, freezeFlash:false,
    settleFrame: () => new Promise(resolve => requestAnimationFrame(() => {
      renderer.getContext().finish();
      requestAnimationFrame(resolve);
    })),
    diagnostics:()=>({ frames, fps:Math.round(fps), errors, scroll:document.documentElement.scrollHeight>innerHeight || document.documentElement.scrollWidth>innerWidth,
      width:innerWidth,height:innerHeight,scene:key,seed,framing,horizonClearance:framingSettings(framing).tilt-camera.fov/2,light:lightComposition(current.elevation,current.azimuth,current.night,current.blizzard,current.snow),snow:current.snow,blizzard:current.blizzard,night:current.night,rain:current.rain,lightning:target.lightning,weatherCode:target.weatherCode,coverage:target.coverage,wind:target.wind,canvas:[renderer.domElement.width,renderer.domElement.height],cssSize:[renderer.domElement.clientWidth,renderer.domElement.clientHeight],celestialViewport:celestial.material.uniforms.viewport.value.toArray(),cloudOffset:clouds.localWeatherOffset.toArray(),shapeOffset:clouds.shapeOffset.toArray(),renderer:renderer.getContext().getParameter(renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL || renderer.getContext().RENDERER),
      hdr:hdrLightning.diagnostics(),
      moon:{fraction:celestial.lunar.fraction,altitude:celestial.lunar.altitude,angularRadius:celestial.lunar.angularRadius},
      textures:renderer.info.memory.textures,programs:renderer.info.programs.length,paused,elapsed }) };
  $('loading').classList.add('hidden');
  if(embedded)parent.postMessage({type:'atmosphere-ready'},location.origin);
  const sun=new THREE.Vector3(), moonDirection=new THREE.Vector3(), snowFog=new THREE.Color();
  let starClock=Date.now();
  let previous=performance.now(), sampleStart=previous, sampleFrames=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-previous)/1000,.08); previous=now;
    if(embedded && !liveModel)return;
    if(embedded && previewIndex<0 && liveModel && Math.floor(Date.now()/60000)!==lastLiveMinute) applyLiveModel(liveModel);

    if (!paused) {
      elapsed+=dt;starClock=Date.now();
      if(cycle) {
        const direction=['sunrise','snow','night','cloudy-night'].includes(key)?1:-1;
        target.elevation+=direction*dt*.18;
        if(target.elevation>12 || target.elevation< -12) { cycle=false; $('cycle').setAttribute('aria-pressed',false); }
        $('sun').value=target.elevation;updateLabels();
      }
      for(const field of ['elevation','azimuth','coverage','exposure','wind','rain','snow','night','density','height','fog','blizzard'])
        current[field]=THREE.MathUtils.damp(current[field],target[field],1.25,dt);
      if(target.lightning>.5&&elapsed>nextFlash) { triggerFlash();nextFlash=elapsed+7+random()*11; }
      if(!window.lab.freezeFlash) flashAge+=dt;
    }
    const flash = lightningPulse(flashAge);
    lightning.update(flash);lightningPass.enabled=flash>.002;
    const light = lightComposition(current.elevation,current.azimuth,current.night,current.blizzard,current.snow);
    const elev=rad(current.elevation), az=rad(current.azimuth);
    sun.set(Math.sin(az)*Math.cos(elev),Math.cos(az)*Math.cos(elev),Math.sin(elev)).transformDirection(localFrame);
    skyMaterial.sunDirection.copy(sun); atmosphere.sunDirection.copy(sun);
    celestial.update(elapsed,current,light,camera,starClock);
    starCores.update(current.night);
    const lunar=celestial.lunar;
    const moonlight=lunar.fraction*lunar.fraction;
    // Soft ambient fill keeps moonless overcast readable. Direct moonlight still
    // follows the composed Moon; the fill does not expose stars through clouds.
    moonDirection.set(light.x*2-1,light.y*2-1,.5).unproject(camera).sub(camera.position).normalize();
    if(moonlight>.01)moonDirection.copy(celestial.material.uniforms.moonDirection.value);
    clouds.sunDirection.copy(sun).lerp(moonDirection,current.night).normalize();
    const cloudLight=THREE.MathUtils.lerp(1,.035+.025*moonlight,current.night);
    const skyLight=THREE.MathUtils.lerp(1,.25,current.night);
    cloudAtmosphere.sunRadianceToRelativeLuminance.copy(AtmosphereParameters.DEFAULT.sunRadianceToRelativeLuminance).multiplyScalar(cloudLight);
    cloudAtmosphere.skyRadianceToRelativeLuminance.copy(AtmosphereParameters.DEFAULT.skyRadianceToRelativeLuminance).multiplyScalar(skyLight);
    clouds.skyLightScale=THREE.MathUtils.lerp(1,.6,current.night);
    clouds.coverage=current.coverage;
    clouds.cloudLayers[0].densityScale=current.density;
    clouds.cloudLayers[1].densityScale=current.density*.7;
    clouds.cloudLayers[1].height=current.height;
    const velocity = cloudVelocity(elapsed, current.wind, cloudField.phase);
    clouds.localWeatherVelocity.set(velocity.x*.000025,velocity.y*.000025);
    clouds.shapeVelocity.set(velocity.x*.00015,velocity.y*.00015,.000025*current.wind);
    clouds.shapeDetailVelocity.set(velocity.x*.00019,velocity.y*.00019,.000037*current.wind);
    // At full night the celestial plane is opaque and replaces every sky pixel.
    // Keep the atmospheric sky throughout dawn/dusk blending.
    sky.visible=current.night!==1;
    snowFog.setRGB(.39+light.warmth*.045*(1-current.blizzard)-current.blizzard*.19,.44-current.blizzard*.20,.51-light.warmth*.045*(1-current.blizzard)-current.blizzard*.205);
    grade.uniforms.get('snowHaze').value=light.haze;
    grade.uniforms.get('snowFogColor').value.copy(snowFog);
    renderer.toneMappingExposure=current.exposure;
    grade.uniforms.get('fogAmount').value=current.fog;
    grade.uniforms.get('nightOvercast').value=current.night*THREE.MathUtils.smoothstep(current.coverage,.68,.93);
    grade.uniforms.get('nightAmount').value=current.night*.42*(1-Math.min(flash,1)*.9);
    grade.uniforms.get('flashAmount').value=flash;
    const frameDt=paused?0:dt;
    grade.uniforms.get('fogMotion').value.x+=frameDt*(.012+current.wind*.0012);
    grade.uniforms.get('fogMotion').value.y+=frameDt*.006;
    composer.render(frameDt);
    particles.render(elapsed,current.rain,current.snow,current.wind,flash,light,snowFog,current.blizzard);
    hdrLightning.render(lightning,flash,renderer.domElement.width,renderer.domElement.height);
    frames++;sampleFrames++;
    if (embedded && notifyRendered) { parent.postMessage({type:'atmosphere-rendered'},location.origin); notifyRendered=false; }
    if(now-sampleStart>1000){fps=sampleFrames*1000/(now-sampleStart);$('fps').textContent=`${Math.round(fps)} FPS · WEBGL2`;sampleStart=now;sampleFrames=0;}
  });
}

document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>setScene(button.dataset.scene)));
$('sun').addEventListener('input',e=>{target.elevation=+e.target.value;cycle=false;$('cycle').setAttribute('aria-pressed',false);updateLabels();});
$('clouds').addEventListener('input',e=>{target.coverage=+e.target.value;updateLabels();});
function toggleDayNight() {
  if(!target)return;
  cycle=false;$('cycle').setAttribute('aria-pressed',false);
  target.night=target.night>.5?0:1;
  target.elevation=target.night?-12:12; target.exposure=target.night?1.4:(presets[key]?.night===0?presets[key].exposure:7);
  $('day-night').textContent=target.night?'Night':'Day';
  $('day-night').setAttribute('aria-pressed',Boolean(target.night));
  $('sun').value=target.elevation;updateLabels();
}
function applyLiveModel(model) {
  if(!model || !renderer || !current)return;
  const next=weatherScene(model.current,model.location);
  if(!next)return;
  const first=!liveModel;
  const moved=liveModel && (liveModel.location?.latitude!==model.location?.latitude || liveModel.location?.longitude!==model.location?.longitude);
  liveModel=model;lastLiveMinute=Math.floor(Date.now()/60000);
  if(moved)previewIndex=-1;
  if(previewIndex>=0)return;
  key='live';target=next;cycle=false;notifyRendered=true;
  const latitude=model.location?.latitude, longitude=model.location?.longitude;
  if(Number.isFinite(latitude) && Number.isFinite(longitude)){
    camera.position.copy(new Geodetic(rad(longitude),rad(latitude),180).toECEF());
    camera.up.copy(Ellipsoid.WGS84.getSurfaceNormal(camera.position));
    localFrame=Ellipsoid.WGS84.getEastNorthUpFrame(camera.position);
    applyFraming();
  }
  if(first)current={...target};
  if(!next.lightning)flashAge=99;
}
function stepPreview(step) {
  if(!liveModel || !Number.isInteger(step) || Math.abs(step)!==1)return;
  const count=previewScenes.length+1;
  previewIndex=((previewIndex+1+step+count)%count)-1;
  if(previewIndex<0){applyLiveModel(liveModel);return;}
  key='preview';cycle=false;
  target=weatherScene({...previewScenes[previewIndex],windSpeed:12},liveModel.location);
  target.elevation=previewScenes[previewIndex].isDay?18:-12;
  if(!target.lightning)flashAge=99;
}
window.addEventListener('message',event=>{
  if(!embedded || event.source!==parent || event.origin!==location.origin)return;
  if(event.data?.type==='weather-model')applyLiveModel(event.data.model);
  else if(event.data?.type==='atmosphere-step')stepPreview(event.data.step);
  else if(event.data?.type==='atmosphere-live'){previewIndex=-1;applyLiveModel(liveModel);}
});
$('day-night').addEventListener('click',toggleDayNight);
$('framing').addEventListener('click',toggleFraming);
$('pause').addEventListener('click',togglePause);
$('overlay').addEventListener('click',toggleOverlay);
$('cycle').addEventListener('click',()=>{cycle=!cycle;$('cycle').setAttribute('aria-pressed',cycle);});
$('close').addEventListener('click',()=>window.close());
window.addEventListener('keydown',e=>{
  if(embedded || e.target instanceof HTMLInputElement) return;
  if(['1','2','3','4','5','6','7','8','9'].includes(e.key))setScene(Object.keys(presets)[+e.key-1]);
  if(e.key.toLowerCase()==='h')document.body.classList.toggle('clean');
  if(e.key.toLowerCase()==='u')toggleOverlay();
  if(e.code==='Space'){e.preventDefault();togglePause();}
  if(e.key.toLowerCase()==='v')toggleFraming();
  if(e.key.toLowerCase()==='n')toggleDayNight();
  if(e.key.toLowerCase()==='l')triggerFlash();
});
init().catch(error=>{ if(embedded)parent.postMessage({type:'atmosphere-error'},location.origin); window.labError=String(error.stack||error); console.error(error);$('loading').querySelector('p').textContent='The sky could not load';$('loading').querySelector('small').textContent=error.message; });
