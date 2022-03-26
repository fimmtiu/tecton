import * as THREE from "three";

import { CubeField } from "../cube_field";
import { scene } from "../scene_data";
import { PlateSphere } from "./plate_sphere";

export { HeightCubeField };

class HeightCell {
  public height = 0;
  public ruggedness = 0;
}

const MATERIALS = [
  new THREE.PointsMaterial({ color: 0x00ff00, size: 100 }),
  new THREE.PointsMaterial({ color: 0x0000ff, size: 100 }),
];

class HeightCubeField extends CubeField<HeightCell> {
  protected centersMesh: THREE.Points;
  protected showCentersMesh: THREE.Points;

  constructor(cellsPerEdge: number, plateSphere: PlateSphere) {
    super(cellsPerEdge, () => { return new HeightCell() });

    scene.add(this.edges([new THREE.LineBasicMaterial({ color: 0xea00ff })], 1.1));

    this.centersMesh = this.centers(MATERIALS);
    this.showCentersMesh = this.centers(MATERIALS, 1.01);

    const positions = this.centersMesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const center = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const data = plateSphere.dataAtPoint(center);
      this.get(i).height = data["plate"].isLand ? 1 : -1;
      this.showCentersMesh.geometry.addGroup(i, 1, data["plate"].isLand ? 0 : 1);
    }

    scene.add(this.showCentersMesh);
  }
}
