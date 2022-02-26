import * as THREE from "three";

export { TextureCopier };

// The logic for moving swatches onto the planet texture was fiddly enough that I figured it needed to
// be extracted and tested in isolation.
class TextureCopier {
  protected atlas: THREE.DataTexture;
  protected destTexture: THREE.DataTexture;
  protected alpha: THREE.DataTexture;
  protected swatchEdgeLength: number;
  protected swatchPixelCount: number;
  protected swatchCache: { [startPixel: number]: Uint8ClampedArray };

  // It assumes that your swatches are square and uniform, but the atlas and texture can be any dimensions.
  constructor(atlas: THREE.DataTexture, destTexture: THREE.DataTexture, swatchEdgeLength: number, alpha: THREE.DataTexture) {
    this.atlas = atlas;
    this.destTexture = destTexture;
    this.alpha = alpha;
    this.swatchEdgeLength = swatchEdgeLength;
    this.swatchPixelCount = this.swatchEdgeLength ** 2;
    this.swatchCache = {};
  }

  copy(srcStartAt: number, destX: number, destY: number) {
    const swatch = this.getSwatch(srcStartAt);
    let rowCount: number, rowOffset: number, columnCount: number, xOffset: number;
    destX = Math.floor(destX);
    destY = Math.floor(destY);

    if (destY < this.swatchEdgeLength / 2) { // at the top edge
      rowCount = this.swatchEdgeLength / 2 + destY;
      rowOffset = this.swatchEdgeLength - rowCount;
    } else if (this.destTexture.image.height - 1 < (destY + this.swatchEdgeLength / 2)) { // at the bottom edge
      rowCount = this.swatchEdgeLength / 2 + (this.destTexture.image.height - 1 - destY);
      rowOffset = 0;
    } else {
      rowCount = this.swatchEdgeLength; // in the middle
      rowOffset = 0;
    }

    if (destX < this.swatchEdgeLength / 2) { // at the left edge
      columnCount = this.swatchEdgeLength / 2 + destX;
      xOffset = 0
    } else if (this.destTexture.image.width - 1 < (destX + this.swatchEdgeLength / 2)) { // at the right edge
      columnCount = this.swatchEdgeLength / 2 + (this.destTexture.image.width - 1 - destX);
      xOffset = this.destTexture.image.width - columnCount;
    } else {
      columnCount = this.swatchEdgeLength; // in the middle
      xOffset = destX - this.swatchEdgeLength / 2;
    }
    const columnOffset = this.swatchEdgeLength - columnCount;

    for (let row = 0; row < rowCount; row++) {
      const start = (rowOffset + row) * this.swatchEdgeLength * 4 + columnOffset * 4;
      const rowData = swatch.slice(start, start + columnCount * 4);
      const startAtDestinationRow = Math.max(0, destY - this.swatchEdgeLength / 2 + 1) + row;
      const byteOffset = (startAtDestinationRow * this.destTexture.image.width + xOffset) * 4;
      // this.destTexture.image.data.set(rowData, byteOffset);

      // OMFG the worst worst worst
      // A very slow, shitty way to alpha-blend textures together.
      for (let pixel = 0; pixel < columnCount * 4; pixel += 4) {
        const offset = byteOffset + pixel;
        const sourceAlpha = rowData[pixel + 3] / 255;
        const destinationAlphaPercent = this.destTexture.image.data[offset + 3] / 255;
        const destinationAlpha = destinationAlphaPercent * (1 - sourceAlpha);

        // if (pixel == 0) {
        //   console.log(`before: (r ${this.destTexture.image.data[offset + 0]}, g ${this.destTexture.image.data[offset + 1]}, b ${this.destTexture.image.data[offset + 2]}) <= (r ${rowData[pixel + 0]}, g ${rowData[pixel + 1]}, b ${rowData[pixel + 2]})`);
        // }
        this.destTexture.image.data[offset + 0] = rowData[pixel + 0] * sourceAlpha + this.destTexture.image.data[offset + 0] * destinationAlpha;
        this.destTexture.image.data[offset + 1] = rowData[pixel + 1] * sourceAlpha + this.destTexture.image.data[offset + 1] * destinationAlpha;
        this.destTexture.image.data[offset + 2] = rowData[pixel + 2] * sourceAlpha + this.destTexture.image.data[offset + 2] * destinationAlpha;
        // if (pixel == 0) {
        //   console.log(`after: r ${this.destTexture.image.data[offset + 0]}, g ${this.destTexture.image.data[offset + 1]}, b ${this.destTexture.image.data[offset + 2]}`);
        // }
      }
    }
  }

  protected getSwatch(srcStartAt: number) {
    if (this.swatchCache[srcStartAt]) {
      return this.swatchCache[srcStartAt];
    }

    const pixels = new Uint8ClampedArray(this.swatchPixelCount * 4);

    for (let row = 0; row < this.swatchEdgeLength; row++) {
      const rowStartsAt = srcStartAt + row * this.atlas.image.width * 4;
      const rowData = this.atlas.image.data.slice(rowStartsAt, rowStartsAt + this.swatchEdgeLength * 4);
      pixels.set(rowData, row * this.swatchEdgeLength * 4);
    }

    for (let pixel = 0; pixel < this.swatchPixelCount; pixel++) {
      pixels[pixel * 4 + 3] = this.alpha.image.data[pixel];
    }

    this.swatchCache[srcStartAt] = pixels;
    return pixels;
  }
}
