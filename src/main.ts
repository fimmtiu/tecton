import * as THREE from "three";
import { SceneData, scene } from "./scene_data";
import { setRandomSeed } from "./util";

const canvasContainer = document.getElementById("canvas-container") as HTMLCanvasElement;
if (canvasContainer === null) {
  throw "Can't find the canvas!";
}
const randomSeedInput = document.getElementById("random-seed") as HTMLInputElement;
if (randomSeedInput === null) {
  throw "Can't find the #random-seed input box!";
}
const renderer = new THREE.WebGLRenderer();
let sceneData = new SceneData(canvasContainer.offsetWidth, canvasContainer.offsetHeight);

function initBrowserWindow(container: HTMLElement) {
  container.appendChild(renderer.domElement);

  const setCanvasSize = function () {
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    sceneData.updateOnResize(container.offsetWidth, container.offsetHeight);
  };
  setCanvasSize();
  new ResizeObserver(setCanvasSize).observe(container);
}

function mainLoop() {
  requestAnimationFrame(mainLoop);
  sceneData.update();
  renderer.render(scene, sceneData.camera);
}

function keyDownListener(event: KeyboardEvent) {
  if (document.activeElement == randomSeedInput) {
    return;
  }

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
      sceneData.planet.toggleEdgesVisible();
      break;
    case 'f':
      sceneData.planet.toggleFlatten();
      sceneData.planet.resize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
      break;
    }
}

function keyUpListener(event: KeyboardEvent) {
  console.log(`up: code ${event.code}, key ${event.key}`);
  if (document.activeElement == randomSeedInput) {
    if (event.key == "Enter") {
      restart();
    }
    return;
  }

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

function restart() {
  console.log(`Setting noise seed to ${randomSeedInput.value} and re-generating planet`);
  setRandomSeed(randomSeedInput.value);
  sceneData.destroy();
  sceneData = new SceneData(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
}

initBrowserWindow(canvasContainer);
window.addEventListener('keydown', keyDownListener);
window.addEventListener('keyup', keyUpListener);
mainLoop();
