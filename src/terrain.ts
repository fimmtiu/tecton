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

class Terrain {
  protected plateSphere: PlateSphere;
  public heightMap: HeightCubeField;
  public min = 10000;
  public max = -10000;

  constructor() {
    this.plateSphere = new PlateSphere();
    this.heightMap = new HeightCubeField(10, this.plateSphere);
  }

  destroy() {
    this.plateSphere.destroy();
    this.heightMap.destroy();
  }

  dataAtPoint(pointOnSphere: THREE.Vector3) {
    const plateData = this.plateSphere.dataAtPoint(pointOnSphere);
    return {
      "elevation": Math.round(this.scaleHeight(this.normalizedHeightAt(pointOnSphere)) * 1000),
      "voronoiCell": plateData.cell.id,
      "plate": plateData.plate.id,
      "face": this.heightMap.faceAtPoint(pointOnSphere),
    }
  }

  // Return the height at the given point as a float between -1.0 and 1.0, inclusive. (0.0 is sea level.)
  // To get the height in kilometers, pass this number to scaleHeight().
  normalizedHeightAt(pointOnSphere: THREE.Vector3) {
    return this.heightMap.cellAtPoint(pointOnSphere).height;

    let height = 0;

    // Generate a noisy height value.
    for (let i = 0; i < NOISE_LEVELS.length; i++) {
      let level = NOISE_LEVELS[i];
      height += this.noise(pointOnSphere, level.offset, level.amplitude);
    }

    // Skew the height value between -1.0 and 1.0.
    height = (height - MIN_ELEVATION) / MAX_AMPLITUDE;

    // Apply some bonkers thing to it in order to make the coastlines more dramatic. Didn't work.
    // height *= 1 - (1 / (5 + (10 * height) ** 2));

    // Favour water by skewing heights lower without clamping. (doesn't work; the skew utterly destroys mountains.)
    // height = height * (1 - FAVOR_WATER) - FAVOR_WATER;

    height = (height + 1) / 2;      // Convert to the range 0..1.
    height = Math.pow(height, 1.3); // Run it through a power function to decrease landmass and make it pointier.
    height = height * 2 - 1;        // Convert back to -1..1.

    if (height > this.max) {
      this.max = height;
    } else if (height < this.min) {
      this.min = height;
    }
    return height;
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
}
