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
    this.terrain = new Terrain(this);

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

  update(camera: PlanetCamera) {
    // Make the planet mesh and all of its child meshes turn to look at the new camera position.
    this.mesh.lookAt(camera.position);

    // Change the curvature of the planet mesh and update the colors to reflect the terrain.
    // FIXME: Later, try doing this with a vertex shader instead.
    const topLeftPoint = new THREE.Vector3(), bottomRightPoint = new THREE.Vector3();
    let deformFunction = this.deformIntoHemisphere;
    if (camera.copyPlanetIntersectionPoints(topLeftPoint, bottomRightPoint)) {
      this.rotateCornersToEquator(topLeftPoint, bottomRightPoint);
      deformFunction = this.deformIntoSector;
    }

    const positions = this.mesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      this.updateMeshVertex(i, deformFunction, topLeftPoint, bottomRightPoint);
    }
    updateGeometry(this.mesh.geometry);

    if (this.edges) {
      this.toggleEdgesVisible();
      this.toggleEdgesVisible();
    }
    this.visualHelper.update();
  }

  protected updateMeshVertex(
    index: number, deformFunction: { (i: number, x: THREE.Vector3, y: THREE.Vector3): void },
    topLeft: THREE.Vector3, bottomRight: THREE.Vector3
  ) {
    deformFunction.apply(this, [index, topLeft, bottomRight]);

    let worldPosition = getWorldVertexFromMesh(this.mesh, index);
    const height = this.terrain.normalizedHeightAt(worldPosition);

    let color = new THREE.Color();
    this.setColor(height, color);
    this.mesh.geometry.getAttribute("color").setXYZ(index, color.r, color.g, color.b);

    // Add terrain height to the vertex
    const positions = this.mesh.geometry.getAttribute("position");
    const localPosition = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
    const sphereCoords = new THREE.Spherical().setFromVector3(localPosition);
    sphereCoords.radius += this.terrain.scaleHeight(height);
    localPosition.setFromSpherical(sphereCoords);
    positions.setXYZ(index, localPosition.x, localPosition.y, localPosition.z);
  }

  // FIXME: These functions are similar enough that we could probably combine them somehow.
  // When we're zoomed far out, the planet mesh is shaped like a hemisphere.
  protected deformIntoHemisphere(index: number, _tl: THREE.Vector3, _br: THREE.Vector3) {
    const horizRadiansPerUnit = Math.PI / this.horizontalVertices;
    const vertRadiansPerUnit = Math.PI / this.verticalVertices;
    const positions = this.mesh.geometry.attributes.position;

    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    const u = (index % this.horizontalVertices) - this.halfHorizLength;
    const v = Math.floor(index / this.horizontalVertices) - this.halfVertLength;

    sphereCoords.theta = horizRadiansPerUnit * u;
    sphereCoords.phi = vertRadiansPerUnit * v + Math.PI / 2;

    newPosition.setFromSpherical(sphereCoords);
    positions.setXYZ(index, newPosition.x, newPosition.y, newPosition.z);
  }

  // When we're zoomed close in, the planet mesh is a rectangular patch of the sphere's surface that fills the camera.
  protected deformIntoSector(index: number, topLeftWorld: THREE.Vector3, bottomRightWorld: THREE.Vector3) {
    const topLeft = sphericalFromCoords(topLeftWorld);
    const bottomRight = sphericalFromCoords(bottomRightWorld);
    const horizRadiansPerUnit = Math.abs(bottomRight.theta - topLeft.theta) / (this.horizontalVertices - 1);
    const vertRadiansPerUnit = Math.abs(bottomRight.phi - topLeft.phi) / (this.verticalVertices - 1);
    const positions = this.mesh.geometry.attributes.position;

    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    const u = (index % this.horizontalVertices) - this.halfHorizLength;
    const v = Math.floor(index / this.horizontalVertices) - this.halfVertLength;

    sphereCoords.theta = horizRadiansPerUnit * u;
    sphereCoords.phi = vertRadiansPerUnit * v + Math.PI / 2;

    newPosition.setFromSpherical(sphereCoords);
    positions.setXYZ(index, newPosition.x, newPosition.y, newPosition.z);
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

  static readonly WATER_GRADIENT = tinygradient([
    {color: '#7ad6cf', pos: 0},
    {color: '#1298ff', pos: 0.05},
    {color: '#1c63c7', pos: 0.6},
    {color: '#003054', pos: 0.8},
  ]);
  static readonly LAND_GRADIENT = tinygradient([
    {color: '#00aa00', pos: 0},
    {color: '#009900', pos: 0.2},
    {color: '#785c38', pos: 0.55},
    {color: '#967447', pos: 0.65}, // the snow line is a fairly hard cutoff
    {color: '#ffffff', pos: 0.68},
  ]);

  // FIXME: It's shocking how expensive the gradient calculation is.
  // I may have to ditch this library and implement it myself.
  private setColor(height: number, color: THREE.Color) {
    const gradient = height >= 0 ? Planet.LAND_GRADIENT : Planet.WATER_GRADIENT;
    const {r, g, b} = gradient.rgbAt(Math.abs(height)).toRgb();
    color.setRGB(r/255, g/255, b/255);
  }
};
