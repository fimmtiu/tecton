import * as THREE from "three";
import { scene } from "./scene_data";
import { mergeDuplicateVertices } from "./util";

export { PlanetMesh };

class PlanetMesh extends THREE.Mesh {
  public horizontalVertices: number;
  public verticalVertices: number;
  public horizontalTexelsPerVertex: number;
  public verticalTexelsPerVertex: number;
  public halfHorizLength: number;
  public halfVertLength: number;
  public edges: THREE.LineSegments | null;

  constructor(
    width: number, height: number,
    horizontalVertices: number, verticalVertices: number,
    material: THREE.MeshStandardMaterial)
  {
    const textureSize = material.map?.image.width; // We assume the texture is a square.
    const geometry = new THREE.PlaneGeometry(width * 12, height * 12, horizontalVertices - 1, verticalVertices - 1);
    super(geometry, material);

    this.horizontalVertices = horizontalVertices;
    this.verticalVertices = verticalVertices;
    this.halfHorizLength = (horizontalVertices - 1) / 2;
    this.halfVertLength = (verticalVertices - 1) / 2;
    this.horizontalTexelsPerVertex = textureSize / horizontalVertices;
    this.verticalTexelsPerVertex = textureSize / verticalVertices;
    this.edges = null;

    console.log(`New mesh: ${horizontalVertices} x ${verticalVertices} vertices.`);
  }

  destroy() {
    scene.remove(this);
    this.geometry.dispose();
    this.hideEdges();
  }

  showEdges() {
    if (!this.edges) {
      const edgeGeometry = new THREE.EdgesGeometry(this.geometry, 0);
      edgeGeometry.scale(1.001, 1.001, 1.001); // Prevents weird clipping
      this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
      this.add(this.edges); // Makes the edges turn when the mesh turns
    }
  }

  hideEdges() {
    if (this.edges) {
      this.edges.removeFromParent();
      (<THREE.Material>this.edges.material).dispose();
      this.edges.geometry.dispose();
      this.edges = null;
    }
  }
}
