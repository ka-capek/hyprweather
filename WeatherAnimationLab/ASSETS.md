# Sources and notices

No Apple assets, stock photos, generated images, or production WeatherApp assets are
used. Sky/clouds are rendered from a volume and scattering data, not played as video.

## Takram renderer and asset data

Source: https://github.com/takram-design-engineering/three-geospatial

- `@takram/three-atmosphere` 0.19.1
- `@takram/three-clouds` 0.7.6
- `@takram/three-geospatial` 0.9.1

The upstream repository and package metadata declare MIT. The copyright notice is
preserved in `public/licenses/takram-MIT.txt` and included in the built app.

The files in `public/atmosphere/` were copied unchanged from the installed atmosphere
package's `assets/`: scattering/irradiance/transmittance lookup tables and `stars.bin`.
The star data is described upstream as derived from the Yale Bright Star Catalog.
Cloud weather, shape, shape-detail and turbulence data in `public/clouds/` were copied
unchanged from the installed cloud package.

## Sampling noise

`public/clouds/stbn.bin` was downloaded from the exact URL used by the installed
geospatial package, at a pinned upstream revision:

https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/9627216cc50057994c98a2118f3c4a23765d43b9/packages/core/assets/stbn.bin

It is a 128 × 128 × 64 scalar sampling volume. The upstream documentation references
NVIDIA's spatiotemporal blue-noise work. Its complete asset-specific derivation has
not been established here; do not assume the wrapper's MIT license settles that.
NVIDIA's SDK has separate research/commercial terms, retained as a reference in
`public/licenses/NVIDIA-STBN-reference.txt`. This lab is local research/evaluation;
reconfirm provenance or replace the sampling volume before public distribution.

Reference: https://github.com/NVIDIA-RTX/STBN

## Other libraries

- Three.js 0.183.2: https://github.com/mrdoob/three.js — MIT; notice in `public/licenses/three-MIT.txt`.
- postprocessing 6.39.1: https://github.com/pmndrs/postprocessing — license copied into `public/licenses/postprocessing-LICENSE.md`.
- Remaining transitive dependencies retain their notices in `node_modules` and are
  recorded by the lockfile. Audit the complete bundled notice set before distribution.

The app's own JavaScript, CSS, markup and particle shaders were authored for this lab.
No license has been chosen for the project as a whole; nothing has been published.


## Fog and wind symbols (September 2026)

Original SVG paths in `index.html`, authored for this project; no SF Symbols or
Apple artwork is bundled. Visual vocabulary reference:
https://support.apple.com/en-lamr/guide/iphone/iph4305794fb/ios
The fog veil shader and seeded motion helpers are original project code.


## Celestial and snowfall study

`celestial.js` and `composition.js` are original procedural code. Stars are a
seeded artistic field, not a catalogue; the moon is an original noise-shaded
placeholder. No Apple, photographic or downloaded lunar/star textures were added.
The previous `stars.bin` remains in the historical asset directory but this
iteration does not load it. New snow lighting/fog shaders are original code.

## Catalogue-based night sky (September 2026)

Replaces the procedural star field described above. Bundled, unmodified texture:
`public/sky/nasa-starmap-8k.jpg` (8192 × 4096, ~6.9 MiB).

- Source: https://svs.gsfc.nasa.gov/3895 — **Deep Star Maps**, celestial coordinates.
- Download: https://svs.gsfc.nasa.gov/vis/a000000/a003800/a003895/starmap_8k.jpg
- Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio; Ernie Wright and Tom Bridgman. Based on Yale Bright Star and Tycho-2 catalogues. No constellation line artwork is used.
- NASA SVS usage: public domain unless otherwise noted, https://svs.gsfc.nasa.gov/help/ . No separate restriction is stated for this star map.
- The smaller 8K JPEG edition keeps the application download manageable. The newer HDR edition is https://svs.gsfc.nasa.gov/4851 .
- Project code projects the spherical map through the camera and rotates it with UTC sidereal time and the selected city's ECEF camera frame. This is an approximate Earth view, not an astrometry tool: precession, nutation, atmospheric refraction and light pollution are not modelled. Brightness is art-directed; the moon remains a placeholder.

## Lightning and fog implementation references

Original procedural ribbon geometry, branching and glow; no third-party effect code copied.
- NVIDIA Lightning SDK presentation: https://developer.download.nvidia.com/SDK/10.5/direct3d/Source/Lightning/doc/lightning_doc.pdf
- Lightning is composited into the existing half-float HDR buffer **before bloom and tone mapping**. This is HDR rendering, not a claim of HDR monitor output.
- Extended-range canvas presentation is a separate capability: https://github.com/ccameron-chromium/webgpu-hdr/blob/main/EXPLAINER.md . It is not forced with experimental browser flags.
- Fog uses four advected, warped screen-space density layers and exponential transmittance; it is an artistic approximation, not full volumetric scattering. Reference: https://advances.realtimerendering.com/s2014/wronski/bwronski_volumetric_fog_siggraph2014.pdf

## Real Moon and extended-range lightning — September 2026

- Lunar albedo: NASA Scientific Visualization Studio, **CGI Moon Kit** (2025 color map), Ernie Wright; LRO/LROC data. Source: https://svs.gsfc.nasa.gov/4720 . Unmodified 2048×1024 JPEG: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg , bundled as `public/sky/nasa-moon-2k.jpg`. NASA SVS public-domain usage policy: https://svs.gsfc.nasa.gov/help/ . This replaces the placeholder described above.
- Ephemeris: Astronomy Engine 2.1.19, Don Cross, MIT; notice bundled in `public/licenses/astronomy-engine-MIT.txt`. https://github.com/cosinekitty/astronomy . Takram's coordinate and lunar body-frame helpers retain their existing MIT notice.
- Phase, observer parallax, lunar orientation and geometric position are calculated locally per UTC minute/location. Atmospheric refraction and eclipses are not rendered. The disk is magnified 2.4× for readable surface detail; brightness and earthshine are artistic. At night the Moon is relocated above the UI for composition, even when its astronomical position is below the horizon. The same rotation is applied to sunlight and surface orientation so the real phase and visible lunar features are preserved; clouds still occlude it.
- Optional HDR lightning cores use WebGPU `rgba16float`, premultiplied alpha and `toneMapping: {mode: "extended"}`. Reference: https://developer.chrome.com/blog/new-in-webgpu-129 . This is separate from the SDR scene's internal HDR/bloom. No experimental flags or monitor settings are forced. Actual presentation requires a compatible GPU, browser, compositor and enabled HDR display; otherwise the original SDR renderer remains active.
