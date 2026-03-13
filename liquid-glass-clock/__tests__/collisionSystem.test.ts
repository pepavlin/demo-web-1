import {
  testOBBXZ,
  resolveBoxCollision3D,
  resolveCylinderCollision3D,
  resolveSphereCollision3D,
  getWalkableSurfaceY,
  type BoxCollider3D,
  type CylinderCollider3D,
  type SphereCollider3D,
} from "@/lib/collisionSystem";

// ─── testOBBXZ ────────────────────────────────────────────────────────────────

describe("testOBBXZ", () => {
  const box = { cx: 0, cz: 0, halfW: 2, halfD: 1, rotY: 0 };

  it("detects a point inside the axis-aligned box", () => {
    const { inside } = testOBBXZ(0, 0, box.cx, box.cz, box.halfW, box.halfD, box.rotY);
    expect(inside).toBe(true);
  });

  it("detects a point outside the box", () => {
    const { inside } = testOBBXZ(5, 0, box.cx, box.cz, box.halfW, box.halfD, box.rotY);
    expect(inside).toBe(false);
  });

  it("returns correct overlap values", () => {
    const { inside, overlapX, overlapZ } = testOBBXZ(
      1.5, 0, box.cx, box.cz, box.halfW, box.halfD, box.rotY
    );
    expect(inside).toBe(true);
    expect(overlapX).toBeCloseTo(0.5, 5);
    expect(overlapZ).toBeCloseTo(1.0, 5);
  });

  it("handles a 90-degree rotated box", () => {
    // After 90° rotation, X and Z roles are swapped
    const { inside } = testOBBXZ(0, 1.5, 0, 0, 2, 1, Math.PI / 2);
    // At (0, 1.5) in world, local lx ≈ 1.5, lz ≈ 0 → inside halfW=2, halfD=1 → inside
    expect(inside).toBe(true);
  });

  it("corner case: point exactly on the boundary", () => {
    const { inside } = testOBBXZ(2, 0, box.cx, box.cz, box.halfW, box.halfD, box.rotY);
    expect(inside).toBe(false);
  });
});

// ─── resolveBoxCollision3D ─────────────────────────────────────────────────────

describe("resolveBoxCollision3D", () => {
  const playerRadius = 0.5;
  const playerHeight = 1.8;

  const makeBox = (overrides: Partial<BoxCollider3D> = {}): BoxCollider3D => ({
    cx: 0, cy: 1, cz: 0,
    halfW: 3, halfH: 1, halfD: 3,
    rotY: 0,
    walkable: false,
    ...overrides,
  });

  it("pushes player out along X axis when overlapping from the right", () => {
    const box = makeBox();
    // Player's centre at (3.2, 1.8, 0) – feet at 0, overlapping box top (cy+halfH=2) barely
    const result = resolveBoxCollision3D(3.2, 1.8, 0, playerRadius, playerHeight, box);
    // Player should be pushed to x = 3 + 0.5 = 3.5
    expect(result.x).toBeGreaterThanOrEqual(3.4);
    expect(result.z).toBeCloseTo(0, 4);
  });

  it("does NOT push player when standing on top (feet above box top)", () => {
    const box = makeBox({ cy: 1, halfH: 1 }); // top at y=2
    // Player camera at y = 4.0, feet at 4.0 - 1.8 = 2.2 → above box top
    const result = resolveBoxCollision3D(0, 4.0, 0, playerRadius, playerHeight, box);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  it("does NOT push player when entirely below the box", () => {
    const box = makeBox({ cy: 10, halfH: 2 }); // box spans y=8 to y=12
    // Player camera at y=1.8 (standing on ground) — entirely below box
    const result = resolveBoxCollision3D(0, 1.8, 0, playerRadius, playerHeight, box);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  it("returns unchanged position when player is outside the box's XZ footprint", () => {
    const box = makeBox();
    const result = resolveBoxCollision3D(5, 1.8, 5, playerRadius, playerHeight, box);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.z).toBeCloseTo(5, 5);
  });

  it("push-out is larger along the axis of least penetration", () => {
    const box = makeBox({ halfW: 2, halfD: 4 });
    // Player at (2.3, 1.8, 0) – small X penetration, large Z containment
    // Should push out along X (least penetration)
    const result = resolveBoxCollision3D(2.3, 1.8, 0, playerRadius, playerHeight, box);
    expect(result.x).toBeGreaterThan(2.3);
  });
});

// ─── resolveCylinderCollision3D ───────────────────────────────────────────────

describe("resolveCylinderCollision3D", () => {
  const playerRadius = 0.5;
  const playerHeight = 1.8;

  const makeCyl = (overrides: Partial<CylinderCollider3D> = {}): CylinderCollider3D => ({
    x: 0, baseY: 0, z: 0,
    radius: 2, // already includes playerRadius in the convention
    height: 5,
    walkable: false,
    ...overrides,
  });

  it("pushes player out of a cylinder horizontally", () => {
    const cyl = makeCyl();
    // Player at (1.5, 1.8, 0) — inside radius=2
    const result = resolveCylinderCollision3D(1.5, 1.8, 0, playerRadius, playerHeight, cyl);
    const dist = Math.sqrt(result.x ** 2 + result.z ** 2);
    expect(dist).toBeCloseTo(2, 4);
  });

  it("does NOT push when player feet are above cylinder top", () => {
    const cyl = makeCyl({ baseY: 0, height: 3 }); // top at y=3
    // Player feet at y = 5.0 - 1.8 = 3.2 → above cylinder top
    const result = resolveCylinderCollision3D(0, 5.0, 0, playerRadius, playerHeight, cyl);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  it("does NOT push when player is entirely below cylinder base", () => {
    const cyl = makeCyl({ baseY: 10, height: 5 }); // base at y=10
    // Player camera at y=1.8 — below cylinder base
    const result = resolveCylinderCollision3D(0, 1.8, 0, playerRadius, playerHeight, cyl);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  it("does not push when player is outside the radius", () => {
    const cyl = makeCyl();
    const result = resolveCylinderCollision3D(3, 1.8, 0, playerRadius, playerHeight, cyl);
    expect(result.x).toBeCloseTo(3, 5);
  });
});

// ─── resolveSphereCollision3D ─────────────────────────────────────────────────

describe("resolveSphereCollision3D", () => {
  const playerRadius = 0.5;
  const playerHeight = 1.8;

  const makeSphere = (overrides: Partial<SphereCollider3D> = {}): SphereCollider3D => ({
    x: 0, y: 1, z: 0,
    radius: 1.5,
    ...overrides,
  });

  it("pushes player out of sphere horizontally", () => {
    const sphere = makeSphere();
    // Player at (1.0, 1.5, 0) — inside radius 1.5
    const result = resolveSphereCollision3D(1.0, 1.5, 0, playerRadius, playerHeight, sphere);
    const dist = Math.sqrt(result.x ** 2 + result.z ** 2);
    expect(dist).toBeGreaterThanOrEqual(1.5 + playerRadius - 0.01);
  });

  it("does not push when player is outside sphere", () => {
    const sphere = makeSphere();
    const result = resolveSphereCollision3D(3, 1.5, 0, playerRadius, playerHeight, sphere);
    expect(result.x).toBeCloseTo(3, 5);
  });
});

// ─── getWalkableSurfaceY ──────────────────────────────────────────────────────

describe("getWalkableSurfaceY", () => {
  const playerHeight = 1.8;
  const playerRadius = 0.5;

  it("returns -Infinity when no walkable collider is nearby", () => {
    const boxes: BoxCollider3D[] = [{ cx: 0, cy: 1, cz: 0, halfW: 2, halfH: 1, halfD: 2, rotY: 0, walkable: true }];
    // Player at (20, 10) — far away
    const result = getWalkableSurfaceY(20, 20, 10, playerHeight, playerRadius, boxes, []);
    expect(result).toBe(-Infinity);
  });

  it("returns box top + playerHeight when player is above a walkable box", () => {
    const boxes: BoxCollider3D[] = [{
      cx: 0, cy: 1, cz: 0, halfW: 2, halfH: 1, halfD: 2,
      rotY: 0, walkable: true,
    }];
    // Box top at cy + halfH = 2
    // Player at (0, 4.0, 0) — feet at 4.0 - 1.8 = 2.2 → above box top
    const result = getWalkableSurfaceY(0, 0, 4.0, playerHeight, playerRadius, boxes, []);
    expect(result).toBeCloseTo(2 + playerHeight, 4);
  });

  it("ignores non-walkable boxes", () => {
    const boxes: BoxCollider3D[] = [{
      cx: 0, cy: 1, cz: 0, halfW: 2, halfH: 1, halfD: 2,
      rotY: 0, walkable: false,
    }];
    const result = getWalkableSurfaceY(0, 0, 4.0, playerHeight, playerRadius, boxes, []);
    expect(result).toBe(-Infinity);
  });

  it("ignores box when player feet are below box top (player is under the box)", () => {
    const boxes: BoxCollider3D[] = [{
      cx: 0, cy: 5, cz: 0, halfW: 2, halfH: 1, halfD: 2,
      rotY: 0, walkable: true,
    }];
    // Box top at 6; player at y=1.8 — feet at 0 — below box top (6)
    const result = getWalkableSurfaceY(0, 0, 1.8, playerHeight, playerRadius, boxes, []);
    expect(result).toBe(-Infinity);
  });

  it("returns highest surface when multiple walkable boxes overlap XZ", () => {
    const boxes: BoxCollider3D[] = [
      { cx: 0, cy: 1, cz: 0, halfW: 2, halfH: 1, halfD: 2, rotY: 0, walkable: true }, // top=2
      { cx: 0, cy: 4, cz: 0, halfW: 2, halfH: 1, halfD: 2, rotY: 0, walkable: true }, // top=5
    ];
    // Player at y = 8.0 — above both boxes
    const result = getWalkableSurfaceY(0, 0, 8.0, playerHeight, playerRadius, boxes, []);
    expect(result).toBeCloseTo(5 + playerHeight, 4);
  });

  it("handles walkable cylinder top surface", () => {
    const cyls: CylinderCollider3D[] = [{
      x: 0, baseY: 0, z: 0, radius: 3, height: 4, walkable: true,
    }];
    // Cylinder top at 4; player at y = 7.0 — feet at 5.2 → above cylinder top (4)
    const result = getWalkableSurfaceY(0, 0, 7.0, playerHeight, playerRadius, [], cyls);
    expect(result).toBeCloseTo(4 + playerHeight, 4);
  });

  it("ignores non-walkable cylinders", () => {
    const cyls: CylinderCollider3D[] = [{
      x: 0, baseY: 0, z: 0, radius: 3, height: 4, walkable: false,
    }];
    const result = getWalkableSurfaceY(0, 0, 7.0, playerHeight, playerRadius, [], cyls);
    expect(result).toBe(-Infinity);
  });
});

// ─── isTrigger flag ───────────────────────────────────────────────────────────

describe("isTrigger flag on collider types", () => {
  it("BoxCollider3D accepts isTrigger: true without error", () => {
    const box: BoxCollider3D = {
      cx: 0, cy: 1, cz: 0,
      halfW: 2, halfH: 1, halfD: 2,
      rotY: 0,
      walkable: false,
      isTrigger: true,
    };
    expect(box.isTrigger).toBe(true);
  });

  it("BoxCollider3D defaults to no isTrigger (undefined = solid)", () => {
    const box: BoxCollider3D = {
      cx: 0, cy: 1, cz: 0,
      halfW: 2, halfH: 1, halfD: 2,
      rotY: 0,
      walkable: false,
    };
    expect(box.isTrigger).toBeUndefined();
    // undefined is falsy: solid collider blocks projectiles
    expect(!box.isTrigger).toBe(true);
  });

  it("CylinderCollider3D accepts isTrigger: true", () => {
    const cyl: CylinderCollider3D = {
      x: 0, baseY: 0, z: 0,
      radius: 2, height: 5,
      walkable: false,
      isTrigger: true,
    };
    expect(cyl.isTrigger).toBe(true);
  });

  it("CylinderCollider3D defaults to no isTrigger (solid)", () => {
    const cyl: CylinderCollider3D = {
      x: 0, baseY: 0, z: 0,
      radius: 2, height: 5,
      walkable: false,
    };
    expect(!cyl.isTrigger).toBe(true);
  });

  it("SphereCollider3D accepts isTrigger: true", () => {
    const sphere: SphereCollider3D = {
      x: 0, y: 1, z: 0,
      radius: 1.5,
      isTrigger: true,
    };
    expect(sphere.isTrigger).toBe(true);
  });

  it("bullet-vs-cylinder: point inside non-trigger cylinder is blocked", () => {
    // Simulate the bullet collision check: rawRadius = cyl.radius - PLAYER_RADIUS
    const PLAYER_RADIUS = 0.5;
    const cyl: CylinderCollider3D = { x: 0, baseY: 0, z: 0, radius: 1.5 + PLAYER_RADIUS, height: 5, walkable: false };
    const bulletX = 0.5, bulletZ = 0;
    const rawRadius = Math.max(0, cyl.radius - PLAYER_RADIUS); // 1.5
    const dx = bulletX - cyl.x;
    const dz = bulletZ - cyl.z;
    const inside = dx * dx + dz * dz < rawRadius * rawRadius;
    expect(inside).toBe(true);
    // Same bullet vs trigger cylinder — game logic skips it (isTrigger check)
    const triggerCyl: CylinderCollider3D = { ...cyl, isTrigger: true };
    expect(triggerCyl.isTrigger).toBe(true); // would be skipped in game loop
  });

  it("bullet-vs-box: point inside non-trigger box is blocked", () => {
    const box: BoxCollider3D = {
      cx: 0, cy: 1, cz: 0,
      halfW: 3, halfH: 2, halfD: 3,
      rotY: 0,
      walkable: false,
    };
    const bulletY = 1.5; // inside vertical range [cy-halfH, cy+halfH] = [-1, 3]
    const inYRange = bulletY >= box.cy - box.halfH && bulletY <= box.cy + box.halfH;
    expect(inYRange).toBe(true);
    // XZ check via testOBBXZ
    const { inside } = testOBBXZ(0.5, 0.5, box.cx, box.cz, box.halfW, box.halfD, box.rotY);
    expect(inside).toBe(true);
  });
});
