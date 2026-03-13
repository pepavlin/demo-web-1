/**
 * Airdrop System
 *
 * Every AIRDROP_INTERVAL seconds a supply crate falls from the sky on a
 * parachute and lands at a random position near the player.  The player can
 * open it by walking close (within AIRDROP_OPEN_RADIUS world units).  The
 * crate contains one of four loot types: coins, wood, health, or a weapon.
 */

import type { AirdropLoot, AirdropLootType, WeaponType } from "./gameTypes";

// ─── Timing & spawn ──────────────────────────────────────────────────────────

/** Seconds between successive airdrops. */
export const AIRDROP_INTERVAL = 60; // 1 minute

/** Y coordinate from which the crate starts falling. */
export const AIRDROP_SPAWN_HEIGHT = 80;

/** Descent speed in world units per second (parachute dampening). */
export const AIRDROP_FALL_SPEED = 7;

/** Horizontal distance (min / max) from the player where a crate can land. */
export const AIRDROP_SPAWN_DIST_MIN = 35;
export const AIRDROP_SPAWN_DIST_MAX = 65;

/** Maximum attempts to find a valid (above-water) landing position. */
export const AIRDROP_SPAWN_ATTEMPTS = 12;

// ─── Interaction ─────────────────────────────────────────────────────────────

/** Player must be within this radius (world units) to open the crate. */
export const AIRDROP_OPEN_RADIUS = 3.2;

/** Seconds after landing before the crate auto-despawns if unopened. */
export const AIRDROP_DESPAWN_TIME = 120;

// ─── Loot table ──────────────────────────────────────────────────────────────

/** Weighted entry for a single loot outcome. */
interface LootEntry {
  weight: number;
  type: AirdropLootType;
  /** Range [min, max] for the numeric reward.  Ignored for "weapon". */
  amountMin?: number;
  amountMax?: number;
  weaponType?: WeaponType;
  label: string;
}

/** All possible loot outcomes with their relative weights. */
const LOOT_TABLE: LootEntry[] = [
  // ── Ammo (coins in-game representation) ──
  { weight: 18, type: "coins", amountMin: 25, amountMax: 60, label: "Zásobník nábojů" },
  { weight: 14, type: "coins", amountMin: 60, amountMax: 100, label: "Bedna nábojů" },

  // ── Suroviny (materials → wood) ──
  { weight: 18, type: "wood", amountMin: 15, amountMax: 30, label: "Zásoby dřeva" },
  { weight: 10, type: "wood", amountMin: 30, amountMax: 55, label: "Hromada dřeva" },

  // ── Health ──
  { weight: 15, type: "health", amountMin: 40, amountMax: 70, label: "Lékárnička" },
  { weight: 8,  type: "health", amountMin: 70, amountMax: 100, label: "Velká lékárnička" },

  // ── Weapons ──
  { weight: 5,  type: "weapon", weaponType: "bow",        label: "Luk" },
  { weight: 4,  type: "weapon", weaponType: "crossbow",   label: "Kuše" },
  { weight: 4,  type: "weapon", weaponType: "machinegun", label: "Kulomet" },
  { weight: 3,  type: "weapon", weaponType: "sniper",     label: "Odstřelovačka" },
  { weight: 1,  type: "weapon", weaponType: "axe",        label: "Sekera" },
  { weight: 3,  type: "weapon", weaponType: "shovel",     label: "Lopata" },
];

/** Total weight sum — computed once for O(1) roll. */
const TOTAL_WEIGHT = LOOT_TABLE.reduce((sum, e) => sum + e.weight, 0);

/**
 * Randomly selects one loot outcome from the weighted loot table.
 *
 * @param rng  Optional RNG function (defaults to Math.random) — injectable for
 *             testing purposes.
 */
export function pickRandomLoot(rng: () => number = Math.random): AirdropLoot {
  let roll = rng() * TOTAL_WEIGHT;

  for (const entry of LOOT_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) {
      return resolveLootEntry(entry, rng);
    }
  }

  // Fallback (floating-point edge case): return last entry
  return resolveLootEntry(LOOT_TABLE[LOOT_TABLE.length - 1], rng);
}

function resolveLootEntry(entry: LootEntry, rng: () => number): AirdropLoot {
  if (entry.type === "weapon") {
    return {
      type: "weapon",
      amount: 0,
      weaponType: entry.weaponType!,
      label: entry.label,
    };
  }

  const min = entry.amountMin ?? 1;
  const max = entry.amountMax ?? min;
  const amount = Math.round(min + rng() * (max - min));

  return {
    type: entry.type,
    amount,
    label: entry.label,
  };
}

// ─── Loot display helpers ─────────────────────────────────────────────────────

/**
 * Returns a short Czech sentence describing what was found in the crate.
 * Used for the in-game notification.
 */
export function formatLootMessage(loot: AirdropLoot): string {
  switch (loot.type) {
    case "coins":
      return `${loot.label}: +${loot.amount} mincí`;
    case "wood":
      return `${loot.label}: +${loot.amount} dřeva`;
    case "health":
      return `${loot.label}: +${loot.amount} HP`;
    case "weapon":
      return `Nalezena zbraň: ${loot.label}`;
    default:
      return loot.label;
  }
}

/**
 * Returns an emoji appropriate for the loot type (used in HUD notifications).
 */
export function lootEmoji(loot: AirdropLoot): string {
  switch (loot.type) {
    case "coins":  return "🪙";
    case "wood":   return "🪵";
    case "health": return "❤️";
    case "weapon": return "⚔️";
    default:       return "📦";
  }
}

// ─── Spawn position helper ────────────────────────────────────────────────────

/**
 * Attempts to find a valid landing position near the player.
 *
 * @param playerX       Current player X.
 * @param playerZ       Current player Z.
 * @param getHeight     Terrain height sampler.
 * @param waterLevel    Water surface Y — positions at or below this are skipped.
 * @param landMargin    Additional height above waterLevel required for land.
 * @param rng           RNG function (injectable for testing).
 * @returns             `{x, z, terrainY}` or null if no valid position found.
 */
export function findAirdropLandingPosition(
  playerX: number,
  playerZ: number,
  getHeight: (x: number, z: number) => number,
  waterLevel: number,
  landMargin: number,
  rng: () => number = Math.random,
): { x: number; z: number; terrainY: number } | null {
  const minDist = AIRDROP_SPAWN_DIST_MIN;
  const maxDist = AIRDROP_SPAWN_DIST_MAX;
  const threshold = waterLevel + landMargin;

  for (let attempt = 0; attempt < AIRDROP_SPAWN_ATTEMPTS; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist  = minDist + rng() * (maxDist - minDist);
    const x     = playerX + Math.cos(angle) * dist;
    const z     = playerZ + Math.sin(angle) * dist;
    const h     = getHeight(x, z);

    if (h >= threshold) {
      return { x, z, terrainY: h };
    }
  }

  return null; // no valid position found (e.g. player is in the middle of the ocean)
}
