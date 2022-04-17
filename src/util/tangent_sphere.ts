import * as THREE from "three";

import { PLANET_RADIUS } from "../planet"
import { v2s, sphericalFromCoords } from "../util";
import { wrapMeshAroundSphere } from "../util/geometry";

export { TangentSphere };

// When you wrap a cube around a sphere, the grid cells get very distorted: huge and bulging in the center of faces, but
// tiny and tightly packed around the corners. To minimize this distortion, we can apply a simple tangent adjustment to
// to the cube's grid lines to make the wrapped cells more uniform in size. We could do something fancier like a COBE
// quadrilateralized sphere if we needed to, but this is probably okay for now. Most of this file is a hastily
// simplified version of THREE's BoxGeometry class.
//
// Like THREE.BoxGeometry, we number our cells with 0 in the upper left corner and N in the lower right, proceeding
// horizontally.
class TangentSphere extends THREE.Mesh {
  protected cornerPlanes: THREE.Plane[];
  public radius: number;

  constructor(segmentsPerSide = 1, radius = PLANET_RADIUS) {
    super();

    this.radius = radius;
    this.cornerPlanes = this.makeCornerPlanes();

    const indices: number[] = [];
    const vertices: number[] = [];
    const sideLength = radius * 2;
    segmentsPerSide = Math.floor(segmentsPerSide);

    let numberOfVertices = 0;

    buildPlane(2, 1, 0, -1, -1,  1);
    buildPlane(2, 1, 0,  1, -1, -1);
    buildPlane(0, 2, 1,  1,  1,  1);
    buildPlane(0, 2, 1,  1, -1, -1);
    buildPlane(0, 1, 2,  1, -1,  1);
    buildPlane(0, 1, 2, -1, -1, -1);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(indices);
    this.geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.addGroup(0, numberOfVertices, 1);
    wrapMeshAroundSphere(this.geometry, PLANET_RADIUS);

    // [0..segmentsPerSide] -> [0..1]
    function coordToSt(coord: number) {
      return coord / segmentsPerSide;
    }

    // [0..1] -> [-1..1]
    function stToUv(st: number) {
      let uv = Math.tan((Math.PI / 2) * st - Math.PI / 4);
      uv += (1.0 / 9007199254740992.0) * uv; // correct tiny floating-point inaccuracies with tan()
      return uv;
    }

    function buildPlane(u: number, v: number, w: number, udir: number, vdir: number, wdir: number) {
      const halfSideLength = sideLength / 2;
      const depthLength = halfSideLength * wdir;
      const segmentsPlusOne = segmentsPerSide + 1;
      const vector = new THREE.Vector3();

      let vertexCounter = 0;

      for (let iy = 0; iy < segmentsPlusOne; iy++) {
        const y = stToUv(coordToSt(iy)) * halfSideLength;

        for (let ix = 0; ix < segmentsPlusOne; ix++) {
          const x = stToUv(coordToSt(ix)) * halfSideLength;

          vector.setComponent(u, x * udir);
          vector.setComponent(v, y * vdir);
          vector.setComponent(w, depthLength);
          vertices.push(vector.x, vector.y, vector.z);

          vertexCounter += 1;
        }
      }

      for (let iy = 0; iy < segmentsPerSide; iy++) {
        for (let ix = 0; ix < segmentsPerSide; ix++) {
          const a = numberOfVertices + ix + segmentsPlusOne * iy;
          const b = numberOfVertices + ix + segmentsPlusOne * (iy + 1);
          const c = numberOfVertices + (ix + 1) + segmentsPlusOne * (iy + 1);
          const d = numberOfVertices + (ix + 1) + segmentsPlusOne * iy;

          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }

      numberOfVertices += vertexCounter;
    }
  }

  cellAtPoint(pointOnSphere: THREE.Vector3) {
    const spherical = sphericalFromCoords(pointOnSphere);
    const distanceToFace = this.radius * Math.cos(spherical.phi);

    // invert the tangent adjustment

    // divide by segmentsPerSide / (radius * 2)
  }

  // Problem: We need a cheap way to determine which grid cell a given point-on-sphere lies inside. That's a calculation
  // we're going to do many times per frame. Raycasting works, but is orders of magnitude too slow.
  //
  // Solution: Imagine a cube which fits snugly inside the sphere. To determine which face a particular point-on-sphere
  // belongs to, we create six planes that define the sides of that cube. This lets us find the correct face with cheap
  // "which side of the plane is this point on" tests, and then we can do some trigonometry to work out the grid cell
  // within that face. Hopefully that will be cheaper than rays.
  protected makeCornerPlanes() {
    const distance = Math.cos(Math.PI / 4) * this.radius;
    return [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), distance), // right face
      new THREE.Plane(new THREE.Vector3( 1, 0, 0), distance), // left face
      new THREE.Plane(new THREE.Vector3(0, -1, 0), distance), // top face
      new THREE.Plane(new THREE.Vector3(0,  1, 0), distance), // bottom face
      new THREE.Plane(new THREE.Vector3(0, 0, -1), distance), // front face
      new THREE.Plane(new THREE.Vector3(0, 0,  1), distance), // back face
    ];
  }

  public faceContainingPoint(pointOnSphere: THREE.Vector3) { // FIXME make protected later
    // Future optimization: Remember the last face that we returned and start looking from there, instead of searching
    // from 0 upwards every time.
    for (let face = 0; face < 6; face++) {
      if (this.cornerPlanes[face].distanceToPoint(pointOnSphere) <= 0) {
        return face;
      }
    }
    throw `Can't find a face for ${v2s(pointOnSphere)}!`;
  }
}
