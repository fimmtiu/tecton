import * as THREE from "three";
import { Controls } from "./controls";
import { SceneData } from "./scene_data";

const canvasContainer = document.getElementById("canvas-container");
if (canvasContainer === null) {
  throw "Can't find the canvas!";
}
const sceneData = new SceneData(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
const renderer = new THREE.WebGLRenderer();
const controls = new Controls(window, sceneData);

function initBrowserWindow(container: HTMLElement) {
  container.appendChild(renderer.domElement);

  const setCanvasSize = function () {
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    sceneData.updateCameraOnResize(container.offsetWidth, container.offsetHeight);
  };
  setCanvasSize();
  new ResizeObserver(setCanvasSize).observe(container);
}

function mainLoop() {
  requestAnimationFrame(mainLoop);
  sceneData.update();
  renderer.render(sceneData.scene, sceneData.camera);
}

initBrowserWindow(canvasContainer);
controls.listenForEvents();
mainLoop();
