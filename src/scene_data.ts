import * as THREE from "three";
import { Planet } from "./planet";

export { SceneData };

const FIELD_OF_VIEW = 50;
const ROTATION_SPEED = 0.005;
const MIN_VERT_ANGLE = 0.005;
const MAX_VERT_ANGLE = Math.PI - MIN_VERT_ANGLE;

class SceneData {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public planet: Planet;

  protected sphereCoords: THREE.Spherical;
  protected horizDirection: number;
  protected vertDirection: number;

  constructor(width: number, height: number) {
    this.scene = new THREE.Scene();
    this.planet = new Planet(this.scene);
    this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, width / height, 0.1, Planet.radius * 3);
    this.sphereCoords = new THREE.Spherical(this.cameraDistance(), Math.PI / 2, 0)
    this.horizDirection = this.vertDirection = 0;
  }

  updateCameraOnResize(newWidth: number, newHeight: number) {
    this.camera.aspect = newWidth / newHeight;
    this.positionCamera();
    console.log(`Initial position: rad: ${this.sphereCoords.radius}, phi: ${this.sphereCoords.phi}, theta: ${this.sphereCoords.theta}. Position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
  }

  // This will stop being a constant once I implement zooming in and out.
  cameraDistance() {
    return 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / Planet.radius / 1.2);
  }

  update() {
    if (this.horizDirection) {
      this.sphereCoords.theta += ROTATION_SPEED * this.horizDirection;
      this.sphereCoords.theta %= 2 * Math.PI;
      console.log(`Moved horizontally. Rad: ${this.sphereCoords.radius}, phi: ${this.sphereCoords.phi}, theta: ${this.sphereCoords.theta}. Position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
    }

    if (this.vertDirection) {
      this.sphereCoords.phi += ROTATION_SPEED * this.vertDirection;
      // Clamp the vertical angle to just about 0-180 degrees, so we can't go over the pole.
      this.sphereCoords.phi = Math.max(Math.min(this.sphereCoords.phi, MAX_VERT_ANGLE), MIN_VERT_ANGLE);
      console.log(`Moved vertically. Rad: ${this.sphereCoords.radius}, phi: ${this.sphereCoords.phi}, theta: ${this.sphereCoords.theta}. Position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
    }

    if (this.horizDirection || this.vertDirection) {
      this.positionCamera();
    }
  }

  positionCamera() {
    this.camera.position.setFromSpherical(this.sphereCoords);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  // -1 for left, 0 for stop, 1 for right.
  rotateHorizontally(direction: number) {
    this.horizDirection = direction;
  }

  // -1 for down, 0 for stop, 1 for up.
  rotateVertically(direction: number) {
    this.vertDirection = -direction;
  }}
