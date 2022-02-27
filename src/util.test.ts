import * as THREE from "three";
import { convertNonIndexedGeometryToIndexed } from "./util";

let geometry: THREE.BoxGeometry;

describe("convertNonIndexedGeometryToIndexed", () => {
  beforeEach(() => {
    geometry = new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
  });

  afterEach(() => {
    geometry.dispose();
  });

  test("converts a non-indexed geometry to an indexed one", () => {
    expect(geometry.getAttribute("position").count).toBe(24); // Four vertexes per face
    expect(geometry.getAttribute("position").array).toEqual(Float32Array.from([
       1, 1, 1,     1, 1, -1,    1, -1, 1,    1, -1, -1,  -1, 1, -1,   -1, 1, 1,
      -1, -1, -1,  -1, -1, 1,   -1, 1, -1,    1, 1, -1,   -1, 1, 1,     1, 1, 1,
      -1, -1, 1,    1, -1, 1,   -1, -1, -1,   1, -1, -1,  -1, 1, 1,     1, 1, 1,
      -1, -1, 1,    1, -1, 1,    1, 1, -1,   -1, 1, -1,    1, -1, -1,  -1, -1, -1,
    ]));
    expect(geometry.index).toBe(null);

    convertNonIndexedGeometryToIndexed(geometry);

    expect(geometry.getAttribute("position").count).toBe(8); // One per vertex in the cube
    expect(geometry.getAttribute("position").array).toEqual(Float32Array.from([
       1, 1, 1,    1, 1, -1,  1, -1, 1,    1, -1, -1,
      -1, 1, -1,  -1, 1, 1,  -1, -1, -1,  -1, -1, 1,
    ]));
    expect(geometry.index?.count).toBe(8);
    expect(geometry.index?.array).toEqual(Uint16Array.from([
      0, 1, 2,   1, 2, 3,   2, 3, 4,   3, 4, 5,
      4, 5, 6,   5, 6, 7,   6, 7, 4,   7, 4, 1,
    ]));
  });
});
