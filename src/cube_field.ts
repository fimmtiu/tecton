import * as THREE from "three";

import { PLANET_RADIUS } from "./planet";
import { wrapMeshAroundSphere } from "./util/geometry";
import { TangentCubeGeometry } from "./util/tangent_cube_geometry";

export { CubeField };


abstract class CubeField<CellType> {
  static readonly neighbours = [
    { north: 2, south: 3, east: 5, west: 4 }, // right face
    { north: 2, south: 3, east: 4, west: 5 }, // left face
    { north: 5, south: 4, east: 0, west: 1 }, // top face
    { north: 3, south: 5, east: 0, west: 1 }, // bottom face
    { north: 2, south: 3, east: 0, west: 1 }, // front face
    { north: 3, south: 2, east: 0, west: 1 }, // back face
  ];

  public readonly cellsPerEdge: number;
  public readonly cellsPerFace: number;
  public readonly verticesPerFace: number;
  public readonly cellCount: number;
  protected cells: CellType[];

  constructor(cellsPerEdge: number, initialValue: () => CellType) {
    this.cellsPerEdge = cellsPerEdge;
    this.cellsPerFace = cellsPerEdge ** 2;
    this.verticesPerFace = (cellsPerEdge + 1) ** 2;
    this.cellCount = 6 * this.cellsPerFace;
    this.cells = [];
    for (let i = 0; i < this.cellCount; i++) {
      this.cells.push(initialValue());
    }
  }

  get(cell: number) {
    return this.cells[cell];
  }

  set(cell: number, newValue: CellType) {
    this.cells[cell] = newValue;
  }

  update() {
    // no-op by default, can be overridden in child classes
  }

  protected indexOfCell(face: number, x: number, y: number) {
    return face * this.cellsPerFace + y * this.cellsPerEdge + x;
  }

  // `dir` arbitrarily indicates the direction like so:
  //     0 1 2
  //     3 * 5
  //     6 7 8
  neighbour(cell: number, dir: number) {
    const face = Math.floor(this.cellCount / cell);
    const x = cell % this.cellsPerEdge;
    const y = Math.floor((cell % this.cellsPerFace) / this.cellsPerEdge);

    // These are just shorthands to make the code more readable.
    const left_side = 0, right_side = this.cellsPerEdge - 1;
    const top_side = 0, bottom_side = this.cellsPerEdge - 1;

    switch (dir) {
    case 0:
      if (y == top_side) {
        return this.indexOfCell(CubeField.neighbours[face]["north"], x, bottom_side);
      } else if (x == left_side) {
        return this.indexOfCell(CubeField.neighbours[face]["west"], right_side, y);
      } else {
        return this.indexOfCell(face, x - 1, y - 1);
      }
    case 1:
      if (y == top_side) {
        return this.indexOfCell(CubeField.neighbours[face]["north"], x, bottom_side);
      } else {
        return this.indexOfCell(face, x, y - 1);
      }
    case 2:
      if (x == right_side) {
        return this.indexOfCell(CubeField.neighbours[face]["east"], 0, y);
      } else if (y == top_side) {
        return this.indexOfCell(CubeField.neighbours[face]["north"], x, bottom_side);
      } else {
        return this.indexOfCell(face, x + 1, y - 1);
      }
    case 3:
      if (x == left_side) {
        return this.indexOfCell(CubeField.neighbours[face]["west"], right_side, y);
      } else {
        return this.indexOfCell(face, x - 1, y);
      }
    case 5:
      if (x == right_side) {
        return this.indexOfCell(CubeField.neighbours[face]["east"], 0, y);
      } else {
        return this.indexOfCell(face, x + 1, y);
      }
    case 6:
      if (x == left_side) {
       return this.indexOfCell(CubeField.neighbours[face]["west"], right_side, y);
      } else if (y == bottom_side) {
        return this.indexOfCell(CubeField.neighbours[face]["south"], x, 0);
      } else {
        return this.indexOfCell(face, x - 1, y + 1);
      }
    case 7:
      if (y == bottom_side) {
        return this.indexOfCell(CubeField.neighbours[face]["south"], x, 0);
      } else {
        return this.indexOfCell(face, x, y + 1);
      }
    case 8:
      if (y == bottom_side) {
        return this.indexOfCell(CubeField.neighbours[face]["south"], x, 0);
      } else if (x == right_side) {
        return this.indexOfCell(CubeField.neighbours[face]["east"], 0, y);
      } else {
        return this.indexOfCell(face, x + 1, y + 1);
      }
    }
    throw `Bogus direction: ${dir}`;
  }

  northwestNeighbour(cell: number) { return this.neighbour(cell, 0); }
  northNeighbour(cell: number)     { return this.neighbour(cell, 1); }
  northeastNeighbour(cell: number) { return this.neighbour(cell, 2); }
  eastNeighbour(cell: number)      { return this.neighbour(cell, 3); }
  southeastNeighbour(cell: number) { return this.neighbour(cell, 5); }
  southNeighbour(cell: number)     { return this.neighbour(cell, 6); }
  southwestNeighbour(cell: number) { return this.neighbour(cell, 7); }
  westNeighbour(cell: number)      { return this.neighbour(cell, 8); }

  protected box() {
    // const positions = new THREE.BufferAttribute(new Float32Array(this.cellsPerFace * 6 * 3), 3);
    // const box = new THREE.BufferGeometry().setAttribute("position", positions);
    // const cellLength = 2 * PLANET_RADIUS / this.cellsPerEdge;

    function tangentAdjustment(n: number) {
      n = Math.tan(Math.PI / 2 * n - Math.PI / 4);
      return n + (1.0 / 9007199254740992.0) * n;
    }

    // for (let face = 0; face < 6; face++) {
    //   for (let cell = 0; cell < this.cellsPerFace; cell++) {
    //     const s = (cell % this.cellsPerEdge) / this.cellsPerEdge;
    //     const t = Math.floor(cell / this.cellsPerEdge) / this.cellsPerEdge;
    //     const u = tangentAdjustment(s), v = tangentAdjustment(t);


    //     const point = new THREE.Vector3();
    //     point.normalize().multiplyScalar(PLANET_RADIUS);

    //     positions.setXYZ(face * this.cellsPerFace + cell, point.x, point.y, point.z);
    //   }
    // }



    // const sideLength = 2 * PLANET_RADIUS;
    // const box = new THREE.BoxGeometry(sideLength, sideLength, sideLength, this.cellsPerEdge, this.cellsPerEdge, this.cellsPerEdge);
    // const positions = box.getAttribute("position");

    // for (let face = 0; face < 6; face++) {
    //   for (let cell = 0; cell < this.cellsPerFace; cell++) {
    //     const x = Math.floor(cell / this.cellsPerEdge) - (this.cellsPerEdge / 2);
    //     const y = cell % this.cellsPerEdge - (this.cellsPerEdge / 2);
    //     const point = new THREE.Vector3();
    //     point.normalize().multiplyScalar(PLANET_RADIUS);

    //     const wouldaBeen = new THREE.Vector3(positions.getX(face * this.cellsPerFace + cell), positions.getY(face * this.cellsPerFace + cell), positions.getZ(face * this.cellsPerFace + cell));
    //     wouldaBeen.normalize().multiplyScalar(PLANET_RADIUS);
    //     console.log(`${face} x ${cell}: ${v2s(wouldaBeen)} --> ${v2s(point)}`);

    //     positions.setXYZ(face * this.cellsPerFace + cell, point.x, point.y, point.z);
    //   }
    // }

    const box = new TangentCubeGeometry(2 * PLANET_RADIUS, this.cellsPerEdge);
    wrapMeshAroundSphere(box, PLANET_RADIUS);
    return box;
  }

  // Return a wire mesh showing the edges of each field cell.
  public edges(color = 0xffffff, scaleFactor = 1.0) {
    const box = this.box();
    const edgeGeometry = new THREE.EdgesGeometry(box, 0);
    edgeGeometry.scale(scaleFactor, scaleFactor, scaleFactor);
    box.dispose();
    return new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: color }));
  }

  // Find the center of every rectangular face of the grid and collect them into a Points geometry.
  public centers(materials: THREE.PointsMaterial[], scaleFactor = 1.0) {
    const box = this.box(), positions = box.getAttribute("position");
    const pointPositions = new THREE.BufferAttribute(new Float32Array(this.cellCount * 3), 3);

    for (let face = 0; face < 6; face++) {
      for (let i = 0; i < this.cellsPerFace; i++) {
        const tl_i = face * this.verticesPerFace + i + Math.floor(i / this.cellsPerEdge);
        const br_i = tl_i + this.cellsPerEdge + 2;
        const topLeft = new THREE.Vector3(positions.getX(tl_i), positions.getY(tl_i), positions.getZ(tl_i));
        const bottomRight = new THREE.Vector3(positions.getX(br_i), positions.getY(br_i), positions.getZ(br_i));
        topLeft.add(bottomRight).normalize().multiplyScalar(PLANET_RADIUS * scaleFactor);
        pointPositions.setXYZ(face * this.cellsPerFace + i, topLeft.x, topLeft.y, topLeft.z);
      }
    }

    box.dispose();
    const pointsGeometry = new THREE.BufferGeometry().setAttribute('position', pointPositions);
    return new THREE.Points(pointsGeometry, materials);
  }
}
