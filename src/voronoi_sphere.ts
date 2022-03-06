import * as THREE from "three";
import * as DGV from "d3-geo-voronoi";

import { Planet } from "./planet";
import { scene } from "./scene_data";
import { GeoCoord } from "./geo_coord";
import { mergeDuplicateVertices } from "./util";

export { VoronoiSphere };

const VORONOI_DENSITY = 6;
const COLORS = [
  new THREE.MeshBasicMaterial({ color: 0x59667e }),
  new THREE.MeshBasicMaterial({ color: 0xd2a7b0 }),
  new THREE.MeshBasicMaterial({ color: 0x25590f }),
  new THREE.MeshBasicMaterial({ color: 0x53d386 }),
  new THREE.MeshBasicMaterial({ color: 0x6e88db }),
];

class VoronoiSphere {
  protected voronoi: any;
  protected voronoiEdges: THREE.LineSegments;
  protected voronoiMesh: THREE.Mesh;
  // protected neighbours: Array<number[]>;
  protected meshTriangleToCell: Array<number>;
  protected cellToMeshTriangle: Array<number[]>;

  constructor() {
    this.meshTriangleToCell = []
    this.cellToMeshTriangle = []
    this.voronoi = DGV.geoVoronoi(this.voronoiStartingPoints());

    this.voronoiEdges = this.makeEdges();
    // scene.add(this.voronoiEdges);

    this.voronoiMesh = this.makeTriangleMesh();
    scene.add(this.voronoiMesh);
  }

  destroy() {
    scene.remove(this.voronoiEdges);
  }

  protected makeTriangleMesh() {
    let triangleCount = 0;
    const polygons = this.voronoi.polygons().features;
    for (let i = 0; i < polygons.length; i++) {
      triangleCount += polygons[i].geometry.coordinates[0].length + 1;
    }

    const positions = new THREE.BufferAttribute(new Float32Array(triangleCount * 9), 3);
    triangleCount = 0;
    let vertexCount = 0;
    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i].geometry.coordinates[0];
      const firstVertex = new GeoCoord(polygon[0][1], polygon[0][0]).toWorldVector();

      for (let j = 1; j < polygon.length - 2; j++) {
        const secondVertex = new GeoCoord(polygon[j][1], polygon[j][0]).toWorldVector();
        const thirdVertex = new GeoCoord(polygon[j + 1][1], polygon[j + 1][0]).toWorldVector();

        this.meshTriangleToCell[triangleCount++] = i;
        this.cellToMeshTriangle[i] ||= [];
        this.cellToMeshTriangle[i].push(vertexCount);
        positions.setXYZ(vertexCount++, firstVertex.x, firstVertex.y, firstVertex.z);
        this.cellToMeshTriangle[i].push(vertexCount);
        positions.setXYZ(vertexCount++, secondVertex.x, secondVertex.y, secondVertex.z);
        this.cellToMeshTriangle[i].push(vertexCount);
        positions.setXYZ(vertexCount++, thirdVertex.x, thirdVertex.y, thirdVertex.z);
      }
    }

    const geometry = new THREE.BufferGeometry().setAttribute("position", positions);
    for (let i = 0; i < this.cellToMeshTriangle.length; i++) {
      geometry.addGroup(this.cellToMeshTriangle[i][0], this.cellToMeshTriangle[i].length, i % COLORS.length);
    }
    return new THREE.Mesh(geometry, COLORS);
  }

  // All of these helper functions are hideously inefficient, but it doesn't really matter.
  // We only do this once on startup.
  protected makeEdges() {
    const polygons = this.voronoi.polygons().features;
    const edges: Array<THREE.Vector3[]> = [];

    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i].geometry.coordinates[0];
      for (let j = 0; j < polygon.length - 1; j++) {
        const posA = new GeoCoord(polygon[j][1], polygon[j][0]).toWorldVector();
        const posB = new GeoCoord(polygon[j + 1][1], polygon[j + 1][0]).toWorldVector();
        const edge = [posA, posB];
        if (!edges.some((e) => { return this.isSameLineSegment(edge, e) })) { // inefficiently remove duplicates
          edges.push(edge)
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

  protected isSameLineSegment(edgeA: THREE.Vector3[], edgeB: THREE.Vector3[]) {
    return (edgeA[0].equals(edgeB[0]) && edgeA[1].equals(edgeB[1])) ||
           (edgeA[0].equals(edgeB[1]) && edgeA[1].equals(edgeB[0]));
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

  stereoProject(vec: THREE.Vector3) {
    return new THREE.Vector2(
      vec.x / (Planet.radius - vec.z) * 2,
      vec.y / (Planet.radius - vec.z) * 2,
    );
  }

  stereoUnproject(x: number, y: number) {
    x /= 2;
    y /= 2;
    const xSquared = x * x, ySquared = y * y;
    return new THREE.Vector3(
      (2 * Planet.radius * x) / (Planet.radius + xSquared + ySquared),
      (2 * Planet.radius * y) / (Planet.radius + xSquared + ySquared),
      (-Planet.radius + xSquared + ySquared) / (Planet.radius + xSquared + ySquared),
    );
  }}
