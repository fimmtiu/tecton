import * as THREE from "three";
import { Planet } from "./planet";

const FIELD_OF_VIEW = 50;

const canvasContainer = document.getElementById("canvas");
if (canvasContainer === null) {
  throw "Can't find the canvas!";
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, canvasContainer.offsetWidth / canvasContainer.offsetHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

function initBrowserWindow(container: HTMLElement) {
  container.appendChild(renderer.domElement);

  const setCanvasSize = function () {
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    camera.aspect = container.offsetWidth / container.offsetHeight;
    const distance = 1 / (Math.tan((FIELD_OF_VIEW / 2) / (180 / Math.PI)) / 1.2);
    camera.position.z = distance;
    camera.updateProjectionMatrix();
    console.log(`width = ${container.offsetWidth}, height = ${container.offsetHeight}, aspect = ${camera.aspect}, distance = ${distance}`);
  };
  setCanvasSize();
  new ResizeObserver(setCanvasSize).observe(container);
}

function mainLoop() {
  requestAnimationFrame(mainLoop);

  planet.update();
  renderer.render(scene, camera);
}






const planet = new Planet(scene);

const light = new THREE.PointLight(0xffffff);
light.position.y = 1.0;
light.position.z = 3.0;
scene.add(light);


const backgroundGeometry = new THREE.PlaneGeometry(8, 8);
const texture = new THREE.TextureLoader().load('img/star-field.jpg');
// immediately use the texture for material creation
const material = new THREE.MeshBasicMaterial({ map: texture });
const plane = new THREE.Mesh(backgroundGeometry, material);
plane.position.z = -2.5;
scene.add(plane);

initBrowserWindow(canvasContainer);
mainLoop();
