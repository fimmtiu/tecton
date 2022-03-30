import * as THREE from "three";

import { v2s } from "../util";

export { TangentCubeGeometry };

// When you wrap a cube around a sphere, the grid cells get very distorted: huge and bulging in the center of faces, but
// tiny and tightly packed around the corners. To minimize this distortion, we can apply a simple tangent adjustment to
// to the cube's grid lines to make the wrapped cells more uniform in size. We could do something fancier like a COBE
// quadrilateralized sphere if we needed to, but this is probably okay for now. Most of this file is a hastily
// simplified version of THREE's BoxGeometry class.
//
// Like THREE.BoxGeometry, we create our cube faces with 0 in the upper left corner and N in the lower right,
// proceeding horizontally.
class TangentCubeGeometry extends THREE.BufferGeometry {
  constructor(sideLength = 1, segmentsPerSide = 1) {
    super();
    this.type = "TangentCubeGeometry";

    segmentsPerSide = Math.floor(segmentsPerSide);

    const indices: number[] = [];
    const vertices: number[] = [];

    let numberOfVertices = 0;

    buildPlane(2, 1, 0, -1, -1,  1);
    buildPlane(2, 1, 0,  1, -1, -1);
    buildPlane(0, 2, 1,  1,  1,  1);
    buildPlane(0, 2, 1,  1, -1, -1);
    buildPlane(0, 1, 2,  1, -1,  1);
    buildPlane(0, 1, 2, -1, -1, -1);

    this.setIndex(indices);
    this.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    this.addGroup(0, numberOfVertices, 1);

    // FIXME: I'm doing something slightly wrong here, I think. Every other version of this code that I've seen just
    // does a straight tan() on the UV, but when I do that I reverse my problem, where there are tiny cells in the
    // center of faces (where the tan() function is right around the X axis) and giant faces at the corners. Doing
    // the pow(uv, 1/6) call fixes the problem and gives us nice-looking cells, but none of the other implementations
    // I've looked at have done anything like that, so I think I might be compensating for a bug. Will revisit someday.
    function uvWithTangentAdjustment(n: number) {
      let unitUV = n / segmentsPerSide * 2 - 1; // A coordinate in the range [-1, 1], where 0 is the center.
      let cellSpaceUV = n - segmentsPerSide / 2; // A coordinate in the range [-segmentsPerSide/2, segmentsPerSide/2].
      let scale = Math.tan(Math.pow(Math.abs(unitUV), 1/6) * (Math.PI / 4));
      scale += (1.0 / 9007199254740992.0) * scale; // correct tiny floating-point inaccuracies
      return cellSpaceUV * scale;
    }

    function buildPlane(u: number, v: number, w: number, udir: number, vdir: number, wdir: number) {
      const segmentSize = sideLength / segmentsPerSide;
      const depthHalf = sideLength / 2 * wdir;
      const segmentsPlusOne = segmentsPerSide + 1;
      const vector = new THREE.Vector3();

      let vertexCounter = 0;

      for (let iy = 0; iy < segmentsPlusOne; iy++) {
        const y = uvWithTangentAdjustment(iy) * segmentSize;

        for (let ix = 0; ix < segmentsPlusOne; ix++) {
          const x = uvWithTangentAdjustment(ix) * segmentSize;

          vector.setComponent(u, x * udir);
          vector.setComponent(v, y * vdir);
          vector.setComponent(w, depthHalf);
          vertices.push(vector.x, vector.y, vector.z);

          vertexCounter += 1;
        }
      }

      for (let iy = 0; iy < segmentsPerSide; iy++) {
        for (let ix = 0; ix < segmentsPerSide; ix++) {
          const a = numberOfVertices + ix + segmentsPlusOne * iy;
          const b = numberOfVertices + ix + segmentsPlusOne * (iy + 1);
          const c = numberOfVertices + (ix + 1) + segmentsPlusOne * (iy + 1);
          const d = numberOfVertices + (ix + 1) + segmentsPlusOne * iy;

          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }

      numberOfVertices += vertexCounter;
    }

    // const cellAreas = [];
    // const segmentsPlusOne = segmentsPerSide + 1;
    // for (let iy = 0; iy < segmentsPerSide; iy++) {
    // 	for (let ix = 0; ix < segmentsPerSide; ix++) {
    // 		const tlIndex = (iy * segmentsPlusOne + ix) * 3;
    // 		const brIndex = ((iy + 1) * segmentsPlusOne + ix + 1) * 3;
    // 		const tl = new THREE.Vector3(vertices[tlIndex], vertices[tlIndex + 1], vertices[tlIndex + 2]);
    // 		const br = new THREE.Vector3(vertices[brIndex], vertices[brIndex + 1], vertices[brIndex + 2]);
    // 		const area = (br.y - tl.y) * (br.z - tl.z);
    // 		console.log(`tl: ${tlIndex} ${v2s(tl)}, br ${brIndex} ${v2s(br)}, area ${area}`);
    // 		cellAreas.push(area);
    // 	}
    // }

    // const perfectMeanArea = (sideLength / segmentsPerSide) ** 2;
    // const errors = cellAreas.map((area) => Math.abs(area - perfectMeanArea));
    // const errorSum = errors.reduce((prev, cur) => prev + cur);
    // console.log(`pma: ${perfectMeanArea}`);
    // console.log(`mean error: ${errorSum} / ${cellAreas.length} = ${Math.floor(errorSum / cellAreas.length)}`);

    // let min = 0, max = 0;
    // for (let i = 1; i < errors.length; i++) {
    // 	if (errors[i] < errors[min]) {
    // 		min = i;
    // 	}
    // 	if (errors[i] > errors[max]) {
    // 		max = i;
    // 	}
    // }

    // console.log(` Best: ${min} (area ${cellAreas[min]}, error ${errors[min]}, ${Math.floor(errors[min] / perfectMeanArea * 10000) / 100}%`);
    // console.log(`Worst: ${max} (area ${cellAreas[max]}, error ${errors[max]}, ${Math.floor(errors[max] / perfectMeanArea * 10000) / 100}%`);
    // console.log(`Average: ${errorSum} / ${cellAreas.length} = ${Math.floor(errorSum / cellAreas.length / perfectMeanArea * 10000) / 100}`);
  }
}
