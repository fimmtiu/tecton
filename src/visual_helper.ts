import * as THREE from "three";
import { Planet } from "./planet";
import { ORIGIN } from "./util";

export { VisualHelper };

const COLORS = [0xffae00, 0x00ffff, 0xff1e00, 0xc800ff]; // orange, aqua, red, purple
const BLUE = new THREE.Color(0, 0, 1);
const RED = new THREE.Color(1, 0, 0);

class VisualHelper {
  protected scene: THREE.Scene;
  protected pointVectors: Array<THREE.Vector3>;
  protected normalMeshes: Array<THREE.Mesh>;
  protected points: Array<THREE.Points>;
  protected arrows: Array<THREE.ArrowHelper>;
  protected axes: THREE.AxesHelper | null;
  public showArrows: boolean;
  public showAxes: boolean;

  constructor(scene: THREE.Scene, showArrows = false, showAxes = false) {
    this.scene = scene;
    this.pointVectors = [];
    this.normalMeshes = [];
    this.points = [];
    this.arrows = [];
    this.axes = null;
    this.showArrows = showArrows;
    this.showAxes = showAxes;
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
        this.addArrow(points[i].clone().normalize(), ORIGIN, Planet.radius + 2000, color);
      }
    }

    for (let i = 0; i < this.normalMeshes.length; i++) {
      // FIXME: For each triangle in the mesh, find the center and normal, then do this:
      //     this.addArrow(normal, center, Planet.radius, COLORS[i % COLORS.length]);
      //
      // Steal this code from the comment in util.ts.

      let positions = this.normalMeshes[i].geometry.attributes.position;
      let index = this.normalMeshes[i].geometry.index;
      if (index === null) {
        throw "not indexed, wtf?";
      }
      let a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let faceNormal = new THREE.Vector3(), midpoint = new THREE.Vector3();
      let triangle = new THREE.Triangle();

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
        // let arrowColor = new THREE.Color();
        // const normalizedCameraVector = cameraPosition.clone().normalize();
        // let distance = normalizedCameraVector.distanceTo(faceNormal);
        // arrowColor.lerpColors(blue, red, distance / 2);
        // // use it with arrowColor.getHex()

        this.addArrow(faceNormal, midpoint, 10000, COLORS[i % COLORS.length]);
      }
    }
  }

  protected addArrow(dir: THREE.Vector3, origin: THREE.Vector3, size: number, color: number) {
    const arrow = new THREE.ArrowHelper(dir, origin, size, color);
    arrow.renderOrder = 999999999999;
    (<THREE.Material>arrow.line.material).depthTest = false;
    this.scene.add(arrow);
    this.arrows.push(arrow)
  }
}