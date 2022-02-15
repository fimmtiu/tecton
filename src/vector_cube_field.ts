import * as THREE from "three";
import { Planet, PLANET_RADIUS } from "./planet";
import { scene } from "./scene_data";

export { VectorCubeField };

const SIDE_LENGTH = PLANET_RADIUS;
const SEGMENTS = 5;

class VectorCubeField {
  static readonly segments = SEGMENTS;

  protected box: THREE.BoxBufferGeometry;
  protected edges: THREE.LineSegments;
  protected fields: Array<FieldFace>;

  constructor() {
    this.box = new THREE.BoxBufferGeometry(SIDE_LENGTH, SIDE_LENGTH, SIDE_LENGTH, SEGMENTS, SEGMENTS, SEGMENTS);
    this.fields = Array(6);
    for (let i = 0; i < 6; i++) {
      this.fields[i] = new FieldFace();
    }
    this.fields[0].setNeighbors(this.fields[1], this.fields[4], this.fields[3], this.fields[2]);
    this.fields[1].setNeighbors(this.fields[5], this.fields[0], this.fields[3], this.fields[2]);
    this.fields[2].setNeighbors(this.fields[0], this.fields[5], this.fields[4], this.fields[1]);
    this.fields[3].setNeighbors(this.fields[1], this.fields[4], this.fields[5], this.fields[0]);
    this.fields[4].setNeighbors(this.fields[0], this.fields[5], this.fields[3], this.fields[2]);
    this.fields[5].setNeighbors(this.fields[4], this.fields[1], this.fields[3], this.fields[2]);

    console.log(`wtf`);
    this.edges = new THREE.LineSegments(this.box, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.edges.renderOrder = 99999999;
    scene.add(this.edges);
  }
}

class FieldFace {
  public northNeighbor: FieldFace | null;
  public southNeighbor: FieldFace | null;
  public eastNeighbor: FieldFace | null;
  public westNeighbor: FieldFace | null;
  public data: Array<THREE.Vector2>;

  constructor() {
    this.northNeighbor = this.southNeighbor = this.eastNeighbor = this.westNeighbor = null;
    this.data = Array(SEGMENTS);
    for (let i = 0; i < SEGMENTS; i++) {
      this.data[i] = new THREE.Vector2();
    }
  }

  setNeighbors(north: FieldFace, south: FieldFace, east: FieldFace, west: FieldFace) {
    this.northNeighbor = north;
    this.southNeighbor = south;
    this.eastNeighbor = east;
    this.westNeighbor = west;
  }
}
