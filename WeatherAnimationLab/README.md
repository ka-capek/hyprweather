# Atmosphere — animation lab

Standalone Linux/Wayland playground for the WeatherApp animation research.
The lab now lives inside `hyprweather/WeatherAnimationLab`; it is still independent
of the main application. Changes here do not replace the production background yet.

## Run

```sh
cd WeatherAnimationLab  # from the hyprweather repository
./run.sh
```

Opens a frameless 1316 × 1396 Electron window. There are no browser toolbars.
All render assets are local. The internal HTTP server binds only to loopback on
an ephemeral port, serves this lab's `dist/`, and shuts down with the app.
Electron stores its profile in this directory's `.electron-profile/`.

Available studies:

1. **Sunset** — warm upper-sky light, layered volumetric clouds, changing light.
2. **Sunrise** — lighter cloud cover and low morning sunlight.
3. **Thunderstorm** — dark clouds, wind-driven rain, procedural lightning.
4. **Light snow** — warm, soft sunlight and fine flakes fading into the distance.
5. **Fog** — overlapping, slowly drifting veils and a cloud/bands icon.
6. **Strong wind** — faster, gusting cloud movement and a curled-airflow icon.
7. **Heavy snow** — dense snow, grey depth veil and no visible sun.
8. **Starry night** — varied stars, gentle twinkling and a luminous placeholder moon.
9. **Cloudy night** — the same night sky behind moving volumetric clouds.

The sun elevation and cloud cover sliders interpolate smoothly. “Play sunset” /
“Play sunrise” moves the sun through twilight; it stops at the end rather than
looping abruptly. These are development controls, not intended for the final app.

| Control | Action |
| --- | --- |
| `1`–`9` | Choose a scene |
| `V` | Compare layered composition with a wider sky-only view |
| `H` | Hide/show all lab controls |
| `U` | Show/hide a simple sample weather overlay |
| `Space` | Pause/resume animation time |
| `L` | Trigger lightning in the storm study |
| `Esc` | Close |
| `F12` | Developer tools |

The weather overlay is an independent typography reference, not a copy of the
production interface. There are no forecasts, network weather calls, audio,
geolocation, settings persistence, or workspace integration in this lab.

## Development

```sh
npm ci --legacy-peer-deps --no-audit --no-fund
npm run build
./run.sh
```

`--legacy-peer-deps` omits the upstream geospatial package's React peer tree:
this playground uses the vanilla Three.js exports and does not use React/R3F.
Versions of the renderer packages are pinned in `package.json` and the lockfile.
`run.sh` finds `electron43`, `electron39`, or `electron` (or uses `$ELECTRON`).
It builds on every launch so a `git pull` never leaves you testing stale `dist/`.
Node.js 22 LTS and a system Electron are required; missing npm dependencies are
installed from the lockfile on first launch.

## Verification

```sh
./run.sh --verify
./run.sh --scene=sunset --capture=captures/sunset.png
```

Verification uses Electron's offscreen GPU mode so it does not rearrange desktop
windows. It captures all nine scenes and a lightning frame in `captures/`, logs
renderer identity, dimensions, FPS, program/texture counts and console errors.
It also checks the basic development controls. The capture frame rate is capped
at 60 FPS; it is not a claim of uncapped renderer throughput.

Initial hardware verification: AMD Radeon RX 9070 XT through ANGLE/radeonsi,
1316 × 1396, approximately 60 FPS in the offscreen capture mode. Ordinary hidden
windows throttled or stalled capture; that capture path was replaced with the
dedicated offscreen path. No GPU flags or driver settings were changed.

## This iteration: comparison on your monitor

```sh
git pull --ff-only
cd WeatherAnimationLab
./run.sh
```

Start with sunset, press **H** to inspect the whole sky, then **V** to compare
composition without changing the cloud field. The default uses a narrower lens
and excludes the horizon entirely in both views; no ground is drawn. A smooth
navy fade starts around 43% height and darkens the lower panels.
**4 / 7** compare light / heavy snow; **8 / 9** compare clear / cloudy night.
**5 / 6** select fog / strong wind; **U** shows the sample weather overlay.
Watch each for 30–60 seconds. Check that distant snow blends into the grey veil,
that only a few soft near flakes pass by, and that moving clouds hide the stars.
The `Light / time` slider moves the sun/moon along an upper, off-centre arc.
This is deliberate lab art direction, not a real astronomical position. The
moon is a glowing procedural placeholder; real phase and ephemerides come later.

Every launch samples a fresh cloud field. Scene changes preserve its positions;
weather, shape and detail drift continuously with slowly varying gusts.
For reporting an issue, find the seed in `window.lab.diagnostics()` in devtools,
or start a repeatable comparison explicitly:

```sh
./run.sh --seed=17
./run.sh --seed=17 --view=wide
./run.sh --verify --seed=17
node --test motion.test.js composition.test.js
```

A seed reproduces initial cloud and particle fields. Captures at different elapsed
times or after different interactions are not pixel-identical recordings.

### Current local verification limit

See TASKS.md for the current build and offscreen verification results.
The available headless SwiftShader backend renders the atmospheric volume black,
including the original pre-change code. Custom celestial, fog and UI captures work; cloud appearance
and real-time motion still require your hardware check. These tests do **not**
certify GPU performance or final visual quality. `--quality=low` is available for
software diagnostic runs only; normal launch remains high quality.

## Rendering

- Three.js WebGL2 with Takram's Bruneton atmospheric scattering and volumetric clouds.
- Local precomputed atmosphere lookup textures; no startup LUT generation or CDN calls.
- Camera located near Prague, with an artistic view composition and manually controlled
  sun angle. This is not yet a time/date-driven astronomical simulation.
- Cloud density, height, lighting and motion interpolate across scene changes.
- Instanced GPU rain and snow in camera space, with stable seeded particle attributes.
  Rain and snow have independent trajectories during transitions. Only 0.25% of
  snow slots are close flakes; distance attenuates contrast and adds fog colour.
- Sun, moon and seeded procedural stars are drawn before the cloud composite.
  Cloud transmittance masks celestial light, including halos. Stars have varied
  brightness/colour and small independent twinkle; they are not an astronomical map.
- Snow uses the same projected light location/colour and grey veil as the scene.
  Heavy snow extinguishes direct sunlight and increases distance extinction.
- The night study uses an artistic low-intensity directional cloud light. The physical
  atmospheric sun remains below the horizon, followed by a cool display-space grade.
- Lightning currently combines a procedural visible path with a spatial light pulse in
  postprocessing. It is not yet an internal volumetric emissive light, and has no thunder.

## Research limits and next work

This is a first animated study, not the final visual quality or full weather catalog.

- Inspect cloud texture detail, temporal reconstruction, low-sun colors and transitions
  in motion. The underlying library is beta; sparse clouds can smear during changes.
- Cloud light-shaft rendering is disabled in this study; cloud self-shadowing
  remains enabled with one shadow cascade. The initial equatorial test camera
  produced visible cloud-mapping seams; these disappeared at the Prague camera.
- Night clouds, lightning branching/illumination, flake shapes and precipitation
  density still need art direction. No glass droplets have been added.
- The entire camera frustum stays above the horizon; ground rendering is disabled.
- The moon is a lab-only placeholder, not the actual phase or position.
- Before production integration: map all 28 Open-Meteo codes and continuous modifiers,
  drive the solar cycle from real coordinates/time, and extend the weather families.
- Do not transfer code or assets into WeatherApp until the user coordinates that step.

See `ASSETS.md` for provenance and license notes.
