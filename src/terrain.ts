import * as THREE from "three";
import { Planet } from "./planet";
import { VisualHelper } from "./visual_helper";
import { noiseGenerator } from "./util";
import { pingpong } from "three/src/math/MathUtils";

export { Terrain };

const NOISE_SCALE = 6000;
const FAVOR_WATER = -0.25;
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
  public min = 10000;
  public max = -10000;

  constructor(planet: Planet) {
    this.planet = planet;
    this.visualHelper = new VisualHelper(false, false);
  }

  // Set the color for each vertex on the planet to reflect the land height/water depth there.
  normalizedHeightAt(pointOnSphere: THREE.Vector3) {
    let height = 0;

    // Generate noise in the range 0..1.
    for (let i = 0; i < NOISE_LEVELS.length; i++) {
      let level = NOISE_LEVELS[i];
      height += this.noise(pointOnSphere, level.offset, level.amplitude);
      // console.log(`loop ${i} height = ${height}`);
    }
    // console.log(`height 0: ${height}`);
    height /= MAX_AMPLITUDE;

    // console.log(`height 1: ${height} / ${MAX_AMPLITUDE}`);

    // console.log(`height 2: ${height}`);
    // The exponent will smooth valleys and exaggerate peaks... I hope?
    height = Math.pow(height, 1.2);

    // Change the range back to -1..1, where 0 is sea level.
    height = height * 2 - 1;

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

  protected noise(point: THREE.Vector3, offset: number, amplitude: number) {
    let rawValue = noiseGenerator().noise3D(
      offset * point.x / NOISE_SCALE,
      offset * point.y / NOISE_SCALE,
      offset * point.z / NOISE_SCALE,
    );
    // console.log(`raw ${rawValue} => ${(rawValue + 1) / 2} * ${amplitude} = ${(rawValue + 1) / 2 * amplitude}`);
    return (rawValue + 1) / 2 * amplitude;
  }
}
