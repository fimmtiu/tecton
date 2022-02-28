import SimplexNoise from "simplex-noise";
import * as THREE from "three";

export {
  noiseGenerator, setRandomSeed, updateGeometry, getWorldVertexFromMesh, ORIGIN, ORIGIN_2D, sphericalFromCoords,
  v2s, s2s, mergeIdenticalVertices,
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

// Converts a non-indexed BufferGeometry to an indexed one with all duplicate vertices merged.
// We don't really care how performant this is, since it won't be used often.
// (Apparently there's a utility for this in a forthcoming version of three.js, but we can't wait.)
function mergeIdenticalVertices(geometry: THREE.BufferGeometry) {
  if (!geometry.index) {
    throw "Non-indexed geometry passed to mergeIdenticalVertices!";
  }

  const positions = geometry.getAttribute("position");
  const vertexCache: { [rounded: string]: { vec: THREE.Vector3, index: number } } = {};
  const newPositions = new THREE.BufferAttribute(new Float32Array(positions.count), 3);
  const index = new THREE.BufferAttribute(new Uint16Array(positions.count), 3);
  let positionsAdded = 0;

  function addToVertexList(vec: THREE.Vector3) {
    const id = `${Math.round(vec.x)},${Math.round(vec.y)},${Math.round(vec.z)}`;
    if (!vertexCache[id]) {
      vertexCache[id] = { vec: vec, index: positionsAdded };
      newPositions.setXYZ(positionsAdded, vec.x, vec.y, vec.z);
      positionsAdded++;
    }
    return vertexCache[id]["index"];
  }

  for (let i = 0; i < positions.count / 3; i++) {
    const vecA = new THREE.Vector3().fromArray(positions.array, i * 3 + 0);
    const vecB = new THREE.Vector3().fromArray(positions.array, i * 3 + 3);
    const vecC = new THREE.Vector3().fromArray(positions.array, i * 3 + 6);

    const posA = addToVertexList(vecA);
    const posB = addToVertexList(vecB);
    const posC = addToVertexList(vecC);

    console.log(`[${v2s(vecA)} = ${posA}, ${v2s(vecB)} = ${posB}, ${v2s(vecC)} = ${posC}]`);
    index.set([posA, posB, posC], i * 3);
  }

  newPositions.needsUpdate = true;
  geometry.setAttribute("position", newPositions);
  geometry.setIndex(index);
  updateGeometry(geometry);
}

function getWorldVertexFromMesh(mesh: THREE.Mesh, index: number) {
  const positions = mesh.geometry.getAttribute("position");
  const localPos = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
  return mesh.localToWorld(localPos);
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
