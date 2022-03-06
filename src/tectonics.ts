import * as THREE from "three";

import { VoronoiSphere } from "./voronoi_sphere";

export { Tectonics };

class Tectonics {
  protected voronoiSphere: VoronoiSphere;

  constructor() {
    this.voronoiSphere = new VoronoiSphere();
  }

  destroy() {
    this.voronoiSphere.destroy();
  }
}
