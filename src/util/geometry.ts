import * as THREE from "three";

import { scene } from "../scene_data";

export {
  updateGeometry, getWorldVertexFromMesh, randomlyJitterVertices, wrapMeshAroundSphere,
  disposeMesh,
 };

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

function disposeMesh(mesh: THREE.Mesh | THREE.Points | THREE.LineSegments) {
  scene.remove(mesh);
  mesh.removeFromParent();
  mesh.geometry.dispose();

  if (mesh.material instanceof THREE.Material) {
    mesh.material.dispose();
  } else {
    for (const material of mesh.material) {
      material.dispose();
    }
  }
}
