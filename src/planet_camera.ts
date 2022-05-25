import * as THREE from "three";
import { Planet, PLANET_RADIUS } from "./planet";
import { ORIGIN } from "./util";

export { PlanetCamera };

// The camera and planet have to know about each other for a few reasons:
// - The height of the camera above the planet determines the planet mesh's curvature
// - The camera has to know how tall the terrain is below its location so it doesn't zoom inside mountains
// - The number of vertices in the planet mesh is determined by the camera's viewport width and height

const FIELD_OF_VIEW = 50;
const ROTATION_SPEED = 0.02;
const MIN_VERT_ANGLE = 0.005;
const MAX_VERT_ANGLE = Math.PI - MIN_VERT_ANGLE;
const MAX_ZOOM = 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / PLANET_RADIUS / 1.2);
const MIN_ZOOM = PLANET_RADIUS * 1.01;
const ZOOM_SPEED = PLANET_RADIUS / 60;

class PlanetCamera extends THREE.PerspectiveCamera {
  public planet: Planet;
  public sphereCoords: THREE.Spherical;
  public width!: number;
  public height!: number;
  public horizontalRadiansInView!: number;
  public verticalRadiansInView!: number;

  constructor(planet: Planet, viewportWidth: number, viewportHeight: number) {
    super(FIELD_OF_VIEW, viewportWidth / viewportHeight, 0.01, MAX_ZOOM + PLANET_RADIUS);
    this.planet = planet;
    this.sphereCoords = new THREE.Spherical(MAX_ZOOM, Math.PI / 2, 0);
    this.updateOnResize(viewportWidth, viewportHeight);
  }

  updateOnResize(newWidth: number, newHeight: number) {
    this.width = newWidth;
    this.height = newHeight;
    this.aspect = newWidth / newHeight;
    this.planet.resize(newWidth, newHeight);
    this.updateOnMove();
    this.updateOnZoom();
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
      if (zoom) {
        this.updateOnZoom();
      }
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
    return this.distance() - PLANET_RADIUS;
  }

  // This finds the points at which the edges of the screen intersect the planet, ignoring terrain and assuming
  // it's a smooth sphere, and then calculates how many radians of the planet's surface are in the camera's view.
  // We use this to calculate the planet mesh's curvature in Planet.update.
  // This must be called after updateOnMove() because it depends on the new camera position having been saved.
  updateOnZoom() {
    const farPlaneHeight = 2 * Math.tan((this.fov / 2) / (180 / Math.PI)) * this.far;
    const farPlaneWidth = farPlaneHeight * this.aspect;
    // Optimization: Cache these three vectors instead of recalculating them every time we call this method.
    // They'll only ever change when the viewport is resized.
    const topLeftCameraSpace = new THREE.Vector3(-farPlaneWidth / 2, -farPlaneHeight / 2, -this.far);
    const leftCameraSpace = new THREE.Vector3(-farPlaneWidth / 2, 0, -this.far);
    const topCameraSpace = new THREE.Vector3(0, -farPlaneHeight / 2, -this.far);

    // These aren't cacheable because their values change whenever the camera moves.
    const topLeftWorldSpace = topLeftCameraSpace.applyMatrix4(this.matrixWorld);
    const leftWorldSpace = leftCameraSpace.applyMatrix4(this.matrixWorld);
    const topWorldSpace = topCameraSpace.applyMatrix4(this.matrixWorld);

    const topLeftRay = new THREE.Ray(this.position, topLeftWorldSpace.sub(this.position).normalize());
    const leftRay = new THREE.Ray(this.position, leftWorldSpace.sub(this.position).normalize());
    const topRay = new THREE.Ray(this.position, topWorldSpace.sub(this.position).normalize());

    const topLeftIntersection = new THREE.Vector3();
    const leftIntersection = new THREE.Vector3();
    const topIntersection = new THREE.Vector3();

    if (this.intersect(topLeftRay, topLeftIntersection) &&
        this.intersect(leftRay, leftIntersection) &&
        this.intersect(topRay, topIntersection)) {
      this.horizontalRadiansInView = this.greatCircleDistance(topIntersection, topLeftIntersection) * 2;
      this.verticalRadiansInView = this.greatCircleDistance(leftIntersection, topLeftIntersection) * 2;
    } else {
      this.horizontalRadiansInView = Math.PI;
      this.verticalRadiansInView = Math.PI;
    }
  }

  filledByPlanet() {
    return this.horizontalRadiansInView == Math.PI;
  }

  intersect(ray: THREE.Ray, outputVector: THREE.Vector3) {
    return (ray.intersectSphere(this.planet.sphere, outputVector) !== null);
  }

  protected greatCircleDistance(pointA: THREE.Vector3, pointB: THREE.Vector3) {
    return Math.abs(Math.acos(pointA.dot(pointB) / (PLANET_RADIUS ** 2)));
  }
}
