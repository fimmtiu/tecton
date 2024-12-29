import * as THREE from "three";

import { PlanetCamera } from "./planet_camera";
import { ORIGIN } from "./util";
import { updateGeometry } from "./util/geometry";
import { Terrain } from "./terrain";
import { VisualHelper } from "./visual_helper";
import { scene } from "./scene_data";
import { TextureManager } from "./texture_manager";
import { TextureCopier } from "./texture_copier";
import { PlanetMesh } from "./planet_mesh";
import { Climate } from "./climate";

export { Planet, PLANET_RADIUS };

const PIXELS_BETWEEN_VERTICES = 10;
const PLANET_RADIUS = 6370; // each unit is 1 kilometer
const TEXTURE_SIZE = 1600;
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

  constructor(viewportWidth: number, viewportHeight: number) {
    this.sphere = new THREE.Sphere(ORIGIN, PLANET_RADIUS);
    this.width = viewportWidth;
    this.height = viewportHeight;
    this.visualHelper = new VisualHelper(true, false);
    this.terrain = new Terrain();
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

    this.mesh = new PlanetMesh(
      viewportWidth, viewportHeight,
      Math.max(horizontalVertices, verticalVertices),
      Math.max(horizontalVertices, verticalVertices),
      new THREE.MeshStandardMaterial({ map: this.texture, side: THREE.FrontSide })
    );
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
    this.mesh.destroy();
    this.texture.dispose();
  }

  dataAtPoint(pointOnSphere: THREE.Vector3) {
    return this.terrain.dataAtPoint(pointOnSphere);
  }

  // When we're zoomed far out, the planet mesh is shaped like a hemisphere.
  // When we're zoomed close in, the planet mesh is a rectangular patch of the sphere's surface that fills the camera.
  // FIXME: This method is too long. Needs extraction.
  update(camera: PlanetCamera) {
    // Make the planet mesh and all of its child meshes turn to look at the new camera position.
    // FIXME: Is it a problem that we calculate visible radians before calling lookAt() to move the mesh?
    this.mesh.lookAt(camera.position);

    const horizRadiansPerCell = camera.horizontalRadiansInView / this.mesh.horizontalVertices;
    const vertRadiansPerCell = camera.verticalRadiansInView / this.mesh.verticalVertices;
    const positions = this.mesh.geometry.getAttribute("position");
    const sphereCoords = new THREE.Spherical();
    const newPosition = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      const u = i % this.mesh.horizontalVertices;
      const v = Math.floor(i / this.mesh.horizontalVertices);

      // Calculate where this vertex should go on the sea-level sphere.
      sphereCoords.theta = horizRadiansPerCell * (u - this.mesh.halfHorizLength);
      sphereCoords.phi = vertRadiansPerCell * (v - this.mesh.halfVertLength) + Math.PI / 2;
      sphereCoords.radius = PLANET_RADIUS;
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
    // console.log(`min: ${this.terrain.min}. max: ${this.terrain.max}.`);

    this.visualHelper.update();
  }

  // FIXME: This should be done by a fragment shader eventually. This is a ludicrously bad way to blit pixels.
  protected paintTextureOnVertex(mesh: PlanetMesh, x: number, y: number, worldPosition: THREE.Vector3, height: number) {
    const u = x * mesh.horizontalTexelsPerVertex, v = y * mesh.verticalTexelsPerVertex;
    const biome = this.terrain.biomeAt(worldPosition, height);
    const swatch = Math.abs(worldPosition.x) ^ Math.abs(worldPosition.y) ^ Math.abs(worldPosition.z) ^ height;
    const atlasStart = ATLAS_INDEX[biome][Math.floor(swatch) % 4] * 4;

    this.copier.copy(atlasStart, u, v);
  }
};
