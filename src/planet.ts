import * as THREE from "three";

import { PlanetCamera } from "./planet_camera";
import { ORIGIN, sphericalFromCoords } from "./util";
import { updateGeometry } from "./util/geometry";
import { Terrain } from "./terrain";
import { VisualHelper } from "./visual_helper";
import { scene } from "./scene_data";
import { TextureManager } from "./texture_manager";
import { TextureCopier } from "./texture_copier";
import { PlanetMesh } from "./planet_mesh";
import { Tectonics } from "./tectonics";
import { Climate } from "./climate";

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
  protected mesh!: PlanetMesh;
  protected visualHelper: VisualHelper;
  protected terrain: Terrain;
  protected climate: Climate;
  protected textureData: Uint8ClampedArray;
  protected texture: THREE.DataTexture;
  protected atlas: THREE.DataTexture;
  protected copier: TextureCopier;
  protected width: number;
  protected height: number;
  protected tectonics: Tectonics;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.sphere = new THREE.Sphere(ORIGIN, Planet.radius);
    this.width = viewportWidth;
    this.height = viewportHeight;
    this.visualHelper = new VisualHelper(true, true);
    this.terrain = new Terrain();
    this.tectonics = new Tectonics();
    this.climate = new Climate();
    this.textureData = new Uint8ClampedArray(TEXTURE_SIZE ** 2 * 4);

    this.texture = new THREE.DataTexture(this.textureData, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
    this.texture.flipY = true;
    this.atlas = TextureManager.dataTextures["atlas.png"];
    this.atlas.flipY = true;
    this.copier = new TextureCopier(this.atlas, this.texture, SWATCH_SIZE);

    this.createMesh(viewportWidth, viewportHeight);
  }

  createMesh(viewportWidth: number, viewportHeight: number) {
    const horizontalVertices = Math.ceil(viewportWidth / PIXELS_BETWEEN_VERTICES) + 2;
    const verticalVertices = Math.ceil(viewportHeight / PIXELS_BETWEEN_VERTICES) + 2;

    const material = new THREE.MeshStandardMaterial({ map: this.texture, side: THREE.FrontSide });

    this.mesh = new PlanetMesh(viewportWidth, viewportHeight, horizontalVertices, verticalVertices, material);
    scene.add(this.mesh);
  }

  resize(width: number, height: number) {
    // Don't do anything with spurious resize events; only destroy stuff if things have actually changed.
    if (width != this.width || height != this.height) {
      this.mesh.destroy();
      this.createMesh(width, height);
    }
  }

  destroy() {
    this.tectonics.destroy();
    this.mesh.destroy();
    this.texture.dispose();
  }

  dataAtPoint(worldPos: THREE.Vector3) {
    const plateData = this.tectonics.plateSphere.dataAtPoint(worldPos);
    return {
      "elevation": Math.round(this.terrain.scaleHeight(this.terrain.normalizedHeightAt(worldPos)) * 1000),
      "voronoiCell": plateData.cell.id,
      "neighbours": plateData.neighbours,
      "plate": plateData.plate.id,
    }
  }

  // FIXME: This method is too long. Needs extraction.
  update(camera: PlanetCamera) {
    // Make the planet mesh and all of its child meshes turn to look at the new camera position.
    this.mesh.lookAt(camera.position);
    this.mesh.visible = false;

    // Change the curvature of the planet mesh and update the colors to reflect the terrain.
    // FIXME: Later, try doing this with a vertex and fragment shader, respectively.
    const topLeftPoint = new THREE.Vector3(), bottomRightPoint = new THREE.Vector3();
    let horizRadiansPerUnit = 0, vertRadiansPerUnit = 0;
    let sphereCoords = new THREE.Spherical(Planet.radius, 0, 0);
    let newPosition = new THREE.Vector3();

    // When we're zoomed far out, the planet mesh is shaped like a hemisphere.
    // When we're zoomed close in, the planet mesh is a rectangular patch of the sphere's surface that fills the camera.
    if (camera.copyPlanetIntersectionPoints(topLeftPoint, bottomRightPoint)) { // camera close to planet
      this.rotateCornersToEquator(topLeftPoint, bottomRightPoint);
      const topLeftSph = sphericalFromCoords(topLeftPoint);
      const bottomRightSph = sphericalFromCoords(bottomRightPoint);
      horizRadiansPerUnit = Math.abs(bottomRightSph.theta - topLeftSph.theta) / (this.mesh.horizontalVertices - 1);
      vertRadiansPerUnit = Math.abs(bottomRightSph.phi - topLeftSph.phi) / (this.mesh.verticalVertices - 1);
    } else {
      horizRadiansPerUnit = Math.PI / this.mesh.horizontalVertices; // camera is far away
      vertRadiansPerUnit = Math.PI / this.mesh.verticalVertices;
    }

    const positions = this.mesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const u = i % this.mesh.horizontalVertices;
      const v = Math.floor(i / this.mesh.horizontalVertices);

      // Calculate where this vertex should go on the sea-level sphere.
      sphereCoords.theta = horizRadiansPerUnit * (u - this.mesh.halfHorizLength);
      sphereCoords.phi = vertRadiansPerUnit * (v - this.mesh.halfVertLength) + Math.PI / 2;
      sphereCoords.radius = Planet.radius;
      newPosition.setFromSpherical(sphereCoords);

      // Add terrain height to the vertex.
      const worldPosition = this.mesh.localToWorld(newPosition.clone());
      const height = this.terrain.normalizedHeightAt(worldPosition);
      this.paintTextureOnVertex(this.mesh, u, v, worldPosition, height);
      if (height > 0) {
        sphereCoords.radius += this.terrain.scaleHeight(height);
        newPosition.setFromSpherical(sphereCoords);
      }
      positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
    }
    updateGeometry(this.mesh.geometry);
    this.texture.needsUpdate = true;
    console.log(`min: ${this.terrain.min}. max: ${this.terrain.max}.`);

    if (this.mesh.edges) {
      this.mesh.hideEdges();
      this.mesh.showEdges();
    }
    this.visualHelper.update();
  }

  // For the flat mesh, the math for working out the angles only works if we assume that all points lie near the
  // equator, but freaks out around the poles. The simplest (though not necessarily best) solution is to just move
  // the corners to near the equator before we calculate the mesh deformation.
  protected rotateCornersToEquator(topLeft: THREE.Vector3, bottomRight: THREE.Vector3) {
    const rotation = new THREE.Quaternion().setFromEuler(this.mesh.rotation).conjugate();
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
    if (this.mesh.edges === null) {
      this.mesh.showEdges();
    } else {
      this.mesh.hideEdges();
    }
  }
};
