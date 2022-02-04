import * as THREE from "three";
import { Planet } from "./planet";

export { SceneData };

const FIELD_OF_VIEW = 50;
const ROTATION_SPEED = 0.008;
const MIN_VERT_ANGLE = 0.005;
const MAX_VERT_ANGLE = Math.PI - MIN_VERT_ANGLE;
const MAX_ZOOM = 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / Planet.radius / 1.2);
const MIN_ZOOM = Planet.radius * 1.2;
const ZOOM_SPEED = Planet.radius / 100;

class SceneData {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public light: THREE.PointLight;
  public planet: Planet;

  protected sphereCoords: THREE.Spherical;
  protected horizDirection: number;
  protected vertDirection: number;
  protected zoomDirection: number;

  constructor(width: number, height: number) {
    this.scene = new THREE.Scene();
    this.planet = new Planet(this.scene);
    this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, width / height, 0.1, MAX_ZOOM + Planet.radius);
    this.sphereCoords = new THREE.Spherical(MAX_ZOOM, Math.PI / 2, 0)
    this.horizDirection = this.vertDirection = this.zoomDirection = 0;

    this.light = new THREE.PointLight(0xffffff);
    this.scene.add(this.light);

    // For now, just a flat background that doesn't move. In the future, maybe it can be a sky-sphere.
    const texture = new THREE.TextureLoader().load('img/star-field.jpg');
    this.scene.background = texture;
  }

  updateCameraOnResize(newWidth: number, newHeight: number) {
    this.camera.aspect = newWidth / newHeight;
    this.positionCamera();
    console.log(`Initial position: rad: ${this.sphereCoords.radius}, phi: ${this.sphereCoords.phi}, theta: ${this.sphereCoords.theta}. Position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
  }

  update() {
    if (this.horizDirection) {
      this.sphereCoords.theta += ROTATION_SPEED * this.horizDirection;
      this.sphereCoords.theta %= 2 * Math.PI;
    }

    if (this.vertDirection) {
      this.sphereCoords.phi += ROTATION_SPEED * -this.vertDirection;
      // Clamp the vertical angle to just about 0-180 degrees, so we can't go over the pole.
      this.sphereCoords.phi = Math.max(Math.min(this.sphereCoords.phi, MAX_VERT_ANGLE), MIN_VERT_ANGLE);
    }

    if (this.zoomDirection) {
      this.sphereCoords.radius += ZOOM_SPEED * -this.zoomDirection;
      this.sphereCoords.radius = Math.max(Math.min(this.sphereCoords.radius, MAX_ZOOM), MIN_ZOOM);
    }

    if (this.horizDirection || this.vertDirection || this.zoomDirection) {
      console.log(`Moved. Rad: ${this.sphereCoords.radius}, phi: ${this.sphereCoords.phi}, theta: ${this.sphereCoords.theta}. Position: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
      this.positionCamera();
    }
  }

  private positionCamera() {
    this.camera.position.setFromSpherical(this.sphereCoords);
    this.camera.lookAt(0, 0, 0);

    // Offset the light slightly from the camera position to make it look a bit more shadowy.
    let lightLocation = new THREE.Vector3(100, 100, 0);
    this.light.position.copy(lightLocation.unproject(this.camera));

    this.camera.updateProjectionMatrix();
  }

  // -1 for left, 0 for stop, 1 for right.
  rotateHorizontally(direction: number) {
    this.horizDirection = direction;
  }

  // -1 for down, 0 for stop, 1 for up.
  rotateVertically(direction: number) {
    this.vertDirection = direction;
  }

  // -1 for zoom-out, 0 for stop, 1 for zoom-in.
  zoom(direction: number) {
    this.zoomDirection = direction;
  }
}
