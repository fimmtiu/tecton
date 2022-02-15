import * as THREE from "three";
import { VectorCubeField } from "./vector_cube_field";

export { Tectonics };

class Tectonics {
  protected velocities: VectorCubeField;

  constructor() {
    this.velocities = new VectorCubeField();
  }
}
