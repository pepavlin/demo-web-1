/**
 * Tests for the machine gun (kulomet) weapon mechanics.
 *
 * Covers:
 * - Weapon config values and type registration
 * - Ultra-fast fire rate characteristics
 * - DPS calculation relative to other weapons
 * - Cooldown progress behaviour
 * - Auto-fire eligibility logic (not bow, not sniper)
 */

import { WEAPON_CONFIGS, type WeaponType } from "../lib/gameTypes";

// ── Config existence and type ─────────────────────────────────────────────────

describe("machinegun WEAPON_CONFIGS entry", () => {
  test("machinegun exists in WEAPON_CONFIGS", () => {
    expect(WEAPON_CONFIGS.machinegun).toBeDefined();
  });

  test("type field matches key", () => {
    expect(WEAPON_CONFIGS.machinegun.type).toBe("machinegun");
  });

  test("label is Kulomet", () => {
    expect(WEAPON_CONFIGS.machinegun.label).toBe("Kulomet");
  });

  test("color is orange (#f97316)", () => {
    expect(WEAPON_CONFIGS.machinegun.color).toBe("#f97316");
  });
});

// ── Fire rate / cooldown ──────────────────────────────────────────────────────

describe("machinegun fire rate", () => {
  const MG = WEAPON_CONFIGS.machinegun;

  test("cooldown is ≤ 0.10s (ultra-fast)", () => {
    expect(MG.cooldown).toBeLessThanOrEqual(0.10);
  });

  test("cooldown is > 0 (valid positive value)", () => {
    expect(MG.cooldown).toBeGreaterThan(0);
  });

  test("fire rate is >= 10 shots/second", () => {
    const shotsPerSecond = 1 / MG.cooldown;
    expect(shotsPerSecond).toBeGreaterThanOrEqual(10);
  });

  test("has the shortest cooldown of all weapons", () => {
    const allCooldowns = Object.values(WEAPON_CONFIGS).map((c) => c.cooldown);
    expect(MG.cooldown).toBe(Math.min(...allCooldowns));
  });
});

// ── Projectile / range ────────────────────────────────────────────────────────

describe("machinegun projectile properties", () => {
  const MG = WEAPON_CONFIGS.machinegun;

  test("has a positive bulletSpeed (ranged weapon)", () => {
    expect(MG.bulletSpeed).toBeGreaterThan(0);
  });

  test("bulletSpeed is >= 100 units/s (fast bullets)", () => {
    expect(MG.bulletSpeed).toBeGreaterThanOrEqual(100);
  });

  test("range is > 0", () => {
    expect(MG.range).toBeGreaterThan(0);
  });

  test("range is at least 100 units (medium-long range)", () => {
    expect(MG.range).toBeGreaterThanOrEqual(100);
  });
});

// ── Damage / DPS balance ──────────────────────────────────────────────────────

describe("machinegun DPS characteristics", () => {
  const MG = WEAPON_CONFIGS.machinegun;

  test("per-shot damage is less than crossbow (low per-shot, high rate)", () => {
    expect(MG.damage).toBeLessThan(WEAPON_CONFIGS.crossbow.damage);
  });

  test("per-shot damage is less than sniper", () => {
    expect(MG.damage).toBeLessThan(WEAPON_CONFIGS.sniper.damage);
  });

  test("theoretical DPS exceeds sword DPS", () => {
    const mgDps = MG.damage / MG.cooldown;
    const swordDps = WEAPON_CONFIGS.sword.damage / WEAPON_CONFIGS.sword.cooldown;
    expect(mgDps).toBeGreaterThan(swordDps);
  });

  test("theoretical DPS exceeds sniper DPS", () => {
    const mgDps = MG.damage / MG.cooldown;
    const sniperDps = WEAPON_CONFIGS.sniper.damage / WEAPON_CONFIGS.sniper.cooldown;
    expect(mgDps).toBeGreaterThan(sniperDps);
  });
});

// ── WeaponType union ──────────────────────────────────────────────────────────

describe("WeaponType includes machinegun", () => {
  test("machinegun is a valid WeaponType literal", () => {
    const w: WeaponType = "machinegun";
    expect(w).toBe("machinegun");
  });

  test("all five weapons are present in WEAPON_CONFIGS", () => {
    const expectedWeapons: WeaponType[] = ["sword", "bow", "crossbow", "sniper", "machinegun"];
    expectedWeapons.forEach((w) => {
      expect(WEAPON_CONFIGS[w]).toBeDefined();
    });
  });
});

// ── Auto-fire eligibility ─────────────────────────────────────────────────────

/**
 * Mirrors the auto-fire guard in Game3D.tsx:
 *   if (isMouseHeld && weapon !== "bow" && weapon !== "sniper") doAttack();
 */
function isAutoFireEligible(weapon: WeaponType): boolean {
  return weapon !== "bow" && weapon !== "sniper";
}

describe("auto-fire eligibility", () => {
  test("machinegun IS eligible for auto-fire (hold LMB)", () => {
    expect(isAutoFireEligible("machinegun")).toBe(true);
  });

  test("sword IS eligible for auto-fire", () => {
    expect(isAutoFireEligible("sword")).toBe(true);
  });

  test("crossbow IS eligible for auto-fire", () => {
    expect(isAutoFireEligible("crossbow")).toBe(true);
  });

  test("bow is NOT eligible for auto-fire (charge-based)", () => {
    expect(isAutoFireEligible("bow")).toBe(false);
  });

  test("sniper is NOT eligible for auto-fire (single-shot)", () => {
    expect(isAutoFireEligible("sniper")).toBe(false);
  });
});

// ── Cooldown progress formula ─────────────────────────────────────────────────

function calcCooldownProgress(remaining: number, weaponType: WeaponType): number {
  const maxCd = WEAPON_CONFIGS[weaponType].cooldown;
  return Math.max(0, Math.min(1, remaining / maxCd));
}

describe("machinegun cooldown progress (rapid fire)", () => {
  const MG_CD = WEAPON_CONFIGS.machinegun.cooldown; // 0.08

  test("just fired → progress = 1", () => {
    expect(calcCooldownProgress(MG_CD, "machinegun")).toBe(1);
  });

  test("ready → progress = 0", () => {
    expect(calcCooldownProgress(0, "machinegun")).toBe(0);
  });

  test("half cooldown → progress ≈ 0.5", () => {
    expect(calcCooldownProgress(MG_CD / 2, "machinegun")).toBeCloseTo(0.5, 5);
  });

  test("negative remaining clamps to 0", () => {
    expect(calcCooldownProgress(-1, "machinegun")).toBe(0);
  });

  test("60ms remaining is still meaningful (within 80ms window)", () => {
    // 0.06 / 0.08 = 0.75
    expect(calcCooldownProgress(0.06, "machinegun")).toBeCloseTo(0.75, 5);
  });
});
