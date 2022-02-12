import SimplexNoise from "simplex-noise";
import * as THREE from "three";

export { noiseGenerator, setRandomSeed, updateGeometry, getWorldVertexFromMesh, ORIGIN, sphericalFromCoords };

const ORIGIN = new THREE.Vector3(0, 0, 0);

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
  if (geometry.attributes.color) {
    geometry.attributes.color.needsUpdate = true;
  }
  geometry.computeVertexNormals();
  // We don't care about collision, so these seem unnecessary.
  // geometry.computeBoundingBox();
  // geometry.computeBoundingSphere();
}

function getWorldVertexFromMesh(mesh: THREE.Mesh, index: number) {
  const positions = mesh.geometry.getAttribute("position");
  const localPos = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
  return mesh.localToWorld(localPos);
}

function sphericalFromCoords(coords: THREE.Vector3) {
  return new THREE.Spherical().setFromCartesianCoords(coords.x, coords.y, coords.z);
}
