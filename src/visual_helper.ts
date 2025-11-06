import * as THREE from "three";
import { PLANET_RADIUS } from "./planet";
import { ORIGIN } from "./util";
import { disposeMesh } from "./util/geometry";
import { scene } from "./scene_data";

export { VisualHelper, COLORS };

const COLORS = [0xffae00, 0x00ffff, 0xff1e00, 0xc800ff, 0x0000ff, 0x00ff00]; // orange, aqua, red, purple, blue, green

class VisualHelper {
  protected pointVectors: Array<THREE.Vector3>;
  protected normalMeshes: Array<THREE.Mesh>;
  protected points: Array<THREE.Points>;
  protected arrows: Array<THREE.ArrowHelper>;
  protected axes: THREE.AxesHelper | null;
  public showArrows: boolean;
  public showAxes: boolean;

  constructor(showArrows = false, showAxes = false) {
    this.pointVectors = [];
    this.normalMeshes = [];
    this.points = [];
    this.arrows = [];
    this.axes = null;
    this.showArrows = showArrows;
    this.showAxes = showAxes;
  }

  destroy() {
    for (const arrow of this.arrows) {
      scene.remove(arrow);
    }
    this.arrows = [];

    if (this.axes) {
      disposeMesh(this.axes);
      this.axes = null;
    }

    for (const point of this.points) {
      disposeMesh(point);
    }
    this.points = [];
  }

  update() {
    this.drawVisualAids(this.pointVectors);
  }

  setMeshesForNormals(meshes: Array<THREE.Mesh>) {
    this.normalMeshes = meshes;
    this.update();
  }

  setPoints(points: Array<THREE.Vector3>) {
    this.pointVectors = points;
    this.update();
  }

  protected drawVisualAids(points: Array<THREE.Vector3>) {
    this.destroy();

    if (this.showAxes) {
      this.axes = new THREE.AxesHelper(PLANET_RADIUS + 2000);
      this.axes.renderOrder = 99999999999;
      (<THREE.Material>this.axes.material).depthTest = false;
      scene.add(this.axes);
    }

    for (let i = 0; i < points.length; i++) {
      const color = COLORS[i % COLORS.length];

      const points_geometry = new THREE.BufferGeometry();
      const point_location = new THREE.Float32BufferAttribute([points[i].x, points[i].y, points[i].z], 3);
      points_geometry.setAttribute("position", point_location);
      const points_material = new THREE.PointsMaterial({ color: color, size: 250, depthTest: false });
      const point = new THREE.Points(points_geometry, points_material);
      point.renderOrder = 99999999999;
      scene.add(point);
      this.points.push(point);

      if (this.showArrows) {
        this.addArrow(points[i].clone().normalize(), ORIGIN, PLANET_RADIUS + 2000, color);
      }
    }

    for (let i = 0; i < this.normalMeshes.length; i++) {
      const positions = this.normalMeshes[i].geometry.attributes.position;
      const index = this.normalMeshes[i].geometry.index;
      if (index === null) {
        throw "not indexed, wtf?";
      }
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const faceNormal = new THREE.Vector3(), midpoint = new THREE.Vector3();
      const triangle = new THREE.Triangle();

      for (let j = 0; j < index.count; j++) {
        a.fromBufferAttribute(positions, index.getX((j * 3) + 0));
        b.fromBufferAttribute(positions, index.getX((j * 3) + 1));
        c.fromBufferAttribute(positions, index.getX((j * 3) + 2));
        triangle.set(a, b, c);
        triangle.getNormal(faceNormal);
        triangle.getMidpoint(midpoint);

        // Some code to change the color based on whether the normal is pointing towards or away from the camera:
        // (red = away, blue = towards). Requires us to pass in the camera position somehow.
        //
        // const BLUE = new THREE.Color(0, 0, 1);
        // const RED = new THREE.Color(1, 0, 0);
        // let arrowColor = new THREE.Color();
        // const normalizedCameraVector = cameraPosition.clone().normalize();
        // let distance = normalizedCameraVector.distanceTo(faceNormal);
        // arrowColor.lerpColors(BLUE, RED, distance / 2);
        // // use it with arrowColor.getHex()

        this.addArrow(faceNormal, midpoint, 10000, COLORS[i % COLORS.length]);
      }
    }
  }

  protected addArrow(dir: THREE.Vector3, origin: THREE.Vector3, size: number, color: number) {
    const arrow = new THREE.ArrowHelper(dir, origin, size, color);
    arrow.renderOrder = 999999999999;
    (<THREE.Material>arrow.line.material).depthTest = false;
    scene.add(arrow);
    this.arrows.push(arrow)
  }
}
