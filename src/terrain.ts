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
  static readonly minAmplitude = Terrain.perturbHeight(0);
  static readonly maxAmplitude = Terrain.perturbHeight(MAX_AMPLITUDE) - this.minAmplitude;

  protected planet: Planet; // FIXME: Don't need this circular dependency long-term. Just for debugging.
  protected visualHelper: VisualHelper;
  public min = 10000;
  public max = -10000;

  constructor(planet: Planet) {
    this.planet = planet;
    this.visualHelper = new VisualHelper(false, false);
  }

  // Return the height at the given point as a float between -1.0 and 1.0, inclusive.
  // (To get the height in kilometers, pass this number to scaleHeight().)
  normalizedHeightAt(pointOnSphere: THREE.Vector3) {
    let height = 0;

    // Generate a noisy height value.
    for (let i = 0; i < NOISE_LEVELS.length; i++) {
      let level = NOISE_LEVELS[i];
      height += this.noise(pointOnSphere, level.offset, level.amplitude);
    }

    // Massage the height value, then skew it between -1.0 and 1.0.
    height = (Terrain.perturbHeight(height) - Terrain.minAmplitude) / Terrain.maxAmplitude;
    // console.log(`height 2: (${before} + ${Terrain.minAmplitude}) / ${Terrain.maxAmplitude} = ${height}`);

    // Apply some bonkers thing to it in order to make the coastlines more dramatic.
    let before = height;
    height *= 1 - (1 / (5 + (10 * height) ** 2));
    console.log(`height 3: ${before} * (1 - (1 / ${5 + (10 * before) ** 2}) = ${height}`);

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

  // Massage the height values in a futile effort to get something that looks less random and more earth-ish.
  static perturbHeight(height: number) {
    let atan = Math.atan(height) * 0.3;
    // console.log(`height 0: ${height} + ${atan} = ${height + atan}`);
    height += atan;
    // console.log(`height 1: ${height}:  ${Math.sign(height) * Math.pow(Math.abs(height), 1.2)} = ${Math.sign(height) * Math.pow(Math.abs(height), 1.2)}`);
    height = Math.sign(height) * Math.pow(Math.abs(height), 1.2);
    return height;
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
