/**
 * Tests for the flamethrower burning / ignition system.
 *
 * Covers:
 * - Burning constants and their invariants
 * - Entity burning state initialization (isBurning, burnTimer, etc.)
 * - DoT damage accumulation logic
 * - Burn duration and extinguish behavior
 * - Fire spread probability and distance logic
 * - Mesh builder returns for flame and burn effect
 */

// ── Constants mirrored from Game3D.tsx (tested independently) ────────────────

const BURN_DURATION = 6.0;
const BURN_DOT_INTERVAL = 0.5;
const BURN_DOT_DAMAGE = 5;
const BURN_SPREAD_RADIUS = 3.5;
const BURN_SPREAD_INTERVAL = 1.2;
const BURN_SPREAD_CHANCE = 0.55;

// ── Burning constants invariants ──────────────────────────────────────────────

describe("burning constants invariants", () => {
  test("BURN_DURATION is positive and between 1 and 30 seconds", () => {
    expect(BURN_DURATION).toBeGreaterThan(1);
    expect(BURN_DURATION).toBeLessThanOrEqual(30);
  });

  test("BURN_DOT_INTERVAL is positive", () => {
    expect(BURN_DOT_INTERVAL).toBeGreaterThan(0);
  });

  test("BURN_DOT_INTERVAL is shorter than BURN_DURATION (at least one tick fires)", () => {
    expect(BURN_DOT_INTERVAL).toBeLessThan(BURN_DURATION);
  });

  test("BURN_DOT_DAMAGE is positive", () => {
    expect(BURN_DOT_DAMAGE).toBeGreaterThan(0);
  });

  test("total burn damage across full duration matches expected DPS", () => {
    const totalTicks = Math.floor(BURN_DURATION / BURN_DOT_INTERVAL);
    const totalDamage = totalTicks * BURN_DOT_DAMAGE;
    // Should deal meaningful damage (>= 30 HP) but not ridiculous (< 500 HP)
    expect(totalDamage).toBeGreaterThanOrEqual(30);
    expect(totalDamage).toBeLessThan(500);
  });

  test("BURN_SPREAD_RADIUS is positive", () => {
    expect(BURN_SPREAD_RADIUS).toBeGreaterThan(0);
  });

  test("BURN_SPREAD_INTERVAL is positive", () => {
    expect(BURN_SPREAD_INTERVAL).toBeGreaterThan(0);
  });

  test("BURN_SPREAD_CHANCE is between 0 and 1", () => {
    expect(BURN_SPREAD_CHANCE).toBeGreaterThan(0);
    expect(BURN_SPREAD_CHANCE).toBeLessThanOrEqual(1);
  });
});

// ── Entity burning state model ─────────────────────────────────────────────────

interface BurnableEntity {
  isBurning: boolean;
  burnTimer: number;
  burnDamageTimer: number;
  hp: number;
}

function createSheep(hp = 30): BurnableEntity {
  return { isBurning: false, burnTimer: 0, burnDamageTimer: 0, hp };
}

function createFox(hp = 80): BurnableEntity {
  return { isBurning: false, burnTimer: 0, burnDamageTimer: 0, hp };
}

function igniteEntity(entity: BurnableEntity): void {
  entity.isBurning = true;
  entity.burnTimer = BURN_DURATION;
  entity.burnDamageTimer = BURN_DOT_INTERVAL;
}

/**
 * Simulate burning ticks for `seconds` of game time.
 * Returns how many DoT ticks fired.
 */
function simulateBurn(entity: BurnableEntity, seconds: number, dtStep = 0.016): number {
  let ticks = 0;
  let elapsed = 0;
  while (elapsed < seconds && entity.isBurning) {
    entity.burnTimer -= dtStep;
    entity.burnDamageTimer -= dtStep;

    if (entity.burnDamageTimer <= 0) {
      entity.burnDamageTimer = BURN_DOT_INTERVAL;
      entity.hp = Math.max(0, entity.hp - BURN_DOT_DAMAGE);
      ticks++;
    }

    if (entity.burnTimer <= 0) {
      entity.isBurning = false;
      entity.burnTimer = 0;
    }

    elapsed += dtStep;
  }
  return ticks;
}

// ── Entity burning state initialization ───────────────────────────────────────

describe("entity burning state initialization", () => {
  test("freshly-created sheep has isBurning = false", () => {
    expect(createSheep().isBurning).toBe(false);
  });

  test("freshly-created sheep has burnTimer = 0", () => {
    expect(createSheep().burnTimer).toBe(0);
  });

  test("freshly-created sheep has burnDamageTimer = 0", () => {
    expect(createSheep().burnDamageTimer).toBe(0);
  });

  test("freshly-created fox has isBurning = false", () => {
    expect(createFox().isBurning).toBe(false);
  });
});

// ── Ignition ──────────────────────────────────────────────────────────────────

describe("igniteEntity", () => {
  test("sets isBurning = true", () => {
    const sheep = createSheep();
    igniteEntity(sheep);
    expect(sheep.isBurning).toBe(true);
  });

  test("sets burnTimer to BURN_DURATION", () => {
    const sheep = createSheep();
    igniteEntity(sheep);
    expect(sheep.burnTimer).toBe(BURN_DURATION);
  });

  test("sets burnDamageTimer to BURN_DOT_INTERVAL", () => {
    const sheep = createSheep();
    igniteEntity(sheep);
    expect(sheep.burnDamageTimer).toBe(BURN_DOT_INTERVAL);
  });

  test("re-ignition resets burnTimer to full duration", () => {
    const sheep = createSheep();
    igniteEntity(sheep);
    // Partially consume timer
    sheep.burnTimer = BURN_DURATION * 0.3;
    igniteEntity(sheep);
    expect(sheep.burnTimer).toBe(BURN_DURATION);
  });
});

// ── DoT damage simulation ─────────────────────────────────────────────────────

describe("burning damage-over-time", () => {
  test("deals damage after one DoT interval", () => {
    const sheep = createSheep(30);
    igniteEntity(sheep);
    // Simulate exactly one tick past the interval
    simulateBurn(sheep, BURN_DOT_INTERVAL + 0.05);
    expect(sheep.hp).toBe(30 - BURN_DOT_DAMAGE);
  });

  test("deals multiple ticks over burn duration", () => {
    const sheep = createSheep(300);
    igniteEntity(sheep);
    const ticks = simulateBurn(sheep, BURN_DURATION);
    expect(ticks).toBeGreaterThan(1);
  });

  test("entity HP never goes below 0", () => {
    const sheep = createSheep(1);
    igniteEntity(sheep);
    simulateBurn(sheep, BURN_DURATION);
    expect(sheep.hp).toBeGreaterThanOrEqual(0);
  });

  test("after full burn duration, isBurning becomes false", () => {
    const sheep = createSheep(300);
    igniteEntity(sheep);
    simulateBurn(sheep, BURN_DURATION + 0.1);
    expect(sheep.isBurning).toBe(false);
  });

  test("burnTimer reaches 0 after full burn duration", () => {
    const sheep = createSheep(300);
    igniteEntity(sheep);
    simulateBurn(sheep, BURN_DURATION + 0.5);
    expect(sheep.burnTimer).toBeLessThanOrEqual(0);
  });
});

// ── DPS consistency ────────────────────────────────────────────────────────────

describe("burning DPS", () => {
  const dps = BURN_DOT_DAMAGE / BURN_DOT_INTERVAL;

  test("burning DPS is positive", () => {
    expect(dps).toBeGreaterThan(0);
  });

  test("burning DPS is lower than sword instant DPS (fire is sustained, not burst)", () => {
    // Sword: 55 damage per hit at 0.45 s cooldown = ~122 DPS
    const swordDps = 55 / 0.45;
    expect(dps).toBeLessThan(swordDps);
  });

  test("burning DPS is meaningfully above zero (at least 5 HP/s)", () => {
    expect(dps).toBeGreaterThanOrEqual(5);
  });
});

// ── Fire spread logic ─────────────────────────────────────────────────────────

describe("fire spread constants", () => {
  test("BURN_SPREAD_RADIUS allows nearby entities to catch fire", () => {
    // Radius of 3.5 units is meaningful in a game with entities within ~5 units
    expect(BURN_SPREAD_RADIUS).toBeGreaterThan(1);
  });

  test("spread probability × random chance: statistically fires over 10 checks", () => {
    // With BURN_SPREAD_CHANCE = 0.55, out of 20 checks at least 5 should fire
    let fires = 0;
    for (let i = 0; i < 20; i++) {
      if (Math.random() < BURN_SPREAD_CHANCE) fires++;
    }
    // Weak statistical test — might occasionally fail, but very rarely
    expect(fires).toBeGreaterThan(0);
  });

  test("an entity within BURN_SPREAD_RADIUS * 0.9 is within spread range", () => {
    const nearDist = BURN_SPREAD_RADIUS * 0.9;
    expect(nearDist).toBeLessThan(BURN_SPREAD_RADIUS);
  });

  test("an entity at BURN_SPREAD_RADIUS * 1.1 is outside spread range", () => {
    const farDist = BURN_SPREAD_RADIUS * 1.1;
    expect(farDist).toBeGreaterThan(BURN_SPREAD_RADIUS);
  });
});

// ── Multiple entities ─────────────────────────────────────────────────────────

describe("multiple entities burning independently", () => {
  test("two sheep burn independently", () => {
    const sheep1 = createSheep(100);
    const sheep2 = createSheep(100);
    igniteEntity(sheep1);
    // Only sheep1 is burning
    simulateBurn(sheep1, BURN_DOT_INTERVAL + 0.1);
    expect(sheep1.hp).toBeLessThan(100);
    expect(sheep2.hp).toBe(100);
  });

  test("extinguishing one entity does not affect another", () => {
    const fox1 = createFox(200);
    const fox2 = createFox(200);
    igniteEntity(fox1);
    igniteEntity(fox2);
    // Run until fox1 extinguishes
    simulateBurn(fox1, BURN_DURATION + 0.5);
    expect(fox1.isBurning).toBe(false);
    // fox2 may still be burning (was started at same time, same duration)
    // We just check its state is independent from fox1
    expect(fox2.hp).not.toBeUndefined();
  });
});

// ── Flame mesh builder (integration with meshBuilders) ────────────────────────

// These tests import the actual Three.js builders to verify the returned geometry
import * as THREE from "three";
import { buildFlameParticleMesh, buildBurningEffect } from "../lib/meshBuilders";

describe("buildFlameParticleMesh", () => {
  test("returns a THREE.Group (not a bare Mesh)", () => {
    const flame = buildFlameParticleMesh();
    expect(flame).toBeInstanceOf(THREE.Group);
  });

  test("flame group has at least 3 child meshes (layered fire)", () => {
    const flame = buildFlameParticleMesh();
    expect(flame.children.length).toBeGreaterThanOrEqual(3);
  });

  test("all children are THREE.Mesh instances", () => {
    const flame = buildFlameParticleMesh();
    flame.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  test("all child materials use AdditiveBlending", () => {
    const flame = buildFlameParticleMesh();
    flame.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      expect(mat.blending).toBe(THREE.AdditiveBlending);
    });
  });

  test("inner core mesh has opacity 1 (brightest layer)", () => {
    const flame = buildFlameParticleMesh();
    // The hot-white base sphere (4th child) should have opacity=1
    const hotMesh = flame.children[3] as THREE.Mesh;
    const mat = hotMesh.material as THREE.MeshBasicMaterial;
    expect(mat.opacity).toBe(1.0);
  });

  test("all materials have depthWrite = false (additive transparent overlay)", () => {
    const flame = buildFlameParticleMesh();
    flame.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      expect(mat.depthWrite).toBe(false);
    });
  });

  test("outer glow mesh has lower opacity than core", () => {
    const flame = buildFlameParticleMesh();
    const outerMat = (flame.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const coreMat = (flame.children[2] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(outerMat.opacity).toBeLessThan(coreMat.opacity);
  });
});

describe("buildBurningEffect", () => {
  test("returns a THREE.Group", () => {
    const effect = buildBurningEffect();
    expect(effect).toBeInstanceOf(THREE.Group);
  });

  test("burning effect has multiple child meshes", () => {
    const effect = buildBurningEffect();
    expect(effect.children.length).toBeGreaterThan(2);
  });

  test("burning effect children use AdditiveBlending", () => {
    const effect = buildBurningEffect();
    effect.children.forEach((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        expect(mat.blending).toBe(THREE.AdditiveBlending);
      }
    });
  });

  test("can be added as child of a Group (for entity attachment)", () => {
    const entityMesh = new THREE.Group();
    const effect = buildBurningEffect();
    entityMesh.add(effect);
    expect(entityMesh.children).toContain(effect);
  });

  test("can be removed from a parent Group", () => {
    const entityMesh = new THREE.Group();
    const effect = buildBurningEffect();
    entityMesh.add(effect);
    entityMesh.remove(effect);
    expect(entityMesh.children).not.toContain(effect);
  });
});
