import * as THREE from "three";
import tinygradient from "tinygradient";

import { PlanetCamera } from "./planet_camera";
import { getWorldVertexFromMesh, noiseGenerator, updateGeometry, ORIGIN, sphericalFromCoords } from "./util";
import { Terrain } from "./terrain";
import { VisualHelper } from "./visual_helper";
import { scene } from "./scene_data";

export { Planet, PLANET_RADIUS };

const PIXELS_BETWEEN_VERTICES = 10;
const PLANET_RADIUS = 6370; // each unit is 1 kilometer

class Planet {
  static readonly radius = PLANET_RADIUS;

  public sphere: THREE.Sphere;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments | null;
  protected visualHelper: VisualHelper;
  protected horizontalVertices!: number;
  protected verticalVertices!: number;
  protected flatten: boolean;
  protected fillsCamera: boolean;
  protected terrain: Terrain;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.sphere = new THREE.Sphere(ORIGIN, Planet.radius);
    this.mesh = new THREE.Mesh();
    this.visualHelper = new VisualHelper(true, true);
    this.flatten = false;
    this.fillsCamera = true;
    this.terrain = new Terrain(this);

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
    scene.add(this.mesh);
  }

  destroy() {
    scene.remove(this.mesh);
    (<THREE.Material>this.mesh.material).dispose();
    this.mesh.geometry.dispose();

    if (this.edges) {
      this.toggleEdgesVisible();
    }
  }

  update(camera: PlanetCamera) {
    // Change the curvature of the planet mesh, if necessary.
    // FIXME: Later, try doing this with a vertex shader instead.
    const topLeftPoint = new THREE.Vector3(), bottomRightPoint = new THREE.Vector3();
    if (camera.copyPlanetIntersectionPoints(topLeftPoint, bottomRightPoint)) {
      console.log("planet fills viewport");
      if (!this.fillsCamera) {
        console.log("switching from hemisphere to sector");
      }
      this.deformPlaneIntoSector(topLeftPoint, bottomRightPoint);
      this.fillsCamera = true;
    } else {
      console.log("planet does NOT fill viewport");
      if (this.fillsCamera) {
        console.log("switching from sector to hemisphere");
        this.deformPlaneIntoHemisphere();
        this.fillsCamera = false;
      }
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
    this.generateTerrain(camera);
    this.visualHelper.update();
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
  protected deformPlaneIntoSector(topLeftWorld: THREE.Vector3, bottomRightWorld: THREE.Vector3) {
    const positions = this.mesh.geometry.attributes.position;
    this.rotateCornersToEquator(topLeftWorld, bottomRightWorld);

    const topLeft = sphericalFromCoords(topLeftWorld);
    const bottomRight = sphericalFromCoords(bottomRightWorld);
    const halfHorizLength = (this.horizontalVertices - 1) / 2;
    const halfVertLength = (this.verticalVertices - 1) / 2;
    const horizRadiansPerUnit = Math.abs(bottomRight.theta - topLeft.theta) / (this.horizontalVertices - 1);
    const vertRadiansPerUnit = Math.abs(bottomRight.phi - topLeft.phi) / (this.verticalVertices - 1);

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

  // The math for working out the angles only works if we assume that all points lie near the equator, and freaks
  // out around the poles. The simplest (though not necessarily best) solution is to just move the corners to near
  // the equator before we calculate the mesh deformation.
  protected rotateCornersToEquator(topLeft: THREE.Vector3, bottomRight: THREE.Vector3) {
    const rotation = new THREE.Quaternion().setFromEuler(this.mesh.rotation).conjugate();
    topLeft.applyQuaternion(rotation);
    bottomRight.applyQuaternion(rotation);
  }

  // Optional white lines outlining each face of the mesh.
  toggleEdgesVisible() {
    if (this.edges === null) {
      let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry, 0);
      edgeGeometry.scale(1.001, 1.001, 1.001); // Prevents weird clipping
      this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
      this.mesh.add(this.edges); // Makes the edges turn when the mesh turns
    } else {
      this.edges.removeFromParent();
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
  protected generateTerrain(camera: PlanetCamera) {
    const NOISE_SCALE = 5000;
    const FAVOR_WATER = -0.30;


    let color = new THREE.Color;
    let positions = this.mesh.geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      let vertexLocation = getWorldVertexFromMesh(this.mesh, i);
      const pointOnSphere = vertexLocation.normalize().multiplyScalar(Planet.radius);

      let height1 = noiseGenerator().noise3D(pointOnSphere.x / NOISE_SCALE, pointOnSphere.y / NOISE_SCALE, pointOnSphere.z / NOISE_SCALE);
      let height2 = noiseGenerator().noise3D(5.1 * pointOnSphere.x / NOISE_SCALE, 5.1 * pointOnSphere.y / NOISE_SCALE, 5.1 * pointOnSphere.z / NOISE_SCALE);
      let height3 = noiseGenerator().noise3D(9.7 * pointOnSphere.x / NOISE_SCALE, 9.7 * pointOnSphere.y / NOISE_SCALE, 9.7 * pointOnSphere.z / NOISE_SCALE);
      let height4 = noiseGenerator().noise3D(14.2 * pointOnSphere.x / NOISE_SCALE, 14.2 * pointOnSphere.y / NOISE_SCALE, 14.2 * pointOnSphere.z / NOISE_SCALE);
      let height5 = noiseGenerator().noise3D(20.0 * pointOnSphere.x / NOISE_SCALE, 20.0 * pointOnSphere.y / NOISE_SCALE, 20.0 * pointOnSphere.z / NOISE_SCALE);
      let height6 = noiseGenerator().noise3D(29.5 * pointOnSphere.x / NOISE_SCALE, 29.5 * pointOnSphere.y / NOISE_SCALE, 29.5 * pointOnSphere.z / NOISE_SCALE);
      let height = height1 + height2 / 4 + height3 / 8 + height4 / 16 + height5 / 32 + height6 / 64 + FAVOR_WATER;

      this.setColor(height, color);

      this.mesh.geometry.attributes.color.setXYZ(i, color.r, color.g, color.b);
    }
  }

  static MIN_WATER_HUE = 0.55;
  static MAX_WATER_HUE = 0.65;
  // static MIN_GROUND_LIGHT = 0.30;
  //static MAX_GROUND_LIGHT = 0.64;

  static LAND_GRADIENT = tinygradient([
    {color: '#00aa00', pos: 0},
    {color: '#009900', pos: 0.33},
    {color: '#606000', pos: 0.8},
    {color: '#ffffff', pos: 0.9},
  ]);


  private setColor(height: number, color: THREE.Color) {
    if (height < 0) {
      color.setHSL((Planet.MAX_WATER_HUE - Planet.MIN_WATER_HUE) * Math.abs(height) + Planet.MIN_WATER_HUE, 1.0, 0.5);
    } else {
      let {h, s, l} = Planet.LAND_GRADIENT.hsvAt(height).toHsl();
      color.setHSL(h/360, s, l);
    }
  }

};
