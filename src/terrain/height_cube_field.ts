import * as THREE from "three";

import { CubeField } from "../cube_field";
import { scene } from "../scene_data";
import { PlateSphere } from "./plate_sphere";
import { PLANET_RADIUS } from "../planet";
import { VisualHelper } from "../visual_helper";
import { v2s } from "../util";

export { HeightCubeField };

class HeightCell {
  public center = new THREE.Vector3();
  public height = 0;
  public ruggedness = 0;
  public nearnessToWater = 0; // 0 is landlocked, 0.5 is near a coastline, 1.0 is at sea.
}

const MATERIALS = [
  new THREE.PointsMaterial({ color: 0x00ff00, size: 100 }),
  new THREE.PointsMaterial({ color: 0x0000ff, size: 100 }),
];

const CLOSE_TO_WATER_THRESHOLD = 100; // km
const CARDINAL_DIRECTIONS = [1, 3, 5, 7];

class HeightCubeField extends CubeField<HeightCell> {
  protected centersMesh: THREE.Points;
  protected showCentersMesh: THREE.Points;
  protected closeToWaterDistance: number;

  constructor(cellsPerEdge: number, plateSphere: PlateSphere) {
    super(cellsPerEdge, () => { return new HeightCell() });

    this.centersMesh = this.centers(MATERIALS);
    this.showCentersMesh = this.centers(MATERIALS, 1.01);
    this.closeToWaterDistance = Math.floor(CLOSE_TO_WATER_THRESHOLD / (PLANET_RADIUS / this.cellsPerEdge));

    // Do a quick pass over all the cells to indicate whether they're land or water.
    const positions = this.centersMesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const heightCell = this.get(i);
      heightCell.center = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const data = plateSphere.dataAtPoint(heightCell.center);
      heightCell.height = data["plate"].isLand ? 1 : -1;
      this.showCentersMesh.geometry.addGroup(i, 1, data["plate"].isLand ? 0 : 1);
    }

    // Calculate the nearnessToWater for all cells.
    this.update();

    // scene.add(this.edges(0xea00ff, 1.01)); // show cell boundaries
    // scene.add(this.showCentersMesh);       // show a dot at the center of each cell
  }

  drawLine(start: THREE.Vector3, end: THREE.Vector3, height: number, ruggedness: number) {

  }

  setCell(cell: number, height: number, ruggedness: number) {
    this.cells[cell].height = height;
    this.cells[cell].ruggedness = ruggedness;
  }

  update() {
    for (let i = 0; i < this.cells.length; i++) {
      this.get(i).nearnessToWater = this.nearnessToWater(i);
    }
  }

  static points: Array<THREE.Vector3> = [];

  protected nearnessToWater(cell: number) {
    HeightCubeField.points = [];
    const cellContainsWater: { [cell: number]: boolean } = {};
    this.recursivelyCheckAdjacentCells(cellContainsWater, cell, this.closeToWaterDistance);

    let waterCells = 0;
    for (let value of Object.values(cellContainsWater)) {
      if (value) {
        waterCells++;
      }
    }

    return waterCells / Object.keys(cellContainsWater).length;
  }

  protected recursivelyCheckAdjacentCells(cellContainsWater: { [cell: number]: boolean }, cell: number, remainingDistance: number) {
    cellContainsWater[cell] = (this.get(cell).height <= 0);

    for (let dir of CARDINAL_DIRECTIONS) {
      const adjacentCell = this.neighbour(cell, dir);
      if (remainingDistance > 0 && !(adjacentCell in cellContainsWater)) {
        this.recursivelyCheckAdjacentCells(cellContainsWater, adjacentCell, remainingDistance - 1);
      }
    }
  }

}
