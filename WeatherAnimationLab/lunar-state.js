import { Matrix3, Matrix4, Vector3 } from 'three';
import { Ellipsoid } from '@takram/three-geospatial';
import { Body, GeoVector, Illumination, KM_PER_AU } from 'astronomy-engine';
import { getECIToECEFRotationMatrix, getMoonFixedToECIRotationMatrix } from '@takram/three-atmosphere';

// Astronomy runs once per UTC minute/location, never once per rendered frame.
// Directions and the Moon-fixed surface orientation use the same ECEF frame.
export class LunarState {
  constructor() {
    this.direction = new Vector3();
    this.startDirection = new Vector3();
    this.nextDirection = new Vector3();
    this.startSun = new Vector3();
    this.nextSun = new Vector3();
    this.nextRotation = new Matrix4();
    this.sunDirection = new Vector3();
    this.surfaceRotation = new Matrix3();
    this.observer = new Vector3(Infinity, Infinity, Infinity);
    this.up = new Vector3();
    this.rotation = new Matrix4();
    this.fixedRotation = new Matrix4();
    this.minute = null;
    this.fraction = 0;
    this.angularRadius = 0;
  }
  update(now, observer) {
    const minute = Math.floor(now / 60000);
    if (minute === this.minute && this.observer.equals(observer)) {
      this.interpolate(now);
      return;
    }
    this.minute = minute;
    this.observer.copy(observer);
    const date = new Date(minute*60000);
    getECIToECEFRotationMatrix(date, this.rotation);
    const moon = GeoVector(Body.Moon, date, false);
    this.direction.set(moon.x, moon.y, moon.z).applyMatrix4(this.rotation)
      .multiplyScalar(KM_PER_AU * 1000).sub(observer);
    this.startRadius = Math.asin(1737400 / this.direction.length());
    this.startDirection.copy(this.direction).normalize();
    const illumination = Illumination(Body.Moon, date);
    this.fraction = illumination.phase_fraction;
    const {x, y, z} = illumination.hc;
    this.startSun.set(-x, -y, -z).transformDirection(this.rotation);
    getMoonFixedToECIRotationMatrix(date, this.fixedRotation);
    this.fixedRotation.premultiply(this.rotation);
    this.surfaceRotation.setFromMatrix4(this.fixedRotation).transpose();
    Ellipsoid.WGS84.getSurfaceNormal(observer,this.up);
    const nextDate=new Date((minute+1)*60000);
    getECIToECEFRotationMatrix(nextDate,this.nextRotation);
    const nextMoon=GeoVector(Body.Moon,nextDate,false);
    this.nextDirection.set(nextMoon.x,nextMoon.y,nextMoon.z).applyMatrix4(this.nextRotation)
      .multiplyScalar(KM_PER_AU*1000).sub(observer);
    this.nextRadius=Math.asin(1737400/this.nextDirection.length());
    this.nextDirection.normalize();
    this.nextSun.set(-x,-y,-z).transformDirection(this.nextRotation);
    this.interpolate(now);
  }
  interpolate(now) {
    const t=now/60000-this.minute;
    this.direction.copy(this.startDirection).lerp(this.nextDirection,t).normalize();
    this.sunDirection.copy(this.startSun).lerp(this.nextSun,t).normalize();
    this.angularRadius=this.startRadius+(this.nextRadius-this.startRadius)*t;
    this.altitude=Math.asin(Math.max(-1,Math.min(1,this.direction.dot(this.up))));
  }
}
