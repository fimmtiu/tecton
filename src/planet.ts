import * as THREE from "three";
import { PlanetCamera } from "./planet_camera";
import { getVertexFromGeometry, noiseGenerator, updateGeometry } from "./util";

export { Planet };

const PIXELS_BETWEEN_VERTICES = 10;

class Planet {
  static readonly radius = 6370; // each unit is 1 kilometer

  protected scene: THREE.Scene;
  protected mesh: THREE.Mesh;
  protected points: Array<THREE.Points>;
  protected edges: THREE.LineSegments | null;
  protected horizontalVertices!: number;
  protected verticalVertices!: number;
  protected flatten: boolean;

  constructor(scene: THREE.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.mesh = new THREE.Mesh();
    this.points = [];
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
  }

  destroy() {
    this.scene.remove(this.mesh);
    (<THREE.Material>this.mesh.material).dispose();
    this.mesh.geometry.dispose();

    if (this.edges) {
      this.toggleEdgesVisible();
    }

    for (let point of this.points) {
      this.scene.remove(point);
      (<THREE.Material>point.material).dispose();
      point.geometry.dispose();
    }
  }

  update(camera: PlanetCamera) {
    if (this.cornersInView(camera)) {
      this.deformPlaneIntoHemisphere(camera);
    } else {
      this.deformPlaneIntoSector(camera);
    }
    this.mesh.geometry.lookAt(camera.position);
    updateGeometry(this.mesh.geometry);
    this.generateTerrain();

    if (this.edges) {
      this.toggleEdgesVisible();
      this.toggleEdgesVisible();
    }
  }

  // FIXME: This only works when you're head-on. If you rotate the camera, the points won't rotate with it.
  protected cornersInView(camera: PlanetCamera) {
    const topLeft = new THREE.Vector3();
    const bottomRight = new THREE.Vector3();
    topLeft.setFromSphericalCoords(Planet.radius, Math.PI / 4, Math.PI * 1.5);
    bottomRight.setFromSphericalCoords(Planet.radius, Math.PI / 4 * 3, Math.PI / 2);

    return camera.containsPoint(topLeft) && camera.containsPoint(bottomRight);
  }

  protected deformPlaneIntoHemisphere(camera: PlanetCamera) {
    const half_horiz_length = (this.horizontalVertices - 1) / 2;
    const half_vert_length = (this.verticalVertices - 1) / 2;
    const horiz_radians_per_unit = Math.PI / half_vert_length / 2;
    const vert_radians_per_unit = Math.PI / half_horiz_length / 2;

    let positions = this.mesh.geometry.attributes.position;
    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    console.log(`hv: ${this.horizontalVertices}. vv: ${this.verticalVertices}. hhl: ${half_horiz_length}. hvl: ${half_vert_length}. count ${positions.count}`);

    for (let i = 0; i < positions.count; i++) {
      const u = (i % this.horizontalVertices) - half_horiz_length;
      const v = Math.floor(i / this.horizontalVertices) - half_vert_length;

      sphereCoords.theta = horiz_radians_per_unit * u;
      sphereCoords.phi = vert_radians_per_unit * v + Math.PI / 2;

      // console.log(`i ${i}, u ${u} (${i} % ${this.verticalVertices} - ${half_horiz_length}), v ${v} (floor(${i} / ${this.horizontalVertices}) - ${half_vert_length})`);
      // console.log(`i ${i}, u ${u}, v ${v}, theta: ${horiz_radians_per_unit} * ${u} = ${sphereCoords.theta}, phi: ${vert_radians_per_unit} * ${v} + p/2 = ${sphereCoords.phi}`);

      newPosition.setFromSpherical(sphereCoords);
      if (!this.flatten) {
        positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
      }
    }
  }

  protected deformPlaneIntoSector(camera: PlanetCamera) {
    // FIXME implement this
    this.deformPlaneIntoHemisphere(camera);
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

  // Debugging method: show specific 3D points in bright colors.
  protected highlightPoints(points: Array<THREE.Vector3>) {
    const COLORS = [0xffae00, 0x00ffff, 0xff1e00, 0xc800ff]; // orange, aqua, red, purple

    for (let point of this.points) {
      this.scene.remove(point);
      (<THREE.Material>point.material).dispose();
      point.geometry.dispose();
    }

    for (let i = 0; i < points.length; i++) {
      const points_geometry = new THREE.BufferGeometry();
      points_geometry.setAttribute('position', new THREE.Float32BufferAttribute([points[i].x, points[i].y, points[i].z], 3));
      const points_material = new THREE.PointsMaterial({ color: COLORS[i % COLORS.length], size: 200 });
      const point = new THREE.Points(points_geometry, points_material);
      this.scene.add(point);
      this.points.push(point);
    }
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
