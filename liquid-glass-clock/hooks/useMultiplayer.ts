"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  pitch: number;
  color: number;
  hp?: number;
}

export interface PlayerUpdate {
  x: number;
  y: number;
  z: number;
  rotY: number;
  pitch: number;
  hp?: number;
}

export interface ChatMessage {
  id: string;
  name: string;
  color: number;
  text: string;
  ts: number;
}

export interface UseMultiplayerOptions {
  playerName: string;
  onInit?: (players: Record<string, RemotePlayer>) => void;
  onPlayerJoined?: (player: RemotePlayer) => void;
  onPlayerLeft?: (id: string) => void;
  onPlayerUpdated?: (id: string, update: PlayerUpdate) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  /** Called when this local player takes damage from another player. */
  onPlayerDamaged?: (damage: number, attackerName: string) => void;
  /** Called when this local player is killed by another player. */
  onPlayerKilledBy?: (killerName: string) => void;
  /** Called when this local player kills another player. */
  onGotKill?: (victimName: string) => void;
  /** Called when any remote player's HP changes (for health bar updates). */
  onPlayerHpUpdate?: (id: string, hp: number) => void;
  /** Called when this local player should respawn (server-triggered). */
  onRespawn?: () => void;
}

export interface UseMultiplayerReturn {
  sendUpdate: (update: PlayerUpdate) => void;
  sendChat: (text: string) => void;
  sendHit: (targetId: string, damage: number, weaponType: string) => void;
  isConnected: () => boolean;
}

export function useMultiplayer({
  playerName,
  onInit,
  onPlayerJoined,
  onPlayerLeft,
  onPlayerUpdated,
  onChatMessage,
  onPlayerDamaged,
  onPlayerKilledBy,
  onGotKill,
  onPlayerHpUpdate,
  onRespawn,
}: UseMultiplayerOptions): UseMultiplayerReturn {
  const socketRef = useRef<Socket | null>(null);
  const lastUpdateTimeRef = useRef(0);
  // Store callbacks in refs so they never cause the effect to re-run
  const onInitRef = useRef(onInit);
  const onJoinedRef = useRef(onPlayerJoined);
  const onLeftRef = useRef(onPlayerLeft);
  const onUpdatedRef = useRef(onPlayerUpdated);
  const onChatRef = useRef(onChatMessage);
  const onPlayerDamagedRef = useRef(onPlayerDamaged);
  const onPlayerKilledByRef = useRef(onPlayerKilledBy);
  const onGotKillRef = useRef(onGotKill);
  const onPlayerHpUpdateRef = useRef(onPlayerHpUpdate);
  const onRespawnRef = useRef(onRespawn);

  // Update all callback refs in a single effect — avoids many separate render-phase effects
  useEffect(() => {
    onInitRef.current           = onInit;
    onJoinedRef.current         = onPlayerJoined;
    onLeftRef.current           = onPlayerLeft;
    onUpdatedRef.current        = onPlayerUpdated;
    onChatRef.current           = onChatMessage;
    onPlayerDamagedRef.current  = onPlayerDamaged;
    onPlayerKilledByRef.current = onPlayerKilledBy;
    onGotKillRef.current        = onGotKill;
    onPlayerHpUpdateRef.current = onPlayerHpUpdate;
    onRespawnRef.current        = onRespawn;
  });

  useEffect(() => {
    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("player:join", { name: playerName });
    });

    socket.on("players:init", (players: Record<string, RemotePlayer>) => {
      onInitRef.current?.(players);
    });

    socket.on("player:joined", (player: RemotePlayer) => {
      onJoinedRef.current?.(player);
    });

    socket.on("player:update", (data: RemotePlayer & { id: string }) => {
      const { id, ...update } = data;
      onUpdatedRef.current?.(id, update);
    });

    socket.on("player:left", ({ id }: { id: string }) => {
      onLeftRef.current?.(id);
    });

    socket.on("chat:message", (msg: ChatMessage) => {
      onChatRef.current?.(msg);
    });

    // ── PvP events ────────────────────────────────────────────────────────────

    socket.on("player:damaged", ({ damage, attackerName }: { damage: number; attackerName: string }) => {
      onPlayerDamagedRef.current?.(damage, attackerName);
    });

    socket.on("player:killed_by", ({ killerName }: { killerName: string }) => {
      onPlayerKilledByRef.current?.(killerName);
    });

    socket.on("player:got_kill", ({ victimName }: { victimName: string }) => {
      onGotKillRef.current?.(victimName);
    });

    socket.on("player:hp_update", ({ id, hp }: { id: string; hp: number }) => {
      onPlayerHpUpdateRef.current?.(id, hp);
    });

    socket.on("player:respawn", () => {
      onRespawnRef.current?.();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [playerName]);

  // Throttled position update — max 20 packets/sec
  const sendUpdate = useCallback((update: PlayerUpdate) => {
    const now = performance.now();
    if (now - lastUpdateTimeRef.current < 50) return;
    lastUpdateTimeRef.current = now;
    socketRef.current?.emit("player:update", update);
  }, []);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit("player:chat", { text });
  }, []);

  /** Send a hit notification to the server for PvP damage. */
  const sendHit = useCallback((targetId: string, damage: number, weaponType: string) => {
    socketRef.current?.emit("player:hit", { targetId, damage, weaponType });
  }, []);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return { sendUpdate, sendChat, sendHit, isConnected };
}
