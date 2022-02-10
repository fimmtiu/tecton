import * as THREE from "three";
import { PlanetCamera } from "./planet_camera";
import { getVertexFromGeometry, noiseGenerator, updateGeometry, ORIGIN } from "./util";
import { VisualHelper } from "./visual_helper";

export { Planet };

const PIXELS_BETWEEN_VERTICES = 10;

class Planet {
  static readonly radius = 6370; // each unit is 1 kilometer

  protected scene: THREE.Scene;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments | null;
  protected visualHelper: VisualHelper;
  protected topLeftCorner!: THREE.Points;
  protected horizontalVertices!: number;
  protected verticalVertices!: number;
  protected flatten: boolean;

  constructor(scene: THREE.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.mesh = new THREE.Mesh();
    this.visualHelper = new VisualHelper(scene, [], true, true);
    this.topLeftCorner = new THREE.Points();
    this.flatten = false;

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
    const points_geometry = new THREE.BufferGeometry();
    points_geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      topLeft.x, topLeft.y, topLeft.z,
      bottomRight.x, bottomRight.y, bottomRight.z,
    ], 6));
    this.topLeftCorner = new THREE.Points(points_geometry);

    this.visualHelper.setPoints([topLeft, bottomRight]);
  }

  destroy() {
    this.scene.remove(this.mesh);
    (<THREE.Material>this.mesh.material).dispose();
    this.mesh.geometry.dispose();

    (<THREE.Material>this.topLeftCorner.material).dispose();
    this.topLeftCorner.geometry.dispose();

    if (this.edges) {
      this.toggleEdgesVisible();
    }
  }

  update(camera: PlanetCamera) {
    if (this.cornersInView(camera)) {
      console.log("in camera");
      this.deformPlaneIntoHemisphere();
    } else {
      console.log("out of camera");
      this.deformPlaneIntoSector(camera);
    }
    this.mesh.geometry.lookAt(camera.position);
    this.topLeftCorner.geometry.lookAt(camera.position);
    this.visualHelper.update();
    updateGeometry(this.mesh.geometry);
    this.generateTerrain();

    if (this.edges) {
      this.toggleEdgesVisible();
      this.toggleEdgesVisible();
    }
  }

  // FIXME: This only works when you're head-on. If you rotate the camera, the points won't rotate with it.
  protected cornersInView(camera: PlanetCamera) {
    const topLeftPoint = getVertexFromGeometry(this.topLeftCorner.geometry, 0);
    return camera.containsPoint(topLeftPoint);
  }

  protected deformPlaneIntoHemisphere() {
    const half_horiz_length = (this.horizontalVertices - 1) / 2;
    const half_vert_length = (this.verticalVertices - 1) / 2;
    const horiz_radians_per_unit = Math.PI / half_vert_length / 2;
    const vert_radians_per_unit = Math.PI / half_horiz_length / 2;

    let positions = this.mesh.geometry.attributes.position;
    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      const u = (i % this.horizontalVertices) - half_horiz_length;
      const v = Math.floor(i / this.horizontalVertices) - half_vert_length;

      sphereCoords.theta = horiz_radians_per_unit * u;
      sphereCoords.phi = vert_radians_per_unit * v + Math.PI / 2;

      newPosition.setFromSpherical(sphereCoords);
      if (!this.flatten) {
        positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
      }
    }
  }

  protected deformPlaneIntoSector(camera: PlanetCamera) {
    // FIXME implement this
    this.deformPlaneIntoHemisphere();
  }

  // Optional white lines outlining each face of the mesh.
  toggleEdgesVisible() {
    if (this.edges === null) {
      let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry, 0);
      edgeGeometry.scale(1.001, 1.001, 1.001); // Prevents weird clipping
      this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
      this.scene.add(this.edges);
    } else {
      this.scene.remove(this.edges);
      (<THREE.Material>this.edges.material).dispose();
      this.edges.geometry.dispose();
      this.edges = null;
    }
  }

  toggleFlatten() {
    this.flatten = !this.flatten;
  }

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
      let vertexLocation = getVertexFromGeometry(this.mesh.geometry, i);
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
