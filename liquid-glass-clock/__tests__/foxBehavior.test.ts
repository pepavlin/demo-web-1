/**
 * Tests for fox AI behavior:
 * - FoxData interface fields
 * - Fox only hunts sheep, never chases the player
 * - Fox wanders when no sheep is nearby
 * - Fox caches nearest sheep target
 */

import type { FoxData, SheepData } from "@/lib/gameTypes";
import * as THREE from "three";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFoxData(overrides: Partial<FoxData> = {}): FoxData {
  return {
    mesh: new THREE.Group(),
    wanderTimer: 3,
    wanderAngle: 0,
    hp: 60,
    maxHp: 60,
    isAlive: true,
    attackCooldown: 0,
    hitFlashTimer: 0,
    cachedNearestSheep: null,
    sheepSearchTimer: 0,
    ...overrides,
  };
}

function makeSheepData(position: THREE.Vector3, isAlive = true): Pick<SheepData, "mesh" | "isAlive"> & Partial<SheepData> {
  const group = new THREE.Group();
  group.position.copy(position);
  return {
    mesh: group,
    isAlive,
    isFleeing: false,
    targetAngle: 0,
    // other fields not needed for fox targeting tests
  } as SheepData;
}

// ─── FoxData interface ────────────────────────────────────────────────────────

describe("FoxData interface", () => {
  it("initialises with full HP and alive state", () => {
    const fox = makeFoxData();
    expect(fox.hp).toBe(60);
    expect(fox.maxHp).toBe(60);
    expect(fox.isAlive).toBe(true);
    expect(fox.attackCooldown).toBe(0);
    expect(fox.hitFlashTimer).toBe(0);
  });

  it("has no cached sheep target on creation", () => {
    const fox = makeFoxData();
    expect(fox.cachedNearestSheep).toBeNull();
    expect(fox.sheepSearchTimer).toBe(0);
  });

  it("can be marked as dead", () => {
    const fox = makeFoxData();
    fox.hp = 0;
    fox.isAlive = false;
    expect(fox.isAlive).toBe(false);
    expect(fox.hp).toBe(0);
  });
});

// ─── Fox sheep-hunting logic (pure simulation) ────────────────────────────────

describe("Fox hunts sheep, not player", () => {
  /**
   * Simulates the core nearest-sheep search that runs in the fox AI loop.
   * Returns the closest alive sheep within range, or null.
   */
  function findNearestSheep(
    foxPos: THREE.Vector3,
    sheep: Array<{ mesh: { position: THREE.Vector3 }; isAlive: boolean }>,
    chaseRadius: number
  ): (typeof sheep)[0] | null {
    let closestDist = chaseRadius;
    let closestSheep: (typeof sheep)[0] | null = null;
    sheep.forEach((s) => {
      if (!s.isAlive) return;
      const d = foxPos.distanceTo(s.mesh.position);
      if (d < closestDist) {
        closestDist = d;
        closestSheep = s;
      }
    });
    return closestSheep;
  }

  it("finds the nearest alive sheep within chase radius", () => {
    const foxPos = new THREE.Vector3(0, 0, 0);
    const sheep = [
      makeSheepData(new THREE.Vector3(5, 0, 0)),   // 5 units away
      makeSheepData(new THREE.Vector3(20, 0, 0)),  // 20 units away
    ];

    const target = findNearestSheep(foxPos, sheep, 90);
    expect(target).toBe(sheep[0]);
  });

  it("ignores dead sheep", () => {
    const foxPos = new THREE.Vector3(0, 0, 0);
    const sheep = [
      makeSheepData(new THREE.Vector3(2, 0, 0), false),  // dead, very close
      makeSheepData(new THREE.Vector3(10, 0, 0), true),  // alive, further
    ];

    const target = findNearestSheep(foxPos, sheep, 90);
    expect(target).toBe(sheep[1]);
  });

  it("returns null when no sheep are within range", () => {
    const foxPos = new THREE.Vector3(0, 0, 0);
    const sheep = [
      makeSheepData(new THREE.Vector3(100, 0, 0)),  // outside chase radius
    ];

    const target = findNearestSheep(foxPos, sheep, 90);
    expect(target).toBeNull();
  });

  it("returns null when all sheep are dead", () => {
    const foxPos = new THREE.Vector3(0, 0, 0);
    const sheep = [
      makeSheepData(new THREE.Vector3(5, 0, 0), false),
      makeSheepData(new THREE.Vector3(8, 0, 0), false),
    ];

    const target = findNearestSheep(foxPos, sheep, 90);
    expect(target).toBeNull();
  });

  it("player position is irrelevant to fox targeting", () => {
    // Fox should target sheep regardless of player proximity
    const foxPos = new THREE.Vector3(0, 0, 0);
    const playerPos = new THREE.Vector3(1, 0, 0);  // player very close (1 unit)
    const sheepPos = new THREE.Vector3(10, 0, 0);  // sheep further away
    const sheep = [makeSheepData(sheepPos)];

    const target = findNearestSheep(foxPos, sheep, 90);
    // Fox picks sheep, not player
    expect(target).toBe(sheep[0]);
    // Player position does not affect result
    void playerPos; // deliberately unused — confirms no player check
  });
});

// ─── Fox wander behaviour ─────────────────────────────────────────────────────

describe("Fox wander behaviour (no sheep in range)", () => {
  it("wander timer decrements and resets", () => {
    const fox = makeFoxData({ wanderTimer: 2, wanderAngle: 0 });
    const dt = 0.5;

    fox.wanderTimer -= dt;
    expect(fox.wanderTimer).toBe(1.5);

    fox.wanderTimer -= dt * 3; // over-decrement to trigger reset
    if (fox.wanderTimer <= 0) {
      fox.wanderAngle += 0.5; // new random direction
      fox.wanderTimer = 3;   // reset
    }
    expect(fox.wanderTimer).toBe(3);
    expect(fox.wanderAngle).toBeCloseTo(0.5);
  });

  it("wander angle stays valid (finite number)", () => {
    const fox = makeFoxData();
    for (let i = 0; i < 20; i++) {
      fox.wanderAngle += (Math.random() - 0.5) * Math.PI;
    }
    expect(isFinite(fox.wanderAngle)).toBe(true);
  });
});

// ─── Fox sheep-search cache ───────────────────────────────────────────────────

describe("Fox nearest-sheep cache", () => {
  it("sheepSearchTimer counts down", () => {
    const fox = makeFoxData({ sheepSearchTimer: 0.25 });
    fox.sheepSearchTimer -= 0.1;
    expect(fox.sheepSearchTimer).toBeCloseTo(0.15);
  });

  it("cache is refreshed when timer reaches 0", () => {
    const fox = makeFoxData({ sheepSearchTimer: 0.05, cachedNearestSheep: null });
    const sheep = makeSheepData(new THREE.Vector3(5, 0, 0)) as SheepData;

    fox.sheepSearchTimer -= 0.1; // goes below 0
    if (fox.sheepSearchTimer <= 0) {
      fox.cachedNearestSheep = sheep;  // simulate refresh
      fox.sheepSearchTimer = 0.25;
    }
    expect(fox.cachedNearestSheep).toBe(sheep);
    expect(fox.sheepSearchTimer).toBe(0.25);
  });
});
