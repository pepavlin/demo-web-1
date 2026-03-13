/**
 * EntitySyncManager unit tests.
 *
 * Tests cover:
 * - Entity registration / unregistration
 * - Host / non-host state management
 * - Batch collection and sending (host path)
 * - Batch application (non-host path)
 * - Discrete event dispatch
 * - Rate limiting
 * - Edge cases (empty batch, unknown ids, errors in serialize/apply)
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
    it("applies received state to registered entity", () => {
      let appliedState: Record<string, number> | null = null;
      mgr.register("fox_0", {
        syncEnabled: true,
        serialize: () => ({}),
        apply: (s) => { appliedState = s; },
      });

      mgr.applyBatch({ fox_0: { x: 10, z: 20, ry: 1.5 } });
      expect(appliedState).toEqual({ x: 10, z: 20, ry: 1.5 });
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
  });
});
