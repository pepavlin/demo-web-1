/**
 * Tests for the bow charging mechanic and arrow ground-sticking logic.
 *
 * These tests cover the pure calculation logic that mirrors what the game loop
 * executes each frame — they do NOT require a DOM, Three.js renderer, or a
 * full React component mount.
 */

import type { BulletData } from "../lib/gameTypes";
import { WEAPON_CONFIGS } from "../lib/gameTypes";
import * as THREE from "three";

// ── Helpers that mirror the logic in Game3D.tsx ───────────────────────────────

/** Maximum hold time (seconds) to reach full draw power — must match Game3D.tsx. */
const BOW_MAX_CHARGE_TIME = 1.5;

/**
 * Convert a hold duration (seconds) into a 0–1 power multiplier.
 * Clamps between 0.1 (minimum viable shot) and 1.0 (full draw).
 */
function calcPower(holdSeconds: number): number {
  return Math.min(1.0, Math.max(0.1, holdSeconds / BOW_MAX_CHARGE_TIME));
}

/**
 * Scale arrow speed the same way Game3D.tsx does in doAttack().
 */
function calcArrowSpeed(powerMultiplier: number): number {
  const baseSpeed = WEAPON_CONFIGS.bow.bulletSpeed;
  return baseSpeed * Math.max(0.15, powerMultiplier);
}

/**
 * Scale bow damage the same way the bullet-hit loop does.
 */
function calcArrowDamage(power: number | undefined): number {
  const baseDmg = WEAPON_CONFIGS.bow.damage;
  return power !== undefined
    ? Math.round(baseDmg * (0.5 + 0.5 * power))
    : baseDmg;
}

/** Downward acceleration applied to arrows — must match ARROW_GRAVITY in Game3D.tsx. */
const ARROW_GRAVITY = -22;

/**
 * Simulate the bow trajectory arc the same way the game loop does:
 * returns an array of 3D positions for `numPoints` steps each `dt` seconds apart.
 * Stops early (and fills remaining slots with the landing point) if the simulated
 * arrow would drop below `groundY` (default 0 for flat-ground tests).
 */
function simulateTrajectoryArc(
  startPos: THREE.Vector3,
  velocity: THREE.Vector3,
  numPoints: number,
  dt: number,
  groundY = 0,
): { points: THREE.Vector3[]; landIndex: number } {
  const vel = velocity.clone();
  const pos = startPos.clone();
  const points: THREE.Vector3[] = [];
  let landIndex = numPoints;

  for (let i = 0; i < numPoints; i++) {
    points.push(pos.clone());

    if (i > 0 && pos.y <= groundY + 0.05) {
      landIndex = i + 1;
      break;
    }

    vel.y += ARROW_GRAVITY * dt;
    pos.addScaledVector(vel, dt);
  }

  return { points, landIndex };
}

// ── BulletData interface ──────────────────────────────────────────────────────

describe("BulletData interface – new fields", () => {
  it("accepts isStuck, stuckLifetime, and power as optional fields", () => {
    // Build a minimal BulletData object with all new fields populated.
    const bullet: BulletData = {
      mesh: new THREE.Object3D(),
      velocity: new THREE.Vector3(0, 0, -10),
      lifetime: 4,
      useGravity: true,
      isStuck: false,
      stuckLifetime: 12,
      power: 0.75,
    };

    expect(bullet.isStuck).toBe(false);
    expect(bullet.stuckLifetime).toBe(12);
    expect(bullet.power).toBe(0.75);
  });

  it("works without the optional fields (backwards compat)", () => {
    const bullet: BulletData = {
      mesh: new THREE.Object3D(),
      velocity: new THREE.Vector3(0, 0, -10),
      lifetime: 4,
    };

    expect(bullet.isStuck).toBeUndefined();
    expect(bullet.stuckLifetime).toBeUndefined();
    expect(bullet.power).toBeUndefined();
  });
});

// ── Bow power calculation ─────────────────────────────────────────────────────

describe("calcPower – bow charge multiplier", () => {
  it("returns 0.1 for an instant release (0 s hold)", () => {
    expect(calcPower(0)).toBeCloseTo(0.1);
  });

  it("returns 1.0 for a full charge (≥ BOW_MAX_CHARGE_TIME)", () => {
    expect(calcPower(BOW_MAX_CHARGE_TIME)).toBeCloseTo(1.0);
    expect(calcPower(BOW_MAX_CHARGE_TIME + 5)).toBeCloseTo(1.0); // clamped
  });

  it("returns 0.5 at exactly half charge time", () => {
    expect(calcPower(BOW_MAX_CHARGE_TIME / 2)).toBeCloseTo(0.5);
  });

  it("is monotonically increasing between 0 and BOW_MAX_CHARGE_TIME", () => {
    const samples = [0, 0.3, 0.6, 0.9, 1.2, BOW_MAX_CHARGE_TIME];
    for (let i = 1; i < samples.length; i++) {
      expect(calcPower(samples[i])).toBeGreaterThanOrEqual(calcPower(samples[i - 1]));
    }
  });

  it("never exceeds 1.0 regardless of hold time", () => {
    expect(calcPower(9999)).toBeLessThanOrEqual(1.0);
  });

  it("never goes below 0.1", () => {
    expect(calcPower(-1)).toBeGreaterThanOrEqual(0.1);
  });
});

// ── Arrow speed scaling ───────────────────────────────────────────────────────

describe("calcArrowSpeed – bow speed proportional to draw", () => {
  const baseSpeed = WEAPON_CONFIGS.bow.bulletSpeed; // 38 u/s

  it("minimum power (0.1) gives at least 15% of base speed", () => {
    const speed = calcArrowSpeed(0.1);
    expect(speed).toBeGreaterThanOrEqual(baseSpeed * 0.15);
  });

  it("full power (1.0) gives exactly base speed", () => {
    expect(calcArrowSpeed(1.0)).toBeCloseTo(baseSpeed);
  });

  it("speed increases with power", () => {
    expect(calcArrowSpeed(0.5)).toBeLessThan(calcArrowSpeed(1.0));
    expect(calcArrowSpeed(0.1)).toBeLessThan(calcArrowSpeed(0.5));
  });
});

// ── Arrow damage scaling ──────────────────────────────────────────────────────

describe("calcArrowDamage – damage scales with draw power", () => {
  const baseDmg = WEAPON_CONFIGS.bow.damage; // 40

  it("full power (1.0) deals full damage", () => {
    expect(calcArrowDamage(1.0)).toBe(baseDmg);
  });

  it("minimum power (0.1) deals 55% of base damage (floor: 0.5 + 0.5*0.1 = 0.55)", () => {
    expect(calcArrowDamage(0.1)).toBe(Math.round(baseDmg * 0.55));
  });

  it("half power (0.5) deals 75% of base damage", () => {
    expect(calcArrowDamage(0.5)).toBe(Math.round(baseDmg * 0.75));
  });

  it("undefined power (non-bow bullet) returns full base damage unchanged", () => {
    expect(calcArrowDamage(undefined)).toBe(baseDmg);
  });

  it("damage increases monotonically with power", () => {
    const powers = [0.1, 0.25, 0.5, 0.75, 1.0];
    for (let i = 1; i < powers.length; i++) {
      expect(calcArrowDamage(powers[i])).toBeGreaterThanOrEqual(calcArrowDamage(powers[i - 1]));
    }
  });
});

// ── Trajectory arc simulation ─────────────────────────────────────────────────

describe("simulateTrajectoryArc – predicted arrow path", () => {
  const TRAJ_DT = 0.06;
  const NUM_POINTS = 80;

  it("first point equals the start position", () => {
    const start = new THREE.Vector3(0, 5, 0);
    const vel = new THREE.Vector3(0, 0, -38); // horizontal full-power shot
    const { points } = simulateTrajectoryArc(start, vel, NUM_POINTS, TRAJ_DT);
    expect(points[0].x).toBeCloseTo(start.x);
    expect(points[0].y).toBeCloseTo(start.y);
    expect(points[0].z).toBeCloseTo(start.z);
  });

  it("arc curves downward due to gravity", () => {
    const start = new THREE.Vector3(0, 10, 0);
    const vel = new THREE.Vector3(0, 0, -38);
    const { points } = simulateTrajectoryArc(start, vel, NUM_POINTS, TRAJ_DT);
    // After enough steps the arrow must be lower than the start
    const lastPoint = points[points.length - 1];
    expect(lastPoint.y).toBeLessThan(start.y);
  });

  it("stops early when arrow reaches ground level", () => {
    const start = new THREE.Vector3(0, 2, 0); // low start – hits ground quickly
    const vel = new THREE.Vector3(0, 0, -38);
    const { landIndex } = simulateTrajectoryArc(start, vel, NUM_POINTS, TRAJ_DT, 0);
    expect(landIndex).toBeLessThan(NUM_POINTS);
  });

  it("upward-angled shot stays airborne longer than flat shot", () => {
    const start = new THREE.Vector3(0, 5, 0);
    const speed = 38;
    const angle = Math.PI / 8; // 22.5° upward

    const flatVel = new THREE.Vector3(0, 0, -speed);
    const angledVel = new THREE.Vector3(0, Math.sin(angle) * speed, -Math.cos(angle) * speed);

    const { landIndex: flatLand } = simulateTrajectoryArc(start, flatVel, NUM_POINTS, TRAJ_DT, 0);
    const { landIndex: angledLand } = simulateTrajectoryArc(start, angledVel, NUM_POINTS, TRAJ_DT, 0);

    expect(angledLand).toBeGreaterThan(flatLand);
  });

  it("weak shot (15% speed) lands much closer than full-power shot", () => {
    const baseSpeed = WEAPON_CONFIGS.bow.bulletSpeed;
    const start = new THREE.Vector3(0, 5, 0);

    const weakVel = new THREE.Vector3(0, 0, -(baseSpeed * 0.15));
    const fullVel  = new THREE.Vector3(0, 0, -baseSpeed);

    const { points: weakPoints, landIndex: wi } = simulateTrajectoryArc(start, weakVel, NUM_POINTS, TRAJ_DT, 0);
    const { points: fullPoints, landIndex: fi } = simulateTrajectoryArc(start, fullVel, NUM_POINTS, TRAJ_DT, 0);

    const weakRange = Math.abs(weakPoints[wi - 1].z - start.z);
    const fullRange  = Math.abs(fullPoints[fi - 1].z - start.z);
    expect(fullRange).toBeGreaterThan(weakRange);
  });

  it("returns at most NUM_POINTS points even when arrow never hits ground", () => {
    // Very high start + upward velocity — never reaches groundY = -9999
    const start = new THREE.Vector3(0, 1000, 0);
    const vel = new THREE.Vector3(0, 100, -38);
    const { points } = simulateTrajectoryArc(start, vel, NUM_POINTS, TRAJ_DT, -9999);
    expect(points.length).toBeLessThanOrEqual(NUM_POINTS);
  });
});

// ── Stuck arrow lifetime logic ────────────────────────────────────────────────

describe("stuck arrow lifetime management", () => {
  function simulateStuckUpdate(bullet: BulletData, dt: number): boolean {
    // Mirrors the stuck-arrow branch in the bullet update loop.
    if (bullet.isStuck) {
      bullet.stuckLifetime = (bullet.stuckLifetime ?? 0) - dt;
      return bullet.stuckLifetime <= 0; // true = should be removed
    }
    return false;
  }

  it("stuck arrow is not removed while lifetime > 0", () => {
    const bullet: BulletData = {
      mesh: new THREE.Object3D(),
      velocity: new THREE.Vector3(),
      lifetime: 4,
      isStuck: true,
      stuckLifetime: 12,
    };

    const shouldRemove = simulateStuckUpdate(bullet, 1.0); // 1 second passes
    expect(shouldRemove).toBe(false);
    expect(bullet.stuckLifetime).toBeCloseTo(11);
  });

  it("stuck arrow is removed when lifetime reaches 0", () => {
    const bullet: BulletData = {
      mesh: new THREE.Object3D(),
      velocity: new THREE.Vector3(),
      lifetime: 4,
      isStuck: true,
      stuckLifetime: 0.016, // one frame left
    };

    const shouldRemove = simulateStuckUpdate(bullet, 0.016);
    expect(shouldRemove).toBe(true);
  });

  it("non-stuck arrow is not affected by the stuck branch", () => {
    const bullet: BulletData = {
      mesh: new THREE.Object3D(),
      velocity: new THREE.Vector3(0, 0, -10),
      lifetime: 4,
      isStuck: false,
    };

    const shouldRemove = simulateStuckUpdate(bullet, 1.0);
    expect(shouldRemove).toBe(false);
    // lifetime should be unchanged (stuck branch not reached)
    expect(bullet.lifetime).toBe(4);
  });
});
