import * as THREE from "three";
import { PLANET_RADIUS } from "./planet";
import { ORIGIN } from "./util";
import { disposeMesh, vectorsToFloatBuffer } from "./util/geometry";
import { scene } from "./scene_data";
import { PlanetCamera } from "./planet_camera";

export { VisualHelper, COLORS };

const COLORS = [0xffae00, 0x00ffff, 0xff1e00, 0xc800ff, 0x0000ff, 0x00ff00]; // orange, aqua, red, purple, blue, green

class VisualHelper {
  public camera!: PlanetCamera;
  protected normalMeshes: Array<THREE.Mesh>;
  protected normalArrows: Array<THREE.ArrowHelper>;
  protected points: { [name: string]: Array<THREE.Points> };
  protected pointArrows: { [name: string]: Array<THREE.ArrowHelper> };
  protected otherArrows: { [name: string]: THREE.ArrowHelper };
  protected cameraMesh: THREE.LineSegments | null;
  protected cameraArrow: THREE.ArrowHelper | null;
  protected axes: THREE.AxesHelper | null;
  public allowUpdates = true;

  constructor() {
    this.normalMeshes = [];
    this.normalArrows = [];
    this.points = {};
    this.pointArrows = {};
    this.otherArrows = {};
    this.cameraMesh = null;
    this.cameraArrow = null;
    this.axes = null;
  }

  destroy() {
    this.hideAxes();
    this.showNormals([]);
    this.hideCamera();

    for (const name of Object.keys(this.points)) {
      this.setPoints(name, []);
    }
    for (const name of Object.keys(this.otherArrows)) {
      this.removeArrow(name);
    }
  }

  showAxes() {
    if (this.allowUpdates) {
      if (this.axes) {
        disposeMesh(this.axes);
      }
      this.axes = new THREE.AxesHelper(PLANET_RADIUS + 2000);
      this.axes.renderOrder = 99999999999;
      (<THREE.Material>this.axes.material).depthTest = false;
      scene.add(this.axes);
    }
  }

  hideAxes() {
    if (this.allowUpdates && this.axes) {
      disposeMesh(this.axes);
      this.axes = null;
    }
  }

  showNormals(meshes: Array<THREE.Mesh>) {
    if (this.allowUpdates) {
      for (const mesh of this.normalMeshes) {
        disposeMesh(mesh);
      }
      for (const arrow of this.normalArrows) {
        scene.remove(arrow);
      }
      this.normalArrows = [];
      this.normalMeshes = meshes;
      for (let i = 0; i < this.normalMeshes.length; i++) {
        this.drawMeshNormals(this.normalMeshes[i], COLORS[i % COLORS.length]);
      }
    }
  }

  setPoints(name: string, points: Array<THREE.Vector3>, showArrows = false) {
    if (this.allowUpdates) {
      if (this.points[name]) {
        for (const point of this.points[name]) {
          disposeMesh(point);
        }
        delete this.points[name];

        for (const arrow of this.pointArrows[name]) {
          scene.remove(arrow);
        }
        delete this.pointArrows[name];
      }

      if (points.length > 0) {
        this.pointArrows[name] = [];
        this.points[name] = [];

        for (let i = 0; i < points.length; i++) {
          const color = COLORS[i % COLORS.length];
          this.drawPoint(name, points[i], color, showArrows);
        }
      }
    }
  }

  addArrow(name: string, start: THREE.Vector3, end: THREE.Vector3, color: number) {
    if (this.allowUpdates) {
      this.removeArrow(name);

      const dir = end.clone().sub(start.clone()).normalize()
      this.otherArrows[name] = this.makeArrow(dir, start, start.distanceTo(end), color);
    }
  }

  removeArrow(name: string) {
    if (this.allowUpdates) {
      if (this.otherArrows[name]) {
        scene.remove(this.otherArrows[name]);
        delete this.otherArrows[name];
      }
    }
  }

  showCamera(farPlaneDistance = -1) {
    if (this.allowUpdates) {
      this.hideCamera();

      if (farPlaneDistance < 0) {
        farPlaneDistance = 2000;
      }
      this.cameraArrow = this.makeArrow(this.camera.position.clone().normalize().negate(), this.camera.position, farPlaneDistance / 2, 0xff0000);
      const materials = [
        new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false }), // frustum lines
        new THREE.MeshBasicMaterial({ color: 0x0000ff, depthTest: false }), // far plane
      ];

      // Get the 2D view bounds at the far plane distance
      const minTarget = new THREE.Vector2();
      const maxTarget = new THREE.Vector2();
      this.camera.getViewBounds(farPlaneDistance, minTarget, maxTarget);

      // Convert 2D bounds to 3D world coordinates
      // minTarget is lower-left (x=left, y=bottom), maxTarget is upper-right (x=right, y=top)
      const cameraDir = this.camera.getWorldDirection(new THREE.Vector3());
      const baseCenter = this.camera.position.clone().add(cameraDir.multiplyScalar(farPlaneDistance));
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();

      const topLeft = baseCenter.clone()
        .add(right.clone().multiplyScalar(minTarget.x))
        .add(up.clone().multiplyScalar(maxTarget.y));
      const topRight = baseCenter.clone()
        .add(right.clone().multiplyScalar(maxTarget.x))
        .add(up.clone().multiplyScalar(maxTarget.y));
      const bottomRight = baseCenter.clone()
        .add(right.clone().multiplyScalar(maxTarget.x))
        .add(up.clone().multiplyScalar(minTarget.y));
      const bottomLeft = baseCenter.clone()
        .add(right.clone().multiplyScalar(minTarget.x))
        .add(up.clone().multiplyScalar(minTarget.y));

      const vertices = [
        // edges from tip to corners
        this.camera.position, topLeft,    // edge 1
        this.camera.position, topRight,   // edge 2
        this.camera.position, bottomRight,// edge 3
        this.camera.position, bottomLeft, // edge 4

        // base of pyramid
        topLeft, topRight,
        topRight, bottomRight,
        bottomRight, bottomLeft,
        bottomLeft, topLeft,
      ];

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", vectorsToFloatBuffer(vertices));
      geometry.addGroup(0, vertices.length / 2, 0);
      geometry.addGroup(vertices.length / 2, vertices.length / 2, 1);

      this.cameraMesh = new THREE.LineSegments(geometry, materials);
      this.cameraMesh.renderOrder = 99999999999;
      scene.add(this.cameraMesh);
    }
  }

  hideCamera() {
    if (this.allowUpdates) {
      if (this.cameraMesh) {
        disposeMesh(this.cameraMesh);
      }
      if (this.cameraArrow) {
        scene.remove(this.cameraArrow);
      }
      this.cameraMesh = null;
      this.cameraArrow = null;
    }
  }

  protected drawPoint(name: string, point: THREE.Vector3, color: number, showArrows = false) {
    const points_geometry = new THREE.BufferGeometry();
    const point_location = new THREE.Float32BufferAttribute([point.x, point.y, point.z], 3);
    points_geometry.setAttribute("position", point_location);
    const points_material = new THREE.PointsMaterial({ color: color, size: 250, depthTest: false });
    const pointMesh = new THREE.Points(points_geometry, points_material);
    pointMesh.renderOrder = 99999999999;
    scene.add(pointMesh);
    this.points[name] ||= [];
    this.points[name].push(pointMesh);

    if (showArrows) {
      this.pointArrows[name] ||= [];
      this.pointArrows[name].push(this.makeArrow(point.clone().normalize(), ORIGIN, PLANET_RADIUS + 2000, color));
    }
  }

  protected drawMeshNormals(mesh: THREE.Mesh, color: number) {
    const positions = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    if (index === null) {
      throw "not indexed, wtf?";
    }
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const faceNormal = new THREE.Vector3(), midpoint = new THREE.Vector3();
    const triangle = new THREE.Triangle();

    for (let i = 0; i < index.count; i++) {
      a.fromBufferAttribute(positions, index.getX((i * 3) + 0));
      b.fromBufferAttribute(positions, index.getX((i * 3) + 1));
      c.fromBufferAttribute(positions, index.getX((i * 3) + 2));
      triangle.set(a, b, c);
      triangle.getNormal(faceNormal);
      triangle.getMidpoint(midpoint);

      // Here's some pseudocode to change the arrow color based on whether the normal is pointing towards or away from
      // the camera (red = away, blue = towards).

      // const BLUE = new THREE.Color(0, 0, 1);
      // const RED = new THREE.Color(1, 0, 0);
      // let arrowColor = new THREE.Color();
      // const normalizedCameraVector = this.camera.position.clone().normalize();
      // let distance = normalizedCameraVector.distanceTo(faceNormal);
      // arrowColor.lerpColors(BLUE, RED, distance / 2);

      this.normalArrows.push(this.makeArrow(faceNormal, midpoint, 10000, color));
    }
  }

  protected makeArrow(dir: THREE.Vector3, origin: THREE.Vector3, size: number, color: number) {
    const arrow = new THREE.ArrowHelper(dir, origin, size, color);
    arrow.renderOrder = 999999999999;
    (<THREE.Material>arrow.line.material).depthTest = false;
    scene.add(arrow);
    return arrow;
  }
}
