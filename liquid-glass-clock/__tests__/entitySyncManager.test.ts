/**
 * EntitySyncManager unit tests.
 *
 * Tests cover:
 * - Entity registration / unregistration
 * - Host / non-host state management
 * - Batch collection and sending (host path)
 * - Batch application (non-host path)
 * - Smooth interpolation via interpolate + smoothStep
 * - Discrete event dispatch
 * - Rate limiting
 * - Edge cases (empty batch, unknown ids, errors in serialize/apply/interpolate)
 */

import { EntitySyncManager } from "../lib/entitySyncManager";

describe("EntitySyncManager", () => {
  let mgr: EntitySyncManager;

  beforeEach(() => {
    mgr = new EntitySyncManager();
  });

  afterEach(() => {
    mgr.clear();
  });

  // ── Registration ─────────────────────────────────────────────────────────────

  describe("register / unregister", () => {
    it("registers an entity and returns correct size", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({ x: 1, z: 2 }),
        apply: () => {},
      });
      expect(mgr.size).toBe(1);
      expect(mgr.has("sheep_0")).toBe(true);
    });

    it("unregisters an entity", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
      });
      mgr.unregister("sheep_0");
      expect(mgr.size).toBe(0);
      expect(mgr.has("sheep_0")).toBe(false);
    });

    it("re-registering an id updates options in place", () => {
      let callCount = 0;
      mgr.register("e", {
        syncEnabled: true,
        serialize: () => ({ v: ++callCount }),
        apply: () => {},
      });
      // Re-register with new serialize
      mgr.register("e", {
        syncEnabled: true,
        serialize: () => ({ v: 99 }),
        apply: () => {},
      });
      expect(mgr.size).toBe(1);
    });

    it("registeredIds returns all registered entity ids", () => {
      mgr.register("a", { syncEnabled: true, serialize: () => ({}), apply: () => {} });
      mgr.register("b", { syncEnabled: true, serialize: () => ({}), apply: () => {} });
      const ids = mgr.registeredIds();
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toHaveLength(2);
    });

    it("unregister also clears the interpolation target for that entity", () => {
      let pos = 0;
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({ x: pos }),
        apply: (s) => { pos = s.x; },
        interpolate: (s, dt) => { pos += (s.x - pos) * dt; },
      });
      mgr.applyBatch({ sheep_0: { x: 100 } });
      mgr.unregister("sheep_0");
      // smoothStep should not crash and should not update pos
      const before = pos;
      mgr.smoothStep(0.016);
      expect(pos).toBe(before);
    });
  });

  // ── Host management ───────────────────────────────────────────────────────────

  describe("setIsHost / getIsHost", () => {
    it("starts as non-host", () => {
      expect(mgr.getIsHost()).toBe(false);
    });

    it("becomes host after setIsHost(true)", () => {
      mgr.setIsHost(true);
      expect(mgr.getIsHost()).toBe(true);
    });

    it("resets lastSentMs when becoming host so first frame triggers send", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({ x: 1 }),
        apply: () => {},
      });
      // Simulate entity having been sent recently (lastSentMs set to now)
      mgr.setIsHost(true);
      // Immediately after becoming host with now=0 the timer should be at 0
      // meaning the next collect call at now=1 should send
      const batches: Record<string, Record<string, number>>[] = [];
      mgr.collectAndSend((b) => batches.push(b), 1);
      expect(batches).toHaveLength(1);
    });

    it("clears interpolation targets when becoming host", () => {
      let pos = 0;
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({ x: pos }),
        apply: (s) => { pos = s.x; },
        interpolate: (s, dt) => { pos += (s.x - pos) * (15 * dt); },
      });
      // Receive a target as non-host
      mgr.applyBatch({ sheep_0: { x: 50 } });
      // Become host — targets should be cleared
      mgr.setIsHost(true);
      // smoothStep should not run (host) — pos should stay 0
      mgr.smoothStep(0.016);
      expect(pos).toBe(0);
    });
  });

  // ── Batch collection (host path) ──────────────────────────────────────────────

  describe("collectAndSend (host)", () => {
    beforeEach(() => {
      mgr.setIsHost(true);
    });

    it("sends entities that are due (past their interval)", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        syncRate: 10, // 100 ms interval
        serialize: () => ({ x: 5, z: 3 }),
        apply: () => {},
      });

      const batches: Record<string, Record<string, number>>[] = [];
      // First call at t=0 — entity was never sent (lastSentMs=0) so it's due
      mgr.collectAndSend((b) => batches.push(b), 0);
      expect(batches).toHaveLength(1);
      expect(batches[0]["sheep_0"]).toEqual({ x: 5, z: 3 });
    });

    it("does not re-send entity before its interval elapses", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        syncRate: 10, // 100 ms interval
        serialize: () => ({ x: 1 }),
        apply: () => {},
      });

      const batches: Record<string, Record<string, number>>[] = [];
      mgr.collectAndSend((b) => batches.push(b), 0);   // sends
      mgr.collectAndSend((b) => batches.push(b), 50);  // 50 ms later — too soon
      expect(batches).toHaveLength(1);
    });

    it("re-sends entity after interval elapses", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        syncRate: 10, // 100 ms interval
        serialize: () => ({ x: 1 }),
        apply: () => {},
      });

      const batches: Record<string, Record<string, number>>[] = [];
      mgr.collectAndSend((b) => batches.push(b), 0);    // sends (t=0)
      mgr.collectAndSend((b) => batches.push(b), 101);  // 101 ms later — due again
      expect(batches).toHaveLength(2);
    });

    it("does not call batchSender when no entities are due", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        syncRate: 10,
        serialize: () => ({ x: 1 }),
        apply: () => {},
      });

      const sender = jest.fn();
      mgr.collectAndSend(sender, 0);   // sends first batch
      mgr.collectAndSend(sender, 10);  // too soon — no call
      expect(sender).toHaveBeenCalledTimes(1);
    });

    it("skips entities with syncEnabled=false", () => {
      mgr.register("sheep_0", {
        syncEnabled: false,
        serialize: () => ({ x: 99 }),
        apply: () => {},
      });

      const batches: Record<string, Record<string, number>>[] = [];
      mgr.collectAndSend((b) => batches.push(b), 0);
      expect(batches).toHaveLength(0);
    });

    it("does not send when not the host", () => {
      // mgr is host by default in this describe block; reset it
      mgr.setIsHost(false);
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({ x: 1 }),
        apply: () => {},
      });

      const sender = jest.fn();
      mgr.collectAndSend(sender, 0);
      expect(sender).not.toHaveBeenCalled();
    });

    it("silently skips entities whose serialize throws", () => {
      mgr.register("bad_entity", {
        syncEnabled: true,
        serialize: () => { throw new Error("serialize failed"); },
        apply: () => {},
      });
      mgr.register("good_entity", {
        syncEnabled: true,
        serialize: () => ({ x: 1 }),
        apply: () => {},
      });

      const batches: Record<string, Record<string, number>>[] = [];
      expect(() => mgr.collectAndSend((b) => batches.push(b), 0)).not.toThrow();
      expect(batches[0]).not.toHaveProperty("bad_entity");
      expect(batches[0]).toHaveProperty("good_entity");
    });
  });

  // ── Batch application (non-host path) ────────────────────────────────────────

  describe("applyBatch (non-host)", () => {
    it("applies received state to registered entity (no interpolate)", () => {
      let appliedState: Record<string, number> | null = null;
      mgr.register("fox_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: (s) => { appliedState = s; },
      });

      mgr.applyBatch({ fox_0: { x: 10, z: 20, ry: 1.5 } });
      expect(appliedState).toEqual({ x: 10, z: 20, ry: 1.5 });
    });

    it("stores state as interpolation target (not calling apply) when interpolate defined", () => {
      let applyCalled = false;
      let interpolateCalled = false;

      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => { applyCalled = true; },
        interpolate: (_s, _dt) => { interpolateCalled = true; },
      });

      mgr.applyBatch({ sheep_0: { x: 5, z: 10 } });
      // apply should NOT be called when interpolate is defined
      expect(applyCalled).toBe(false);
      // interpolate is not called yet — smoothStep() triggers it
      expect(interpolateCalled).toBe(false);
    });

    it("ignores unknown entity ids in batch", () => {
      expect(() => {
        mgr.applyBatch({ unknown_entity: { x: 5 } });
      }).not.toThrow();
    });

    it("ignores entities with syncEnabled=false", () => {
      let called = false;
      mgr.register("sheep_0", {
        syncEnabled: false,
        serialize: () => ({}),
        apply: () => { called = true; },
      });

      mgr.applyBatch({ sheep_0: { x: 1 } });
      expect(called).toBe(false);
    });

    it("does not apply batch when client is the host", () => {
      mgr.setIsHost(true);
      let called = false;
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => { called = true; },
      });

      mgr.applyBatch({ sheep_0: { x: 1 } });
      expect(called).toBe(false);
    });

    it("silently handles apply errors", () => {
      mgr.register("bad", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => { throw new Error("apply failed"); },
      });

      expect(() => mgr.applyBatch({ bad: { x: 1 } })).not.toThrow();
    });
  });

  // ── Smooth interpolation (smoothStep) ────────────────────────────────────────

  describe("smoothStep (non-host interpolation)", () => {
    it("calls interpolate with target state and dt after applyBatch", () => {
      const interpolate = jest.fn();
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate,
      });

      const target = { x: 5, z: 10 };
      mgr.applyBatch({ sheep_0: target });
      mgr.smoothStep(0.016);

      expect(interpolate).toHaveBeenCalledTimes(1);
      expect(interpolate).toHaveBeenCalledWith(target, 0.016);
    });

    it("moves value toward target over multiple frames (exponential lerp)", () => {
      let pos = 0;
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({ x: pos }),
        apply: (s) => { pos = s.x; },
        interpolate: (s, dt) => {
          const alpha = 1 - Math.exp(-15 * dt);
          pos += (s.x - pos) * alpha;
        },
      });

      mgr.applyBatch({ sheep_0: { x: 100 } });

      // After 10 frames at 16ms each, position should be much closer to 100
      for (let i = 0; i < 10; i++) {
        mgr.smoothStep(0.016);
      }

      expect(pos).toBeGreaterThan(80);
      expect(pos).toBeLessThan(100);
    });

    it("does not call interpolate when client is the host", () => {
      mgr.setIsHost(true);
      const interpolate = jest.fn();
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate,
      });

      // Host cannot receive batches (applyBatch is a no-op for host)
      // but smoothStep should also be a no-op
      mgr.smoothStep(0.016);
      expect(interpolate).not.toHaveBeenCalled();
    });

    it("does not call interpolate for entities with syncEnabled=false", () => {
      const interpolate = jest.fn();
      mgr.register("sheep_0", {
        syncEnabled: false,
        serialize: () => ({}),
        apply: () => {},
        interpolate,
      });

      // Force a target manually to test the syncEnabled guard in smoothStep
      // (normally applyBatch would not store it because syncEnabled=false,
      // but we test via a re-register trick)
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate,
      });
      mgr.applyBatch({ sheep_0: { x: 1 } });
      // Now disable sync
      mgr.register("sheep_0", {
        syncEnabled: false,
        serialize: () => ({}),
        apply: () => {},
        interpolate,
      });
      mgr.smoothStep(0.016);
      expect(interpolate).not.toHaveBeenCalled();
    });

    it("silently handles errors thrown in interpolate", () => {
      mgr.register("bad", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate: () => { throw new Error("interpolate failed"); },
      });

      mgr.applyBatch({ bad: { x: 1 } });
      expect(() => mgr.smoothStep(0.016)).not.toThrow();
    });

    it("smoothStep is no-op when no targets are stored", () => {
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate: jest.fn(),
      });
      // Don't call applyBatch — no targets stored
      const interpolate = mgr["registry"].get("sheep_0")!.options.interpolate as jest.Mock;
      mgr.smoothStep(0.016);
      expect(interpolate).not.toHaveBeenCalled();
    });

    it("interpolation target persists across multiple smoothStep calls", () => {
      const calls: number[] = [];
      let pos = 0;
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate: (s) => { calls.push(s.x); pos = s.x; },
      });

      mgr.applyBatch({ sheep_0: { x: 42 } });
      mgr.smoothStep(0.016);
      mgr.smoothStep(0.016);
      mgr.smoothStep(0.016);

      // interpolate called each frame with the same target until updated
      expect(calls).toHaveLength(3);
      expect(calls.every(v => v === 42)).toBe(true);
    });

    it("updates target when a new batch arrives", () => {
      const receivedTargets: number[] = [];
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate: (s) => { receivedTargets.push(s.x); },
      });

      mgr.applyBatch({ sheep_0: { x: 10 } });
      mgr.smoothStep(0.016);

      mgr.applyBatch({ sheep_0: { x: 20 } });
      mgr.smoothStep(0.016);

      expect(receivedTargets[0]).toBe(10);
      expect(receivedTargets[1]).toBe(20);
    });
  });

  // ── Discrete entity events ─────────────────────────────────────────────────

  describe("onEvent / applyEvent", () => {
    it("calls registered handler on applyEvent", () => {
      const handler = jest.fn();
      mgr.onEvent("death", handler);
      mgr.applyEvent({ id: "sheep_5", type: "death", payload: { score: 10 } });
      expect(handler).toHaveBeenCalledWith("sheep_5", { score: 10 });
    });

    it("calls multiple handlers for the same event type", () => {
      const h1 = jest.fn();
      const h2 = jest.fn();
      mgr.onEvent("burn", h1);
      mgr.onEvent("burn", h2);
      mgr.applyEvent({ id: "fox_0", type: "burn" });
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it("does not call handlers for different event types", () => {
      const handler = jest.fn();
      mgr.onEvent("death", handler);
      mgr.applyEvent({ id: "sheep_0", type: "burn" });
      expect(handler).not.toHaveBeenCalled();
    });

    it("silently ignores applyEvent for unregistered event types", () => {
      expect(() => mgr.applyEvent({ id: "x", type: "nonexistent" })).not.toThrow();
    });

    it("silently handles errors thrown in event handlers", () => {
      mgr.onEvent("crash", () => { throw new Error("handler error"); });
      expect(() => mgr.applyEvent({ id: "x", type: "crash" })).not.toThrow();
    });

    it("offEvent removes all handlers for a type", () => {
      const handler = jest.fn();
      mgr.onEvent("death", handler);
      mgr.offEvent("death");
      mgr.applyEvent({ id: "y", type: "death" });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── Multiple entities with different rates ────────────────────────────────────

  describe("multi-entity batch with different rates", () => {
    it("batches multiple due entities in a single send", () => {
      mgr.setIsHost(true);
      mgr.register("sheep_0", { syncEnabled: true, syncRate: 10, serialize: () => ({ x: 1 }), apply: () => {} });
      mgr.register("fox_0", { syncEnabled: true, syncRate: 10, serialize: () => ({ x: 2 }), apply: () => {} });

      const batches: Record<string, Record<string, number>>[] = [];
      mgr.collectAndSend((b) => batches.push(b), 0);

      expect(batches).toHaveLength(1);
      expect(Object.keys(batches[0])).toEqual(expect.arrayContaining(["sheep_0", "fox_0"]));
    });

    it("sends only entities that are due in a partial tick", () => {
      mgr.setIsHost(true);
      // 20 Hz entity — sends every 50 ms
      mgr.register("fast", { syncEnabled: true, syncRate: 20, serialize: () => ({ x: 1 }), apply: () => {} });
      // 2 Hz entity — sends every 500 ms
      mgr.register("slow", { syncEnabled: true, syncRate: 2, serialize: () => ({ x: 2 }), apply: () => {} });

      const sender = jest.fn();
      // t=0: both due (lastSentMs=0), both sent
      mgr.collectAndSend(sender, 0);
      expect(sender).toHaveBeenCalledTimes(1);
      const firstBatch = sender.mock.calls[0][0];
      expect(firstBatch).toHaveProperty("fast");
      expect(firstBatch).toHaveProperty("slow");

      // t=60ms: fast (50ms interval) is due again, slow (500ms) is not
      mgr.collectAndSend(sender, 60);
      expect(sender).toHaveBeenCalledTimes(2);
      const secondBatch = sender.mock.calls[1][0];
      expect(secondBatch).toHaveProperty("fast");
      expect(secondBatch).not.toHaveProperty("slow");
    });
  });

  // ── clear / debugInfo ─────────────────────────────────────────────────────────

  describe("clear", () => {
    it("removes all registered entities", () => {
      mgr.register("a", { syncEnabled: true, serialize: () => ({}), apply: () => {} });
      mgr.register("b", { syncEnabled: true, serialize: () => ({}), apply: () => {} });
      mgr.clear();
      expect(mgr.size).toBe(0);
    });

    it("resets isHost to false", () => {
      mgr.setIsHost(true);
      mgr.clear();
      expect(mgr.getIsHost()).toBe(false);
    });

    it("clears interpolation targets on clear()", () => {
      const interpolate = jest.fn();
      mgr.register("sheep_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate,
      });
      mgr.applyBatch({ sheep_0: { x: 10 } });
      mgr.clear();
      // After clear, smoothStep should not call interpolate (no targets, no registrations)
      mgr.smoothStep(0.016);
      expect(interpolate).not.toHaveBeenCalled();
    });
  });

  describe("debugInfo", () => {
    it("returns correct entity count and syncEnabled count", () => {
      mgr.register("a", { syncEnabled: true, serialize: () => ({}), apply: () => {} });
      mgr.register("b", { syncEnabled: false, serialize: () => ({}), apply: () => {} });
      const info = mgr.debugInfo();
      expect(info.entityCount).toBe(2);
      expect(info.syncEnabledCount).toBe(1);
    });

    it("reflects current host state", () => {
      mgr.setIsHost(true);
      expect(mgr.debugInfo().isHost).toBe(true);
    });

    it("counts interpolating entities correctly", () => {
      mgr.register("a", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        interpolate: () => {},
      });
      mgr.register("b", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: () => {},
        // no interpolate
      });
      mgr.register("c", {
        syncEnabled: false,
        serialize: () => ({}),
        apply: () => {},
        interpolate: () => {}, // disabled — should not count
      });
      const info = mgr.debugInfo();
      expect(info.interpolatingCount).toBe(1); // only "a": syncEnabled=true + has interpolate
    });
  });
});
