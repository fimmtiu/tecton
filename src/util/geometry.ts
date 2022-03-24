import * as THREE from "three";

export { updateGeometry, mergeDuplicateVertices, getWorldVertexFromMesh, randomlyJitterVertices, wrapMeshAroundSphere };

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

// Most of three.js's geometry generators will create geometries with three vertices per face. This means that every
// mesh has three times as many vertices as it needs. When we're doing per-vertex calculation, we need to rewrite the
// points array to only have one vertex that's shared between multiple faces. We don't really care how performant this
// is, since it won't be used often.
// (Apparently there's a utility for this in a forthcoming version of three.js, but we can't wait.)
function mergeDuplicateVertices(geometry: THREE.BufferGeometry) {
  if (geometry.index) {
    mergeDuplicateIndexedVertices(geometry);
  } else {
    mergeDuplicateNonIndexedVertices(geometry);
  }
}

// Converts a non-indexed BufferGeometry to an indexed one with all duplicate vertices merged.
function mergeDuplicateNonIndexedVertices(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const vertexCache: { [rounded: string]: { vec: THREE.Vector3, index: number } } = {};
  const index = new THREE.BufferAttribute(new Uint16Array(positions.count), 1);
  let positionsAdded = 0;

  function addToVertexList(vec: THREE.Vector3) {
    const id = `${Math.round(vec.x)},${Math.round(vec.y)},${Math.round(vec.z)}`;
    if (!vertexCache[id]) {
      vertexCache[id] = { vec: vec, index: positionsAdded };
      positionsAdded++;
    }
    return vertexCache[id]["index"];
  }

  for (let i = 0; i < positions.count; i += 3) {
    const vecA = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i))
    const vecB = new THREE.Vector3(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1))
    const vecC = new THREE.Vector3(positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2))

    const posA = addToVertexList(vecA);
    const posB = addToVertexList(vecB);
    const posC = addToVertexList(vecC);

    index.set([posA, posB, posC], i);
  }

  const newPositions = new THREE.BufferAttribute(new Float32Array(positionsAdded * 3), 3);
  for (let id in vertexCache) {
    let vec = vertexCache[id]["vec"];
    newPositions.setXYZ(vertexCache[id]["index"], vec.x, vec.y, vec.z);
  }

  newPositions.needsUpdate = true; // FIXME: need this?
  geometry.setAttribute("position", newPositions);
  geometry.setIndex(index);
  updateGeometry(geometry);
}

// Removes all duplicate vertices from an indexed BufferGeometry.
function mergeDuplicateIndexedVertices(geometry: THREE.BufferGeometry) {
  if (!geometry.index) {
    throw "mergeDuplicateIndexedVertices called on a non-indexed geometry!";
  }

  const positions = geometry.getAttribute("position");
  const vertexCache: { [rounded: string]: { vec: THREE.Vector3, index: number } } = {};
  const indexCache: { [oldIndex: number]: number } = {};
  let positionsAdded = 0;

  for (let i = 0; i < positions.count; i++) {
    const vec = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
    const id = `${Math.round(vec.x)},${Math.round(vec.y)},${Math.round(vec.z)}`;

    if (!vertexCache[id]) {
      vertexCache[id] = { vec: vec, index: positionsAdded };
      positionsAdded++;
    }
    indexCache[i] = vertexCache[id]["index"];
  }

  const newPositions = new THREE.BufferAttribute(new Float32Array(positionsAdded * 3), 3);
  for (let id in vertexCache) {
    let vec = vertexCache[id]["vec"];
    newPositions.setXYZ(vertexCache[id]["index"], vec.x, vec.y, vec.z);
  }

  for (let i = 0; i < geometry.index.count; i++) {
    geometry.index.set([indexCache[geometry.index.array[i]]], i);
  }

  newPositions.needsUpdate = true;
  geometry.setAttribute("position", newPositions);
  updateGeometry(geometry);
}

function getWorldVertexFromMesh(mesh: THREE.Mesh, index: number) {
  const positions = mesh.geometry.getAttribute("position");
  const localPos = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
  return mesh.localToWorld(localPos);
}

function randomlyJitterVertices(geometry: THREE.BufferGeometry, radius: number) {
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const pos = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
    const dir = new THREE.Vector3().randomDirection().setLength(radius / 20);
    pos.add(dir);

    positions.setXYZ(i, pos.x, pos.y, pos.z);
  }
}

function wrapMeshAroundSphere(geometry: THREE.BufferGeometry, radius: number) {
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const vec = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
    vec.normalize().multiplyScalar(radius);
    positions.setXYZ(i, vec.x, vec.y, vec.z);
  }
}
