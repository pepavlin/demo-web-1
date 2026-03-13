import { createNoise2D } from "simplex-noise";
import * as THREE from "three";

export const WORLD_SIZE = 267;
export const TERRAIN_SEGMENTS = 120;
/** Terrain height below this value is considered water */
export const WATER_LEVEL = -0.5;

/**
 * Maximum vertical displacement of Gerstner waves above WATER_LEVEL.
 * Computed as the sum of all wave amplitudes defined in the water shader:
 *   0.26 + 0.20 + 0.28 + 0.065 + 0.050 = 0.855
 * When all wave crests coincide at a point the water surface peaks at
 * WATER_LEVEL + WAVE_MAX_AMPLITUDE ≈ 0.355 world units.
 */
export const WAVE_MAX_AMPLITUDE = 0.86;

/**
 * Minimum terrain-height clearance required for any land-based object to be
 * placed safely above the highest possible wave crest.
 *
 * Objects whose terrain Y is below  WATER_LEVEL + LAND_SPAWN_MARGIN  may
 * have waves visually washing over them. All spawners (generateSpawnPoints,
 * findPositionsInSectors, fixed-position structures, fence posts …) MUST
 * reject positions below this threshold.
 *
 * Value  1.0  gives a comfortable buffer: WATER_LEVEL + 1.0 = 0.5, safely
 * above the theoretical wave peak of ≈ 0.36.
 */
export const LAND_SPAWN_MARGIN = 1.0;

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

  // ── Boundary mountain ring ───────────────────────────────────────────────
  // Terrain rises steeply near world edges, forming a continuous mountain wall
  // that encloses the world from all four sides. The cubic (ef³) curve creates
  // a gentle approach slope that steepens dramatically at the boundary.
  const halfSize = WORLD_SIZE / 2;
  const RISE_ZONE = 50;           // mountains begin this many units from the edge
  const MAX_MOUNTAIN_HEIGHT = 55; // peak addition (puts summits in rock/snow territory)
  // Clamp to 0 so points outside the world don't exceed peak height
  const distFromEdge = Math.max(
    0,
    Math.min(halfSize - Math.abs(x), halfSize - Math.abs(z)),
  );
  const ef = Math.max(0, 1 - distFromEdge / RISE_ZONE);
  const edgeRise = ef * ef * ef * MAX_MOUNTAIN_HEIGHT;

  return (h1 + h2 + h3) * flattenFactor + edgeRise;
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

/** Position returned by structure-placement helpers. */
export interface StructurePosition {
  x: number;
  z: number;
  y: number;
}

/**
 * Scan the pre-computed height grid (populated by initNoise) and return the
 * most elevated land position within the given distance ring from the world
 * centre.  Ideal for placing the sniper tower on the highest visible hill.
 *
 * @param minDist       Minimum distance from centre (world units)
 * @param maxDist       Maximum distance from centre (world units)
 * @param minHeight     Minimum terrain height accepted (default 3.0)
 * @param maxSlopeDelta Max height difference to the next grid cell (slope guard)
 * @returns Best position found, or null if the grid has not been initialised
 *          or no valid cell exists in the search range.
 */
export function findBestElevatedPosition(
  minDist: number,
  maxDist: number,
  minHeight = 3.0,
  maxSlopeDelta = 6.0,
): StructurePosition | null {
  if (!heightGrid) return null;

  const N = TERRAIN_SEGMENTS + 1;
  const halfSize = WORLD_SIZE / 2;
  const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;
  const BOUNDARY_MARGIN = 8;

  let bestPos: StructurePosition | null = null;
  let bestHeight = -Infinity;

  // Step every 2 cells: good coverage without O(N²) cost at TERRAIN_SEGMENTS=120
  const STEP = 2;
  for (let j = 0; j < N; j += STEP) {
    for (let i = 0; i < N; i += STEP) {
      const x = -halfSize + i * cellSize;
      const z = -halfSize + j * cellSize;

      // World-boundary margin
      if (Math.abs(x) > halfSize - BOUNDARY_MARGIN || Math.abs(z) > halfSize - BOUNDARY_MARGIN) continue;

      const dist = Math.sqrt(x * x + z * z);
      if (dist < minDist || dist > maxDist) continue;

      const h = heightGrid[j * N + i];
      if (h < minHeight) continue;

      // Simple slope guard: compare with right and down neighbours
      if (i + STEP < N) {
        const hRight = heightGrid[j * N + (i + STEP)];
        if (Math.abs(hRight - h) > maxSlopeDelta) continue;
      }
      if (j + STEP < N) {
        const hDown = heightGrid[(j + STEP) * N + i];
        if (Math.abs(hDown - h) > maxSlopeDelta) continue;
      }

      if (h > bestHeight) {
        bestHeight = h;
        bestPos = { x, z, y: h };
      }
    }
  }

  return bestPos;
}

/**
 * Divide the map into `count` equal angular sectors and return one land
 * position per sector — all guaranteed to be above `minHeight` and within the
 * distance ring [minDist, maxDist] from the world centre.
 *
 * "Best" inside each sector is the position with the highest combined score of
 * distance-from-centre + 0.5 × elevation, which naturally picks strategic,
 * slightly elevated spots over flat coastal tiles.
 *
 * Any sector that contains no valid tile falls back to the nearest occupied
 * sector, so the returned array always has at most `count` entries (it may
 * have fewer only if the whole ring is ocean).
 *
 * Must be called after initNoise() so the height grid is populated.
 */
export function findPositionsInSectors(
  count: number,
  minDist: number,
  maxDist: number,
  minHeight = WATER_LEVEL + LAND_SPAWN_MARGIN,
  maxSlopeDelta = 5.0,
): StructurePosition[] {
  if (!heightGrid || count <= 0) return [];

  const N = TERRAIN_SEGMENTS + 1;
  const halfSize = WORLD_SIZE / 2;
  const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;
  const BOUNDARY_MARGIN = 8;
  const sectorAngle = (2 * Math.PI) / count;

  // One best candidate per sector
  const buckets: Array<{ pos: StructurePosition; score: number } | null> = Array(count).fill(null);

  const STEP = 2;
  for (let j = 0; j < N; j += STEP) {
    for (let i = 0; i < N; i += STEP) {
      const x = -halfSize + i * cellSize;
      const z = -halfSize + j * cellSize;

      if (Math.abs(x) > halfSize - BOUNDARY_MARGIN || Math.abs(z) > halfSize - BOUNDARY_MARGIN) continue;

      const dist = Math.sqrt(x * x + z * z);
      if (dist < minDist || dist > maxDist) continue;

      const h = heightGrid[j * N + i];
      if (h < minHeight) continue;

      if (i + STEP < N) {
        const hRight = heightGrid[j * N + (i + STEP)];
        if (Math.abs(hRight - h) > maxSlopeDelta) continue;
      }
      if (j + STEP < N) {
        const hDown = heightGrid[(j + STEP) * N + i];
        if (Math.abs(hDown - h) > maxSlopeDelta) continue;
      }

      // Map atan2 result from [-π, π] to [0, 2π]
      const angle = Math.atan2(z, x);
      const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
      const sectorIndex = Math.min(count - 1, Math.floor(normalizedAngle / sectorAngle));

      // Score: prefer farther + slightly elevated positions
      const score = dist + h * 0.5;

      if (!buckets[sectorIndex] || score > buckets[sectorIndex]!.score) {
        buckets[sectorIndex] = { pos: { x, z, y: h }, score };
      }
    }
  }

  // Collect, filling empty sectors from the nearest occupied neighbour
  const results: StructurePosition[] = [];
  for (let i = 0; i < count; i++) {
    if (buckets[i]) {
      results.push(buckets[i]!.pos);
    } else {
      // Walk outward in both directions to find a fallback
      for (let offset = 1; offset < count; offset++) {
        const adjRight = (i + offset) % count;
        if (buckets[adjRight]) { results.push(buckets[adjRight]!.pos); break; }
        const adjLeft = (i - offset + count) % count;
        if (buckets[adjLeft]) { results.push(buckets[adjLeft]!.pos); break; }
      }
    }
  }

  return results;
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

    // Reject shore/water positions — terrain must clear the highest wave crest
    // so objects are never submerged or visually washed over by waves.
    if (y < WATER_LEVEL + LAND_SPAWN_MARGIN) continue;

    // Avoid too-steep slopes
    const slopeCheck = getTerrainHeight(x + 2, z) - y;
    if (Math.abs(slopeCheck) > 3) continue;

    points.push({ x, z, y });
  }
  return points;
}

/**
 * Development guard for fixed-position structures.
 *
 * Logs a console warning when a hardcoded world position falls below the safe
 * land threshold (WATER_LEVEL + LAND_SPAWN_MARGIN). This should never fire
 * with the default terrain seed, but will surface issues immediately if
 * coordinates are changed or the terrain generation is modified.
 *
 * Silent in production (NODE_ENV !== 'development').
 *
 * @param label  Human-readable name of the structure (for the log message).
 * @param x      World X coordinate.
 * @param z      World Z coordinate.
 * @returns      The actual terrain height at (x, z).
 */
export function assertSafeLand(label: string, x: number, z: number): number {
  const h = getTerrainHeightSampled(x, z);
  if (h < WATER_LEVEL + LAND_SPAWN_MARGIN) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[assertSafeLand] "${label}" at (${x.toFixed(1)}, ${z.toFixed(1)}) ` +
        `is below safe land level: h=${h.toFixed(3)}, ` +
        `threshold=${(WATER_LEVEL + LAND_SPAWN_MARGIN).toFixed(3)}. ` +
        `This position may appear in water. Adjust coordinates or terrain seed.`
      );
    }
  }
  return h;
}
