import * as THREE from "three";

export { Climate };

const CELLS_PER_EDGE = 16

class Climate {
  // protected precipitation: ScalarCubeField;

  // constructor() {
  //   this.precipitation = new ScalarCubeField(CELLS_PER_EDGE);
    // // Set up some bogus data for testing.
    // for (let face = 0; face < 6; face++) {
    //   for (let i = 0; i < this.precipitation.cellsPerFace; i++) {
    //     console.log(`set ${face * this.precipitation.cellsPerFace + i} of ${this.precipitation.cellCount} to ${face * 20}`);
    //     this.precipitation.set(face * this.precipitation.cellsPerFace + i, face * 20);
    //   }
    // }
    // this.precipitation.update();
    // this.precipitation.showEdges(true);
    // this.precipitation.showValues(true);
    // this.precipitation.showCenters(true);
  // }
}
