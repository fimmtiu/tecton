import * as THREE from "three";
import { Planet, PLANET_RADIUS } from "./planet";
import { ORIGIN } from "./util";
import { visualHelper } from "./scene_data";

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
  public frustum: THREE.Frustum;

  constructor(planet: Planet, viewportWidth: number, viewportHeight: number) {
    super(FIELD_OF_VIEW, viewportWidth / viewportHeight, 0.01, MAX_ZOOM + PLANET_RADIUS);
    this.planet = planet;
    this.sphereCoords = new THREE.Spherical(MAX_ZOOM, Math.PI / 2, 0);
    this.frustum = new THREE.Frustum();
    visualHelper.camera = this;
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
    // Optimization: Cache these variables instead of recalculating them every time we call this method.
    // They'll only ever change when the viewport is resized.
    const farPlaneHeight = 2 * Math.tan((this.fov / 2) / (180 / Math.PI)) * this.far;
    const farPlaneWidth = farPlaneHeight * this.aspect;
    const leftCameraSpace = new THREE.Vector3(-farPlaneWidth / 2, 0, -this.far);
    const topCameraSpace = new THREE.Vector3(0, farPlaneHeight / 2, -this.far);
    const topLeftCameraSpace = new THREE.Vector3(-farPlaneWidth / 2, farPlaneHeight / 2, -this.far);
    const rotateLeftNinety = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion), -Math.PI / 2);
    const rotateUpNinety = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(this.quaternion), -Math.PI / 2);

    // These aren't cacheable because their values change whenever the camera moves.
    const leftWorldSpace = leftCameraSpace.applyMatrix4(this.matrixWorld);
    const topWorldSpace = topCameraSpace.applyMatrix4(this.matrixWorld);
    const topLeftWorldSpace = topLeftCameraSpace.applyMatrix4(this.matrixWorld);
    const topLeftDirection = topLeftWorldSpace.clone().sub(this.position).normalize();

    const leftRay = new THREE.Ray(this.position, leftWorldSpace.sub(this.position).normalize());
    const topRay = new THREE.Ray(this.position, topWorldSpace.sub(this.position).normalize());

    const leftIntersection = new THREE.Vector3();
    const topIntersection = new THREE.Vector3();

    // FIXME: There's a certain amount of pop-in happening as soon as the edge of the sphere passes the screen edge
    // because the number of vertices around the sphere's edge is so high and lots of radians get cut off at once.
    // Not sure how to fix this — the math is correct. Stupid spheres and their stupid curvature.
    // Hopefully distributing the vertices more densely in the center of the mesh will make it less noticeable.
    if (this.intersect(leftRay, leftIntersection)) {
      // Find the topmost point where the left side of the sphere intersects the left plane of the camera's view frustum.
      const leftPlaneNormal = topLeftDirection.clone().cross(leftRay.direction).normalize();
      const rotatedIntersection = this.sideOfIntersectionCircle(leftIntersection, leftPlaneNormal);

      const polarPoint = this.furthestVisiblePoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
      this.horizontalRadiansInView = this.greatCircleDistance(rotatedIntersection, polarPoint) * 2;
    } else {
      this.horizontalRadiansInView = Math.PI;
    }

    if (this.intersect(topRay, topIntersection)) {
      // Find the leftmost point where the top side of the sphere intersects the top plane of the camera's view frustum.
      const topPlaneNormal = topLeftDirection.clone().cross(topRay.direction).normalize();
      const rotatedIntersection = this.sideOfIntersectionCircle(topIntersection, topPlaneNormal);

      const leftEquatorPoint = this.furthestVisiblePoint(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
      this.verticalRadiansInView = this.greatCircleDistance(rotatedIntersection, leftEquatorPoint) * 2;

      // FIXME for debugging
      visualHelper.setPoints("sphere intersections", [topIntersection, leftEquatorPoint, rotatedIntersection], true);
      const fovAngle = (this.fov / 2) * (Math.PI / 180);
      const distanceToIntersection = topIntersection.distanceTo(this.position);
      visualHelper.showCamera(distanceToIntersection * Math.cos(fovAngle));
      visualHelper.addArrow("camera to left", this.position, leftEquatorPoint, 0xffff00);
      // FIXME end debugging

    } else {
      this.verticalRadiansInView = Math.PI;
      visualHelper.setPoints("sphere intersections", []);
    }
    console.log(`Horizontal radians in view: ${this.horizontalRadiansInView}, vertical radians in view: ${this.verticalRadiansInView}`);

    this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.projectionMatrix, this.matrixWorldInverse));
  }

  intersect(ray: THREE.Ray, outputVector: THREE.Vector3) {
    return (ray.intersectSphere(this.planet.sphere, outputVector) !== null);
  }

  // This is a bit obtuse, but the radians in view are calculated from the side of the sphere, not the front, since the
  // edge has a much longer visible distance than the point closer to the camera where we encountered the intersection.
  // Finding the intersection between the edge of the sphere and the camera's view frustum is a pain in the ass because
  // the frustum intersects the sphere at an angle. (Don't worry, I don't fully understand this math either.)

  protected sideOfIntersectionCircle(intersection: THREE.Vector3, planeNormal: THREE.Vector3) {
    const centerToIntersection = intersection.clone().sub(ORIGIN);
    const distanceFromOriginToPlane = centerToIntersection.dot(planeNormal);
    const circleCenter = planeNormal.clone().multiplyScalar(distanceFromOriginToPlane);
    const circleRadius = Math.sqrt(PLANET_RADIUS ** 2 - distanceFromOriginToPlane ** 2);
    const radialDirection = intersection.clone().sub(circleCenter).normalize();
    const perpendicularDirection = planeNormal.clone().cross(radialDirection).normalize();
    return circleCenter.clone().add(perpendicularDirection.multiplyScalar(circleRadius));
  }

  // vert:
  // furthestVisiblePoint(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0))

  // horiz:
  // furthestVisiblePoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0))
  protected furthestVisiblePoint(side: THREE.Vector3, axis: THREE.Vector3) {
    const cameraSide = side.clone().applyQuaternion(this.quaternion).normalize();
    const cameraSideRay = new THREE.Ray(this.position, cameraSide);
    const intersection = new THREE.Vector3();
    if (this.intersect(cameraSideRay, intersection)) {
      return intersection;
    }

    const rotateNinetyDegrees = new THREE.Quaternion().setFromAxisAngle(axis.clone().applyQuaternion(this.quaternion), -Math.PI / 2);
    const equatorPoint = this.position.clone().normalize().multiplyScalar(PLANET_RADIUS).applyQuaternion(rotateNinetyDegrees);
    cameraSideRay.lookAt(equatorPoint);
    if (this.intersect(cameraSideRay, intersection)) {
      return intersection;
    }

    throw new Error("WTF? No intersection found");
  }

  protected greatCircleDistance(pointA: THREE.Vector3, pointB: THREE.Vector3) {
    return Math.abs(Math.acos(pointA.dot(pointB) / (PLANET_RADIUS ** 2)));
  }
}
