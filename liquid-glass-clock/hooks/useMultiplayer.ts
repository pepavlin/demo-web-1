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
}

export interface PlayerUpdate {
  x: number;
  y: number;
  z: number;
  rotY: number;
  pitch: number;
}

export interface UseMultiplayerOptions {
  playerName: string;
  onInit?: (players: Record<string, RemotePlayer>) => void;
  onPlayerJoined?: (player: RemotePlayer) => void;
  onPlayerLeft?: (id: string) => void;
  onPlayerUpdated?: (id: string, update: PlayerUpdate) => void;
}

export interface UseMultiplayerReturn {
  sendUpdate: (update: PlayerUpdate) => void;
  isConnected: () => boolean;
}

export function useMultiplayer({
  playerName,
  onInit,
  onPlayerJoined,
  onPlayerLeft,
  onPlayerUpdated,
}: UseMultiplayerOptions): UseMultiplayerReturn {
  const socketRef = useRef<Socket | null>(null);
  const lastUpdateTimeRef = useRef(0);
  // Store callbacks in refs so they never cause the effect to re-run
  const onInitRef = useRef(onInit);
  const onJoinedRef = useRef(onPlayerJoined);
  const onLeftRef = useRef(onPlayerLeft);
  const onUpdatedRef = useRef(onPlayerUpdated);

  useEffect(() => {
    onInitRef.current = onInit;
  });
  useEffect(() => {
    onJoinedRef.current = onPlayerJoined;
  });
  useEffect(() => {
    onLeftRef.current = onPlayerLeft;
  });
  useEffect(() => {
    onUpdatedRef.current = onPlayerUpdated;
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

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return { sendUpdate, isConnected };
}
