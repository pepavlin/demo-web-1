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

  it("calls onInit when players:init is received", () => {
    const onInit = jest.fn();
    renderHook(() =>
      useMultiplayer({ playerName: "TestPlayer", onInit })
    );
    const initCall = mockSocket.on.mock.calls.find((c) => c[0] === "players:init");
    const mockPlayers = { abc: { id: "abc", name: "Bob", x: 1, y: 2, z: 3, rotY: 0, pitch: 0, color: 0xff0000 } };
    act(() => { initCall![1](mockPlayers); });
    expect(onInit).toHaveBeenCalledWith(mockPlayers);
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
});
