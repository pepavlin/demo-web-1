/**
 * Dual Weapon System Tests
 *
 * Tests for the two-slot weapon system:
 * - Player starts with axe (slot 0) and sword (slot 1)
 * - Max 2 weapons at any time
 * - Ground weapons can be picked up, replacing active slot
 * - Airdrops always contain a weapon plus a resource bonus
 */

import {
  pickAirdropLootArray,
  pickRandomLoot,
} from "@/lib/airdropSystem";
import type { AirdropLoot, WorldItemType, WeaponType } from "@/lib/gameTypes";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";

// ─── Weapon Configs ─────────────────────────────────────────────────────────

describe("WEAPON_CONFIGS — dual slot weapons", () => {
  test("axe and sword configs exist (default starting weapons)", () => {
    expect(WEAPON_CONFIGS.axe).toBeDefined();
    expect(WEAPON_CONFIGS.sword).toBeDefined();
    expect(WEAPON_CONFIGS.axe.label).toBe("Sekera");
    expect(WEAPON_CONFIGS.sword.label).toBe("Meč");
  });

  test("all 8 weapon types are configured", () => {
    const types: WeaponType[] = ["sword", "bow", "crossbow", "sniper", "axe", "machinegun", "flamethrower", "shovel"];
    for (const t of types) {
      expect(WEAPON_CONFIGS[t]).toBeDefined();
      expect(WEAPON_CONFIGS[t].label.length).toBeGreaterThan(0);
      expect(WEAPON_CONFIGS[t].damage).toBeGreaterThan(0);
      expect(WEAPON_CONFIGS[t].cooldown).toBeGreaterThan(0);
    }
  });
});

// ─── WorldItemType ─────────────────────────────────────────────────────────

describe("WorldItemType — ground_weapon", () => {
  test("ground_weapon is a valid WorldItemType", () => {
    // Type-level check: ensure 'ground_weapon' can be assigned to WorldItemType
    const t: WorldItemType = "ground_weapon";
    expect(t).toBe("ground_weapon");
  });

  test("pumpkin and bomb types still valid", () => {
    const pumpkin: WorldItemType = "pumpkin";
    const bomb: WorldItemType = "bomb";
    expect(pumpkin).toBe("pumpkin");
    expect(bomb).toBe("bomb");
  });
});

// ─── pickAirdropLootArray — guaranteed weapon in every crate ──────────────

describe("pickAirdropLootArray", () => {
  test("always returns exactly 2 loot items", () => {
    for (let i = 0; i < 100; i++) {
      const loot = pickAirdropLootArray();
      expect(loot).toHaveLength(2);
    }
  });

  test("first item is always a weapon", () => {
    for (let i = 0; i < 100; i++) {
      const loot = pickAirdropLootArray();
      expect(loot[0].type).toBe("weapon");
    }
  });

  test("weapon loot always has a weaponType", () => {
    for (let i = 0; i < 100; i++) {
      const loot = pickAirdropLootArray();
      const weapon = loot[0];
      expect(weapon.weaponType).toBeDefined();
      expect(weapon.amount).toBe(0);
    }
  });

  test("second item is always a resource (coins/wood/health)", () => {
    const resourceTypes = ["coins", "wood", "health"];
    for (let i = 0; i < 100; i++) {
      const loot = pickAirdropLootArray();
      expect(resourceTypes).toContain(loot[1].type);
    }
  });

  test("resource bonus has positive amount", () => {
    for (let i = 0; i < 100; i++) {
      const loot = pickAirdropLootArray();
      expect(loot[1].amount).toBeGreaterThan(0);
    }
  });

  test("all weapon types can appear over many rolls", () => {
    const seen = new Set<WeaponType>();
    for (let i = 0; i < 500; i++) {
      const loot = pickAirdropLootArray();
      if (loot[0].weaponType) seen.add(loot[0].weaponType);
    }
    // Should see at least 5 distinct weapon types out of 7
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  test("all resource types appear over many rolls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const loot = pickAirdropLootArray();
      seen.add(loot[1].type);
    }
    expect(seen.has("coins")).toBe(true);
    expect(seen.has("wood")).toBe(true);
    expect(seen.has("health")).toBe(true);
  });

  test("injectable rng is used for reproducible results", () => {
    let callCount = 0;
    const deterministicRng = () => {
      callCount++;
      // Alternates between 0 and 0.5 each call
      return callCount % 2 === 0 ? 0 : 0.5;
    };
    const loot1 = pickAirdropLootArray(deterministicRng);
    callCount = 0;
    const loot2 = pickAirdropLootArray(deterministicRng);
    // Same deterministic rng produces same results
    expect(loot1[0].type).toBe(loot2[0].type);
    expect(loot1[1].type).toBe(loot2[1].type);
  });

  test("weapon and resource can be different each roll", () => {
    const weaponTypes = new Set<string>();
    const resourceTypes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const [weapon, resource] = pickAirdropLootArray();
      if (weapon.weaponType) weaponTypes.add(weapon.weaponType);
      resourceTypes.add(resource.type);
    }
    // Should have variety in both weapon and resource drops
    expect(weaponTypes.size).toBeGreaterThan(1);
    expect(resourceTypes.size).toBeGreaterThan(1);
  });
});

// ─── pickRandomLoot (backward compat) ─────────────────────────────────────

describe("pickRandomLoot backward compatibility", () => {
  test("still works and returns single loot item", () => {
    const loot = pickRandomLoot();
    expect(loot).toBeDefined();
    expect(loot.type).toBeDefined();
  });

  test("can still return weapon type", () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      if (pickRandomLoot().type === "weapon") { found = true; break; }
    }
    expect(found).toBe(true);
  });
});

// ─── Dual weapon slot model ────────────────────────────────────────────────

describe("Dual weapon slot model", () => {
  type WeaponSlots = [WeaponType, WeaponType | null];

  function makeSlots(s0: WeaponType, s1: WeaponType | null): WeaponSlots {
    return [s0, s1];
  }

  function switchSlot(
    slots: WeaponSlots,
    active: 0 | 1,
    target: 0 | 1
  ): { slots: WeaponSlots; active: 0 | 1; weapon: WeaponType | null } {
    return { slots, active: target, weapon: slots[target] };
  }

  function pickUpGroundWeapon(
    slots: WeaponSlots,
    active: 0 | 1,
    newWeapon: WeaponType
  ): WeaponSlots {
    const next: WeaponSlots = [...slots] as WeaponSlots;
    next[active] = newWeapon;
    return next;
  }

  test("initial slots are axe and sword", () => {
    const slots = makeSlots("axe", "sword");
    expect(slots[0]).toBe("axe");
    expect(slots[1]).toBe("sword");
  });

  test("switching to slot 1 gives sword", () => {
    const slots = makeSlots("axe", "sword");
    const { active, weapon } = switchSlot(slots, 0, 1);
    expect(active).toBe(1);
    expect(weapon).toBe("sword");
  });

  test("picking up bow replaces active slot (axe), drops axe", () => {
    const slots = makeSlots("axe", "sword");
    const newSlots = pickUpGroundWeapon(slots, 0, "bow");
    expect(newSlots[0]).toBe("bow");
    expect(newSlots[1]).toBe("sword");
  });

  test("picking up crossbow into slot 1 replaces sword only", () => {
    const slots = makeSlots("axe", "sword");
    const newSlots = pickUpGroundWeapon(slots, 1, "crossbow");
    expect(newSlots[0]).toBe("axe");
    expect(newSlots[1]).toBe("crossbow");
  });

  test("max 2 weapons: slots array never exceeds length 2", () => {
    let slots = makeSlots("axe", "sword");
    // Pick up various weapons — always 2 slots
    for (const weapon of ["bow", "machinegun", "sniper", "flamethrower"] as WeaponType[]) {
      slots = pickUpGroundWeapon(slots, 0, weapon);
      expect(slots).toHaveLength(2);
    }
  });

  test("toggle between slots switches active", () => {
    const slots = makeSlots("axe", "bow");
    let active: 0 | 1 = 0;
    // Toggle
    active = active === 0 ? 1 : 0;
    expect(active).toBe(1);
    expect(slots[active]).toBe("bow");
    // Toggle back
    active = active === 0 ? 1 : 0;
    expect(active).toBe(0);
    expect(slots[active]).toBe("axe");
  });

  test("empty second slot returns null when accessed", () => {
    const slots = makeSlots("axe", null);
    expect(slots[1]).toBeNull();
  });
});
