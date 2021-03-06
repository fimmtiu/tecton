import * as THREE from "three";

import { PLANET_RADIUS } from "../planet"
import { scene } from "../scene_data";
import { v2s, sphericalFromCoords } from "../util";
import { wrapMeshAroundSphere } from "../util/geometry";

export { TangentSphere };

const PI_2 = Math.PI / 2;
const PI_4 = Math.PI / 4;
const ROTATIONS_TO_TOP_FACE = [
  new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI_2, -PI_2, 0)),  // right side
  new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI_2, PI_2, 0)),   // left side
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),          // top side
  new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),    // bottom side
  new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI_2, 0, 0)),      // front side
  new THREE.Quaternion().setFromEuler(new THREE.Euler(PI_2, 0, Math.PI)), // back side
];

// When you wrap a cube around a sphere, the grid cells get very distorted: huge and bulging in the center of faces, but
// tiny and tightly packed around the corners. To minimize this distortion, we can apply a simple tangent adjustment to
// the cube's grid lines to make the wrapped cells more uniform in size. We could do something fancier like a COBE
// quadrilateralized sphere if we needed to, but this is probably okay for now. Most of this file is a hastily
// simplified version of THREE's BoxGeometry class.
//
// Like THREE.BoxGeometry, we number our cells with 0 in the upper left corner and N in the lower right, proceeding
// horizontally.
class TangentSphere extends THREE.Mesh {
  protected cornerPlanes: THREE.Plane[];
  protected segmentsPerSide: number;
  public radius: number;

  constructor(segmentsPerSide = 1, radius = PLANET_RADIUS) {
    super();

    this.visible = false;
    this.radius = radius;
    this.cornerPlanes = this.makeCornerPlanes();

    const indices: number[] = [];
    const vertices: number[] = [];
    this.segmentsPerSide = segmentsPerSide = Math.floor(segmentsPerSide);

    this.buildPlane(2, 1, 0, -1, -1,  1, indices, vertices); // right side
    this.buildPlane(2, 1, 0,  1, -1, -1, indices, vertices); // left side
    this.buildPlane(0, 2, 1,  1,  1,  1, indices, vertices); // top side
    this.buildPlane(0, 2, 1,  1, -1, -1, indices, vertices); // bottom side
    this.buildPlane(0, 1, 2,  1, -1,  1, indices, vertices); // front side
    this.buildPlane(0, 1, 2, -1, -1, -1, indices, vertices); // back side

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(indices);
    this.geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.addGroup(0, indices.length, 1);
    wrapMeshAroundSphere(this.geometry, this.radius);

    // const segments = new THREE.LineSegments(this.geometry.clone(), new THREE.LineBasicMaterial({ color: 0xffff00 }));
    // segments.geometry.scale(1.05, 1.05, 1.05);
    // scene.add(segments);
  }

  cellIndexAtPoint(face: number, pointOnSphere: THREE.Vector3) {
    // Rotate the point to the top face of the cube so that we can do easy spherical math.
    let topEquivalent = pointOnSphere.clone().applyQuaternion(ROTATIONS_TO_TOP_FACE[face]);
    let sphTop = sphericalFromCoords(topEquivalent);

    // Extend the radius of the spherical coordinate out to where it meets the cube face.
    sphTop.radius /= Math.cos(sphTop.phi);

    // Find the (x, y) coordinates of that point on the cube face.
    const pointOnFace = new THREE.Vector3().setFromSpherical(sphTop);
    let faceCoordsUv = new THREE.Vector2(-pointOnFace.x / PLANET_RADIUS, pointOnFace.z / PLANET_RADIUS);

    // Invert the tangent adjustment on it.
    let faceCoords = new THREE.Vector2(
      this.stToCoord(this.uvToSt(faceCoordsUv.x)),
      this.stToCoord(this.uvToSt(faceCoordsUv.y)),
    );

    // Calculate which cell it falls in.
    return Math.floor(faceCoords.y) * this.segmentsPerSide + (this.segmentsPerSide - Math.floor(faceCoords.x) - 1);
  }

  // [0..segmentsPerSide] -> [0..1]
  protected coordToSt(coord: number) {
    return coord / this.segmentsPerSide;
  }

  // [0..1] -> [0..segmentsPerSide]
  protected stToCoord(st: number) {
    return st * this.segmentsPerSide;
  }

  // [0..1] -> [-1..1]
  protected stToUv(st: number) {
    let uv = Math.tan(PI_2 * st - PI_4);
    uv += (1.0 / 9007199254740992.0) * uv; // correct tiny floating-point inaccuracies with tan()
    return uv;
  }

  // [-1..1] -> [0..1]
  protected uvToSt(uv: number) {
    return (2 / Math.PI) * (Math.atan(uv) + PI_4);
  }

  protected buildPlane(
    u: number, v: number, w: number,
    udir: number, vdir: number, wdir: number,
    indices: number[], vertices: number[]
  ) {
    const depthLength = this.radius * wdir;
    const segmentsPlusOne = this.segmentsPerSide + 1;
    const initialVertices = vertices.length / 3;
    const vector = new THREE.Vector3();

    for (let iy = 0; iy < segmentsPlusOne; iy++) {
      const y = this.stToUv(this.coordToSt(iy)) * this.radius;

      for (let ix = 0; ix < segmentsPlusOne; ix++) {
        const x = this.stToUv(this.coordToSt(ix)) * this.radius;

        vector.setComponent(u, x * udir);
        vector.setComponent(v, y * vdir);
        vector.setComponent(w, depthLength);
        vertices.push(vector.x, vector.y, vector.z);
      }
    }

    for (let iy = 0; iy < this.segmentsPerSide; iy++) {
      for (let ix = 0; ix < this.segmentsPerSide; ix++) {
        const a = initialVertices + ix + segmentsPlusOne * iy;
        const b = initialVertices + ix + segmentsPlusOne * (iy + 1);
        const c = initialVertices + (ix + 1) + segmentsPlusOne * (iy + 1);
        const d = initialVertices + (ix + 1) + segmentsPlusOne * iy;

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  protected vec2ToSpherical(face: number, vec: THREE.Vector2) {
    const startOfFace = face * (this.segmentsPerSide ** 2);
    const index = startOfFace + vec.x * this.segmentsPerSide + vec.y;
    const positions = this.geometry.getAttribute("position");
    const point = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
    return new THREE.Spherical().setFromVector3(point);
  }

  // Problem: We need a cheap way to determine which grid cell a given point-on-sphere lies inside. That's a calculation
  // we're going to do many times per frame. Raycasting works, but is orders of magnitude too slow.
  //
  // Solution: Imagine a cube which fits snugly inside the sphere. To determine which face a particular point-on-sphere
  // belongs to, we create six planes that define the sides of that cube. This lets us find the correct face with cheap
  // "which side of the plane is this point on" tests, and then we can do some trigonometry to work out the grid cell
  // within that face. Hopefully that will be fast enough.
  protected makeCornerPlanes() {
    const distance = this.radius / Math.sqrt(3);
    return [
      new THREE.Plane(new THREE.Vector3(-1,  0,  0), distance), // right side
      new THREE.Plane(new THREE.Vector3( 1,  0,  0), distance), // left side
      new THREE.Plane(new THREE.Vector3( 0, -1,  0), distance), // top side
      new THREE.Plane(new THREE.Vector3( 0,  1,  0), distance), // bottom side
      new THREE.Plane(new THREE.Vector3( 0,  0, -1), distance), // front side
      new THREE.Plane(new THREE.Vector3( 0,  0,  1), distance), // back side
    ];
  }

  // At the edges where the planes intersect you'll have some points that match more than one plane. In that case,
  // we want to return the plane that's closest to the point.
  //
  // Future optimization: Remember the last face that we returned and start looking from there, instead of searching
  // from 0 upwards every time.
  public faceContainingPoint(pointOnSphere: THREE.Vector3) { // FIXME make protected later
    let firstFace: number|null = null;
    let firstDistance: number|null = null;

    for (let face = 0; face < 6; face++) {
      const dist = this.cornerPlanes[face].distanceToPoint(pointOnSphere);

      if (dist <= 0) {
        if (firstDistance === null) {
          firstDistance = dist;
          firstFace = face;
        } else {
          return firstDistance < dist ? <number>firstFace : face;
        }
      }
    }

    if (firstFace !== null) {
      return firstFace;
    } else {
      throw `Can't find a face for ${v2s(pointOnSphere)}!`;
    }
  }
}
