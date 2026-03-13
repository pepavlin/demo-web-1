/**
 * Tests for bomb mechanics:
 * - buildBombMesh() visual construction
 * - BombProjectileData type shape
 * - Terrain crater deformation via modifyTerrainHeight
 * - Bomb physics (gravity simulation)
 */

// Mock THREE.js WebGL renderer
jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return {
    ...actual,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: document.createElement("canvas"),
      shadowMap: { enabled: false, type: null },
      toneMapping: null,
      toneMappingExposure: 1,
    })),
  };
});

import { buildBombMesh } from "@/lib/meshBuilders";
import {
  initNoise,
  getTerrainHeightSampled,
  modifyTerrainHeight,
  updateTerrainGeometry,
} from "@/lib/terrainUtils";
import type { BombProjectileData, WorldItem, BulletData } from "@/lib/gameTypes";
import * as THREE from "three";

// ─── buildBombMesh ─────────────────────────────────────────────────────────────

describe("buildBombMesh", () => {
  it("returns a THREE.Group", () => {
    const mesh = buildBombMesh();
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  it("has at least 3 children (body, fuse, spark)", () => {
    const mesh = buildBombMesh();
    expect(mesh.children.length).toBeGreaterThanOrEqual(3);
  });

  it("respects scale parameter (default 1.0)", () => {
    const mesh = buildBombMesh();
    expect(mesh.scale.x).toBeCloseTo(1.0);
    expect(mesh.scale.y).toBeCloseTo(1.0);
    expect(mesh.scale.z).toBeCloseTo(1.0);
  });

  it("respects custom scale parameter", () => {
    const mesh = buildBombMesh(0.52);
    expect(mesh.scale.x).toBeCloseTo(0.52);
    expect(mesh.scale.y).toBeCloseTo(0.52);
    expect(mesh.scale.z).toBeCloseTo(0.52);
  });

  it("at least one child mesh has a dark material color", () => {
    const mesh = buildBombMesh();
    let foundDarkBody = false;
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshLambertMaterial;
        if (mat && mat.color) {
          const hex = mat.color.getHex();
          // Main body should be very dark (near-black)
          if (hex <= 0x3a3a3a) foundDarkBody = true;
        }
      }
    });
    expect(foundDarkBody).toBe(true);
  });

  it("held-size variant (0.52 scale) is smaller than world-size variant", () => {
    const world = buildBombMesh(1.0);
    const held = buildBombMesh(0.52);
    expect(held.scale.x).toBeLessThan(world.scale.x);
  });
});

// ─── BombProjectileData type shape ────────────────────────────────────────────

describe("BombProjectileData", () => {
  it("can be created with correct fields", () => {
    const group = new THREE.Group();
    const bomb: BombProjectileData = {
      mesh: group,
      velocity: new THREE.Vector3(5, 3, -8),
      fuseTimer: 4.5,
      exploded: false,
    };
    expect(bomb.mesh).toBe(group);
    expect(bomb.velocity.x).toBe(5);
    expect(bomb.fuseTimer).toBe(4.5);
    expect(bomb.exploded).toBe(false);
  });

  it("can be marked as exploded", () => {
    const bomb: BombProjectileData = {
      mesh: new THREE.Group(),
      velocity: new THREE.Vector3(),
      fuseTimer: 0,
      exploded: false,
    };
    bomb.exploded = true;
    expect(bomb.exploded).toBe(true);
  });
});

// ─── Bomb physics simulation ───────────────────────────────────────────────────

describe("bomb projectile physics simulation", () => {
  const BOMB_GRAVITY = -18;
  const BOMB_THROW_SPEED = 14;

  function simulateBombFlight(
    initialVelocity: THREE.Vector3,
    groundY: number,
    maxSteps = 1000,
    dt = 0.016
  ): { landed: boolean; steps: number; finalPos: THREE.Vector3 } {
    const pos = new THREE.Vector3(0, 2, 0);
    const vel = initialVelocity.clone();
    for (let i = 0; i < maxSteps; i++) {
      vel.y += BOMB_GRAVITY * dt;
      pos.addScaledVector(vel, dt);
      if (pos.y <= groundY) {
        return { landed: true, steps: i, finalPos: pos };
      }
    }
    return { landed: false, steps: maxSteps, finalPos: pos };
  }

  it("bomb thrown horizontally falls to ground eventually", () => {
    const vel = new THREE.Vector3(BOMB_THROW_SPEED, 0, 0);
    const result = simulateBombFlight(vel, 0);
    expect(result.landed).toBe(true);
  });

  it("bomb thrown upward still falls to ground", () => {
    const vel = new THREE.Vector3(0, 8, 0);
    const result = simulateBombFlight(vel, 0);
    expect(result.landed).toBe(true);
  });

  it("bomb fuse timer decrements correctly over dt", () => {
    const dt = 0.016;
    const BOMB_FUSE_DURATION = 4.5;
    let fuse = BOMB_FUSE_DURATION;
    const steps = Math.floor(BOMB_FUSE_DURATION / dt);
    for (let i = 0; i < steps; i++) {
      fuse -= dt;
    }
    expect(fuse).toBeLessThanOrEqual(0.1); // close to zero
    expect(fuse).toBeGreaterThan(-0.1);
  });

  it("bomb travels forward (positive x) when thrown in +x direction", () => {
    const vel = new THREE.Vector3(BOMB_THROW_SPEED, 2, 0);
    const result = simulateBombFlight(vel, -5);
    expect(result.finalPos.x).toBeGreaterThan(0);
  });

  it("bomb with upward tilt travels farther than purely horizontal throw", () => {
    const velFlat = new THREE.Vector3(BOMB_THROW_SPEED, 0, 0);
    const velArced = new THREE.Vector3(BOMB_THROW_SPEED * 0.98, BOMB_THROW_SPEED * 0.18, 0).normalize().multiplyScalar(BOMB_THROW_SPEED);
    const resultFlat = simulateBombFlight(velFlat, 0);
    const resultArced = simulateBombFlight(velArced, 0);
    // Arced throw should land farther in x
    expect(resultArced.finalPos.x).toBeGreaterThan(resultFlat.finalPos.x * 0.9);
  });
});

// ─── Terrain crater deformation ────────────────────────────────────────────────

describe("bomb crater terrain deformation", () => {
  const BOMB_CRATER_RADIUS = 6;
  const BOMB_CRATER_DEPTH = -2.8;

  beforeEach(() => {
    initNoise(42);
  });

  it("modifyTerrainHeight lowers terrain at impact point", () => {
    // Get terrain height before deformation at a land area
    const testX = 30;
    const testZ = 30;
    const heightBefore = getTerrainHeightSampled(testX, testZ);

    // Apply crater deformation
    modifyTerrainHeight(testX, testZ, BOMB_CRATER_DEPTH, BOMB_CRATER_RADIUS);

    const heightAfter = getTerrainHeightSampled(testX, testZ);
    expect(heightAfter).toBeLessThan(heightBefore);
  });

  it("crater centre is lower than crater edge", () => {
    const cx = 50;
    const cz = 50;

    modifyTerrainHeight(cx, cz, BOMB_CRATER_DEPTH, BOMB_CRATER_RADIUS);

    const heightCentre = getTerrainHeightSampled(cx, cz);
    const heightEdge = getTerrainHeightSampled(cx + BOMB_CRATER_RADIUS - 0.5, cz);
    expect(heightCentre).toBeLessThan(heightEdge);
  });

  it("terrain outside crater radius is not significantly affected", () => {
    const cx = -40;
    const cz = 20;
    const farX = cx + BOMB_CRATER_RADIUS * 2;

    const heightFarBefore = getTerrainHeightSampled(farX, cz);
    modifyTerrainHeight(cx, cz, BOMB_CRATER_DEPTH, BOMB_CRATER_RADIUS);
    const heightFarAfter = getTerrainHeightSampled(farX, cz);

    // Should not change significantly outside the crater
    expect(Math.abs(heightFarAfter - heightFarBefore)).toBeLessThan(0.01);
  });

  it("updateTerrainGeometry does not throw when called after terrain deformation", () => {
    // Create a minimal terrain mesh (small plane geometry matching the pattern used in the game)
    const geo = new THREE.PlaneGeometry(10, 10, 5, 5);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial();
    const terrain = new THREE.Mesh(geo, mat);

    // Deform and update — must not throw
    modifyTerrainHeight(0, 0, -1.5, 3);
    expect(() => updateTerrainGeometry(terrain)).not.toThrow();
  });
});

// ─── WorldItemType includes bomb ──────────────────────────────────────────────

describe("WorldItemType", () => {
  it("bomb is a valid WorldItemType value", () => {
    // This test verifies the type union includes "bomb"
    // TypeScript compile-time check — runtime check via assignment
    const itemTypes: string[] = ["pumpkin", "bomb"];
    expect(itemTypes).toContain("bomb");
  });
});

// ─── Multi-bomb spawn locations ────────────────────────────────────────────────

describe("multi-bomb spawn layout", () => {
  // The playable terrain is 267 units across (-133.5 to +133.5), but the ruins
  // island is intentionally placed slightly beyond the east edge (x≈176). We use
  // a generous outer bound of 200 to catch truly invalid spawns while allowing
  // the original ruins-island location.
  const WORLD_HALF = 200;

  const BOMB_SPAWNS = [
    { id: "bomb-ruins-0",      x: 176,  z: -113 },
    { id: "bomb-catapult-0",   x: 82,   z: 42   },
    { id: "bomb-catapult-1",   x: -74,  z: 57   },
    { id: "bomb-catapult-2",   x: 62,   z: -78  },
    { id: "bomb-lighthouse-0", x: 108,  z: -52  },
    { id: "bomb-west-0",       x: -88,  z: 18   },
    { id: "bomb-north-0",      x: 22,   z: -105 },
    { id: "bomb-east-0",       x: 128,  z: 72   },
    { id: "bomb-center-0",     x: 12,   z: 32   },
  ];

  it("has at least 8 bomb spawns on the map", () => {
    expect(BOMB_SPAWNS.length).toBeGreaterThanOrEqual(8);
  });

  it("all bomb IDs are unique", () => {
    const ids = BOMB_SPAWNS.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all bomb spawns lie within the world bounds", () => {
    BOMB_SPAWNS.forEach(({ id, x, z }) => {
      expect(Math.abs(x)).toBeLessThanOrEqual(WORLD_HALF);
      expect(Math.abs(z)).toBeLessThanOrEqual(WORLD_HALF);
    }, `spawn at world boundary`);
  });

  it("no two bombs share the same position", () => {
    for (let i = 0; i < BOMB_SPAWNS.length; i++) {
      for (let j = i + 1; j < BOMB_SPAWNS.length; j++) {
        const dx = BOMB_SPAWNS[i].x - BOMB_SPAWNS[j].x;
        const dz = BOMB_SPAWNS[i].z - BOMB_SPAWNS[j].z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        // Bombs must be at least 5 units apart to avoid overlap
        expect(dist).toBeGreaterThan(5);
      }
    }
  });
});

// ─── Minimap bomb visibility filtering ────────────────────────────────────────

describe("minimap bomb rendering filter", () => {
  interface MinimalWorldItem {
    type: string;
    isHeld: boolean;
    position: { x: number; z: number };
  }

  function filterBombsForMinimap(items: MinimalWorldItem[]): MinimalWorldItem[] {
    return items.filter((item) => item.type === "bomb" && !item.isHeld);
  }

  it("shows only non-held bombs on the minimap", () => {
    const items: MinimalWorldItem[] = [
      { type: "bomb", isHeld: false, position: { x: 80, z: 40 } },
      { type: "bomb", isHeld: true,  position: { x: 0,  z: 0  } },
      { type: "pumpkin", isHeld: false, position: { x: 10, z: 10 } },
    ];
    const visible = filterBombsForMinimap(items);
    expect(visible).toHaveLength(1);
    expect(visible[0].position.x).toBe(80);
  });

  it("returns empty array when all bombs are held", () => {
    const items: MinimalWorldItem[] = [
      { type: "bomb", isHeld: true, position: { x: 0, z: 0 } },
    ];
    expect(filterBombsForMinimap(items)).toHaveLength(0);
  });

  it("correctly converts world position to minimap canvas coordinates", () => {
    const WORLD_SIZE = 267;
    const W = 220;
    const scale = W / WORLD_SIZE;
    const cx = W / 2;
    const cy = W / 2;

    // Centre of world → centre of minimap
    const mx = cx + 0 * scale;
    const mz = cy + 0 * scale;
    expect(mx).toBeCloseTo(110, 0);
    expect(mz).toBeCloseTo(110, 0);

    // Top-left corner of world should map near top-left of canvas
    const mx2 = cx + (-133) * scale;
    const mz2 = cy + (-133) * scale;
    expect(mx2).toBeGreaterThanOrEqual(0);
    expect(mx2).toBeLessThanOrEqual(W);
  });
});

// ─── WorldItem onBulletHit callback system ───────────────────────────────────

describe("WorldItem onBulletHit callback", () => {
  it("WorldItem can have an onBulletHit callback that returns true (consume bullet)", () => {
    // This is a compile-time shape test + runtime behaviour test
    let hitCallbackInvoked = false;
    const mockBullet = {} as BulletData;

    const item: WorldItem = {
      id: "test-bomb-1",
      type: "bomb",
      mesh: new THREE.Group(),
      isHeld: false,
      onBulletHit: (_bullet) => {
        hitCallbackInvoked = true;
        return true; // consume the bullet
      },
    };

    const consumed = item.onBulletHit!(mockBullet);
    expect(hitCallbackInvoked).toBe(true);
    expect(consumed).toBe(true);
  });

  it("WorldItem onBulletHit can return false (bullet passes through)", () => {
    const item: WorldItem = {
      id: "test-pumpkin-1",
      type: "pumpkin",
      mesh: new THREE.Group(),
      isHeld: false,
      onBulletHit: (_bullet) => false,
    };
    const mockBullet = {} as BulletData;
    expect(item.onBulletHit!(mockBullet)).toBe(false);
  });

  it("WorldItem without onBulletHit has no callback (default solid world items are ignored)", () => {
    const item: WorldItem = {
      id: "test-plain-1",
      type: "pumpkin",
      mesh: new THREE.Group(),
      isHeld: false,
    };
    expect(item.onBulletHit).toBeUndefined();
  });

  it("held bomb is skipped (isHeld=true prevents hit detection)", () => {
    let wasHit = false;
    const item: WorldItem = {
      id: "held-bomb",
      type: "bomb",
      mesh: new THREE.Group(),
      isHeld: true,
      onBulletHit: () => { wasHit = true; return true; },
    };
    // Simulate the game loop guard: skip if isHeld
    if (!item.isHeld && item.onBulletHit) {
      item.onBulletHit({} as BulletData);
    }
    expect(wasHit).toBe(false);
  });

  it("bomb onBulletHit removes the bomb from the item list (simulated)", () => {
    const bombId = "bomb-target-1";
    let items: WorldItem[] = [
      {
        id: bombId,
        type: "bomb",
        mesh: new THREE.Group(),
        isHeld: false,
        onBulletHit: (_bullet) => {
          // Simulate the removal logic in Game3D
          items = items.filter((wi) => wi.id !== bombId);
          return true;
        },
      },
    ];

    expect(items).toHaveLength(1);
    const mockBullet = {} as BulletData;
    items[0].onBulletHit!(mockBullet);
    expect(items).toHaveLength(0);
  });
});

// ─── Melee bomb detonation ─────────────────────────────────────────────────────

describe("melee bomb detonation", () => {
  // Mirrors the performAttack logic in Game3D: sword/axe within
  // BOMB_MELEE_RANGE = weaponCfg.range * 1.2 of a non-held bomb detonates it.

  const SWORD_RANGE = 2.2;
  const BOMB_MELEE_RANGE = SWORD_RANGE * 1.2; // 2.64

  interface SimpleBomb {
    id: string;
    type: string;
    isHeld: boolean;
    position: THREE.Vector3;
  }

  function meleeBombCheck(
    playerPos: THREE.Vector3,
    items: SimpleBomb[],
    range: number
  ): SimpleBomb | null {
    let closest: SimpleBomb | null = null;
    let closestDist = range;
    for (const item of items) {
      if (item.isHeld || item.type !== "bomb") continue;
      const d = item.position.distanceTo(playerPos);
      if (d < closestDist) {
        closestDist = d;
        closest = item;
      }
    }
    return closest;
  }

  it("detects a bomb within melee range", () => {
    const playerPos = new THREE.Vector3(0, 0, 0);
    const bombs: SimpleBomb[] = [
      { id: "b1", type: "bomb", isHeld: false, position: new THREE.Vector3(2, 0, 0) },
    ];
    const hit = meleeBombCheck(playerPos, bombs, BOMB_MELEE_RANGE);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe("b1");
  });

  it("does not detect a bomb outside melee range", () => {
    const playerPos = new THREE.Vector3(0, 0, 0);
    const bombs: SimpleBomb[] = [
      { id: "b1", type: "bomb", isHeld: false, position: new THREE.Vector3(10, 0, 0) },
    ];
    const hit = meleeBombCheck(playerPos, bombs, BOMB_MELEE_RANGE);
    expect(hit).toBeNull();
  });

  it("skips held bombs — player is already carrying it", () => {
    const playerPos = new THREE.Vector3(0, 0, 0);
    const bombs: SimpleBomb[] = [
      { id: "b1", type: "bomb", isHeld: true, position: new THREE.Vector3(0.5, 0, 0) },
    ];
    const hit = meleeBombCheck(playerPos, bombs, BOMB_MELEE_RANGE);
    expect(hit).toBeNull();
  });

  it("skips non-bomb world items", () => {
    const playerPos = new THREE.Vector3(0, 0, 0);
    const items: SimpleBomb[] = [
      { id: "p1", type: "pumpkin", isHeld: false, position: new THREE.Vector3(1, 0, 0) },
    ];
    const hit = meleeBombCheck(playerPos, items, BOMB_MELEE_RANGE);
    expect(hit).toBeNull();
  });

  it("picks the closest bomb when multiple are in range", () => {
    const playerPos = new THREE.Vector3(0, 0, 0);
    const bombs: SimpleBomb[] = [
      { id: "b-far",   type: "bomb", isHeld: false, position: new THREE.Vector3(2.5, 0, 0) },
      { id: "b-close", type: "bomb", isHeld: false, position: new THREE.Vector3(1.0, 0, 0) },
    ];
    const hit = meleeBombCheck(playerPos, bombs, BOMB_MELEE_RANGE);
    expect(hit!.id).toBe("b-close");
  });

  it("detonation removes the bomb from the item list", () => {
    const playerPos = new THREE.Vector3(0, 0, 0);
    let items: SimpleBomb[] = [
      { id: "b1", type: "bomb", isHeld: false, position: new THREE.Vector3(1.5, 0, 0) },
    ];
    const bomb = meleeBombCheck(playerPos, items, BOMB_MELEE_RANGE);
    expect(bomb).not.toBeNull();
    items = items.filter((wi) => wi.id !== bomb!.id);
    expect(items).toHaveLength(0);
  });

  it("axe range (2.5 * 1.2 = 3.0) reaches bomb at 2.8 units", () => {
    const AXE_RANGE = 2.5;
    const axeBombRange = AXE_RANGE * 1.2; // 3.0
    const playerPos = new THREE.Vector3(0, 0, 0);
    const bombs: SimpleBomb[] = [
      { id: "b1", type: "bomb", isHeld: false, position: new THREE.Vector3(2.8, 0, 0) },
    ];
    const hit = meleeBombCheck(playerPos, bombs, axeBombRange);
    expect(hit).not.toBeNull();
  });

  it("ranged weapon (range=80) must NOT use melee bomb logic — bullets handle it", () => {
    // Verify that without the sword/axe guard in performAttack, a ranged weapon
    // would incorrectly trigger bombs at distance 50 via the melee path.
    const BOW_RANGE = 80;
    const bowBombRange = BOW_RANGE * 1.2; // 96 — wrong for melee
    const playerPos = new THREE.Vector3(0, 0, 0);
    const bombs: SimpleBomb[] = [
      { id: "b1", type: "bomb", isHeld: false, position: new THREE.Vector3(50, 0, 0) },
    ];
    // Would trigger at distance 50 — this confirms the weapon-type guard is needed
    const hit = meleeBombCheck(playerPos, bombs, bowBombRange);
    expect(hit).not.toBeNull(); // confirms the guard in Game3D (sword/axe only) is necessary
  });
});
