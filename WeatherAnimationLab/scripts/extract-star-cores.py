"""Extract compact, aligned bright-star cores from the bundled NASA map.
Offline asset build only: python3 + Pillow. No runtime image analysis/downloads.
The positions are map-derived (8K angular precision), not a new astrometric catalog.
"""
from pathlib import Path
from PIL import Image, ImageFilter
import math
import struct

root = Path(__file__).resolve().parents[1]
image = Image.open(root / 'public/sky/nasa-starmap-8k.jpg').convert('RGB')
width, height = image.size
luma = image.convert('L')
maxima = luma.filter(ImageFilter.MaxFilter(7))
candidates = [(v, i % width, i // width) for i, (v, peak) in enumerate(zip(luma.tobytes(), maxima.tobytes())) if v >= 100 and v == peak]
candidates.sort(reverse=True)
occupied = set()
stars = []
for value, x, y in candidates:
    cell = (x // 4, y // 4)
    if any(((cell[0] + dx) % (width // 4), cell[1] + dy) in occupied for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
        continue
    occupied.add(cell)
    # TextureLoader flips image Y. Match celestial.js's equatorial lookup.
    ra = (.5 - (x + .5) / width) * math.tau
    dec = (.5 - (y + .5) / height) * math.pi
    rgb = image.getpixel((x, y))
    color = [(.65 + .35 * c / max(rgb)) for c in rgb]
    strength = (value / 255) ** 2.2
    stars.extend([math.cos(dec)*math.cos(ra), math.cos(dec)*math.sin(ra), math.sin(dec), strength, *color])
(root / 'public/sky/nasa-star-cores.bin').write_bytes(struct.pack('<' + 'f' * len(stars), *stars))
print(f'{len(stars)//7} cores, {len(stars)*4} bytes')
