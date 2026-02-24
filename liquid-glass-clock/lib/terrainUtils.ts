import { createNoise2D } from "simplex-noise";

export const WORLD_SIZE = 800;
export const TERRAIN_SEGMENTS = 120;
/** Terrain height below this value is considered water */
export const WATER_LEVEL = -0.5;

let noise2D: ReturnType<typeof createNoise2D>;

/**
 * Pre-computed height grid that mirrors the terrain mesh vertices exactly.
 * Using this allows bilinear interpolation that matches the visual mesh,
 * preventing objects from floating above or sinking into the terrain.
 */
let heightGrid: Float32Array | null = null;

function initHeightGrid(): void {
  const N = TERRAIN_SEGMENTS + 1;
  heightGrid = new Float32Array(N * N);
  const halfSize = WORLD_SIZE / 2;
  const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = -halfSize + i * cellSize;
      const z = -halfSize + j * cellSize;
      heightGrid[j * N + i] = getTerrainHeight(x, z);
    }
  }
}

export function initNoise(seed = 42) {
  // Simplex-noise v4 uses a seeded PRNG; we pass a simple hash function
  const prng = () => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  };
  noise2D = createNoise2D(prng());
  // Pre-compute the height grid so getTerrainHeightSampled matches the mesh
  initHeightGrid();
}

export function getTerrainHeight(x: number, z: number): number {
  if (!noise2D) initNoise();
  const scale1 = 0.003;
  const scale2 = 0.01;
  const scale3 = 0.04;

  const h1 = noise2D(x * scale1, z * scale1) * 30;
  const h2 = noise2D(x * scale2, z * scale2) * 10;
  const h3 = noise2D(x * scale3, z * scale3) * 3;

  // Flatten the center area (spawn zone)
  const distFromCenter = Math.sqrt(x * x + z * z);
  const flattenFactor = Math.min(1, distFromCenter / 80);

  return (h1 + h2 + h3) * flattenFactor;
}

/**
 * Returns the terrain height at (x, z) using bilinear interpolation of the
 * same grid the terrain mesh is built from.  This matches the *visual* mesh
 * surface exactly, so objects placed with this function never float or sink.
 *
 * Fall back to getTerrainHeight if the grid has not been initialised yet.
 */
export function getTerrainHeightSampled(x: number, z: number): number {
  if (!heightGrid) {
    // Grid not ready — fall back to the exact noise value
    return getTerrainHeight(x, z);
  }
  const halfSize = WORLD_SIZE / 2;
  const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;
  const N = TERRAIN_SEGMENTS + 1;

  // Normalised grid coordinates (clamped to valid range)
  const gx = Math.max(0, Math.min(TERRAIN_SEGMENTS - 1e-6, (x + halfSize) / cellSize));
  const gz = Math.max(0, Math.min(TERRAIN_SEGMENTS - 1e-6, (z + halfSize) / cellSize));

  const i0 = Math.floor(gx);
  const j0 = Math.floor(gz);
  const i1 = i0 + 1;
  const j1 = j0 + 1;

  const fx = gx - i0;
  const fz = gz - j0;

  // Read the four surrounding grid heights
  const h00 = heightGrid[j0 * N + i0];
  const h10 = heightGrid[j0 * N + i1];
  const h01 = heightGrid[j1 * N + i0];
  const h11 = heightGrid[j1 * N + i1];

  // Bilinear interpolation — matches THREE.js PlaneGeometry's linear vertex
  // interpolation within each mesh triangle
  return h00 * (1 - fx) * (1 - fz) +
         h10 * fx        * (1 - fz) +
         h01 * (1 - fx)  * fz       +
         h11 * fx        * fz;
}

export interface SpawnPoint {
  x: number;
  z: number;
  y: number;
}

export function generateSpawnPoints(
  count: number,
  minDist: number,
  maxDist: number,
  seed = 99
): SpawnPoint[] {
  const points: SpawnPoint[] = [];
  let rng = seed;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0xffffffff;
  };

  let attempts = 0;
  while (points.length < count && attempts < count * 20) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = minDist + rand() * (maxDist - minDist);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = getTerrainHeight(x, z);

    // Don't spawn in water
    if (y < -1) continue;

    // Avoid too-steep slopes
    const slopeCheck = getTerrainHeight(x + 2, z) - y;
    if (Math.abs(slopeCheck) > 3) continue;

    points.push({ x, z, y });
  }
  return points;
}
