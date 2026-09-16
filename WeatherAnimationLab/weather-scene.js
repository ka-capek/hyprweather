// Open-Meteo WMO interpretation codes. Day/night is independent of weather family.
// https://open-meteo.com/en/docs (weather variable documentation)
const entry = (family, intensity = 0, extra = {}) => ({ family, intensity, ...extra });
export const WMO = Object.freeze({
  0: entry('clear'), 1: entry('clear', .12), 2: entry('cloud', .38), 3: entry('cloud', .9),
  45: entry('fog', .7), 48: entry('fog', .85, { freezing: true }),
  51: entry('drizzle', .12), 53: entry('drizzle', .22), 55: entry('drizzle', .35),
  56: entry('drizzle', .16, { freezing: true }), 57: entry('drizzle', .3, { freezing: true }),
  61: entry('rain', .24), 63: entry('rain', .55), 65: entry('rain', 1),
  66: entry('rain', .4, { freezing: true }), 67: entry('rain', .8, { freezing: true }),
  71: entry('snow', .28), 73: entry('snow', .6), 75: entry('snow', 1),
  77: entry('snow', .2, { grains: true }),
  80: entry('rain', .3, { showers: true }), 81: entry('rain', .65, { showers: true }),
  82: entry('rain', 1, { showers: true }),
  85: entry('snow', .4, { showers: true }), 86: entry('snow', 1, { showers: true }),
  95: entry('storm', .85), 96: entry('storm', .9, { hail: .35 }),
  99: entry('storm', 1, { hail: .8 }),
});
const clamp = (value, a, b) => Math.min(b, Math.max(a, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);

// Low-order solar position from UTC and coordinates. It drives light colour/time;
// the visible light arc remains composed above the UI, not an astronomical chart.
export function solarElevation(latitude, longitude, now = Date.now()) {
  if (!finite(latitude) || Math.abs(latitude)>90 || !finite(longitude) || Math.abs(longitude)>180 || !finite(now)) return null;
  const date = new Date(now);
  const day = (now - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  const year=date.getUTCFullYear();
  const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  const g = 2 * Math.PI / days * (day - 1.5);
  const decl = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g)
    - .006758 * Math.cos(2*g) + .000907 * Math.sin(2*g)
    - .002697 * Math.cos(3*g) + .00148 * Math.sin(3*g);
  const equation = 229.18 * (.000075 + .001868*Math.cos(g) - .032077*Math.sin(g)
    - .014615*Math.cos(2*g) - .040849*Math.sin(2*g));
  const minutes = date.getUTCHours()*60 + date.getUTCMinutes() + date.getUTCSeconds()/60;
  const angle = (minutes + equation + 4*longitude) / 4 - 180;
  const rad = Math.PI / 180, lat = latitude*rad;
  return Math.asin(Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(angle*rad))/rad;
}

export function weatherScene(current, location = {}, now = Date.now()) {
  if (!current || !Number.isInteger(current.weatherCode) || !WMO[current.weatherCode]) return null;
  const code = current.weatherCode, info = WMO[code];
  const { family, intensity } = info;
  const solar = solarElevation(location?.latitude, location?.longitude, now);
  const isDay = typeof current.isDay === 'boolean' ? current.isDay : solar !== null ? solar > 0 : null;
  if (isDay === null) return null;
  const night = isDay ? 0 : 1;
  const rain = ['rain','drizzle','storm'].includes(family) ? intensity : 0;
  const snow = family === 'snow' ? intensity : 0;
  const blizzard = snow ? clamp((snow-.4)/.6, 0, 1) : 0;
  const defaultCover = family === 'clear' ? intensity : family === 'cloud' ? intensity
    : family === 'fog' ? .32 : snow ? .35+.6*snow : .38+.55*rain;
  // Preserve the categorical overcast guarantee; continuous API coverage otherwise wins.
  const coverage = code === 3 ? .98 : finite(current.cloudCover)
    ? clamp(current.cloudCover/100, 0, 1) : defaultCover;
  return {
    ...info, weatherCode: code, title: current.condition || family, condition: current.condition || family,
    index: String(code), temp: current.temp,
    elevation: solar === null ? (isDay ? 18 : -12) : clamp(solar, -14, 35),
    azimuth: 14, coverage, exposure: night ? 1.4 : (family === 'storm' ? 4 : 7),
    wind: finite(current.windSpeed) ? clamp(current.windSpeed, 0, 180) : 8,
    rain, snow, night, fog: family === 'fog' ? intensity : 0,
    blizzard, lightning: family === 'storm' ? 1 : 0,
    hail: info.hail || 0, grains: info.grains ? 1 : 0,
    density: family === 'clear' ? .06 : .1 + intensity*.055, height: snow ? 850 : 1000,
  };
}
