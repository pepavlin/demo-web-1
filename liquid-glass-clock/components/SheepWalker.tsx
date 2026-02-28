"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SHEEP_W = 130;
const SHEEP_H = 88;
const SPEED = 38;          // px/s — slow, peaceful walk
const FLEE_SPEED = 175;
const ATTRACT_SPEED = 125;
const MOUSE_REACT_RADIUS = 200;
const CORNER_TURN_PROB = 0.5;

// Animation duration range (seconds per step cycle)
const ANIM_DUR_WALK  = 0.90;  // slow walk
const ANIM_DUR_FAST  = 0.52;  // attracted/fast
const ANIM_DUR_FLEE  = 0.32;  // fleeing full-speed

// Max terrain-lean angles (degrees) that make feet look planted
const LEAN_SIDE_WALL = 4;     // lean into wall when on right/left edge
const LEAN_SPEED_FWD = 6;     // extra forward lean when fleeing

// ── Side type ────────────────────────────────────────────────────────────────
type Side = "bottom" | "right" | "top" | "left";
const SIDES: Side[] = ["bottom", "right", "top", "left"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function sideLenPx(side: Side): number {
  return side === "bottom" || side === "top" ? window.innerWidth : window.innerHeight;
}

/**
 * Convert side + progress to screen center (cx, cy).
 *
 * "progress" is the distance travelled from the clockwise-start corner of the side:
 *   bottom : starts at left edge  (x=0),   ends at right edge  (x=vw)
 *   right  : starts at bottom-right (y=vh), ends at top-right  (y=0)
 *   top    : starts at top-right  (x=vw),  ends at top-left   (x=0)
 *   left   : starts at top-left  (y=0),    ends at bottom-left (y=vh)
 *
 * The sheep's "footprint" on the wall uses SHEEP_H as the perpendicular dimension
 * (since the sheep rotates 90° on side walls), so the center is SHEEP_H/2 away from wall.
 */
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

/**
 * CSS transform for the sheep element so it always faces the direction of travel.
 * dir=+1 means clockwise movement along the current side.
 *
 * Transform derivation (sheep SVG has head at right, feet at bottom):
 *   bottom +1 (right)   : no transform
 *   bottom -1 (left)    : scaleX(-1)
 *   right  +1 (up)      : rotate(-90deg)
 *   right  -1 (down)    : scaleX(-1) rotate(90deg)
 *   top    +1 (left)    : rotate(180deg)
 *   top    -1 (right)   : scaleY(-1)
 *   left   +1 (down)    : rotate(90deg)
 *   left   -1 (up)      : scaleX(-1) rotate(-90deg)
 */
function sheepTransform(side: Side, dir: 1 | -1): string {
  if (side === "bottom") return dir ===  1 ? "none"                       : "scaleX(-1)";
  if (side === "right")  return dir ===  1 ? "rotate(-90deg)"             : "scaleX(-1) rotate(90deg)";
  if (side === "top")    return dir ===  1 ? "rotate(180deg)"             : "scaleY(-1)";
  /* left */             return dir ===  1 ? "rotate(90deg)"              : "scaleX(-1) rotate(-90deg)";
}

/** Which clockwise direction (+1) gets the sheep closer to the mouse on the current side. */
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

/** Linear interpolation for smooth state transitions */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute the target terrain-lean angle (degrees) the sheep body should adopt
 * to look properly planted on the surface.
 *
 * On vertical walls the sheep fights a simulated gravity by leaning into the
 * surface.  When fleeing, an additional forward pitch is added so it looks like
 * the sheep is really straining.
 *
 * The angle is applied BEFORE the container rotation so the lean is always
 * relative to the direction of travel, not the screen.
 */
function computeTargetLean(
  side: Side,
  dir: 1 | -1,
  normalizedSpeed: number   // 0 = standing, 1 = max flee
): number {
  // Wall-surface lean: sheep tilts slightly toward its "ground" on side edges
  const wallLean = (side === "right" || side === "left") ? LEAN_SIDE_WALL * dir : 0;
  // Forward lean proportional to speed (negative = lean forward relative to SVG head direction)
  const speedLean = -normalizedSpeed * LEAN_SPEED_FWD;
  return wallLean + speedLean;
}

/**
 * Map current speed to leg-cycle animation duration (seconds).
 * Faster movement → shorter cycle (legs move quicker).
 */
function speedToAnimDuration(speed: number): number {
  const t = Math.min(Math.max(speed / FLEE_SPEED, 0), 1);
  // Quadratic ease: duration drops faster as speed increases
  const eased = t * t;
  return ANIM_DUR_WALK - eased * (ANIM_DUR_WALK - ANIM_DUR_FLEE);
}

// ── SheepSVG ─────────────────────────────────────────────────────────────────
interface SheepSVGProps {
  grazing: boolean;
  /** Duration (s) for one leg-swing cycle — tied to actual walking speed */
  animDuration: number;
  /** Body lean angle in degrees (terrain adaptation) */
  bodyLean: number;
}

function SheepSVG({ grazing, animDuration, bodyLean }: SheepSVGProps) {
  // Tail wags at a rate independent of walking (calm sway)
  const tailDuration = Math.max(animDuration * 0.82, 0.42);
  // Body bounce matches step cycle
  const bounceDuration = animDuration;
  // Head nod is slower and more independent
  const headNodDuration = Math.max(animDuration * 2.3, 1.6);

  return (
    <svg
      viewBox="0 0 130 88"
      width={SHEEP_W}
      height={SHEEP_H}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ovečka"
    >
      {/* Ground shadow — slightly compressed when going fast (feet barely touch) */}
      <ellipse
        cx="62" cy="87"
        rx={52 - Math.min(animDuration < 0.65 ? (0.65 - animDuration) * 60 : 0, 14)}
        ry="5"
        fill="rgba(0,0,0,0.18)"
      />

      {/*
        * Terrain-lean wrapper: rotates the whole sheep body to simulate
        * adapting posture to slope / wall surface.
        * transform-origin is at the centre of the feet area (bottom-centre).
        */}
      <g
        transform={`translate(65 75) rotate(${bodyLean}) translate(-65 -75)`}
        style={{ transition: "transform 0.18s ease-out" }}
      >
        {/* ── Tail — wagging independently ── */}
        <g
          className="sheep-tail-wag"
          style={{ animationDuration: `${tailDuration}s` }}
        >
          <circle cx="11" cy="44" r="10" fill="white" />
          <circle cx="14" cy="38" r="7"  fill="white" />
        </g>

        {/* ── Back legs (behind wool body) ── */}
        <g
          className={grazing ? "" : "sheep-leg-b1"}
          style={{ animationDuration: `${animDuration}s` }}
        >
          <rect x="18" y="61" width="8" height="21" rx="4" fill="#3d2210" />
          <ellipse cx="22" cy="84" rx="6" ry="3" fill="#2a1505" />
        </g>
        <g
          className={grazing ? "" : "sheep-leg-b2"}
          style={{ animationDuration: `${animDuration}s` }}
        >
          <rect x="31" y="61" width="8" height="21" rx="4" fill="#4a2e14" />
          <ellipse cx="35" cy="84" rx="6" ry="3" fill="#2a1505" />
        </g>

        {/* ── Wool body ── */}
        <circle cx="20" cy="49" r="18" fill="#f0f0f0" />
        <circle cx="36" cy="41" r="22" fill="#f5f5f5" />
        <circle cx="53" cy="36" r="24" fill="white" />
        <circle cx="70" cy="34" r="25" fill="white" />
        <circle cx="86" cy="38" r="22" fill="#f5f5f5" />
        <circle cx="98" cy="47" r="18" fill="#f0f0f0" />
        <circle cx="30" cy="33" r="15" fill="white" />
        <circle cx="48" cy="27" r="17" fill="white" />
        <circle cx="66" cy="25" r="17" fill="white" />
        <circle cx="83" cy="29" r="14" fill="white" />
        <circle cx="48" cy="27" r="8"  fill="#fffbfb" opacity="0.85" />
        <circle cx="66" cy="23" r="9"  fill="#fffbfb" opacity="0.85" />

        {/* ── Front legs ── */}
        <g
          className={grazing ? "" : "sheep-leg-f1"}
          style={{ animationDuration: `${animDuration}s` }}
        >
          <rect x="62" y="61" width="8" height="21" rx="4" fill="#3d2210" />
          <ellipse cx="66" cy="84" rx="6" ry="3" fill="#2a1505" />
        </g>
        <g
          className={grazing ? "" : "sheep-leg-f2"}
          style={{ animationDuration: `${animDuration}s` }}
        >
          <rect x="75" y="61" width="8" height="21" rx="4" fill="#4a2e14" />
          <ellipse cx="79" cy="84" rx="6" ry="3" fill="#2a1505" />
        </g>

        {/* ── Head — animated group (nod when walking, graze when stopped) ── */}
        <g
          className={grazing ? "sheep-head-graze" : "sheep-head-anim"}
          style={{ animationDuration: `${headNodDuration}s` }}
        >
          <circle cx="100" cy="41" r="16" fill="white" />
          {/* Ear */}
          <ellipse
            cx="116" cy="30" rx="6" ry="10" fill="#c8956a"
            transform="rotate(20 116 30)"
          />
          <ellipse
            cx="116" cy="30" rx="3.5" ry="6" fill="#ddb090"
            transform="rotate(20 116 30)"
          />
          {/* Face */}
          <ellipse cx="116" cy="52" rx="16" ry="14" fill="#c8956a" />
          {/* Eye */}
          <circle cx="123" cy="48" r="4.5" fill="#1a0a00" />
          <circle cx="124.5" cy="46.5" r="1.8" fill="white" />
          {/* Mouth */}
          <path
            d="M 118.5 46 Q 123 43 127.5 46"
            fill="none"
            stroke="#3d2210"
            strokeWidth="1.2"
          />
          {/* Nostrils */}
          <circle cx="128" cy="55" r="2" fill="#8B5030" />
          <circle cx="123" cy="57" r="2" fill="#8B5030" />
          {/* Smile */}
          <path
            d="M 122 59 Q 126 63 130 59"
            stroke="#8B5030"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SheepWalker() {
  const [mounted, setMounted] = useState(false);
  const [showBeee, setShowBeee] = useState(false);
  const [grazing, setGrazing] = useState(false);
  const [sheepPos, setSheepPos] = useState<{
    left: number;
    top: number;
    transform: string;
  }>({ left: -SHEEP_W, top: 0, transform: "none" });

  /** Current leg-cycle duration (seconds) — smoothed each frame */
  const [animDuration, setAnimDuration] = useState(ANIM_DUR_WALK);
  /** Current terrain-lean angle (degrees) — smoothed each frame */
  const [bodyLean, setBodyLean] = useState(0);

  const sideRef         = useRef<Side>("bottom");
  const progressRef     = useRef<number>(-SHEEP_W);
  const dirRef          = useRef<1 | -1>(1);
  const lastTsRef       = useRef<number | null>(null);
  const rafRef          = useRef<number | null>(null);
  const beeeTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grazingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grazingRef      = useRef(false);
  const mouseRef        = useRef<{ x: number; y: number } | null>(null);
  const isClickingRef   = useRef(false);

  // Smoothed animation state kept in refs to avoid stale closures in RAF loop
  const animDurRef  = useRef(ANIM_DUR_WALK);
  const bodyLeanRef = useRef(0);

  // Sets mounted flag on client after SSR hydration to gate browser-only effects
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // ── Mouse tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const onMove    = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave   = ()              => { mouseRef.current = null; };
    const onDown    = ()              => { isClickingRef.current = true; };
    const onUp      = ()              => { isClickingRef.current = false; };

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

  // ── Grazing scheduler ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const scheduleGraze = () => {
      // Walk for 15–40 s, then graze for 3–8 s
      const walkDelay = 15000 + Math.random() * 25000;
      grazingTimerRef.current = setTimeout(() => {
        if (mouseRef.current) {
          // Don't start grazing if mouse is near — reschedule
          scheduleGraze();
          return;
        }
        grazingRef.current = true;
        setGrazing(true);
        const graze = 3000 + Math.random() * 5000;
        grazingTimerRef.current = setTimeout(() => {
          grazingRef.current = false;
          setGrazing(false);
          scheduleGraze();
        }, graze);
      }, walkDelay);
    };

    scheduleGraze();
    return () => { if (grazingTimerRef.current) clearTimeout(grazingTimerRef.current); };
  }, [mounted]);

  // ── Walking animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    sideRef.current     = "bottom";
    progressRef.current = -SHEEP_W;
    dirRef.current      = 1;

    const loop = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.1);
      lastTsRef.current = ts;

      // Don't move when grazing
      if (!grazingRef.current) {
        const side     = sideRef.current;
        const sideLen  = sideLenPx(side);
        const progress = progressRef.current;
        const { cx, cy } = toScreenCenter(side, progress);

        let speed  = SPEED;
        let newDir = dirRef.current;

        // Mouse interaction — flee or attract, override grazing
        const mouse = mouseRef.current;
        if (mouse) {
          const dx   = cx - mouse.x;
          const dy   = cy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_REACT_RADIUS) {
            const toward = dirTowardMouse(side, cx, cy, mouse.x, mouse.y);
            if (isClickingRef.current) {
              speed  = ATTRACT_SPEED;
              newDir = toward;
            } else {
              speed  = FLEE_SPEED;
              newDir = (toward === 1 ? -1 : 1) as 1 | -1;
            }
          }
        }

        // Natural speed variation: two overlapping sine waves give organic feel
        if (speed === SPEED) {
          const t = ts / 1000;
          const variation = 1 + 0.13 * Math.sin(t * 0.42) + 0.08 * Math.sin(t * 0.95 + 1.4);
          speed *= variation;
        }

        dirRef.current = newDir;

        let newProgress = progress + speed * dirRef.current * dt;

        // ── Corner handling ──────────────────────────────────────────────────
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

        // ── Dynamic animation speed ─────────────────────────────────────────
        const normalizedSpeed = Math.min(speed / FLEE_SPEED, 1);
        const targetDur = speedToAnimDuration(speed);
        // Smooth with fast lerp so legs respond quickly to speed changes
        const lerpT = Math.min(dt * 8, 1);
        animDurRef.current  = lerp(animDurRef.current,  targetDur, lerpT);

        // ── Terrain-lean angle ──────────────────────────────────────────────
        const targetLean = computeTargetLean(sideRef.current, dirRef.current, normalizedSpeed);
        bodyLeanRef.current = lerp(bodyLeanRef.current, targetLean, Math.min(dt * 5, 1));

        // Batch state updates (React 18 auto-batches these in event handlers
        // but in RAF callbacks we call them explicitly once per frame)
        setAnimDuration(animDurRef.current);
        setBodyLean(bodyLeanRef.current);

        const { cx: ncx, cy: ncy } = toScreenCenter(sideRef.current, newProgress);
        const t = sheepTransform(sideRef.current, dirRef.current);
        setSheepPos({ left: ncx - SHEEP_W / 2, top: ncy - SHEEP_H / 2, transform: t });
      } else {
        // When grazing: snap lean to 0 and slow animation to walk pace
        animDurRef.current  = lerp(animDurRef.current,  ANIM_DUR_WALK, Math.min(dt * 3, 1));
        bodyLeanRef.current = lerp(bodyLeanRef.current, 0, Math.min(dt * 3, 1));
        setAnimDuration(animDurRef.current);
        setBodyLean(bodyLeanRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
    };
  }, [mounted]);

  // ── Random "béé" speech bubble ────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const schedule = () => {
      const delay = 4000 + Math.random() * 10000;
      beeeTimerRef.current = setTimeout(() => {
        setShowBeee(true);
        beeeTimerRef.current = setTimeout(() => {
          setShowBeee(false);
          schedule();
        }, 2500);
      }, delay);
    };

    schedule();

    return () => {
      if (beeeTimerRef.current) clearTimeout(beeeTimerRef.current);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      data-testid="sheep-walker"
      style={{
        position: "fixed",
        left: sheepPos.left,
        top: sheepPos.top,
        width: SHEEP_W,
        height: SHEEP_H,
        transform: sheepPos.transform,
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: 40,
        willChange: "transform, left, top",
      }}
    >
      {/* ── "béé" speech bubble ── */}
      <AnimatePresence>
        {showBeee && (
          <motion.div
            key="beee-bubble"
            data-testid="beee-bubble"
            initial={{ opacity: 0, scale: 0.4, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, y: 10 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            style={{
              position: "absolute",
              bottom: SHEEP_H + 8,
              left: "89%",
              transform: "translateX(-50%)",
              background: "white",
              border: "2.5px solid rgba(80, 50, 20, 0.8)",
              borderRadius: "18px",
              padding: "5px 16px",
              fontSize: "16px",
              fontWeight: 900,
              color: "#5a3515",
              whiteSpace: "nowrap",
              letterSpacing: "0.06em",
              boxShadow:
                "0 4px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.9)",
              userSelect: "none",
            }}
          >
            béé!
            <svg
              style={{
                position: "absolute",
                bottom: -12,
                left: "50%",
                transform: "translateX(-50%)",
                overflow: "visible",
                display: "block",
              }}
              width="18"
              height="12"
              viewBox="0 0 18 12"
            >
              <path d="M1 0 L9 12 L17 0" fill="white" />
              <path
                d="M1 0 L9 12 L17 0"
                fill="none"
                stroke="rgba(80,50,20,0.8)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sheep body — use idle sway when grazing, walk bob when moving ── */}
      <div
        className={grazing ? "sheep-body-idle" : "sheep-body-bob"}
        style={{ animationDuration: grazing ? undefined : `${animDuration}s` }}
      >
        <SheepSVG
          grazing={grazing}
          animDuration={animDuration}
          bodyLean={bodyLean}
        />
      </div>
    </div>
  );
}
