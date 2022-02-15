import * as THREE from "three";
import { Planet } from "./planet";
import { PlanetCamera } from "./planet_camera";

// This is used so often in so many files that passing it around everywhere became ridiculous.
const scene = new THREE.Scene();

export { SceneData, scene };
class SceneData {
  public light: THREE.PointLight;
  public planet: Planet;
  public camera: PlanetCamera;

  protected horizDirection: number;
  protected vertDirection: number;
  protected zoomDirection: number;

  constructor(width: number, height: number) {
    this.planet = new Planet(width, height);
    this.camera = new PlanetCamera(this.planet, width, height);
    this.horizDirection = this.vertDirection = this.zoomDirection = 0;

    this.light = new THREE.PointLight(0xffffff);
    scene.add(this.light);

    // For now, just a flat background that doesn't move. In the future, maybe it can be a sky-sphere.
    const texture = new THREE.TextureLoader().load('img/star-field.jpg');
    scene.background = texture;

    this.camera.updateOnResize(width, height);
    this.planet.update(this.camera);
    this.moveLightToCamera();
  }

  destroy() {
    this.planet.destroy();
  }

  update() {
    if (this.camera.move(this.horizDirection, this.vertDirection, this.zoomDirection)) {
      this.moveLightToCamera();
      this.planet.update(this.camera);
    }
  }

  // Offset the light slightly from the camera position to make it look a bit more shadowy.
  // FIXME: I'm pretty sure this isn't working.
  moveLightToCamera() {
    let lightLocation = new THREE.Vector3(100, 100, 0);
    this.light.position.copy(lightLocation.unproject(this.camera));
  }

  updateOnResize(width: number, height: number) {
    this.camera.updateOnResize(width, height);
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
