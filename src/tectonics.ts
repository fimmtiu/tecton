import * as THREE from "three";

import { PlateSphere } from "./tectonics/plate_sphere";

export { Tectonics };


class Tectonics {
  public plateSphere: PlateSphere; // FIXME: Move this back to protected once we're done debugging

  constructor() {
    this.plateSphere = new PlateSphere();
  }

  destroy() {
    this.plateSphere.destroy();
  }
}
