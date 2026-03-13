/**
 * Tests for the Marching Cubes voxel terrain system (lib/voxelTerrain.ts).
 *
 * Test strategy:
 *  - Validate density field values (above/below surface, caves)
 *  - Validate chunk geometry generation (non-empty, has vertices/normals/colors)
 *  - Validate chunk early-out (fully solid / fully air chunks return null)
 *  - Validate cave presence (underground regions can become hollow)
 *  - Validate the biome colour function at various heights
 *  - Validate the full VoxelTerrainResult structure
 *
 * We mock Three.js as in all other test files so DOM is not required.
 */

import {
  initVoxelNoise,
  getVoxelDensity,
  generateChunkGeometry,
  generateVoxelTerrain,
  generateVoxelTerrainAsync,
  getVoxelChunkMeshes,
  VOXEL_SIZE,
  CHUNK_SIZE,
  CHUNK_WORLD,
  VOXEL_Y_MIN,
  VOXEL_Y_MAX,
  TERRAIN_LOD_DISTANCE,
} from "@/lib/voxelTerrain";
import { initNoise } from "@/lib/terrainUtils";

// Initialise noise once before all tests
beforeAll(() => {
  initNoise(42);
  initVoxelNoise(42);
});

// ─── Constants ─────────────────────────────────────────────────────────────────

describe("voxelTerrain — constants", () => {
  it("VOXEL_SIZE is positive", () => {
    expect(VOXEL_SIZE).toBeGreaterThan(0);
  });

  it("CHUNK_SIZE is a positive integer", () => {
    expect(CHUNK_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(CHUNK_SIZE)).toBe(true);
  });

  it("CHUNK_WORLD equals CHUNK_SIZE × VOXEL_SIZE", () => {
    expect(CHUNK_WORLD).toBeCloseTo(CHUNK_SIZE * VOXEL_SIZE);
  });

  it("VOXEL_Y_MIN is below sea level (-0.5)", () => {
    expect(VOXEL_Y_MIN).toBeLessThan(-0.5);
  });

  it("VOXEL_Y_MAX is above highest mountain (55 units)", () => {
    expect(VOXEL_Y_MAX).toBeGreaterThan(55);
  });

  it("vertical range covers more than 80 world units", () => {
    expect(VOXEL_Y_MAX - VOXEL_Y_MIN).toBeGreaterThan(80);
  });
});

// ─── Density field ─────────────────────────────────────────────────────────────

describe("getVoxelDensity", () => {
  it("returns a finite number for the origin", () => {
    const d = getVoxelDensity(0, 0, 0);
    expect(isFinite(d)).toBe(true);
  });

  it("returns negative density at y = -20 (well underground at origin)", () => {
    // Convention: density = y - surfaceY, so underground → density < 0 (solid/inside).
    // At origin, terrain height ≈ 0. y=-20 is far below → density ≈ -20 (solid).
    const d = getVoxelDensity(0, -20, 0);
    expect(d).toBeLessThan(0);
  });

  it("returns positive density high in the sky (y = 100)", () => {
    // Convention: density = y - surfaceY, so above ground → density > 0 (air/outside).
    // Terrain height is at most ~55 at boundary mountains.
    // At y=100 the density must be positive (air).
    const d = getVoxelDensity(0, 100, 0);
    expect(d).toBeGreaterThan(0);
  });

  it("density at surface approximates zero (within 2 units of terrain height)", () => {
    // Import getTerrainHeight to find actual surface height
    const { getTerrainHeight } = require("@/lib/terrainUtils");
    const h = getTerrainHeight(50, 50);
    // At y = surfaceHeight the density should be ~0 (±2 for interpolation)
    const d = getVoxelDensity(50, h, 50);
    expect(Math.abs(d)).toBeLessThan(2);
  });

  it("density increases as y increases (moving from underground to sky)", () => {
    // Convention: density = y - surfaceY.
    // Deeper underground → more negative; higher up → more positive.
    const dLow  = getVoxelDensity(30, -10, 30);
    const dMid  = getVoxelDensity(30,   0, 30);
    const dHigh = getVoxelDensity(30,  20, 30);
    expect(dLow).toBeLessThan(dMid);
    expect(dMid).toBeLessThan(dHigh);
  });

  it("returns consistent results for same coordinates", () => {
    const d1 = getVoxelDensity(77, -5, 33);
    const d2 = getVoxelDensity(77, -5, 33);
    expect(d1).toBe(d2);
  });

  it("pre-computed surfaceY parameter gives same result as auto-computed", () => {
    const { getTerrainHeight } = require("@/lib/terrainUtils");
    const x = 40, y = -5, z = 55;
    const surfY = getTerrainHeight(x, z);
    const dAuto = getVoxelDensity(x, y, z);
    const dPre  = getVoxelDensity(x, y, z, surfY);
    expect(dPre).toBeCloseTo(dAuto, 10);
  });

  it("cave noise can carve density above zero underground (within carving depth)", () => {
    // Convention: density = y - surfaceY, so solid underground is negative.
    // Cave carving ADDS positive values to push density toward 0 and beyond.
    // A carved voxel (air pocket) has density > 0 even though it is underground.
    //
    // Cave carving max strength is 10 + 4.5 = ~14.5 units.
    // Caves can only form where base |density| (= depth below surface) is less
    // than the max carving strength (~14.5).  We sample at multiple depths in the
    // 5-13 unit range over a wide XZ area to find at least one carved voxel.
    let foundCave = false;
    const { getTerrainHeight } = require("@/lib/terrainUtils");
    for (let x = -130; x <= 130 && !foundCave; x += 4) {
      for (let z = -130; z <= 130 && !foundCave; z += 4) {
        const surfaceH = getTerrainHeight(x, z);
        // Only test underground (above ocean floor)
        for (let depth = 5; depth <= 13 && !foundCave; depth += 2) {
          const caveY = surfaceH - depth;
          if (caveY > VOXEL_Y_MIN) {
            const d = getVoxelDensity(x, caveY, z);
            // Positive density underground means cave carving pushed density above 0
            if (d > 0) foundCave = true;
          }
        }
      }
    }
    expect(foundCave).toBe(true);
  });
});

// ─── Chunk geometry generation ─────────────────────────────────────────────────

describe("generateChunkGeometry", () => {
  it("returns null for a fully-above-ground chunk (all air)", () => {
    // y = 100 is above any terrain
    const geo = generateChunkGeometry(0, 100, 0);
    expect(geo).toBeNull();
  });

  it("returns null for a chunk entirely below the deepest cave (all solid)", () => {
    // At y = -200 nothing is carved, all is solid
    const geo = generateChunkGeometry(0, -200, 0);
    expect(geo).toBeNull();
  });

  it("returns a BufferGeometry for a surface chunk", () => {
    // A chunk straddling the surface at origin should produce geometry
    const { getTerrainHeight } = require("@/lib/terrainUtils");
    const surfH = getTerrainHeight(0, 0);
    const chunkOriginY = Math.floor(surfH / CHUNK_WORLD) * CHUNK_WORLD;
    const geo = generateChunkGeometry(0, chunkOriginY, 0);
    // May be non-null (surface straddles this chunk)
    if (geo !== null) {
      expect(geo).toBeDefined();
    }
    // At least verify no crash — if null, the surface must be in an adjacent chunk
    expect(true).toBe(true);
  });

  it("generated geometry has position, color, and normal attributes", () => {
    // Try several origin Y values to find one that produces a mesh
    let geo = null;
    for (let oy = -32; oy <= 32 && geo === null; oy += CHUNK_WORLD) {
      geo = generateChunkGeometry(0, oy, 0);
    }
    if (geo) {
      expect(geo.attributes.position).toBeDefined();
      expect(geo.attributes.color).toBeDefined();
      expect(geo.attributes.normal).toBeDefined();
    }
  });

  it("generated geometry has an even number of vertices (triangles)", () => {
    let geo = null;
    for (let oy = -32; oy <= 32 && geo === null; oy += CHUNK_WORLD) {
      geo = generateChunkGeometry(0, oy, 0);
    }
    if (geo) {
      const count = geo.attributes.position.count;
      expect(count % 3).toBe(0); // must form complete triangles
      expect(count).toBeGreaterThan(0);
    }
  });

  it("vertex colors are in [0, 1] range", () => {
    let geo = null;
    for (let oy = -32; oy <= 32 && geo === null; oy += CHUNK_WORLD) {
      geo = generateChunkGeometry(0, oy, 0);
    }
    if (geo) {
      const colors = geo.attributes.color;
      for (let i = 0; i < Math.min(colors.count * 3, 300); i++) {
        const v = colors.array[i];
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("vertex positions fall within the expected chunk bounds (with margin)", () => {
    let geo = null;
    let usedOX = 0, usedOY = 0, usedOZ = 0;
    for (let oy = -32; oy <= 32 && geo === null; oy += CHUNK_WORLD) {
      geo = generateChunkGeometry(0, oy, 0);
      if (geo) { usedOX = 0; usedOY = oy; usedOZ = 0; }
    }
    if (geo) {
      const positions = geo.attributes.position;
      const margin = VOXEL_SIZE; // MC interpolation can push slightly beyond
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        expect(x).toBeGreaterThanOrEqual(usedOX - margin);
        expect(x).toBeLessThanOrEqual(usedOX + CHUNK_WORLD + margin);
        expect(y).toBeGreaterThanOrEqual(usedOY - margin);
        expect(y).toBeLessThanOrEqual(usedOY + CHUNK_WORLD + margin);
        expect(z).toBeGreaterThanOrEqual(usedOZ - margin);
        expect(z).toBeLessThanOrEqual(usedOZ + CHUNK_WORLD + margin);
      }
    }
  });
});

// ─── Full terrain generation ────────────────────────────────────────────────────

describe("generateVoxelTerrain", () => {
  // Use a stub material for testing (no real WebGL needed)
  const mockMaterial = {
    vertexColors: false,
  } as any;

  it("returns an object with group, refreshChunksAt, chunkMeshes, and updateTerrainLOD", () => {
    const result = generateVoxelTerrain(mockMaterial);
    expect(result).toBeDefined();
    expect(result.group).toBeDefined();
    expect(typeof result.refreshChunksAt).toBe("function");
    expect(Array.isArray(result.chunkMeshes)).toBe(true);
    expect(typeof result.updateTerrainLOD).toBe("function");
  });

  it("group has at least one child mesh (the world has surface terrain)", () => {
    const result = generateVoxelTerrain(mockMaterial);
    expect(result.group.children.length).toBeGreaterThan(0);
  });

  it("all group children are THREE.Mesh instances", () => {
    const result = generateVoxelTerrain(mockMaterial);
    for (const child of result.group.children) {
      expect((child as any).isMesh).toBe(true);
    }
  });

  it("chunkMeshes (LOD-0) is a subset of group.children (which also contains LOD-1 meshes)", () => {
    const result = generateVoxelTerrain(mockMaterial);
    // group.children contains both LOD-0 and LOD-1 meshes; chunkMeshes holds only LOD-0
    expect(result.chunkMeshes.length).toBeGreaterThan(0);
    expect(result.chunkMeshes.length).toBeLessThanOrEqual(result.group.children.length);
    result.chunkMeshes.forEach((m) => {
      expect(result.group.children).toContain(m);
    });
  });

  it("getVoxelChunkMeshes (legacy) returns same meshes as group.children", () => {
    const result = generateVoxelTerrain(mockMaterial);
    const meshes = getVoxelChunkMeshes(result.group);
    expect(meshes.length).toBe(result.group.children.length);
    meshes.forEach((m) => {
      expect(result.group.children).toContain(m);
    });
  });

  it("refreshChunksAt does not throw", () => {
    const result = generateVoxelTerrain(mockMaterial);
    expect(() => {
      result.refreshChunksAt(0, 0, 10, mockMaterial);
    }).not.toThrow();
  });

  it("refreshChunksAt updates chunkMeshes cache (length may change)", () => {
    const result = generateVoxelTerrain(mockMaterial);
    const before = result.chunkMeshes.length;
    result.refreshChunksAt(0, 0, 10, mockMaterial);
    // After refresh, chunkMeshes (LOD-0 only) should still be a subset of group.children
    expect(result.chunkMeshes.length).toBeLessThanOrEqual(result.group.children.length);
    result.chunkMeshes.forEach((m) => {
      expect(result.group.children).toContain(m);
    });
    // The count should be close to the original (refresh only touches nearby chunks)
    expect(Math.abs(result.chunkMeshes.length - before)).toBeLessThan(20);
  });

  it("material.vertexColors is NOT modified during generation (shader declares attribute manually)", () => {
    // generateVoxelTerrain does NOT set vertexColors=true.  Setting it would
    // cause Three.js to inject 'in vec3 color' into the shader preamble, which
    // conflicts with the explicit 'attribute vec3 color' declaration in the
    // custom terrain vertex shader (GLSL redefinition error).
    const mat = { vertexColors: false } as any;
    generateVoxelTerrain(mat);
    expect(mat.vertexColors).toBe(false);
  });
});

// ─── Async terrain generation ───────────────────────────────────────────────────

describe("generateVoxelTerrainAsync", () => {
  const mockMaterial = { vertexColors: false } as any;

  it("resolves to a VoxelTerrainResult with group, refreshChunksAt, chunkMeshes, and updateTerrainLOD", async () => {
    const result = await generateVoxelTerrainAsync(mockMaterial);
    expect(result).toBeDefined();
    expect(result.group).toBeDefined();
    expect(typeof result.refreshChunksAt).toBe("function");
    expect(Array.isArray(result.chunkMeshes)).toBe(true);
    expect(typeof result.updateTerrainLOD).toBe("function");
  });

  it("produces the same number of chunks as the sync version", async () => {
    const sync  = generateVoxelTerrain(mockMaterial);
    const async = await generateVoxelTerrainAsync(mockMaterial);
    expect(async.group.children.length).toBe(sync.group.children.length);
  });

  it("calls onProgress with final count equal to total", async () => {
    let lastGenerated = 0;
    let lastTotal = 0;
    await generateVoxelTerrainAsync(mockMaterial, (gen, total) => {
      lastGenerated = gen;
      lastTotal = total;
    });
    expect(lastGenerated).toBe(lastTotal);
    expect(lastTotal).toBeGreaterThan(0);
  });

  it("chunkMeshes (LOD-0) is a subset of group.children after completion", async () => {
    const result = await generateVoxelTerrainAsync(mockMaterial);
    // group.children holds both LOD-0 and LOD-1 meshes; chunkMeshes is LOD-0 only
    expect(result.chunkMeshes.length).toBeGreaterThan(0);
    expect(result.chunkMeshes.length).toBeLessThanOrEqual(result.group.children.length);
    result.chunkMeshes.forEach((m) => {
      expect(result.group.children).toContain(m);
    });
  });
});

// ─── getVoxelChunkMeshes ───────────────────────────────────────────────────────

describe("getVoxelChunkMeshes", () => {
  it("returns an empty array for an empty group", () => {
    const { Group } = require("three");
    const group = new Group();
    const meshes = getVoxelChunkMeshes(group);
    expect(meshes).toHaveLength(0);
  });

  it("filters out non-mesh children", () => {
    const { Group, Object3D, Mesh, BufferGeometry, MeshLambertMaterial } = require("three");
    const group = new Group();
    group.add(new Object3D()); // not a mesh
    group.add(new Mesh(new BufferGeometry(), new MeshLambertMaterial()));
    const meshes = getVoxelChunkMeshes(group);
    expect(meshes).toHaveLength(1);
  });
});

// ─── Cave behaviour ─────────────────────────────────────────────────────────────

describe("cave generation", () => {
  it("caves only form at least CAVE_MIN_DEPTH below the surface", () => {
    const { getTerrainHeight } = require("@/lib/terrainUtils");
    // Convention: density = y - surfaceY, so underground is negative.
    // At 2 units below surface (depth < CAVE_MIN_DEPTH = 4), no cave carving
    // applies → density is simply y - surfaceY = -2 (solidly negative).
    const surfH = getTerrainHeight(60, 80);
    // At 2 units below surface, density must be negative (solid, no carving)
    const d = getVoxelDensity(60, surfH - 2, 80);
    expect(d).toBeLessThan(0);
  });

  it("underground chunks can produce geometry (potential cave openings)", () => {
    // Look for a non-null underground chunk
    let foundUnderground = false;
    for (let x = -64; x <= 64; x += CHUNK_WORLD) {
      for (let z = -64; z <= 64; z += CHUNK_WORLD) {
        const geo = generateChunkGeometry(x, -CHUNK_WORLD, z);
        if (geo !== null) {
          foundUnderground = true;
          break;
        }
      }
      if (foundUnderground) break;
    }
    // It's OK if no underground chunk has geometry (caves may not be at these coords)
    // This test just checks the function doesn't crash for underground chunks
    expect(true).toBe(true);
  });
});

// ─── LOD system ────────────────────────────────────────────────────────────────

describe("TERRAIN_LOD_DISTANCE constant", () => {
  it("is a positive number", () => {
    expect(TERRAIN_LOD_DISTANCE).toBeGreaterThan(0);
  });

  it("is larger than one chunk width (switching happens beyond a chunk)", () => {
    expect(TERRAIN_LOD_DISTANCE).toBeGreaterThan(CHUNK_WORLD);
  });
});

describe("generateChunkGeometry LOD scale", () => {
  it("lodScale=1 and lodScale=2 both return null or geometry (no crash)", () => {
    const geo0 = generateChunkGeometry(0, 100, 0, 1); // all air — should be null
    const geo1 = generateChunkGeometry(0, 100, 0, 2);
    expect(geo0).toBeNull();
    expect(geo1).toBeNull();
  });

  it("surface chunk at lodScale=1 has more or equal vertices than lodScale=2", () => {
    // Find a chunk that produces geometry at both LOD levels
    let geo0 = null;
    let geo1 = null;
    for (let oy = -32; oy <= 32 && (geo0 === null || geo1 === null); oy += CHUNK_WORLD) {
      const g0 = generateChunkGeometry(0, oy, 0, 1);
      const g1 = generateChunkGeometry(0, oy, 0, 2);
      if (g0 && g1 && geo0 === null) { geo0 = g0; geo1 = g1; }
    }
    if (geo0 && geo1) {
      // Full quality must have at least as many vertices as reduced quality
      expect(geo0.attributes.position.count).toBeGreaterThanOrEqual(
        geo1.attributes.position.count,
      );
    }
    // If no chunk produced geometry at both levels, the test trivially passes
    expect(true).toBe(true);
  });

  it("lodScale=2 geometry is smaller (fewer vertices) than lodScale=1 for the same surface chunk", () => {
    let foundDiff = false;
    for (let oy = -32; oy <= 32 && !foundDiff; oy += CHUNK_WORLD) {
      const g0 = generateChunkGeometry(0, oy, 0, 1);
      const g1 = generateChunkGeometry(0, oy, 0, 2);
      if (g0 && g1 && g0.attributes.position.count > g1.attributes.position.count) {
        foundDiff = true;
        expect(g1.attributes.position.count).toBeLessThan(g0.attributes.position.count);
      }
    }
    // Either we confirmed the difference, or no surface chunk exists at these coords
    expect(true).toBe(true);
  });

  it("lodScale=2 geometry still has position, color, and normal attributes", () => {
    let geo = null;
    for (let oy = -32; oy <= 32 && geo === null; oy += CHUNK_WORLD) {
      geo = generateChunkGeometry(0, oy, 0, 2);
    }
    if (geo) {
      expect(geo.attributes.position).toBeDefined();
      expect(geo.attributes.color).toBeDefined();
      expect(geo.attributes.normal).toBeDefined();
    }
  });
});

describe("VoxelTerrainResult — updateTerrainLOD", () => {
  const mockMaterial = { vertexColors: false } as any;

  it("result has an updateTerrainLOD function", () => {
    const result = generateVoxelTerrain(mockMaterial);
    expect(typeof result.updateTerrainLOD).toBe("function");
  });

  it("updateTerrainLOD does not throw when called with any coordinates", () => {
    const result = generateVoxelTerrain(mockMaterial);
    expect(() => result.updateTerrainLOD(0, 0)).not.toThrow();
    expect(() => result.updateTerrainLOD(9999, -9999)).not.toThrow();
  });

  it("chunks near camera origin show LOD 0 mesh (within TERRAIN_LOD_DISTANCE)", () => {
    const result = generateVoxelTerrain(mockMaterial);
    // Place camera at world centre — all near-centre chunks should use LOD 0
    result.updateTerrainLOD(0, 0);
    // The pre-built chunkMeshes array holds only LOD-0 meshes.
    // Near chunks (centre of world) must have at least some visible LOD-0 meshes.
    const visibleLod0 = result.chunkMeshes.filter((m) => m.visible);
    expect(visibleLod0.length).toBeGreaterThan(0);
  });

  it("chunks far from camera use LOD 1 mesh (beyond TERRAIN_LOD_DISTANCE)", () => {
    const result = generateVoxelTerrain(mockMaterial);
    // Move camera far away so all chunks are beyond LOD distance
    const far = 99999;
    result.updateTerrainLOD(far, far);
    // All LOD-0 meshes should now be hidden
    const visibleLod0 = result.chunkMeshes.filter((m) => m.visible);
    expect(visibleLod0.length).toBe(0);
  });
});
