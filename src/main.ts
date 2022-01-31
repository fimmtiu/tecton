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

function keyPressListener(event: KeyboardEvent) {
  console.log(`code ${event.code}, key ${event.key}`);
  switch(event.key) {
    case 'h':
      sceneData.planet.setEdgesVisible(!sceneData.planet.showEdges);
      break;
  }
}

function keyDownListener(event: KeyboardEvent) {
  console.log(`code ${event.code}, key ${event.key}`);
  switch(event.key) {
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
// immediately use the texture for material creation
const material = new THREE.MeshBasicMaterial({ map: texture });
const plane = new THREE.Mesh(backgroundGeometry, material);
plane.position.z = -2.5;
sceneData.scene.add(plane);

initBrowserWindow(canvasContainer);
window.addEventListener('keypress', keyPressListener);
window.addEventListener('keydown', keyDownListener);
mainLoop();
