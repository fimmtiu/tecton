import SimplexNoise from "simplex-noise";
import * as THREE from "three";

export { noiseGenerator, setRandomSeed, updateGeometry, getWorldVertexFromMesh, ORIGIN };

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
  // geometry.computeBoundingBox();
  // geometry.computeBoundingSphere();
}

function getWorldVertexFromMesh(mesh: THREE.Mesh, index: number) {
  const positions = mesh.geometry.getAttribute("position");
  const localPos = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
  return mesh.localToWorld(localPos);
}
