"use client";

/**
 * PumpkinWorld
 *
 * React component that boots the pumpkin simulation and runs a requestAnimationFrame
 * game-loop, rendering each frame onto a <canvas>.
 *
 * Features:
 * - Responsive canvas that fills its container
 * - Pause/resume on visibility change (tab switch)
 * - Reset button to restart the simulation
 * - Configurable via props (partial SimulationConfig)
 */

import { useEffect, useRef, useCallback } from "react";
import { PumpkinSimulation, SimulationConfig } from "@/lib/pumpkinSimulation";
import { PumpkinRenderer } from "@/lib/pumpkinRenderer";

export interface PumpkinWorldProps {
  /** Optional partial config overrides forwarded to the simulation. */
  config?: Partial<SimulationConfig>;
  /** CSS class applied to the wrapping <div>. */
  className?: string;
}

export default function PumpkinWorld({
  config = {},
  className = "",
}: PumpkinWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<PumpkinSimulation | null>(null);
  const rendererRef = useRef<PumpkinRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(false);

  // ── Bootstrap / teardown ─────────────────────────────────────────────────────

  const startLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;

    // (Re)create simulation and renderer each time we start
    simulationRef.current = new PumpkinSimulation({
      width,
      height,
      ...config,
    });
    rendererRef.current = new PumpkinRenderer(ctx, width, height);

    lastTimeRef.current = 0;
    elapsedRef.current = 0;

    const tick = (timestamp: number) => {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;
      elapsedRef.current += dt;

      simulationRef.current!.update(dt);
      rendererRef.current!.render(
        simulationRef.current!.pumpkins,
        elapsedRef.current
      );

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [config]);

  // ── Resize handling ──────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      if (canvas.width !== Math.floor(width) || canvas.height !== Math.floor(height)) {
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);

        // Rebuild renderer for new dimensions; simulation keeps existing state
        const ctx = canvas.getContext("2d");
        if (ctx && simulationRef.current) {
          rendererRef.current = new PumpkinRenderer(ctx, canvas.width, canvas.height);
        }
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize(); // initial size

    return () => ro.disconnect();
  }, []);

  // ── Animation loop ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Wait one frame so canvas has correct dimensions after resize
    const id = requestAnimationFrame(() => startLoop());
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(rafRef.current);
    };
  }, [startLoop]);

  // ── Visibility-based pause ───────────────────────────────────────────────────

  useEffect(() => {
    const onVisibility = () => {
      pausedRef.current = document.hidden;
      if (!document.hidden) lastTimeRef.current = 0; // reset delta on resume
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ── Reset handler ────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current = 0;
    elapsedRef.current = 0;
    startLoop();
  }, [startLoop]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      data-testid="pumpkin-world-container"
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
        data-testid="pumpkin-world-canvas"
      />

      {/* Reset button */}
      <button
        onClick={handleReset}
        aria-label="Restartovat svět"
        style={{
          position: "absolute",
          bottom: "1rem",
          right: "1rem",
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,180,60,0.4)",
          color: "rgba(255,200,100,0.9)",
          fontSize: "0.8rem",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        Restartovat
      </button>
    </div>
  );
}
