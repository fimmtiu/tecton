import * as THREE from "three";

import { GeoCoord } from "../util/geo_coord";

export { PlateCell, Plate, PlateBoundary, PLATE_COLORS };

const WATER_PLATE_COLORS = [
  new THREE.MeshBasicMaterial({ color: 0x4287f5 }),
  new THREE.MeshBasicMaterial({ color: 0x4789ed }),
  new THREE.MeshBasicMaterial({ color: 0x2754a3 }),
  new THREE.MeshBasicMaterial({ color: 0x1d5bc6 }),
  new THREE.MeshBasicMaterial({ color: 0x47caff }),
  new THREE.MeshBasicMaterial({ color: 0x87d0f2 }),
  new THREE.MeshBasicMaterial({ color: 0x369edb }),
  new THREE.MeshBasicMaterial({ color: 0x376cc6 }),
];
const LAND_PLATE_COLORS = [
  new THREE.MeshBasicMaterial({ color: 0x4da632 }),
  new THREE.MeshBasicMaterial({ color: 0x008000 }),
  new THREE.MeshBasicMaterial({ color: 0x98fb98 }),
  new THREE.MeshBasicMaterial({ color: 0x90ee90 }),
  new THREE.MeshBasicMaterial({ color: 0x8fbc8f }),
  new THREE.MeshBasicMaterial({ color: 0xadff2f }),
  new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
  new THREE.MeshBasicMaterial({ color: 0x00ff7f }),
  new THREE.MeshBasicMaterial({ color: 0x7fff00 }),
  new THREE.MeshBasicMaterial({ color: 0x32cd32 }),
  new THREE.MeshBasicMaterial({ color: 0x00fa9a }),
  new THREE.MeshBasicMaterial({ color: 0x7cfc00 }),
  new THREE.MeshBasicMaterial({ color: 0x3cb371 }),
  new THREE.MeshBasicMaterial({ color: 0x2e8b57 }),
  new THREE.MeshBasicMaterial({ color: 0x228b22 }),
  new THREE.MeshBasicMaterial({ color: 0x006400 }),
];
const PLATE_COLORS = WATER_PLATE_COLORS.concat(LAND_PLATE_COLORS);
const CONVERGENCE_THRESHOLD = 0.3

class PlateCell {
  public readonly id: number;
  public readonly lineSegments: Array<THREE.Vector3>;
  public readonly center: THREE.Vector3;
  public plate: Plate;

  constructor(id: number, plate: Plate, lineSegments: Array<THREE.Vector3>) {
    this.id = id;
    this.lineSegments = lineSegments;
    this.center = this.centroid();
    this.plate = plate;
  }

  // Calculates the centroid of an irregular convex polygon. This is more work than I thought it would be.
  // We chop up the polygon into triangles, calculate the centroids and areas of those triangles, then
  // calculate the average for each coordinate weighted by triangle area. Oy!
  // FIXME: Do we still need this?
  protected centroid() {
    const triangleAreas = [];
    const triangleCentroids = [];
    const firstVertex = this.lineSegments[0];

    for (let i = 1; i < this.lineSegments.length - 2; i++) {
      const secondVertex = this.lineSegments[i];
      const thirdVertex = this.lineSegments[i + 1];

      triangleAreas.push(this.triangleArea(firstVertex, secondVertex, thirdVertex));
      triangleCentroids.push(new THREE.Vector3(
        (firstVertex.x + secondVertex.x + thirdVertex.x) / 3,
        (firstVertex.y + secondVertex.y + thirdVertex.y) / 3,
        (firstVertex.z + secondVertex.z + thirdVertex.z) / 3,
      ));
    }

    const totalArea = triangleAreas.reduce((prev, cur) => { return prev + cur });
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < triangleAreas.length; i++) {
      const percentageOfTotalArea = triangleAreas[i] / totalArea;
      x += triangleCentroids[i].x * percentageOfTotalArea;
      y += triangleCentroids[i].y * percentageOfTotalArea;
      z += triangleCentroids[i].z * percentageOfTotalArea;
    }
    return new THREE.Vector3(x, y, z);
  }

  // TIL about Heron's Formula for calculating triangle areas: https://en.wikipedia.org/wiki/Heron%27s_formula
  protected triangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    const aLen = a.distanceTo(b), bLen = b.distanceTo(c), cLen = c.distanceTo(a);
    const semi = (aLen + bLen + cLen) / 2;
    return Math.sqrt((semi - aLen) * (semi - bLen) * (semi - cLen) * semi);
  }
}

class Plate {
  public readonly id: number;
  public readonly direction: THREE.Vector2;
  public isLand: boolean;
  public interactsWithOthers = true;
  public boundaries: Array<PlateBoundary>;

  constructor(id: number, isLand = false, direction: THREE.Vector2 | null = null) {
    this.id = id;
    this.isLand = isLand;
    this.direction = direction || new THREE.Vector2().random().setLength(1.0);
    this.boundaries = [];
  }

  color() {
    let offset = 0, count = WATER_PLATE_COLORS.length;
    if (this.isLand) {
      offset = WATER_PLATE_COLORS.length;
      count = LAND_PLATE_COLORS.length;
    }
    return offset + (this.id % count);
  }
}

class PlateBoundary {
  static relativePlateVelocities: { [hash: string]: number } = {};

  public readonly startPoint: THREE.Vector3;
  public readonly endPoint: THREE.Vector3;
  public readonly plateCells: PlateCell[];
  public readonly convergence: number;

  constructor(cellA: PlateCell, cellB: PlateCell) {
    this.plateCells = [cellA, cellB].sort((a, b) => a.plate.id - b.plate.id);
    const sharedLineSegment = this.sharedLineSegment();
    this.startPoint = sharedLineSegment[0];
    this.endPoint = sharedLineSegment[1];
    this.convergence = this.calculateConvergence();
  }

  colliding() {
    return this.convergence > CONVERGENCE_THRESHOLD;
  }

  diverging() {
    return this.convergence < -CONVERGENCE_THRESHOLD;
  }

  otherPlate(plate: Plate) {
    return this.plateCells[0].plate == plate ? this.plateCells[1].plate : this.plateCells[0].plate;
  }

  protected sharedLineSegment() {
    for (let i = 0; i < this.plateCells[0].lineSegments.length - 1; i++) {
      for (let j = 0; j < this.plateCells[1].lineSegments.length - 1; j++) {
        const a = this.plateCells[0].lineSegments[i], b = this.plateCells[0].lineSegments[i + 1],
              c = this.plateCells[1].lineSegments[j], d = this.plateCells[1].lineSegments[j + 1];
        if (a.equals(c) && b.equals(d) || a.equals(d) && b.equals(c)) {
          return [a, b];
        }
      }
    }
    throw `Can't find a shared line segment between ${this.plateCells[0].id} and ${this.plateCells[1].id}!`;
  }

  // Returns a float representing the plates' motion relative to one another: 0.0 is not moving or moving parallel,
  // 1.0 is colliding hard, and -1.0 is moving away from one another quickly.
  protected calculateConvergence() {
    // create plane based on plates' centers and normal from origin
    // project plane direction 2d vectors onto the plane at the plates' centers -- this is hard! which way is north?
    //   Doesn't matter! Just arbitrarily choose the first vector's direction as north and the other is relative to it
    //     No, it does matter, or else plates won't have consistent directions across different sides.
    // Find the difference in angle between them...
    // LAST STOP needs more thought.


    // This is a stopgap alternative that just sets the relative plate velocities randomly instead of calculating it
    // based on the plate directions. Someday we'll revisit that.
    if (this.plateCells[0].plate.interactsWithOthers && this.plateCells[1].plate.interactsWithOthers) {
      return this.relativePlateVelocity(this.plateCells[0].plate, this.plateCells[1].plate);
    }
    return 0.0;
  }

  protected relativePlateVelocity(plateA: Plate, plateB: Plate) {
    const key = `${plateA.id},${plateB.id}`;

    if (!PlateBoundary.relativePlateVelocities[key]) {
      if (plateA.id % 2 > plateB.id % 2) {
        PlateBoundary.relativePlateVelocities[key] = THREE.MathUtils.randFloat(CONVERGENCE_THRESHOLD, 1.0);
      } else if (plateA.id % 2 < plateB.id % 2) {
        PlateBoundary.relativePlateVelocities[key] = THREE.MathUtils.randFloat(-1.0, -CONVERGENCE_THRESHOLD);
      } else {
        PlateBoundary.relativePlateVelocities[key] = THREE.MathUtils.randFloat(-CONVERGENCE_THRESHOLD, CONVERGENCE_THRESHOLD);
      }
    }
    return PlateBoundary.relativePlateVelocities[key];
  }
}
