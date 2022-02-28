import * as THREE from "three";
import { mergeIdenticalVertices } from "./util";

let geometry: THREE.BoxGeometry;

describe("mergeIdenticalVertices", () => {
  beforeEach(() => {
    geometry = new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
  });

  afterEach(() => {
    geometry.dispose();
  });

  test("correctly compresses the positions and index of the given geometry", () => {
    expect(geometry.getAttribute("position").count).toBe(24); // Four vertexes per face
    expect(geometry.getAttribute("position").array).toEqual(Float32Array.from([
       1, 1, 1,     1, 1, -1,    1, -1, 1,    1, -1, -1,  -1, 1, -1,   -1, 1, 1,
      -1, -1, -1,  -1, -1, 1,   -1, 1, -1,    1, 1, -1,   -1, 1, 1,     1, 1, 1,
      -1, -1, 1,    1, -1, 1,   -1, -1, -1,   1, -1, -1,  -1, 1, 1,     1, 1, 1,
      -1, -1, 1,    1, -1, 1,    1, 1, -1,   -1, 1, -1,    1, -1, -1,  -1, -1, -1,
    ]));
    expect(geometry.index?.count).toBe(36); // Two triangles (six vertices) per face
    expect(geometry.index?.array).toEqual(Uint16Array.from([
       0,  2,  1,  2,  3,  1,  4,  6,  5,  6,  7,  5,
       8, 10,  9, 10, 11,  9, 12, 14, 13, 14, 15, 13,
      16, 18, 17, 18, 19, 17, 20, 22, 21, 22, 23, 21,
    ]));

    mergeIdenticalVertices(geometry);

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
