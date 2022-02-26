import * as THREE from "three";

import { PlanetCamera } from "./planet_camera";
import { updateGeometry, ORIGIN, sphericalFromCoords } from "./util";
import { Terrain } from "./terrain";
import { VisualHelper } from "./visual_helper";
import { scene } from "./scene_data";
import { TextureManager } from "./texture_manager";
import { TextureCopier } from "./texture_copier";
import { PlanetMesh } from "./planet_mesh";

export { Planet, PLANET_RADIUS };

const PIXELS_BETWEEN_VERTICES = 10;
const PLANET_RADIUS = 6370; // each unit is 1 kilometer
const TEXTURE_SIZE = 1024;
const ATLAS_INDEX: { [biomeName: string]: number[] } = {
  "snow": [0, 2048, 16, 2064],
  "jungle": [4096, 6144, 4112, 6160],
  "forest": [8192, 10240, 8208, 10256],
  "plain": [12288, 14336, 12304, 14352],
  "mountain": [32, 2080, 48, 2096],
  "desert": [4128, 6176, 4144, 6192],
  "grassland": [8224, 10272, 8240, 10288],
  "water1": [12320, 14368, 12336, 14384],
  "water2": [64, 2112, 80, 2128],
  "water3": [4160, 6208, 4176, 6224],
  "water4": [8256, 10304, 8272, 10320],
  "water5": [12352, 14400, 12368, 14416],
  "water6": [96, 2144, 112, 2160],
  "water7": [4192, 6240, 4208, 6256],
  "water8": [8288, 10336, 8304, 10352],
  "water9": [12384, 14432, 12400, 14448],
}
const SWATCH_SIZE = 16;

class Planet {
  static readonly radius = PLANET_RADIUS;

  public sphere: THREE.Sphere;
  protected hemisphereMesh!: PlanetMesh;
  protected flatMesh!: PlanetMesh;
  protected visualHelper: VisualHelper;
  protected terrain: Terrain;
  protected textureData: Uint8ClampedArray;
  protected texture: THREE.DataTexture;
  protected atlas: THREE.DataTexture;
  protected copier: TextureCopier;
  protected fillsCamera = false;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.sphere = new THREE.Sphere(ORIGIN, Planet.radius);
    this.visualHelper = new VisualHelper(true, true);
    this.terrain = new Terrain();
    this.textureData = new Uint8ClampedArray(TEXTURE_SIZE ** 2 * 4);

    this.texture = new THREE.DataTexture(this.textureData, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
    this.texture.flipY = true;
    this.atlas = TextureManager.dataTextures["atlas.png"];
    this.atlas.flipY = true;
    this.copier = new TextureCopier(this.atlas, this.texture, SWATCH_SIZE);

    this.createMeshes(viewportWidth, viewportHeight);
  }

  createMeshes(viewportWidth: number, viewportHeight: number) {
    const hemiMaterial = new THREE.MeshStandardMaterial({ map: this.texture, side: THREE.FrontSide });
    const flatMaterial = new THREE.MeshStandardMaterial({ map: this.texture, side: THREE.FrontSide });

    const horizontalVertices = Math.ceil(viewportWidth / PIXELS_BETWEEN_VERTICES) + 2;
    const verticalVertices = Math.ceil(viewportHeight / PIXELS_BETWEEN_VERTICES) + 2;
    const hemiVertices = Math.max(horizontalVertices, verticalVertices); // The hemisphere mesh is a square
    const hemiSide = Math.max(viewportWidth, viewportHeight);

    this.hemisphereMesh = new PlanetMesh(hemiSide, hemiSide, hemiVertices, hemiVertices, hemiMaterial);
    this.hemisphereMesh.visible = !this.fillsCamera;
    scene.add(this.hemisphereMesh);

    this.flatMesh = new PlanetMesh(viewportWidth, viewportHeight, horizontalVertices, verticalVertices, flatMaterial);
    this.flatMesh.visible = this.fillsCamera;
    scene.add(this.flatMesh);
  }

  resize(width: number, height: number) {
    this.destroyMeshes();
    this.createMeshes(width, height);
  }

  destroy() {
    this.destroyMeshes();
    this.texture.dispose();
  }

  destroyMeshes() {
    this.hemisphereMesh.destroy();
    this.flatMesh.destroy();
    // hemisphereMesh and flatMesh share the same Material, so we only have to dispose it once.
    (<THREE.Material>this.hemisphereMesh.material).dispose();
  }

  elevationAt(point: THREE.Vector3) {
    return this.terrain.scaleHeight(this.terrain.normalizedHeightAt(point));
  }

  // FIXME: This method is way too long. Needs extraction.
  update(camera: PlanetCamera) {
    // Make the planet mesh and all of its child meshes turn to look at the new camera position.
    this.hemisphereMesh.lookAt(camera.position);
    this.flatMesh.lookAt(camera.position);

    // Change the curvature of the planet mesh and update the colors to reflect the terrain.
    // FIXME: Later, try doing this with a vertex and fragment shader, respectively.
    const topLeftPoint = new THREE.Vector3(), bottomRightPoint = new THREE.Vector3();
    let horizRadiansPerUnit = 0, vertRadiansPerUnit = 0;
    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();
    let currentMesh: PlanetMesh;

    // When we're zoomed far out, the planet mesh is shaped like a hemisphere.
    // When we're zoomed close in, the planet mesh is a rectangular patch of the sphere's surface that fills the camera.
    if (camera.copyPlanetIntersectionPoints(topLeftPoint, bottomRightPoint)) { // camera close to planet
      this.rotateCornersToEquator(topLeftPoint, bottomRightPoint);
      const topLeftSph = sphericalFromCoords(topLeftPoint);
      const bottomRightSph = sphericalFromCoords(bottomRightPoint);
      horizRadiansPerUnit = Math.abs(bottomRightSph.theta - topLeftSph.theta) / (this.flatMesh.horizontalVertices - 1);
      vertRadiansPerUnit = Math.abs(bottomRightSph.phi - topLeftSph.phi) / (this.flatMesh.verticalVertices - 1);

      currentMesh = this.flatMesh;
      if (!this.fillsCamera) {
        this.fillsCamera = true;
        if (this.hemisphereMesh.edges) {
          this.hemisphereMesh.hideEdges();
          this.flatMesh.showEdges();
        }
        this.hemisphereMesh.visible = false;
        this.flatMesh.visible = true;
      }

    } else {
      horizRadiansPerUnit = Math.PI / this.hemisphereMesh.horizontalVertices; // camera is far away
      vertRadiansPerUnit = Math.PI / this.hemisphereMesh.verticalVertices;

      currentMesh = this.hemisphereMesh;
      if (this.fillsCamera) {
        this.fillsCamera = false;
        if (this.flatMesh.edges) {
          this.flatMesh.hideEdges();
          this.hemisphereMesh.showEdges();
        }
        this.flatMesh.visible = false;
        this.hemisphereMesh.visible = true;
      }
    }

    const positions = currentMesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const u = i % currentMesh.horizontalVertices;
      const v = Math.floor(i / currentMesh.horizontalVertices);

      // Calculate where this vertex should go on the sea-level sphere.
      sphereCoords.theta = horizRadiansPerUnit * (u - currentMesh.halfHorizLength);
      sphereCoords.phi = vertRadiansPerUnit * (v - currentMesh.halfVertLength) + Math.PI / 2;
      sphereCoords.radius = Planet.radius;
      newPosition.setFromSpherical(sphereCoords);

      // Add terrain height to the vertex.
      const worldPosition = currentMesh.localToWorld(newPosition.clone());
      const height = this.terrain.normalizedHeightAt(worldPosition);
      this.paintTextureOnVertex(currentMesh, u, v, worldPosition, height);
      if (height > 0) {
        sphereCoords.radius += this.terrain.scaleHeight(height);
        newPosition.setFromSpherical(sphereCoords);
      }
      positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
    }
    updateGeometry(currentMesh.geometry);
    this.texture.needsUpdate = true;
    console.log(`min: ${this.terrain.min}. max: ${this.terrain.max}.`);

    if (currentMesh.edges) {
      currentMesh.hideEdges();
      currentMesh.showEdges();
    }
    this.visualHelper.update();
  }

  // For the flat mesh, the math for working out the angles only works if we assume that all points lie near the
  // equator, but freaks out around the poles. The simplest (though not necessarily best) solution is to just move
  // the corners to near the equator before we calculate the mesh deformation.
  protected rotateCornersToEquator(topLeft: THREE.Vector3, bottomRight: THREE.Vector3) {
    const rotation = new THREE.Quaternion().setFromEuler(this.flatMesh.rotation).conjugate();
    topLeft.applyQuaternion(rotation);
    bottomRight.applyQuaternion(rotation);
  }

  // FIXME: This should be done by a fragment shader eventually. This is a terrible way to blit pixels.
  protected paintTextureOnVertex(mesh: PlanetMesh, x: number, y: number, worldPosition: THREE.Vector3, height: number) {
    const u = x * mesh.horizontalTexelsPerVertex, v = y * mesh.verticalTexelsPerVertex;
    const biome = this.terrain.biomeAt(worldPosition, height);
    const swatch = Math.abs(worldPosition.x) ^ Math.abs(worldPosition.y) ^ Math.abs(worldPosition.z) ^ height;
    const atlasStart = ATLAS_INDEX[biome][Math.floor(swatch) % 4] * 4;

    this.copier.copy(atlasStart, u, v);
  }

  // Optional white lines outlining each face of the mesh.
  toggleEdgesVisible() {
    const currentMesh = this.fillsCamera ? this.flatMesh : this.hemisphereMesh;
    if (currentMesh.edges === null) {
      currentMesh.showEdges();
    } else {
      currentMesh.hideEdges();
    }
  }
};
