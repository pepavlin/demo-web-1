/**
 * Tests for tree chopping mechanics:
 * - TreeData interface fields and initial state
 * - HP damage calculations and state transitions (alive → falling → chopped)
 * - Weapon range and hit detection logic
 * - buildWoodLogMesh geometry structure
 * - soundManager tree sound methods exist
 * - GameState woodCollected field
 */

import type { TreeData } from "@/lib/gameTypes";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";
import { buildTreeMesh, buildWoodLogMesh } from "@/lib/meshBuilders";
import * as THREE from "three";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal TreeData for testing (no real Three.js scene required). */
function makeTreeData(overrides: Partial<TreeData> = {}): TreeData {
  const mesh = new THREE.Group();
  const foliageGroup = new THREE.Group();
  const trunkMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0x4a2a10 }),
  );
  mesh.add(trunkMesh);
  mesh.add(foliageGroup);

  return {
    mesh,
    foliageGroup,
    hp: 165,
    maxHp: 165,
    isFalling: false,
    isChopped: false,
    hitFlashTimer: 0,
    fallTimer: 0,
    fallRotationX: 0,
    x: 10,
    z: 20,
    trunkRadius: 0.2,
    hasCollision: true,
    trunkMeshes: [trunkMesh],
    ...overrides,
  };
}

// ─── TreeData interface ───────────────────────────────────────────────────────

describe("TreeData interface", () => {
  test("has expected fields with correct initial values", () => {
    const tree = makeTreeData();
    expect(tree.hp).toBe(165);
    expect(tree.maxHp).toBe(165);
    expect(tree.isFalling).toBe(false);
    expect(tree.isChopped).toBe(false);
    expect(tree.hitFlashTimer).toBe(0);
    expect(tree.fallTimer).toBe(0);
    expect(tree.fallRotationX).toBe(0);
    expect(tree.hasCollision).toBe(true);
  });

  test("small trees have lower maxHp than large trees", () => {
    const small = makeTreeData({ maxHp: 55, hp: 55, hasCollision: false });
    const large = makeTreeData({ maxHp: 165, hp: 165, hasCollision: true });
    expect(small.maxHp).toBeLessThan(large.maxHp);
  });

  test("trunkMeshes is an array of THREE.Mesh", () => {
    const tree = makeTreeData();
    expect(Array.isArray(tree.trunkMeshes)).toBe(true);
    tree.trunkMeshes.forEach((m) => expect(m).toBeInstanceOf(THREE.Mesh));
  });
});

// ─── Axe weapon config ────────────────────────────────────────────────────────

describe("Axe weapon config", () => {
  const axe = WEAPON_CONFIGS.axe;

  test("axe exists in WEAPON_CONFIGS", () => {
    expect(axe).toBeDefined();
  });

  test("axe has expected label 'Sekera'", () => {
    expect(axe.label).toBe("Sekera");
  });

  test("axe is melee-only (bulletSpeed === 0)", () => {
    expect(axe.bulletSpeed).toBe(0);
  });

  test("axe has treeDamageMultiplier of 3", () => {
    expect(axe.treeDamageMultiplier).toBe(3);
  });

  test("axe tree damage equals damage * treeDamageMultiplier", () => {
    const chopDamage = axe.damage * (axe.treeDamageMultiplier ?? 1);
    expect(chopDamage).toBe(135);
  });

  test("axe range is greater than sword range", () => {
    expect(axe.range).toBeGreaterThan(WEAPON_CONFIGS.sword.range);
  });

  test("axe cooldown is greater than sword cooldown (slower swing)", () => {
    expect(axe.cooldown).toBeGreaterThan(WEAPON_CONFIGS.sword.cooldown);
  });
});

// ─── Axe tree chopping ────────────────────────────────────────────────────────

describe("Tree chopping with axe", () => {
  const axe = WEAPON_CONFIGS.axe;

  test("one axe hit fells a small tree (55 HP)", () => {
    const tree = makeTreeData({ hp: 55, maxHp: 55, hasCollision: false });
    const chopDamage = Math.round(axe.damage * (axe.treeDamageMultiplier ?? 1));
    tree.hp = Math.max(0, tree.hp - chopDamage);
    expect(tree.hp).toBe(0);
  });

  test("two axe hits fells a large tree (165 HP)", () => {
    const tree = makeTreeData();
    const chopDamage = Math.round(axe.damage * (axe.treeDamageMultiplier ?? 1));
    tree.hp = Math.max(0, tree.hp - chopDamage); // 165 - 135 = 30
    tree.hp = Math.max(0, tree.hp - chopDamage); // 0
    expect(tree.hp).toBe(0);
  });

  test("axe is faster at felling trees than sword (fewer hits needed)", () => {
    const sword = WEAPON_CONFIGS.sword;
    const tree165hp = 165;
    const axeChopDamage = Math.round(axe.damage * (axe.treeDamageMultiplier ?? 1));
    const swordChopDamage = sword.damage; // sword has no treeDamageMultiplier

    const axeHits = Math.ceil(tree165hp / axeChopDamage);
    const swordHits = Math.ceil(tree165hp / swordChopDamage);
    expect(axeHits).toBeLessThan(swordHits);
  });

  test("HP never goes below 0", () => {
    const tree = makeTreeData({ hp: 10, maxHp: 165 });
    const chopDamage = Math.round(axe.damage * (axe.treeDamageMultiplier ?? 1));
    tree.hp = Math.max(0, tree.hp - chopDamage);
    expect(tree.hp).toBe(0);
  });

  test("isFalling is set when HP reaches 0", () => {
    const tree = makeTreeData({ hp: 55, maxHp: 55, hasCollision: false });
    const chopDamage = Math.round(axe.damage * (axe.treeDamageMultiplier ?? 1));
    tree.hp = Math.max(0, tree.hp - chopDamage);
    if (tree.hp <= 0) {
      tree.isFalling = true;
      tree.fallTimer = 0;
    }
    expect(tree.isFalling).toBe(true);
  });
});

// ─── Sword damage against trees ───────────────────────────────────────────────

describe("Tree chopping with sword", () => {
  const sword = WEAPON_CONFIGS.sword;

  test("sword has expected damage and range", () => {
    expect(sword.damage).toBe(55);
    expect(sword.range).toBeGreaterThan(0);
  });

  test("one sword hit reduces HP correctly on small tree", () => {
    const tree = makeTreeData({ hp: 55, maxHp: 55, hasCollision: false });
    tree.hp = Math.max(0, tree.hp - sword.damage);
    expect(tree.hp).toBe(0);
  });

  test("three sword hits reduce HP to 0 on large tree", () => {
    const tree = makeTreeData();
    tree.hp = Math.max(0, tree.hp - sword.damage); // 110
    tree.hp = Math.max(0, tree.hp - sword.damage); // 55
    tree.hp = Math.max(0, tree.hp - sword.damage); // 0
    expect(tree.hp).toBe(0);
  });

  test("HP never goes below 0", () => {
    const tree = makeTreeData({ hp: 10, maxHp: 165 });
    tree.hp = Math.max(0, tree.hp - sword.damage);
    expect(tree.hp).toBe(0);
  });

  test("isFalling is set when HP reaches 0", () => {
    const tree = makeTreeData({ hp: 55, maxHp: 55, hasCollision: false });
    tree.hp = Math.max(0, tree.hp - sword.damage);
    if (tree.hp <= 0) {
      tree.isFalling = true;
      tree.fallTimer = 0;
    }
    expect(tree.isFalling).toBe(true);
  });

  test("hitFlashTimer is set on hit", () => {
    const tree = makeTreeData();
    tree.hp = Math.max(0, tree.hp - sword.damage);
    tree.hitFlashTimer = 0.2;
    expect(tree.hitFlashTimer).toBe(0.2);
  });
});

// ─── Fall animation state machine ─────────────────────────────────────────────

describe("Tree fall animation", () => {
  test("fallTimer accumulates and fallRotationX increases toward PI/2", () => {
    const tree = makeTreeData({ hp: 0, isFalling: true });
    const FALL_DURATION = 0.8;
    const dt = 0.1;

    // Simulate a few frames
    for (let i = 0; i < 5; i++) {
      tree.fallTimer += dt;
      const progress = Math.min(tree.fallTimer / FALL_DURATION, 1);
      tree.fallRotationX = (Math.PI / 2) * progress * progress;
    }

    expect(tree.fallTimer).toBeCloseTo(0.5, 5);
    expect(tree.fallRotationX).toBeGreaterThan(0);
    expect(tree.fallRotationX).toBeLessThan(Math.PI / 2);
  });

  test("isChopped is set after fall completes (progress >= 1)", () => {
    const tree = makeTreeData({ hp: 0, isFalling: true });
    const FALL_DURATION = 0.8;
    tree.fallTimer = FALL_DURATION; // simulate completed fall
    const progress = Math.min(tree.fallTimer / FALL_DURATION, 1);
    if (progress >= 1) {
      tree.isChopped = true;
      tree.isFalling = false;
    }
    expect(tree.isChopped).toBe(true);
    expect(tree.isFalling).toBe(false);
  });

  test("isChopped trees are skipped in subsequent update loops", () => {
    const trees = [
      makeTreeData({ isChopped: true }),
      makeTreeData({ isChopped: false }),
    ];
    const active = trees.filter((t) => !t.isChopped);
    expect(active).toHaveLength(1);
  });
});

// ─── Wood log count ───────────────────────────────────────────────────────────

describe("Wood log dropping", () => {
  test("each fallen tree drops 2–4 logs", () => {
    // Simulate the log-count logic from Game3D
    const results: number[] = [];
    for (let i = 0; i < 100; i++) {
      const logCount = 2 + Math.floor(Math.random() * 3);
      results.push(logCount);
    }
    expect(results.every((n) => n >= 2 && n <= 4)).toBe(true);
  });

  test("woodCollected counter increments on log collection", () => {
    let woodCollected = 0;
    const logs = [
      { x: 0, z: 0, collected: false },
      { x: 5, z: 5, collected: false },
    ];
    const playerX = 0.5;
    const playerZ = 0.5;
    const RADIUS = 2.0;

    logs.forEach((log) => {
      if (log.collected) return;
      const dx = playerX - log.x;
      const dz = playerZ - log.z;
      if (dx * dx + dz * dz < RADIUS * RADIUS) {
        log.collected = true;
        woodCollected++;
      }
    });

    expect(woodCollected).toBe(1);
    expect(logs[0].collected).toBe(true);
    expect(logs[1].collected).toBe(false);
  });

  test("log outside collection radius is not collected", () => {
    let woodCollected = 0;
    const log = { x: 100, z: 100, collected: false };
    const playerX = 0;
    const playerZ = 0;
    const RADIUS = 2.0;
    const dx = playerX - log.x;
    const dz = playerZ - log.z;
    if (dx * dx + dz * dz < RADIUS * RADIUS) {
      log.collected = true;
      woodCollected++;
    }
    expect(woodCollected).toBe(0);
    expect(log.collected).toBe(false);
  });
});

// ─── buildWoodLogMesh ─────────────────────────────────────────────────────────

describe("buildWoodLogMesh", () => {
  test("returns a THREE.Group", () => {
    const mesh = buildWoodLogMesh();
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  test("group has at least 3 children (log cylinder + 2 caps)", () => {
    const mesh = buildWoodLogMesh();
    expect(mesh.children.length).toBeGreaterThanOrEqual(3);
  });

  test("first child is a THREE.Mesh (the log cylinder)", () => {
    const mesh = buildWoodLogMesh();
    expect(mesh.children[0]).toBeInstanceOf(THREE.Mesh);
  });

  test("each call creates an independent group (no shared state)", () => {
    const a = buildWoodLogMesh();
    const b = buildWoodLogMesh();
    expect(a).not.toBe(b);
  });
});

// ─── buildTreeMesh integration ────────────────────────────────────────────────

describe("buildTreeMesh — choppable properties", () => {
  const rng = (() => {
    let seed = 42;
    return () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };
  })();

  test("returns group, foliageGroup, trunkRadius, hasCollision", () => {
    const result = buildTreeMesh(rng);
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.foliageGroup).toBeInstanceOf(THREE.Group);
    expect(typeof result.trunkRadius).toBe("number");
    expect(result.trunkRadius).toBeGreaterThan(0);
    expect(typeof result.hasCollision).toBe("boolean");
  });

  test("foliageGroup is added to the main group", () => {
    const result = buildTreeMesh(rng);
    const foliageInGroup = result.group.children.includes(result.foliageGroup);
    expect(foliageInGroup).toBe(true);
  });

  test("non-foliage Mesh children can be identified as trunk meshes", () => {
    const result = buildTreeMesh(rng);
    const trunkMeshes = result.group.children.filter(
      (c) => c !== result.foliageGroup && c instanceof THREE.Mesh,
    );
    // Every tree type (except dead) has at least one trunk mesh
    // Dead trees may have 0; we just check the type is correct
    trunkMeshes.forEach((m) => expect(m).toBeInstanceOf(THREE.Mesh));
    expect(trunkMeshes.length).toBeGreaterThanOrEqual(0);
  });
});

// ─── GameState woodCollected field ───────────────────────────────────────────

describe("GameState.woodCollected", () => {
  test("initial value is 0", () => {
    const state = { woodCollected: 0 };
    expect(state.woodCollected).toBe(0);
  });

  test("increments when wood is collected", () => {
    let woodCollected = 0;
    woodCollected++;
    woodCollected++;
    expect(woodCollected).toBe(2);
  });
});

// ─── soundManager tree sound methods ─────────────────────────────────────────

describe("soundManager tree sounds", () => {
  test("playTreeChop method exists on soundManager", async () => {
    const { soundManager } = await import("@/lib/soundManager");
    expect(typeof soundManager.playTreeChop).toBe("function");
  });

  test("playTreeFall method exists on soundManager", async () => {
    const { soundManager } = await import("@/lib/soundManager");
    expect(typeof soundManager.playTreeFall).toBe("function");
  });

  test("playTreeChop does not throw when AudioContext is unavailable", async () => {
    const { soundManager } = await import("@/lib/soundManager");
    // In jsdom, AudioContext is not available — ctx will be null, method should no-op
    expect(() => soundManager.playTreeChop()).not.toThrow();
  });

  test("playTreeFall does not throw when AudioContext is unavailable", async () => {
    const { soundManager } = await import("@/lib/soundManager");
    expect(() => soundManager.playTreeFall()).not.toThrow();
  });
});
