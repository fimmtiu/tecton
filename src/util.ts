import SimplexNoise from "simplex-noise";
import * as THREE from "three";

export {
  ORIGIN, ORIGIN_2D, noiseGenerator, setRandomSeed, sphericalFromCoords, v2s, s2s, shuffle, sample, timeFunction,
};

const ORIGIN = new THREE.Vector3(0, 0, 0);
const ORIGIN_2D = new THREE.Vector2(0, 0);

let simplex = new SimplexNoise();

function noiseGenerator() {
  return simplex;
}

function setRandomSeed(seed: string) {
  if (seed == "") {
    simplex = new SimplexNoise();
  } else {
    simplex = new SimplexNoise(seed);
  }
}

// Copy an array, randomize its contents, return it.
function shuffle(arr: Array<any>) {
  const newArray = [...arr];
  for (let i = 0; i < newArray.length; i++) {
    const dest = THREE.MathUtils.randInt(0, newArray.length - 1);
    const temp = newArray[i];
    newArray[i] = newArray[dest];
    newArray[dest] = temp;
  }
  return newArray;
}

// Return a random element from an array.
function sample(arr: Array<any>) {
  return arr[THREE.MathUtils.randInt(0, arr.length - 1)];
}

// A trivial way to benchmark a chunk of code.
function timeFunction(description: string, fn: () => any) {
  const start_at = Date.now();
  const retval = fn();
  const end_at = Date.now();
  console.log(`${description}: ${end_at - start_at} ms`);
  return retval;
}

// These functions are just shorthand helpers for long-winded things that I use often.
function sphericalFromCoords(coords: THREE.Vector3) {
  return new THREE.Spherical().setFromCartesianCoords(coords.x, coords.y, coords.z);
}

function v2s(vec: THREE.Vector3) {
  return `(x ${vec.x}, y ${vec.y}, z ${vec.z})`;
}

function s2s(sph: THREE.Spherical) {
  return `(r ${sph.radius}, p ${sph.phi}, t ${sph.theta})`;
}
