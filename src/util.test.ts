import * as THREE from "three";
import { mergeDuplicateVertices } from "./util";

let geometry: THREE.BufferGeometry;

describe("mergeDuplicateVertices", () => {
  beforeEach(() => {
    geometry = new THREE.BoxGeometry(2, 2, 2, 1, 1, 1).toNonIndexed();
  });

  afterEach(() => {
    geometry.dispose();
  });

  test("correctly compresses the positions and index of the given geometry", () => {
    expect(geometry.getAttribute("position").count).toBe(36); // Six vertices (two triangles) per face
    // expect(geometry.getAttribute("position").array).toEqual("dicks");
    expect(geometry.getAttribute("position").array).toEqual(Float32Array.from([
      1, 1, 1,   1, -1, 1,   1, 1, -1,   1, -1, 1,   1, -1, -1,   1, 1, -1,
      -1, 1, -1,   -1, -1, -1,   -1, 1, 1,   -1, -1, -1,   -1, -1, 1,   -1, 1, 1,
      -1, 1, -1,   -1, 1, 1,   1, 1, -1,   -1, 1, 1,   1, 1, 1,   1, 1, -1,
      -1, -1, 1,   -1, -1, -1,   1, -1, 1,   -1, -1, -1,   1, -1, -1,   1, -1, 1,
      -1, 1, 1,   -1, -1, 1,   1, 1, 1,   -1, -1, 1,   1, -1, 1,   1, 1, 1,
       1, 1, -1,   1, -1, -1,   -1, 1, -1,   1, -1, -1,   -1, -1, -1,   -1, 1, -1,
    ]));
    expect(geometry.index).toBe(null);

    mergeDuplicateVertices(geometry);

    expect(geometry.getAttribute("position").count).toBe(8); // One per vertex in the cube
    expect(geometry.getAttribute("position").array).toEqual(Float32Array.from([
      1, 1, 1,      1, -1, 1,     1, 1, -1,   1, -1, -1,
      -1, 1, -1,   -1, -1, -1,   -1, 1, 1,   -1, -1, 1,
    ]));
    expect(geometry.index?.count).toBe(36);
    expect(geometry.index?.array).toEqual(Uint16Array.from([
      0, 1, 2,  1, 3, 2,  4, 5, 6,  5, 7, 6,  4, 6, 2,  6, 0, 2,
      7, 5, 1,  5, 3, 1,  6, 7, 0,  7, 1, 0,  2, 3, 4,  3, 5, 4,
    ]));
  });
});
