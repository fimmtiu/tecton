import * as THREE from "three";
import { PlanetCamera } from "./planet_camera";
import { getVertexFromGeometry, noiseGenerator, updateGeometry } from "./util";

export { Planet };

const PIXELS_BETWEEN_VERTICES = 10;

class Planet {
  static readonly radius = 6370; // each unit is 1 kilometer

  protected scene: THREE.Scene;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments | null;
  protected horizontalVertices!: number;
  protected verticalVertices!: number;

  constructor(scene: THREE.Scene, viewportWidth: number, viewportHeight: number) {
    this.scene = scene;
    this.mesh = new THREE.Mesh();
    this.resize(viewportWidth, viewportHeight);

    this.edges = new THREE.LineSegments();
    this.toggleEdgesVisible();
  }

  resize(width: number, height: number) {
    this.destroy();

    this.horizontalVertices = Math.ceil(width / PIXELS_BETWEEN_VERTICES);
    this.verticalVertices = Math.ceil(height / PIXELS_BETWEEN_VERTICES);

    console.log(`New mesh: ${this.horizontalVertices} x ${this.verticalVertices} vertices.`);
    let geometry = new THREE.PlaneGeometry(
      width * 12, height * 12,
      this.horizontalVertices, this.verticalVertices,
    );
    const positions = geometry.attributes.position;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3));

    let material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.FrontSide });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
  }

  destroy() {
    (<THREE.Material>this.mesh.material).dispose();
    this.mesh.geometry.dispose();

    if (this.edges) {
      (<THREE.Material>this.edges.material).dispose();
      this.edges.geometry.dispose();
      this.edges = null;
    }
  }

  update(camera: PlanetCamera) {
    this.deformPlaneMesh(camera);
    this.mesh.geometry.lookAt(camera.position);
    updateGeometry(this.mesh.geometry);
    this.generateTerrain();

    if (this.edges) {
      this.toggleEdgesVisible();
      this.toggleEdgesVisible();
    }
  }

  // Makes the mesh curve based on how far away it is, so that it seems round at a distance
  // and flatter when you get closer. (Later, maybe try moving this into a vertex shader?)
  protected deformPlaneMesh(camera: PlanetCamera) {
    const half_horiz_length = Math.floor((this.horizontalVertices + 1) / 2);
    const half_vert_length = Math.floor((this.horizontalVertices + 1) / 2);
    const horiz_radians_per_unit = Math.PI / half_horiz_length / 2;
    const vert_radians_per_unit = Math.PI / half_vert_length / 2;
    const FIXME_MAX_ZOOM = 1 / (Math.tan(25 / (180 / Math.PI)) / Planet.radius / 1.2);
    const closeness = camera.heightAboveTerrain() / (FIXME_MAX_ZOOM - Planet.radius);

    let positions = this.mesh.geometry.attributes.position;
    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      const u = Math.floor(i / (this.verticalVertices + 1)) - half_vert_length;
      const v = (i % (this.horizontalVertices + 1)) - half_horiz_length;

      sphereCoords.theta = (horiz_radians_per_unit * closeness) * v;
      sphereCoords.phi = (vert_radians_per_unit * closeness) * u + Math.PI / 2;
      sphereCoords.radius = Planet.radius / closeness;
      const moveBackDistance = sphereCoords.radius - Planet.radius;

      newPosition.setFromSpherical(sphereCoords);
      positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z - moveBackDistance);

      // if ((u == -HALF_MESH_LENGTH && v == -HALF_MESH_LENGTH) || (u == 0 && v == -HALF_MESH_LENGTH) || (u == HALF_MESH_LENGTH && v == -HALF_MESH_LENGTH) ||
      //     (u == -HALF_MESH_LENGTH && v == 0) || (u == 0 && v == 0) || (u == HALF_MESH_LENGTH && v == 0) ||
      //     (u == -HALF_MESH_LENGTH && v == HALF_MESH_LENGTH) || (u == 0 && v == HALF_MESH_LENGTH) || (u == HALF_MESH_LENGTH && v == HALF_MESH_LENGTH)) {
      //   console.log(`mesh(${u}, ${v}) => sphere(r: ${sphereCoords.radius}, t: ${sphereCoords.theta}, p: ${sphereCoords.phi}) => world(x ${newPosition.x}, y ${newPosition.y}, z ${newPosition.z - moveBackDistance})`);
      // }

      if (u == 0 && v == 0) {
        console.log(`closeness: ${closeness} radians per unit: ${horiz_radians_per_unit * closeness}`);
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
    } else {
      this.scene.remove(this.edges);
      (<THREE.Material>this.edges.material).dispose();
      this.edges.geometry.dispose();
      this.edges = null;
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
