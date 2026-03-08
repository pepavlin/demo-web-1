import { createNoise2D } from "simplex-noise";
import * as THREE from "three";

export const WORLD_SIZE = 267;
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

// ─── Terrain modification (sculpt build tool) ─────────────────────────────────

/**
 * Raise or lower the terrain heightGrid in a circular brush around (worldX, worldZ).
 * Uses a smooth cosine falloff from the brush centre to the edge.
 *
 * @param worldX  Centre X in world space
 * @param worldZ  Centre Z in world space
 * @param delta   Height change at the centre (positive = raise, negative = lower)
 * @param radius  Brush radius in world units
 */
export function modifyTerrainHeight(
  worldX: number,
  worldZ: number,
  delta: number,
  radius: number
): void {
  if (!heightGrid) return;
  const N = TERRAIN_SEGMENTS + 1;
  const halfSize = WORLD_SIZE / 2;
  const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;

  const gxCenter = (worldX + halfSize) / cellSize;
  const gzCenter = (worldZ + halfSize) / cellSize;
  const gridRadius = radius / cellSize;

  const xMin = Math.max(0, Math.floor(gxCenter - gridRadius));
  const xMax = Math.min(N - 1, Math.ceil(gxCenter + gridRadius));
  const zMin = Math.max(0, Math.floor(gzCenter - gridRadius));
  const zMax = Math.min(N - 1, Math.ceil(gzCenter + gridRadius));

  for (let j = zMin; j <= zMax; j++) {
    for (let i = xMin; i <= xMax; i++) {
      const dx = i - gxCenter;
      const dz = j - gzCenter;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < gridRadius) {
        const t = dist / gridRadius;
        // Smooth cosine falloff: 1 at centre, 0 at edge
        const falloff = 0.5 - 0.5 * Math.cos((1 - t) * Math.PI);
        heightGrid[j * N + i] += delta * falloff;
      }
    }
  }
}

/**
 * Flatten the terrain heightGrid within a rectangular area to a target height.
 * Vertices inside the core rectangle are set to targetY; vertices in the blend
 * margin transition smoothly between their original height and targetY using a
 * cosine falloff, so the city area merges naturally with the surrounding landscape.
 *
 * @param worldX      Centre X in world space
 * @param worldZ      Centre Z in world space
 * @param halfW       Half-width of the flat core region (along X axis)
 * @param halfD       Half-depth of the flat core region (along Z axis)
 * @param targetY     Height to flatten to
 * @param blendMargin Extra distance beyond the core where blending occurs
 */
export function flattenTerrainRect(
  worldX: number,
  worldZ: number,
  halfW: number,
  halfD: number,
  targetY: number,
  blendMargin: number
): void {
  if (!heightGrid) return;
  const N = TERRAIN_SEGMENTS + 1;
  const halfSize = WORLD_SIZE / 2;
  const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;

  const outerHalfW = halfW + blendMargin;
  const outerHalfD = halfD + blendMargin;

  // Grid index bounds for the outer (blend) region
  const xMinG = Math.max(0, Math.floor((worldX - outerHalfW + halfSize) / cellSize));
  const xMaxG = Math.min(N - 1, Math.ceil((worldX + outerHalfW + halfSize) / cellSize));
  const zMinG = Math.max(0, Math.floor((worldZ - outerHalfD + halfSize) / cellSize));
  const zMaxG = Math.min(N - 1, Math.ceil((worldZ + outerHalfD + halfSize) / cellSize));

  for (let j = zMinG; j <= zMaxG; j++) {
    for (let i = xMinG; i <= xMaxG; i++) {
      const vx = -halfSize + i * cellSize;
      const vz = -halfSize + j * cellSize;

      // Distance from the vertex to the core rectangle boundary (negative = inside)
      const dx = Math.max(0, Math.abs(vx - worldX) - halfW);
      const dz = Math.max(0, Math.abs(vz - worldZ) - halfD);
      const distToEdge = Math.sqrt(dx * dx + dz * dz);

      if (distToEdge >= blendMargin) continue; // outside blend zone

      // t=0 at core boundary, t=1 deep inside core
      const t = blendMargin > 0 ? 1 - distToEdge / blendMargin : 1;
      // Smooth cosine blend
      const blend = 0.5 - 0.5 * Math.cos(t * Math.PI);

      const current = heightGrid[j * N + i];
      heightGrid[j * N + i] = current + (targetY - current) * blend;
    }
  }
}

/**
 * Synchronise the Three.js terrain mesh geometry with the current heightGrid.
 * Call this after one or more `modifyTerrainHeight` calls.
 *
 * Also recomputes vertex colours (same palette as the initial terrain setup
 * in Game3D.tsx) and vertex normals so lighting stays correct.
 */
export function updateTerrainGeometry(terrain: THREE.Mesh): void {
  if (!heightGrid) return;
  const geo = terrain.geometry as THREE.BufferGeometry;
  const positions = geo.attributes.position as THREE.BufferAttribute;
  const colors = geo.attributes.color as THREE.BufferAttribute | undefined;

  // Colour helpers — kept in sync with Game3D.tsx initial terrain setup
  const lerpC = (a: number[], b: number[], t: number): number[] => {
    const tc = Math.max(0, Math.min(1, t));
    return [
      a[0] + (b[0] - a[0]) * tc,
      a[1] + (b[1] - a[1]) * tc,
      a[2] + (b[2] - a[2]) * tc,
    ];
  };
  const deepWater    = [0.12, 0.22, 0.50];
  const shallowWater = [0.22, 0.44, 0.68];
  const sand         = [0.74, 0.68, 0.44];
  const brightGrass  = [0.40, 0.68, 0.22];
  const midGrass     = [0.30, 0.54, 0.17];
  const darkGrass    = [0.23, 0.43, 0.13];
  const rockBrown    = [0.50, 0.42, 0.30];
  const rockGray     = [0.62, 0.59, 0.56];

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = getTerrainHeightSampled(x, z);
    positions.setY(i, h);

    if (colors) {
      let col: number[];
      if (h < -3)        col = deepWater;
      else if (h < -0.5) col = lerpC(deepWater, shallowWater, (h + 3) / 2.5);
      else if (h < 0.4)  col = lerpC(shallowWater, sand, (h + 0.5) / 0.9);
      else if (h < 2.5)  col = lerpC(sand, brightGrass, (h - 0.4) / 2.1);
      else if (h < 7)    col = lerpC(brightGrass, midGrass, (h - 2.5) / 4.5);
      else if (h < 17)   col = lerpC(midGrass, darkGrass, (h - 7) / 10);
      else if (h < 28)   col = lerpC(darkGrass, rockBrown, (h - 17) / 11);
      else               col = lerpC(rockBrown, rockGray, Math.min(1, (h - 28) / 12));
      colors.setXYZ(i, col[0], col[1], col[2]);
    }
  }

  positions.needsUpdate = true;
  if (colors) colors.needsUpdate = true;
  geo.computeVertexNormals();
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

  // Keep objects at least this many units away from the world edge
  const BOUNDARY_MARGIN = 8;
  const halfWorld = WORLD_SIZE / 2 - BOUNDARY_MARGIN;

  let attempts = 0;
  while (points.length < count && attempts < count * 20) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = minDist + rand() * (maxDist - minDist);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Skip points outside the world square — they would float above the void
    if (Math.abs(x) > halfWorld || Math.abs(z) > halfWorld) continue;

    const y = getTerrainHeight(x, z);

    // Don't spawn in water (terrain must be above the visual water surface)
    if (y < WATER_LEVEL) continue;

    // Avoid too-steep slopes
    const slopeCheck = getTerrainHeight(x + 2, z) - y;
    if (Math.abs(slopeCheck) > 3) continue;

    points.push({ x, z, y });
  }
  return points;
}
