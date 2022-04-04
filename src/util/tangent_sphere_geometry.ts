import * as THREE from "three";

import { PLANET_RADIUS } from "../planet"
import { v2s } from "../util";

export { TangentSphereGeometry };

// When you wrap a cube around a sphere, the grid cells get very distorted: huge and bulging in the center of faces, but
// tiny and tightly packed around the corners. To minimize this distortion, we can apply a simple tangent adjustment to
// to the cube's grid lines to make the wrapped cells more uniform in size. We could do something fancier like a COBE
// quadrilateralized sphere if we needed to, but this is probably okay for now. Most of this file is a hastily
// simplified version of THREE's BoxGeometry class.
//
// Like THREE.BoxGeometry, we create our cube faces with 0 in the upper left corner and N in the lower right,
// proceeding horizontally.
class TangentSphereGeometry extends THREE.BufferGeometry {
  protected cornerPlanes: THREE.Plane[];
  public radius: number;

  constructor(segmentsPerSide = 1, radius = PLANET_RADIUS) {
    super();
    this.type = "TangentSphereGeometry";

    this.radius = radius;
    this.cornerPlanes = this.makeCornerPlanes();
    const sideLength = radius * 2;
    segmentsPerSide = Math.floor(segmentsPerSide);

    const indices: number[] = [];
    const vertices: number[] = [];

    let numberOfVertices = 0;

    buildPlane(2, 1, 0, -1, -1,  1);
    buildPlane(2, 1, 0,  1, -1, -1);
    buildPlane(0, 2, 1,  1,  1,  1);
    buildPlane(0, 2, 1,  1, -1, -1);
    buildPlane(0, 1, 2,  1, -1,  1);
    buildPlane(0, 1, 2, -1, -1, -1);

    this.setIndex(indices);
    this.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.addGroup(0, numberOfVertices, 1);

    // FIXME: I'm doing something slightly wrong here, I think. Every other version of this code that I've seen just
    // does a straight tan() on the UV, but when I do that I reverse my problem, making tiny cells in the center of
    // faces (where the tan() function is right around the X axis) and giant faces at the corners. Doing the
    // pow(uv, 1/6) call fixes the problem and gives us nice-looking cells, but none of the other implementations I've
    // looked at do anything similar, so I think I might be compensating for a bug. Will revisit someday.
    function uvWithTangentAdjustment(n: number) {
      let unitUV = n / segmentsPerSide * 2 - 1; // A coordinate in the range [-1, 1], where 0 is the center.
      let cellSpaceUV = n - segmentsPerSide / 2; // A coordinate in the range [-segmentsPerSide/2, segmentsPerSide/2].
      let scale = Math.tan(Math.pow(Math.abs(unitUV), 1/6) * (Math.PI / 4));
      scale += (1.0 / 9007199254740992.0) * scale; // correct tiny floating-point inaccuracies
      return cellSpaceUV * scale;
    }

    function buildPlane(u: number, v: number, w: number, udir: number, vdir: number, wdir: number) {
      const segmentSize = sideLength / segmentsPerSide;
      const depthHalf = sideLength / 2 * wdir;
      const segmentsPlusOne = segmentsPerSide + 1;
      const vector = new THREE.Vector3();

      let vertexCounter = 0;

      for (let iy = 0; iy < segmentsPlusOne; iy++) {
        const y = uvWithTangentAdjustment(iy) * segmentSize;

        for (let ix = 0; ix < segmentsPlusOne; ix++) {
          const x = uvWithTangentAdjustment(ix) * segmentSize;

          vector.setComponent(u, x * udir);
          vector.setComponent(v, y * vdir);
          vector.setComponent(w, depthHalf);
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

  cellForUV(u: number, v: number) {

  }

  // Problem: We need a cheap way to determine which grid cell a given point-on-sphere lies inside. That's a calculation
  // we're going to do many times per frame. Raycasting works, but is orders of magnitude too slow.
  //
  // Solution: Imagine a cube which fits snugly inside the sphere. To determine which face a particular point-on-sphere
  // is inside, we create six planes that define the sides of that cube. This lets us find the correct face with cheap
  // "which side of the plane is this point on" tests, and then we can do some trigonometry to work out the grid cell
  // within that face. Hopefully that will be cheaper than rays.
  protected makeCornerPlanes() {
    return [
      new THREE.Plane(new THREE.Vector3( 1, 0, 0), this.radius), // right face
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), this.radius), // left face
      new THREE.Plane(new THREE.Vector3(0,  1, 0), this.radius), // top face
      new THREE.Plane(new THREE.Vector3(0, -1, 0), this.radius), // bottom face
      new THREE.Plane(new THREE.Vector3(0, 0,  1), this.radius), // front face
      new THREE.Plane(new THREE.Vector3(0, 0, -1), this.radius), // back face
    ];
  }

  protected faceContainingPoint(pointOnSphere: THREE.Vector3) {
    // Future optimization: Remember the last face that we returned and start looking from there, instead of searching
    // from 0 upwards every time.
    for (let face = 0; face < 6; face++) {
      if (this.cornerPlanes[face].distanceToPoint(pointOnSphere) >= 0) {
        return face;
      }
    }
    throw `Can't find a face for ${v2s(pointOnSphere)}!`;
  }
}
