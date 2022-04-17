import * as THREE from "three";
import * as D3GeoVoronoi from "d3-geo-voronoi";

import { Planet } from "../planet";
import { scene } from "../scene_data";
import { v2s, sample, shuffle } from "../util";
import { GeoCoord } from "../util/geo_coord";
import { mergeDuplicateVertices, randomlyJitterVertices, wrapMeshAroundSphere } from "../util/geometry";
import { PlateCell, Plate, PlateBoundary, PLATE_COLORS } from "./plates";

export { PlateSphere };

// TODO: I'd like to do some Lloyd's relaxation on the Voronoi cells to reduce the number of little tiny edges
// that you can barely see. They cause some weird-looking effects.

const VORONOI_DENSITY = 10;
const STARTING_LAND_CELLS = 8;
const STARTING_WATER_CELLS = 15; // TODO: Instead of this, could we make water spread faster than land?
const SWITCH_CELLS = 10;
const SWITCH_SPREAD_CHANCE = 0.4;

class PlateSphere {
  public readonly plateCells: PlateCell[] = [];
  public readonly plates: Plate[] = [];
  public readonly plateBoundaries: PlateBoundary[] = [];

  protected voronoi: any; // It comes from a 3rd-party library (d3-geo-voronoi) with no TypeScript support.
  protected polygons: Array<any>;
  protected voronoiEdges: THREE.LineSegments;
  protected voronoiMesh: THREE.Mesh;
  protected islandLandPlate!: Plate;
  protected lakeWaterPlate!: Plate;

  constructor() {
    this.voronoi = D3GeoVoronoi.geoVoronoi(this.voronoiStartingPoints());
    this.polygons = this.voronoi.polygons().features;

    this.setUpPlates();
    for (let i = 0; i < this.polygons.length; i++) {
      this.plateCells.push(new PlateCell(i, this.plates[0], this.convertLineSegments(i)));
    }

    this.fillCellsWithLandAndWater();
    this.addIslandsAndLakes();
    this.logLandWaterRatio();
    this.constructPlateBoundaries();

    this.voronoiEdges = this.makeEdges();
    // scene.add(this.voronoiEdges);

    this.voronoiMesh = this.makeTriangleMesh();
    scene.add(this.voronoiMesh);
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

  neighbours(cell: number): number[] {
    return this.polygons[cell].properties.neighbours;
  }

  update() {
    scene.remove(this.voronoiEdges);
    this.voronoiEdges.geometry.dispose();
    this.voronoiEdges = this.makeEdges();
    // scene.add(this.voronoiEdges);

    scene.remove(this.voronoiMesh);
    this.voronoiMesh.geometry.dispose();
    this.voronoiMesh = this.makeTriangleMesh();
    scene.add(this.voronoiMesh);
  }

  dataAtPoint(point: THREE.Vector3) {
    const coord = GeoCoord.fromWorldVector(point);
    const cell = this.voronoi.find(coord.lon, coord.lat);
    return {
      "cell": this.plateCells[cell],
      "plate": this.plateCells[cell].plate,
    };
  }

  protected setUpPlates() {
    for (let i = 0; i < STARTING_LAND_CELLS + STARTING_WATER_CELLS; i++) {
      this.plates.push(new Plate(this.plates.length, i < STARTING_LAND_CELLS));
    }
    this.islandLandPlate = new Plate(this.plates.length, true, null);
    this.islandLandPlate.interactsWithOthers = false;
    this.plates.push(this.islandLandPlate);
    this.lakeWaterPlate = new Plate(this.plates.length, false, null);
    this.lakeWaterPlate.interactsWithOthers = false;
    this.plates.push(this.lakeWaterPlate);
  }

  // Converts d3-geo-voronoi's [lon, lat] coordinates for each point to THREE.Vector3s in world-space.
  protected convertLineSegments(cell: number): Array<THREE.Vector3> {
    const coords = this.polygons[cell].geometry.coordinates[0];
    return coords.map((coord: number[]) => { return new GeoCoord(coord[1], coord[0]).toWorldVector(); });
  }

  protected fillCellsWithLandAndWater() {
    const seen: { [cellId: number]: boolean } = {};
    const queue: Array<[number, Plate]> = [];

    for (let i = 0; i < STARTING_LAND_CELLS + STARTING_WATER_CELLS; i++) {
      const cellId = THREE.MathUtils.randInt(0, this.cellCount() - 1);
      queue.push([cellId, this.plates[i]]);
    }

    while (queue.length > 0) {
      const [cellId, plate] = <[number, Plate]> queue.shift();
      this.plateCells[cellId].plate = plate;
      this.plateCells[cellId].plate = plate;
      for (let neighbour of shuffle(this.neighbours(cellId))) {
        if (!seen[neighbour]) {
          queue.push([neighbour, plate]);
          seen[neighbour] = true;
        }
      }
    }
  }

  protected addIslandsAndLakes() {
    for (let i = 0; i < SWITCH_CELLS; i++) {
      const cell = THREE.MathUtils.randInt(0, this.cellCount() - 1);
      this.toggleCell(cell, SWITCH_SPREAD_CHANCE);
    }
  }

  protected toggleCell(cellId: number, spreadChance: number) {
    const cell = this.plateCells[cellId];
    cell.plate = cell.plate.isLand ? this.lakeWaterPlate : this.islandLandPlate;

    if (Math.random() < spreadChance) {
      const randomNeighbour = sample(this.neighbours(cellId));
      this.toggleCell(randomNeighbour, spreadChance / 2);
    }
  }

  protected constructPlateBoundaries() {
    const seen: { [edge: string]: boolean } = {};

    for (let i = 0; i < this.plateCells.length; i++) {
      const cell = this.plateCells[i];
      for (let j = 0; j < cell.lineSegments.length - 1; j++) {
        const pointA = cell.lineSegments[j], pointB = cell.lineSegments[j + 1];
        const hash1 = `${v2s(pointA)},${v2s(pointB)}`;
        const hash2 = `${v2s(pointB)},${v2s(pointA)}`;
        if (!seen[hash1] && !seen[hash2]) {
          const thisPlate = this.plateCells[i];
          const adjacentPlate = this.plateCells[this.neighbour(i, pointA, pointB)];
          this.plateBoundaries.push(new PlateBoundary(thisPlate, adjacentPlate));
          seen[hash1] = seen[hash2] = true;
        }
      }
    }
  }

  // FIXME: Just for debugging; can remove this later.
  protected logLandWaterRatio() {
    let land = 0, water = 0;
    for (let cell of this.plateCells) {
      if (cell.plate.isLand) {
        land++;
      } else {
        water++;
      }
    }
    console.log(`${land} land cells, ${water} water cells (${land / (land + water) * 100}% land)`);
  }

  static readonly LINE_MATERIALS = [
    new THREE.LineBasicMaterial({ color: 0xff0000 }), // away
    new THREE.LineBasicMaterial({ color: 0xffffff }), // neutral
    new THREE.LineBasicMaterial({ color: 0x0000ff }), // towards
  ];

  protected makeEdges() {
    const positions = new THREE.BufferAttribute(new Float32Array(this.plateBoundaries.length * 6), 3);
    const geometry = new THREE.BufferGeometry().setAttribute("position", positions);
    for (let i = 0; i < this.plateBoundaries.length; i++) {
      const boundary = this.plateBoundaries[i];
      positions.setXYZ(i * 2, boundary.startPoint.x, boundary.startPoint.y, boundary.startPoint.z);
      positions.setXYZ(i * 2 + 1, boundary.endPoint.x, boundary.endPoint.y, boundary.endPoint.z);

      let color = 1;
      if (boundary.convergence > 0.3) {
        color = 0;
      } else if (boundary.convergence < -0.3) {
        color = 2;
      }
      geometry.addGroup(i * 2, 2, color);
    }
    return new THREE.LineSegments(geometry, PlateSphere.LINE_MATERIALS);
  }

  // Find the neighbouring cell which shares the given line segment.
  protected neighbour(cell: number, pointA: THREE.Vector3, pointB: THREE.Vector3) {
    for (let n of this.neighbours(cell)) {
      const cell = this.plateCells[n];
      for (let i = 0; i < cell.lineSegments.length - 1; i++) {
        if (cell.lineSegments[i].equals(pointB) && cell.lineSegments[i + 1].equals(pointA)) {
          return n;
        }
      }
    }
    throw `Can't find a neighbour for cell ${cell}!`;
  }

  protected makeTriangleMesh() {
    const cellToMeshTriangle = [];
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
      cellToMeshTriangle[i] = { plateCell: this.plateCells[i], startVertex: vertexCount, numVertices: 0 };

      for (let j = 1; j < polygon.length - 2; j++) {
        const secondVertex = new GeoCoord(polygon[j][1], polygon[j][0]).toWorldVector();
        const thirdVertex = new GeoCoord(polygon[j + 1][1], polygon[j + 1][0]).toWorldVector();

        cellToMeshTriangle[i]["numVertices"]++;
        positions.setXYZ(vertexCount++, firstVertex.x, firstVertex.y, firstVertex.z);
        cellToMeshTriangle[i]["numVertices"]++;
        positions.setXYZ(vertexCount++, thirdVertex.x, thirdVertex.y, thirdVertex.z); // reverse the vertex order
        cellToMeshTriangle[i]["numVertices"]++;
        positions.setXYZ(vertexCount++, secondVertex.x, secondVertex.y, secondVertex.z);
      }
    }

    const geometry = new THREE.BufferGeometry().setAttribute("position", positions);
    for (let i = 0; i < cellToMeshTriangle.length; i++) {
      const color = this.plateCells[i].plate.color();
      geometry.addGroup(cellToMeshTriangle[i]["startVertex"], cellToMeshTriangle[i]["numVertices"], color);
    }
    mergeDuplicateVertices(geometry);
    return new THREE.Mesh(geometry, PLATE_COLORS);
  }

  protected voronoiStartingPoints() {
    const startingPoints = new THREE.IcosahedronBufferGeometry(Planet.radius, VORONOI_DENSITY);
    mergeDuplicateVertices(startingPoints);
    randomlyJitterVertices(startingPoints, Planet.radius);
    wrapMeshAroundSphere(startingPoints, Planet.radius);

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
}
