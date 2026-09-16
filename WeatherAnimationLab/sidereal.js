// Approximate Greenwich mean sidereal angle, IAU/Meeus expression (J2000).
// Catalogue is fixed J2000; precession, nutation and atmospheric refraction are omitted.
export function siderealAngle(now) {
  const jd=now/86400000+2440587.5,d=jd-2451545,t=d/36525;
  const degrees=280.46061837+360.98564736629*d+.000387933*t*t-t*t*t/38710000;
  return ((degrees%360)+360)%360*Math.PI/180;
}
