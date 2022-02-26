import * as THREE from "three";

export { TextureManager };

const NORMAL_TEXTURES = [
  "star-field.jpg",
];

const DATA_TEXTURES = [
  "alpha.png",
  "atlas.png",
];

// Singleton class for loading textures synchronously at load time instead of in the background.
// (I feel really bad for JavaScript developers who have to work with these weak concurrency primitives.)
class TextureManager {
  static textures: { [textureName: string]: THREE.Texture } = {}
  static dataTextures: { [textureName: string]: THREE.DataTexture } = {}

  static loadAll(onComplete: () => void) {
    const promises = TextureManager.startLoadingNormalTextures().concat(TextureManager.startLoadingDataTextures());
    Promise.all(promises).then(onComplete);
  }

  protected static startLoadingNormalTextures() {
    return NORMAL_TEXTURES.map((name) => {
      return new Promise((resolve, reject) => {
        TextureManager.textures[name] = new THREE.TextureLoader().load(
          `img/${name}`,
          resolve,
          () => {},
          reject,
        );
      });
    });
  }

  protected static startLoadingDataTextures() {
    return DATA_TEXTURES.map((name) => {
      return new Promise((resolve, reject) => {
        new THREE.ImageLoader().load(
          `img/${name}`,
          (image) => {
            // I can't believe that this is actually the recommended way to generate a DataTexture from an image. T_T
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");
            if (context === null) {
              return reject(new Error("Can't create context for canvas!"));
            }

            context.drawImage(image, 0, 0);
            TextureManager.dataTextures[name] = new THREE.DataTexture(
              context.getImageData(0, 0, image.width, image.height).data,
              image.width, image.height, THREE.RGBAFormat
            );
            resolve(name)
          },
          (_ev) => {},
          reject,
        );
      });
    });
  }
}
