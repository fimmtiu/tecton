import * as THREE from "three";
import { Planet } from "./planet";
import { scene } from "./scene_data";
import { mergeDuplicateVertices } from "./util";

export { Tectonics };

const VORONOI_DENSITY = 6;

class Tectonics {
  protected voronoi: THREE.BufferGeometry;
  protected edges: THREE.LineSegments;

  constructor() {
    this.voronoi = new THREE.IcosahedronBufferGeometry(Planet.radius, VORONOI_DENSITY);
    mergeDuplicateVertices(this.voronoi);
    this.randomlyJitterVertices(this.voronoi, Planet.radius);
    this.wrapMeshAroundSphere(this.voronoi, Planet.radius);

    const edgeGeometry = new THREE.EdgesGeometry(this.voronoi, 0);
    edgeGeometry.scale(1.1, 1.1, 1.1); // Prevents weird clipping
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    // scene.add(this.edges);
  }

  randomlyJitterVertices(geometry: THREE.BufferGeometry, radius: number) {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const pos = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const dir = new THREE.Vector3().randomDirection().setLength(radius / 20);
      pos.add(dir);

      positions.setXYZ(i, pos.x, pos.y, pos.z);
    }
  }

  wrapMeshAroundSphere(geometry: THREE.BufferGeometry, radius: number) {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const vec = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      vec.normalize().multiplyScalar(radius);
      positions.setXYZ(i, vec.x, vec.y, vec.z);
    }
  }
}
