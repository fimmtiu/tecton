import { SceneData } from "./scene_data";
import { setRandomSeed } from "./util";

export { Controls };

class Controls {
  public window: Window;
  public sceneData: SceneData;
  public randomSeedInput: HTMLInputElement;

  constructor(window: Window, sceneData: SceneData) {
    this.window = window;
    this.sceneData = sceneData;

    const randomSeedInput = document.getElementById("random-seed") as HTMLInputElement;
    if (randomSeedInput === null) {
      throw "Can't find the #random-seed input box!";
    } else {
    this.randomSeedInput = randomSeedInput;
    }
  }

  listenForEvents() {
    this.window.addEventListener('keydown', (event: KeyboardEvent) => { this.keyDownListener(event) });
    this.window.addEventListener('keyup', (event: KeyboardEvent) => { this.keyUpListener(event) });
  }

  keyDownListener(event: KeyboardEvent) {
    if (document.activeElement == this.randomSeedInput) {
      return;
    }

    switch(event.key) {
      case 'ArrowLeft':
        this.sceneData.rotateHorizontally(-1);
        break;
      case 'ArrowRight':
        this.sceneData.rotateHorizontally(1);
        break;
      case 'ArrowDown':
        this.sceneData.rotateVertically(-1);
        break;
      case 'ArrowUp':
        this.sceneData.rotateVertically(1);
        break;
      case ',':
        this.sceneData.zoom(-1);
        break;
      case '.':
        this.sceneData.zoom(1);
        break;
      case 'h':
        this.sceneData.planet.setEdgesVisible(!this.sceneData.planet.showEdges);
        break;
      case 'p':
        this.sceneData.planet.setPointsVisible(!this.sceneData.planet.showPoints);
        break;
      }
  }

  keyUpListener(event: KeyboardEvent) {
    console.log(`up: code ${event.code}, key ${event.key}`);
    if (document.activeElement == this.randomSeedInput) {
      if (event.key == "Enter") {
        console.log(`Setting noise seed to ${this.randomSeedInput.value}`);
        setRandomSeed(this.randomSeedInput.value);
      }
      return;
    }

    switch(event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        this.sceneData.rotateHorizontally(0);
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        this.sceneData.rotateVertically(0);
        break;
      case ',':
      case '.':
        this.sceneData.zoom(0);
        break;
    }
  }
}
