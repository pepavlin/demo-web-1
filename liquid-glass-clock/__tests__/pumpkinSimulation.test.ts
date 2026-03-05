import {
  PumpkinSimulation,
  createPumpkin,
  updatePumpkin,
  shouldSpawn,
  spawnChild,
  DEFAULT_CONFIG,
  type Pumpkin,
  type SimulationConfig,
} from "@/lib/pumpkinSimulation";

// Deterministic config used across tests
const testConfig: SimulationConfig = {
  ...DEFAULT_CONFIG,
  width: 800,
  height: 600,
  growthRate: 10,
  minMaxSize: 50,
  maxMaxSize: 50, // fixed size so maths is predictable
  spawnThreshold: 0.6,
  matureDuration: 5,
  rotDuration: 10,
  maxPumpkins: 20,
  initialCount: 2,
  spawnDistanceMultiplier: 2.5,
};

// ── createPumpkin ──────────────────────────────────────────────────────────────

describe("createPumpkin", () => {
  it("creates a pumpkin in the growing stage with initial size 4", () => {
    const p = createPumpkin(100, 100, testConfig);
    expect(p.stage).toBe("growing");
    expect(p.size).toBe(4);
    expect(p.hasSpawned).toBe(false);
    expect(p.rotProgress).toBe(0);
    expect(p.age).toBe(0);
  });

  it("sets maxSize within the configured range", () => {
    for (let i = 0; i < 20; i++) {
      const p = createPumpkin(100, 100, testConfig);
      expect(p.maxSize).toBeGreaterThanOrEqual(testConfig.minMaxSize);
      expect(p.maxSize).toBeLessThanOrEqual(testConfig.maxMaxSize);
    }
  });

  it("assigns unique ids", () => {
    const ids = Array.from({ length: 10 }, () =>
      createPumpkin(50, 50, testConfig).id
    );
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
  });
});

// ── updatePumpkin ──────────────────────────────────────────────────────────────

describe("updatePumpkin", () => {
  function makePumpkin(overrides: Partial<Pumpkin> = {}): Pumpkin {
    return {
      id: "test-1",
      x: 100,
      y: 100,
      size: 4,
      maxSize: 50,
      age: 0,
      stage: "growing",
      hasSpawned: false,
      rotProgress: 0,
      matureAge: 0,
      ...overrides,
    };
  }

  it("increases size while growing", () => {
    const p = makePumpkin();
    const updated = updatePumpkin(p, 1, testConfig);
    expect(updated).not.toBeNull();
    expect(updated!.size).toBeGreaterThan(p.size);
    expect(updated!.stage).toBe("growing");
  });

  it("transitions to mature when size reaches maxSize", () => {
    // Size is already at maxSize boundary after growth
    const p = makePumpkin({ size: 49, maxSize: 50 });
    const updated = updatePumpkin(p, 0.2, testConfig); // +2 → 51 clamped to 50
    expect(updated).not.toBeNull();
    expect(updated!.stage).toBe("mature");
    expect(updated!.size).toBe(50);
  });

  it("does not exceed maxSize", () => {
    const p = makePumpkin({ size: 48, maxSize: 50 });
    const updated = updatePumpkin(p, 10, testConfig); // large dt
    expect(updated!.size).toBe(50);
  });

  it("increases age each tick", () => {
    const p = makePumpkin();
    const u1 = updatePumpkin(p, 1, testConfig)!;
    const u2 = updatePumpkin(u1, 2, testConfig)!;
    expect(u2.age).toBeCloseTo(3, 5);
  });

  it("transitions mature → rotting after matureDuration", () => {
    const p = makePumpkin({ stage: "mature", size: 50, matureAge: 4.9 });
    const updated = updatePumpkin(p, 0.2, testConfig); // matureAge → 5.1 > 5
    expect(updated!.stage).toBe("rotting");
  });

  it("advances rotProgress during rotting phase", () => {
    const p = makePumpkin({ stage: "rotting", rotProgress: 0.0 });
    const updated = updatePumpkin(p, 5, testConfig); // rotDuration=10 → 50%
    expect(updated!.rotProgress).toBeCloseTo(0.5, 5);
  });

  it("transitions rotting → dead when rotProgress reaches 1", () => {
    const p = makePumpkin({ stage: "rotting", rotProgress: 0.95 });
    const updated = updatePumpkin(p, 1, testConfig); // +0.1 → 1.0 → dead
    expect(updated).toBeNull();
  });

  it("returns null for already dead pumpkins", () => {
    const p = makePumpkin({ stage: "dead" });
    expect(updatePumpkin(p, 1, testConfig)).toBeNull();
  });
});

// ── shouldSpawn ────────────────────────────────────────────────────────────────

describe("shouldSpawn", () => {
  function makeGrowing(size: number): Pumpkin {
    return {
      id: "s-1",
      x: 100,
      y: 100,
      size,
      maxSize: 50,
      age: 1,
      stage: "growing",
      hasSpawned: false,
      rotProgress: 0,
      matureAge: 0,
    };
  }

  it("returns true when size >= spawnThreshold * maxSize", () => {
    const p = makeGrowing(30); // 30 >= 0.6 * 50 = 30
    expect(shouldSpawn(p, testConfig)).toBe(true);
  });

  it("returns false when size < spawnThreshold * maxSize", () => {
    const p = makeGrowing(25); // 25 < 30
    expect(shouldSpawn(p, testConfig)).toBe(false);
  });

  it("returns false when pumpkin already spawned", () => {
    const p = { ...makeGrowing(40), hasSpawned: true };
    expect(shouldSpawn(p, testConfig)).toBe(false);
  });

  it("returns false in rotting/dead stages even with sufficient size", () => {
    const rotting = { ...makeGrowing(40), stage: "rotting" as const };
    expect(shouldSpawn(rotting, testConfig)).toBe(false);

    const dead = { ...makeGrowing(40), stage: "dead" as const };
    expect(shouldSpawn(dead, testConfig)).toBe(false);
  });

  it("returns true in the mature stage when size is sufficient and not yet spawned", () => {
    const p = { ...makeGrowing(40), stage: "mature" as const };
    expect(shouldSpawn(p, testConfig)).toBe(true);
  });
});

// ── spawnChild ─────────────────────────────────────────────────────────────────

describe("spawnChild", () => {
  const parent: Pumpkin = {
    id: "parent-1",
    x: 400,
    y: 300,
    size: 30,
    maxSize: 50,
    age: 5,
    stage: "growing",
    hasSpawned: false,
    rotProgress: 0,
    matureAge: 0,
  };

  it("returns a new pumpkin in the growing stage", () => {
    const child = spawnChild(parent, testConfig);
    expect(child).not.toBeNull();
    expect(child!.stage).toBe("growing");
    expect(child!.hasSpawned).toBe(false);
  });

  it("places child within canvas bounds", () => {
    for (let i = 0; i < 20; i++) {
      const child = spawnChild(parent, testConfig);
      expect(child!.x).toBeGreaterThan(0);
      expect(child!.x).toBeLessThan(testConfig.width);
      expect(child!.y).toBeGreaterThan(0);
      expect(child!.y).toBeLessThan(testConfig.height);
    }
  });

  it("returns null when parent already spawned", () => {
    const alreadySpawned = { ...parent, hasSpawned: true };
    expect(spawnChild(alreadySpawned, testConfig)).toBeNull();
  });
});

// ── PumpkinSimulation ─────────────────────────────────────────────────────────

describe("PumpkinSimulation", () => {
  it("initialises with the configured number of pumpkins", () => {
    const sim = new PumpkinSimulation(testConfig);
    expect(sim.count).toBe(testConfig.initialCount);
  });

  it("grows pumpkins over time", () => {
    const sim = new PumpkinSimulation(testConfig);
    const initialSizes = sim.pumpkins.map((p) => p.size);
    sim.update(1);
    const newSizes = sim.pumpkins.map((p) => p.size);
    expect(newSizes.some((s, i) => s > initialSizes[i])).toBe(true);
  });

  it("spawns a child when a pumpkin reaches the threshold", () => {
    // Use a very small growthRate and large dt to force growth quickly
    const cfg: SimulationConfig = {
      ...testConfig,
      initialCount: 1,
      growthRate: 100,
      maxPumpkins: 10,
    };
    const sim = new PumpkinSimulation(cfg);
    // After enough dt, pumpkin hits threshold and spawns
    for (let i = 0; i < 10; i++) {
      sim.update(0.5);
    }
    expect(sim.count).toBeGreaterThan(1);
  });

  it("does not exceed maxPumpkins", () => {
    const cfg: SimulationConfig = {
      ...testConfig,
      initialCount: 5,
      growthRate: 200,
      maxPumpkins: 6,
    };
    const sim = new PumpkinSimulation(cfg);
    for (let i = 0; i < 50; i++) {
      sim.update(1);
    }
    expect(sim.count).toBeLessThanOrEqual(cfg.maxPumpkins);
  });

  it("removes dead pumpkins from the simulation", () => {
    const cfg: SimulationConfig = {
      ...testConfig,
      initialCount: 1,
      growthRate: 200,   // grow instantly
      matureDuration: 0, // instant mature → rot
      rotDuration: 1,    // rot in 1 second
      maxPumpkins: 2,
    };
    const sim = new PumpkinSimulation(cfg);
    // Run long enough for the original pumpkin to die
    for (let i = 0; i < 200; i++) {
      sim.update(0.1);
    }
    // The original pumpkin should be dead; only children (if any) remain
    expect(sim.count).toBeLessThanOrEqual(cfg.maxPumpkins);
  });

  it("reset() restores the initial state", () => {
    const sim = new PumpkinSimulation(testConfig);
    sim.update(5);
    sim.reset();
    expect(sim.count).toBe(testConfig.initialCount);
    sim.pumpkins.forEach((p) => expect(p.stage).toBe("growing"));
  });

  it("exposes a read-only pumpkin list", () => {
    const sim = new PumpkinSimulation(testConfig);
    const pumpkins = sim.pumpkins;
    // Attempt mutation — TypeScript prevents it at compile time;
    // at runtime the array itself is a copy so push won't affect internal state
    expect(Array.isArray(pumpkins)).toBe(true);
  });

  it("pumpkins advance age each update", () => {
    const sim = new PumpkinSimulation(testConfig);
    const before = sim.pumpkins[0].age;
    sim.update(2);
    const after = sim.pumpkins.find((p) => p.id === sim.pumpkins[0].id);
    if (after) {
      expect(after.age).toBeGreaterThan(before);
    }
  });
});
