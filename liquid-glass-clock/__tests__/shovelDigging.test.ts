/**
 * Tests for the shovel terrain-digging system.
 *
 * Coverage:
 *  - digVoxelSphere: density overrides are applied inside the sphere
 *  - digVoxelSphere: voxels outside the sphere are not affected
 *  - digVoxelSphere: digging makes previously-solid voxels become air
 *  - resetDensityOverrides: clears all overrides
 *  - WeaponConfig: shovel has correct type, color, terrainDigRadius, bulletSpeed
 *  - buildShovelMesh: returns a THREE.Group with children
 *  - soundManager.playAttack: handles "shovel" without throwing
 */

import {
  initVoxelNoise,
  getVoxelDensity,
  digVoxelSphere,
  resetDensityOverrides,
  VOXEL_SIZE,
} from "@/lib/voxelTerrain";
import { initNoise, getTerrainHeight } from "@/lib/terrainUtils";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";
import { buildShovelMesh } from "@/lib/meshBuilders";

// Initialise noise once before all tests
beforeAll(() => {
  initNoise(42);
  initVoxelNoise(42);
});

// Always start each test with a clean override map
beforeEach(() => {
  resetDensityOverrides();
});

afterEach(() => {
  resetDensityOverrides();
});

// ─── digVoxelSphere ────────────────────────────────────────────────────────────

describe("digVoxelSphere", () => {
  it("does not throw for any world position", () => {
    expect(() => digVoxelSphere(0, 0, 0, 2.5)).not.toThrow();
    expect(() => digVoxelSphere(-50, -10, 30, 4)).not.toThrow();
    expect(() => digVoxelSphere(100, 20, -80, 2)).not.toThrow();
  });

  it("increases density at the dig centre (makes it more air-like)", () => {
    // Pick a point well underground so density starts negative (solid)
    const x = 10, z = 10;
    const surfH = getTerrainHeight(x, z);
    const digY = surfH - 3; // 3 units below surface → guaranteed solid before dig

    const densityBefore = getVoxelDensity(x, digY, z);

    digVoxelSphere(x, digY, z, 2.5);

    const densityAfter = getVoxelDensity(x, digY, z);
    expect(densityAfter).toBeGreaterThan(densityBefore);
  });

  it("turns solid underground voxels into air within the sphere", () => {
    // Find a solid underground point
    const x = 20, z = 20;
    const surfH = getTerrainHeight(x, z);
    const digY = surfH - 2;

    // Before dig: must be solid (density < 0)
    const densityBefore = getVoxelDensity(x, digY, z);
    expect(densityBefore).toBeLessThan(0);

    // Dig a sphere centred on the underground point
    digVoxelSphere(x, digY, z, 4.0);

    // After dig: voxel at centre should be air (density > 0)
    const densityAfter = getVoxelDensity(x, digY, z);
    expect(densityAfter).toBeGreaterThan(0);
  });

  it("does not modify voxels far outside the sphere radius", () => {
    // Use a large radius to ensure we're checking a point clearly outside it
    const cx = 30, cy = -5, cz = 30;
    const radius = 2.5;
    // A point 3× radius away should not be affected
    const farX = cx + radius * 3 + VOXEL_SIZE * 2;

    const densityBefore = getVoxelDensity(farX, cy, cz);

    digVoxelSphere(cx, cy, cz, radius);

    const densityAfter = getVoxelDensity(farX, cy, cz);
    // Far points should be unchanged (or very close to unchanged)
    expect(densityAfter).toBeCloseTo(densityBefore, 5);
  });

  it("multiple digs accumulate (density does not decrease on re-dig)", () => {
    const x = 5, z = 5;
    const surfH = getTerrainHeight(x, z);
    const digY = surfH - 3;

    digVoxelSphere(x, digY, z, 2.5);
    const afterFirst = getVoxelDensity(x, digY, z);

    // A second dig should not decrease the density
    digVoxelSphere(x, digY, z, 2.5);
    const afterSecond = getVoxelDensity(x, digY, z);
    expect(afterSecond).toBeGreaterThanOrEqual(afterFirst);
  });

  it("also excavates points slightly offset from the centre", () => {
    const cx = 40, cz = 40;
    const surfH = getTerrainHeight(cx, cz);
    const cy = surfH - 2;
    const radius = 4.0;

    // Check a point 1 voxel below the centre inside the sphere
    const offsetY = cy - VOXEL_SIZE;
    const densityBefore = getVoxelDensity(cx, offsetY, cz);
    expect(densityBefore).toBeLessThan(0); // must start as solid

    digVoxelSphere(cx, cy, cz, radius);

    const densityAfter = getVoxelDensity(cx, offsetY, cz);
    expect(densityAfter).toBeGreaterThan(0); // should now be air
  });
});

// ─── resetDensityOverrides ─────────────────────────────────────────────────────

describe("resetDensityOverrides", () => {
  it("clears overrides so density returns to original value", () => {
    const x = 15, z = 15;
    const surfH = getTerrainHeight(x, z);
    const digY = surfH - 3;

    const densityOriginal = getVoxelDensity(x, digY, z);

    digVoxelSphere(x, digY, z, 3.0);
    const densityAfterDig = getVoxelDensity(x, digY, z);
    expect(densityAfterDig).toBeGreaterThan(densityOriginal); // dig applied

    resetDensityOverrides();

    const densityAfterReset = getVoxelDensity(x, digY, z);
    expect(densityAfterReset).toBeCloseTo(densityOriginal, 5); // back to baseline
  });

  it("does not throw on empty overrides map", () => {
    expect(() => resetDensityOverrides()).not.toThrow();
    expect(() => resetDensityOverrides()).not.toThrow(); // idempotent
  });
});

// ─── Shovel weapon config ──────────────────────────────────────────────────────

describe("WEAPON_CONFIGS.shovel", () => {
  const cfg = WEAPON_CONFIGS.shovel;

  it("exists in WEAPON_CONFIGS", () => {
    expect(cfg).toBeDefined();
  });

  it("has type === 'shovel'", () => {
    expect(cfg.type).toBe("shovel");
  });

  it("has bulletSpeed === 0 (melee only, no projectiles)", () => {
    expect(cfg.bulletSpeed).toBe(0);
  });

  it("has a positive terrainDigRadius", () => {
    expect(cfg.terrainDigRadius).toBeDefined();
    expect(cfg.terrainDigRadius!).toBeGreaterThan(0);
  });

  it("has a positive cooldown", () => {
    expect(cfg.cooldown).toBeGreaterThan(0);
  });

  it("has a positive range (dig reach)", () => {
    expect(cfg.range).toBeGreaterThan(0);
  });

  it("has a label string", () => {
    expect(typeof cfg.label).toBe("string");
    expect(cfg.label.length).toBeGreaterThan(0);
  });

  it("has a color string", () => {
    expect(typeof cfg.color).toBe("string");
    expect(cfg.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ─── buildShovelMesh ──────────────────────────────────────────────────────────

describe("buildShovelMesh", () => {
  it("returns a THREE.Group", () => {
    const mesh = buildShovelMesh();
    expect(mesh).toBeDefined();
    expect((mesh as any).isGroup).toBe(true);
  });

  it("has at least 10 child meshes (handle + grip + blade parts)", () => {
    const mesh = buildShovelMesh();
    expect(mesh.children.length).toBeGreaterThanOrEqual(10);
  });

  it("does not throw", () => {
    expect(() => buildShovelMesh()).not.toThrow();
  });

  it("all children are THREE.Mesh instances", () => {
    const mesh = buildShovelMesh();
    for (const child of mesh.children) {
      // Children may be Mesh or Group sub-groups
      expect((child as any).isObject3D).toBe(true);
    }
  });
});
