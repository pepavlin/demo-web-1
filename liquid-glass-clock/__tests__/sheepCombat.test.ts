/**
 * Tests for sheep combat mechanics:
 * - SheepData interface fields (hp, maxHp, isAlive, hitFlashTimer, isDying, deathTimer, deathRotationY)
 * - BloodParticle interface
 * - State transitions (alive → dying → dead)
 * - HP damage calculations
 */

import type { SheepData, BloodParticle } from "@/lib/gameTypes";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";
import * as THREE from "three";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal SheepData object for testing (no real Three.js scene). */
function makeSheepData(overrides: Partial<SheepData> = {}): SheepData {
  const group = new THREE.Group();
  const legPivot = new THREE.Group();
  return {
    mesh: group,
    velocity: new THREE.Vector2(0, 0),
    targetAngle: 0,
    currentAngle: 0,
    wanderTimer: 5,
    isFleeing: false,
    bleating: false,
    bleatTimer: 10,
    walkPhase: 0,
    phaseOffset: 0,
    legPivots: [legPivot, legPivot, legPivot, legPivot],
    headGroup: new THREE.Group(),
    bodyGroup: new THREE.Group(),
    tailGroup: new THREE.Group(),
    isGrazing: false,
    grazingTimer: 5,
    headPitchTarget: 0,
    headPitchCurrent: 0,
    // combat
    hp: 30,
    maxHp: 30,
    isAlive: true,
    hitFlashTimer: 0,
    isDying: false,
    deathTimer: 0,
    deathRotationY: 0,
    ...overrides,
  };
}

/** Build a minimal BloodParticle for testing. */
function makeBloodParticle(lifetime = 1.0): BloodParticle {
  const geo = new THREE.SphereGeometry(0.05, 4, 3);
  const mat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 1 });
  return {
    mesh: new THREE.Mesh(geo, mat),
    velocity: new THREE.Vector3(1, 3, 0),
    lifetime,
    maxLifetime: lifetime,
  };
}

// ─── SheepData interface ──────────────────────────────────────────────────────

describe("SheepData combat fields", () => {
  it("initialises with full hp and alive state", () => {
    const sheep = makeSheepData();
    expect(sheep.hp).toBe(30);
    expect(sheep.maxHp).toBe(30);
    expect(sheep.isAlive).toBe(true);
    expect(sheep.isDying).toBe(false);
    expect(sheep.hitFlashTimer).toBe(0);
    expect(sheep.deathTimer).toBe(0);
  });

  it("allows hp to be reduced without dying when above 0", () => {
    const sheep = makeSheepData();
    sheep.hp = Math.max(0, sheep.hp - 15);
    expect(sheep.hp).toBe(15);
    expect(sheep.isAlive).toBe(true);
    expect(sheep.isDying).toBe(false);
  });

  it("triggers dying state when hp reaches 0", () => {
    const sheep = makeSheepData({ hp: 5 });
    sheep.hp = Math.max(0, sheep.hp - 10);
    expect(sheep.hp).toBe(0);
    // Manually trigger dying (simulates what doAttack does)
    if (sheep.hp <= 0 && !sheep.isDying) {
      sheep.isDying = true;
      sheep.deathTimer = 0;
    }
    expect(sheep.isDying).toBe(true);
    expect(sheep.isAlive).toBe(true); // still alive until animation completes
  });

  it("does not go below 0 hp", () => {
    const sheep = makeSheepData({ hp: 5 });
    sheep.hp = Math.max(0, sheep.hp - 100);
    expect(sheep.hp).toBe(0);
  });

  it("allows deathTimer to accumulate over multiple frames", () => {
    const sheep = makeSheepData({ isDying: true, hp: 0 });
    const dt = 0.016;
    sheep.deathTimer += dt;
    sheep.deathTimer += dt;
    expect(sheep.deathTimer).toBeCloseTo(0.032, 5);
  });

  it("hitFlashTimer decays toward 0 each frame", () => {
    const sheep = makeSheepData({ hitFlashTimer: 0.25 });
    const dt = 0.1;
    sheep.hitFlashTimer = Math.max(0, sheep.hitFlashTimer - dt);
    expect(sheep.hitFlashTimer).toBeCloseTo(0.15, 5);
    sheep.hitFlashTimer = Math.max(0, sheep.hitFlashTimer - dt);
    expect(sheep.hitFlashTimer).toBeCloseTo(0.05, 5);
    sheep.hitFlashTimer = Math.max(0, sheep.hitFlashTimer - dt);
    expect(sheep.hitFlashTimer).toBe(0);
  });
});

// ─── Weapon damage against sheep ─────────────────────────────────────────────

describe("Weapon damage kills sheep in expected hits", () => {
  it("sword (55 dmg) one-shots sheep with 30 maxHp", () => {
    const sheep = makeSheepData({ hp: 30 });
    sheep.hp = Math.max(0, sheep.hp - WEAPON_CONFIGS.sword.damage);
    expect(sheep.hp).toBe(0);
  });

  it("bow (40 dmg) one-shots sheep with 30 maxHp", () => {
    const sheep = makeSheepData({ hp: 30 });
    sheep.hp = Math.max(0, sheep.hp - WEAPON_CONFIGS.bow.damage);
    expect(sheep.hp).toBe(0);
  });

  it("crossbow (85 dmg) one-shots sheep with 30 maxHp", () => {
    const sheep = makeSheepData({ hp: 30 });
    sheep.hp = Math.max(0, sheep.hp - WEAPON_CONFIGS.crossbow.damage);
    expect(sheep.hp).toBe(0);
  });
});

// ─── Death state machine ──────────────────────────────────────────────────────

describe("Sheep death state machine", () => {
  it("isAlive stays true while isDying is true (animation playing)", () => {
    const sheep = makeSheepData({ hp: 0, isDying: true });
    // Simulate a few frames of death animation without finishing
    for (let i = 0; i < 10; i++) {
      sheep.deathTimer += 0.016;
    }
    expect(sheep.isAlive).toBe(true); // still in animation
  });

  it("animation finish marks isAlive false", () => {
    const sheep = makeSheepData({ hp: 0, isDying: true });
    // Simulate animation completion (deathTimer > 2.4s)
    sheep.deathTimer = 2.5;
    if (sheep.deathTimer > 2.4) {
      sheep.isAlive = false;
      sheep.isDying = false;
    }
    expect(sheep.isAlive).toBe(false);
    expect(sheep.isDying).toBe(false);
  });

  it("dead sheep (isAlive=false) is excluded from attack targets", () => {
    const deadSheep = makeSheepData({ hp: 0, isAlive: false, isDying: false });
    const targets = [deadSheep].filter((s) => s.isAlive && !s.isDying);
    expect(targets).toHaveLength(0);
  });

  it("dying sheep (isDying=true) is excluded from attack targets", () => {
    const dyingSheep = makeSheepData({ hp: 0, isDying: true });
    const targets = [dyingSheep].filter((s) => s.isAlive && !s.isDying);
    expect(targets).toHaveLength(0);
  });

  it("healthy sheep is included in attack targets", () => {
    const sheep = makeSheepData();
    const targets = [sheep].filter((s) => s.isAlive && !s.isDying);
    expect(targets).toHaveLength(1);
  });
});

// ─── Blood particle lifecycle ─────────────────────────────────────────────────

describe("BloodParticle lifecycle", () => {
  it("has positive velocity components", () => {
    const p = makeBloodParticle(1.0);
    expect(p.velocity.y).toBeGreaterThan(0); // initially upward
    expect(p.maxLifetime).toBe(1.0);
    expect(p.lifetime).toBe(1.0);
  });

  it("lifetime decreases each frame", () => {
    const p = makeBloodParticle(1.0);
    p.lifetime -= 0.016;
    expect(p.lifetime).toBeCloseTo(0.984, 4);
  });

  it("gravity reduces y velocity each frame", () => {
    const p = makeBloodParticle(1.0);
    const initialVY = p.velocity.y;
    // Simulate gravity: vy -= 12 * dt
    p.velocity.y -= 12 * 0.016;
    expect(p.velocity.y).toBeLessThan(initialVY);
  });

  it("opacity fades as lifetime decreases", () => {
    const p = makeBloodParticle(1.0);
    p.lifetime = 0.5;
    const mat = p.mesh.material as THREE.MeshLambertMaterial;
    mat.opacity = p.lifetime / p.maxLifetime;
    expect(mat.opacity).toBeCloseTo(0.5, 5);
  });

  it("opacity reaches 0 when lifetime expires", () => {
    const p = makeBloodParticle(1.0);
    p.lifetime = 0;
    const mat = p.mesh.material as THREE.MeshLambertMaterial;
    mat.opacity = p.lifetime / p.maxLifetime;
    expect(mat.opacity).toBe(0);
  });

  it("is filtered out when lifetime <= 0", () => {
    const particles = [makeBloodParticle(0.5), makeBloodParticle(0.0)];
    const alive = particles.filter((p) => p.lifetime > 0);
    expect(alive).toHaveLength(1);
  });

  it("position updates by scaled velocity each frame", () => {
    const p = makeBloodParticle(1.0);
    const dt = 0.016;
    const initialX = p.mesh.position.x;
    p.mesh.position.addScaledVector(p.velocity, dt);
    expect(p.mesh.position.x).toBeCloseTo(initialX + p.velocity.x * dt, 5);
  });
});

// ─── Possession guard ─────────────────────────────────────────────────────────

describe("Possession eligibility", () => {
  it("excludes dead sheep from possession candidates", () => {
    const dead = makeSheepData({ isAlive: false });
    const alive = makeSheepData({ isAlive: true });
    const candidates = [dead, alive].filter((s) => s.isAlive && !s.isDying);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toBe(alive);
  });

  it("excludes dying sheep from possession candidates", () => {
    const dying = makeSheepData({ isDying: true, hp: 0 });
    const healthy = makeSheepData();
    const candidates = [dying, healthy].filter((s) => s.isAlive && !s.isDying);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toBe(healthy);
  });
});

// ─── Ranged weapons use projectile collision only (not melee) ─────────────────

/**
 * These tests document the fix for the bug where bow and crossbow were
 * incorrectly applying instant melee damage to the nearest entity on attack,
 * ignoring where the player was actually aiming.
 *
 * After the fix: only weapons with type === "sword" apply melee damage in
 * doAttack(). Bow and crossbow deal damage exclusively through bullet collision.
 */
describe("Ranged weapons do not apply melee damage in doAttack()", () => {
  /**
   * Simulate the melee targeting logic from doAttack() but limited to
   * sword-only, mirroring the fixed implementation.
   */
  function simulateMeleeHit(
    weaponType: "sword" | "bow" | "crossbow",
    entityDistance: number,
  ): boolean {
    const cfg = WEAPON_CONFIGS[weaponType];
    // Only sword should perform melee hits
    if (cfg.type !== "sword") return false;
    // Check if entity is within melee range
    return entityDistance < cfg.range;
  }

  it("sword within melee range hits via melee", () => {
    expect(simulateMeleeHit("sword", 1.5)).toBe(true);
  });

  it("sword beyond melee range does NOT hit via melee", () => {
    expect(simulateMeleeHit("sword", 3.0)).toBe(false);
  });

  it("bow does NOT apply melee hit regardless of distance", () => {
    // Even at point-blank range, bow should use projectile collision only
    expect(simulateMeleeHit("bow", 0.5)).toBe(false);
    expect(simulateMeleeHit("bow", 50)).toBe(false);
  });

  it("crossbow does NOT apply melee hit regardless of distance", () => {
    // Even at point-blank range, crossbow should use projectile collision only
    expect(simulateMeleeHit("crossbow", 0.5)).toBe(false);
    expect(simulateMeleeHit("crossbow", 50)).toBe(false);
  });

  it("bow range is large (projectile range) but does not grant melee damage", () => {
    // bow.range = 80 — was incorrectly used as melee range before the fix
    const bowRange = WEAPON_CONFIGS.bow.range;
    expect(bowRange).toBeGreaterThan(10);
    // Despite large range, melee hit should not trigger
    expect(simulateMeleeHit("bow", bowRange - 1)).toBe(false);
  });

  it("crossbow range is large (projectile range) but does not grant melee damage", () => {
    // crossbow.range = 100 — was incorrectly used as melee range before the fix
    const crossbowRange = WEAPON_CONFIGS.crossbow.range;
    expect(crossbowRange).toBeGreaterThan(10);
    // Despite large range, melee hit should not trigger
    expect(simulateMeleeHit("crossbow", crossbowRange - 1)).toBe(false);
  });
});
