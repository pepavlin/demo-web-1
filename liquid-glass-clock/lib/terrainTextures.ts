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
 *
 * Detail quality:
 *   Default resolution is 512×512 with 6-octave FBM and domain-warped noise
 *   for richer micro-detail.  Each biome uses a dedicated algorithm that
 *   produces characteristic surface patterns (blades, strata, ripples, etc.)
 */

export type TerrainTextureType = "grass" | "rock" | "sand" | "snow" | "dirt";

/**
 * Returns the RGBA pixel data for a tileable procedural terrain texture.
 *
 * @param type  Biome type
 * @param size  Canvas side length in pixels (must be power of 2, default 512)
 * @returns     Uint8ClampedArray of length size*size*4 (RGBA)
 */
export function generateTerrainTextureData(
  type: TerrainTextureType,
  size = 512
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

  // Secondary high-frequency noise grid for micro-detail
  let seed2 = typeSeeds[type] ^ 0xdeadbeef;
  const rand2 = (): number => {
    seed2 = (seed2 * 1664525 + 1013904223) & 0xffffffff;
    return (seed2 >>> 0) / 0xffffffff;
  };
  const noiseGrid2 = new Float32Array(size * size);
  for (let i = 0; i < noiseGrid2.length; i++) noiseGrid2[i] = rand2();

  const bilinear = (grid: Float32Array, x: number, y: number): number => {
    const ix = Math.floor(x) & (size - 1);
    const iy = Math.floor(y) & (size - 1);
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const ix1 = (ix + 1) & (size - 1);
    const iy1 = (iy + 1) & (size - 1);
    const a = grid[iy * size + ix];
    const b = grid[iy * size + ix1];
    const c = grid[iy1 * size + ix];
    const d = grid[iy1 * size + ix1];
    // Smoothstep interpolation for softer noise
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };

  const sampleNoise = (x: number, y: number) => bilinear(noiseGrid, x, y);
  const sampleNoise2 = (x: number, y: number) => bilinear(noiseGrid2, x, y);

  /** Fractal Brownian Motion – stacks octaves of bilinear noise */
  const fbm = (
    x: number,
    y: number,
    octaves = 6,
    grid: Float32Array = noiseGrid
  ): number => {
    let v = 0;
    let amp = 0.5;
    let freq = 1.0;
    let max = 0;
    for (let o = 0; o < octaves; o++) {
      v += bilinear(grid, x * freq, y * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return v / max;
  };

  /** Domain-warped FBM for richer, non-repetitive detail */
  const warpedFbm = (
    x: number,
    y: number,
    octaves = 5,
    warpStrength = 1.2
  ): number => {
    // First pass: compute warp offsets
    const wx = fbm(x + 0.0, y + 0.0, 3) * warpStrength;
    const wy = fbm(x + 5.2, y + 1.3, 3) * warpStrength;
    // Second pass: sample FBM at warped coordinates
    return fbm(x + wx, y + wy, octaves);
  };

  // ── Write pixel data ───────────────────────────────────────────────────────
  const data = new Uint8ClampedArray(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;

      // Normalized coords tiled 8× across the texture (same tiling as before)
      const nx = (px / size) * 8;
      const ny = (py / size) * 8;

      // Multi-scale FBM passes at different frequencies
      const n0 = fbm(nx, ny, 6);           // broad shape (~1 unit at scale 8)
      const n1 = fbm(nx * 2.3 + 5.1, ny * 2.3 + 3.7, 5); // medium detail
      const n2 = fbm(nx * 6.0 + 1.2, ny * 6.0 + 8.4, 4); // fine detail
      const n3 = fbm(nx * 14.0 + 3.7, ny * 14.0 + 6.1, 3, noiseGrid2); // micro-detail
      const nW = warpedFbm(nx * 1.5, ny * 1.5, 5);        // domain-warped medium

      let r = 0;
      let g = 0;
      let b = 0;

      if (type === "grass") {
        // Grass: multi-scale blade simulation with tonal variation
        // n2/n3 drive fine blade edges; n0/nW drive patch-level color shifts
        const blade = n3 * 0.30 + n2 * 0.30 + n1 * 0.25 + n0 * 0.15;

        // Blade brightening: simulate light catching upward-facing blades
        const bright = 0.55 + blade * 0.42;

        // Patch-level hue variation (yellower patches vs deeper green)
        const patchHue = nW * 0.22; // 0..0.22
        const bladeVar = n2 * 0.12 - n3 * 0.08;

        r = (0.16 + patchHue * 0.35 + bladeVar) * bright;
        g = (0.50 + n1 * 0.18 + patchHue * 0.05) * bright;
        b = (0.07 + n0 * 0.05 - patchHue * 0.04) * bright;

        // Occasional yellowed/dry blade streaks
        const dryStreak = Math.max(0, n3 - 0.72) * 3.5;
        r += dryStreak * 0.25;
        g += dryStreak * 0.20;
        b -= dryStreak * 0.04;
      } else if (type === "rock") {
        // Rock: stratification bands + crack network + grain
        const grain = n0 * 0.40 + n1 * 0.30 + n2 * 0.20 + n3 * 0.10;

        // Horizontal strata bands (simulates layered rock)
        const strataY = (py / size) * 12.0;
        const strata = Math.abs(Math.sin(strataY + nW * 1.5)) * 0.5;

        // Crack network: thin dark lines where |n1 - 0.5| is near zero
        const crack = Math.pow(Math.abs(n1 - 0.5) * 2.0, 2.5);
        // Secondary micro-cracks
        const microCrack = Math.pow(Math.abs(n2 - 0.5) * 2.0, 3.0) * 0.4;

        const val =
          0.42 +
          grain * 0.32 +
          strata * 0.08 -
          crack * 0.28 -
          microCrack * 0.12;

        // Slight warm-cool variation across strata layers
        const warmBias = strata * 0.06;
        r = val + 0.06 + warmBias;
        g = val * 0.92 + warmBias * 0.3;
        b = val * 0.80 - warmBias * 0.1;
      } else if (type === "sand") {
        // Sand: wind-ripple simulation with grain micro-detail
        // Primary ripples: sinusoidal bands with noise-warped phase
        const ripplePhase = (px / size) * 14.0 + nW * 8.0;
        const ripple = Math.sin(ripplePhase) * 0.5 + 0.5;

        // Secondary cross-ripples (interference pattern)
        const crossPhase = (py / size) * 9.0 + n0 * 5.0;
        const crossRipple = Math.sin(crossPhase + ripple * 1.2) * 0.5 + 0.5;

        // Fine sand grain
        const grain = n2 * 0.30 + n3 * 0.40 + crossRipple * 0.30;
        const val = 0.62 + grain * 0.28 + ripple * 0.10;

        r = Math.min(1, val + 0.14);
        g = Math.min(1, val + 0.04);
        b = Math.min(1, val - 0.20);

        // Darker hollows in ripple troughs (shadow simulation)
        const shadow = (1.0 - ripple) * 0.12;
        r -= shadow;
        g -= shadow;
        b -= shadow * 0.5;
      } else if (type === "snow") {
        // Snow: compressed crystal facets with blue-shadow pockets
        // Macro undulation for snow drift shapes
        const drift = nW * 0.10;

        // Crystal sparkle: concentrated highlights using power functions
        const sparkle1 = Math.pow(Math.max(0, n3 - 0.60) / 0.40, 3.0);
        const sparkle2 = Math.pow(Math.max(0, n2 - 0.72) / 0.28, 4.0) * 0.5;

        // Shadow pockets between crystals (blue-tinted shadows)
        const shadowPocket = Math.pow(1.0 - n3, 4.0) * 0.08;

        const base = 0.82 + n0 * 0.09 + drift;
        r = Math.min(1, base - shadowPocket * 0.6 + sparkle1 * 0.08 + sparkle2 * 0.04);
        g = Math.min(1, base - shadowPocket * 0.4 + sparkle1 * 0.06 + sparkle2 * 0.03);
        b = Math.min(1, base + 0.06 - shadowPocket * 0.05 + sparkle1 * 0.12 + sparkle2 * 0.08);
      } else {
        // Dirt: loamy soil with pebble-like clumps and fine root veins
        // Base soil colour variation
        const loam = n0 * 0.35 + n1 * 0.30 + n2 * 0.20 + n3 * 0.15;

        // Pebble/clump edges: local contrast enhancement where n2 is near threshold
        const pebbleEdge = Math.pow(Math.abs(n2 - 0.48) * 2.0, 2.2) * 0.15;

        // Dark root/vein network (similar to rock cracks but softer)
        const vein = Math.pow(Math.abs(nW - 0.5) * 2.0, 3.5) * 0.12;

        // Subtle moisture variation (darker = wetter patches)
        const moisture = sampleNoise(nx * 3.0 + 2.1, ny * 3.0 + 7.4) * 0.08;

        const val = 0.26 + loam * 0.28 - vein - moisture + pebbleEdge;

        r = Math.min(1, Math.max(0, val + 0.11));
        g = Math.min(1, Math.max(0, val * 0.80));
        b = Math.min(1, Math.max(0, val * 0.54));

        // Extra dark clump shadows
        const clump = Math.max(0, sampleNoise2(nx * 7.0, ny * 7.0) - 0.75) * 0.25;
        r -= clump * 0.12;
        g -= clump * 0.10;
        b -= clump * 0.07;
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
 * @param size  Texture resolution (power of 2, default 512)
 */
export function createTerrainTexture(
  type: TerrainTextureType,
  size = 512
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
  // Anisotropic filtering reduces blurring of tileable textures at oblique angles
  tex.anisotropy = 16;
  return tex;
}
