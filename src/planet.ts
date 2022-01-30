import * as THREE from "three";

export { Planet };

const SUBDIVISION = 13;

class Planet {
  public showEdges: boolean;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments;
  protected scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.showEdges = true;

    let geometry = new THREE.IcosahedronGeometry(1, SUBDIVISION);
    let material = new THREE.MeshLambertMaterial({ color: 0x00aa00 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene = scene;
    scene.add(this.mesh);

    let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(this.edges);
  };

  update() {
    this.mesh.rotation.y += 0.003;
    this.edges.rotation.y = this.mesh.rotation.y;
  }
};
