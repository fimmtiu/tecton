import * as THREE from "three";

import { SceneData, scene, visualHelper } from "./scene_data";
import { setRandomSeed } from "./util";
import { TextureManager } from "./texture_manager";

// FIXME: Can we do any metaprogramming to reduce this boilerplate?
const canvasContainer = document.getElementById("canvas-container") as HTMLCanvasElement;
if (canvasContainer === null) {
  throw "Can't find the canvas!";
}
const randomSeedInput = document.getElementById("random-seed") as HTMLInputElement;
if (randomSeedInput === null) {
  throw "Can't find the #random-seed input box!";
}

function getSpan(name: string) {
  const span = document.getElementById(name) as HTMLSpanElement;
  if (span === null) {
    throw `Can't find the #${name} span!`;
  }
  return span;
}

const elevationSpan = getSpan("elevation");
const cellSpan = getSpan("voronoi-cell");
const plateSpan = getSpan("plate");
const waternessSpan = getSpan("waterness");

const renderer = new THREE.WebGLRenderer();

TextureManager.loadAll(() => {
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
    case 'v':
      visualHelper.allowUpdates = !visualHelper.allowUpdates;
      console.log(`Visual helper updates are ${visualHelper.allowUpdates ? "enabled" : "disabled"}`);
      break;
    case 'c':
      visualHelper.showCamera();
      break;
    }
  }

  function keyUpListener(event: KeyboardEvent) {
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
    case 'd':
      // eslint-disable-next-line no-debugger
      debugger;
      break;
    }
  }

  function mouseMoveListener(event: MouseEvent) {
    const x = (event.clientX / canvasContainer.offsetWidth) * 2 - 1;
    const y = -(event.clientY / canvasContainer.offsetHeight) * 2 + 1;
    const data = sceneData.dataAtPoint(x, y);

    if (data) {
      elevationSpan.innerHTML = `${data.elevation} m`;
      cellSpan.innerHTML = `${data.voronoiCell} (grid ${data.face}x${data.gridCell})`;
      plateSpan.innerHTML = `${data.plate}`;
      waternessSpan.innerHTML = `${data.nearnessToWater.toFixed(2)}`;
    }
  }

  // FIXME: We should make the seed a query string parameter. Instead of restarting, we can just
  // redirect window.location to this URL with the seed parameter appended. Way simpler.
  // FIXME: Generate a random seed at the start, then pre-fill the seed input with it so that the
  // initial state is shareable.
  function restart() {
    console.log(`Setting noise seed to ${randomSeedInput.value} and re-generating planet`);
    setRandomSeed(randomSeedInput.value);
    sceneData.destroy();
    sceneData = new SceneData(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
  }

  let sceneData = new SceneData(canvasContainer.offsetWidth, canvasContainer.offsetHeight);

  initBrowserWindow(canvasContainer);
  window.addEventListener('keydown', keyDownListener);
  window.addEventListener('keyup', keyUpListener);
  window.addEventListener('pointermove', mouseMoveListener);
  mainLoop();
});
