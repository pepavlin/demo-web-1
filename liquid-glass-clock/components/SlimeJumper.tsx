"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, useAnimationControls, AnimatePresence } from "framer-motion";

const SZ = 42;
const ARC = 85;
const TRAIL_TTL = 40_000;

// Design-matching palette: violet / indigo / cyan / blue / emerald / purple
const PAL = [
  { main: "rgba(139,92,246,.88)",  dark: "rgba(109,40,217,.95)",  g: "139,92,246"  },
  { main: "rgba(99,102,241,.88)",  dark: "rgba(79,70,229,.95)",   g: "99,102,241"  },
  { main: "rgba(8,145,178,.88)",   dark: "rgba(14,116,144,.95)",  g: "8,145,178"   },
  { main: "rgba(168,85,247,.88)",  dark: "rgba(147,51,234,.95)",  g: "168,85,247"  },
  { main: "rgba(59,130,246,.88)",  dark: "rgba(29,78,216,.95)",   g: "59,130,246"  },
  { main: "rgba(16,185,129,.88)",  dark: "rgba(5,150,105,.95)",   g: "16,185,129"  },
] as const;

type Pal  = typeof PAL[number];
type Side = "top" | "right" | "bottom" | "left";
type Wp   = { x: number; y: number };
type Trail = { id: number; x: number; y: number; ci: number; born: number };
type Blob  = { id: number; x: number; y: number; ang: number; d: number; w: number; h: number; ci: number };
type Sqrt  = { id: number; sx: number; sy: number; ex: number; ey: number; tx: number; ty: number; ci: number };

let gid = 0;

function buildWps(w: number, h: number): Wp[] {
  const S = SZ / 2, n = 3, pts: Wp[] = [];
  for (let i = 0; i < n; i++) pts.push({ x: ((i + 1) / (n + 1)) * w, y: -S });
  for (let i = 0; i < n; i++) pts.push({ x: w + S, y: ((i + 1) / (n + 1)) * h });
  for (let i = n - 1; i >= 0; i--) pts.push({ x: ((i + 1) / (n + 1)) * w, y: h + S });
  for (let i = n - 1; i >= 0; i--) pts.push({ x: -S, y: ((i + 1) / (n + 1)) * h });
  return pts;
}

function sideOf(i: number): Side {
  const n = ((i % 12) + 12) % 12;
  return n < 3 ? "top" : n < 6 ? "right" : n < 9 ? "bottom" : "left";
}

function rotOf(s: Side): number {
  return { top: 0, right: 90, bottom: 180, left: -90 }[s];
}

// ── Slime body ─────────────────────────────────────────────────────────────────
function Body({ c }: { c: Pal }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: -12, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${c.g},.35) 0%, transparent 70%)`,
        filter: "blur(10px)",
        pointerEvents: "none",
      }} />
      {/* Main blob */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: "46% 46% 38% 38% / 56% 56% 44% 44%",
        background: `radial-gradient(ellipse at 38% 32%, ${c.main}, ${c.dark})`,
        boxShadow: `0 0 12px rgba(${c.g},.55), 0 0 26px rgba(${c.g},.28), inset 0 1px 0 rgba(255,255,255,.22)`,
      }} />
      {/* Drip 1 */}
      <div style={{
        position: "absolute", bottom: -12, left: "18%",
        width: 7, height: 16,
        borderRadius: "3px 3px 50% 50%",
        background: `linear-gradient(180deg, ${c.dark}, rgba(${c.g},.4))`,
      }} />
      {/* Drip 2 */}
      <div style={{
        position: "absolute", bottom: -8, right: "22%",
        width: 5, height: 11,
        borderRadius: "3px 3px 50% 50%",
        background: `linear-gradient(180deg, ${c.dark}, rgba(${c.g},.3))`,
      }} />
      {/* Primary specular */}
      <div style={{
        position: "absolute", top: "11%", left: "12%",
        width: "38%", height: "24%",
        borderRadius: "50%",
        background: "rgba(255,255,255,.44)",
        filter: "blur(2.5px)",
      }} />
      {/* Secondary specular */}
      <div style={{
        position: "absolute", top: "8%", right: "16%",
        width: "14%", height: "13%",
        borderRadius: "50%",
        background: "rgba(255,255,255,.22)",
        filter: "blur(1.5px)",
      }} />
    </div>
  );
}

// ── Trail drip ──────────────────────────────────────────────────────────────────
function TrailDrip({ trail }: { trail: Trail }) {
  const c = PAL[trail.ci];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.2 }}
      animate={{ opacity: [0, .88, .88, 0], scale: [0.2, 1, 1, 0.6] }}
      transition={{ duration: TRAIL_TTL / 1000, times: [0, 0.04, 0.72, 1], ease: "linear" }}
      style={{
        position: "absolute",
        left: trail.x, top: trail.y,
        transform: "translate(-50%,-50%)",
        zIndex: 18, pointerEvents: "none",
      }}
    >
      {/* Stain */}
      <div style={{
        width: 16, height: 12,
        borderRadius: "50% 55% 45% 50% / 48% 44% 56% 52%",
        background: c.dark,
        boxShadow: `0 0 8px rgba(${c.g},.38)`,
        position: "relative",
      }} />
      {/* Drip line extends downward */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: [0, 14, 24], opacity: [0, .85, .65] }}
        transition={{ duration: 4, ease: [.45, 0, 1, 1], delay: .35 }}
        style={{
          position: "absolute", top: 10, left: "35%",
          width: 4,
          background: `linear-gradient(180deg, ${c.dark}, rgba(${c.g},.18))`,
          borderRadius: "0 0 50% 50%",
          transformOrigin: "top center",
        }}
      />
      {/* Falling drops */}
      {[0, 1].map(i => (
        <motion.div
          key={i}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, 10, 60], opacity: [0, .78, 0] }}
          transition={{
            duration: 1.5, ease: [.35, 0, 1, 1],
            delay: 2 + i * 1.8,
            repeat: Infinity, repeatDelay: 2.5 + i,
          }}
          style={{
            position: "absolute",
            top: 20 + i * 3, left: `${28 + i * 10}%`,
            width: 4 + i, height: 5 + i,
            borderRadius: "50% 50% 55% 55%",
            background: c.main,
          }}
        />
      ))}
    </motion.div>
  );
}

// ── Screen squirt blob (fixed position, portal) ─────────────────────────────────
function SquirtAnim({ s, onDone }: { s: Sqrt; onDone: (id: number) => void }) {
  const c = PAL[s.ci];
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const midX = (s.sx + s.ex) / 2;
  const midY = (s.sy + s.ey) / 2 - Math.min(Math.sqrt(dx * dx + dy * dy) * 0.38, 200);

  return (
    <motion.div
      style={{
        position: "fixed",
        left: s.sx - 11, top: s.sy - 13,
        width: 22, height: 26,
        borderRadius: "46% 46% 38% 38% / 56% 56% 44% 44%",
        background: `radial-gradient(ellipse at 38% 32%, ${c.main}, ${c.dark})`,
        boxShadow: `0 0 14px rgba(${c.g},.6), 0 0 28px rgba(${c.g},.3)`,
        zIndex: 9999, pointerEvents: "none",
      }}
      animate={{
        x: [0, midX - s.sx, s.ex - s.sx],
        y: [0, midY - s.sy, s.ey - s.sy],
        rotate: [0, 180, 360],
        scale: [0.7, 1.0, 1.4],
      }}
      transition={{ duration: .9, times: [0, .45, 1], ease: "easeIn" }}
      onAnimationComplete={() => onDone(s.id)}
    />
  );
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function SlimeJumper({
  panelRef,
  second,
  shakeSignal,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  second: number;
  shakeSignal: number;
}) {
  const [wps, setWps]       = useState<Wp[]>([]);
  const [ci, setCi]         = useState(0);
  const [blobs, setBlobs]   = useState<Blob[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [squirts, setSquirts] = useState<Sqrt[]>([]);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const posC = useAnimationControls();
  const sclC = useAnimationControls();
  const rotC = useAnimationControls();

  const wpsRef    = useRef<Wp[]>([]);
  const idxRef    = useRef(0);
  const ciRef     = useRef(0);
  const jumpRef   = useRef(false);
  const firstRef  = useRef(true);
  const doSquirtRef = useRef<() => void>(() => {});

  useEffect(() => { setMounted(true); }, []);

  // Clear all slime on shake
  useEffect(() => {
    if (shakeSignal === 0) return;
    setTrails([]);
    setBlobs([]);
  }, [shakeSignal]);

  // Measure panel and build waypoints
  useEffect(() => {
    if (!panelRef.current) return;
    const measure = () => {
      const el = panelRef.current;
      if (!el) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      const wp = buildWps(w, h);
      wpsRef.current = wp;
      setWps(wp);
      posC.set({ x: wp[0].x, y: wp[0].y });
      setVisible(true);
    };
    requestAnimationFrame(() => requestAnimationFrame(measure));
    const obs = new ResizeObserver(measure);
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, [panelRef, posC]);

  // Expire old trails
  useEffect(() => {
    const t = setInterval(() => {
      setTrails(p => p.filter(tr => Date.now() - tr.born < TRAIL_TTL));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Spawn viscous impact blobs
  const spawnBlobs = useCallback((pos: Wp, blobCi: number) => {
    const count = 7;
    const nb: Blob[] = Array.from({ length: count }, (_, i) => ({
      id: gid++,
      x: pos.x, y: pos.y,
      ang: (i / count) * Math.PI * 2 + (Math.random() - .5) * .7,
      d: 18 + Math.random() * 28,
      w: 5 + Math.random() * 8,
      h: 6 + Math.random() * 10,
      ci: blobCi,
    }));
    setBlobs(p => [...p, ...nb]);
    const ids = new Set(nb.map(b => b.id));
    setTimeout(() => setBlobs(p => p.filter(b => !ids.has(b.id))), 900);
  }, []);

  // Handle squirt landing
  const onSquirtDone = useCallback((id: number) => {
    setSquirts(p => {
      const s = p.find(q => q.id === id);
      if (s) {
        setTrails(tr => [...tr, { id: gid++, x: s.tx, y: s.ty, ci: s.ci, born: Date.now() }]);
        spawnBlobs({ x: s.tx, y: s.ty }, s.ci);
      }
      return p.filter(q => q.id !== id);
    });
  }, [spawnBlobs]);

  // Screen-edge squirt
  const doSquirt = useCallback(() => {
    const el = panelRef.current;
    if (!el || !wpsRef.current.length) return;
    const parent = el.parentElement;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    // Random screen edge start point
    const edge = Math.floor(Math.random() * 4);
    let sx: number, sy: number;
    if      (edge === 0) { sx = Math.random() * vw; sy = -30; }
    else if (edge === 1) { sx = vw + 30; sy = Math.random() * vh; }
    else if (edge === 2) { sx = Math.random() * vw; sy = vh + 30; }
    else                 { sx = -30; sy = Math.random() * vh; }

    // Pick random waypoint as target
    const wp = wpsRef.current;
    const tIdx = Math.floor(Math.random() * wp.length);
    const tw = wp[tIdx];
    const sqCi = Math.floor(Math.random() * PAL.length);

    setSquirts(p => [...p, {
      id: gid++,
      sx: sx!, sy: sy!,
      ex: pr.left + tw.x, ey: pr.top + tw.y,
      tx: tw.x, ty: tw.y,
      ci: sqCi,
    }]);
  }, [panelRef]);

  // Keep doSquirtRef updated and schedule squirts
  useEffect(() => { doSquirtRef.current = doSquirt; }, [doSquirt]);

  useEffect(() => {
    // First squirt after 12s, then every 60s
    const first = setTimeout(() => doSquirtRef.current(), 12_000);
    const loop  = setInterval(() => doSquirtRef.current(), 60_000);
    return () => { clearTimeout(first); clearInterval(loop); };
  }, []);

  // Jump animation
  const doJump = useCallback(async () => {
    if (jumpRef.current || !wpsRef.current.length) return;
    jumpRef.current = true;

    const wp = wpsRef.current;
    const fromIdx = idxRef.current;
    const toIdx   = (fromIdx + 1) % wp.length;
    const from = wp[fromIdx], to = wp[toIdx];
    const jumpCi = ciRef.current;
    const toSide = sideOf(toIdx);
    const toRot  = rotOf(toSide);

    // Squash anticipation
    await sclC.start({ scaleX: 1.55, scaleY: 0.48, transition: { duration: 0.09, ease: "easeOut" } });

    // Arc + stretch + rotate simultaneously
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - ARC;
    const moveP = posC.start({
      x: [from.x, midX, to.x],
      y: [from.y, midY, to.y],
      transition: { duration: 0.36, times: [0, .5, 1], ease: "easeInOut" },
    });
    sclC.start({
      scaleX: [1.55, 0.55, 1],
      scaleY: [0.48, 1.55, 1],
      transition: { duration: 0.36, times: [0, .28, 1] },
    });
    rotC.start({
      rotate: toRot,
      transition: { duration: 0.36, ease: "easeInOut" },
    });
    await moveP;

    idxRef.current = toIdx;
    ciRef.current  = (jumpCi + 1) % PAL.length;
    setCi(ciRef.current);

    // Landing impact
    spawnBlobs(to, jumpCi);
    setTrails(p => [...p, { id: gid++, x: to.x, y: to.y, ci: jumpCi, born: Date.now() }]);

    await sclC.start({ scaleX: 1.55, scaleY: 0.48, transition: { duration: 0.065, ease: "easeOut" } });
    await sclC.start({
      scaleX: [1.55, 0.83, 1.09, 0.97, 1],
      scaleY: [0.48, 1.28, 0.91, 1.04, 1],
      transition: { duration: 0.3, times: [0, .38, .62, .82, 1] },
    });

    jumpRef.current = false;
  }, [posC, sclC, rotC, spawnBlobs]);

  // Trigger jump each second
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    if (!wpsRef.current.length) return;
    doJump();
  }, [second, doJump]);

  if (!visible || !wps.length) return null;

  const c = PAL[ci];

  return (
    <>
      {/* Viscous impact blobs */}
      {blobs.map(b => {
        const bc = PAL[b.ci];
        return (
          <motion.div
            key={b.id}
            style={{
              position: "absolute",
              left: b.x - b.w / 2, top: b.y - b.h / 2,
              width: b.w, height: b.h,
              borderRadius: "44% 44% 52% 52% / 54% 54% 46% 46%",
              background: bc.main,
              boxShadow: `0 0 7px rgba(${bc.g},.42)`,
              zIndex: 25, pointerEvents: "none",
            }}
            initial={{ x: 0, y: 0, scale: 1.4, opacity: .9, rotate: Math.random() * 120 - 60 }}
            animate={{
              x: Math.cos(b.ang) * b.d,
              y: Math.sin(b.ang) * b.d,
              scale: 0, opacity: 0,
            }}
            transition={{ duration: .75, ease: [.1, 0, .7, 1] }}
          />
        );
      })}

      {/* Trail drips */}
      <AnimatePresence>
        {trails.map(t => <TrailDrip key={t.id} trail={t} />)}
      </AnimatePresence>

      {/* Screen squirts via portal */}
      {mounted && squirts.map(s =>
        createPortal(
          <SquirtAnim key={s.id} s={s} onDone={onSquirtDone} />,
          document.body
        )
      )}

      {/* Slime body */}
      <motion.div
        animate={posC}
        style={{
          position: "absolute", left: 0, top: 0,
          marginLeft: -SZ / 2, marginTop: -SZ / 2,
          zIndex: 30, pointerEvents: "none", willChange: "transform",
        }}
      >
        {/* Rotation wrapper */}
        <motion.div
          animate={rotC}
          style={{ width: SZ, height: SZ, transformOrigin: "50% 50%" }}
        >
          {/* Squash/stretch wrapper */}
          <motion.div
            animate={sclC}
            style={{ width: SZ, height: SZ, transformOrigin: "50% 80%" }}
          >
            <Body c={c} />
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
}
