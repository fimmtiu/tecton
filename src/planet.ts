import * as THREE from "three";

export { Planet };

const SUBDIVISION = 19;

class Planet {
  static readonly radius = 6370; // each unit is 1 kilometer

  public showEdges: boolean;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments;
  protected scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    let geometry = new THREE.IcosahedronGeometry(Planet.radius, SUBDIVISION);
    const color = new THREE.Color();
    const positions = geometry.attributes.position;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3));

    for (let i = 0; i < positions.count; i++) {
      color.setHSL((positions.getY(i) / Planet.radius + 1) / 2, 1.0, 0.5);
      geometry.attributes.color.setXYZ(i, color.r, color.g, color.b);
    }

    let material = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene = scene;
    scene.add(this.mesh);

    let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.showEdges = false;
    this.setEdgesVisible(false);
  };

  setEdgesVisible(showEdges: boolean) {
    this.showEdges = showEdges;
    if (showEdges) {
      this.scene.add(this.edges);
    } else {
      this.scene.remove(this.edges);
    }
  }
};
