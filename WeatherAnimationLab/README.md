# Atmosphere — animation lab

Standalone Linux/Wayland playground for the WeatherApp animation research.
Everything in this directory is independent of `/home/karel/Documents/WeatherApp`.
The production repository is being edited by Claude and has not been modified.

## Run

```sh
cd /home/karel/Documents/WeatherAnimationLab
./run.sh
```

Opens a frameless 1316 × 1396 Electron window. There are no browser toolbars.
All render assets are local. The internal HTTP server binds only to loopback on
an ephemeral port, serves this lab's `dist/`, and shuts down with the app.
Electron stores its profile in this directory's `.electron-profile/`.

Available studies:

1. **Sunset** — warm horizon, layered volumetric clouds, changing light.
2. **Sunrise** — lighter cloud cover and low morning sunlight.
3. **Thunderstorm** — dark clouds, wind-driven rain, procedural lightning.
4. **Snowfall** — soft winter light and flakes at different depths.

The sun elevation and cloud cover sliders interpolate smoothly. “Play sunset” /
“Play sunrise” moves the sun through twilight; it stops at the end rather than
looping abruptly. These are development controls, not intended for the final app.

| Control | Action |
| --- | --- |
| `1`–`4` | Choose a scene |
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
`run.sh` uses the system `/usr/bin/electron43` already installed on this machine.
After changing source files, run `npm run build` again.

## Verification

```sh
./run.sh --verify
./run.sh --scene=sunset --capture=captures/sunset.png
```

Verification uses Electron's offscreen GPU mode so it does not rearrange desktop
windows. It captures all four scenes and a lightning frame in `captures/`, logs
renderer identity, dimensions, FPS, program/texture counts and console errors.
It also checks the basic development controls. The capture frame rate is capped
at 60 FPS; it is not a claim of uncapped renderer throughput.

Initial hardware verification: AMD Radeon RX 9070 XT through ANGLE/radeonsi,
1316 × 1396, approximately 60 FPS in the offscreen capture mode. Ordinary hidden
windows throttled or stalled capture; that capture path was replaced with the
dedicated offscreen path. No GPU flags or driver settings were changed.

## Rendering

- Three.js WebGL2 with Takram's Bruneton atmospheric scattering and volumetric clouds.
- Local precomputed atmosphere lookup textures; no startup LUT generation or CDN calls.
- Camera located near Prague, with an artistic view composition and manually controlled
  sun angle. This is not yet a time/date-driven astronomical simulation.
- Cloud density, height, lighting and motion interpolate across scene changes.
- Instanced GPU rain and snow in camera space, with stable seeded particle attributes.
- The night study uses an artistic low-intensity directional cloud light. The physical
  atmospheric sun remains below the horizon, followed by a cool display-space grade.
- Lightning currently combines a procedural visible path with a spatial light pulse in
  postprocessing. It is not yet an internal volumetric emissive light, and has no thunder.

## Research limits and next work

This is a first animated study, not the final visual quality or full weather catalog.

- Inspect cloud texture detail, temporal reconstruction, low-sun colors and the horizon
  in motion. The underlying library is beta; sparse clouds can smear during changes.
- Cloud light-shaft rendering is disabled in this study; cloud self-shadowing
  remains enabled with one shadow cascade. The initial equatorial test camera
  produced visible cloud-mapping seams; these disappeared at the Prague camera.
- Night clouds, lightning branching/illumination, flake shapes and precipitation
  density still need art direction. No glass droplets have been added.
- Earth/horizon presentation must eventually fit behind the approved weather panels.
- Moon rendering is disabled until phase, date and visibility are connected correctly.
- Before production integration: map all 28 Open-Meteo codes and continuous modifiers,
  drive the solar cycle from real coordinates/time, and extend the weather families.
- Do not transfer code or assets into WeatherApp until the user coordinates that step.

See `ASSETS.md` for provenance and license notes.
