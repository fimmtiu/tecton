import * as THREE from "three";

import { PlateSphere } from "./tectonics/plate_sphere";
import { HeightCubeField } from "./tectonics/height_cube_field";

export { Tectonics };


class Tectonics {
  public plateSphere: PlateSphere; // FIXME set this back to protected when we're done debugging
  public heightMap: HeightCubeField;

  constructor() {
    this.plateSphere = new PlateSphere();

    this.heightMap = new HeightCubeField(100, this.plateSphere);
  }

  destroy() {
    this.plateSphere.destroy();
  }
}
