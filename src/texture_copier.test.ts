import { DataTexture } from "three";
import { TextureCopier } from "./texture_copier";

// A 8x8 grid where the bottom left corner is a 4x4 swatch and everything else is zeroes.
const atlasTexture = Uint8ClampedArray.of(
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 32 bytes per row
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
);
const atlas = new DataTexture(atlasTexture, 8, 8);
atlas.flipY = true;

// An 8x8 empty grid.
const destTexture = new Uint8ClampedArray(8 * 8 * 4);
const dest = new DataTexture(destTexture, 8, 8);
dest.flipY = true;

let copier: TextureCopier;

// Represents the contents of a texture as a human-readable run-length-encoded string.
function result() {
  let str = "";
  let currentByte = null;
  let count = 0;

  for (let i = 0; i < destTexture.length; i++) {
    if (destTexture[i] == currentByte) {
      count++;
    } else {
      if (count > 0) {
        str += `${count}x${currentByte} `;
      }

      currentByte = destTexture[i];
      count = 1;
    }
  }

  if (count > 0) {
    str += `${count}x${currentByte}`;
  }
  return str;
}

// @ts-ignore unused function warning, since this is just for debugging
function printGrid() {
  let str = "";
  for (let row = 0; row < dest.image.height; row++) {
    for (let col = 0; col < dest.image.width * 4; col++) {
      str += destTexture[row * dest.image.height * 4 + col];
    }
    str += "\n";
  }
  console.log(str);
}

beforeEach(() => {
  destTexture.fill(0);
  copier = new TextureCopier(atlas, dest, 4);
});

test("No copy", () => {
  expect(result()).toBe("256x0");
});

test("Copy to 0, 0", () => {
  copier.copy(128, 0, 0);
  expect(result()).toBe("8x3 24x0 8x4 216x0");
});

test("Copy to 1, 0", () => {
  copier.copy(128, 1, 0);
  expect(result()).toBe("12x3 20x0 12x4 212x0");
});

test("Copy to 4, 0", () => {
  copier.copy(128, 4, 0);
  expect(result()).toBe("8x0 16x3 16x0 16x4 200x0");
});

test("Copy to 6, 0", () => {
  copier.copy(128, 6, 0);
  expect(result()).toBe("20x0 12x3 20x0 12x4 192x0");
});

test("Copy to 7, 0", () => {
  copier.copy(128, 7, 0);
  expect(result()).toBe("24x0 8x3 24x0 8x4 192x0");
});

test("Copy to 4, 4", () => {
  copier.copy(128, 4, 4);
  expect(result()).toBe("104x0 16x1 16x0 16x2 16x0 16x3 16x0 16x4 40x0");
});

test("Copy to 0, 1", () => {
  copier.copy(128, 0, 1);
  expect(result()).toBe("8x2 24x0 8x3 24x0 8x4 184x0");
});

test("Copy to 1, 1", () => {
  copier.copy(128, 1, 1);
  expect(result()).toBe("12x2 20x0 12x3 20x0 12x4 180x0");
});

test("Copy to 0, 6", () => {
  copier.copy(128, 0, 6);
  expect(result()).toBe("160x0 8x1 24x0 8x2 24x0 8x3 24x0");
});

test("Copy to 0, 7", () => {
  copier.copy(128, 0, 7);
  expect(result()).toBe("192x0 8x1 24x0 8x2 24x0");
});

test("Copy to 4, 7", () => {
  copier.copy(128, 4, 7);
  expect(result()).toBe("200x0 16x1 16x0 16x2 8x0");
});

test("Copy to 4, 6", () => {
  copier.copy(128, 4, 6);
  expect(result()).toBe("168x0 16x1 16x0 16x2 16x0 16x3 8x0");
});

test("Copy to 6, 7", () => {
  copier.copy(128, 6, 7);
  expect(result()).toBe("212x0 12x1 20x0 12x2");
});

test("Copy to 7, 7", () => {
  copier.copy(128, 7, 7);
  expect(result()).toBe("216x0 8x1 24x0 8x2");
});

test("Copy to 7, 4", () => {
  copier.copy(128, 7, 4);
  expect(result()).toBe("120x0 8x1 24x0 8x2 24x0 8x3 24x0 8x4 32x0");
});

test("Overlapping copy", () => {
  copier.copy(128, 1, 1);
  copier.copy(128, 3, 2);
  printGrid();
  expect(result()).toBe("12x2 20x0 4x3 16x1 12x0 4x4 16x2 16x0 16x3 16x0 16x4 108x0");
});
