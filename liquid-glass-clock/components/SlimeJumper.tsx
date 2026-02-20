"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, useAnimationControls, AnimatePresence } from "framer-motion";

const SZ = 54;
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

type TrailDrop = {
  x: number; w: number; h: number;
  delay: number; repeatDelay: number;
  br: string;
};

type Trail = {
  id: number; x: number; y: number; ci: number; born: number;
  stainBR: string; stainW: number; stainH: number;
  dripX: number; dripW: number; dripFinalH: number;
  extraStains: { dx: number; dy: number; w: number; h: number; br: string }[];
  drops: TrailDrop[];
};

type Blob = {
  id: number; x: number; y: number;
  ang: number; d: number; w: number; h: number;
  ci: number; br: string;
};

type Sqrt = {
  id: number; sx: number; sy: number;
  ex: number; ey: number;
  tx: number; ty: number; ci: number;
};

let gid = 0;

// ── Seeded PRNG (deterministic per seed) ────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0;
    s ^= s >>> 16;
    return (s >>> 0) / 0x100000000;
  };
}

// ── Organic 8-value border-radius ───────────────────────────────────────────────
function randomBR(skewDown = false): string {
  const r = () => 22 + Math.floor(Math.random() * 56);
  const tl = r(), tr = r();
  const bl = skewDown ? 35 + Math.floor(Math.random() * 45) : r();
  const br = skewDown ? 35 + Math.floor(Math.random() * 45) : r();
  const tl2 = r(), tr2 = r();
  const bl2 = skewDown ? 45 + Math.floor(Math.random() * 48) : r();
  const br2 = skewDown ? 45 + Math.floor(Math.random() * 48) : r();
  return `${tl}% ${tr}% ${br}% ${bl}% / ${tl2}% ${tr2}% ${br2}% ${bl2}%`;
}

// ── Random jump position around panel at varying distances ──────────────────────
function randomJumpPos(panelW: number, panelH: number): { pos: Wp; side: Side } {
  const sides: Side[] = ["top", "right", "bottom", "left"];
  const side = sides[Math.floor(Math.random() * 4)];
  const minOff = SZ * 0.5 + 10;
  const maxOff = SZ * 0.5 + 95;
  const off = minOff + Math.random() * (maxOff - minOff);

  let pos: Wp;
  switch (side) {
    case "top":
      pos = { x: 10 + Math.random() * (panelW - 20), y: -off };
      break;
    case "right":
      pos = { x: panelW + off, y: 10 + Math.random() * (panelH - 20) };
      break;
    case "bottom":
      pos = { x: 10 + Math.random() * (panelW - 20), y: panelH + off };
      break;
    default: // left
      pos = { x: -off, y: 10 + Math.random() * (panelH - 20) };
  }
  return { pos, side };
}

function rotOf(s: Side): number {
  return { top: 0, right: 90, bottom: 180, left: -90 }[s];
}

// ── Create trail with all random params pre-generated ───────────────────────────
function makeTrail(x: number, y: number, ci: number): Trail {
  const stainW = 12 + Math.random() * 26;
  const stainH = 7 + Math.random() * 18;
  const numDrops = 1 + Math.floor(Math.random() * 3);
  const numExtra = Math.floor(Math.random() * 3);

  return {
    id: gid++, x, y, ci,
    born: Date.now(),
    stainBR: randomBR(true),
    stainW, stainH,
    dripX: 15 + Math.random() * 70,
    dripW: 2.5 + Math.random() * 4.5,
    dripFinalH: 14 + Math.random() * 26,
    extraStains: Array.from({ length: numExtra }, () => ({
      dx: (Math.random() - 0.5) * stainW * 2.2,
      dy: (Math.random() - 0.5) * stainH * 2.2,
      w: 5 + Math.random() * 14,
      h: 3 + Math.random() * 10,
      br: randomBR(false),
    })),
    drops: Array.from({ length: numDrops }, (_, i) => ({
      x: 8 + Math.random() * 84,
      w: 3 + Math.random() * 5,
      h: 4 + Math.random() * 6,
      delay: 1.8 + i * (1.5 + Math.random()) + Math.random() * 0.7,
      repeatDelay: 2.0 + Math.random() * 2.8,
      br: `${22 + Math.floor(Math.random() * 34)}% ${22 + Math.floor(Math.random() * 34)}% ${44 + Math.floor(Math.random() * 46)}% ${44 + Math.floor(Math.random() * 46)}% / ${16 + Math.floor(Math.random() * 28)}% ${16 + Math.floor(Math.random() * 28)}% ${46 + Math.floor(Math.random() * 46)}% ${46 + Math.floor(Math.random() * 46)}%`,
    })),
  };
}

// ── Slime body — organic morphing blob with seeded drips ───────────────────────
function Body({ c, ci }: { c: Pal; ci: number }) {
  const rng = seededRng(ci * 137 + 17);
  const numDrips = 2 + Math.floor(rng() * 3);
  const drips = Array.from({ length: numDrips }, () => ({
    left: 8 + Math.floor(rng() * 84),
    w: 3.5 + Math.floor(rng() * 8),
    h: 11 + Math.floor(rng() * 22),
    br: `${12 + Math.floor(rng() * 24)}% ${12 + Math.floor(rng() * 24)}% ${52 + Math.floor(rng() * 44)}% ${52 + Math.floor(rng() * 44)}% / ${8 + Math.floor(rng() * 16)}% ${8 + Math.floor(rng() * 16)}% ${56 + Math.floor(rng() * 40)}% ${56 + Math.floor(rng() * 40)}%`,
    dur: ((2.4 + rng() * 3.0)).toFixed(2),
    delay: ((rng() * 1.2)).toFixed(2),
  }));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: -18, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${c.g},.44) 0%, transparent 70%)`,
        filter: "blur(15px)",
        pointerEvents: "none",
      }} />

      {/* Main morphing blob — CSS animation handles border-radius morphing */}
      <div
        className="slime-morph"
        style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 36% 30%, ${c.main}, ${c.dark})`,
          boxShadow: `0 0 16px rgba(${c.g},.68), 0 0 32px rgba(${c.g},.34), inset 0 1px 0 rgba(255,255,255,.30)`,
        }}
      />

      {/* Irregular organic drips hanging off the body */}
      {drips.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            bottom: -(d.h - 6),
            left: `${d.left}%`,
            transform: "translateX(-50%)",
            width: d.w,
            height: d.h,
            borderRadius: d.br,
            background: `linear-gradient(180deg, ${c.dark} 0%, rgba(${c.g},.22) 100%)`,
            animation: `slime-drip-pulse ${d.dur}s ease-in-out infinite`,
            animationDelay: `${d.delay}s`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Primary specular highlight */}
      <div style={{
        position: "absolute", top: "10%", left: "11%",
        width: "40%", height: "26%",
        borderRadius: "50%",
        background: "rgba(255,255,255,.46)",
        filter: "blur(2.5px)",
        pointerEvents: "none",
      }} />
      {/* Secondary specular */}
      <div style={{
        position: "absolute", top: "7%", right: "15%",
        width: "15%", height: "14%",
        borderRadius: "50%",
        background: "rgba(255,255,255,.24)",
        filter: "blur(1.5px)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Trail drip — irregular blob stain with falling drops ────────────────────────
function TrailDrip({ trail }: { trail: Trail }) {
  const c = PAL[trail.ci];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.15 }}
      animate={{ opacity: [0, .92, .88, 0], scale: [0.15, 1, 1, 0.5] }}
      transition={{ duration: TRAIL_TTL / 1000, times: [0, 0.04, 0.72, 1], ease: "linear" }}
      style={{
        position: "absolute",
        left: trail.x, top: trail.y,
        transform: "translate(-50%,-50%)",
        zIndex: 18, pointerEvents: "none",
      }}
    >
      {/* Extra splatter blobs around the main stain */}
      {trail.extraStains.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          left: trail.stainW / 2 + s.dx - s.w / 2,
          top: trail.stainH / 2 + s.dy - s.h / 2,
          width: s.w, height: s.h,
          borderRadius: s.br,
          background: c.main,
          opacity: 0.70,
        }} />
      ))}

      {/* Main irregular stain blob */}
      <div style={{
        width: trail.stainW,
        height: trail.stainH,
        borderRadius: trail.stainBR,
        background: c.dark,
        boxShadow: `0 0 10px rgba(${c.g},.44)`,
        position: "relative",
      }} />

      {/* Drip line extending downward */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: [0, trail.dripFinalH * 0.55, trail.dripFinalH], opacity: [0, .9, .6] }}
        transition={{ duration: 3.8, ease: [.45, 0, 1, 1], delay: .4 }}
        style={{
          position: "absolute",
          top: trail.stainH - 3,
          left: `${trail.dripX}%`,
          width: trail.dripW,
          background: `linear-gradient(180deg, ${c.dark}, rgba(${c.g},.08))`,
          borderRadius: "2px 2px 55% 55%",
          transformOrigin: "top center",
        }}
      />

      {/* Falling irregular drops */}
      {trail.drops.map((d, i) => (
        <motion.div
          key={i}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, 7, 55], opacity: [0, .84, 0] }}
          transition={{
            duration: 1.45, ease: [.35, 0, 1, 1],
            delay: d.delay,
            repeat: Infinity, repeatDelay: d.repeatDelay,
          }}
          style={{
            position: "absolute",
            top: trail.stainH + 14,
            left: `${d.x}%`,
            width: d.w,
            height: d.h,
            borderRadius: d.br,
            background: c.main,
          }}
        />
      ))}
    </motion.div>
  );
}

// ── Screen squirt blob (portal, flies from screen edge) ─────────────────────────
function SquirtAnim({ s, onDone }: { s: Sqrt; onDone: (id: number) => void }) {
  const c = PAL[s.ci];
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Slightly curved arc
  const midX = (s.sx + s.ex) / 2;
  const midY = (s.sy + s.ey) / 2 - Math.min(dist * 0.38, 215);

  return (
    <motion.div
      className="slime-morph"
      style={{
        position: "fixed",
        left: s.sx - 16, top: s.sy - 18,
        width: 32, height: 36,
        background: `radial-gradient(ellipse at 36% 30%, ${c.main}, ${c.dark})`,
        boxShadow: `0 0 18px rgba(${c.g},.68), 0 0 34px rgba(${c.g},.34)`,
        zIndex: 9999, pointerEvents: "none",
      }}
      animate={{
        x: [0, midX - s.sx, s.ex - s.sx],
        y: [0, midY - s.sy, s.ey - s.sy],
        rotate: [0, 240, 480],
        scale: [0.55, 1.05, 1.55],
      }}
      transition={{ duration: .92, times: [0, .45, 1], ease: "easeIn" }}
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
  const [ci, setCi]           = useState(0);
  const [blobs, setBlobs]     = useState<Blob[]>([]);
  const [trails, setTrails]   = useState<Trail[]>([]);
  const [squirts, setSquirts] = useState<Sqrt[]>([]);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const posC = useAnimationControls();
  const sclC = useAnimationControls();
  const rotC = useAnimationControls();

  const panelDimsRef = useRef<{ w: number; h: number } | null>(null);
  const currPosRef   = useRef<Wp>({ x: 0, y: 0 });
  const ciRef        = useRef(0);
  const jumpRef      = useRef(false);
  const firstRef     = useRef(true);
  const doSquirtRef  = useRef<() => void>(() => {});

  useEffect(() => { setMounted(true); }, []);

  // Clear all slime on shake
  useEffect(() => {
    if (shakeSignal === 0) return;
    setTrails([]);
    setBlobs([]);
  }, [shakeSignal]);

  // Measure panel and set initial random position
  useEffect(() => {
    if (!panelRef.current) return;
    const measure = () => {
      const el = panelRef.current;
      if (!el) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      panelDimsRef.current = { w, h };
      // Start at a random position around the panel
      const { pos, side } = randomJumpPos(w, h);
      currPosRef.current = pos;
      posC.set({ x: pos.x, y: pos.y });
      rotC.set({ rotate: rotOf(side) });
      setVisible(true);
    };
    requestAnimationFrame(() => requestAnimationFrame(measure));
    const obs = new ResizeObserver(measure);
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, [panelRef, posC, rotC]);

  // Expire old trails
  useEffect(() => {
    const t = setInterval(() => {
      setTrails(p => p.filter(tr => Date.now() - tr.born < TRAIL_TTL));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Spawn irregular impact blobs on landing
  const spawnBlobs = useCallback((pos: Wp, blobCi: number) => {
    const count = 6 + Math.floor(Math.random() * 6);
    const nb: Blob[] = Array.from({ length: count }, (_, i) => ({
      id: gid++,
      x: pos.x, y: pos.y,
      ang: (i / count) * Math.PI * 2 + (Math.random() - .5) * 1.3,
      d: 12 + Math.random() * 46,
      w: 4 + Math.random() * 15,
      h: 4 + Math.random() * 15,
      ci: blobCi,
      br: randomBR(false),
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
        setTrails(tr => [...tr, makeTrail(s.tx, s.ty, s.ci)]);
        spawnBlobs({ x: s.tx, y: s.ty }, s.ci);
      }
      return p.filter(q => q.id !== id);
    });
  }, [spawnBlobs]);

  // Screen-edge squirt
  const doSquirt = useCallback(() => {
    const el = panelRef.current;
    if (!el || !panelDimsRef.current) return;
    const parent = el.parentElement;
    if (!parent) return;
    const pr = parent.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    const edge = Math.floor(Math.random() * 4);
    let sx: number, sy: number;
    if      (edge === 0) { sx = Math.random() * vw; sy = -30; }
    else if (edge === 1) { sx = vw + 30; sy = Math.random() * vh; }
    else if (edge === 2) { sx = Math.random() * vw; sy = vh + 30; }
    else                 { sx = -30; sy = Math.random() * vh; }

    const dims = panelDimsRef.current;
    const { pos: tw } = randomJumpPos(dims.w, dims.h);
    const sqCi = Math.floor(Math.random() * PAL.length);

    setSquirts(p => [...p, {
      id: gid++,
      sx: sx!, sy: sy!,
      ex: pr.left + tw.x, ey: pr.top + tw.y,
      tx: tw.x, ty: tw.y,
      ci: sqCi,
    }]);
  }, [panelRef]);

  useEffect(() => { doSquirtRef.current = doSquirt; }, [doSquirt]);

  useEffect(() => {
    const first = setTimeout(() => doSquirtRef.current(), 12_000);
    const loop  = setInterval(() => doSquirtRef.current(), 60_000);
    return () => { clearTimeout(first); clearInterval(loop); };
  }, []);

  // Jump animation — random target each time at varying distances
  const doJump = useCallback(async () => {
    if (jumpRef.current || !panelDimsRef.current) return;
    jumpRef.current = true;

    const dims = panelDimsRef.current;
    const from = currPosRef.current;
    const { pos: to, side: toSide } = randomJumpPos(dims.w, dims.h);
    const toRot  = rotOf(toSide);
    const jumpCi = ciRef.current;

    // Arc height scales with distance
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const arcH = 55 + Math.random() * 50 + dist * 0.12;

    // Duration scales slightly with distance
    const dur = 0.28 + Math.min(dist / 700, 0.22);

    // Squash anticipation
    await sclC.start({ scaleX: 1.55, scaleY: 0.48, transition: { duration: 0.09, ease: "easeOut" } });

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - arcH;

    const moveP = posC.start({
      x: [from.x, midX, to.x],
      y: [from.y, midY, to.y],
      transition: { duration: dur, times: [0, .5, 1], ease: "easeInOut" },
    });
    sclC.start({
      scaleX: [1.55, 0.52, 1],
      scaleY: [0.48, 1.58, 1],
      transition: { duration: dur, times: [0, .28, 1] },
    });
    rotC.start({
      rotate: toRot,
      transition: { duration: dur, ease: "easeInOut" },
    });
    await moveP;

    currPosRef.current = to;
    ciRef.current = (jumpCi + 1) % PAL.length;
    setCi(ciRef.current);

    // Landing impact
    spawnBlobs(to, jumpCi);
    setTrails(p => [...p, makeTrail(to.x, to.y, jumpCi)]);

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
    if (!panelDimsRef.current) return;
    doJump();
  }, [second, doJump]);

  if (!visible) return null;

  const c = PAL[ci];

  return (
    <>
      {/* Irregular impact blobs */}
      {blobs.map(b => {
        const bc = PAL[b.ci];
        return (
          <motion.div
            key={b.id}
            style={{
              position: "absolute",
              left: b.x - b.w / 2, top: b.y - b.h / 2,
              width: b.w, height: b.h,
              borderRadius: b.br,
              background: bc.main,
              boxShadow: `0 0 7px rgba(${bc.g},.46)`,
              zIndex: 25, pointerEvents: "none",
            }}
            initial={{ x: 0, y: 0, scale: 1.5, opacity: .94, rotate: Math.random() * 140 - 70 }}
            animate={{
              x: Math.cos(b.ang) * b.d,
              y: Math.sin(b.ang) * b.d,
              scale: 0, opacity: 0,
            }}
            transition={{ duration: .78, ease: [.1, 0, .7, 1] }}
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
            <Body c={c} ci={ci} />
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
}
