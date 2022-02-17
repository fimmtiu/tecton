import { dir } from "console";
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet";
import { scene } from "./scene_data";
import { v2s, ORIGIN_2D } from "./util";
import { VisualHelper } from "./visual_helper";

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

const NONE = 1;  // FIXME good candidiates for an enum
const TURN_LEFT = 2;
const TURN_RIGHT = 3;
const TURN_AROUND = 4;

class VectorCubeField {
  protected box: THREE.BoxGeometry; // FIXME: Once we've got the cells, we probably don't need the box any more.
  protected edges: THREE.LineSegments; // FIXME: just for visualization, can remove later
  protected cells: THREE.Points;
  protected faces: Array<FieldFace>;
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

    // Order that three.js creates the faces in:
    // [right, left, top, bottom, front, back]

    this.faces = Array(6);
    this.faces[0] = new FieldFace(TURN_LEFT, TURN_LEFT, NONE, NONE);
    this.faces[1] = new FieldFace(TURN_RIGHT, TURN_RIGHT, NONE, NONE);
    this.faces[2] = new FieldFace(NONE, NONE, TURN_RIGHT, TURN_LEFT);
    this.faces[3] = new FieldFace(NONE, NONE, TURN_LEFT, TURN_RIGHT);
    this.faces[4] = new FieldFace(NONE, NONE, NONE, NONE);
    this.faces[5] = new FieldFace(NONE, NONE, TURN_AROUND, TURN_AROUND);
    this.faces[0].setNeighbors(this.faces[2], this.faces[3], this.faces[5], this.faces[4]);
    this.faces[1].setNeighbors(this.faces[2], this.faces[5], this.faces[4], this.faces[5]);
    this.faces[2].setNeighbors(this.faces[5], this.faces[4], this.faces[0], this.faces[1]);
    this.faces[3].setNeighbors(this.faces[4], this.faces[5], this.faces[0], this.faces[1]);
    this.faces[4].setNeighbors(this.faces[2], this.faces[3], this.faces[0], this.faces[1]);
    this.faces[5].setNeighbors(this.faces[3], this.faces[2], this.faces[0], this.faces[1]);
    this.faces[0].northVector.set(0, 1, 0);
    this.faces[1].northVector.set(0, 1, 0);
    this.faces[2].northVector.set(0, 0, -1);
    this.faces[3].northVector.set(0, 0, 1);
    this.faces[4].northVector.set(0, 1, 0);
    this.faces[5].northVector.set(0, -1, 0);

    this.arrows = [];

    // FIXME: just for debugging
    const edgeGeometry = new THREE.EdgesGeometry(this.box, 0);
    edgeGeometry.scale(1.02, 1.02, 1.02);
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(this.edges);

    // Find the center of every rectangular face of the grid and collect them into a Points geometry.
    const points = [];
    const pointsGeometry = new THREE.BufferGeometry();

    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < CELLS_PER_FACE; i++) {
        const tl_i = face * VERTICES_PER_FACE + i + Math.floor(i / CELLS_PER_EDGE);
        const br_i = tl_i + CELLS_PER_EDGE + 2;
        const topLeft = new THREE.Vector3(positions.getX(tl_i), positions.getY(tl_i), positions.getZ(tl_i));
        const bottomRight = new THREE.Vector3(positions.getX(br_i), positions.getY(br_i), positions.getZ(br_i));
        topLeft.add(bottomRight).normalize().multiplyScalar(PLANET_RADIUS * 1.02);
        points.push(topLeft.x, topLeft.y, topLeft.z);

        // FIXME DEBUGGING - draw each face in a different color
        // const COLORS = [0xffae00, 0x00ffff, 0xff1e00, 0xc800ff, 0xfffb00, 0x1aff00]; // orange, aqua, red, purple, yellow, green
        // const color = COLORS[face];
        // const points_geometry = new THREE.BufferGeometry();
        // const point_location = new THREE.Float32BufferAttribute([plane.coplanarPoint(topLeft).x, plane.coplanarPoint(topLeft).y, plane.coplanarPoint(topLeft).z], 3);
        // points_geometry.setAttribute('position', point_location);
        // const points_material = new THREE.PointsMaterial({ color: color, size: 250 });
        // const point = new THREE.Points(points_geometry, points_material);
        // scene.add(point);
      }
    }

    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.cells = new THREE.Points(pointsGeometry);
    scene.add(this.cells);

    // FIXME: Fill faces with arbitrary values for debugging.
    //                            0: up                         1: right                2: up+right                    3: down                      4: left                    5: down+left
    const fixme_vectors = [new THREE.Vector2(0, 300), new THREE.Vector2(300, 0), new THREE.Vector2(300, 300), new THREE.Vector2(0, -300), new THREE.Vector2(-300, 0), new THREE.Vector2(-300, -300)];
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < CELLS_PER_FACE; i++) {
        const vec = fixme_vectors[face];
        this.faces[face].data[i].copy(vec);
      }
    }

    this.updateArrows();
  }

  destroy() {
    this.box.dispose();
    this.edges.geometry.dispose();
    (<THREE.Material>this.edges.material).dispose();
    this.cells.geometry.dispose();
    (<THREE.Material>this.cells.material).dispose();

    for (let arrow of this.arrows) {
      scene.remove(arrow);
    }
  }

  // Draw an arrow on each face representing the direction and magnitude of its vector.
  updateArrows() {
    for (let arrow of this.arrows) {
      scene.remove(arrow);
    }
    this.arrows = [];

    const positions = this.cells.geometry.getAttribute("position");
    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < CELLS_PER_FACE; i++) {
        if (face == 4 && i == 45) {
          const index = face * CELLS_PER_FACE + i;
          const arrowOrigin = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index));
          const planeNormal = arrowOrigin.clone().normalize();
          const plane = new THREE.Plane(planeNormal, -PLANET_RADIUS * 1.02);
          const pointAbovePlane = this.faces[face].northVector.clone().add(arrowOrigin).multiplyScalar(1.1);
          const direction = new THREE.Vector3();
          plane.projectPoint(pointAbovePlane, direction);
          let vh = new VisualHelper(false, false);
          vh.setPoints([arrowOrigin, pointAbovePlane, direction]);
          const arrow = new THREE.ArrowHelper(direction.sub(arrowOrigin).normalize(), arrowOrigin, this.faces[face].data[i].distanceTo(ORIGIN_2D));
          scene.add(arrow);
          this.arrows.push(arrow);
        }
      }
    }
  }

  update() {
    for (let i = 0; i < 6; i++) {
      this.faces[i].update();
    }

    this.updateArrows();
  }
}

class FieldFace {
  public northTransform: number;
  public southTransform: number;
  public eastTransform: number;
  public westTransform: number;
  public northNeighbor: FieldFace | null;
  public southNeighbor: FieldFace | null;
  public eastNeighbor: FieldFace | null;
  public westNeighbor: FieldFace | null;
  public northVector: THREE.Vector3;
  public data: Array<THREE.Vector2>;
  public newData: Array<THREE.Vector2>;

  constructor(northTransform: number, southTransform: number, eastTransform: number, westTransform: number) {
    this.northTransform = northTransform;
    this.southTransform = southTransform;
    this.eastTransform = eastTransform;
    this.westTransform = westTransform;
    this.northNeighbor = this.southNeighbor = this.eastNeighbor = this.westNeighbor = null;
    this.data = Array(CELLS_PER_FACE);
    this.newData = Array(CELLS_PER_FACE);
    this.northVector = new THREE.Vector3();

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
    this.transformVector(vec, (<FieldFace>this.northNeighbor).westTransform);
    this.northNeighbor?.westNeighbor?.newData[index].add(vec);
  }

  updateNorthAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.northTransform);
    this.northNeighbor?.newData[index].add(vec);
  }

  updateNortheastAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.northTransform);
    this.transformVector(vec, (<FieldFace>this.northNeighbor).eastTransform);
    this.northNeighbor?.eastNeighbor?.newData[index].add(vec);
  }

  updateEastAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.eastTransform);
    this.eastNeighbor?.newData[index].add(vec);
  }

  updateSoutheastAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.southTransform);
    this.transformVector(vec, (<FieldFace>this.southNeighbor).eastTransform);
    this.southNeighbor?.eastNeighbor?.newData[index].add(vec);
  }

  updateSouthAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.southTransform);
    this.southNeighbor?.newData[index].add(vec);
  }

  updateSouthwestAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.southTransform);
    this.transformVector(vec, (<FieldFace>this.southNeighbor).westTransform);
    this.southNeighbor?.westNeighbor?.newData[index].add(vec);
  }

  updateWestAcrossEdge(vec: THREE.Vector2, index: number) {
    this.transformVector(vec, this.westTransform);
    this.westNeighbor?.newData[index].add(vec);
  }
}
