import * as THREE from "three";
import { noiseGenerator, updateGeometry } from "./util";

export { Planet };

const ORIGIN = new THREE.Vector3(0, 0, 0);
const MESH_SIDE_LENGTH = 6000;
const MESH_SUBDIVISION = 100;

class Planet {
  static readonly radius = 6370; // each unit is 1 kilometer

  protected scene: THREE.Scene;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments | null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    let geometry = new THREE.PlaneGeometry(MESH_SIDE_LENGTH, MESH_SIDE_LENGTH, MESH_SUBDIVISION, MESH_SUBDIVISION);
    const positions = geometry.attributes.position;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3));

    let material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.FrontSide });
    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);

    this.edges = new THREE.LineSegments();
    this.toggleEdgesVisible();
  };

  destroy() {
    (<THREE.Material>this.mesh.material).dispose();
    this.mesh.geometry.dispose();

    if (this.edges) {
      (<THREE.Material>this.edges.material).dispose();
      this.edges.geometry.dispose();
    }
  }

  update(cameraPosition: THREE.Vector3) {
    this.deformPlaneMesh(cameraPosition.distanceTo(ORIGIN));
    this.mesh.geometry.lookAt(cameraPosition);
    updateGeometry(this.mesh.geometry);
    this.generateTerrain();

    if (this.edges) {
      this.toggleEdgesVisible();
      this.toggleEdgesVisible();
    }
  }

  // Makes the mesh curve based on how far away it is, so that it seems round at a distance
  // and flatter when you get closer. (Later, maybe try moving this into a vertex shader?)
  //
  // FIXME: Doesn't do the flattening yet!
  //
  protected deformPlaneMesh(cameraDistance: number) {
    const SIDE_LENGTH = MESH_SUBDIVISION + 1;
    const HALF_MESH_LENGTH = Math.floor(SIDE_LENGTH / 2);
    const RADIANS_PER_UNIT = Math.PI / HALF_MESH_LENGTH / 2;

    let positions = this.mesh.geometry.attributes.position;
    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      const u = Math.floor(i / SIDE_LENGTH) - HALF_MESH_LENGTH;
      const v = (i % SIDE_LENGTH) - HALF_MESH_LENGTH;

      sphereCoords.theta = RADIANS_PER_UNIT * v;
      sphereCoords.phi = RADIANS_PER_UNIT * u + Math.PI / 2;
      // const FIXME_MAX_ZOOM = 1 / (Math.tan(25 / (180 / Math.PI)) / Planet.radius / 1.2);
      // sphereCoords.radius = (Planet.radius / (cameraDistance - Planet.radius)) * FIXME_MAX_ZOOM;

      // if ((u == -HALF_MESH_LENGTH && v == -HALF_MESH_LENGTH) || (u == 0 && v == -HALF_MESH_LENGTH) || (u == HALF_MESH_LENGTH && v == -HALF_MESH_LENGTH) ||
      //     (u == -HALF_MESH_LENGTH && v == 0) || (u == 0 && v == 0) || (u == HALF_MESH_LENGTH && v == 0) ||
      //     (u == -HALF_MESH_LENGTH && v == HALF_MESH_LENGTH) || (u == 0 && v == HALF_MESH_LENGTH) || (u == HALF_MESH_LENGTH && v == HALF_MESH_LENGTH)) {
      //   console.log(`(camD ${cameraDistance} - Pr ${Planet.radius}) * FMZ ${FIXME_MAX_ZOOM} = ${sphereCoords.radius}`);
      //   console.log(`mesh(${u}, ${v}) => sphere(r: ${sphereCoords.radius}, t: ${sphereCoords.theta}, p: ${sphereCoords.phi})`);
      // }

      newPosition.setFromSpherical(sphereCoords);
      positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
    }
  }

  // Optional white lines outlining each face of the mesh.
  toggleEdgesVisible() {
    if (this.edges === null) {
      let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
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
    const FAVOR_WATER = -0.35;
    const MIN_WATER_HUE = 0.55;
    const MAX_WATER_HUE = 0.65;
    const MIN_GROUND_LIGHT = 0.40;
    const MAX_GROUND_LIGHT = 0.64;

    let color = new THREE.Color;
    let positions = this.mesh.geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      let height = FAVOR_WATER + noiseGenerator().noise3D(
        positions.getX(i) / NOISE_SCALE,
        positions.getY(i) / NOISE_SCALE,
        positions.getZ(i) / NOISE_SCALE,
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
