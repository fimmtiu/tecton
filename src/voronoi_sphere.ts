import * as THREE from "three";
import * as DGV from "d3-geo-voronoi";

import { Planet } from "./planet";
import { scene } from "./scene_data";
import { GeoCoord } from "./geo_coord";
import { v2s, mergeDuplicateVertices } from "./util";

export { VoronoiSphere };

const VORONOI_DENSITY = 20;
const COLORS = [
  new THREE.MeshBasicMaterial({ color: 0x4287f5 }), // water
  new THREE.MeshBasicMaterial({ color: 0x4da632 }), // land
];

class VoronoiSphere {
  protected voronoi: any;
  protected polygons: Array<any>;
  protected voronoiEdges: THREE.LineSegments;
  protected voronoiMesh: THREE.Mesh;
  protected meshTriangleToCell: Array<number>;
  protected cellToMeshTriangle: Array<number[]>;
  protected terrainData: Array<TerrainData>;
  public needsUpdate = true;

  constructor() {
    this.meshTriangleToCell = [];
    this.cellToMeshTriangle = [];
    this.voronoi = DGV.geoVoronoi(this.voronoiStartingPoints());
    this.polygons = this.voronoi.polygons().features;

    this.voronoiEdges = this.makeEdges();
    scene.add(this.voronoiEdges);

    this.voronoiMesh = this.makeTriangleMesh();
    scene.add(this.voronoiMesh);

    this.terrainData = [];
    for (let i = 0; i < this.polygons.length; i++) {
      this.terrainData.push(new TerrainData(this));
    }
  }

  destroy() {
    scene.remove(this.voronoiEdges);
    this.voronoiEdges.geometry.dispose();
    (<THREE.Material> this.voronoiEdges.material).dispose();
    scene.remove(this.voronoiMesh);
    this.voronoiMesh.geometry.dispose();
  }

  cellCount() {
    return this.polygons.length;
  }

  cellData(cell: number) {
    return this.terrainData[cell];
  }

  setColor(cell: number, color: number) {
    this.voronoiMesh.geometry.addGroup(this.cellToMeshTriangle[cell][0], this.cellToMeshTriangle[cell].length, color);
  }

  neighbours(cell: number) {
    return this.polygons[cell].properties.neighbours;
  }

  update() {
    if (this.needsUpdate) {
      for (let i = 0; i < this.polygons.length; i++) {
        const color = this.cellData(i).height() >= 0 ? 1 : 0;
        this.setColor(i, color);
      }
      this.needsUpdate = false;
    }
  }

  protected makeEdges() {
    const polygons = this.polygons;
    const edges: Array<THREE.Vector3[]> = [];
    const seen: { [edge: string]: boolean } = {};

    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i].geometry.coordinates[0];
      for (let j = 0; j < polygon.length - 1; j++) {
        const posA = new GeoCoord(polygon[j][1], polygon[j][0]).toWorldVector();
        const posB = new GeoCoord(polygon[j + 1][1], polygon[j + 1][0]).toWorldVector();
        const hash1 = `${v2s(posA)},${v2s(posB)}`;
        const hash2 = `${v2s(posB)},${v2s(posA)}`;
        if (!seen[hash1] && !seen[hash2]) {
          edges.push([posA, posB]);
          seen[hash1] = seen[hash2] = true;
        }
      }
    }

    const positions = new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3);
    for (let i = 0; i < edges.length; i++) {
      positions.setXYZ(i * 2, edges[i][0].x, edges[i][0].y, edges[i][0].z);
      positions.setXYZ(i * 2 + 1, edges[i][1].x, edges[i][1].y, edges[i][1].z);
    }
    const geometry = new THREE.BufferGeometry().setAttribute("position", positions);
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
  }

  protected makeTriangleMesh() {
    let triangleCount = 0;
    for (let i = 0; i < this.polygons.length; i++) {
      triangleCount += this.polygons[i].geometry.coordinates[0].length + 1;
    }

    const positions = new THREE.BufferAttribute(new Float32Array(triangleCount * 9), 3);
    triangleCount = 0;
    let vertexCount = 0;
    for (let i = 0; i < this.polygons.length; i++) {
      const polygon = this.polygons[i].geometry.coordinates[0];
      const firstVertex = new GeoCoord(polygon[0][1], polygon[0][0]).toWorldVector();

      for (let j = 1; j < polygon.length - 2; j++) {
        const secondVertex = new GeoCoord(polygon[j][1], polygon[j][0]).toWorldVector();
        const thirdVertex = new GeoCoord(polygon[j + 1][1], polygon[j + 1][0]).toWorldVector();

        this.meshTriangleToCell[triangleCount++] = i;
        this.cellToMeshTriangle[i] ||= [];
        this.cellToMeshTriangle[i].push(vertexCount);
        positions.setXYZ(vertexCount++, firstVertex.x, firstVertex.y, firstVertex.z);
        this.cellToMeshTriangle[i].push(vertexCount);
        positions.setXYZ(vertexCount++, thirdVertex.x, thirdVertex.y, thirdVertex.z); // reverse the vertex order
        this.cellToMeshTriangle[i].push(vertexCount);
        positions.setXYZ(vertexCount++, secondVertex.x, secondVertex.y, secondVertex.z);
      }
    }

    const geometry = new THREE.BufferGeometry().setAttribute("position", positions);
    mergeDuplicateVertices(geometry);
    return new THREE.Mesh(geometry, COLORS);
  }

  protected voronoiStartingPoints() {
    const startingPoints = new THREE.IcosahedronBufferGeometry(Planet.radius, VORONOI_DENSITY);
    mergeDuplicateVertices(startingPoints);
    this.randomlyJitterVertices(startingPoints, Planet.radius);
    this.wrapMeshAroundSphere(startingPoints, Planet.radius);

    const coords = [];
    const positions = startingPoints.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const vec = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const coord = GeoCoord.fromWorldVector(vec);
      coords.push([coord.lon, coord.lat]);
    }

    startingPoints.dispose();
    return coords;
  }

  protected randomlyJitterVertices(geometry: THREE.BufferGeometry, radius: number) {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const pos = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const dir = new THREE.Vector3().randomDirection().setLength(radius / 20);
      pos.add(dir);

      positions.setXYZ(i, pos.x, pos.y, pos.z);
    }
  }

  protected wrapMeshAroundSphere(geometry: THREE.BufferGeometry, radius: number) {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const vec = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      vec.normalize().multiplyScalar(radius);
      positions.setXYZ(i, vec.x, vec.y, vec.z);
    }
  }
}

class TerrainData {
  protected parent: VoronoiSphere;
  protected _height: number;

  constructor(parent: VoronoiSphere) {
    this.parent = parent;
    this._height = 0;
  }

  // We need the accessors so that we can update the parent's 'needsUpdate' when it changes.
  height() {
    return this._height;
  }

  setHeight(height: number) {
    this._height = height;
    this.parent.needsUpdate = true;
  }
}
