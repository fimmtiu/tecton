import * as THREE from "three";
import { PLANET_RADIUS } from "./planet";
import { scene } from "./scene_data";

export { VectorCubeField };

const CELLS_PER_EDGE = 10;
const CELLS_PER_FACE = CELLS_PER_EDGE ** 2;
const VERTICES_PER_FACE = (CELLS_PER_EDGE + 1) ** 2;
const VECTOR_SPREAD = Math.PI * 0.25;
const UNIT_GRID_ANGLES = [
  Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75,
  Math.PI,        null,          0,
  Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.25,
];

class VectorCubeField {
  protected box: THREE.BoxGeometry; // FIXME: Once we've got the cells, we probably don't need the box any more.
  protected edges: THREE.LineSegments; // FIXME: just for visualization, can remove later
  protected cells: THREE.Points;
  protected fields: Array<FieldFace>;
  protected arrows: Array<THREE.ArrowHelper>;

  constructor() {
    const SIDE_LENGTH = 2 * PLANET_RADIUS;
    this.box = new THREE.BoxGeometry(SIDE_LENGTH, SIDE_LENGTH, SIDE_LENGTH, CELLS_PER_EDGE, CELLS_PER_EDGE, CELLS_PER_EDGE);
    const positions = this.box.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      let vec = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      vec.normalize().multiplyScalar(PLANET_RADIUS);
      positions.setXYZ(i, vec.x, vec.y, vec.z);
    }

    this.fields = Array(6);
    this.fields[0] = new FieldFace(new THREE.Vector3(0,  1,  0));
    this.fields[1] = new FieldFace(new THREE.Vector3(0,  0, -1));
    this.fields[2] = new FieldFace(new THREE.Vector3(-1, 0,  0));
    this.fields[3] = new FieldFace(new THREE.Vector3(1,  0,  0));
    this.fields[4] = new FieldFace(new THREE.Vector3(0,  0,  1));
    this.fields[5] = new FieldFace(new THREE.Vector3(0,  -1,  0));
    this.fields[0].setNeighbors(this.fields[1], this.fields[4], this.fields[3], this.fields[2]);
    this.fields[1].setNeighbors(this.fields[5], this.fields[0], this.fields[3], this.fields[2]);
    this.fields[2].setNeighbors(this.fields[0], this.fields[5], this.fields[4], this.fields[1]);
    this.fields[3].setNeighbors(this.fields[1], this.fields[4], this.fields[5], this.fields[0]);
    this.fields[4].setNeighbors(this.fields[0], this.fields[5], this.fields[3], this.fields[2]);
    this.fields[5].setNeighbors(this.fields[4], this.fields[1], this.fields[3], this.fields[2]);

    this.arrows = [];

    // FIXME: just for debugging
    let edgeGeometry = new THREE.EdgesGeometry(this.box, 0);
    edgeGeometry.scale(1.02, 1.02, 1.02);
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(this.edges);

    // Find the center of every rectangular face of the grid and collect them into a Points geometry.
    let points = [];
    let pointsGeometry = new THREE.BufferGeometry();

    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < CELLS_PER_FACE; i++) {
        const tl_i = face * VERTICES_PER_FACE + i + Math.floor(i / CELLS_PER_EDGE);
        const br_i = tl_i + CELLS_PER_EDGE + 2;
        const topLeft = new THREE.Vector3(positions.getX(tl_i), positions.getY(tl_i), positions.getZ(tl_i));
        const bottomRight = new THREE.Vector3(positions.getX(br_i), positions.getY(br_i), positions.getZ(br_i));
        topLeft.add(bottomRight).normalize().multiplyScalar(PLANET_RADIUS * 1.02)
        points.push(topLeft.x, topLeft.y, topLeft.z);
      }
    }

    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.cells = new THREE.Points(pointsGeometry);
    scene.add(this.cells);

    this.updateArrows();
  }

  destroy() {
    this.box.dispose();
    this.edges.geometry.dispose();
    (<THREE.Material>this.edges.material).dispose();
    this.cells.geometry.dispose();
    (<THREE.Material>this.cells.material).dispose();
  }

  updateArrows() {
    for (let arrow of this.arrows) {
      scene.remove(arrow);
    }
    this.arrows = [];

    const positions = this.cells.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const arrowOrigin = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const dir = new THREE.Vector3(); // FIXME FIXME FIXME
      const arrow = new THREE.ArrowHelper(dir, arrowOrigin, 200);
      scene.add(arrow);
      this.arrows.push(arrow);
    }
  }

  update() {
    for (let i = 0; i < 6; i++) {
      this.fields[i].update();
    }

    this.updateArrows();
  }
}

class FieldFace {
  public northNeighbor: FieldFace | null;
  public southNeighbor: FieldFace | null;
  public eastNeighbor: FieldFace | null;
  public westNeighbor: FieldFace | null;
  public normal: THREE.Vector3;
  public data: Array<THREE.Vector2>;
  public newData: Array<THREE.Vector2>;

  constructor(normal: THREE.Vector3) {
    this.northNeighbor = this.southNeighbor = this.eastNeighbor = this.westNeighbor = null;
    this.normal = normal;
    this.data = Array(CELLS_PER_FACE);
    this.newData = Array(CELLS_PER_FACE);

    for (let i = 0; i < CELLS_PER_FACE; i++) {
      this.data[i] = new THREE.Vector2();
      this.newData[i] = new THREE.Vector2();
    }
  }

  setNeighbors(north: FieldFace, south: FieldFace, east: FieldFace, west: FieldFace) {
    this.northNeighbor = north;
    this.southNeighbor = south;
    this.eastNeighbor = east;
    this.westNeighbor = west;
  }

  update() {
    for (let y = 0; y < CELLS_PER_EDGE; y++) {
      for (let x = 0; x < CELLS_PER_EDGE; x++) {
        this.updateNearbyCells(x, y);
      }
    }

    for (let i = 0; i < CELLS_PER_FACE; i++) {
      this.data[i].add(this.newData[i]);
      this.newData[i].set(0, 0);
    }
  }

  protected updateNearbyCells(x: number, y: number) {
    const vec = this.data[y * CELLS_PER_EDGE + x];
    const angle = vec.angle();

    // The 45-degree angle will usually only affect two cells, so we can stop after we update two.
    // In the case of three cells the outer ones will basically have zero vectors, so we ignore that case.
    for (let i = 0, changes = 0; i < UNIT_GRID_ANGLES.length && changes < 2; i++) {
      const grid_angle = UNIT_GRID_ANGLES[i];
      if (grid_angle == null) {
        continue;
      }
      const difference = Math.abs(angle - grid_angle);
      if (difference < VECTOR_SPREAD) {
        const ratio = difference / VECTOR_SPREAD;
        this.addVectorToNeighbor(x, y, i, vec.multiplyScalar(ratio));
        changes++;
      }
    }
  }

  // FIXME: This is an ugly method. I'll come back and clean it up later.
  // `dir` indicates the direction like so:
  //     0 1 2
  //     3 * 5
  //     6 7 8
  protected addVectorToNeighbor(x: number, y: number, dir: number, vec: THREE.Vector2) {
    const left_x = 0, right_x = CELLS_PER_EDGE - 1;
    const top_y = 0, bottom_y = CELLS_PER_EDGE - 1;
    const top_left = 0;
    const top_right = CELLS_PER_EDGE - 1;
    const bottom_left = CELLS_PER_EDGE * (CELLS_PER_EDGE - 1);
    const bottom_right = CELLS_PER_FACE - 1;

    switch(dir) {
    case 0:
      if (x == left_x && y == top_y) { // top left corner
        this.northNeighbor?.westNeighbor?.newData[bottom_right].add(vec);
      } else if (y == top_y) { // top row
        this.northNeighbor?.newData[bottom_left + x].add(vec);
      } else if (x == left_x) { // left side
        this.westNeighbor?.newData[y * CELLS_PER_EDGE + right_x].add(vec);
      } else {
        this.newData[(y - 1) * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 1:
      if (y == 0) { // top row
        this.northNeighbor?.newData[bottom_left + x].add(vec);
      } else {
        this.newData[(y - 1) * CELLS_PER_EDGE + x].add(vec);
      }
      break;
    case 2:
      if (x == right_x && y == top_y) { // top right corner
        this.northNeighbor?.eastNeighbor?.newData[bottom_left].add(vec);
      } else if (y == top_y) { // top row
        this.northNeighbor?.newData[bottom_left + x].add(vec);
      } else if (x == right_x) { // right side
        this.eastNeighbor?.newData[y * CELLS_PER_EDGE].add(vec);
      } else {
        this.newData[(y - 1) * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 3:
      if (x == left_x) { // left side
        this.westNeighbor?.newData[y * CELLS_PER_EDGE + right_x].add(vec);
      } else {
        this.newData[y * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 5:
      if (x == right_x) { // right side
        this.eastNeighbor?.newData[y * CELLS_PER_EDGE].add(vec);
      } else {
        this.newData[y * CELLS_PER_EDGE + (x + 1)].add(vec);
      }
      break;
    case 6:
      if (x == left_x && y == bottom_y) { // bottom left corner
        this.southNeighbor?.westNeighbor?.newData[top_right].add(vec);
      } else if (y == bottom_y) { // bottom row
        this.southNeighbor?.newData[x].add(vec);
      } else if (x == left_x) { // left side
        this.westNeighbor?.newData[y * CELLS_PER_EDGE + right_x].add(vec);
      } else {
        this.newData[(y + 1) * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 7:
      if (y == bottom_y) { // bottom row
        this.southNeighbor?.newData[x].add(vec);
      } else {
        this.newData[(y + 1) * CELLS_PER_EDGE + x].add(vec);
      }
      break;
    case 8:
      if (x == right_x && y == bottom_y) { // bottom right corner
        this.southNeighbor?.eastNeighbor?.newData[top_left].add(vec);
      } else if (y == bottom_y) { // bottom row
        this.southNeighbor?.newData[x].add(vec);
      } else if (x == right_x) { // right side
        this.eastNeighbor?.newData[y * CELLS_PER_EDGE].add(vec);
      } else {
        this.newData[(y + 1) * CELLS_PER_EDGE + (x + 1)].add(vec);
      }
      break;
    }
  }
}
