import * as THREE from "three";
import { PLANET_RADIUS } from "../planet";

export { GeoCoord };

// A simple helper class for converting geographic coordinates (latitude/longitude) to world vectors or
// spherical coordinates.
class GeoCoord {
  public lat: number;
  public lon: number;

  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }

  static fromSpherical(sph: THREE.Spherical) {
    let theta = sph.theta;

    if (theta > Math.PI) {
      theta = -(theta % Math.PI);
    }
    return new GeoCoord(this.toDegrees(Math.PI - sph.phi - Math.PI / 2), this.toDegrees(theta));
  }

  static fromWorldVector(vec: THREE.Vector3) {
    return this.fromSpherical(new THREE.Spherical().setFromVector3(vec));
  }

  protected static toDegrees(radians: number) {
    return radians * (180 / Math.PI);
  }

  protected static toRadians(degrees: number) {
    return degrees * (Math.PI / 180);
  }

  toSpherical(radius = PLANET_RADIUS) {
    const latInRads = GeoCoord.toRadians(this.lat);
    const lonInRads = GeoCoord.toRadians(this.lon);
    return new THREE.Spherical(
      radius,
      Math.PI / 2 - latInRads,
      lonInRads < 0 ? lonInRads + Math.PI * 2 : lonInRads,
    );
  }

  toWorldVector(radius = PLANET_RADIUS) {
    return new THREE.Vector3().setFromSpherical(this.toSpherical(radius));
  }

  str() {
    return `(${this.lat}, ${this.lon})`;
  }
}
