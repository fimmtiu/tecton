import * as THREE from "three";

import { CubeField } from "../cube_field";
import { scene } from "../scene_data";
import { PlateSphere } from "./plate_sphere";
import { PLANET_RADIUS } from "../planet"

export { HeightCubeField };

class HeightCell {
  public height = 0;
  public ruggedness = 0;
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

    scene.add(this.edges(0xea00ff, 1.01));

    this.centersMesh = this.centers(MATERIALS);
    this.showCentersMesh = this.centers(MATERIALS, 1.01);
    this.closeToWaterDistance = Math.floor(CLOSE_TO_WATER_THRESHOLD / (PLANET_RADIUS / this.cellsPerEdge));

    const positions = this.centersMesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const center = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const data = plateSphere.dataAtPoint(center);
      this.get(i).height = data["plate"].isLand ? 1 : -1;
      this.showCentersMesh.geometry.addGroup(i, 1, data["plate"].isLand ? 0 : 1);
    }

    scene.add(this.showCentersMesh);
  }

  drawLine(start: THREE.Vector3, end: THREE.Vector3, height: number, ruggedness: number) {

  }

  setCell(cell: number, height: number, ruggedness: number) {
    this.cells[cell].height = height;
    this.cells[cell].ruggedness = ruggedness;
  }

  // FIXME: Is this guaranteed to be constant? If so, generate this in the constructor and store it in the HeightCell.
  nearnessToWater(cell: number) {
    const cellsContainWater: { [cell: number]: boolean } = {};
    this.recursivelyCheckAdjacentCells(cellsContainWater, cell, this.closeToWaterDistance);

    let waterCells = 0;
    for (let value of Object.values(cellsContainWater)) {
      if (value) {
        waterCells++;
      }
    }
    return waterCells / Object.keys(cellsContainWater).length;
  }

  protected recursivelyCheckAdjacentCells(cellsContainWater: { [cell: number]: boolean }, cell: number, remainingDistance: number) {
    cellsContainWater[cell] = this.get(cell).height <= 0;

    for (let dir of CARDINAL_DIRECTIONS) {
      const adjacentCell = this.neighbour(cell, dir);
      if (remainingDistance > 0 && !(adjacentCell in cellsContainWater)) {
        this.recursivelyCheckAdjacentCells(cellsContainWater, adjacentCell, remainingDistance - 1);
      }
    }
  }

}
