/**
 * EntitySyncManager — Universal multiplayer entity synchronization system.
 *
 * Architecture:
 * - The first connected player becomes the "host".
 * - The host simulates all registered syncable entities and broadcasts their states.
 * - Non-host clients receive states and apply them (skipping local AI/simulation).
 * - Any entity type can be registered with a `syncEnabled` flag for easy toggling.
 *
 * Sync patterns:
 * - NPC entities (sheep, foxes): host-authoritative, periodic batch updates at configurable Hz.
 * - Discrete events (entity death, state change): emitted immediately as entity events.
 *
 * Interpolation:
 * - Entities that define `interpolate` get smooth per-frame interpolation instead of
 *   hard teleport snapping. The latest received state is stored as a "target" and the
 *   `interpolate(target, dt)` callback is called each frame by `smoothStep()`.
 * - Entities without `interpolate` fall back to the legacy `apply()` direct assignment.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Serialised numeric state snapshot for a single entity. */
export type EntityState = Record<string, number>;

/** A batch of entity states keyed by entity id. */
export type EntityBatch = Record<string, EntityState>;

/** A discrete event for a single entity (e.g. death, state transition). */
export interface EntityEvent {
  /** Entity id that the event applies to. */
  id: string;
  /** Event type string (e.g. "death", "state_change", "burn"). */
  type: string;
  /** Optional numeric payload. */
  payload?: Record<string, number | string>;
}

/** Options for registering a syncable entity. */
export interface SyncOptions {
  /**
   * Whether this entity participates in multiplayer sync.
   * When false the entity is entirely ignored by the manager —
   * it behaves as a pure local (single-player) entity.
   */
  syncEnabled: boolean;

  /**
   * Target broadcast rate in Hz (updates per second).
   * Defaults to 10 Hz. The manager batches all registered entities and
   * sends a single packet per interval, so lower-priority entities incur
   * almost no extra bandwidth.
   */
  syncRate?: number;

  /**
   * Serialise the entity's current state into a plain numeric object.
   * Only called on the host.
   *
   * @example
   * serialize: () => ({ x: mesh.position.x, z: mesh.position.z, angle: currentAngle })
   */
  serialize: () => EntityState;

  /**
   * Apply a received state snapshot directly to the entity (hard snap).
   * Called on non-host clients when NO `interpolate` function is provided.
   * When `interpolate` is provided, `apply` is NOT called on normal batch
   * updates — only `interpolate` is called each frame via `smoothStep()`.
   *
   * @example
   * apply: (s) => { mesh.position.x = s.x; mesh.position.z = s.z; }
   */
  apply: (state: EntityState) => void;

  /**
   * Optional smooth per-frame interpolation towards the latest received state.
   * When defined, `applyBatch()` stores the incoming state as a target instead
   * of calling `apply()` directly. Each call to `smoothStep(dt)` then invokes
   * this function so the entity can lerp toward the target at its own rate.
   *
   * Use exponential smoothing for frame-rate-independent results:
   * ```
   * const alpha = 1 - Math.exp(-speed * dt);
   * mesh.position.x += (target.x - mesh.position.x) * alpha;
   * ```
   *
   * Only called on non-host clients (host always owns the authoritative state).
   */
  interpolate?: (target: EntityState, dt: number) => void;
}

/** Internal registration record. */
interface SyncRegistration {
  options: SyncOptions;
  /** Effective interval in ms between broadcasts for this entity. */
  intervalMs: number;
  /** Time (ms) of the last broadcast for this entity. */
  lastSentMs: number;
}

// ── EntitySyncManager ─────────────────────────────────────────────────────────

/**
 * Manages multiplayer synchronisation of game entities.
 *
 * Usage:
 * ```typescript
 * const manager = new EntitySyncManager();
 *
 * // Register a sheep with smooth interpolation
 * manager.register(`sheep_${id}`, {
 *   syncEnabled: true,
 *   syncRate: 20,
 *   serialize: () => ({ x: sheep.mesh.position.x, z: sheep.mesh.position.z }),
 *   apply: (s) => { sheep.mesh.position.x = s.x; sheep.mesh.position.z = s.z; },
 *   interpolate: (s, dt) => {
 *     const a = 1 - Math.exp(-15 * dt);
 *     sheep.mesh.position.x += (s.x - sheep.mesh.position.x) * a;
 *     sheep.mesh.position.z += (s.z - sheep.mesh.position.z) * a;
 *   },
 * });
 *
 * // Each frame (host only) — collect and send pending batch
 * manager.collectAndSend((batch) => sendEntityBatch(batch), performance.now());
 *
 * // Each frame (non-host only) — advance interpolation
 * manager.smoothStep(dt);
 *
 * // On receiving a batch (non-host)
 * manager.applyBatch(batch);
 *
 * // On receiving an event (all clients)
 * manager.applyEvent(event, (id, type, payload) => { ... });
 * ```
 */
export class EntitySyncManager {
  private registry = new Map<string, SyncRegistration>();
  private isHost = false;
  private eventHandlers = new Map<string, Array<(id: string, payload?: Record<string, number | string>) => void>>();

  /**
   * Latest received entity states used as interpolation targets.
   * Only populated for entities that define `interpolate`.
   */
  private interpolationTargets = new Map<string, EntityState>();

  // ── Host management ────────────────────────────────────────────────────────

  /**
   * Set whether this client is the host (NPC simulation authority).
   * When transitioning to host, all `lastSentMs` values are reset so a full
   * state broadcast happens on the very next tick.
   */
  setIsHost(isHost: boolean): void {
    const wasHost = this.isHost;
    this.isHost = isHost;
    if (isHost && !wasHost) {
      // Reset all timers to -Infinity so host sends immediately on first tick
      this.registry.forEach((reg) => { reg.lastSentMs = -Infinity; });
      // Clear interpolation targets — host owns state, never interpolates
      this.interpolationTargets.clear();
    }
  }

  /** Returns true if this client is currently the simulation host. */
  getIsHost(): boolean {
    return this.isHost;
  }

  // ── Entity registration ────────────────────────────────────────────────────

  /**
   * Register an entity for sync tracking.
   * Calling register() on an already-registered id updates its options in place.
   */
  register(id: string, options: SyncOptions): void {
    const syncRate = options.syncRate ?? 10;
    const intervalMs = 1000 / syncRate;
    const existing = this.registry.get(id);
    // Use -Infinity as the default so the very first tick always sends,
    // regardless of the initial nowMs value.
    this.registry.set(id, {
      options,
      intervalMs,
      lastSentMs: existing?.lastSentMs ?? -Infinity,
    });
  }

  /**
   * Remove an entity from the registry.
   * Should be called when an entity is destroyed (e.g. sheep dies and is removed from scene).
   */
  unregister(id: string): void {
    this.registry.delete(id);
    this.interpolationTargets.delete(id);
  }

  /** Returns the number of currently registered entities. */
  get size(): number {
    return this.registry.size;
  }

  /** Returns true if the given id is registered. */
  has(id: string): boolean {
    return this.registry.has(id);
  }

  // ── Host broadcast ─────────────────────────────────────────────────────────

  /**
   * Called each frame on the host.
   * Collects all entities whose sync interval has elapsed, serialises them into
   * a single batch, and passes the batch to `batchSender`.
   *
   * @param batchSender - Callback that sends the batch over the network.
   * @param nowMs - Current timestamp from `performance.now()`.
   */
  collectAndSend(batchSender: (batch: EntityBatch) => void, nowMs: number): void {
    if (!this.isHost) return;

    const batch: EntityBatch = {};
    let hasEntries = false;

    this.registry.forEach((reg, id) => {
      if (!reg.options.syncEnabled) return;
      if (nowMs - reg.lastSentMs < reg.intervalMs) return;

      try {
        batch[id] = reg.options.serialize();
        reg.lastSentMs = nowMs;
        hasEntries = true;
      } catch {
        // Serialise errors are silent — entity may have been partially destroyed
      }
    });

    if (hasEntries) {
      batchSender(batch);
    }
  }

  // ── Non-host: apply incoming states ───────────────────────────────────────

  /**
   * Apply a received state batch to all known entities.
   * Called on non-host clients when an `entity:batch` socket event arrives.
   *
   * - Entities with `interpolate` defined: stores the state as a target.
   *   The actual visual update is done per-frame by `smoothStep()`.
   * - Entities without `interpolate`: calls `apply()` directly (hard snap).
   *
   * Unknown ids (entity not registered on this client) are silently ignored.
   */
  applyBatch(batch: EntityBatch): void {
    if (this.isHost) return; // Host never applies external state

    for (const id in batch) {
      const reg = this.registry.get(id);
      if (!reg || !reg.options.syncEnabled) continue;
      try {
        if (reg.options.interpolate) {
          // Store as target — smoothStep() will lerp toward it each frame
          this.interpolationTargets.set(id, batch[id]);
        } else {
          reg.options.apply(batch[id]);
        }
      } catch {
        // Apply errors are silent
      }
    }
  }

  /**
   * Advance smooth interpolation for all registered entities that have an
   * `interpolate` function and a pending target state.
   *
   * Call this once per animation frame on non-host clients, passing the
   * frame delta time in seconds.
   *
   * @param dt - Frame delta time in seconds (e.g. from Three.js clock).
   */
  smoothStep(dt: number): void {
    if (this.isHost) return; // Host owns the state — never interpolates

    this.interpolationTargets.forEach((target, id) => {
      const reg = this.registry.get(id);
      if (!reg?.options.interpolate || !reg.options.syncEnabled) return;
      try {
        reg.options.interpolate(target, dt);
      } catch {
        // Interpolation errors are silent
      }
    });
  }

  // ── Discrete entity events ─────────────────────────────────────────────────

  /**
   * Register a listener for a discrete entity event type.
   * Multiple listeners can be added for the same event type.
   *
   * @example
   * manager.onEvent('death', (id, payload) => { ... });
   */
  onEvent(
    type: string,
    handler: (id: string, payload?: Record<string, number | string>) => void
  ): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type)!.push(handler);
  }

  /**
   * Remove all listeners for a specific event type.
   */
  offEvent(type: string): void {
    this.eventHandlers.delete(type);
  }

  /**
   * Dispatch a received entity event to registered handlers.
   * Called on all clients (both host and non-host) when an `entity:event` arrives.
   */
  applyEvent(event: EntityEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event.id, event.payload);
      } catch {
        // Handler errors are silent
      }
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  /**
   * Remove all registered entities and event handlers.
   * Useful for cleanup on scene teardown or game restart.
   */
  clear(): void {
    this.registry.clear();
    this.eventHandlers.clear();
    this.interpolationTargets.clear();
    this.isHost = false;
  }

  /**
   * Returns the ids of all currently registered entities.
   * Useful for debugging / diagnostics.
   */
  registeredIds(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Returns a debug summary of the current state.
   */
  debugInfo(): {
    isHost: boolean;
    entityCount: number;
    syncEnabledCount: number;
    interpolatingCount: number;
  } {
    let syncEnabled = 0;
    let interpolating = 0;
    this.registry.forEach((reg) => {
      if (reg.options.syncEnabled) syncEnabled++;
      if (reg.options.syncEnabled && reg.options.interpolate) interpolating++;
    });
    return {
      isHost: this.isHost,
      entityCount: this.registry.size,
      syncEnabledCount: syncEnabled,
      interpolatingCount: interpolating,
    };
  }
}
