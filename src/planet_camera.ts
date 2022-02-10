import * as THREE from "three";
import { Planet } from "./planet";
import { ORIGIN } from "./util";

export { PlanetCamera };

// The camera and planet have to know about each other for a few reasons:
// - The height of the camera above the planet determines the planet mesh's curvature
// - The camera has to know how tall the terrain is below its location so it doesn't zoom inside mountains
// - The number of vertices in the planet mesh is determined by the camera's viewport width and height

const FIELD_OF_VIEW = 50;
const ROTATION_SPEED = 0.008;
const MIN_VERT_ANGLE = 0.005;
const MAX_VERT_ANGLE = Math.PI - MIN_VERT_ANGLE;
const MAX_ZOOM = 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / Planet.radius / 1.2);
const MIN_ZOOM = Planet.radius * 1.2;
const ZOOM_SPEED = Planet.radius / 100;

class PlanetCamera extends THREE.PerspectiveCamera {
  public width: number;
  public height: number;
  public sphereCoords: THREE.Spherical;
  public planet: Planet;

  constructor(planet: Planet, viewportWidth: number, viewportHeight: number) {
    super(FIELD_OF_VIEW, viewportWidth / viewportHeight, 0.1, MAX_ZOOM + Planet.radius);
    this.width = viewportWidth;
    this.height = viewportHeight;
    this.sphereCoords = new THREE.Spherical(MAX_ZOOM, Math.PI / 2, 0)
    this.planet = planet;
    this.updateOnResize(viewportWidth, viewportHeight);
  }

  updateOnResize(newWidth: number, newHeight: number) {
    this.width = newWidth;
    this.height = newHeight;
    this.aspect = newWidth / newHeight;
    this.updateOnMove();
    console.log(`Initial position: rad: ${this.sphereCoords.radius}, phi: ${this.sphereCoords.phi}, theta: ${this.sphereCoords.theta}. Position: (${this.position.x}, ${this.position.y}, ${this.position.z})`);
  }

  protected updateOnMove() {
    this.updateProjectionMatrix();
    this.position.setFromSpherical(this.sphereCoords);
    this.lookAt(ORIGIN);
  }

  // Returns true if the camera moved during this call, false otherwise.
  move(horizontal: number, vertical: number, zoom: number) {
    if (horizontal) {
      this.sphereCoords.theta += ROTATION_SPEED * horizontal;
      this.sphereCoords.theta %= 2 * Math.PI;
    }

    if (vertical) {
      this.sphereCoords.phi += ROTATION_SPEED * -vertical;
      // Clamp the vertical angle to just about 0-180 degrees, so we can't go over the pole.
      this.sphereCoords.phi = THREE.MathUtils.clamp(this.sphereCoords.phi, MIN_VERT_ANGLE, MAX_VERT_ANGLE);
    }

    if (zoom) {
      const lowestHeight = Math.max(MIN_ZOOM, this.heightAboveTerrain());
      this.sphereCoords.radius += ZOOM_SPEED * -zoom;
      this.sphereCoords.radius = THREE.MathUtils.clamp(this.sphereCoords.radius, lowestHeight, MAX_ZOOM);
    }

    if (horizontal || vertical || zoom) {
      this.updateOnMove();
      return true;
    }

    return false;
  }

  containsPoint(point: THREE.Vector3) {
    let cameraFrustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(this.projectionMatrix, this.matrixWorldInverse)
    cameraFrustum.setFromProjectionMatrix(matrix)
    return cameraFrustum.containsPoint(point);
  }

  distance() {
    return this.position.distanceTo(ORIGIN);
  }

  heightAboveTerrain() {
    // FIXME: Change "Planet.radius" to the actual terrain height.
    // Right now we're assuming the planet is a smooth sphere.
    return this.distance() - Planet.radius;
  }
}

