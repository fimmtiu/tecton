import * as THREE from "three";

import { VoronoiSphere } from "./voronoi_sphere";
import { shuffle, sample } from "./util";

export { Tectonics };

const INITIAL_LAND_CELLS = 8;
const INITIAL_WATER_CELLS = 8;
// const SWITCH_CELLS = 10;
// const SWITCH_SPREAD_CHANCE = 0.4;

class Tectonics {
  public voronoiSphere: VoronoiSphere; // FIXME: Move this back to protected once we're done debugging

  constructor() {
    this.voronoiSphere = new VoronoiSphere();
    this.fillCellsWithLandAndWater();
    // this.addIslandsAndLakes();
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
      const plate = i >= INITIAL_LAND_CELLS ? i % 8 + 8 : i % 8;
      queue.push([cell, terrain, plate]);
    }

    while (queue.length > 0) {
      const [cell, terrain, plate] = <number[]> queue.shift();
      this.voronoiSphere.cellData(cell).setHeight(terrain);
      this.voronoiSphere.cellData(cell).plate = plate;
      for (let neighbor of shuffle(this.voronoiSphere.neighbours(cell))) {
        if (!seen[neighbor]) {
          queue.push([neighbor, terrain, plate]);
          seen[neighbor] = true;
        }
      }
    }

    this.voronoiSphere.update();
  }

  // addIslandsAndLakes() {
  //   for (let i = 0; i < SWITCH_CELLS; i++) {
  //     const cell = THREE.MathUtils.randInt(0, this.voronoiSphere.cellCount() - 1);
  //     this.toggleCell(cell, SWITCH_SPREAD_CHANCE);
  //   }
  // }

  // protected toggleCell(cell: number, spreadChance: number) {
  //   const cellData = this.voronoiSphere.cellData(cell);
  //   cellData.setHeight(-cellData.height());

  //   if (Math.random() < spreadChance) {
  //     const randomNeighbour = sample(this.voronoiSphere.neighbours(cell));
  //     this.toggleCell(randomNeighbour, spreadChance / 2);
  //   }
  // }
}
