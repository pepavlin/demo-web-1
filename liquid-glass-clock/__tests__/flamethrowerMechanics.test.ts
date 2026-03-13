/**
 * Tests for the flamethrower (plamenomet) weapon mechanics.
 *
 * Covers:
 * - Weapon config values and type registration
 * - Short-range fire stream characteristics
 * - DPS calculation relative to other weapons
 * - Auto-fire eligibility (hold LMB for continuous stream)
 * - Flame particle lifetime and range relationship
 * - Cooldown progress behaviour
 */

import { WEAPON_CONFIGS, type WeaponType } from "../lib/gameTypes";

// ── Config existence and type ─────────────────────────────────────────────────

describe("flamethrower WEAPON_CONFIGS entry", () => {
  test("flamethrower exists in WEAPON_CONFIGS", () => {
    expect(WEAPON_CONFIGS.flamethrower).toBeDefined();
  });

  test("type field matches key", () => {
    expect(WEAPON_CONFIGS.flamethrower.type).toBe("flamethrower");
  });

  test("label is Plamenomet", () => {
    expect(WEAPON_CONFIGS.flamethrower.label).toBe("Plamenomet");
  });

  test("color is fire red (#ef4444)", () => {
    expect(WEAPON_CONFIGS.flamethrower.color).toBe("#ef4444");
  });
});

// ── Range (short-range weapon) ────────────────────────────────────────────────

describe("flamethrower range", () => {
  const FT = WEAPON_CONFIGS.flamethrower;

  test("range is positive", () => {
    expect(FT.range).toBeGreaterThan(0);
  });

  test("range is short (≤ 20 units)", () => {
    expect(FT.range).toBeLessThanOrEqual(20);
  });

  test("range is shorter than crossbow", () => {
    expect(FT.range).toBeLessThan(WEAPON_CONFIGS.crossbow.range);
  });

  test("range is shorter than machinegun", () => {
    expect(FT.range).toBeLessThan(WEAPON_CONFIGS.machinegun.range);
  });

  test("range is shorter than sniper", () => {
    expect(FT.range).toBeLessThan(WEAPON_CONFIGS.sniper.range);
  });
});

// ── Bullet speed (slow flame particles) ──────────────────────────────────────

describe("flamethrower projectile properties", () => {
  const FT = WEAPON_CONFIGS.flamethrower;

  test("has a positive bulletSpeed (ranged — uses particle stream)", () => {
    expect(FT.bulletSpeed).toBeGreaterThan(0);
  });

  test("bulletSpeed is slower than machinegun bullets (flame ≠ bullet)", () => {
    expect(FT.bulletSpeed).toBeLessThan(WEAPON_CONFIGS.machinegun.bulletSpeed);
  });

  test("bulletSpeed × lifetime covers approx the declared range", () => {
    // FLAME_PARTICLE_LIFETIME = 1.9 s (from Game3D constants)
    const FLAME_LIFETIME = 1.9;
    const maxDist = FT.bulletSpeed * FLAME_LIFETIME;
    // Should reach at least the declared range
    expect(maxDist).toBeGreaterThanOrEqual(FT.range);
  });
});

// ── Fire rate / cooldown ──────────────────────────────────────────────────────

describe("flamethrower fire rate", () => {
  const FT = WEAPON_CONFIGS.flamethrower;

  test("cooldown is positive", () => {
    expect(FT.cooldown).toBeGreaterThan(0);
  });

  test("cooldown is very short (fast continuous stream ≤ 0.1 s)", () => {
    expect(FT.cooldown).toBeLessThanOrEqual(0.10);
  });

  test("fire rate is >= 10 bursts/second", () => {
    const burstsPerSecond = 1 / FT.cooldown;
    expect(burstsPerSecond).toBeGreaterThanOrEqual(10);
  });
});

// ── Damage / DPS balance ──────────────────────────────────────────────────────

describe("flamethrower DPS characteristics", () => {
  const FT = WEAPON_CONFIGS.flamethrower;

  test("per-shot damage is lower than sniper (stream vs precision)", () => {
    expect(FT.damage).toBeLessThan(WEAPON_CONFIGS.sniper.damage);
  });

  test("per-shot damage is lower than crossbow", () => {
    expect(FT.damage).toBeLessThan(WEAPON_CONFIGS.crossbow.damage);
  });

  test("per-shot damage is positive", () => {
    expect(FT.damage).toBeGreaterThan(0);
  });

  test("theoretical DPS (per burst, 4 particles) exceeds machinegun DPS", () => {
    // Flamethrower spawns 4 particles per tick
    const FLAME_PARTICLE_COUNT = 4;
    const ftDps = (FT.damage * FLAME_PARTICLE_COUNT) / FT.cooldown;
    const mgDps = WEAPON_CONFIGS.machinegun.damage / WEAPON_CONFIGS.machinegun.cooldown;
    expect(ftDps).toBeGreaterThan(mgDps);
  });
});

// ── WeaponType union ──────────────────────────────────────────────────────────

describe("WeaponType includes flamethrower", () => {
  test("flamethrower is a valid WeaponType literal", () => {
    const w: WeaponType = "flamethrower";
    expect(w).toBe("flamethrower");
  });

  test("all seven weapons are present in WEAPON_CONFIGS", () => {
    const expectedWeapons: WeaponType[] = [
      "sword", "bow", "crossbow", "sniper", "axe", "machinegun", "flamethrower",
    ];
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

describe("flamethrower auto-fire eligibility", () => {
  test("flamethrower IS eligible for auto-fire (hold LMB for stream)", () => {
    expect(isAutoFireEligible("flamethrower")).toBe(true);
  });

  test("machinegun is also auto-fire eligible (for comparison)", () => {
    expect(isAutoFireEligible("machinegun")).toBe(true);
  });

  test("bow is NOT eligible for auto-fire (charge-based)", () => {
    expect(isAutoFireEligible("bow")).toBe(false);
  });

  test("sniper is NOT eligible for auto-fire", () => {
    expect(isAutoFireEligible("sniper")).toBe(false);
  });
});

// ── Cooldown progress formula ─────────────────────────────────────────────────

function calcCooldownProgress(remaining: number, weaponType: WeaponType): number {
  const maxCd = WEAPON_CONFIGS[weaponType].cooldown;
  return Math.max(0, Math.min(1, remaining / maxCd));
}

describe("flamethrower cooldown progress", () => {
  const FT_CD = WEAPON_CONFIGS.flamethrower.cooldown;

  test("just fired → progress = 1", () => {
    expect(calcCooldownProgress(FT_CD, "flamethrower")).toBe(1);
  });

  test("ready → progress = 0", () => {
    expect(calcCooldownProgress(0, "flamethrower")).toBe(0);
  });

  test("half cooldown → progress ≈ 0.5", () => {
    expect(calcCooldownProgress(FT_CD / 2, "flamethrower")).toBeCloseTo(0.5, 5);
  });

  test("negative remaining clamps to 0", () => {
    expect(calcCooldownProgress(-1, "flamethrower")).toBe(0);
  });
});

// ── Flame particle lifetime / range coherence ────────────────────────────────

describe("flame particle lifetime coherence", () => {
  const FT = WEAPON_CONFIGS.flamethrower;
  const FLAME_PARTICLE_LIFETIME = 1.9; // matches constant in Game3D.tsx

  test("FLAME_PARTICLE_LIFETIME is positive", () => {
    expect(FLAME_PARTICLE_LIFETIME).toBeGreaterThan(0);
  });

  test("minimum particle travel distance ≥ declared range", () => {
    // Particles spawn at 75% of bulletSpeed at minimum
    const minSpeed = FT.bulletSpeed * 0.75;
    const minDist = minSpeed * FLAME_PARTICLE_LIFETIME;
    expect(minDist).toBeGreaterThanOrEqual(FT.range);
  });

  test("maximum particle travel distance does not vastly exceed range (stays short)", () => {
    // Particles spawn at max 125% of bulletSpeed
    const maxSpeed = FT.bulletSpeed * 1.25;
    const maxDist = maxSpeed * FLAME_PARTICLE_LIFETIME;
    // Should be at most ~3× the declared range (still a short-range weapon)
    expect(maxDist).toBeLessThanOrEqual(FT.range * 3);
  });
});
