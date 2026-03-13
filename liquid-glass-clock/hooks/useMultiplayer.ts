"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { EntityBatch, EntityEvent } from "@/lib/entitySyncManager";

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
  onInit?: (players: Record<string, RemotePlayer>, hostId: string | null) => void;
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
  /**
   * Called when a batch of entity states arrives from the host.
   * Non-host clients should apply these to their local entity instances.
   */
  onEntityBatch?: (batch: EntityBatch) => void;
  /**
   * Called when a discrete entity event arrives from the host (e.g. death).
   * Both host and non-host clients can handle these.
   */
  onEntityEvent?: (event: EntityEvent) => void;
  /**
   * Called when the simulation host changes.
   * `hostId` is the socket id of the new host (or null if no players remain).
   */
  onHostChanged?: (hostId: string | null) => void;
}

export interface UseMultiplayerReturn {
  sendUpdate: (update: PlayerUpdate) => void;
  sendChat: (text: string) => void;
  sendHit: (targetId: string, damage: number, weaponType: string) => void;
  /**
   * Send a batch of entity states to all other clients (host only).
   * The server will relay the batch to all connected non-host clients.
   */
  sendEntityBatch: (batch: EntityBatch) => void;
  /**
   * Send a discrete entity event to all other clients (host only).
   * Use for important one-off state changes (e.g. entity death, state machine transitions).
   */
  sendEntityEvent: (event: EntityEvent) => void;
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
  onEntityBatch,
  onEntityEvent,
  onHostChanged,
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
  const onEntityBatchRef = useRef(onEntityBatch);
  const onEntityEventRef = useRef(onEntityEvent);
  const onHostChangedRef = useRef(onHostChanged);

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
    onEntityBatchRef.current    = onEntityBatch;
    onEntityEventRef.current    = onEntityEvent;
    onHostChangedRef.current    = onHostChanged;
  });

  useEffect(() => {
    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("player:join", { name: playerName });
    });

    // Server now sends { players, hostId } instead of just the players record
    socket.on("players:init", (data: { players: Record<string, RemotePlayer>; hostId: string | null } | Record<string, RemotePlayer>) => {
      // Support both old format (plain record) and new format ({ players, hostId })
      if (data && "players" in data && typeof (data as { players: unknown }).players === "object" && !("id" in data)) {
        const d = data as { players: Record<string, RemotePlayer>; hostId: string | null };
        onInitRef.current?.(d.players, d.hostId);
      } else {
        // Legacy fallback
        onInitRef.current?.(data as Record<string, RemotePlayer>, null);
      }
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

    // ── Entity sync events ────────────────────────────────────────────────────

    socket.on("entity:batch", (batch: EntityBatch) => {
      onEntityBatchRef.current?.(batch);
    });

    socket.on("entity:event", (event: EntityEvent) => {
      onEntityEventRef.current?.(event);
    });

    socket.on("host:changed", ({ hostId }: { hostId: string | null }) => {
      onHostChangedRef.current?.(hostId);
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

  /** Send a batch of entity states (host only). */
  const sendEntityBatch = useCallback((batch: EntityBatch) => {
    socketRef.current?.emit("entity:batch", batch);
  }, []);

  /** Send a discrete entity event (host only). */
  const sendEntityEvent = useCallback((event: EntityEvent) => {
    socketRef.current?.emit("entity:event", event);
  }, []);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return { sendUpdate, sendChat, sendHit, sendEntityBatch, sendEntityEvent, isConnected };
}
