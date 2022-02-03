import * as THREE from "three";

export { Planet };

const SPHERE_SUBDIVISION = 19;

class Planet {
  static readonly radius = 6370; // each unit is 1 kilometer

  public showEdges: boolean;
  public showPoints: boolean;
  protected mesh: THREE.Mesh;
  protected edges: THREE.LineSegments;
  protected points: THREE.Points;
  protected scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    let geometry = new THREE.IcosahedronGeometry(Planet.radius, SPHERE_SUBDIVISION);
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

    // Optional white lines outlining each face of the mesh.
    let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.showEdges = false;
    this.setEdgesVisible(false);

    // The points that represent each chunk of a tectonic plate.
    const pointsMaterial = new THREE.PointsMaterial({ size: Planet.radius * 0.02 });
    this.points = new THREE.Points(this.mesh.geometry.clone(), pointsMaterial);
    this.points.geometry.scale(1.01, 1.01, 1.01);
    this.showPoints = false;
    this.setPointsVisible(false);
  };

  setEdgesVisible(showEdges: boolean) {
    this.showEdges = showEdges;
    if (showEdges) {
      this.scene.add(this.edges);
    } else {
      this.scene.remove(this.edges);
    }
  }

  setPointsVisible(showPoints: boolean) {
    this.showPoints = showPoints;
    if (showPoints) {
      this.scene.add(this.points);
    } else {
      this.scene.remove(this.points);
    }
  }
};
