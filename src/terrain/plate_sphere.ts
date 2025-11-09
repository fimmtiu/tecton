import * as THREE from "three";
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import * as D3GeoVoronoi from "d3-geo-voronoi";

import { PLANET_RADIUS } from "../planet";
import { scene } from "../scene_data";
import { v2s, sample, shuffle } from "../util";
import { GeoCoord } from "../util/geo_coord";
import { randomlyJitterVertices, wrapMeshAroundSphere, sphericalLloydsRelaxation } from "../util/geometry";
import { PlateCell, Plate, PlateBoundary } from "./plates";

export { PlateSphere };

const VORONOI_DENSITY = 10;
const STARTING_LAND_CELLS = 6;
const STARTING_WATER_CELLS = 17;
const SWITCH_CELLS = 10;
const SWITCH_SPREAD_CHANCE = 0.6;
const EDGES_SCALE_FACTOR = 1.01;

class PlateSphere {
  public readonly plateCells: PlateCell[] = [];
  public readonly plates: Plate[] = [];
  public readonly plateBoundaries: PlateBoundary[] = [];

  protected voronoi: any; // It comes from a 3rd-party library (d3-geo-voronoi) with no TypeScript support.
  protected polygons: Array<any>; // Ditto.
  protected voronoiEdges: LineSegments2;
  protected islandLandPlate!: Plate;
  protected lakeWaterPlate!: Plate;

  constructor() {
    this.voronoi = D3GeoVoronoi.geoVoronoi(this.voronoiStartingPoints());
    // Distributes the Voronoi cells more evenly to prevent weird tiny edges. One iteration is enough; more than that
    // makes it look like a regular hex map.
    this.voronoi = sphericalLloydsRelaxation(this.voronoi, 1);
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
    scene.add(this.voronoiEdges);
  }

  destroy() {
    scene.remove(this.voronoiEdges);
    this.voronoiEdges.geometry.dispose();
    (this.voronoiEdges.material as LineMaterial).dispose();
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
    (this.voronoiEdges.material as LineMaterial).dispose();
    this.voronoiEdges = this.makeEdges();
    scene.add(this.voronoiEdges);
  }

  dataAtPoint(point: THREE.Vector3) {
    const coord = GeoCoord.fromWorldVector(point);
    const cell = this.voronoi.find(coord.lon, coord.lat);
    return {
      "cell": this.plateCells[cell],
      "plate": this.plateCells[cell].plate,
    };
  }

  plateAtPoint(point: THREE.Vector3) {
    const coord = GeoCoord.fromWorldVector(point);
    const cell = this.voronoi.find(coord.lon, coord.lat);
    return this.plateCells[cell].plate;
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
      for (const neighbour of shuffle(this.neighbours(cellId))) {
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
          const thisPlateCell = this.plateCells[i];
          const adjacentPlateCell = this.plateCells[this.neighbour(i, pointA, pointB)];
          if (thisPlateCell.plate.id != adjacentPlateCell.plate.id) {
            const boundary = new PlateBoundary(thisPlateCell, adjacentPlateCell);
            this.plateBoundaries.push(boundary);
            thisPlateCell.plate.boundaries.push(boundary);
            adjacentPlateCell.plate.boundaries.push(boundary);
          }
          seen[hash1] = seen[hash2] = true;
        }
      }
    }
  }

  // FIXME: Just for debugging; can remove this later.
  protected logLandWaterRatio() {
    let land = 0, water = 0;
    for (const cell of this.plateCells) {
      if (cell.plate.isLand) {
        land++;
      } else {
        water++;
      }
    }
    console.log(`${land} land cells, ${water} water cells (${land / (land + water) * 100}% land)`);
  }

  protected makeEdges() {
    const positions: number[] = [];
    const colors: number[] = [];

    const redColor = new THREE.Color(0xff0000);      // divergent plates
    const neutralColor = new THREE.Color(0xffffff);  // plate boundary with no motion
    const blueColor = new THREE.Color(0x0000ff);     // convergent plates

    for (let i = 0; i < this.plateBoundaries.length; i++) {
      const boundary = this.plateBoundaries[i];
      const start = boundary.startPoint.clone().multiplyScalar(EDGES_SCALE_FACTOR);
      const end = boundary.endPoint.clone().multiplyScalar(EDGES_SCALE_FACTOR);

      positions.push(start.x, start.y, start.z);
      positions.push(end.x, end.y, end.z);

      let color: THREE.Color;
      if (boundary.diverging()) {
        color = redColor;
      } else if (boundary.colliding()) {
        color = blueColor;
      } else {
        color = neutralColor;
      }

      colors.push(color.r, color.g, color.b);
      colors.push(color.r, color.g, color.b);
    }

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colors);

    const material = new LineMaterial({
      color: 0xffffff,
      linewidth: 2,  // in pixels
      transparent: true,
      opacity: 0.3,
      vertexColors: true,
      alphaToCoverage: true,  // helps with aliasing
      depthTest: true,
      depthFunc: THREE.LessEqualDepth,  // Allow lines at equal depth to render
      polygonOffset: true,
      polygonOffsetFactor: -1.0,  // Push lines forward in depth buffer to avoid clipping
      polygonOffsetUnits: -1.0,
    });

    const width = (typeof window !== 'undefined') ? window.innerWidth : 1920;
    const height = (typeof window !== 'undefined') ? window.innerHeight : 1080;
    material.resolution.set(width, height);

    return new LineSegments2(geometry, material);
  }

  // Find the neighbouring cell which shares the given line segment.
  protected neighbour(cell: number, pointA: THREE.Vector3, pointB: THREE.Vector3) {
    for (const n of this.neighbours(cell)) {
      const cell = this.plateCells[n];
      for (let i = 0; i < cell.lineSegments.length - 1; i++) {
        if (cell.lineSegments[i].equals(pointB) && cell.lineSegments[i + 1].equals(pointA)) {
          return n;
        }
      }
    }
    throw `Can't find a neighbour for cell ${cell}!`;
  }

  protected voronoiStartingPoints() {
    const messyStartingPoints = new THREE.IcosahedronGeometry(PLANET_RADIUS, VORONOI_DENSITY);
    const startingPoints = BufferGeometryUtils.mergeVertices(messyStartingPoints);
    messyStartingPoints.dispose()

    randomlyJitterVertices(startingPoints, PLANET_RADIUS);
    wrapMeshAroundSphere(startingPoints, PLANET_RADIUS);

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
