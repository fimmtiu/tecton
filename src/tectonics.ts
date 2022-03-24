import * as THREE from "three";

import { PlateSphere } from "./tectonics/plate_sphere";
import { HeightCubeField } from "./tectonics/height_cube_field";

export { Tectonics };


class Tectonics {
  public plateSphere: PlateSphere; // FIXME: Move this back to protected once we're done debugging
  public heights: HeightCubeField;

  constructor() {
    this.plateSphere = new PlateSphere();
    this.heights = new HeightCubeField(100, this.plateSphere);
  }

  destroy() {
    this.plateSphere.destroy();
  }
}
