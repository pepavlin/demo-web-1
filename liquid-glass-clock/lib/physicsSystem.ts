/**
 * Physics System
 *
 * A lightweight, pure-TypeScript rigid-body physics engine designed for
 * attaching basic gravity and slope-sliding behaviour to arbitrary game
 * objects (logs, crates, barrels, …).
 *
 * Design principles:
 *  – Zero Three.js dependency: all geometry is expressed as plain Vec3 objects
 *    so the module can be unit-tested outside a browser.
 *  – Dependency-injected terrain sampler: the caller supplies a function that
 *    returns the terrain height at any (x, z) coordinate. This keeps the
 *    physics world decoupled from the procedural terrain system.
 *  – Callback-driven mesh sync: each PhysicsBody accepts an optional
 *    `onUpdate(position, velocity, dt)` callback that is fired every
 *    simulation step, letting the consumer reposition a Three.js Object3D
 *    without polluting this module.
 *  – Sleep system: a body that has been nearly stationary on the ground for
 *    SLEEP_TIME_THRESHOLD seconds transitions to "sleeping" and is skipped
 *    on subsequent frames. The `onSleep()` callback fires once on entry.
 *    A body wakes up automatically if it receives an impulse via
 *    `applyImpulse()`.
 *
 * Slope physics:
 *  The terrain normal is estimated via finite differences (four samples around
 *  the body position). Gravity is decomposed into a component normal to the
 *  terrain and a slide component tangent to it. The tangent component
 *  accelerates the body downhill. Kinetic friction opposes the horizontal
 *  velocity and is proportional to the normal component of gravity (i.e.
 *  objects slide more freely on steep slopes).
 *
 * Integration:
 *  Semi-implicit Euler: velocity is updated first, then position.
 *  The dt cap of 50 ms prevents tunnel-through artefacts on frame spikes.
 *
 * Usage example:
 * ```ts
 * const world = new PhysicsWorld(getTerrainHeightSampled);
 *
 * const body = world.addBody({
 *   id: 'log-1',
 *   position: { x: 10, y: 5, z: 20 },
 *   velocity: { x: 2, y: 3, z: -1 },
 *   restitution: 0.2,
 *   friction: 0.6,
 *   onUpdate: (pos, vel, dt) => {
 *     logMesh.position.set(pos.x, pos.y, pos.z);
 *     // accumulate roll angle from horizontal speed:
 *     rollAngle += Math.sqrt(vel.x**2 + vel.z**2) * dt / LOG_RADIUS;
 *     logMesh.rotation.z = rollAngle;
 *   },
 *   onSleep: () => {
 *     // optional: snap to final resting rotation, disable shadow cast, …
 *   },
 * });
 *
 * // Inside the game loop:
 * world.update(dt);
 * ```
 */

// ─── Vector type ─────────────────────────────────────────────────────────────

/** Minimal mutable 3-component vector (no Three.js dependency). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ─── Terrain sampler type ────────────────────────────────────────────────────

/**
 * Function that returns the terrain height (world-space Y) at a given
 * world-space (x, z) coordinate.  Must be synchronous.
 */
export type TerrainSampler = (x: number, z: number) => number;

// ─── Physics constants ────────────────────────────────────────────────────────

/** Gravitational acceleration (world units / s²).  Negative = downward. */
export const PHYSICS_GRAVITY = -25;

/** Finite-difference step for terrain normal estimation (world units). */
const TERRAIN_NORMAL_EPSILON = 0.4;

/**
 * Speed (world units / s) below which a body on the ground starts
 * accumulating sleep time.
 */
const SLEEP_LINEAR_THRESHOLD = 0.08;

/** Seconds a body must remain below SLEEP_LINEAR_THRESHOLD before sleeping. */
const SLEEP_TIME_THRESHOLD = 0.6;

/**
 * Minimum vertical bounce velocity (world units / s).  Below this value the
 * bounce is suppressed and the body is placed directly on the terrain to
 * prevent micro-jittering.
 */
const MIN_BOUNCE_VELOCITY = 1.2;

/** Maximum dt step applied per update (seconds). Prevents tunnel-through. */
const MAX_DT = 0.05;

// ─── PhysicsBodyOptions ───────────────────────────────────────────────────────

/** Configuration object passed to {@link PhysicsWorld.addBody}. */
export interface PhysicsBodyOptions {
  /** Unique identifier – used to retrieve or remove the body later. */
  id: string;

  /** Initial world-space position. */
  position: Vec3;

  /**
   * Initial world-space velocity (world units / s).
   * Defaults to zero vector.
   */
  velocity?: Vec3;

  /**
   * Mass of the body (kg-equivalent). Currently used only as a conceptual
   * scale — all bodies experience the same gravitational acceleration.
   * @default 1
   */
  mass?: number;

  /**
   * Vertical half-extent used for ground contact detection.  Think of it as
   * "how far below the body's origin does the bottom surface sit."
   * A cylinder log with radius 0.2 would use radius = 0.2.
   * @default 0.25
   */
  radius?: number;

  /**
   * Coefficient of restitution (bounciness).  0 = no bounce, 1 = perfectly
   * elastic.  Values > 0.3 produce noticeable bouncing.
   * @default 0.15
   */
  restitution?: number;

  /**
   * Kinetic friction coefficient.  Applied to horizontal velocity when the
   * body is sliding along the terrain.  0 = frictionless, 1 = immediate stop.
   * @default 0.55
   */
  friction?: number;

  /**
   * Linear damping (air drag) applied every frame.  Multiplied with velocity
   * each second: v *= (1 - damping)^dt.  Keeps objects from sliding forever
   * on frictionless terrain.
   * @default 0.08
   */
  linearDamping?: number;

  /**
   * Called every simulation step (even while in the air) with the body's
   * current position, velocity, and the simulation dt so the consumer can
   * sync a Three.js Object3D and accumulate rolling rotation.
   */
  onUpdate?: (position: Readonly<Vec3>, velocity: Readonly<Vec3>, dt: number) => void;

  /**
   * Called once when the body transitions from active to sleeping.
   * Useful for snapping to a final resting angle, disabling shadow casting,
   * or emitting a "thud" sound.
   */
  onSleep?: () => void;
}

// ─── PhysicsBody ─────────────────────────────────────────────────────────────

/** A simulated rigid body managed by {@link PhysicsWorld}. */
export class PhysicsBody {
  readonly id: string;

  position: Vec3;
  velocity: Vec3;

  readonly mass: number;
  readonly radius: number;
  readonly restitution: number;
  readonly friction: number;
  readonly linearDamping: number;

  isOnGround: boolean = false;
  isSleeping: boolean = false;

  /** Accumulates time the body has been below SLEEP_LINEAR_THRESHOLD. */
  _sleepTimer: number = 0;

  readonly onUpdate?: (position: Readonly<Vec3>, velocity: Readonly<Vec3>, dt: number) => void;
  readonly onSleep?: () => void;

  constructor(opts: PhysicsBodyOptions) {
    this.id = opts.id;
    this.position = { ...opts.position };
    this.velocity = opts.velocity ? { ...opts.velocity } : { x: 0, y: 0, z: 0 };
    this.mass = opts.mass ?? 1;
    this.radius = opts.radius ?? 0.25;
    this.restitution = opts.restitution ?? 0.15;
    this.friction = opts.friction ?? 0.55;
    this.linearDamping = opts.linearDamping ?? 0.08;
    this.onUpdate = opts.onUpdate;
    this.onSleep = opts.onSleep;
  }

  /** Wake a sleeping body and give it an impulse (world units / s). */
  applyImpulse(ix: number, iy: number, iz: number): void {
    this.isSleeping = false;
    this._sleepTimer = 0;
    this.velocity.x += ix;
    this.velocity.y += iy;
    this.velocity.z += iz;
  }
}

// ─── PhysicsWorld ─────────────────────────────────────────────────────────────

/**
 * Container for all active {@link PhysicsBody} instances.  Call
 * `update(dt)` once per game-loop tick to advance the simulation.
 */
export class PhysicsWorld {
  private readonly _terrainSampler: TerrainSampler;
  private readonly _bodies: Map<string, PhysicsBody> = new Map();

  /**
   * @param terrainSampler  Function that returns terrain Y at (x, z).
   */
  constructor(terrainSampler: TerrainSampler) {
    this._terrainSampler = terrainSampler;
  }

  // ── Body management ────────────────────────────────────────────────────────

  /** Register a new physics body and return it. */
  addBody(opts: PhysicsBodyOptions): PhysicsBody {
    const body = new PhysicsBody(opts);
    this._bodies.set(opts.id, body);
    return body;
  }

  /** Remove a body from the simulation (e.g. after collection or despawn). */
  removeBody(id: string): void {
    this._bodies.delete(id);
  }

  /** Retrieve a body by its id, or undefined if not registered. */
  getBody(id: string): PhysicsBody | undefined {
    return this._bodies.get(id);
  }

  /** Number of bodies currently tracked (including sleeping ones). */
  get bodyCount(): number {
    return this._bodies.size;
  }

  /** Remove all bodies from the simulation. */
  clear(): void {
    this._bodies.clear();
  }

  // ── Simulation step ────────────────────────────────────────────────────────

  /**
   * Advance the simulation by `dt` seconds.
   *
   * @param dt  Frame delta-time in seconds. Will be clamped to MAX_DT.
   */
  update(dt: number): void {
    const safeDt = Math.min(dt, MAX_DT);

    for (const body of this._bodies.values()) {
      if (body.isSleeping) continue;
      this._stepBody(body, safeDt);
    }
  }

  // ── Internal step logic ────────────────────────────────────────────────────

  private _stepBody(body: PhysicsBody, dt: number): void {
    const pos = body.position;
    const vel = body.velocity;

    // ── 1. Sample terrain under the body ──────────────────────────────────
    const groundY = this._terrainSampler(pos.x, pos.z) + body.radius;

    // ── 2. Compute terrain normal (finite differences) ────────────────────
    const eps = TERRAIN_NORMAL_EPSILON;
    const hPX = this._terrainSampler(pos.x + eps, pos.z);
    const hMX = this._terrainSampler(pos.x - eps, pos.z);
    const hPZ = this._terrainSampler(pos.x, pos.z + eps);
    const hMZ = this._terrainSampler(pos.x, pos.z - eps);

    // Forward-difference vectors in XZ plane:
    //   right   = (2ε, hPX - hMX, 0)
    //   forward = (0,  hPZ - hMZ, 2ε)
    // Normal = normalise(cross(right, forward))
    const rx = 2 * eps, ry = hPX - hMX, rz = 0;
    const fx = 0,        fy = hPZ - hMZ, fz = 2 * eps;

    let nx = ry * fz - rz * fy;
    let ny = rz * fx - rx * fz;
    let nz = rx * fy - ry * fx;

    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nLen > 1e-6) { nx /= nLen; ny /= nLen; nz /= nLen; }
    else              { nx = 0; ny = 1; nz = 0; }

    // Ensure the normal always points "upward" (positive Y hemisphere)
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }

    const isOnGround = pos.y <= groundY + 0.02;
    body.isOnGround = isOnGround;

    if (isOnGround) {
      // ── 3a. On-ground physics ──────────────────────────────────────────

      // Snap to terrain surface
      pos.y = groundY;

      // ── Bounce ──────────────────────────────────────────────────────────
      if (vel.y < -MIN_BOUNCE_VELOCITY) {
        vel.y = -vel.y * body.restitution;
        // Transfer some bounce energy to horizontal (realistic scatter)
        vel.x += (Math.random() - 0.5) * Math.abs(vel.y) * 0.1;
        vel.z += (Math.random() - 0.5) * Math.abs(vel.y) * 0.1;
      } else {
        vel.y = 0;
      }

      // ── Slope slide ─────────────────────────────────────────────────────
      // Project gravity onto the terrain plane:
      //   g_slide = g - (g·N) * N   (remove the normal component of gravity)
      const gMag = Math.abs(PHYSICS_GRAVITY);
      const gDotN = -gMag * ny;          // g = (0, -gMag, 0) → dot with N
      const slideX = -gMag * nx - gDotN * nx; // Wait, let me redo this clearly.

      // gravity vector
      const gx = 0, gy = PHYSICS_GRAVITY, gz = 0;
      // dot(g, N)
      const gdotn = gx * nx + gy * ny + gz * nz;
      // slide = g - dot(g,N)*N
      const slideAccX = gx - gdotn * nx;
      const slideAccZ = gz - gdotn * nz;
      // Note: slideAccY would move along slope; we only apply XZ to keep
      // things on terrain (Y is constrained to terrain surface).
      // Unused: const slideAccY = gy - gdotn * ny;

      vel.x += slideAccX * dt;
      vel.z += slideAccZ * dt;

      // ── Kinetic friction ─────────────────────────────────────────────────
      // Friction force = mu * normalForce / mass
      // normalForce ≈ mass * g * |dot(up, N)| ≈ gMag * ny
      // Apply as velocity damping opposing horizontal motion:
      const hSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      if (hSpeed > 1e-4) {
        // Deceleration from friction each second
        const frictionDecel = body.friction * gMag * ny;
        const newHSpeed = Math.max(0, hSpeed - frictionDecel * dt);
        const scale = newHSpeed / hSpeed;
        vel.x *= scale;
        vel.z *= scale;
      }

      // ── Linear (air) damping ─────────────────────────────────────────────
      const dampFactor = Math.pow(1 - body.linearDamping, dt);
      vel.x *= dampFactor;
      vel.z *= dampFactor;

      // ── Sleep detection ──────────────────────────────────────────────────
      const totalSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
      if (totalSpeed < SLEEP_LINEAR_THRESHOLD) {
        body._sleepTimer += dt;
        if (body._sleepTimer >= SLEEP_TIME_THRESHOLD) {
          body.isSleeping = true;
          vel.x = 0; vel.y = 0; vel.z = 0;
          body.onSleep?.();
          body.onUpdate?.(pos, vel, dt);
          return;
        }
      } else {
        body._sleepTimer = 0;
      }

    } else {
      // ── 3b. In-air physics ─────────────────────────────────────────────
      body._sleepTimer = 0;

      // Apply gravity
      vel.y += PHYSICS_GRAVITY * dt;

      // Light air drag on horizontal movement
      const dampFactor = Math.pow(1 - body.linearDamping * 0.3, dt);
      vel.x *= dampFactor;
      vel.z *= dampFactor;
    }

    // ── 4. Integrate position (semi-implicit Euler) ────────────────────────
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;

    // Safety: prevent falling below terrain (tunnel-through guard)
    const groundYAfter = this._terrainSampler(pos.x, pos.z) + body.radius;
    if (pos.y < groundYAfter) {
      pos.y = groundYAfter;
      if (vel.y < 0) vel.y = 0;
    }

    // ── 5. Notify consumer ─────────────────────────────────────────────────
    body.onUpdate?.(pos, vel, dt);
  }
}
