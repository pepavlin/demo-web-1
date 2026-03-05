/**
 * Tests for spider cave system:
 * - SPIDER_TYPE_CONFIGS structure and values
 * - SpiderData interface fields
 * - TreasureChestData interface fields
 * - CaveTorchData interface fields
 * - Spider combat balance (large > medium > small)
 */

import type { SpiderData, TreasureChestData, CaveTorchData } from "@/lib/gameTypes";
import { SPIDER_TYPE_CONFIGS, type SpiderType } from "@/lib/gameTypes";
import * as THREE from "three";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeSpiderData(type: SpiderType = "small", overrides: Partial<SpiderData> = {}): SpiderData {
  const cfg = SPIDER_TYPE_CONFIGS[type];
  return {
    mesh: new THREE.Group(),
    type,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    isAlive: true,
    attackCooldown: 0,
    hitFlashTimer: 0,
    wanderTimer: 0,
    wanderAngle: 0,
    caveX: -95,
    caveZ: -85,
    ...overrides,
  };
}

// ─── SPIDER_TYPE_CONFIGS tests ─────────────────────────────────────────────────

describe("SPIDER_TYPE_CONFIGS", () => {
  const types: SpiderType[] = ["small", "medium", "large"];

  it("has all three size tiers defined", () => {
    types.forEach((t) => {
      expect(SPIDER_TYPE_CONFIGS[t]).toBeDefined();
    });
  });

  it("each config has required fields with positive values", () => {
    types.forEach((t) => {
      const cfg = SPIDER_TYPE_CONFIGS[t];
      expect(cfg.maxHp).toBeGreaterThan(0);
      expect(cfg.attackDamage).toBeGreaterThan(0);
      expect(cfg.speed).toBeGreaterThan(0);
      expect(cfg.attackRange).toBeGreaterThan(0);
      expect(cfg.attackCooldown).toBeGreaterThan(0);
      expect(cfg.scale).toBeGreaterThan(0);
      expect(typeof cfg.label).toBe("string");
      expect(cfg.label.length).toBeGreaterThan(0);
    });
  });

  it("large spider is more dangerous than medium (more HP and damage)", () => {
    const large = SPIDER_TYPE_CONFIGS.large;
    const medium = SPIDER_TYPE_CONFIGS.medium;
    expect(large.maxHp).toBeGreaterThan(medium.maxHp);
    expect(large.attackDamage).toBeGreaterThan(medium.attackDamage);
  });

  it("medium spider is more dangerous than small (more HP and damage)", () => {
    const medium = SPIDER_TYPE_CONFIGS.medium;
    const small = SPIDER_TYPE_CONFIGS.small;
    expect(medium.maxHp).toBeGreaterThan(small.maxHp);
    expect(medium.attackDamage).toBeGreaterThan(small.attackDamage);
  });

  it("large spider is bigger in scale than medium", () => {
    expect(SPIDER_TYPE_CONFIGS.large.scale).toBeGreaterThan(SPIDER_TYPE_CONFIGS.medium.scale);
  });

  it("medium spider is bigger in scale than small", () => {
    expect(SPIDER_TYPE_CONFIGS.medium.scale).toBeGreaterThan(SPIDER_TYPE_CONFIGS.small.scale);
  });

  it("small spider is fastest (higher base speed)", () => {
    const small = SPIDER_TYPE_CONFIGS.small;
    const large = SPIDER_TYPE_CONFIGS.large;
    expect(small.speed).toBeGreaterThan(large.speed);
  });

  it("small spider HP is exactly 20", () => {
    expect(SPIDER_TYPE_CONFIGS.small.maxHp).toBe(20);
  });

  it("medium spider HP is exactly 50", () => {
    expect(SPIDER_TYPE_CONFIGS.medium.maxHp).toBe(50);
  });

  it("large spider HP is exactly 100", () => {
    expect(SPIDER_TYPE_CONFIGS.large.maxHp).toBe(100);
  });
});

// ─── SpiderData interface tests ────────────────────────────────────────────────

describe("SpiderData", () => {
  it("is created with correct initial values for small spider", () => {
    const spider = makeSpiderData("small");
    expect(spider.type).toBe("small");
    expect(spider.hp).toBe(SPIDER_TYPE_CONFIGS.small.maxHp);
    expect(spider.maxHp).toBe(SPIDER_TYPE_CONFIGS.small.maxHp);
    expect(spider.isAlive).toBe(true);
    expect(spider.hitFlashTimer).toBe(0);
    expect(spider.attackCooldown).toBeGreaterThanOrEqual(0);
  });

  it("hp decreases when taking damage", () => {
    const spider = makeSpiderData("medium");
    const damage = 15;
    spider.hp = Math.max(0, spider.hp - damage);
    expect(spider.hp).toBe(SPIDER_TYPE_CONFIGS.medium.maxHp - damage);
  });

  it("hp cannot go below 0", () => {
    const spider = makeSpiderData("small");
    spider.hp = Math.max(0, spider.hp - 9999);
    expect(spider.hp).toBe(0);
  });

  it("spider dies when hp reaches 0", () => {
    const spider = makeSpiderData("small");
    spider.hp = 0;
    spider.isAlive = false;
    expect(spider.isAlive).toBe(false);
  });

  it("caveX and caveZ store the home territory position", () => {
    const spider = makeSpiderData("large");
    expect(spider.caveX).toBe(-95);
    expect(spider.caveZ).toBe(-85);
  });

  it("all three types can be instantiated as SpiderData", () => {
    const types: SpiderType[] = ["small", "medium", "large"];
    types.forEach((type) => {
      const spider = makeSpiderData(type);
      expect(spider.type).toBe(type);
      expect(spider.maxHp).toBe(SPIDER_TYPE_CONFIGS[type].maxHp);
    });
  });
});

// ─── TreasureChestData interface tests ────────────────────────────────────────

describe("TreasureChestData", () => {
  function makeChestData(overrides: Partial<TreasureChestData> = {}): TreasureChestData {
    return {
      mesh: new THREE.Group(),
      lidGroup: new THREE.Group(),
      isOpened: false,
      x: -95,
      z: -85,
      rewardCoins: 20,
      ...overrides,
    };
  }

  it("starts in closed state", () => {
    const chest = makeChestData();
    expect(chest.isOpened).toBe(false);
  });

  it("can be opened by setting isOpened to true", () => {
    const chest = makeChestData();
    chest.isOpened = true;
    expect(chest.isOpened).toBe(true);
  });

  it("has rewardCoins set to 20 by default", () => {
    const chest = makeChestData();
    expect(chest.rewardCoins).toBe(20);
  });

  it("lidGroup rotation can be set for open animation", () => {
    const chest = makeChestData();
    chest.lidGroup.rotation.x = -Math.PI * 0.75;
    expect(chest.lidGroup.rotation.x).toBeCloseTo(-Math.PI * 0.75);
  });
});

// ─── CaveTorchData interface tests ────────────────────────────────────────────

describe("CaveTorchData", () => {
  function makeTorchData(overrides: Partial<CaveTorchData> = {}): CaveTorchData {
    const light = new THREE.PointLight(0xff8822, 1.4, 12);
    return {
      mesh: new THREE.Group(),
      light,
      baseIntensity: 1.4,
      flickerTimer: 0,
      ...overrides,
    };
  }

  it("has a PointLight with warm orange colour", () => {
    const torch = makeTorchData();
    expect(torch.light).toBeInstanceOf(THREE.PointLight);
    // Warm orange: red > green > blue
    expect(torch.light.color.r).toBeGreaterThan(torch.light.color.b);
  });

  it("flickerTimer can be incremented for animation", () => {
    const torch = makeTorchData();
    torch.flickerTimer += 0.016;
    expect(torch.flickerTimer).toBeCloseTo(0.016);
  });

  it("light intensity can be modulated for flicker effect", () => {
    const torch = makeTorchData();
    const flicker = Math.sin(torch.flickerTimer * 3.7) * 0.18;
    torch.light.intensity = torch.baseIntensity + flicker;
    expect(torch.light.intensity).toBeGreaterThan(0);
  });
});
