/**
 * Pumpkin World Simulation
 *
 * Simulates a lifecycle of pumpkins:
 *   growing → mature → rotting → dead
 *
 * Each pumpkin grows from a small seed to its full size.
 * Once large enough (SPAWN_THRESHOLD), it spawns one child pumpkin nearby.
 * After reaching full size the pumpkin enters a mature phase, then rots and disappears.
 */

export type PumpkinStage = "growing" | "mature" | "rotting" | "dead";

export interface Pumpkin {
  id: string;
  /** Center X position (pixels) */
  x: number;
  /** Center Y position (pixels) */
  y: number;
  /** Current radius (pixels) */
  size: number;
  /** Maximum radius this pumpkin will reach */
  maxSize: number;
  /** Total age in seconds */
  age: number;
  /** Current lifecycle stage */
  stage: PumpkinStage;
  /** Whether this pumpkin has already spawned a child */
  hasSpawned: boolean;
  /** Rot progress 0–1 (0 = fresh, 1 = fully rotten → removed) */
  rotProgress: number;
  /** Seconds spent in mature stage before rotting begins */
  matureAge: number;
}

export interface SimulationConfig {
  /** Canvas width (px) */
  width: number;
  /** Canvas height (px) */
  height: number;
  /** Pixels per second growth rate */
  growthRate: number;
  /** Minimum maximum radius */
  minMaxSize: number;
  /** Maximum maximum radius */
  maxMaxSize: number;
  /** Fraction of maxSize at which child pumpkin is spawned */
  spawnThreshold: number;
  /** Seconds at full size before rotting begins */
  matureDuration: number;
  /** Seconds for the full rot phase */
  rotDuration: number;
  /** Hard cap on total live pumpkin count */
  maxPumpkins: number;
  /** Initial number of pumpkins */
  initialCount: number;
  /** Multiplier for spawn distance relative to parent maxSize */
  spawnDistanceMultiplier: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  width: 800,
  height: 600,
  growthRate: 8,
  minMaxSize: 30,
  maxMaxSize: 70,
  spawnThreshold: 0.6,
  matureDuration: 12,
  rotDuration: 15,
  maxPumpkins: 40,
  initialCount: 3,
  spawnDistanceMultiplier: 2.8,
};

let _idCounter = 0;

function generateId(): string {
  return `pumpkin-${++_idCounter}`;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Creates a new pumpkin with the given position and optional config overrides.
 */
export function createPumpkin(
  x: number,
  y: number,
  config: Pick<SimulationConfig, "minMaxSize" | "maxMaxSize">
): Pumpkin {
  return {
    id: generateId(),
    x,
    y,
    size: 4,
    maxSize: randomBetween(config.minMaxSize, config.maxMaxSize),
    age: 0,
    stage: "growing",
    hasSpawned: false,
    rotProgress: 0,
    matureAge: 0,
  };
}

/**
 * Spawns a child pumpkin adjacent to the parent.
 * Returns null when the world is at capacity.
 */
export function spawnChild(
  parent: Pumpkin,
  config: SimulationConfig
): Pumpkin | null {
  if (parent.hasSpawned) return null;

  const angle = Math.random() * Math.PI * 2;
  const distance = parent.maxSize * config.spawnDistanceMultiplier;

  const margin = config.maxMaxSize;
  const x = clamp(
    parent.x + Math.cos(angle) * distance,
    margin,
    config.width - margin
  );
  const y = clamp(
    parent.y + Math.sin(angle) * distance,
    margin,
    config.height - margin
  );

  return createPumpkin(x, y, config);
}

/**
 * Immutably updates a single pumpkin by `dt` seconds.
 * Returns the updated pumpkin, or null if it died this tick.
 */
export function updatePumpkin(
  pumpkin: Pumpkin,
  dt: number,
  config: SimulationConfig
): Pumpkin | null {
  const p: Pumpkin = { ...pumpkin };
  p.age += dt;

  switch (p.stage) {
    case "growing":
      p.size = Math.min(p.size + config.growthRate * dt, p.maxSize);
      if (p.size >= p.maxSize) {
        p.stage = "mature";
      }
      break;

    case "mature":
      p.matureAge += dt;
      if (p.matureAge >= config.matureDuration) {
        p.stage = "rotting";
        p.rotProgress = 0;
      }
      break;

    case "rotting":
      p.rotProgress = Math.min(p.rotProgress + dt / config.rotDuration, 1);
      if (p.rotProgress >= 1) {
        return null; // fully rotten — remove from simulation
      }
      break;

    case "dead":
      return null;
  }

  return p;
}

/**
 * Returns true when the pumpkin should spawn a child this tick.
 * Checks size against the threshold regardless of whether the pumpkin just
 * transitioned from growing → mature in the same tick.
 */
export function shouldSpawn(
  pumpkin: Pumpkin,
  config: SimulationConfig
): boolean {
  return (
    !pumpkin.hasSpawned &&
    pumpkin.stage !== "rotting" &&
    pumpkin.stage !== "dead" &&
    pumpkin.size >= pumpkin.maxSize * config.spawnThreshold
  );
}

/**
 * Core simulation class. Maintains the full pumpkin population and advances
 * the world one tick at a time.
 */
export class PumpkinSimulation {
  private _pumpkins: Pumpkin[] = [];
  private readonly config: SimulationConfig;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._initPumpkins();
  }

  private _initPumpkins(): void {
    const { initialCount, width, height, maxMaxSize } = this.config;
    const margin = maxMaxSize * 2;
    for (let i = 0; i < initialCount; i++) {
      const x = randomBetween(margin, width - margin);
      const y = randomBetween(margin, height - margin);
      this._pumpkins.push(createPumpkin(x, y, this.config));
    }
  }

  /** Read-only snapshot of the current pumpkin population. */
  get pumpkins(): readonly Pumpkin[] {
    return this._pumpkins;
  }

  /** Advance the simulation by `dt` seconds. */
  update(dt: number): void {
    const nextPumpkins: Pumpkin[] = [];
    const newChildren: Pumpkin[] = [];

    for (const p of this._pumpkins) {
      // Update the pumpkin first, then check whether it should spawn.
      // This ensures that even when a large dt causes the pumpkin to jump from
      // below-threshold to above-threshold in a single tick, the spawn still fires.
      const updated = updatePumpkin(p, dt, this.config);
      if (!updated) continue; // died this tick

      if (
        shouldSpawn(updated, this.config) &&
        nextPumpkins.length + newChildren.length < this.config.maxPumpkins
      ) {
        const child = spawnChild(updated, this.config);
        if (child) newChildren.push(child);
        nextPumpkins.push({ ...updated, hasSpawned: true });
      } else {
        nextPumpkins.push(updated);
      }
    }

    // Add children only up to the cap
    const slotsLeft = this.config.maxPumpkins - nextPumpkins.length;
    this._pumpkins = [...nextPumpkins, ...newChildren.slice(0, slotsLeft)];
  }

  /** Total number of currently alive pumpkins. */
  get count(): number {
    return this._pumpkins.length;
  }

  /** Config used by this simulation instance. */
  getConfig(): Readonly<SimulationConfig> {
    return this.config;
  }

  /** Reset the simulation to its initial state. */
  reset(): void {
    this._pumpkins = [];
    _idCounter = 0;
    this._initPumpkins();
  }
}
