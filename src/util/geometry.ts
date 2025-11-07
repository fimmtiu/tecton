import * as THREE from "three";
import * as d3 from "d3-geo";
import * as D3GeoVoronoi from "d3-geo-voronoi";
import { scene } from "../scene_data";

export {
  updateGeometry, getWorldVertexFromMesh, randomlyJitterVertices, wrapMeshAroundSphere,
  disposeMesh, sphericalLloydsRelaxation,
 };

// Tell three.js that this geometry has changed.
function updateGeometry(geometry: THREE.BufferGeometry) {
  geometry.attributes.position.needsUpdate = true;
  if (geometry.attributes.color) {
    geometry.attributes.color.needsUpdate = true;
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
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

// Relaxes the Voronoi cells so that they're more evenly distributed. Returns the new Voronoi diagram.
function sphericalLloydsRelaxation(voronoi: any, iterations = 1): any {
  for (let iter = 0; iter < iterations; iter++) {
    console.log(`Lloyd's relaxation: voronoi ${typeof voronoi}: ${voronoi}`);
    const centroids = voronoi.polygons().features.map((polygon: any) => d3.geoCentroid(polygon));

    // Regenerate the Voronoi diagram with the centroid points as the new centres.
    voronoi = D3GeoVoronoi.geoVoronoi(centroids);
  }
  return voronoi;
}
