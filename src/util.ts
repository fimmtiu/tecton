import SimplexNoise from "simplex-noise";
import * as THREE from "three";

export { noiseGenerator, setRandomSeed, updateGeometry, getVertexFromGeometry, ORIGIN };

const ORIGIN = new THREE.Vector3(0, 0, 0);

let simplex = new SimplexNoise();

function noiseGenerator() {
  return simplex;
}

function setRandomSeed(seed: string) {
  if (seed == "") {
    simplex = new SimplexNoise();
  } else {
    simplex = new SimplexNoise(seed);
  }
}

// Tell three.js that this geometry has changed.
function updateGeometry(geometry: THREE.BufferGeometry) {
  geometry.attributes.position.needsUpdate = true;
  if (geometry.attributes.color) {
    geometry.attributes.color.needsUpdate = true;
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function getVertexFromGeometry(geometry: THREE.BufferGeometry, index: number) {
  const positions = geometry.getAttribute("position");
  return new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index))
}

// Junk drawer: A function to draw arrows on every face showing which way it's facing.
// (You have to manually remove all the arrows from the scene afterwards.)
// protected showFaceNormals(geometry: THREE.BufferGeometry, cameraPosition: THREE.Vector3) {
//   let positions = geometry.attributes.position;
//   let index = geometry.index;
//   if (index === null) {
//     throw "not indexed, wtf?";
//   }
//   let a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
//   let faceNormal = new THREE.Vector3(), normalizedCameraVector = new THREE.Vector3(), midpoint = new THREE.Vector3();
//   let triangle = new THREE.Triangle();
//   const blue = new THREE.Color(0, 0, 1), red = new THREE.Color(1, 0, 0);
//   let arrowColor = new THREE.Color();
//   let distance = 0.0;
//
//   for (let arrow of this.normalArrows) {
//     this.scene.remove(arrow);
//   }
//
//   for (let i = 0; i < index.count; i++) {
//     a.fromBufferAttribute(positions, index.getX((i * 3) + 0));
//     b.fromBufferAttribute(positions, index.getX((i * 3) + 1));
//     c.fromBufferAttribute(positions, index.getX((i * 3) + 2));
//     triangle.set(a, b, c);
//     triangle.getNormal(faceNormal);
//     triangle.getMidpoint(midpoint);
//
//     normalizedCameraVector.copy(cameraPosition).normalize();
//     distance = normalizedCameraVector.distanceTo(faceNormal);
//     arrowColor.lerpColors(blue, red, distance / 2);
//
//     const arrow = new THREE.ArrowHelper(faceNormal, midpoint, 800, arrowColor.getHex());
//     this.normalArrows.push(arrow);
//     this.scene.add(arrow);
//   }
// }
