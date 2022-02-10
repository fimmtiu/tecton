import * as THREE from "three";
import { Planet } from "./planet";
import { ORIGIN } from "./util";

export { VisualHelper };

const COLORS = [0xffae00, 0x00ffff, 0xff1e00, 0xc800ff]; // orange, aqua, red, purple

class VisualHelper {
  protected scene: THREE.Scene;
  protected pointVectors: Array<THREE.Vector3>;
  protected points: Array<THREE.Points>;
  protected arrows: Array<THREE.ArrowHelper>;
  protected axes: THREE.AxesHelper | null;
  public showArrows: boolean;
  public showAxes: boolean;

  constructor(scene: THREE.Scene, points: Array<THREE.Vector3>, showArrows = false, showAxes = false) {
    this.scene = scene;
    this.pointVectors = points;
    this.points = [];
    this.arrows = [];
    this.axes = null;
    this.showArrows = showArrows;
    this.showAxes = showAxes;

    this.drawVisualAids(points);
  }

  destroy() {
    for (let arrow of this.arrows) {
      this.scene.remove(arrow);
    }
    this.arrows = [];

    if (this.axes) {
      this.scene.remove(this.axes);
      this.axes.dispose();
      this.axes = null;
    }

    for (let point of this.points) {
      this.scene.remove(point);
      (<THREE.Material>point.material).dispose();
      point.geometry.dispose();
    }
    this.points = [];
  }

  update() {
    this.drawVisualAids(this.pointVectors);
  }

  setPoints(points: Array<THREE.Vector3>) {
    this.pointVectors = points;
    this.update();
  }

  protected drawVisualAids(points: Array<THREE.Vector3>) {
    this.destroy();

    if (this.showAxes) {
      this.axes = new THREE.AxesHelper(Planet.radius + 2000);
      this.axes.renderOrder = 99999999999;
      (<THREE.Material>this.axes.material).depthTest = false;
      this.scene.add(this.axes);
    }

    for (let i = 0; i < points.length; i++) {
      const color = COLORS[i % COLORS.length];

      const points_geometry = new THREE.BufferGeometry();
      points_geometry.setAttribute('position', new THREE.Float32BufferAttribute([points[i].x, points[i].y, points[i].z], 3));
      const points_material = new THREE.PointsMaterial({ color: color, size: 250 });
      const point = new THREE.Points(points_geometry, points_material);
      this.scene.add(point);
      this.points.push(point);

      if (this.showArrows) {
        const arrow = new THREE.ArrowHelper(points[i].clone().normalize(), ORIGIN, Planet.radius + 2000, color);
        arrow.renderOrder = 999999999999;
        (<THREE.Material>arrow.line.material).depthTest = false;
        this.scene.add(arrow);
      }
    }
  }
}
