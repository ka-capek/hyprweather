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
