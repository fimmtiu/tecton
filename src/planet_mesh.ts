import * as THREE from "three";
import { disposeMesh, updateGeometry } from "./util/geometry";
import { scene } from "./scene_data";
import { PLANET_RADIUS } from "./planet";
import { PlanetCamera } from "./planet_camera";
import { Delaunay } from "d3-delaunay";
import * as d3Polygon from "d3-polygon";


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
      this.add(this.meshVertices);
    }
  }

  destroy() {
    if (this.meshVertices) {
      scene.remove(this.meshVertices);
      this.meshVertices.geometry.dispose();
      (this.meshVertices.material as THREE.Material).dispose();
      this.meshVertices = null;
    }
    disposeMesh(this);
  }

  update(camera: PlanetCamera) {
    const positions = this.geometry.getAttribute("position");
    const screenSpacePositions = new Array<Array<number>>(positions.count); // FIXME: Too much allocation. Cache this.

    for (let i = 0; i < positions.count; i++) {
      const position = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      screenSpacePositions[i] = camera.worldCoordsToScreenCoords(position).toArray();
    }

    const delaunay = Delaunay.from(screenSpacePositions);
    delaunay.voronoi().cellPolygons().forEach((polygon: any, index: number) => {
      screenSpacePositions[index] = d3Polygon.polygonCentroid(polygon);   // Lloyd's relaxation, to move points away from each other.
    });

    for (let i = 0; i < screenSpacePositions.length; i++) {
      const worldPosition = camera.screenCoordsToWorldCoords(screenSpacePositions[i][0], screenSpacePositions[i][1]);
      positions.setXYZ(i, worldPosition.x, worldPosition.y, worldPosition.z);
    }

    // Project the points back onto the sphere.
    let fuckedPoints = 0;
    for (let i = 0; i < positions.count; i++) {
      const position = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const ray = new THREE.Ray(position, camera.getWorldDirection(new THREE.Vector3()));
      console.log(`Position was ${position.x}, ${position.y}, ${position.z}`);
      if (camera.intersect(ray, position)) {
        console.log(`Position is now ${position.x}, ${position.y}, ${position.z}`);
        positions.setXYZ(i, position.x, position.y, position.z);
        if (this.showVertices && this.meshVertices) {
          const offsetPosition = position.clone().addScalar(0.005);
          this.meshVertices.geometry.getAttribute("position").setXYZ(i, offsetPosition.x, offsetPosition.y, offsetPosition.z);
        }
      } else {
        fuckedPoints++;
      }
    }
    console.log(`Fucked points: ${fuckedPoints}`);

    updateGeometry(this.geometry)
    if (this.meshVertices) {
      updateGeometry(this.meshVertices.geometry)
    }
  }

  updatePoint(index: number, newPosition: THREE.Vector3) {
    const positions = this.geometry.getAttribute("position");
    positions.setXYZ(index, newPosition.x, newPosition.y, newPosition.z);

    if (this.showVertices && this.meshVertices) {
      const offsetPosition = newPosition.clone().addScalar(0.005);
      this.meshVertices.geometry.getAttribute("position").setXYZ(index, offsetPosition.x, offsetPosition.y, offsetPosition.z);
    }
  }
}
