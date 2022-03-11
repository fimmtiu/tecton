import * as THREE from "three";

import { VoronoiSphere } from "./voronoi_sphere";

export { Tectonics };

class Tectonics {
  protected voronoiSphere: VoronoiSphere;

  constructor() {
    this.voronoiSphere = new VoronoiSphere();

    // TEMPORARY: Just making the surface randomly 30% land, 70% water.
    for (let i = 0; i < this.voronoiSphere.cellCount(); i++) {
      this.voronoiSphere.setColor(i, Math.random() > 0.3 ? 0 : 1);
    }
  }

  destroy() {
    this.voronoiSphere.destroy();
  }
}
