import * as THREE from "three";
import { Planet } from "./planet";

export { SceneData };

const FIELD_OF_VIEW = 50;
const ROTATION_SPEED = 0.005;

class SceneData {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public planet: Planet;
  protected rotateSpeed: number;

  constructor(width: number, height: number) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, width / height, 0.1, 1000);
    this.planet = new Planet(this.scene);
    this.rotateSpeed = 0;
  }

  updateCamera(newWidth: number, newHeight: number) {
    this.camera.aspect = newWidth / newHeight;
    const distance = 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / Planet.radius / 1.2);
    this.camera.position.z = distance;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.planet.rotate(this.rotateSpeed);
  }

  // -1 for left, 0 for stop, 1 for right.
  rotate(direction: number) {
    this.rotateSpeed = direction * ROTATION_SPEED;
  }
}
