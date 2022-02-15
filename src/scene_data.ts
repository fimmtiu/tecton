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

    // For now, just a flat background that doesn't move. In the future, maybe it can be a sky-sphere.
    const texture = new THREE.TextureLoader().load('img/star-field.jpg');
    scene.background = texture;

    this.camera.updateOnResize(width, height);
    this.planet.update(this.camera);

    // FIXME: Replace this with a more shadowy, realistic-looking light source at some point.
    this.light = new THREE.PointLight(0xffffff);
    this.light.position.copy(this.camera.position);
    this.camera.add(this.light);
    scene.add(this.camera);
  }

  destroy() {
    this.planet.destroy();
    this.light.dispose();
  }

  update() {
    if (this.camera.move(this.horizDirection, this.vertDirection, this.zoomDirection)) {
      this.planet.update(this.camera);
    }
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
