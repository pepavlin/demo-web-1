/**
 * @jest-environment jsdom
 */

// ── Mock socket.io-client ─────────────────────────────────────────────────────
const mockSocket = {
  connected: false,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => mockSocket),
}));

import React from "react";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useMultiplayer } from "../hooks/useMultiplayer";
import { io } from "socket.io-client";

describe("useMultiplayer hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.connected = false;
  });

  it("calls io() on mount", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    expect(io).toHaveBeenCalled();
  });

  it("disconnects socket on unmount", () => {
    const { unmount } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it("registers connect event listener", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("connect");
  });

  it("registers players:init event listener", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("players:init");
  });

  it("registers player:joined event listener", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:joined");
  });

  it("registers player:update event listener", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:update");
  });

  it("registers player:left event listener", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:left");
  });

  it("emits player:join on connect with player name", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "Alice" })
    );
    // Find the connect handler and call it
    const connectCall = mockSocket.on.mock.calls.find((c) => c[0] === "connect");
    expect(connectCall).toBeDefined();
    act(() => { connectCall![1](); });
    expect(mockSocket.emit).toHaveBeenCalledWith("player:join", { name: "Alice" });
  });

  it("calls onInit when players:init is received (new format with hostId)", () => {
    const onInit = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onInit })
    );
    const initCall = mockSocket.on.mock.calls.find((c) => c[0] === "players:init");
    const mockPlayers = { abc: { id: "abc", name: "Bob", x: 1, y: 2, z: 3, rotY: 0, pitch: 0, color: 0xff0000 } };
    // New format: server sends { players, hostId }
    act(() => { initCall![1]({ players: mockPlayers, hostId: "socket-host-id" }); });
    expect(onInit).toHaveBeenCalledWith(mockPlayers, "socket-host-id");
  });

  it("calls onInit with legacy format (plain record without hostId)", () => {
    const onInit = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onInit })
    );
    const initCall = mockSocket.on.mock.calls.find((c) => c[0] === "players:init");
    // Legacy: server sends plain record (backwards compatibility)
    const mockPlayers = { abc: { id: "abc", name: "Bob", x: 1, y: 2, z: 3, rotY: 0, pitch: 0, color: 0xff0000 } };
    act(() => { initCall![1](mockPlayers); });
    expect(onInit).toHaveBeenCalledWith(mockPlayers, null);
  });

  it("calls onPlayerJoined when player:joined fires", () => {
    const onPlayerJoined = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onPlayerJoined })
    );
    const joinedCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:joined");
    const newPlayer = { id: "xyz", name: "Carol", x: 5, y: 2, z: 5, rotY: 1, pitch: 0, color: 0x00ff00 };
    act(() => { joinedCall![1](newPlayer); });
    expect(onPlayerJoined).toHaveBeenCalledWith(newPlayer);
  });

  it("calls onPlayerLeft when player:left fires", () => {
    const onPlayerLeft = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onPlayerLeft })
    );
    const leftCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:left");
    act(() => { leftCall![1]({ id: "xyz" }); });
    expect(onPlayerLeft).toHaveBeenCalledWith("xyz");
  });

  it("calls onPlayerUpdated when player:update fires", () => {
    const onPlayerUpdated = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onPlayerUpdated })
    );
    const updateCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:update");
    const updateData = { id: "abc", x: 10, y: 2, z: 10, rotY: 0.5, pitch: 0.1, color: 0 };
    act(() => { updateCall![1](updateData); });
    expect(onPlayerUpdated).toHaveBeenCalledWith("abc", { x: 10, y: 2, z: 10, rotY: 0.5, pitch: 0.1, color: 0 });
  });

  it("returns a sendUpdate function", () => {
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    expect(typeof result.current.sendUpdate).toBe("function");
  });

  it("sendUpdate emits player:update to socket when enough time has passed", () => {
    jest.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(1000);
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    act(() => {
      result.current.sendUpdate({ x: 1, y: 2, z: 3, rotY: 0.5, pitch: 0.1 });
    });
    expect(mockSocket.emit).toHaveBeenCalledWith("player:update", {
      x: 1, y: 2, z: 3, rotY: 0.5, pitch: 0.1,
    });
  });

  it("sendUpdate includes weapon and isAttacking fields when provided", () => {
    jest.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(1000);
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    act(() => {
      result.current.sendUpdate({ x: 1, y: 2, z: 3, rotY: 0.5, pitch: 0.1, weapon: "bow", isAttacking: true });
    });
    expect(mockSocket.emit).toHaveBeenCalledWith("player:update", {
      x: 1, y: 2, z: 3, rotY: 0.5, pitch: 0.1, weapon: "bow", isAttacking: true,
    });
  });

  it("calls onPlayerUpdated with weapon and isAttacking when player:update fires with those fields", () => {
    const onPlayerUpdated = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onPlayerUpdated })
    );
    const updateCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:update");
    const updateData = { id: "abc", x: 10, y: 2, z: 10, rotY: 0.5, pitch: 0.1, color: 0, weapon: "sword", isAttacking: false };
    act(() => { updateCall![1](updateData); });
    expect(onPlayerUpdated).toHaveBeenCalledWith("abc", expect.objectContaining({ weapon: "sword", isAttacking: false }));
  });

  it("returns isConnected function that reflects socket.connected", () => {
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    mockSocket.connected = false;
    expect(result.current.isConnected()).toBe(false);
    mockSocket.connected = true;
    expect(result.current.isConnected()).toBe(true);
  });

  // ── PvP tests ──────────────────────────────────────────────────────────────

  it("registers player:damaged event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:damaged");
  });

  it("registers player:killed_by event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:killed_by");
  });

  it("registers player:got_kill event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:got_kill");
  });

  it("registers player:hp_update event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:hp_update");
  });

  it("registers player:respawn event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("player:respawn");
  });

  it("calls onPlayerDamaged when player:damaged fires", () => {
    const onPlayerDamaged = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onPlayerDamaged }));
    const damagedCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:damaged");
    act(() => { damagedCall![1]({ damage: 40, attackerId: "attacker1", attackerName: "Alice" }); });
    expect(onPlayerDamaged).toHaveBeenCalledWith(40, "Alice");
  });

  it("calls onPlayerKilledBy when player:killed_by fires", () => {
    const onPlayerKilledBy = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onPlayerKilledBy }));
    const killedCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:killed_by");
    act(() => { killedCall![1]({ killerName: "Bob" }); });
    expect(onPlayerKilledBy).toHaveBeenCalledWith("Bob");
  });

  it("calls onGotKill when player:got_kill fires", () => {
    const onGotKill = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onGotKill }));
    const gotKillCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:got_kill");
    act(() => { gotKillCall![1]({ victimName: "Enemy" }); });
    expect(onGotKill).toHaveBeenCalledWith("Enemy");
  });

  it("calls onPlayerHpUpdate when player:hp_update fires", () => {
    const onPlayerHpUpdate = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onPlayerHpUpdate }));
    const hpUpdateCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:hp_update");
    act(() => { hpUpdateCall![1]({ id: "player123", hp: 60 }); });
    expect(onPlayerHpUpdate).toHaveBeenCalledWith("player123", 60);
  });

  it("calls onRespawn when player:respawn fires", () => {
    const onRespawn = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onRespawn }));
    const respawnCall = mockSocket.on.mock.calls.find((c) => c[0] === "player:respawn");
    act(() => { respawnCall![1](); });
    expect(onRespawn).toHaveBeenCalled();
  });

  it("returns a sendHit function", () => {
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    expect(typeof result.current.sendHit).toBe("function");
  });

  it("sendHit emits player:hit to socket with target, damage and weaponType", () => {
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    act(() => {
      result.current.sendHit("target-socket-id", 85, "crossbow");
    });
    expect(mockSocket.emit).toHaveBeenCalledWith("player:hit", {
      targetId: "target-socket-id",
      damage: 85,
      weaponType: "crossbow",
    });
  });

  // ── Entity sync tests ───────────────────────────────────────────────────────

  it("registers entity:batch event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const events = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(events).toContain("entity:batch");
  });

  it("registers entity:event event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const events = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(events).toContain("entity:event");
  });

  it("registers host:changed event listener", () => {
    renderHook(() => useMultiplayer({ playerName: "TestPlayer" }));
    const events = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(events).toContain("host:changed");
  });

  it("calls onEntityBatch when entity:batch fires", () => {
    const onEntityBatch = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onEntityBatch }));
    const batchCall = mockSocket.on.mock.calls.find((c) => c[0] === "entity:batch");
    const batch = { sheep_0: { x: 10, z: 20, a: 1.5, f: 0, g: 0, b: 0, bt: 0 } };
    act(() => { batchCall![1](batch); });
    expect(onEntityBatch).toHaveBeenCalledWith(batch);
  });

  it("calls onEntityEvent when entity:event fires", () => {
    const onEntityEvent = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onEntityEvent }));
    const eventCall = mockSocket.on.mock.calls.find((c) => c[0] === "entity:event");
    const event = { id: "sheep_5", type: "death", payload: { score: 1 } };
    act(() => { eventCall![1](event); });
    expect(onEntityEvent).toHaveBeenCalledWith(event);
  });

  it("calls onHostChanged when host:changed fires", () => {
    const onHostChanged = jest.fn();
    renderHook(() => useMultiplayer({ playerName: "TestPlayer", onHostChanged }));
    const hostCall = mockSocket.on.mock.calls.find((c) => c[0] === "host:changed");
    act(() => { hostCall![1]({ hostId: "new-host-id" }); });
    expect(onHostChanged).toHaveBeenCalledWith("new-host-id");
  });

  it("returns sendEntityBatch function that emits entity:batch", () => {
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const batch = { fox_0: { x: 5, z: 3, ry: 0.7 } };
    act(() => { result.current.sendEntityBatch(batch); });
    expect(mockSocket.emit).toHaveBeenCalledWith("entity:batch", batch);
  });

  it("returns sendEntityEvent function that emits entity:event", () => {
    const { result } = renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const event = { id: "rocket", type: "rocket_state", payload: { state: "launching" } };
    act(() => { result.current.sendEntityEvent(event); });
    expect(mockSocket.emit).toHaveBeenCalledWith("entity:event", event);
  });

  // ── crate:spawn (player-join airdrop) ────────────────────────────────────────

  it("registers crate:spawn event listener", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("crate:spawn");
  });

  it("calls onCrateSpawn with correct data when crate:spawn fires", () => {
    const onCrateSpawn = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onCrateSpawn })
    );
    const crateCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:spawn");
    const payload = { x: 15.5, z: -8.3, playerName: "AliceTest" };
    act(() => { crateCall![1](payload); });
    expect(onCrateSpawn).toHaveBeenCalledWith(payload);
  });

  it("onCrateSpawn receives correct x/z coordinates", () => {
    const onCrateSpawn = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onCrateSpawn })
    );
    const crateCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:spawn");
    act(() => { crateCall![1]({ x: 42, z: -7, playerName: "Bob" }); });
    expect(onCrateSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ x: 42, z: -7 })
    );
  });

  it("onCrateSpawn receives playerName from the server payload", () => {
    const onCrateSpawn = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onCrateSpawn })
    );
    const crateCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:spawn");
    act(() => { crateCall![1]({ x: 0, z: 0, playerName: "Vojta" }); });
    expect(onCrateSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ playerName: "Vojta" })
    );
  });

  it("does not throw when crate:spawn fires without onCrateSpawn callback", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const crateCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:spawn");
    expect(() => act(() => { crateCall![1]({ x: 1, z: 2, playerName: "X" }); })).not.toThrow();
  });

  // ── crate:timer (HUD countdown sync) ─────────────────────────────────────────

  it("registers crate:timer event listener", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(registeredEvents).toContain("crate:timer");
  });

  it("calls onCrateTimer with elapsed seconds when crate:timer fires", () => {
    const onCrateTimer = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onCrateTimer })
    );
    const timerCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:timer");
    act(() => { timerCall![1]({ elapsed: 18.5 }); });
    expect(onCrateTimer).toHaveBeenCalledWith(18.5);
  });

  it("calls onCrateTimer with elapsed=0 when periodic drop resets the countdown", () => {
    const onCrateTimer = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onCrateTimer })
    );
    const timerCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:timer");
    // Server resets all HUD countdowns to 0 after each periodic drop
    act(() => { timerCall![1]({ elapsed: 0 }); });
    expect(onCrateTimer).toHaveBeenCalledWith(0);
  });

  it("does not throw when crate:timer fires without onCrateTimer callback", () => {
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer" })
    );
    const timerCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:timer");
    expect(() => act(() => { timerCall![1]({ elapsed: 20 }); })).not.toThrow();
  });

  it("crate:spawn with empty playerName represents a periodic (server-scheduled) drop", () => {
    // Periodic drops use an empty playerName so the client can show a generic
    // notification rather than "Zásoby pro <player> padají z nebe!".
    const onCrateSpawn = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onCrateSpawn })
    );
    const crateCall = mockSocket.on.mock.calls.find((c) => c[0] === "crate:spawn");
    act(() => { crateCall![1]({ x: 30, z: 45, playerName: "" }); });
    expect(onCrateSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ playerName: "" })
    );
  });
});
