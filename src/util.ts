import SimplexNoise from "simplex-noise";

export { noiseGenerator, setRandomSeed, updateGeometry };

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

// Tell three.js that this geometry has changed.
function updateGeometry(geometry: THREE.BufferGeometry) {
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
