import * as THREE from "three";
import { SceneData } from "./scene_data";

const canvasContainer = document.getElementById("canvas-container");
if (canvasContainer === null) {
  throw "Can't find the canvas!";
}
const sceneData = new SceneData(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
const renderer = new THREE.WebGLRenderer();

function initBrowserWindow(container: HTMLElement) {
  container.appendChild(renderer.domElement);

  const setCanvasSize = function () {
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    sceneData.updateCamera(container.offsetWidth, container.offsetHeight);
  };
  setCanvasSize();
  new ResizeObserver(setCanvasSize).observe(container);
}

function keyDownListener(event: KeyboardEvent) {
  console.log(`down: code ${event.code}, key ${event.key}`);
  switch(event.key) {
    case 'ArrowLeft':
      sceneData.rotate(-1);
      break;
    case 'ArrowRight':
      sceneData.rotate(1);
      break;
    case 'h':
      sceneData.planet.setEdgesVisible(!sceneData.planet.showEdges);
      break;
  }
}

function keyUpListener(event: KeyboardEvent) {
  console.log(`up: code ${event.code}, key ${event.key}`);
  switch(event.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      sceneData.rotate(0);
      break;
  }
}

function mainLoop() {
  requestAnimationFrame(mainLoop);
  sceneData.update();
  renderer.render(sceneData.scene, sceneData.camera);
}

const light = new THREE.PointLight(0xffffff);
light.position.y = 1.0;
light.position.z = 3.0;
sceneData.scene.add(light);


const backgroundGeometry = new THREE.PlaneGeometry(8, 8);
const texture = new THREE.TextureLoader().load('img/star-field.jpg');
const material = new THREE.MeshBasicMaterial({ map: texture });
const plane = new THREE.Mesh(backgroundGeometry, material);
plane.position.z = -2.5;
sceneData.scene.add(plane);

initBrowserWindow(canvasContainer);
window.addEventListener('keydown', keyDownListener);
window.addEventListener('keyup', keyUpListener);
mainLoop();
