import * as THREE from "three";
import { Vector3 } from "three";
import { PlanetCamera } from "./planet_camera";
import { getWorldVertexFromMesh, noiseGenerator, updateGeometry, ORIGIN, sphericalFromCoords } from "./util";
import { VisualHelper } from "./visual_helper";

export { Planet };

const PIXELS_BETWEEN_VERTICES = 10;

class Planet {
  static readonly radius = 6370; // each unit is 1 kilometer

  public sphere: THREE.Sphere;
  protected scene: THREE.Scene;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments | null;
  protected visualHelper: VisualHelper;
  protected meshCorners!: THREE.Mesh;
  protected horizontalVertices!: number;
  protected verticalVertices!: number;
  protected flatten: boolean;
  protected fillsCamera: boolean;

  constructor(scene: THREE.Scene, viewportWidth: number, viewportHeight: number) {
    this.sphere = new THREE.Sphere(ORIGIN, Planet.radius);
    this.scene = scene;
    this.mesh = new THREE.Mesh();
    this.visualHelper = new VisualHelper(scene, true, true);
    this.meshCorners = new THREE.Mesh();
    this.flatten = false;
    this.fillsCamera = true;

    this.resize(viewportWidth, viewportHeight);

    this.edges = new THREE.LineSegments();
    this.toggleEdgesVisible();
  }

  resize(width: number, height: number) {
    this.destroy();

    this.horizontalVertices = Math.ceil(width / PIXELS_BETWEEN_VERTICES) + 2;
    this.verticalVertices = Math.ceil(height / PIXELS_BETWEEN_VERTICES) + 2;

    console.log(`New mesh: ${this.horizontalVertices} x ${this.verticalVertices} vertices.`);
    let geometry = new THREE.PlaneGeometry(
      width * 12, height * 12,
      this.horizontalVertices - 1, this.verticalVertices - 1,
    );
    const positions = geometry.attributes.position;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3));

    let material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.FrontSide });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    const topLeft = new THREE.Vector3().setFromSphericalCoords(Planet.radius, Math.PI / 4, Math.PI * 1.5);
    const bottomRight = new THREE.Vector3().setFromSphericalCoords(Planet.radius, Math.PI * (3 / 4), Math.PI / 2);
    const bottomLeft = new THREE.Vector3().setFromSphericalCoords(Planet.radius, Math.PI * (3 / 4), Math.PI * 1.5);
    const corners_geometry = new THREE.BufferGeometry().setFromPoints([topLeft, bottomRight, bottomLeft]);
    corners_geometry.setIndex(new THREE.Uint16BufferAttribute([2, 1, 0], 1));
    this.meshCorners = new THREE.Mesh(corners_geometry);
    this.mesh.add(this.meshCorners);
    this.meshCorners.visible = false;
  }

  destroy() {
    this.scene.remove(this.mesh);
    (<THREE.Material>this.mesh.material).dispose();
    this.mesh.geometry.dispose();

    (<THREE.Material>this.meshCorners.material).dispose();
    this.meshCorners.geometry.dispose();

    if (this.edges) {
      this.toggleEdgesVisible();
    }
  }

  update(camera: PlanetCamera) {
    // Change the curvature of the planet mesh, if necessary.
    // FIXME: Later, try doing this with a vertex shader instead.
    if (this.cornersInView(camera)) {
      console.log("corners in view");
      if (this.fillsCamera) {
        console.log("switching from sector to hemisphere");
        this.deformPlaneIntoHemisphere();
        this.fillsCamera = false;
      }
    } else {
      console.log("corners NOT in view");
      if (!this.fillsCamera) {
        console.log("switching from hemisphere to sector");
      }
      this.deformPlaneIntoSector(camera);
      this.fillsCamera = true;
    }

    // Make the planet mesh and all of its child meshes turn to look at the new camera position.
    this.mesh.lookAt(camera.position);

    // FIXME: Once we're no longer using vertex colors we can move this into the 'deform' methods,
    // where it will be called less often.
    updateGeometry(this.mesh.geometry);
    if (this.edges) {
      this.toggleEdgesVisible();
      this.toggleEdgesVisible();
    }

    // Update what the planet's surface looks like in the new orientation.
    this.generateTerrain();
    this.visualHelper.update();
  }

  protected cornersInView(camera: PlanetCamera) {
    const topLeftPoint = getWorldVertexFromMesh(this.meshCorners, 0);
    return camera.containsPoint(topLeftPoint);
  }

  // When we're zoomed far out, the planet mesh is shaped like a hemisphere.
  protected deformPlaneIntoHemisphere() {
    const halfHorizLength = (this.horizontalVertices - 1) / 2;
    const halfVertLength = (this.verticalVertices - 1) / 2;
    const horizRadiansPerUnit = Math.PI / this.horizontalVertices;
    const vertRadiansPerUnit = Math.PI / this.verticalVertices;
    const positions = this.mesh.geometry.attributes.position;

    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      const u = (i % this.horizontalVertices) - halfHorizLength;
      const v = Math.floor(i / this.horizontalVertices) - halfVertLength;

      sphereCoords.theta = horizRadiansPerUnit * u;
      sphereCoords.phi = vertRadiansPerUnit * v + Math.PI / 2;

      newPosition.setFromSpherical(sphereCoords);
      if (!this.flatten) {
        positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
      }
    }
  }

  // When we're zoomed close in, the planet mesh is a rectangular patch of the sphere's surface that fills the camera.
  protected deformPlaneIntoSector(camera: PlanetCamera) {
    const positions = this.mesh.geometry.attributes.position;
    const topLeftWorld = new THREE.Vector3(), bottomRightWorld = new THREE.Vector3();
    camera.copyPlanetIntersectionPoints(topLeftWorld, bottomRightWorld);
    const topLeft = sphericalFromCoords(topLeftWorld);
    const bottomRight = sphericalFromCoords(bottomRightWorld);
    const horizRadiansPerUnit = Math.abs(bottomRight.theta - topLeft.theta) / (this.horizontalVertices - 1);
    const vertRadiansPerUnit = Math.abs(bottomRight.phi - topLeft.phi) / (this.verticalVertices - 1);

    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    this.visualHelper.setPoints([topLeftWorld, bottomRightWorld]);

    for (let i = 0; i < positions.count; i++) {
      sphereCoords.theta = topLeft.theta + horizRadiansPerUnit * (i % this.horizontalVertices);
      sphereCoords.phi = topLeft.phi + vertRadiansPerUnit * Math.floor(i / this.horizontalVertices);

      newPosition.setFromSpherical(sphereCoords);
      if (!this.flatten) {
        positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
      }
    }
  }

  // Optional white lines outlining each face of the mesh.
  toggleEdgesVisible() {
    if (this.edges === null) {
      let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry, 0);
      edgeGeometry.scale(1.001, 1.001, 1.001); // Prevents weird clipping
      this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
      this.scene.add(this.edges);
      this.mesh.add(this.edges); // Makes the edges turn when the mesh turns
    } else {
      this.edges.removeFromParent();
      this.scene.remove(this.edges);
      (<THREE.Material>this.edges.material).dispose();
      this.edges.geometry.dispose();
      this.edges = null;
    }
  }

  // Debugging method: show the planet mesh as a flat rectangle instead of curving it.
  toggleFlatten() {
    this.flatten = !this.flatten;
  }

  // Set the color for each vertex on the planet to reflect the land height/water depth there.
  protected generateTerrain() {
    const NOISE_SCALE = 5000;
    const FAVOR_WATER = -0.30;
    const MIN_WATER_HUE = 0.55;
    const MAX_WATER_HUE = 0.65;
    const MIN_GROUND_LIGHT = 0.40;
    const MAX_GROUND_LIGHT = 0.64;

    let color = new THREE.Color;
    let positions = this.mesh.geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      let vertexLocation = getWorldVertexFromMesh(this.mesh, i);
      const pointOnSphere = vertexLocation.normalize().multiplyScalar(Planet.radius);
      let height = FAVOR_WATER + noiseGenerator().noise3D(
        pointOnSphere.x / NOISE_SCALE,
        pointOnSphere.y / NOISE_SCALE,
        pointOnSphere.z / NOISE_SCALE,
      );

      if (height < 0) {
        color.setHSL((MAX_WATER_HUE - MIN_WATER_HUE) * Math.abs(height) + MIN_WATER_HUE, 1.0, 0.5);
      } else {
        color.setHSL(1/3, 1.0, (MAX_GROUND_LIGHT - MIN_GROUND_LIGHT) * Math.abs(height) + MIN_GROUND_LIGHT);
      }

      this.mesh.geometry.attributes.color.setXYZ(i, color.r, color.g, color.b);
    }
  }
};
