import * as THREE from "three";
import { GeoCoord } from "./geo_coord";

const data = [
  { sph: new THREE.Spherical(1, 0, 0), geo: [90, 0], vec: new THREE.Vector3() }, // north pole
  { sph: new THREE.Spherical(1, Math.PI, 0), geo: [-90, 0], vec: new THREE.Vector3() }, // south pole
  { sph: new THREE.Spherical(1, Math.PI / 2, 0), geo: [0, 0], vec: new THREE.Vector3() }, // equator
  { sph: new THREE.Spherical(1, Math.PI / 4, 0), geo: [45, 0], vec: new THREE.Vector3() }, // northern
  { sph: new THREE.Spherical(1, Math.PI / 4 * 3, 0), geo: [-45, 0], vec: new THREE.Vector3() }, // southern
  { sph: new THREE.Spherical(1, Math.PI / 2, Math.PI / 2), geo: [0, 90], vec: new THREE.Vector3() }, // eastern
  { sph: new THREE.Spherical(1, Math.PI / 2, Math.PI * 1.5), geo: [0, -90], vec: new THREE.Vector3() }, // western
  { sph: new THREE.Spherical(1, Math.PI / 2, Math.PI), geo: [0, 180], vec: new THREE.Vector3() }, // back
];

describe("fromSpherical", () => {
  test("handles various cases correctly", () => {
    for (let testCase of data) {
      let geo = GeoCoord.fromSpherical(testCase["sph"]);
      expect([geo.lat, geo.lon]).toEqual(testCase["geo"]);
    }
  });
});

describe("toSpherical", () => {
  test("handles various cases correctly", () => {
    for (let testCase of data) {
      let geo = new GeoCoord(testCase["geo"][0], testCase["geo"][1]);
      let sph = geo.toSpherical(1);
      expect(sph.radius).toEqual(testCase["sph"].radius);
      expect(sph.phi).toEqual(testCase["sph"].phi);
      expect(sph.theta).toEqual(testCase["sph"].theta);
    }
  });
});

// TO DO: tests for toWorldVector and fromWorldVector
