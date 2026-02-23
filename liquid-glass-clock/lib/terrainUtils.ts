import { createNoise2D } from "simplex-noise";

export const WORLD_SIZE = 800;
export const TERRAIN_SEGMENTS = 120;

let noise2D: ReturnType<typeof createNoise2D>;

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
