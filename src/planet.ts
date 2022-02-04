import * as THREE from "three";
import SimplexNoise from "simplex-noise";

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
  protected noiseGenerator: SimplexNoise;

  constructor(scene: THREE.Scene) {
    this.noiseGenerator = new SimplexNoise();

    let geometry = new THREE.IcosahedronGeometry(Planet.radius, SPHERE_SUBDIVISION);
    const color = new THREE.Color();
    const positions = geometry.attributes.position;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3));

    let material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene = scene;
    scene.add(this.mesh);

    this.generateTerrain();

    // Optional white lines outlining each face of the mesh.
    let edgeGeometry = new THREE.EdgesGeometry(this.mesh.geometry);
    this.edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.showEdges = false;
    this.setEdgesVisible(false);

    // The points that represent each chunk of a tectonic plate.
    const pointsMaterial = new THREE.PointsMaterial({ size: Planet.radius * 0.02, vertexColors: true });
    let pointsGeometry = this.mesh.geometry.clone();
    this.points = new THREE.Points(pointsGeometry, pointsMaterial);
    pointsGeometry.scale(1.01, 1.01, 1.01);
    const pointPositions = pointsGeometry.attributes.position;
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pointPositions.count * 3), 3));

    // For now, let's just give them random colors to verify that setting the colors works.
    for (let i = 0; i < positions.count; i++) {
      color.setHSL((positions.getZ(i) / Planet.radius + 1) / 2, 1.0, 0.5);
      pointsGeometry.attributes.color.setXYZ(i, color.r, color.g, color.b);
    }

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

  generateTerrain() {
    const NOISE_SCALE = 5000;
    const FAVOR_WATER = -0.35;
    const MIN_WATER_HUE = 0.55;
    const MAX_WATER_HUE = 0.65;
    const MIN_GROUND_LIGHT = 0.40;
    const MAX_GROUND_LIGHT = 0.64;

    let color = new THREE.Color;
    let positions = this.mesh.geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      let height = FAVOR_WATER + this.noiseGenerator.noise3D(
        positions.getX(i) / NOISE_SCALE,
        positions.getY(i) / NOISE_SCALE,
        positions.getZ(i) / NOISE_SCALE
      );

      if (height < 0) {
        color.setHSL((MAX_WATER_HUE - MIN_WATER_HUE) * Math.abs(height) + MIN_WATER_HUE, 1.0, 0.5);
      } else {
        color.setHSL(1/3, 1.0, (MAX_GROUND_LIGHT - MIN_GROUND_LIGHT) * Math.abs(height) + MIN_GROUND_LIGHT);
      }

      this.mesh.geometry.attributes.color.setXYZ(i, color.r, color.g, color.b);
    }
  }
};
