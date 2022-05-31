import * as THREE from "three";

import { Plate, PlateBoundary } from "./terrain/plates";
import { PlateSphere } from "./terrain/plate_sphere";
import { HeightCubeField } from "./terrain/height_cube_field";
import { noiseGenerator } from "./util";

export { Terrain };

type Biome = Array<[number, string]>;

const NOISE_SCALE = 6000;
const MIN_ELEVATION = -11;  // 11 km is the deepest point on the Earth's surface.
const MAX_ELEVATION = 9;    // Mount Everest is nearly 9 km high.
const NOISE_LEVELS = [
  { offset: 1,    amplitude: 1    },
  { offset: 5.1,  amplitude: 1/4  },
  { offset: 9.7,  amplitude: 1/8  },
  { offset: 14.2, amplitude: 1/16 },
  { offset: 20.0, amplitude: 1/24 },
  { offset: 29.5, amplitude: 1/32 },
  { offset: 33.8, amplitude: 1/48 },
  { offset: 41.3, amplitude: 1/64 },
];
const MAX_AMPLITUDE = NOISE_LEVELS.reduce((n, level) => { return n + level.amplitude }, 0);

// Some commonly used heights expressed in the -1.0 .. 1.0 range.
const HEIGHT_1_M = 1 / (MAX_ELEVATION * 1000);
const HEIGHT_90_M = 90 / (MAX_ELEVATION * 1000);
const HEIGHT_600_M = 600 / (MAX_ELEVATION * 1000);
const DEPTH_1_M = 1 / (MIN_ELEVATION * 1000);
const DEPTH_100_M = 100 / (MIN_ELEVATION * 1000);
const DEPTH_6000_M = 6000 / (MIN_ELEVATION * 1000);

class Terrain {
  protected plateSphere: PlateSphere;
  public heightMap: HeightCubeField;
  public min = 10000;
  public max = -10000;

  constructor() {
    this.plateSphere = new PlateSphere();
    this.heightMap = new HeightCubeField(100, this.plateSphere);

    // Set the initial heights for all heightmap cells.
    for (let i = 0; i < this.heightMap.cellCount; i++) {
      const heightCell = this.heightMap.get(i);

      if (heightCell.nearnessToWater == 1) {
        // Open ocean. Vary gradually between -100m and -6,000m.
        heightCell.height = this.randomHeightBetween(heightCell.center, DEPTH_100_M, DEPTH_6000_M);

      } else if (heightCell.nearnessToWater == 0) {
        // Landlocked. Vary gradually between 90m and 600m.
        heightCell.height = this.randomHeightBetween(heightCell.center, HEIGHT_90_M, HEIGHT_600_M);

      } else {
        // Near a coastline.
        if (heightCell.height > 0) {
          // If land, slope gradually from 1m to 90m.
          heightCell.height = heightCell.nearnessToWater * HEIGHT_90_M + HEIGHT_1_M;

        } else {
          // If water, slope gradually from -1m to -100m.
          heightCell.height = heightCell.nearnessToWater * DEPTH_100_M + DEPTH_1_M;
        }
      }

      heightCell.height += this.tectonicHeightAdjustment(i);
      // Uncomment this once the space elevators are fixed.
      // heightCell.height = THREE.MathUtils.clamp(heightCell.height, -1.0, 1.0);

      if (heightCell.height > this.max) {
        this.max = heightCell.height;
      } else if (heightCell.height < this.min) {
        this.min = heightCell.height;
      }
    }
  }

  // FIXME: Pass the HeightCell instead of the cell index.
  protected tectonicHeightAdjustment(cell: number) {
    const cellCenter = this.heightMap.get(cell).center;
    const plate = this.plateSphere.plateAtPoint(cellCenter);
    let adjustment = 0;

    for (const [boundary, distance] of this.closestDistanceToAdjacentPlates(cellCenter, plate)) {
      if (boundary.colliding()) {
        if (boundary.plateCells[0].plate.isLand && boundary.plateCells[1].plate.isLand) {
          // Land-land plate collision that generates a mountain range.
          if (this.landToLandMountainHeight(distance, 500 * boundary.convergence, boundary.convergence)) {
            console.log(`cell ${Math.floor(cell / this.heightMap.cellsPerFace)}x${cell % this.heightMap.cellsPerFace}, distance ${distance} km from ${boundary.plateCells[0].plate.id}/${boundary.plateCells[1].plate.id}, land/land mountain ${this.landToLandMountainHeight(distance, 500 * boundary.convergence, boundary.convergence)}`);
          }
          adjustment += this.landToLandMountainHeight(distance, 500 * boundary.convergence, boundary.convergence);

        } else if (!boundary.plateCells[0].plate.isLand && !boundary.plateCells[1].plate.isLand) {
          // Ocean-ocean plate collision that generates an oceanic trench.
          if (this.oceanTrenchHeight(distance, 300 * boundary.convergence, MIN_ELEVATION * boundary.convergence)) {
            console.log(`cell ${Math.floor(cell / this.heightMap.cellsPerFace)}x${cell % this.heightMap.cellsPerFace}, distance ${distance} km from ${boundary.plateCells[0].plate.id}/${boundary.plateCells[1].plate.id}, ocean trench ${this.oceanTrenchHeight(distance, 300 * boundary.convergence, MIN_ELEVATION * boundary.convergence)}`);
          }
          adjustment += this.oceanTrenchHeight(distance, 300 * boundary.convergence, boundary.convergence);

        } else {
          // Land-ocean plate collision that generates a mountain range on the land cell and a short shelf on the ocean.
          if (plate.isLand) {
            if (this.oceanToLandMountainHeight(distance, 500 * boundary.convergence, boundary.convergence)) {
              console.log(`cell ${Math.floor(cell / this.heightMap.cellsPerFace)}x${cell % this.heightMap.cellsPerFace}, distance ${distance} km from ${boundary.plateCells[0].plate.id}/${boundary.plateCells[1].plate.id}, land/ocean mountain ${this.oceanToLandMountainHeight(distance, 500 * boundary.convergence, boundary.convergence)}`);
            }
            adjustment += this.oceanToLandMountainHeight(distance, 500 * boundary.convergence, boundary.convergence);
          } else {
            if (this.continentalShelfHeight(distance, 80 * boundary.convergence)) {
              console.log(`cell ${Math.floor(cell / this.heightMap.cellsPerFace)}x${cell % this.heightMap.cellsPerFace}, distance ${distance} km from ${boundary.plateCells[0].plate.id}/${boundary.plateCells[1].plate.id}, continental shelf ${this.continentalShelfHeight(distance, 80 * boundary.convergence)}`);
            }
            adjustment += this.continentalShelfHeight(distance, 80 * boundary.convergence);
          }
        }

      } else if (boundary.diverging()) {

      } else {

      }
    }

    return this.scaleHeight(adjustment);
  }

  // FIXME: better variable names, for Christ's sake
  // https://monkeyproofsolutions.nl/wordpress/how-to-calculate-the-shortest-distance-between-a-point-and-a-line/
  // These line segments are short enough that we don't need to take the globe's curvature into account.
  protected distanceToLine(lineStart: THREE.Vector3, lineEnd: THREE.Vector3, point: THREE.Vector3) {
    const m = new THREE.Vector3().subVectors(lineEnd, lineStart);
    const pma = new THREE.Vector3().subVectors(point, lineStart);
    const t = pma.dot(m) / m.dot(m);

    if (t < 0) {
      return point.distanceTo(lineStart);
    } else if (t > 0) {
      return point.distanceTo(lineEnd);
    } else {
      const t0m = m.clone().multiplyScalar(t);
      return point.distanceTo(lineStart.add(t0m));
    }
  }

  destroy() {
    this.plateSphere.destroy();
    this.heightMap.destroy();
  }

  dataAtPoint(pointOnSphere: THREE.Vector3) {
    const plateData = this.plateSphere.dataAtPoint(pointOnSphere);
    const heightMapCell = this.heightMap.cellIndexAtPoint(pointOnSphere);
    const face = this.heightMap.faceAtPoint(pointOnSphere);
    return {
      "elevation": Math.round(this.scaleHeight(this.normalizedHeightAt(pointOnSphere)) * 1000),
      "voronoiCell": plateData.cell.id,
      "plate": plateData.plate.id,
      "face": face,
      "gridCell": heightMapCell,
      // FIXME: Temporary approach for visualizing waterness, uses a protected method.
      // Change to this.heightMap.get(heightMapCell).nearnessToWater once we're no longer visualizing it.
      "nearnessToWater": this.heightMap.nearnessToWater(heightMapCell + face * this.heightMap.cellsPerFace),
    }
  }

  // Return the height at the given point as a float between -1.0 and 1.0, inclusive. (0.0 is sea level.)
  // To get the height in kilometers, pass this number to scaleHeight().
  normalizedHeightAt(pointOnSphere: THREE.Vector3) {
    return this.heightMap.cellAtPoint(pointOnSphere).height;
  }

  scaleHeight(height: number) {
    if (height < 0) {
      return height * -MIN_ELEVATION;
    } else {
      return height * MAX_ELEVATION;
    }
  }

  // FIXME: Later, biome calculation will take into account details like latitude, moisture, ocean currents, etc.
  // For now, though, it's just a simple function of height so that I can get texture mapping working.
  static readonly biomes: Biome = [
    [-1.00, "water9"],
    [-0.80, "water8"],
    [-0.70, "water7"],
    [-0.60, "water6"],
    [-0.50, "water5"],
    [-0.40, "water4"],
    [-0.30, "water3"],
    [-0.20, "water2"],
    [-0.10, "water1"],
    [ 0.00, "desert"],
    [ 0.10, "plain"],
    [ 0.20, "grassland"],
    [ 0.30, "jungle"],
    [ 0.40, "forest"],
    [ 0.55, "mountain"],
    [ 0.68, "snow"],
    [100.00, "spaaaaaaaaaaaace!"],
  ]
  biomeAt(_worldPos: THREE.Vector3, normalizedHeight: number) {
    for (let i = 0; i < Terrain.biomes.length; i++) {
      if (Terrain.biomes[i + 1][0] > normalizedHeight) {
        return Terrain.biomes[i][1];
      }
    }
    throw `Couldn't find a biome for height ${normalizedHeight}!`;
  }

  // Returns a predictable but random value in the range -1..1.
  protected noise(point: THREE.Vector3, offset: number, amplitude: number) {
    return noiseGenerator().noise3D(
      offset * point.x / NOISE_SCALE,
      offset * point.y / NOISE_SCALE,
      offset * point.z / NOISE_SCALE,
    ) * amplitude;
  }

  protected randomHeightBetween(pointOnSphere: THREE.Vector3, min: number, max: number) {
    const range = max - min;
    let height = 0;

    // Generates a value between -MAX_AMPLITUDE .. MAX_AMPLITUDE.
    for (let level of NOISE_LEVELS) {
      height += this.noise(pointOnSphere, level.offset, level.amplitude);
    }

    height = height / MAX_AMPLITUDE;  // Skew the height value between -1.0 and 1.0.
    height = (height + 1) / 2;        // Convert it to the range 0..1.
    height = Math.pow(height, 1.3);   // Run it through a power function to make it pointier.
    height = height * range + min;    // Convert it to the range min..max.

    return height;
  }

  protected closestDistanceToAdjacentPlates(cellCenter: THREE.Vector3, plate: Plate) {
    const closestDistances: { [plateId: number]: [PlateBoundary, number] } = {};

    for (const boundary of plate.boundaries) {
      const distance = this.distanceToLine(boundary.startPoint, boundary.endPoint, cellCenter);
      const otherPlate = boundary.otherPlate(plate);

      if (!(otherPlate.id in closestDistances) || closestDistances[otherPlate.id][1] > distance) {
        closestDistances[otherPlate.id] = [boundary, distance];
      }
    }
    return Object.values(closestDistances);
  }

  // dist: The distance in km between the given point and the plate boundary.
  // height: [0.0 - 1.0] The maximum height of the range at its center.
  // width: The "radius" of the range, the distance from the summits to the plains in km.
  protected landToLandMountainHeight(dist: number, width: number, height: number) {
    // FIXME: Should we vary it up with a random factor here, or rely purely on noise for that?
    if (dist > width) {
      return 0;
    }
    const x = dist / width;
    console.log(`LL mountain height: dist ${dist}, width ${width}, height ${height}, ${(Math.cos(Math.PI * x) + height) / 2}`);
    return (Math.cos(Math.PI * x) + height) / 2;
  }

  // dist: The distance in km between the given point and the plate boundary.
  // height: [0.0 - 1.0] The maximum height of the range at its center.
  // width: The "radius" of the range, the distance from the summits to the plains in km.
  protected oceanToLandMountainHeight(dist: number, width: number, height: number) {
    if (dist > width) {
      return 0;
    }
    console.log(`OL mountain height: ${(Math.cos(2 * Math.PI * ((dist / width) ** 2)) + 1) / 2 * height}`);
    return (Math.cos(2 * Math.PI * ((dist / width) ** 2)) + 1) / 2 * height;
    return -((dist - width * 1.2) ** 2) / (width ** 2) + height;
  }

  // dist: The distance in km between the given point and the plate boundary.
  // width: The distance the shelf should extend into the ocean.
  protected continentalShelfHeight(dist: number, width: number) {
    if (dist > width) {
      return 0;
    }
    // FIXME: This gets added to the continental shelves from initial heightmap generation, rather than
    // replacing them. We need to destroy existing continental shelves when we do this.
    return THREE.MathUtils.lerp(DEPTH_1_M, DEPTH_100_M, dist / width);
  }

  // dist: The distance in km between the given point and the plate boundary.
  // depth: [0.0 - 1.0] The maximum depth of the trench at its center.
  // width: Radius of the trench area in km.
  protected oceanTrenchHeight(dist: number, width: number, depth: number) {
    if (dist > width) {
      return 0;
    }
    // console.log(`Trench height: ${(Math.cos(dist / width / 2) ** 50) * depth}`);
    return (Math.cos(dist / width / 2) ** 50) * depth;
  }

  // dist: The distance in km between the given point and the plate boundary.
  // width: Width of the trench area in km.
  // The height of real-world ocean ridges is generally around 2,000 km.
  protected oceanicRidgeHeight(dist: number, width: number) {
    if (dist > width) {
      return 0;
    }
    const x = dist / width;
    return Math.abs(Math.cos(x / 10)) * (x ** 1.2 + 1);
  }

  // dist: The distance in km between the given point and the plate boundary.
  // depth: [0.0 - 1.0] The maximum depth of the valley at its center.
  // width: Radius of the valley area in km.
  // (For now it's the same as the ocean trench code. Might adjust them separately later.)
  protected riftValleyHeight(dist: number, width: number, depth: number) {
    if (dist > width) {
      return 0;
    }
    return (Math.cos(dist / width / 2) ** 50) * depth;
  }

}
