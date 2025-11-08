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

const SWATCH_SIZE = 16;
function texStartsAt(x: number, y: number) : THREE.Box2[] {
  const startPoints = [
    new THREE.Vector2(SWATCH_SIZE * x, SWATCH_SIZE * y),
    new THREE.Vector2(SWATCH_SIZE * (x + 1), SWATCH_SIZE * y),
    new THREE.Vector2(SWATCH_SIZE * x, SWATCH_SIZE * (y + 1)),
    new THREE.Vector2(SWATCH_SIZE * (x + 1), SWATCH_SIZE * (y + 1)),
  ];
  return startPoints.map(function (v: THREE.Vector2) {
    const endPoint = new THREE.Vector2();
    endPoint.copy(v).addScalar(SWATCH_SIZE);
    return new THREE.Box2(v, endPoint);
  });
}

const PIXELS_BETWEEN_VERTICES = 10;
const PLANET_RADIUS = 6370; // each unit is 1 kilometer
const TEXTURE_SIZE = 1600;
const ATLAS_INDEX: { [biomeName: string]: THREE.Box2[] } = {
  "snow": texStartsAt(0, 0),
  "jungle": texStartsAt(0, 2),
  "forest": texStartsAt(0, 4),
  "plain": texStartsAt(0, 6),
  "mountain": texStartsAt(2, 0),
  "desert": texStartsAt(2, 2),
  "grassland": texStartsAt(2, 4),
  "water1": texStartsAt(2, 6),
  "water2": texStartsAt(4, 0),
  "water3": texStartsAt(4, 2),
  "water4": texStartsAt(4, 4),
  "water5": texStartsAt(4, 6),
  "water6": texStartsAt(6, 0),
  "water7": texStartsAt(6, 2),
  "water8": texStartsAt(6, 4),
  "water9": texStartsAt(6, 6),
}

class Planet {
  public sphere: THREE.Sphere;
  protected mesh!: PlanetMesh;
  public visualHelper: VisualHelper;   // FIXME: Change back to protected when we're done debugging.
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
      new THREE.MeshStandardMaterial({ map: this.texture, side: THREE.FrontSide }),
      true
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
      const height = this.terrain.heightAt(worldPosition);
      this.paintTextureOnVertex(this.mesh, u, v, worldPosition, height);
      if (height > 0) {
        sphereCoords.radius += height;
        newPosition.setFromSpherical(sphereCoords);
      }
      this.mesh.updatePoint(i, newPosition);
    }

    this.mesh.update();
    // FIXME debugging
    let pointsInCameraView = 0;
    const showPoints = [];

    for (let i = 0; i < positions.count; i++) {
      const worldPosition = this.mesh.localToWorld(newPosition.clone());

      if (i == 0 || i == positions.count - 1 || i == this.mesh.horizontalVertices - 1 || i == this.mesh.verticalVertices - 1) {
        showPoints.push(worldPosition);
      }
      if (camera.frustum.containsPoint(worldPosition)) {
        pointsInCameraView++;
      }
    }
    this.visualHelper.setPoints(showPoints);
    console.log(`Points in camera view: ${pointsInCameraView} of ${positions.count} (${pointsInCameraView / positions.count * 100}%)`);
    // FIXME end debugging

    this.texture.needsUpdate = true;
    this.visualHelper.update();
  }

  // FIXME: This should be done by a fragment shader eventually. This is a ludicrously bad way to blit pixels.
  protected paintTextureOnVertex(mesh: PlanetMesh, x: number, y: number, worldPosition: THREE.Vector3, height: number) {
    const u = x * mesh.horizontalTexelsPerVertex, v = y * mesh.verticalTexelsPerVertex;
    const biome = this.terrain.biomeAt(worldPosition, height);
    // Always use the same swatch for a given vertex.
    const swatch = Math.abs(worldPosition.x ^ worldPosition.y ^ worldPosition.z ^ height);
    const atlasStart = ATLAS_INDEX[biome][Math.floor(swatch) % 4];

    this.copier.copy(atlasStart.min, u, v);
  }
}
