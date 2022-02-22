import * as THREE from "three";
import { VisualHelper } from "./visual_helper";
import { noiseGenerator } from "./util";

export { Terrain };

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
const TECTONIC_NOISE_LEVEL = { offset: 1.1, amplitude: 1/2 };
const TECTONIC_SHARPNESS = 25;

const MAX_AMPLITUDE = NOISE_LEVELS.reduce((n, level) => { return n + level.amplitude }, 0);

class Terrain {
  static readonly minAmplitude = 0;
  static readonly maxAmplitude = MAX_AMPLITUDE - this.minAmplitude;

  protected visualHelper: VisualHelper;
  public min = 10000;
  public max = -10000;

  static noiseGenerator = noiseGenerator();

  constructor() {
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

    height += this.tectonicNoise(pointOnSphere);


    // Massage the height value, then skew it between -1.0 and 1.0.
    height = (height - Terrain.minAmplitude) / Terrain.maxAmplitude;

    height = (height + 1) / 2;      // Convert to the range 0..1.
    height = Math.pow(height, 1.3); // Run it through a power function to decrease landmass and make it pointier.

    // Convert back to -1..1.
    height = height * 2 - 1;

    // Clamp to the min, max.
    if (height > this.max) {
      this.max = height;
    } else if (height < this.min) {
      this.min = height;
    }

    if (typeof height === 'undefined') {
      debugger;
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

  // Returns a predictable but random value in the range -1..1.
  protected noise(point: THREE.Vector3, offset: number, amplitude: number) {
    return Terrain.noiseGenerator.noise3D(
      offset * point.x / NOISE_SCALE,
      offset * point.y / NOISE_SCALE,
      offset * point.z / NOISE_SCALE,
    ) * amplitude;
  }

  protected tectonicNoise(point: THREE.Vector3) {
    let noiseValue = this.noise(point, TECTONIC_NOISE_LEVEL.offset, TECTONIC_NOISE_LEVEL.amplitude);
    return 1/(1 + (TECTONIC_SHARPNESS * noiseValue)**2);
  }
}
