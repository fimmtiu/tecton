import * as THREE from "three";
import { Planet } from "./planet";
import { VisualHelper } from "./visual_helper";
import { noiseGenerator } from "./util";

export { Terrain };

const NOISE_SCALE = 5000;
const FAVOR_WATER = -0.20;
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
  protected planet: Planet; // FIXME: Don't need this circular dependency long-term. Just for debugging.
  protected visualHelper: VisualHelper;
  public min = 100000;
  public max = -100000;

  constructor(planet: Planet) {
    this.planet = planet;
    this.visualHelper = new VisualHelper(false, false);
  }

  // Set the color for each vertex on the planet to reflect the land height/water depth there.
  normalizedHeightAt(pointOnSphere: THREE.Vector3) {
    let height = FAVOR_WATER;

    for (let level = 0; level < NOISE_LEVELS.length; level++) {
      height += noiseGenerator().noise3D(
        NOISE_LEVELS[level].offset * pointOnSphere.x / NOISE_SCALE,
        NOISE_LEVELS[level].offset * pointOnSphere.y / NOISE_SCALE,
        NOISE_LEVELS[level].offset * pointOnSphere.z / NOISE_SCALE,
      ) * NOISE_LEVELS[level].amplitude;
    }

    // Normalize to the range 0..1.
    height = (height / MAX_AMPLITUDE) / 2 + 0.5;

    // The exponent will smooth valleys and exaggerate peaks.
    height = Math.pow(height, 1.2);

    // Change the range back to -1..1, where 0 is sea level.
    return height * 2 - 1;
  }

  scaleHeight(height: number) {
    if (height < 0) {
      return height * -MIN_ELEVATION;
    } else {
      return height * MAX_ELEVATION;
    }
  }
}
