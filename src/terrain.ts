import * as THREE from "three";
import { Planet } from "./planet";
import { Tectonics } from "./tectonics";
import { VisualHelper } from "./visual_helper";

export { Terrain };

class Terrain {
  protected planet: Planet; // FIXME: Don't need this circular dependency long-term. Just for debugging.
  protected visualHelper: VisualHelper;
  protected tectonics: Tectonics;

  constructor(planet: Planet) {
    this.planet = planet;
    this.visualHelper = new VisualHelper(false, false);
    this.tectonics = new Tectonics();
  }

  // // This is all hideously inefficient, but we only do it once at the start.
  // generateInitialChunks() {
  //   // First, generate an icosahedron around the planet's surface. Each vertex will be one chunk.
  //   const icosahedron = new THREE.IcosahedronGeometry(Planet.radius, 30);
  //   const positions = icosahedron.getAttribute("position");
  //   console.log(`positions: ${positions.count}, size ${positions.itemSize}, array ${positions.array.length}`);
  //   let chunksByLocation: { [id: string]: TerrainChunk } = {};
  //   let edgeGeometry = new THREE.EdgesGeometry(icosahedron, 0);
  //   edgeGeometry.scale(1.004, 1.004, 1.004); // Keep the lines from clipping through the planet surface
  //   const edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
  //   this.scene.add(edges);

  //   // Next, generate one TerrainChunk for each vertex in the icosahedron.
  //   for (let i = 0; i < positions.count; i++) {
  //     const location = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
  //     const key = this.vertexKey(location);
  //     if (!(key in chunksByLocation)) {
  //       const chunk = new TerrainChunk(location, this.scene);
  //       this.chunks.push(chunk);
  //       chunksByLocation[key] = chunk;
  //     }
  //   }

  //   // Finally, iterate over each face and add all of the points' chunks to each others' neighbour lists.
  //   for (let i = 0; i < positions.count; i += 3) {
  //     const a = new THREE.Vector3(positions.getX(i + 0), positions.getY(i + 0), positions.getZ(i + 0));
  //     const b = new THREE.Vector3(positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1));
  //     const c = new THREE.Vector3(positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2));
  //     const chunkA = chunksByLocation[this.vertexKey(a)];
  //     const chunkB = chunksByLocation[this.vertexKey(b)];
  //     const chunkC = chunksByLocation[this.vertexKey(c)];
  //     chunkA.addNeighbors([chunkB, chunkC]);
  //     chunkB.addNeighbors([chunkA, chunkC]);
  //     chunkC.addNeighbors([chunkA, chunkB]);
  //   }

  //   Object.entries(chunksByLocation)[0][1].drawArrows();
  // }

  // // The icosahedron isn't an indexed geometry and floating-point numbers are notoriously imprecise, so we
  // // round them to integers before making a unqiue identifier out of them.
  // protected vertexKey(v: THREE.Vector3) {
  //   return `${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`;
  // }
}
