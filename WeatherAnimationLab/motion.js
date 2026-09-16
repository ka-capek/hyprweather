// Repeatable only when a seed is explicitly supplied. No frame-dependent randomness.
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createCloudField(random) {
  return {
    weather: [random(), random()],
    shape: Array.from({ length: 3 }, () => random() * 1000),
    detail: Array.from({ length: 3 }, () => random() * 1000),
    phase: random() * Math.PI * 2,
  };
}

export function cloudVelocity(time, wind, phase) {
  // A shared prevailing direction and long, incommensurate gusts. Integrated
  // by CloudsEffect: never multiply total elapsed time by a changing speed.
  const speed = wind * (1 + .14 * Math.sin(time / 19 + phase) + .08 * Math.sin(time / 43 + phase * 2));
  const angle = .18 + .12 * Math.sin(time / 67 + phase);
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}
