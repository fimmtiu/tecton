import * as THREE from "three";

import { VoronoiSphere } from "./voronoi_sphere";
import { shuffle } from "./util";

export { Tectonics };

const INITIAL_LAND_CELLS = 20;
const INITIAL_WATER_CELLS = 60;

class Tectonics {
  protected voronoiSphere: VoronoiSphere;

  constructor() {
    this.voronoiSphere = new VoronoiSphere();
    this.fillCellsWithLandAndWater();
    this.voronoiSphere.update();

    let land = 0, water = 0;
    for (let i = 0; i < this.voronoiSphere.cellCount(); i++) {
      if (this.voronoiSphere.cellData(i).height() > 0) {
        land++;
      } else {
        water++;
      }
    }
    console.log(`land ${land}, water ${water} (${land / water * 100}%)`);
  }

  destroy() {
    this.voronoiSphere.destroy();
  }

  fillCellsWithLandAndWater() {
    const seen: { [cell: number]: boolean } = {};
    const queue: Array<number[]> = [];

    for (let i = 0; i < INITIAL_LAND_CELLS + INITIAL_WATER_CELLS; i++) {
      const cell = THREE.MathUtils.randInt(0, this.voronoiSphere.cellCount() - 1);
      const terrain = i >= INITIAL_LAND_CELLS ? -1 : 1;
      queue.push([cell, terrain]);
    }

    while (queue.length > 0) {
      const [cell, terrain] = <number[]> queue.shift();
      this.voronoiSphere.cellData(cell).setHeight(terrain);
      for (let neighbor of shuffle(this.voronoiSphere.neighbours(cell))) {
        if (!seen[neighbor]) {
          queue.push([neighbor, terrain]);
          seen[neighbor] = true;
        }
      }
    }
  }
}
