import * as THREE from "three";

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

// Some commonly used heights expressed in the -1.0 - 1.0 range.
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

      if (heightCell.height > this.max) {
        this.max = heightCell.height;
      } else if (heightCell.height < this.min) {
        this.min = heightCell.height;
      }
    }
  }

  protected tectonicHeightAdjustment(cell: number) {
    const cellCenter = this.heightMap.get(cell).center;
    const plate = this.plateSphere.plateAtPoint(cellCenter);
    let adjustment = 0;

    for (const boundary of plate.boundaries) {
      const distance = this.distanceToLine(boundary.startPoint, boundary.endPoint, cellCenter);

        // console.log(`segment ${i} between ${boundary.plateCells[0].plate.id} and ${boundary.plateCells[1].plate.id}: ${}`);
    }

    return adjustment;
  }

  // FIXME: better variable names, for Christ's sake
  // https://monkeyproofsolutions.nl/wordpress/how-to-calculate-the-shortest-distance-between-a-point-and-a-line/
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
    [10.00, "spaaaaaaaaaaaace!"],
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

    for (let level of NOISE_LEVELS) {
      height += this.noise(pointOnSphere, level.offset, level.amplitude);
    }

    height = height / MAX_AMPLITUDE;  // Skew the height value between -1.0 and 1.0.
    height = (height + 1) / 2;        // Convert it to the range 0..1.
    height = Math.pow(height, 1.3);   // Run it through a power function to make it pointier.
    height = height * range + min;    // Convert it to the range min..max.

    return height;
  }
}
