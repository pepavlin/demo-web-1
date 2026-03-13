/**
 * Tests for the sniper (and general weapon) cooldown progress indicator.
 *
 * These tests cover the pure calculation logic used to derive the
 * `cooldownProgress` value stored in `GameState` — the same formula
 * used inside the game loop in Game3D.tsx:
 *
 *   cooldownProgress = clamp(remaining / weaponCooldown, 0, 1)
 *
 * A value of 1 means "just fired", 0 means "fully reloaded".
 */

import { WEAPON_CONFIGS } from "../lib/gameTypes";

// ── Mirror of the formula used in Game3D.tsx ─────────────────────────────────

/**
 * Compute the cooldown progress (0–1) from the remaining cooldown time.
 * Mirrors: `Math.max(0, Math.min(1, remaining / WEAPON_CONFIGS[weapon].cooldown))`
 */
function calcCooldownProgress(remainingSeconds: number, weaponType: keyof typeof WEAPON_CONFIGS): number {
  const maxCooldown = WEAPON_CONFIGS[weaponType].cooldown;
  return Math.max(0, Math.min(1, remainingSeconds / maxCooldown));
}

// ── Sanity-check weapon configs ───────────────────────────────────────────────

describe("WEAPON_CONFIGS sanity", () => {
  test("sniper has the longest cooldown", () => {
    const cooldowns = Object.values(WEAPON_CONFIGS).map((c) => c.cooldown);
    expect(WEAPON_CONFIGS.sniper.cooldown).toBe(Math.max(...cooldowns));
  });

  test("machinegun has the shortest cooldown (ultra-fast fire rate)", () => {
    const cooldowns = Object.values(WEAPON_CONFIGS).map((c) => c.cooldown);
    expect(WEAPON_CONFIGS.machinegun.cooldown).toBe(Math.min(...cooldowns));
  });

  test("all cooldowns are positive", () => {
    Object.values(WEAPON_CONFIGS).forEach((cfg) => {
      expect(cfg.cooldown).toBeGreaterThan(0);
    });
  });
});

// ── cooldownProgress formula ──────────────────────────────────────────────────

describe("calcCooldownProgress", () => {
  describe("sniper (cooldown = 2.8s)", () => {
    const W = "sniper" as const;
    const CD = WEAPON_CONFIGS.sniper.cooldown; // 2.8

    test("just fired → progress = 1", () => {
      expect(calcCooldownProgress(CD, W)).toBe(1);
    });

    test("halfway through cooldown → progress ≈ 0.5", () => {
      expect(calcCooldownProgress(CD / 2, W)).toBeCloseTo(0.5, 5);
    });

    test("fully reloaded (remaining = 0) → progress = 0", () => {
      expect(calcCooldownProgress(0, W)).toBe(0);
    });

    test("negative remaining clamps to 0", () => {
      expect(calcCooldownProgress(-1, W)).toBe(0);
    });

    test("remaining > cooldown clamps to 1", () => {
      expect(calcCooldownProgress(CD + 5, W)).toBe(1);
    });

    test("progress decreases as time passes", () => {
      const initial = calcCooldownProgress(CD, W);
      const mid = calcCooldownProgress(CD * 0.5, W);
      const nearDone = calcCooldownProgress(0.1, W);
      expect(initial).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(nearDone);
      expect(nearDone).toBeGreaterThan(0);
    });

    test("progress at 1.4s remaining ≈ 0.5 (exact midpoint)", () => {
      // 1.4 / 2.8 = 0.5
      expect(calcCooldownProgress(1.4, W)).toBeCloseTo(0.5, 5);
    });
  });

  describe("crossbow (cooldown = 2.2s)", () => {
    const W = "crossbow" as const;
    const CD = WEAPON_CONFIGS.crossbow.cooldown; // 2.2

    test("just fired → progress = 1", () => {
      expect(calcCooldownProgress(CD, W)).toBe(1);
    });

    test("ready → progress = 0", () => {
      expect(calcCooldownProgress(0, W)).toBe(0);
    });

    test("25% remaining → progress = 0.25", () => {
      expect(calcCooldownProgress(CD * 0.25, W)).toBeCloseTo(0.25, 5);
    });
  });

  describe("bow (cooldown = 1.1s)", () => {
    const W = "bow" as const;
    const CD = WEAPON_CONFIGS.bow.cooldown; // 1.1

    test("just fired → progress = 1", () => {
      expect(calcCooldownProgress(CD, W)).toBe(1);
    });

    test("ready → progress = 0", () => {
      expect(calcCooldownProgress(0, W)).toBe(0);
    });
  });

  describe("sword (cooldown = 0.45s)", () => {
    const W = "sword" as const;
    const CD = WEAPON_CONFIGS.sword.cooldown; // 0.45

    test("just used → progress = 1", () => {
      expect(calcCooldownProgress(CD, W)).toBe(1);
    });

    test("ready → progress = 0", () => {
      expect(calcCooldownProgress(0, W)).toBe(0);
    });
  });
});

// ── Color threshold logic (mirrors JSX in Game3D.tsx) ────────────────────────

/**
 * Returns the ring color based on cooldown progress.
 * Mirrors the ternary in the crosshair SVG in Game3D.tsx.
 */
function getCooldownColor(progress: number): string {
  if (progress > 0.55) return "#ef4444"; // red
  if (progress > 0.25) return "#f97316"; // orange
  return "#a78bfa";                       // purple (near ready)
}

describe("cooldown ring color thresholds", () => {
  test("progress 1.0 (just fired) → red", () => {
    expect(getCooldownColor(1.0)).toBe("#ef4444");
  });

  test("progress 0.6 → red", () => {
    expect(getCooldownColor(0.6)).toBe("#ef4444");
  });

  test("progress 0.55 (boundary) → red", () => {
    // progress > 0.55 required for red; 0.55 itself → orange
    expect(getCooldownColor(0.55)).toBe("#f97316");
  });

  test("progress 0.4 → orange", () => {
    expect(getCooldownColor(0.4)).toBe("#f97316");
  });

  test("progress 0.25 (boundary) → purple", () => {
    // progress > 0.25 required for orange; 0.25 itself → purple
    expect(getCooldownColor(0.25)).toBe("#a78bfa");
  });

  test("progress 0.1 (almost ready) → purple", () => {
    expect(getCooldownColor(0.1)).toBe("#a78bfa");
  });

  test("progress 0 (ready) → purple", () => {
    expect(getCooldownColor(0)).toBe("#a78bfa");
  });
});

// ── SVG strokeDashoffset calculation ─────────────────────────────────────────

describe("SVG strokeDashoffset for cooldown arc", () => {
  const R = 28; // ring radius used in crosshair SVG
  const circumference = 2 * Math.PI * R;

  function calcDashOffset(progress: number): number {
    return circumference * (1 - progress);
  }

  test("progress = 1 (full circle shown) → offset = 0", () => {
    expect(calcDashOffset(1)).toBeCloseTo(0, 5);
  });

  test("progress = 0 (no arc shown) → offset = circumference", () => {
    expect(calcDashOffset(0)).toBeCloseTo(circumference, 5);
  });

  test("progress = 0.5 → offset = circumference / 2", () => {
    expect(calcDashOffset(0.5)).toBeCloseTo(circumference / 2, 5);
  });

  test("progress = 0.25 → offset = 0.75 * circumference", () => {
    expect(calcDashOffset(0.25)).toBeCloseTo(circumference * 0.75, 5);
  });
});

// ── Reload time display (seconds text label) ─────────────────────────────────

describe("reload time text label", () => {
  const CD = WEAPON_CONFIGS.sniper.cooldown; // 2.8

  function formatReloadTime(progress: number, weaponCooldown: number): string {
    return (progress * weaponCooldown).toFixed(1) + "s";
  }

  test("just fired → shows full cooldown", () => {
    expect(formatReloadTime(1.0, CD)).toBe("2.8s");
  });

  test("halfway → shows ~1.4s", () => {
    expect(formatReloadTime(0.5, CD)).toBe("1.4s");
  });

  test("almost ready → shows 0.3s", () => {
    // 0.1 * 2.8 = 0.28 → rounds to 0.3
    expect(formatReloadTime(0.1, CD)).toBe("0.3s");
  });

  test("ready → shows 0.0s (but label hidden in UI)", () => {
    expect(formatReloadTime(0.0, CD)).toBe("0.0s");
  });
});
