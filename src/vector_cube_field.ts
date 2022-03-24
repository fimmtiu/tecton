import * as THREE from "three";

import { CubeField } from "./cube_field";

export { VectorCubeField };

const VECTOR_SPREAD = Math.PI * 0.25;
const UNIT_GRID_ANGLES = [
  Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75,
  Math.PI,        null,          0,
  Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.25,
];

const NONE = 1;  // FIXME good candidiates for an enum
const TURN_LEFT = 2;
const TURN_RIGHT = 3;
const TURN_AROUND = 4;

class VectorCubeField extends CubeField<THREE.Vector2> {
  static readonly northVectors = [
    new THREE.Vector3(0,  1,  0), // right face
    new THREE.Vector3(0,  1,  0), // left face
    new THREE.Vector3(0,  0, -1), // top face
    new THREE.Vector3(0,  0,  1), // bottom face
    new THREE.Vector3(0,  1,  0), // front face
    new THREE.Vector3(0, -1,  0), // back face
  ];
  static readonly turns = [
    [null,        null,        TURN_LEFT,  TURN_LEFT,  NONE, NONE], // right face
    [null,        null,        TURN_RIGHT, TURN_RIGHT, NONE, NONE], // left face
    [TURN_RIGHT,  TURN_LEFT,   null,       null,       NONE, NONE], // top face
    [TURN_LEFT,   TURN_RIGHT,  null,       null,       NONE, NONE], // bottom face
    [NONE,        NONE,        NONE,       NONE,       null, null], // front face
    [TURN_AROUND, TURN_AROUND, NONE,       NONE,       null, null], // back face
  ]

  // protected arrows: Array<THREE.ArrowHelper>;

  constructor(cellsPerEdge: number) {
    super(cellsPerEdge, () => { return new THREE.Vector2() });

    // this.arrows = [];

    // FIXME: Fill faces with arbitrary values for debugging.
    //                            0: up                         1: right                2: up+right                    3: down                      4: left                    5: down+left
    // const fake_vectors = [new THREE.Vector2(0, 300), new THREE.Vector2(300, 0), new THREE.Vector2(300, 300), new THREE.Vector2(0, -300), new THREE.Vector2(-300, 0), new THREE.Vector2(-300, -300)];
    const fake_vectors = [new THREE.Vector2(0, 300), new THREE.Vector2(0, 300), new THREE.Vector2(0, 300), new THREE.Vector2(0, 300), new THREE.Vector2(0, 300), new THREE.Vector2(0, 300)];
    for (let i = 0; i < super.cellCount; i++) {
      const vec = fake_vectors[Math.floor(super.cellCount / i)];
      super.get(i).copy(vec);
    }

    // this.updateArrows();
  }

  destroy() {
    // for (let arrow of this.arrows) {
    //   scene.remove(arrow);
    // }
  }

  // Draw an arrow on each face representing the direction and magnitude of its vector.
  // updateArrows() {
  //   for (let arrow of this.arrows) {
  //     scene.remove(arrow);
  //   }
  //   this.arrows = [];

  //   const positions = this.cells.geometry.getAttribute("position");
  //   for (let face = 0; face < 6; face++) {
  //     for (let i = 0; i < CELLS_PER_FACE; i++) {
  //       const index = face * CELLS_PER_FACE + i;
  //       const arrowOrigin = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
  //       const plane = new THREE.Plane(arrowOrigin.clone().normalize(), -PLANET_RADIUS * 1.02);
  //       const pointAbovePlane = this.faces[face].northVector.clone().add(arrowOrigin).multiplyScalar(1.1);
  //       const direction = new THREE.Vector3();
  //       plane.projectPoint(pointAbovePlane, direction);
  //       // let vh = new VisualHelper(false, false);
  //       // vh.setPoints([arrowOrigin]);
  //       // const arrow = new THREE.ArrowHelper(direction.sub(arrowOrigin).normalize(), arrowOrigin, this.faces[face].data[i].distanceTo(ORIGIN_2D));
  //       // scene.add(arrow);
  //       // this.arrows.push(arrow);
  //     }
  //   }
  // }

  update() {
    for (let i = 0; i < super.cellCount; i++) {
      const face = Math.floor(super.cellCount / i);

    }

    // this.updateArrows();
  }

  protected updateCell(cell: number, vec: THREE.Vector2) {
    this.get(cell)
  }

  // When passing from one face to another, sometimes we have to rotate the vector
  // to be relative to the new face's "north".
  protected rotatedVector(vec: THREE.Vector2, srcFace: number, destFace: number) {
    const newVec = vec.clone();

    switch (VectorCubeField.turns[srcFace][destFace]) {
    case TURN_LEFT:
      newVec.set(newVec.y, -newVec.x);
      break;
    case TURN_RIGHT:
      newVec.set(-newVec.y, newVec.x);
      break;
    case TURN_AROUND:
      newVec.set(-newVec.x, -newVec.y);
      break;
    }

    return newVec;
  }
}

class FieldFace {
  public northTransform: number;
  public southTransform: number;
  public eastTransform: number;
  public westTransform: number;
  public northNeighbour: FieldFace | null;
  public southNeighbour: FieldFace | null;
  public eastNeighbour: FieldFace | null;
  public westNeighbour: FieldFace | null;
  public northVector: THREE.Vector3;
  public data: Array<THREE.Vector2>;
  public newData: Array<THREE.Vector2>;

  constructor(northTransform: number, southTransform: number, eastTransform: number, westTransform: number) {
    this.northTransform = northTransform;
    this.southTransform = southTransform;
    this.eastTransform = eastTransform;
    this.westTransform = westTransform;
    this.northNeighbour = this.southNeighbour = this.eastNeighbour = this.westNeighbour = null;
    this.data = Array(CELLS_PER_FACE);
    this.newData = Array(CELLS_PER_FACE);
    this.northVector = new THREE.Vector3();

    for (let i = 0; i < CELLS_PER_FACE; i++) {
      this.data[i] = new THREE.Vector2();
      this.newData[i] = new THREE.Vector2();
    }
  }

  setNeighbours(north: FieldFace, south: FieldFace, east: FieldFace, west: FieldFace) {
    this.northNeighbour = north;
    this.southNeighbour = south;
    this.eastNeighbour = east;
    this.westNeighbour = west;
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
        this.addVectorToNeighbour(x, y, i, vec.multiplyScalar(ratio));
        changes++;
      }
    }
  }

  // FIXME: This is an ugly method. I'll come back and clean it up later.
  // `dir` indicates the direction like so:
  //     0 1 2
  //     3 * 5
  //     6 7 8
  protected addVectorToNeighbour(x: number, y: number, dir: number, vec: THREE.Vector2) {
    const left_x = 0, right_x = CELLS_PER_EDGE - 1;
    const top_y = 0, bottom_y = CELLS_PER_EDGE - 1;
    const top_left = 0;
    const top_right = CELLS_PER_EDGE - 1;
    const bottom_left = CELLS_PER_EDGE * (CELLS_PER_EDGE - 1);
    const bottom_right = CELLS_PER_FACE - 1;

    switch(dir) {
    case 0:
      if (x == left_x && y == top_y) { // top left corner
        this.updateNorthwestAcrossEdge(vec, bottom_right);
      } else if (y == top_y) { // top row
        this.updateNorthAcrossEdge(vec, bottom_left + x);
      } else if (x == left_x) { // left side
        this.updateWestAcrossEdge(vec, y * CELLS_PER_EDGE + right_x);
      } else {
        this.newData[(y - 1) * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 1:
      if (y == 0) { // top row
        this.updateNorthAcrossEdge(vec, bottom_left + x);
      } else {
        this.newData[(y - 1) * CELLS_PER_EDGE + x].add(vec);
      }
      break;
    case 2:
      if (x == right_x && y == top_y) { // top right corner
        this.updateNortheastAcrossEdge(vec, bottom_left);
      } else if (y == top_y) { // top row
        this.updateNorthAcrossEdge(vec, bottom_left + x);
      } else if (x == right_x) { // right side
        this.updateEastAcrossEdge(vec, y * CELLS_PER_EDGE);
      } else {
        this.newData[(y - 1) * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 3:
      if (x == left_x) { // left side
        this.updateWestAcrossEdge(vec, y * CELLS_PER_EDGE + right_x);
      } else {
        this.newData[y * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 5:
      if (x == right_x) { // right side
        this.updateEastAcrossEdge(vec, y * CELLS_PER_EDGE);
      } else {
        this.newData[y * CELLS_PER_EDGE + (x + 1)].add(vec);
      }
      break;
    case 6:
      if (x == left_x && y == bottom_y) { // bottom left corner
        this.updateSouthwestAcrossEdge(vec, top_right);
      } else if (y == bottom_y) { // bottom row
        this.updateSouthAcrossEdge(vec, x);
      } else if (x == left_x) { // left side
        this.updateWestAcrossEdge(vec, y * CELLS_PER_EDGE + right_x);
      } else {
        this.newData[(y + 1) * CELLS_PER_EDGE + (x - 1)].add(vec);
      }
      break;
    case 7:
      if (y == bottom_y) { // bottom row
        this.updateSouthAcrossEdge(vec, x);
      } else {
        this.newData[(y + 1) * CELLS_PER_EDGE + x].add(vec);
      }
      break;
    case 8:
      if (x == right_x && y == bottom_y) { // bottom right corner
        this.updateSoutheastAcrossEdge(vec, top_left);
      } else if (y == bottom_y) { // bottom row
        this.updateSouthAcrossEdge(vec, x);
      } else if (x == right_x) { // right side
        this.updateEastAcrossEdge(vec, y * CELLS_PER_EDGE);
      } else {
        this.newData[(y + 1) * CELLS_PER_EDGE + (x + 1)].add(vec);
      }
      break;
    }
  }

  // When we pass between two sides, sometimes we need to point the vector in a different 90-degree direction
  // to keep it consistent as it wraps around the cube.
  transformVector(vec: THREE.Vector2, transform: number) {
    switch(transform) {
    case NONE:
      break;
    case TURN_LEFT:
      vec.set(vec.y, -vec.x);
      break;
    case TURN_RIGHT:
      vec.set(-vec.y, vec.x);
      break;
    case TURN_AROUND:
      vec.set(-vec.x, -vec.y);
      break;
    }
  }

  // FIXME: Bug: these transforms aren't commutative, so order matters, so diagonals don't make sense
  // and we're going to get weird artifacts at corners. Need to revisit it so that we spread corner
  // vectors between both adjacent faces.
  updateNorthwestAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.northTransform);
    this.transformVector(vec, (<FieldFace>this.northNeighbour).westTransform);
    this.northNeighbour?.westNeighbour?.newData[index].add(vec);
  }

  updateNorthAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.northTransform);
    this.northNeighbour?.newData[index].add(vec);
  }

  updateNortheastAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.northTransform);
    this.transformVector(vec, (<FieldFace>this.northNeighbour).eastTransform);
    this.northNeighbour?.eastNeighbour?.newData[index].add(vec);
  }

  updateEastAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.eastTransform);
    this.eastNeighbour?.newData[index].add(vec);
  }

  updateSoutheastAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.southTransform);
    this.transformVector(vec, (<FieldFace>this.southNeighbour).eastTransform);
    this.southNeighbour?.eastNeighbour?.newData[index].add(vec);
  }

  updateSouthAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.southTransform);
    this.southNeighbour?.newData[index].add(vec);
  }

  updateSouthwestAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.southTransform);
    this.transformVector(vec, (<FieldFace>this.southNeighbour).westTransform);
    this.southNeighbour?.westNeighbour?.newData[index].add(vec);
  }

  updateWestAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.westTransform);
    this.westNeighbour?.newData[index].add(vec);
  }
}
