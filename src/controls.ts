import { SceneData } from "./scene_data";

export { Controls };

class Controls {
  public window: Window;
  public sceneData: SceneData

  constructor(window: Window, sceneData: SceneData) {
    this.window = window;
    this.sceneData = sceneData;
  }

  listenForEvents() {
    this.window.addEventListener('keydown', (event: KeyboardEvent) => { this.keyDownListener(event) });
    this.window.addEventListener('keyup', (event: KeyboardEvent) => { this.keyUpListener(event) });
  }

  keyDownListener(event: KeyboardEvent) {
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
