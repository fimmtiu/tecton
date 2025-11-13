import * as THREE from "three";
import { Planet } from "./planet";
import { PlanetCamera } from "./planet_camera";
import { TextureManager } from "./texture_manager";
import { VisualHelper } from "./visual_helper";

// This is used so often in so many files that passing it around everywhere became ridiculous.
const scene = new THREE.Scene();
let visualHelper!: VisualHelper;

export { SceneData, scene, visualHelper };

class SceneData {
  public light: THREE.PointLight;
  public planet: Planet;
  public camera: PlanetCamera;

  protected horizDirection: number;
  protected vertDirection: number;
  protected zoomDirection: number;

  constructor(width: number, height: number) {
    this.planet = new Planet(width, height);
    visualHelper = new VisualHelper();
    this.camera = new PlanetCamera(this.planet, width, height);
    // visualHelper.showAxes();
    this.horizDirection = this.vertDirection = this.zoomDirection = 0;

    // For now, just a flat background that doesn't move. In the future, maybe it can be a sky-sphere.
    scene.background = TextureManager.textures["star-field.jpg"];

    this.camera.updateOnResize(width, height);

    // FIXME: Replace this with a more shadowy, realistic-looking light source at some point.
    this.light = new THREE.PointLight(0xffffff, 1000000000);
    this.light.position.copy(this.camera.position);
    this.camera.add(this.light);
    scene.add(this.camera);
    this.planet.update(this.camera);
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
    this.planet.update(this.camera);
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

  dataAtPoint(screenX: number, screenY: number) {
    const worldPos = new THREE.Vector3();
    const ray = new THREE.Ray();

    ray.origin.setFromMatrixPosition(this.camera.matrixWorld);
    ray.direction.set(screenX, screenY, 0.5).unproject(this.camera).sub(ray.origin).normalize();

    if (this.camera.intersect(ray, worldPos)) {
      return this.planet.dataAtPoint(worldPos);
    }
    return null;
  }
}
