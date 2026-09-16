# Motion lab — 16 September 2026

User direction: a flatter, iOS-inspired atmosphere; avoid clouds repeatedly forming
at identical positions. Own visual direction is welcome. Add fog and strong wind,
with matching icons. Keep experiments in this lab until visually approved.

- [x] Inspect existing renderer and research Apple Weather reconstructions.
- [x] Flatten composition; retain the old perspective for direct comparison.
- [x] Randomize cloud fields per launch, preserve continuity between presets,
      and vary advection smoothly without fixed emission points.
- [x] Add fog and strong-wind studies and original matching SVG icons.
- [x] Verify build, six scene presets, pause, resize and reproducible seeds.
- [ ] Approve cloud appearance and motion on the user's GPU/monitor.
- [x] Push a reviewable update with Linux test instructions (`36bcccb`).

## Research and implementation decision

- https://github.com/iamvinny/weather-app reconstructs the older Mica system
  (layered images and particles) in Skia; its README distinguishes it from the
  newer VFX renderer. Useful motion/composition reference, not a Linux drop-in.
  We do not import extracted Apple assets.
- https://github.com/takram-design-engineering/three-geospatial is already the
  lab's renderer. Keep its cloud lighting and reduce the wide-angle composition
  first, rather than replacing the renderer before a visual comparison.
- https://support.apple.com/en-lamr/guide/iphone/iph4305794fb/ios documents separate
  fog and windy symbols. Draw our own cloud/bands and curled airflow SVGs.

The existing renderer starts with fixed weather/shape offsets and fixed particle
seeds. Weather, shape and detail also move on separate hard-coded vectors; this
can make volume detail appear to form inside stationary weather-map regions.
Use a per-session seed plus coordinated, slowly varying advection. Keep a fixed
seed option for comparisons. Do not reseed or reset motion when changing scenes.

Validation here cannot establish performance on the user's Hyprland/GPU/monitor.
That remains a hardware acceptance check after pull.


## Validation result

- Vite build and JavaScript/shell syntax checks passed; `git diff --check` clean.
- Two Node tests passed: seeded reproducibility and bounded, continuous gusts
  sampled across one hour and three seeds.
- Offscreen Electron 44 / SwiftShader, `--quality=low`: all six scene presets,
  sliders, pause/resume (including cloud offsets), framing without reseeding,
  overlay, controls visibility and 850 × 900 resize passed. Main test viewport:
  1316 × 1396. No renderer JavaScript/shader errors were reported.
- Found stale offscreen paint captures; switched to a GPU fence and current-page
  capture. The new fog capture shows the correct scene and the original icons.
- **Visual limitation:** atmospheric sky/clouds render black on this software
  backend. The original HEAD version with reduced quality also renders black in
  the same environment, so this is not evidence of a regression in this patch.
  It also does not prove visual correctness on hardware. Fog overlay, particles,
  icons and control layout were visible; final cloud appearance, transitions and
  performance need the user's real GPU. No desktop GPU configuration was changed.
- `--quality=low` is a diagnostic-only option. Normal launch retains high quality.
