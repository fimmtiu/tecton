import * as THREE from "three";
import { Planet } from "./planet";
import { v2s, s2s, ORIGIN } from "./util";

export { PlanetCamera };

// The camera and planet have to know about each other for a few reasons:
// - The height of the camera above the planet determines the planet mesh's curvature
// - The camera has to know how tall the terrain is below its location so it doesn't zoom inside mountains
// - The number of vertices in the planet mesh is determined by the camera's viewport width and height

const FIELD_OF_VIEW = 50;
const ROTATION_SPEED = 0.01;
const MIN_VERT_ANGLE = 0.005;
const MAX_VERT_ANGLE = Math.PI - MIN_VERT_ANGLE;
const MAX_ZOOM = 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / Planet.radius / 1.2);
const MIN_ZOOM = Planet.radius * 1.01;
const ZOOM_SPEED = Planet.radius / 60;

class PlanetCamera extends THREE.PerspectiveCamera {
  public width: number;
  public height: number;
  public sphereCoords: THREE.Spherical;
  public planet: Planet;

  constructor(planet: Planet, viewportWidth: number, viewportHeight: number) {
    super(FIELD_OF_VIEW, viewportWidth / viewportHeight, 0.01, MAX_ZOOM + Planet.radius);
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
    console.log(`Initial position: ${s2s(this.sphereCoords)}. Position: ${v2s(this.position)}`);
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

  distance() {
    return this.position.distanceTo(ORIGIN);
  }

  heightAboveTerrain() {
    // FIXME: Get actual terrain height.
    return this.heightAboveSeaLevel();
  }

  heightAboveSeaLevel() {
    return this.distance() - Planet.radius;
  }

  // We use this to calculate the planet's curvature. This finds the points at which the edges of the screen
  // intersect the planet, ignoring terrain and assuming it's a smooth sphere.
  copyPlanetIntersectionPoints(outputTopLeft: THREE.Vector3, outputBottomRight: THREE.Vector3) {
    const farPlaneHeight = 2 * Math.tan((this.fov / 2) / (180 / Math.PI)) * this.far;
    const farPlaneWidth = farPlaneHeight * this.aspect;
    // Optimization: Cache these two vectors instead of recalculating them every time we call this method.
    // They'll only ever change when the viewport is resized.
    const topLeftCameraSpace = new THREE.Vector3(-farPlaneWidth / 2, farPlaneHeight / 2, -this.far);
    const bottomRightCameraSpace = new THREE.Vector3(farPlaneWidth / 2, -farPlaneHeight / 2, -this.far);

    // These are less cacheable because their values change whenever the camera moves.
    const topLeftWorldSpace = topLeftCameraSpace.applyMatrix4(this.matrixWorld);
    const bottomRightWorldSpace = bottomRightCameraSpace.applyMatrix4(this.matrixWorld);

    const topLeftRay = new THREE.Ray(this.position, topLeftWorldSpace.sub(this.position).normalize());
    const bottomRightRay = new THREE.Ray(this.position, bottomRightWorldSpace.sub(this.position).normalize());

    return this.intersect(topLeftRay, outputTopLeft) && this.intersect(bottomRightRay, outputBottomRight);
  }

  intersect(ray: THREE.Ray, outputVector: THREE.Vector3) {
    return (ray.intersectSphere(this.planet.sphere, outputVector) !== null);
  }
}

