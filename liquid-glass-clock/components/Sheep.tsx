"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SHEEP_W = 100;
const SHEEP_H = 90;
const SPEED = 90; // px per second
const FLEE_SPEED = 220;
const ATTRACT_SPEED = 160;
const MOUSE_REACT_RADIUS = 220;
const BLEAT_DURATION = 3000; // ms
const MIN_BLEAT_DELAY = 8000; // ms
const MAX_BLEAT_DELAY = 22000; // ms
const CORNER_TURN_PROB = 0.5;

type Side = "bottom" | "right" | "top" | "left";
const SIDES: Side[] = ["bottom", "right", "top", "left"];

function sideLenPx(side: Side): number {
  return side === "bottom" || side === "top" ? window.innerWidth : window.innerHeight;
}

function toScreenCenter(side: Side, progress: number): { cx: number; cy: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  switch (side) {
    case "bottom": return { cx: progress,          cy: vh - SHEEP_H / 2 };
    case "right":  return { cx: vw - SHEEP_H / 2,  cy: vh - progress    };
    case "top":    return { cx: vw - progress,      cy: SHEEP_H / 2      };
    case "left":   return { cx: SHEEP_H / 2,        cy: progress         };
  }
}

function sheepTransform(side: Side, dir: 1 | -1): string {
  if (side === "bottom") return dir ===  1 ? "none"                        : "scaleX(-1)";
  if (side === "right")  return dir ===  1 ? "rotate(-90deg)"              : "scaleX(-1) rotate(90deg)";
  if (side === "top")    return dir ===  1 ? "rotate(180deg)"              : "scaleY(-1)";
  /* left */             return dir ===  1 ? "rotate(90deg)"               : "scaleX(-1) rotate(-90deg)";
}

function dirTowardMouse(
  side: Side, cx: number, cy: number, mx: number, my: number
): 1 | -1 {
  switch (side) {
    case "bottom": return mx >= cx ? 1 : -1;
    case "right":  return my <= cy ? 1 : -1;
    case "top":    return mx <= cx ? 1 : -1;
    case "left":   return my >= cy ? 1 : -1;
  }
}

function nextSide(s: Side): Side { return SIDES[(SIDES.indexOf(s) + 1) % 4]; }
function prevSide(s: Side): Side { return SIDES[(SIDES.indexOf(s) + 3) % 4]; }

// ── SVG with subtle 3-D depth using gradient fills ────────────────────────────
function SheepSVG({ running }: { running: boolean }) {
  const legA = running ? "sheep-leg-a" : "";
  const legB = running ? "sheep-leg-b" : "";

  return (
    <svg width={SHEEP_W} height={SHEEP_H} viewBox="0 0 100 90" aria-hidden="true">
      <defs>
        {/* Wool gradient — light comes from top-left for 3-D roundness */}
        <radialGradient id="woolGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="rgba(255,255,255,1)"   />
          <stop offset="40%"  stopColor="rgba(235,235,245,0.95)" />
          <stop offset="80%"  stopColor="rgba(200,195,220,0.9)"  />
          <stop offset="100%" stopColor="rgba(160,155,185,0.85)" />
        </radialGradient>
        {/* Wool highlight overlay — top specular sheen */}
        <radialGradient id="woolHighlight" cx="30%" cy="20%" r="50%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>
        {/* Head gradient — dark rounded head */}
        <radialGradient id="headGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#555" />
          <stop offset="60%"  stopColor="#333" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>
        {/* Leg gradient */}
        <linearGradient id="legGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"  stopColor="#2a2a2a" />
          <stop offset="50%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        {/* Ear gradient */}
        <radialGradient id="earGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%"  stopColor="#5a5a5a" />
          <stop offset="100%" stopColor="#333" />
        </radialGradient>
        {/* Eye highlight */}
        <radialGradient id="eyeHighlight" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"   />
        </radialGradient>
      </defs>

      {/* Drop shadow beneath sheep (ground contact) */}
      <ellipse cx="45" cy="88" rx="36" ry="4" fill="rgba(0,0,0,0.25)" style={{ filter: "blur(3px)" }} />

      {/* Back legs */}
      <g className={legB}>
        <rect x="52" y="60" width="8" height="26" rx="4" fill="url(#legGrad)" />
        {/* Hoof */}
        <rect x="51" y="82" width="10" height="5" rx="2.5" fill="#0d0d0d" />
      </g>
      <g className={legA}>
        <rect x="64" y="60" width="8" height="26" rx="4" fill="url(#legGrad)" />
        <rect x="63" y="82" width="10" height="5" rx="2.5" fill="#0d0d0d" />
      </g>

      {/* Wool body — base with 3-D gradient */}
      <ellipse cx="45" cy="48" rx="35" ry="22" fill="url(#woolGrad)" />
      <circle cx="22" cy="35" r="16" fill="url(#woolGrad)" />
      <circle cx="36" cy="27" r="18" fill="url(#woolGrad)" />
      <circle cx="53" cy="25" r="18" fill="url(#woolGrad)" />
      <circle cx="68" cy="31" r="15" fill="url(#woolGrad)" />

      {/* Wool specular highlight */}
      <ellipse cx="35" cy="28" rx="30" ry="18" fill="url(#woolHighlight)" />

      {/* Head */}
      <ellipse cx="81" cy="43" rx="13" ry="12" fill="url(#headGrad)" />

      {/* Eye white */}
      <circle cx="85" cy="39" r="2.8" fill="white" />
      {/* Pupil */}
      <circle cx="85.5" cy="39" r="1.4" fill="#0a0a0a" />
      {/* Eye highlight */}
      <circle cx="84.8" cy="38.4" r="0.6" fill="rgba(255,255,255,0.9)" />

      {/* Ear */}
      <ellipse cx="75" cy="32" rx="5" ry="3" fill="url(#earGrad)" transform="rotate(-15 75 32)" />

      {/* Nostrils */}
      <circle cx="86" cy="48" r="1.2" fill="#555" />
      <circle cx="89" cy="47" r="1.2" fill="#555" />

      {/* Front legs */}
      <g className={legA}>
        <rect x="18" y="60" width="8" height="26" rx="4" fill="url(#legGrad)" />
        <rect x="17" y="82" width="10" height="5" rx="2.5" fill="#0d0d0d" />
      </g>
      <g className={legB}>
        <rect x="30" y="60" width="8" height="26" rx="4" fill="url(#legGrad)" />
        <rect x="29" y="82" width="10" height="5" rx="2.5" fill="#0d0d0d" />
      </g>
    </svg>
  );
}

export default function Sheep() {
  const [mounted, setMounted] = useState(false);
  const [bleating, setBleating] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [sheepPos, setSheepPos] = useState<{
    left: number;
    top: number;
    transform: string;
  }>({ left: -SHEEP_W - 20, top: 0, transform: "none" });

  /* Extra 3-D tilt state: slight perspective lean driven by speed/direction */
  const [tilt3d, setTilt3d] = useState(0);

  const sideRef     = useRef<Side>("bottom");
  const progressRef = useRef<number>(-SHEEP_W - 20);
  const dirRef      = useRef<1 | -1>(1);
  const bleatRef    = useRef(false);
  const stoppedRef  = useRef(false);
  const rafRef      = useRef<number>(0);
  const mouseRef    = useRef<{ x: number; y: number } | null>(null);
  const isClickingRef = useRef(false);
  const prevProgressRef = useRef<number>(-SHEEP_W - 20);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const onMove  = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = ()              => { mouseRef.current = null; };
    const onDown  = ()              => { isClickingRef.current = true; };
    const onUp    = ()              => { isClickingRef.current = false; };

    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown",  onDown);
    window.addEventListener("mouseup",    onUp);

    return () => {
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown",  onDown);
      window.removeEventListener("mouseup",    onUp);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    sideRef.current     = "bottom";
    progressRef.current = -SHEEP_W - 20;
    dirRef.current      = 1;

    let prev = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;

      if (!bleatRef.current && !stoppedRef.current) {
        const side     = sideRef.current;
        const sideLen  = sideLenPx(side);
        const progress = progressRef.current;
        const { cx, cy } = toScreenCenter(side, progress);

        let speed  = SPEED;
        let newDir = dirRef.current;

        const mouse    = mouseRef.current;
        const clicking = isClickingRef.current;

        if (mouse) {
          const dx   = cx - mouse.x;
          const dy   = cy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_REACT_RADIUS) {
            const toward = dirTowardMouse(side, cx, cy, mouse.x, mouse.y);
            if (clicking) {
              speed  = ATTRACT_SPEED;
              newDir = toward;
            } else {
              speed  = FLEE_SPEED;
              newDir = (toward === 1 ? -1 : 1) as 1 | -1;
            }
          }
        }

        dirRef.current = newDir;

        let newProgress = progress + dirRef.current * speed * dt;

        if (dirRef.current === 1 && newProgress >= sideLen) {
          if (Math.random() < CORNER_TURN_PROB) {
            sideRef.current = nextSide(side);
            newProgress = 0;
          } else {
            dirRef.current = -1;
            newProgress = sideLen;
          }
        } else if (dirRef.current === -1 && newProgress <= 0) {
          if (Math.random() < CORNER_TURN_PROB) {
            const ps = prevSide(side);
            newProgress = sideLenPx(ps);
            sideRef.current = ps;
          } else {
            dirRef.current = 1;
            newProgress = 0;
          }
        }

        progressRef.current = newProgress;

        /* Compute lean angle based on current speed */
        const velocity = Math.abs(newProgress - prevProgressRef.current) / dt;
        prevProgressRef.current = newProgress;
        /* Lean forward slightly when running (positive = lean forward) */
        const maxLean = 8; // degrees
        const lean = Math.min(velocity / FLEE_SPEED, 1) * maxLean * dirRef.current;
        setTilt3d(lean);

        const { cx: ncx, cy: ncy } = toScreenCenter(sideRef.current, newProgress);
        const t = sheepTransform(sideRef.current, dirRef.current);
        setSheepPos({ left: Math.round(ncx - SHEEP_W / 2), top: Math.round(ncy - SHEEP_H / 2), transform: t });
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = MIN_BLEAT_DELAY + Math.random() * (MAX_BLEAT_DELAY - MIN_BLEAT_DELAY);
      t1 = setTimeout(() => {
        bleatRef.current = true;
        setBleating(true);
        t2 = setTimeout(() => {
          bleatRef.current = false;
          setBleating(false);
          schedule();
        }, BLEAT_DURATION);
      }, delay);
    };

    schedule();
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [mounted]);

  if (!mounted) return null;

  const bubbleLeft = Math.floor(SHEEP_W * 0.45);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    stoppedRef.current = !stoppedRef.current;
    setStopped((prev) => !prev);
  };

  return (
    <div
      data-testid="sheep"
      onContextMenu={handleContextMenu}
      style={{
        position: "fixed",
        left: sheepPos.left,
        top: sheepPos.top,
        width: SHEEP_W,
        height: SHEEP_H,
        transform: sheepPos.transform,
        transformOrigin: "center center",
        zIndex: 40,
        pointerEvents: "auto",
        cursor: stopped ? "not-allowed" : "default",
        willChange: "transform, left, top",
        /*
         * 3-D drop-shadow: a strong bottom shadow grounds the sheep,
         * while a soft side shadow gives volumetric depth.
         */
        filter: [
          "drop-shadow(0px 6px 6px rgba(0,0,0,0.55))",
          "drop-shadow(0px 10px 18px rgba(0,0,0,0.4))",
          "drop-shadow(2px 2px 3px rgba(0,0,0,0.3))",
        ].join(" "),
      }}
    >
      {/* Speech bubble */}
      <AnimatePresence>
        {bleating && (
          <motion.div
            key="bleat-bubble"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: SHEEP_H + 6,
              left: bubbleLeft,
              background: "white",
              color: "#333",
              borderRadius: "16px",
              padding: "5px 14px",
              fontSize: 17,
              fontWeight: 700,
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              transformOrigin: "bottom left",
              userSelect: "none",
            }}
          >
            Beee!
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 18,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderTop: "9px solid white",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheep graphic — outer wrapper applies perspective 3-D lean */}
      <div
        style={{
          perspective: "300px",
          perspectiveOrigin: "50% 100%",
        }}
      >
        <div
          className={bleating ? "" : "sheep-running-bounce"}
          style={{
            transform: `rotateY(${tilt3d}deg)`,
            transition: "transform 0.15s ease-out",
            transformStyle: "preserve-3d",
          }}
        >
          <SheepSVG running={!bleating} />
        </div>
      </div>
    </div>
  );
}
