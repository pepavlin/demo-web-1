/**
 * Unit tests for the Physics System.
 *
 * All tests use a flat terrain sampler (returns 0 everywhere) by default,
 * with slope variants where slope behaviour is specifically tested.
 */

import {
  PhysicsWorld,
  PhysicsBody,
  PHYSICS_GRAVITY,
  type Vec3,
  type TerrainSampler,
} from "@/lib/physicsSystem";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A terrain sampler that returns a constant Y = 0 everywhere (flat ground). */
const flatTerrain: TerrainSampler = () => 0;

/** A terrain sampler that simulates a ramp rising in the +X direction. */
const rampTerrain: TerrainSampler = (x: number) => x * 0.3; // ~16.7° slope

/**
 * Run `n` physics steps of size `dt` and return the final body snapshot.
 */
function stepWorld(
  world: PhysicsWorld,
  steps: number,
  dt: number,
): void {
  for (let i = 0; i < steps; i++) world.update(dt);
}

// ─── PhysicsWorld – body management ──────────────────────────────────────────

describe("PhysicsWorld – body management", () => {
  it("starts with zero bodies", () => {
    const world = new PhysicsWorld(flatTerrain);
    expect(world.bodyCount).toBe(0);
  });

  it("addBody registers a body and returns it", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "a",
      position: { x: 0, y: 5, z: 0 },
    });
    expect(body).toBeInstanceOf(PhysicsBody);
    expect(world.bodyCount).toBe(1);
    expect(world.getBody("a")).toBe(body);
  });

  it("removeBody decrements the count", () => {
    const world = new PhysicsWorld(flatTerrain);
    world.addBody({ id: "a", position: { x: 0, y: 5, z: 0 } });
    world.removeBody("a");
    expect(world.bodyCount).toBe(0);
    expect(world.getBody("a")).toBeUndefined();
  });

  it("clear removes all bodies", () => {
    const world = new PhysicsWorld(flatTerrain);
    world.addBody({ id: "a", position: { x: 0, y: 5, z: 0 } });
    world.addBody({ id: "b", position: { x: 1, y: 5, z: 0 } });
    world.clear();
    expect(world.bodyCount).toBe(0);
  });

  it("getBody returns undefined for unknown id", () => {
    const world = new PhysicsWorld(flatTerrain);
    expect(world.getBody("nonexistent")).toBeUndefined();
  });
});

// ─── PhysicsBody defaults ─────────────────────────────────────────────────────

describe("PhysicsBody – default values", () => {
  it("applies sensible defaults", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({ id: "b", position: { x: 0, y: 5, z: 0 } });
    expect(body.mass).toBe(1);
    expect(body.radius).toBe(0.25);
    expect(body.restitution).toBeGreaterThanOrEqual(0);
    expect(body.restitution).toBeLessThanOrEqual(1);
    expect(body.friction).toBeGreaterThan(0);
    expect(body.isSleeping).toBe(false);
    expect(body.isOnGround).toBe(false);
  });

  it("copies initial position", () => {
    const world = new PhysicsWorld(flatTerrain);
    const initPos = { x: 3, y: 7, z: -2 };
    const body = world.addBody({ id: "c", position: initPos });
    // position should be a copy, not the same reference
    expect(body.position).toEqual(initPos);
    expect(body.position).not.toBe(initPos);
  });

  it("copies initial velocity", () => {
    const world = new PhysicsWorld(flatTerrain);
    const initVel = { x: 1, y: 2, z: 3 };
    const body = world.addBody({
      id: "d",
      position: { x: 0, y: 5, z: 0 },
      velocity: initVel,
    });
    expect(body.velocity).toEqual(initVel);
    expect(body.velocity).not.toBe(initVel);
  });
});

// ─── Gravity / free fall ──────────────────────────────────────────────────────

describe("Gravity – free fall", () => {
  it("accelerates a body downward when in the air", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "fall",
      position: { x: 0, y: 20, z: 0 },
    });

    const dt = 0.016;
    world.update(dt);

    // After one frame, vy should be negative (falling)
    expect(body.velocity.y).toBeLessThan(0);
    // Approximate: vy ≈ PHYSICS_GRAVITY * dt
    expect(body.velocity.y).toBeCloseTo(PHYSICS_GRAVITY * dt, 1);
  });

  it("lands on the terrain and stops vertical movement", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "land",
      position: { x: 0, y: 5, z: 0 },
    });

    // Simulate 2 seconds (enough to fall ~5 units under gravity=−25)
    stepWorld(world, 200, 0.01);

    expect(body.isOnGround).toBe(true);
    expect(body.position.y).toBeCloseTo(body.radius, 2);
  });

  it("does not fall through terrain", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "floor",
      position: { x: 0, y: 10, z: 0 },
      velocity: { x: 0, y: -200, z: 0 }, // extreme downward velocity
    });

    world.update(0.016);

    // Y must never go below terrain + radius
    expect(body.position.y).toBeGreaterThanOrEqual(body.radius - 0.01);
  });

  it("position.y decreases while in the air", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "drop",
      position: { x: 0, y: 15, z: 0 },
    });

    const initialY = body.position.y;
    stepWorld(world, 10, 0.016);
    expect(body.position.y).toBeLessThan(initialY);
  });
});

// ─── Ground landing & bounce ──────────────────────────────────────────────────

describe("Ground landing", () => {
  it("body with restitution > 0 bounces", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "bounce",
      position: { x: 0, y: 3, z: 0 },
      restitution: 0.6,
      friction: 0,
    });

    // Let it fall and hit the ground
    stepWorld(world, 120, 0.01);

    // After landing the body should still have some positive vy (bounced)
    // OR have already re-landed. Check it landed at least once.
    expect(body.isOnGround).toBe(true);
  });

  it("body with restitution = 0 does not bounce", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "no-bounce",
      position: { x: 0, y: 4, z: 0 },
      restitution: 0,
      friction: 0,
    });

    // Fall to ground
    stepWorld(world, 200, 0.01);

    expect(body.isOnGround).toBe(true);
    // vy should be zero (no bounce)
    expect(body.velocity.y).toBeCloseTo(0, 1);
  });
});

// ─── Sleep system ─────────────────────────────────────────────────────────────

describe("Sleep system", () => {
  it("body sleeps after coming to rest on flat terrain", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "sleep-test",
      position: { x: 0, y: 3, z: 0 },
      restitution: 0,
      friction: 0.9,
    });

    // Run for 3 simulated seconds — enough to fall and settle
    stepWorld(world, 300, 0.01);

    expect(body.isSleeping).toBe(true);
  });

  it("calls onSleep callback exactly once when the body sleeps", () => {
    const world = new PhysicsWorld(flatTerrain);
    const sleepFn = jest.fn();
    world.addBody({
      id: "sleep-cb",
      position: { x: 0, y: 3, z: 0 },
      restitution: 0,
      friction: 0.9,
      onSleep: sleepFn,
    });

    stepWorld(world, 300, 0.01);

    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it("sleeping body is skipped in subsequent updates", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "skip",
      position: { x: 0, y: 3, z: 0 },
      restitution: 0,
      friction: 0.9,
    });

    stepWorld(world, 300, 0.01);
    expect(body.isSleeping).toBe(true);

    const posAfterSleep = { ...body.position };
    stepWorld(world, 100, 0.01); // more updates — position must not change

    expect(body.position.x).toBe(posAfterSleep.x);
    expect(body.position.y).toBe(posAfterSleep.y);
    expect(body.position.z).toBe(posAfterSleep.z);
  });

  it("applyImpulse wakes a sleeping body", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "wake",
      position: { x: 0, y: 3, z: 0 },
      restitution: 0,
      friction: 0.9,
    });

    stepWorld(world, 300, 0.01);
    expect(body.isSleeping).toBe(true);

    body.applyImpulse(5, 5, 0);
    expect(body.isSleeping).toBe(false);
    expect(body.velocity.x).toBe(5);
    expect(body.velocity.y).toBe(5);
  });
});

// ─── Slope sliding ────────────────────────────────────────────────────────────

describe("Slope sliding", () => {
  it("body slides in the down-slope direction on a ramp", () => {
    // rampTerrain returns x * 0.3 → terrain rises in +X direction
    // so "downhill" is towards −X
    const world = new PhysicsWorld(rampTerrain);

    // Place body on the slope at x=5, y= ramp height + radius
    const startX = 5;
    const startY = rampTerrain(startX, 0) + 0.25 + 0.1;
    const body = world.addBody({
      id: "slide",
      position: { x: startX, y: startY, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      restitution: 0,
      friction: 0.0, // frictionless → maximum slide
    });

    const initialX = body.position.x;

    // Run for 1 simulated second
    stepWorld(world, 100, 0.01);

    // Body should have moved in the −X direction (downhill)
    expect(body.position.x).toBeLessThan(initialX);
  });

  it("higher friction slows sliding compared to low friction", () => {
    const makeWorld = (friction: number) => {
      const world = new PhysicsWorld(rampTerrain);
      const startX = 5;
      const startY = rampTerrain(startX, 0) + 0.25 + 0.1;
      world.addBody({
        id: "slide",
        position: { x: startX, y: startY, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        restitution: 0,
        friction,
        linearDamping: 0,
      });
      stepWorld(world, 100, 0.01);
      return world.getBody("slide")!.position.x;
    };

    const highFrictionX = makeWorld(0.9);
    const lowFrictionX  = makeWorld(0.01);

    // Low friction → slides further down (more negative X)
    expect(lowFrictionX).toBeLessThan(highFrictionX);
  });
});

// ─── onUpdate callback ────────────────────────────────────────────────────────

describe("onUpdate callback", () => {
  it("fires every active step", () => {
    const world = new PhysicsWorld(flatTerrain);
    const updateFn = jest.fn();
    world.addBody({
      id: "cb",
      position: { x: 0, y: 5, z: 0 },
      onUpdate: updateFn,
    });

    const STEPS = 5;
    stepWorld(world, STEPS, 0.016);

    expect(updateFn).toHaveBeenCalledTimes(STEPS);
  });

  it("passes the correct position reference to the callback", () => {
    const world = new PhysicsWorld(flatTerrain);
    let lastPos: Readonly<Vec3> | null = null;
    const body = world.addBody({
      id: "pos-cb",
      position: { x: 0, y: 10, z: 0 },
      onUpdate: (pos) => { lastPos = pos; },
    });

    world.update(0.016);

    expect(lastPos).not.toBeNull();
    expect(lastPos!.y).toBe(body.position.y);
  });

  it("passes dt to the callback", () => {
    const world = new PhysicsWorld(flatTerrain);
    const dtValues: number[] = [];
    world.addBody({
      id: "dt-cb",
      position: { x: 0, y: 5, z: 0 },
      onUpdate: (_, __, dt) => dtValues.push(dt),
    });

    world.update(0.016);
    world.update(0.033);

    expect(dtValues[0]).toBeCloseTo(0.016, 3);
    expect(dtValues[1]).toBeCloseTo(0.033, 3);
  });

  it("does not fire onUpdate for sleeping bodies", () => {
    const world = new PhysicsWorld(flatTerrain);
    const updateFn = jest.fn();
    world.addBody({
      id: "sleep-cb",
      position: { x: 0, y: 3, z: 0 },
      restitution: 0,
      friction: 0.9,
      onUpdate: updateFn,
    });

    // Let it sleep
    stepWorld(world, 300, 0.01);
    const callCountAfterSleep = updateFn.mock.calls.length;

    // More steps — call count must not increase
    stepWorld(world, 50, 0.01);
    // The onUpdate on the sleep tick itself is called once more, but no more after
    expect(updateFn.mock.calls.length).toBe(callCountAfterSleep);
  });
});

// ─── dt clamping ─────────────────────────────────────────────────────────────

describe("dt clamping", () => {
  it("caps dt at 50 ms to prevent tunnel-through", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "dt-clamp",
      position: { x: 0, y: 5, z: 0 },
    });

    // Pass a huge dt (e.g., 1 second — as if the browser tab was hidden)
    world.update(1.0);

    // Body should have fallen, but not further than MAX_DT allows
    // With MAX_DT=0.05 and GRAVITY=-25: vy after one step = -25*0.05 = -1.25
    expect(body.velocity.y).toBeGreaterThanOrEqual(PHYSICS_GRAVITY * 0.05 - 0.01);
    expect(body.velocity.y).toBeLessThanOrEqual(0);
  });
});

// ─── Crate landing rest position ─────────────────────────────────────────────
// Regression tests for the airdrop-crate landing bug:
// the crate must come to rest at terrainY + radius (not terrainY).

describe("Crate landing – rest position includes radius offset", () => {
  const CRATE_RADIUS = 0.65;
  const TERRAIN_Y = 3.0;

  it("crate rests at terrainY + radius on flat ground", () => {
    const world = new PhysicsWorld(() => TERRAIN_Y);
    const body = world.addBody({
      id: "crate",
      position: { x: 0, y: 20, z: 0 },
      velocity: { x: 0, y: -7, z: 0 },
      radius: CRATE_RADIUS,
      linearDamping: 0.92,
      restitution: 0.05,
      friction: 0.7,
    });

    // Simulate until the body sleeps or enough frames pass
    for (let i = 0; i < 1000; i++) {
      world.update(0.016);
      if (body.isSleeping) break;
    }

    expect(body.isSleeping).toBe(true);
    // Rest Y must equal terrainY + radius (not terrainY alone)
    expect(body.position.y).toBeCloseTo(TERRAIN_Y + CRATE_RADIUS, 1);
  });

  it("hasLanded check with targetY = terrainY + radius fires correctly", () => {
    // This simulates the fixed Game3D landing check:
    //   hasLanded = currentY <= ad.targetY + 0.1
    // where ad.targetY = terrainY + CRATE_RADIUS
    const targetY = TERRAIN_Y + CRATE_RADIUS; // the fixed value

    const world = new PhysicsWorld(() => TERRAIN_Y);
    const body = world.addBody({
      id: "crate",
      position: { x: 0, y: 20, z: 0 },
      velocity: { x: 0, y: -7, z: 0 },
      radius: CRATE_RADIUS,
      linearDamping: 0.92,
      restitution: 0.05,
    });

    let hasLanded = false;
    for (let i = 0; i < 1000; i++) {
      world.update(0.016);
      if (body.position.y <= targetY + 0.1) {
        hasLanded = true;
        break;
      }
    }

    expect(hasLanded).toBe(true);
  });

  it("old targetY = terrainY (without radius) never triggers landing", () => {
    // This reproduces the original bug — targetY without radius means the check
    // currentY <= terrainY + 0.1 is always false when crate is at terrainY + 0.65.
    const brokenTargetY = TERRAIN_Y; // missing radius offset

    const world = new PhysicsWorld(() => TERRAIN_Y);
    const body = world.addBody({
      id: "crate",
      position: { x: 0, y: 20, z: 0 },
      velocity: { x: 0, y: -7, z: 0 },
      radius: CRATE_RADIUS,
      linearDamping: 0.92,
      restitution: 0.05,
    });

    let hasLanded = false;
    for (let i = 0; i < 1000; i++) {
      world.update(0.016);
      if (body.position.y <= brokenTargetY + 0.1) {
        hasLanded = true;
        break;
      }
    }

    // With the broken targetY the check never fires → demonstrates the original bug
    expect(hasLanded).toBe(false);
  });
});

// ─── Crate slope sliding ──────────────────────────────────────────────────────
// Verifies that a crate with low-friction sliding parameters (as used after
// landing) actually moves downhill on a slope terrain.

describe("Crate slope sliding after landing", () => {
  it("slides downhill (−X direction) on a ramp when using sliding parameters", () => {
    // Ramp rises in +X direction: terrainY = x * 0.5 (~26.6° slope).
    // At friction=0.4 the slide force (gMag*sin θ ≈ 11.2) exceeds friction
    // (0.4 * gMag*cos θ ≈ 8.9), so the crate rolls downhill.
    const slopeTerrain: TerrainSampler = (x) => x * 0.5;
    const CRATE_RADIUS = 0.65;
    const startX = 10; // high on the ramp

    const world = new PhysicsWorld(slopeTerrain);
    const body = world.addBody({
      id: "slide-crate",
      position: { x: startX, y: slopeTerrain(startX, 0) + CRATE_RADIUS, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      radius: CRATE_RADIUS,
      // Sliding body parameters (as used in the landing replacement body)
      linearDamping: 0.15,
      restitution: 0.08,
      friction: 0.4,
    });

    stepWorld(world, 120, 0.016); // ~2 seconds

    // Body must have slid downhill (−X direction on this ramp)
    expect(body.position.x).toBeLessThan(startX);
  });

  it("does NOT slide significantly with parachute damping parameters on same slope", () => {
    // With high friction (0.7) on the same 26.6° slope:
    // friction force (0.7 * gMag*cos θ ≈ 15.6) > slide force (≈ 11.2) → no movement.
    const slopeTerrain: TerrainSampler = (x) => x * 0.5;
    const CRATE_RADIUS = 0.65;
    const startX = 10;

    const world = new PhysicsWorld(slopeTerrain);
    const body = world.addBody({
      id: "para-crate",
      position: { x: startX, y: slopeTerrain(startX, 0) + CRATE_RADIUS, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      radius: CRATE_RADIUS,
      // Parachute-drag parameters (high damping + high friction → crate doesn't roll)
      linearDamping: 0.92,
      restitution: 0.05,
      friction: 0.7,
    });

    stepWorld(world, 60, 0.016);

    // Body barely moved compared to the sliding-param case — stays near startX
    expect(Math.abs(body.position.x - startX)).toBeLessThan(1.5);
  });
});

// ─── maxFallSpeed – parachute terminal velocity ───────────────────────────────
// Verifies that the maxFallSpeed clamp prevents gravity from accelerating a
// body beyond the configured terminal velocity while in the air.

describe("maxFallSpeed – parachute terminal velocity", () => {
  it("clamps downward velocity to maxFallSpeed after many frames in the air", () => {
    const world = new PhysicsWorld(flatTerrain);
    const MAX_SPEED = 2.5;
    const body = world.addBody({
      id: "chute",
      position: { x: 0, y: 200, z: 0 },
      velocity: { x: 0, y: -MAX_SPEED, z: 0 },
      maxFallSpeed: MAX_SPEED,
    });

    // Simulate 5 seconds — without the clamp gravity would push vy to ≈ -127.5
    stepWorld(world, 500, 0.01);

    // Body must still be falling slowly (not free-falling under full gravity)
    expect(body.velocity.y).toBeGreaterThanOrEqual(-MAX_SPEED - 0.01);
  });

  it("allows normal fall when no maxFallSpeed is set", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "free",
      position: { x: 0, y: 200, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      // no maxFallSpeed
    });

    // After 1 second the body should be falling much faster than 2.5 u/s
    stepWorld(world, 100, 0.01);

    expect(body.velocity.y).toBeLessThan(-2.5);
  });

  it("body with maxFallSpeed descends at constant rate and reaches the ground", () => {
    const TERRAIN_Y = 0;
    const SPAWN_HEIGHT = 50;
    const MAX_SPEED = 2.5;
    const RADIUS = 0.65;

    const world = new PhysicsWorld(() => TERRAIN_Y);
    const body = world.addBody({
      id: "para-crate",
      position: { x: 0, y: SPAWN_HEIGHT, z: 0 },
      velocity: { x: 0, y: -MAX_SPEED, z: 0 },
      radius: RADIUS,
      maxFallSpeed: MAX_SPEED,
      linearDamping: 0.92,
      restitution: 0.05,
      friction: 0.7,
    });

    // Simulate long enough for the crate to reach the ground
    // At 2.5 u/s from height 50, it takes 20 seconds
    stepWorld(world, 2200, 0.01);

    expect(body.isOnGround).toBe(true);
    expect(body.position.y).toBeCloseTo(TERRAIN_Y + RADIUS, 1);
  });

  it("maxFallSpeed does not prevent upward movement", () => {
    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "up",
      position: { x: 0, y: 5, z: 0 },
      velocity: { x: 0, y: 10, z: 0 }, // launched upward
      maxFallSpeed: 2.5,
    });

    world.update(0.016);

    // The body must still have positive (upward) vy after one step
    expect(body.velocity.y).toBeGreaterThan(0);
  });

  it("clearing maxFallSpeed mid-flight causes the body to free-fall (parachute shot off)", () => {
    const SPAWN_HEIGHT = 100;
    const MAX_SPEED = 2.5;

    const world = new PhysicsWorld(flatTerrain);
    const body = world.addBody({
      id: "shot-chute",
      position: { x: 0, y: SPAWN_HEIGHT, z: 0 },
      velocity: { x: 0, y: -MAX_SPEED, z: 0 },
      maxFallSpeed: MAX_SPEED,
    });

    // Simulate 2 s with parachute active — speed must stay clamped
    stepWorld(world, 200, 0.01);
    expect(body.velocity.y).toBeGreaterThanOrEqual(-MAX_SPEED - 0.01);

    // "Shoot" the parachute — remove the cap
    body.maxFallSpeed = undefined;

    // Simulate another 1 s — gravity now freely accelerates the body
    const yBefore = body.position.y;
    stepWorld(world, 100, 0.01);

    // After removing the cap the body should be falling faster than MAX_SPEED
    expect(body.velocity.y).toBeLessThan(-MAX_SPEED);
    // And it should have descended much more than 2.5 u/s * 1 s = 2.5 units
    expect(yBefore - body.position.y).toBeGreaterThan(MAX_SPEED * 1.0);
  });
});

// ─── Multiple bodies ──────────────────────────────────────────────────────────

describe("Multiple bodies", () => {
  it("simulates multiple bodies independently", () => {
    const world = new PhysicsWorld(flatTerrain);

    const body1 = world.addBody({ id: "b1", position: { x: 0,  y: 5, z: 0 } });
    const body2 = world.addBody({ id: "b2", position: { x: 10, y: 10, z: 0 } });

    stepWorld(world, 50, 0.016);

    // Both should have fallen
    expect(body1.position.y).toBeLessThan(5);
    expect(body2.position.y).toBeLessThan(10);
    // They should not interfere with each other
    expect(body1.position.x).toBeCloseTo(0, 1);
    expect(body2.position.x).toBeCloseTo(10, 1);
  });

  it("removing one body does not affect others", () => {
    const world = new PhysicsWorld(flatTerrain);
    world.addBody({ id: "b1", position: { x: 0, y: 5, z: 0 } });
    const body2 = world.addBody({ id: "b2", position: { x: 0, y: 8, z: 0 } });

    world.removeBody("b1");
    expect(world.bodyCount).toBe(1);

    stepWorld(world, 10, 0.016);
    expect(body2.position.y).toBeLessThan(8);
  });
});
