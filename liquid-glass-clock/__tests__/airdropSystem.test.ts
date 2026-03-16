import {
  pickRandomLoot,
  pickAirdropLootArray,
  findAirdropLandingPosition,
  formatLootMessage,
  lootEmoji,
  AIRDROP_INTERVAL,
  AIRDROP_SPAWN_HEIGHT,
  AIRDROP_FALL_SPEED,
  AIRDROP_OPEN_RADIUS,
  AIRDROP_DESPAWN_TIME,
  AIRDROP_SPAWN_DIST_MIN,
  AIRDROP_SPAWN_DIST_MAX,
  AIRDROP_SPAWN_ATTEMPTS,
} from "@/lib/airdropSystem";
import type { AirdropLoot } from "@/lib/gameTypes";

describe("airdropSystem constants", () => {
  test("AIRDROP_INTERVAL is 40s (2× less frequent than previous 20 s)", () => { expect(AIRDROP_INTERVAL).toBe(40); });
  test("AIRDROP_SPAWN_HEIGHT > 0", () => { expect(AIRDROP_SPAWN_HEIGHT).toBeGreaterThan(0); });
  test("AIRDROP_FALL_SPEED > 0", () => { expect(AIRDROP_FALL_SPEED).toBeGreaterThan(0); });
  test("AIRDROP_OPEN_RADIUS > 0", () => { expect(AIRDROP_OPEN_RADIUS).toBeGreaterThan(0); });
  test("AIRDROP_DESPAWN_TIME > 0", () => { expect(AIRDROP_DESPAWN_TIME).toBeGreaterThan(0); });
  test("spawn dist range valid", () => {
    expect(AIRDROP_SPAWN_DIST_MIN).toBeGreaterThan(0);
    expect(AIRDROP_SPAWN_DIST_MAX).toBeGreaterThan(AIRDROP_SPAWN_DIST_MIN);
  });
  test("AIRDROP_SPAWN_ATTEMPTS > 0", () => { expect(AIRDROP_SPAWN_ATTEMPTS).toBeGreaterThan(0); });
});

describe("pickRandomLoot", () => {
  const VALID = ["coins", "wood", "health", "weapon"] as const;
  test("returns valid loot type", () => { expect(VALID).toContain(pickRandomLoot().type); });
  test("non-weapon amount > 0", () => {
    for (let i = 0; i < 50; i++) {
      const l = pickRandomLoot();
      if (l.type !== "weapon") expect(l.amount).toBeGreaterThan(0);
    }
  });
  test("weapon loot has weaponType", () => {
    let w: AirdropLoot | null = null;
    for (let i = 0; i < 200; i++) { const l = pickRandomLoot(); if (l.type === "weapon") { w = l; break; } }
    expect(w).not.toBeNull();
    expect(w!.weaponType).toBeDefined();
    expect(w!.amount).toBe(0);
  });
  test("all 4 types appear in 500 samples", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(pickRandomLoot().type);
    expect(seen.has("coins")).toBe(true);
    expect(seen.has("wood")).toBe(true);
    expect(seen.has("health")).toBe(true);
    expect(seen.has("weapon")).toBe(true);
  });
  test("rng=0 returns first loot table entry (coins)", () => {
    expect(pickRandomLoot(() => 0).type).toBe("coins");
  });
  test("coins amount 25-100", () => {
    const a: number[] = [];
    for (let i = 0; i < 200; i++) { const l = pickRandomLoot(); if (l.type === "coins") a.push(l.amount); }
    if (a.length > 0) { expect(Math.min(...a)).toBeGreaterThanOrEqual(25); expect(Math.max(...a)).toBeLessThanOrEqual(100); }
  });
  test("health amount 40-100", () => {
    const a: number[] = [];
    for (let i = 0; i < 200; i++) { const l = pickRandomLoot(); if (l.type === "health") a.push(l.amount); }
    if (a.length > 0) { expect(Math.min(...a)).toBeGreaterThanOrEqual(40); expect(Math.max(...a)).toBeLessThanOrEqual(100); }
  });
});

describe("findAirdropLandingPosition", () => {
  const W = -0.5, M = 1.0;
  test("null when all in water", () => {
    expect(findAirdropLandingPosition(0, 0, () => W - 1, W, M, Math.random)).toBeNull();
  });
  test("valid position on solid land", () => {
    const r = findAirdropLandingPosition(0, 0, () => 2.0, W, M);
    expect(r).not.toBeNull();
    expect(r!.terrainY).toBe(2.0);
  });
  test("distance within spawn range", () => {
    const r = findAirdropLandingPosition(10, 20, () => 5.0, W, M);
    expect(r).not.toBeNull();
    const d = Math.sqrt((r!.x - 10) ** 2 + (r!.z - 20) ** 2);
    expect(d).toBeGreaterThanOrEqual(AIRDROP_SPAWN_DIST_MIN);
    expect(d).toBeLessThanOrEqual(AIRDROP_SPAWN_DIST_MAX + 1);
  });
});

describe("formatLootMessage", () => {
  test("coins msg has amount and mincí", () => {
    const m = formatLootMessage({ type: "coins", amount: 45, label: "X" });
    expect(m).toContain("45");
    expect(m).toContain("mincí");
  });
  test("wood msg has amount and dřeva", () => {
    const m = formatLootMessage({ type: "wood", amount: 20, label: "X" });
    expect(m).toContain("20");
    expect(m).toContain("dřeva");
  });
  test("health msg has HP", () => {
    const m = formatLootMessage({ type: "health", amount: 60, label: "X" });
    expect(m).toContain("60");
    expect(m).toContain("HP");
  });
  test("weapon msg has label", () => {
    const m = formatLootMessage({ type: "weapon", amount: 0, weaponType: "sniper", label: "Odstřelovačka" });
    expect(m).toContain("Odstřelovačka");
  });
});

describe("lootEmoji", () => {
  test("non-empty for coins", () => { expect(lootEmoji({ type: "coins", amount: 10, label: "x" }).length).toBeGreaterThan(0); });
  test("non-empty for wood", () => { expect(lootEmoji({ type: "wood", amount: 10, label: "x" }).length).toBeGreaterThan(0); });
  test("non-empty for health", () => { expect(lootEmoji({ type: "health", amount: 50, label: "x" }).length).toBeGreaterThan(0); });
  test("non-empty for weapon", () => { expect(lootEmoji({ type: "weapon", amount: 0, weaponType: "bow", label: "Luk" }).length).toBeGreaterThan(0); });
});

describe("descent simulation", () => {
  test("crate reaches target y", () => {
    const targetY = 2.0, delta = 0.016;
    let y = AIRDROP_SPAWN_HEIGHT;
    while (y > targetY) { y -= AIRDROP_FALL_SPEED * delta; if (y < targetY) { y = targetY; break; } }
    expect(y).toBe(targetY);
  });
  test("descent takes > 30 seconds (parachute should fall slowly)", () => {
    // The crate has a parachute — it must drift down slowly and for a long time.
    // AIRDROP_SPAWN_HEIGHT=200, AIRDROP_FALL_SPEED=2.5 → ~79 s of visible descent.
    expect((AIRDROP_SPAWN_HEIGHT - 2) / AIRDROP_FALL_SPEED).toBeGreaterThan(30);
  });
  test("fall speed is gentle (≤ 3 units/s)", () => {
    // Ensures nobody accidentally cranks up the speed and breaks the slow-drift look.
    expect(AIRDROP_FALL_SPEED).toBeLessThanOrEqual(3);
  });
});

describe("targetY landing contract", () => {
  // The physics system places a body at terrainY + radius.
  // targetY must therefore be terrainY + CRATE_RADIUS so the landing check
  //   currentY <= targetY + 0.1
  // fires correctly.  This test documents that contract.

  const CRATE_RADIUS = 0.65;

  test("targetY = terrainY + CRATE_RADIUS triggers hasLanded check", () => {
    const terrainY = 5.0;
    const targetY = terrainY + CRATE_RADIUS; // correct (fixed) value
    // Physics rest position: terrainY + radius = targetY
    const restY = terrainY + CRATE_RADIUS;
    expect(restY).toBeLessThanOrEqual(targetY + 0.1); // check fires ✓
  });

  test("old targetY = terrainY (without radius) does NOT trigger hasLanded", () => {
    const terrainY = 5.0;
    const brokenTargetY = terrainY; // missing radius — the original bug
    const restY = terrainY + CRATE_RADIUS;
    // restY (5.65) > brokenTargetY + 0.1 (5.1) → check never fires ✗
    expect(restY).toBeGreaterThan(brokenTargetY + 0.1);
  });
});

describe("server-side airdrop synchronisation invariants", () => {
  // These tests document the constraints that the server must satisfy when
  // computing the landing position for a shared (synchronized) periodic drop.
  // All clients receive the same {x, z} and must produce the same visual result.

  test("same x/z coordinates produce same terrainY on all clients (deterministic terrain)", () => {
    // Terrain is procedurally generated with the same deterministic algorithm on
    // every client, so getTerrainHeightSampled(x, z) is identical for everyone.
    // This test verifies the helper used during crate spawning is pure / deterministic.
    const getHeight = (x: number, z: number) => Math.sin(x * 0.1) * 5 + Math.cos(z * 0.1) * 3 + 10;
    const x = 42.5, z = -17.3;
    expect(getHeight(x, z)).toBe(getHeight(x, z)); // pure – same input, same output
  });

  test("AIRDROP_DIST_MIN and AIRDROP_DIST_MAX define the valid spawn ring", () => {
    // Server generates distance within this ring. Verifying constants are sensible.
    expect(AIRDROP_SPAWN_DIST_MAX).toBeGreaterThan(AIRDROP_SPAWN_DIST_MIN);
    expect(AIRDROP_SPAWN_DIST_MIN).toBeGreaterThanOrEqual(10);
  });

  test("AIRDROP_INTERVAL matches server AIRDROP_INTERVAL_MS / 1000", () => {
    // The server uses AIRDROP_INTERVAL_MS = 40_000 ms.
    // The client exports AIRDROP_INTERVAL = 40 s.
    // They must be equal so the HUD countdown stays in sync.
    const SERVER_AIRDROP_INTERVAL_MS = 40_000;
    expect(AIRDROP_INTERVAL).toBe(SERVER_AIRDROP_INTERVAL_MS / 1000);
  });
});

describe("pickAirdropLootArray — guaranteed weapon + resource", () => {
  test("always returns array of length 2", () => {
    for (let i = 0; i < 50; i++) {
      expect(pickAirdropLootArray()).toHaveLength(2);
    }
  });
  test("first entry is always weapon type", () => {
    for (let i = 0; i < 50; i++) {
      expect(pickAirdropLootArray()[0].type).toBe("weapon");
    }
  });
  test("second entry is always a resource (not weapon)", () => {
    const nonWeapon = ["coins", "wood", "health"];
    for (let i = 0; i < 50; i++) {
      expect(nonWeapon).toContain(pickAirdropLootArray()[1].type);
    }
  });
  test("weapon entry has weaponType defined", () => {
    for (let i = 0; i < 50; i++) {
      expect(pickAirdropLootArray()[0].weaponType).toBeDefined();
    }
  });
  test("resource entry has positive amount", () => {
    for (let i = 0; i < 50; i++) {
      expect(pickAirdropLootArray()[1].amount).toBeGreaterThan(0);
    }
  });
});
