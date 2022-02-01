import * as THREE from "three";
import { Planet } from "./planet";

export { SceneData };

const FIELD_OF_VIEW = 50;
const ROTATION_SPEED = 0.005;
const MAX_VERT_ANGLE = Math.PI / 2 - 0.005;

class SceneData {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public planet: Planet;

  protected orbitAngleH: number;
  protected orbitAngleV: number;
  protected horizDirection: number;
  protected vertDirection: number;

  constructor(width: number, height: number) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, width / height, 0.1, 1000);
    this.planet = new Planet(this.scene);
    this.orbitAngleH = this.orbitAngleV = 0;
    this.horizDirection = this.vertDirection = 0;
  }

  updateCamera(newWidth: number, newHeight: number) {
    this.camera.aspect = newWidth / newHeight;
    this.camera.position.z = this.cameraDistance();
    this.camera.updateProjectionMatrix();
    console.log(`Initial position: H angle: ${this.orbitAngleH}. V angle: ${this.orbitAngleV}. Position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
  }

  // This will stop being a constant once I implement zooming in and out.
  cameraDistance() {
    return 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / Planet.radius / 1.2);
  }

  update() {
    let horizNewZ = 0, vertNewZ = 0;

    if (this.horizDirection) {
      this.orbitAngleH += ROTATION_SPEED * this.horizDirection;
      this.orbitAngleH %= 2 * Math.PI;
      const latitudeDistance = Math.cos(this.orbitAngleV) * this.cameraDistance();
      this.camera.position.x = Math.sin(this.orbitAngleH) * latitudeDistance;
      horizNewZ = Math.cos(this.orbitAngleH) * latitudeDistance;
      console.log(`Moved horizontally. H angle: ${this.orbitAngleH}. New position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
    }

    if (this.vertDirection) {
      this.orbitAngleV += ROTATION_SPEED * this.vertDirection;
      // Clamp the vertical angle to just shy of 90 degrees, so we can't go over the pole.
      this.orbitAngleV = Math.max(Math.min(this.orbitAngleV, MAX_VERT_ANGLE), -MAX_VERT_ANGLE);
      const longitudeDistance = Math.cos(this.orbitAngleH) * this.cameraDistance();
      this.camera.position.y = Math.sin(this.orbitAngleV) * longitudeDistance;
      vertNewZ = Math.cos(this.orbitAngleV) * longitudeDistance;
      console.log(`Moved vertically. V angle: ${this.orbitAngleV}. New position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
    }

    // Both the horizontal and vertical rotations want to change the Z coordinate, so if they're both active at once
    // then we have to average the results to prevent the vertical Z from overwriting the horizontal Z.
    if (this.horizDirection || this.vertDirection) {
      if (this.horizDirection && !this.vertDirection) {
        this.camera.position.z = horizNewZ;
      } else if (this.vertDirection && !this.horizDirection) {
        this.camera.position.z = vertNewZ;
      } else {
        this.camera.position.z = (horizNewZ + vertNewZ) / 2;
      }
      this.camera.lookAt(0, 0, 0);
      this.camera.updateProjectionMatrix();
    }
  }

  // -1 for left, 0 for stop, 1 for right.
  rotateHorizontally(direction: number) {
    this.horizDirection = direction;
  }

  // -1 for down, 0 for stop, 1 for up.
  rotateVertically(direction: number) {
    this.vertDirection = direction;
  }}
