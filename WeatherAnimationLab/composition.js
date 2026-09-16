const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const mix = (a, b, t) => a + (b - a) * t;
export function smooth(a, b, value) {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Lab art direction, not astronomy. Both lenses keep every ray above the horizon.
export function framingSettings(mode) {
  const fov = mode === 'wide' ? 58 : 38;
  return { fov, tilt: fov / 2 + 12 };
}

export function lightComposition(elevation, azimuth, night, blizzard, snow) {
  const progress = clamp((elevation + 14) / 49, 0, 1);
  // Stay off the central temperature column. A continuous arc, never random jumps.
  const side = Math.tanh(azimuth / 7);
  const x = .5 + side * (.18 + .1 * progress);
  const y = .72 + .09 * Math.sin(progress * Math.PI);
  const warmth = 1 - smooth(0, 18, elevation);
  const visibility = (1 - blizzard) * (1 - snow * .45);
  return {
    x, y, warmth,
    sun: (1 - night) * smooth(-12, -3, elevation) * visibility,
    moon: night * (1 - blizzard),
    haze: mix(.14, .96, blizzard) * smooth(0, .2, snow),
    extinction: mix(.009, .065, blizzard),
    lightColor: [mix(.79, 1, warmth), mix(.86, .81, warmth), mix(.97, .61, warmth)],
  };
}
