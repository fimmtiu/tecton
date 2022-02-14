import * as THREE from "three";
import { Planet } from "./planet";

export { TerrainChunk };

class TerrainChunk {
  public elevation: number;
  public ruggedness: number;
  public moisture: number;
  public temperature: number;
  public worldSpaceLocation: THREE.Vector3;
  public neighbors: Array<TerrainChunk>;
  public velocity: THREE.Vector2;

  constructor(location: THREE.Vector3) {
    this.elevation = this.ruggedness = this.moisture = this.temperature = 0;
     // Ensure it's on the planet's surface, not slightly above or below
    this.worldSpaceLocation = location.normalize().multiplyScalar(Planet.radius);
    this.neighbors = [];
    this.velocity = new THREE.Vector2(0, 0);
  }

  addNeighbors(chunks: Array<TerrainChunk>) {
    for (let chunk of chunks) {
      if (!this.neighbors.includes(chunk)) {
        this.neighbors.push(chunk);
      }
    }
  }
}
