import * as THREE from "three";
import tinygradient from "tinygradient";

import { PlanetCamera } from "./planet_camera";
import { getWorldVertexFromMesh, updateGeometry, ORIGIN, sphericalFromCoords, v2s } from "./util";
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
  protected terrain: Terrain;
  protected halfHorizLength!: number;
  protected halfVertLength!: number;


  constructor(viewportWidth: number, viewportHeight: number) {
    this.sphere = new THREE.Sphere(ORIGIN, Planet.radius);
    this.mesh = new THREE.Mesh();
    this.visualHelper = new VisualHelper(true, true);
    this.terrain = new Terrain();

    this.resize(viewportWidth, viewportHeight);

    this.edges = new THREE.LineSegments();
    this.toggleEdgesVisible();
  }

  resize(width: number, height: number) {
    this.destroy();

    this.horizontalVertices = Math.ceil(width / PIXELS_BETWEEN_VERTICES) + 2;
    this.verticalVertices = Math.ceil(height / PIXELS_BETWEEN_VERTICES) + 2;
    this.halfHorizLength = (this.horizontalVertices - 1) / 2;
    this.halfVertLength = (this.verticalVertices - 1) / 2;

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

  elevationAt(point: THREE.Vector3) {
    return this.terrain.scaleHeight(this.terrain.normalizedHeightAt(point));
  }

  // FIXME: This method is too long. Needs extraction.
  update(camera: PlanetCamera) {
    // Make the planet mesh and all of its child meshes turn to look at the new camera position.
    this.mesh.lookAt(camera.position);

    // Change the curvature of the planet mesh and update the colors to reflect the terrain.
    // FIXME: Later, try doing this with a vertex shader instead.
    const positions = this.mesh.geometry.getAttribute("position");
    const colors = this.mesh.geometry.getAttribute("color");
    const topLeftPoint = new THREE.Vector3(), bottomRightPoint = new THREE.Vector3();
    let horizRadiansPerUnit = 0, vertRadiansPerUnit = 0;
    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();
    let color = new THREE.Color();

    // When we're zoomed far out, the planet mesh is shaped like a hemisphere.
    // When we're zoomed close in, the planet mesh is a rectangular patch of the sphere's surface that fills the camera.
    if (camera.copyPlanetIntersectionPoints(topLeftPoint, bottomRightPoint)) { // camera close to planet
      this.rotateCornersToEquator(topLeftPoint, bottomRightPoint);
      const topLeftSph = sphericalFromCoords(topLeftPoint);
      const bottomRightSph = sphericalFromCoords(bottomRightPoint);
      horizRadiansPerUnit = Math.abs(bottomRightSph.theta - topLeftSph.theta) / (this.horizontalVertices - 1);
      vertRadiansPerUnit = Math.abs(bottomRightSph.phi - topLeftSph.phi) / (this.verticalVertices - 1);
    } else {
      horizRadiansPerUnit = Math.PI / this.horizontalVertices; // camera is far away
      vertRadiansPerUnit = Math.PI / this.verticalVertices;
    }

    for (let i = 0; i < positions.count; i++) {
      const u = (i % this.horizontalVertices) - this.halfHorizLength;
      const v = Math.floor(i / this.horizontalVertices) - this.halfVertLength;

      // Calculate where this vertex should go on the sea-level sphere.
      sphereCoords.theta = horizRadiansPerUnit * u;
      sphereCoords.phi = vertRadiansPerUnit * v + Math.PI / 2;
      sphereCoords.radius = Planet.radius;
      newPosition.setFromSpherical(sphereCoords);

      // Get the height from the world position of the vertex and set the vertex to the appropriate color.
      const worldPosition = this.mesh.localToWorld(newPosition.clone());
      const height = this.terrain.normalizedHeightAt(worldPosition);
      this.setColor(height, color);
      colors.setXYZ(i, color.r, color.g, color.b);

      // Add terrain height to the vertex. (We have to do this afterwards because the height is calculated based
      // on the vertex's location at sea level.)
      if (height > 0) {
        sphereCoords.radius += this.terrain.scaleHeight(height);
        newPosition.setFromSpherical(sphereCoords);
      }
      positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
    }
    updateGeometry(this.mesh.geometry);
    console.log(`min: ${this.terrain.min}. max: ${this.terrain.max}`);

    if (this.edges) {
      this.toggleEdgesVisible();
      this.toggleEdgesVisible();
    }
    this.visualHelper.update();
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

  // We have to pre-generate the gradients for performance reasons. 100 steps should be plenty, right?
  static readonly WATER_GRADIENT = tinygradient([
    {color: '#7ad6cf', pos: 0},
    {color: '#1298ff', pos: 0.05},
    {color: '#1c63c7', pos: 0.6},
    {color: '#003054', pos: 0.8},
  ]).rgb(101);
  static readonly LAND_GRADIENT = tinygradient([
    {color: '#00aa00', pos: 0},
    {color: '#009900', pos: 0.2},
    {color: '#785c38', pos: 0.55},
    {color: '#967447', pos: 0.65}, // the snow line is a fairly hard cutoff
    {color: '#ffffff', pos: 0.68},
  ]).rgb(101);

  private setColor(height: number, color: THREE.Color) {
    const gradient = height >= 0 ? Planet.LAND_GRADIENT : Planet.WATER_GRADIENT;
    // console.log(`height: ${height}, gradient: ${Math.trunc(Math.abs(height) * 100)}`);
    const {r, g, b} = gradient[Math.trunc(Math.abs(height) * 100)].toRgb();
    color.setRGB(r/255, g/255, b/255);
  }
};
