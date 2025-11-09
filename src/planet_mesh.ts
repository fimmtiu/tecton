import * as THREE from "three";
import { disposeMesh, updateGeometry, logVisibleVertices } from "./util/geometry";
import { PlanetCamera } from "./planet_camera";

export { PlanetMesh };

class PlanetMesh extends THREE.Mesh {
  public horizontalVertices: number;
  public verticalVertices: number;
  public horizontalRadiansPerCell: number;
  public verticalRadiansPerCell: number;
  public horizontalTexelsPerVertex: number;
  public verticalTexelsPerVertex: number;
  public halfHorizLength: number;
  public halfVertLength: number;
  protected showVertices: boolean;
  protected meshVertices: THREE.Points | null;

  constructor(
    width: number, height: number,
    horizontalVertices: number, verticalVertices: number,
    material: THREE.MeshStandardMaterial,
    showVertices = false)
  {
    const textureSize = (material.map?.image as any)?.width; // We assume the texture is a square.
    const geometry = new THREE.PlaneGeometry(width * 12, height * 12, horizontalVertices - 1, verticalVertices - 1);
    super(geometry, material);

    this.horizontalVertices = horizontalVertices;
    this.verticalVertices = verticalVertices;
    this.halfHorizLength = (horizontalVertices - 1) / 2;
    this.halfVertLength = (verticalVertices - 1) / 2;
    this.horizontalRadiansPerCell = Math.PI / this.horizontalVertices;
    this.verticalRadiansPerCell = Math.PI / this.verticalVertices;
    this.horizontalTexelsPerVertex = textureSize / horizontalVertices;
    this.verticalTexelsPerVertex = textureSize / verticalVertices;
    this.showVertices = showVertices;
    this.meshVertices = null;

    console.log(`New mesh: ${horizontalVertices} x ${verticalVertices} vertices.`);

    if (this.showVertices) {
      const verticesMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 3,
        sizeAttenuation: false,
      });
      const meshVerticesGeometry = new THREE.BufferGeometry().copy(this.geometry);
      this.meshVertices = new THREE.Points(meshVerticesGeometry, verticesMaterial);
      this.meshVertices.renderOrder = 99999999999;
      this.add(this.meshVertices);
    }
  }

  destroy() {
    if (this.meshVertices) {
      disposeMesh(this.meshVertices);
      this.meshVertices = null;
    }
    disposeMesh(this);
  }

  updatePoint(index: number, newPosition: THREE.Vector3) {
    this.geometry.getAttribute("position").setXYZ(index, newPosition.x, newPosition.y, newPosition.z);

    if (this.showVertices && this.meshVertices) {
      this.meshVertices.geometry.getAttribute("position").setXYZ(index, newPosition.x, newPosition.y, newPosition.z);
    }
  }

  update(camera: PlanetCamera) {
    updateGeometry(this.geometry);
    if (this.showVertices && this.meshVertices) {
      updateGeometry(this.meshVertices.geometry);
    }

    logVisibleVertices(camera, this, "Planet");
    if (this.showVertices && this.meshVertices) {
      logVisibleVertices(camera, this.meshVertices, "Points");
    }
  }
}
