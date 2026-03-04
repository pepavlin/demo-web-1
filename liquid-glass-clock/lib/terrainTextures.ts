/**
 * Procedural terrain texture generation utilities.
 *
 * Each biome type gets a tileable 2D texture generated entirely in JS/Canvas,
 * so no external image assets are required.  The textures are sampled in the
 * terrain GLSL shader via triplanar projection to add high-frequency surface
 * detail on top of the procedural biome colour palette.
 *
 * Architecture note:
 *   generateTerrainTextureData() – pure function, no DOM dependency (testable)
 *   createTerrainTexture()       – thin wrapper that converts the result to a
 *                                   THREE.CanvasTexture (browser-only)
 */

export type TerrainTextureType = "grass" | "rock" | "sand" | "snow" | "dirt";

/**
 * Returns the RGBA pixel data for a tileable procedural terrain texture.
 *
 * @param type  Biome type
 * @param size  Canvas side length in pixels (must be power of 2, default 256)
 * @returns     Uint8ClampedArray of length size*size*4 (RGBA)
 */
export function generateTerrainTextureData(
  type: TerrainTextureType,
  size = 256
): Uint8ClampedArray {
  // ── Seedable LCG RNG for deterministic, repeatable output ──────────────────
  const typeSeeds: Record<TerrainTextureType, number> = {
    grass: 42,
    rock: 137,
    sand: 251,
    snow: 89,
    dirt: 314,
  };
  let seed = typeSeeds[type];
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  // ── Build a value-noise grid (bilinear-interpolated) ──────────────────────
  const noiseGrid = new Float32Array(size * size);
  for (let i = 0; i < noiseGrid.length; i++) noiseGrid[i] = rand();

  const bilinear = (x: number, y: number): number => {
    const ix = Math.floor(x) & (size - 1);
    const iy = Math.floor(y) & (size - 1);
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const ix1 = (ix + 1) & (size - 1);
    const iy1 = (iy + 1) & (size - 1);
    const a = noiseGrid[iy * size + ix];
    const b = noiseGrid[iy * size + ix1];
    const c = noiseGrid[iy1 * size + ix];
    const d = noiseGrid[iy1 * size + ix1];
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };

  /** Fractal Brownian Motion – stacks octaves of bilinear noise */
  const fbm = (x: number, y: number, octaves = 4): number => {
    let v = 0;
    let amp = 0.5;
    let freq = 1.0;
    let max = 0;
    for (let o = 0; o < octaves; o++) {
      v += bilinear(x * freq, y * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return v / max;
  };

  // ── Write pixel data ───────────────────────────────────────────────────────
  const data = new Uint8ClampedArray(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;
      const nx = (px / size) * 8;
      const ny = (py / size) * 8;

      const n0 = fbm(nx, ny, 4);
      const n1 = fbm(nx * 2.3 + 5.1, ny * 2.3 + 3.7, 3);
      const n2 = fbm(nx * 6.0 + 1.2, ny * 6.0 + 8.4, 2);

      let r = 0;
      let g = 0;
      let b = 0;

      if (type === "grass") {
        // Green tones with blade-like high-frequency detail
        const blade = n2 * 0.4 + n1 * 0.35 + n0 * 0.25;
        const bright = 0.6 + blade * 0.38;
        r = (0.18 + n0 * 0.12) * bright;
        g = (0.52 + n1 * 0.18) * bright;
        b = (0.08 + n0 * 0.06) * bright;
      } else if (type === "rock") {
        // Gray-brown stony texture with crack-like dark lines
        const grain = n0 * 0.5 + n1 * 0.3 + n2 * 0.2;
        const crack = Math.pow(Math.abs(n1 - 0.5) * 2.0, 2.2);
        const val = 0.45 + grain * 0.35 - crack * 0.25;
        r = val + 0.05;
        g = val * 0.93;
        b = val * 0.82;
      } else if (type === "sand") {
        // Warm beige with ripple-like directional patterns
        const ripple = Math.sin((px + n0 * 12) * 0.4) * 0.5 + 0.5;
        const grain = n1 * 0.4 + n2 * 0.3 + ripple * 0.3;
        const val = 0.65 + grain * 0.28;
        r = Math.min(1, val + 0.12);
        g = Math.min(1, val + 0.02);
        b = Math.min(1, val - 0.18);
      } else if (type === "snow") {
        // Bright white with faint blue crystal glint
        const sparkle = Math.pow(n2, 3.0);
        const val = 0.82 + n0 * 0.12 + sparkle * 0.06;
        r = Math.min(1, val);
        g = Math.min(1, val + 0.01);
        b = Math.min(1, val + 0.06 + sparkle * 0.08);
      } else {
        // dirt: dark earth, loamy brown
        const grain = n0 * 0.45 + n1 * 0.35 + n2 * 0.2;
        const val = 0.28 + grain * 0.3;
        r = Math.min(1, val + 0.1);
        g = Math.min(1, val * 0.8);
        b = Math.min(1, val * 0.55);
      }

      data[idx + 0] = Math.max(0, Math.min(255, Math.round(r * 255)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
      data[idx + 3] = 255;
    }
  }

  return data;
}

/**
 * Creates a browser-side THREE.CanvasTexture for a terrain biome.
 * Must only be called in a browser environment (document must exist).
 *
 * @param type  Biome type
 * @param size  Texture resolution (power of 2, default 256)
 */
export function createTerrainTexture(
  type: TerrainTextureType,
  size = 256
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any /* THREE.CanvasTexture – avoid hard THREE import at util level */ {
  // Inline require keeps THREE out of server-side bundles
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const THREE = require("three");

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const pixels = generateTerrainTextureData(type, size);
  const img = ctx.createImageData(size, size);
  img.data.set(pixels);
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}
