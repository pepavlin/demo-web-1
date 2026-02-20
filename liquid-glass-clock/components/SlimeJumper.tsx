"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useAnimationControls } from "framer-motion";

const SLIME_SIZE = 52;
const ARC_HEIGHT = 75;

const COLOR_PAIRS: [string, string][] = [
  ["#ff0080", "#ff6600"],
  ["#ff6600", "#ffee00"],
  ["#aaff00", "#00ff88"],
  ["#00ffcc", "#0099ff"],
  ["#8800ff", "#ff00cc"],
  ["#ff4400", "#ff00ff"],
  ["#00ff55", "#0055ff"],
  ["#ffff00", "#ff0055"],
  ["#ff00ff", "#00ffff"],
  ["#88ff00", "#ff8800"],
  ["#00ffff", "#ff0080"],
  ["#ff0088", "#ffcc00"],
];

interface Waypoint {
  x: number;
  y: number;
}

function computeWaypoints(w: number, h: number): Waypoint[] {
  const S = SLIME_SIZE / 2;
  const n = 3; // points per side
  const points: Waypoint[] = [];

  // Top: left → right (slime above panel)
  for (let i = 0; i < n; i++) {
    points.push({ x: ((i + 1) / (n + 1)) * w, y: -S });
  }
  // Right: top → bottom (slime right of panel)
  for (let i = 0; i < n; i++) {
    points.push({ x: w + S, y: ((i + 1) / (n + 1)) * h });
  }
  // Bottom: right → left (slime below panel)
  for (let i = n - 1; i >= 0; i--) {
    points.push({ x: ((i + 1) / (n + 1)) * w, y: h + S });
  }
  // Left: bottom → top (slime left of panel)
  for (let i = n - 1; i >= 0; i--) {
    points.push({ x: -S, y: ((i + 1) / (n + 1)) * h });
  }

  return points;
}

interface ParticleState {
  id: number;
  angle: number;
  color: string;
  x: number;
  y: number;
  distance: number;
}

let particleCounter = 0;

export default function SlimeJumper({
  panelRef,
  second,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  second: number;
}) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [colorIdx, setColorIdx] = useState(0);
  const [particles, setParticles] = useState<ParticleState[]>([]);
  const [visible, setVisible] = useState(false);

  const posControls = useAnimationControls();
  const scaleControls = useAnimationControls();

  const wpRef = useRef<Waypoint[]>([]);
  const idxRef = useRef(0);
  const colorRef = useRef(0);
  const isJumpingRef = useRef(false);
  const mountedRef = useRef(false);

  // Measure panel and compute waypoints
  useEffect(() => {
    if (!panelRef.current) return;

    const compute = () => {
      const el = panelRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) return;

      const wp = computeWaypoints(w, h);
      wpRef.current = wp;
      setWaypoints(wp);
      posControls.set({ x: wp[0].x, y: wp[0].y });
      setVisible(true);
    };

    // Double rAF ensures the element is fully laid out
    requestAnimationFrame(() => requestAnimationFrame(compute));

    const observer = new ResizeObserver(compute);
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [panelRef, posControls]);

  const spawnParticles = useCallback((wp: Waypoint, color1: string, color2: string) => {
    const count = 12;
    const newParticles: ParticleState[] = Array.from({ length: count }, (_, i) => ({
      id: particleCounter++,
      angle: (i / count) * Math.PI * 2 + Math.random() * 0.3,
      color: i % 2 === 0 ? color1 : color2,
      x: wp.x,
      y: wp.y,
      distance: 45 + Math.random() * 35,
    }));

    setParticles((prev) => [...prev, ...newParticles]);
    const ids = new Set(newParticles.map((p) => p.id));
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 700);
  }, []);

  const doJump = useCallback(async () => {
    if (isJumpingRef.current || wpRef.current.length === 0) return;
    isJumpingRef.current = true;

    const wp = wpRef.current;
    const fromIdx = idxRef.current;
    const toIdx = (fromIdx + 1) % wp.length;
    const from = wp[fromIdx];
    const to = wp[toIdx];
    const ci = colorRef.current;
    const [c1, c2] = COLOR_PAIRS[ci];

    // Phase 1: squash anticipation
    await scaleControls.start({
      scaleX: 1.6,
      scaleY: 0.48,
      transition: { duration: 0.1, ease: "easeOut" },
    });

    // Phase 2: jump arc (x/y) + stretch (scale) in parallel
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - ARC_HEIGHT;

    const movePromise = posControls.start({
      x: [from.x, midX, to.x],
      y: [from.y, midY, to.y],
      transition: { duration: 0.38, times: [0, 0.5, 1], ease: "easeInOut" },
    });

    scaleControls.start({
      scaleX: [1.6, 0.55, 1],
      scaleY: [0.48, 1.55, 1],
      transition: { duration: 0.38, times: [0, 0.28, 1] },
    });

    await movePromise;

    // Advance state
    idxRef.current = toIdx;
    colorRef.current = (ci + 1) % COLOR_PAIRS.length;
    setColorIdx(colorRef.current);

    // Phase 3: landing impact + particles
    spawnParticles(to, c1, c2);

    await scaleControls.start({
      scaleX: 1.55,
      scaleY: 0.52,
      transition: { duration: 0.065, ease: "easeOut" },
    });

    // Phase 4: bouncy settle
    await scaleControls.start({
      scaleX: [1.55, 0.82, 1.1, 0.96, 1],
      scaleY: [0.52, 1.28, 0.92, 1.05, 1],
      transition: { duration: 0.3, times: [0, 0.38, 0.62, 0.82, 1] },
    });

    isJumpingRef.current = false;
  }, [posControls, scaleControls, spawnParticles]);

  // Trigger jump on each second tick
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (wpRef.current.length === 0) return;
    doJump();
  }, [second, doJump]);

  const [c1, c2] = COLOR_PAIRS[colorIdx];

  if (!visible || waypoints.length === 0) return null;

  return (
    <>
      {/* Landing particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: p.color,
            boxShadow: `0 0 12px ${p.color}, 0 0 24px ${p.color}99`,
            left: p.x - 4,
            top: p.y - 4,
            zIndex: 25,
            pointerEvents: "none",
          }}
          initial={{ x: 0, y: 0, scale: 2, opacity: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 0.6, ease: [0.1, 0, 0.85, 1] }}
        />
      ))}

      {/* Slime body */}
      <motion.div
        animate={posControls}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          marginLeft: -SLIME_SIZE / 2,
          marginTop: -SLIME_SIZE / 2,
          zIndex: 30,
          pointerEvents: "none",
          willChange: "transform",
        }}
      >
        <motion.div
          animate={scaleControls}
          style={{
            width: SLIME_SIZE,
            height: SLIME_SIZE,
            transformOrigin: "50% 82%",
          }}
        >
          {/* Glow shadow */}
          <div
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${c1}44 0%, transparent 70%)`,
              filter: "blur(6px)",
            }}
          />

          {/* Main blob body */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: "50% 50% 44% 44% / 58% 58% 42% 42%",
              background: `radial-gradient(circle at 38% 32%, ${c1}, ${c2})`,
              boxShadow: `0 0 20px ${c1}, 0 0 40px ${c1}77, 0 0 70px ${c1}33`,
            }}
          />

          {/* Drip 1 */}
          <div
            style={{
              position: "absolute",
              bottom: -13,
              left: "15%",
              width: 10,
              height: 17,
              borderRadius: "0 0 50% 50%",
              background: `linear-gradient(180deg, ${c1}, ${c2})`,
              boxShadow: `0 0 8px ${c1}`,
            }}
          />

          {/* Drip 2 */}
          <div
            style={{
              position: "absolute",
              bottom: -9,
              right: "19%",
              width: 8,
              height: 13,
              borderRadius: "0 0 50% 50%",
              background: `linear-gradient(180deg, ${c2}, ${c1})`,
              boxShadow: `0 0 6px ${c2}`,
            }}
          />

          {/* Left eye */}
          <div
            style={{
              position: "absolute",
              top: "20%",
              left: "14%",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#0a0a1a",
              }}
            />
          </div>

          {/* Right eye */}
          <div
            style={{
              position: "absolute",
              top: "20%",
              right: "14%",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#0a0a1a",
              }}
            />
          </div>

          {/* Highlight */}
          <div
            style={{
              position: "absolute",
              top: "10%",
              left: "12%",
              width: "36%",
              height: "24%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.55)",
              filter: "blur(3px)",
            }}
          />
        </motion.div>
      </motion.div>
    </>
  );
}
