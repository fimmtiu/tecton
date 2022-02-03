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
    sceneData.updateCameraOnResize(container.offsetWidth, container.offsetHeight);
  };
  setCanvasSize();
  new ResizeObserver(setCanvasSize).observe(container);
}

function keyDownListener(event: KeyboardEvent) {
  console.log(`down: code ${event.code}, key ${event.key}`);
  switch(event.key) {
    case 'ArrowLeft':
      sceneData.rotateHorizontally(-1);
      break;
    case 'ArrowRight':
      sceneData.rotateHorizontally(1);
      break;
    case 'ArrowDown':
      sceneData.rotateVertically(-1);
      break;
    case 'ArrowUp':
      sceneData.rotateVertically(1);
      break;
    case ',':
      sceneData.zoom(-1);
      break;
    case '.':
      sceneData.zoom(1);
      break;
    case 'h':
      sceneData.planet.setEdgesVisible(!sceneData.planet.showEdges);
      break;
    case 'p':
      sceneData.planet.setPointsVisible(!sceneData.planet.showPoints);
      break;
    }
}

function keyUpListener(event: KeyboardEvent) {
  console.log(`up: code ${event.code}, key ${event.key}`);
  switch(event.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      sceneData.rotateHorizontally(0);
      break;
    case 'ArrowDown':
    case 'ArrowUp':
      sceneData.rotateVertically(0);
      break;
    case ',':
    case '.':
      sceneData.zoom(0);
      break;
  }
}

function mainLoop() {
  requestAnimationFrame(mainLoop);
  sceneData.update();
  renderer.render(sceneData.scene, sceneData.camera);
}

// For now, just a flat background that doesn't move. In the future, maybe it can be a sky-sphere.
const texture = new THREE.TextureLoader().load('img/star-field.jpg');
sceneData.scene.background = texture;

initBrowserWindow(canvasContainer);
window.addEventListener('keydown', keyDownListener);
window.addEventListener('keyup', keyUpListener);
mainLoop();
