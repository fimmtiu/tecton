import * as THREE from "three";

export { TangentCubeGeometry };

// When you wrap a cube around a sphere, the grid cells get very distorted: huge and bulging in the center of faces, but
// tiny and tightly packed around the corners. To minimize this distortion, we can apply a simple tangent adjustment to
// to the cube's grid lines to make the wrapped cells more uniform in size. We could do something fancier like a COBE
// quadrilateralized sphere if we needed to, but this is probably okay for now. The approach is borrowed from Google's
// S2 map projection code, but most of this file is a hastily simplified version of THREE's BoxGeometry class.
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

		function tangentAdjustment(n: number) {
      n = Math.tan(Math.PI / 2 * n - Math.PI / 4);
      return n + (1.0 / 9007199254740992.0) * n;
    }

		function buildPlane(u: number, v: number, w: number, udir: number, vdir: number, wdir: number) {
			const segmentSize = sideLength / segmentsPerSide;
			const lengthHalf = sideLength / 2;
			const depthHalf = sideLength / 2 * wdir;
			const segmentsPlusOne = segmentsPerSide + 1;
			const vector = new THREE.Vector3();

			let vertexCounter = 0;

			for (let iy = 0; iy < segmentsPlusOne; iy++) {
				const y = iy * segmentSize - lengthHalf;

				for (let ix = 0; ix < segmentsPlusOne; ix++) {
					const x = ix * segmentSize - lengthHalf;

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
	}
}
