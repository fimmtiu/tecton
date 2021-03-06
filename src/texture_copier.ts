import * as THREE from "three";

export { TextureCopier };

// The logic for moving swatches onto the planet texture was fiddly enough that I figured it needed to
// be extracted and tested in isolation.
class TextureCopier {
  protected atlas: THREE.DataTexture;
  protected destTexture: THREE.DataTexture;
  protected swatchEdgeLength: number;
  protected swatchPixelCount: number;
  protected swatchCache: { [startPixel: number]: Uint8ClampedArray };

  // It assumes that your swatches are square and uniform, but the atlas and texture can be any dimensions.
  constructor(atlas: THREE.DataTexture, destTexture: THREE.DataTexture, swatchEdgeLength: number) {
    this.atlas = atlas;
    this.destTexture = destTexture;
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
      this.destTexture.image.data.set(rowData, byteOffset);
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

    this.swatchCache[srcStartAt] = pixels;
    return pixels;
  }
}
