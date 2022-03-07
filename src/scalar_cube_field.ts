import { CubeField } from "./cube_field";

export { ScalarCubeField };

class ScalarCubeField extends CubeField<number> {
  constructor(cellsPerEdge: number) {
    super(cellsPerEdge, () => { return 0 });
  }
}

// const POINT_SIZES = 20;
// const POINT_SIZE_MIN = 100;
// const POINT_SIZE_MAX = 500;

//   constructor() {
//     this.minValue = min;
//     this.maxValue = max;
//     this.points = this.centers.clone();
//     const materials = [];
//     for (let i = 0; i < POINT_SIZES; i++) {
//       const size = POINT_SIZE_MIN + Math.ceil((POINT_SIZE_MAX - POINT_SIZE_MIN) / POINT_SIZES) * i;
//       materials.push(new THREE.PointsMaterial({ color: color, size: size }));
//     }
//     (<THREE.Material> this.points.material).dispose();
//     this.points.material = materials;

//   }

//   destroy() {
//     super.destroy();
//     disposeMesh(this.points);
//   }

//   get(cell: number) {
//     return this.values[cell];
//   }

//   set(cell: number, newValue: number) {
//     this.values[cell] = newValue;
//   }

//   // Update the size of the points that represent the field's values.
//   update() {
//     const materialIndex = (i: number) => {
//       console.log(`${this.values[i]} => ${Math.floor((this.values[i] - this.minValue) / (this.maxValue - this.minValue) * (POINT_SIZES - 1))}`);
//       return Math.floor((this.values[i] - this.minValue) / (this.maxValue - this.minValue) * (POINT_SIZES - 1));
//     }

//     this.points.geometry.clearGroups();
//     let start = 0, count = 0, previousMaterial = materialIndex(0);
//     for (let i = 0; i < CubeField.cellCount; i++) {
//       const material = materialIndex(i);
//       count++;
//       if (material != previousMaterial) {
//         this.points.geometry.addGroup(start, count, previousMaterial);
//         previousMaterial = material;
//         count = 1;
//         start = i;
//       }
//     }
//     this.points.geometry.addGroup(start, count, previousMaterial);
//   }

//   showValues(value: boolean) {
//     if (value) {
//       scene.add(this.points);
//     } else {
//       scene.remove(this.points);
//     }
//   }
// }
