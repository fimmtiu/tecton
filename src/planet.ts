import * as THREE from "three";

export { Planet };

const SUBDIVISION = 13;

class Planet {
  public showEdges: boolean;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments;
  protected scene: THREE.Scene;

  constructor(scene: THREE.Scene, showEdges: boolean) {
    this.showEdges = showEdges || false;

    let geometry = new THREE.IcosahedronGeometry(1, SUBDIVISION);
    let material = new THREE.MeshLambertMaterial({ color: 0x00aa00 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene = scene;
    scene.add(this.mesh);

    let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.setEdgesVisible(this.showEdges);
  };

  rotate(amount: number) {
    this.mesh.rotation.y += amount;
    this.edges.rotation.y = this.mesh.rotation.y;
  }

  setEdgesVisible(showEdges: boolean) {
    this.showEdges = showEdges;
    if (showEdges) {
      this.scene.add(this.edges);
    } else {
      this.scene.remove(this.edges);
    }
  }
};
