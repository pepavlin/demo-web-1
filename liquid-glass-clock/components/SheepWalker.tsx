"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SHEEP_W = 130;
const SHEEP_H = 88;
const SPEED = 55; // pixels per second
const FLEE_SPEED = 180;
const ATTRACT_SPEED = 130;
const MOUSE_REACT_RADIUS = 200;
const CORNER_TURN_PROB = 0.5; // probability of turning onto adjacent side at corner

// ── Side type ────────────────────────────────────────────────────────────────
type Side = "bottom" | "right" | "top" | "left";

// Clockwise order of sides
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
 * CSS transform for the sheep element.
 * dir=+1 means clockwise movement along the current side.
 *
 * Transform derivation (sheep SVG has head at right, feet at bottom):
 *   bottom +1 (right)   : no transform            → head right,  feet down
 *   bottom -1 (left)    : scaleX(-1)              → head left,   feet down
 *   right  +1 (up)      : rotate(-90deg)          → head up,     feet right
 *   right  -1 (down)    : scaleX(-1) rotate(90deg)→ head down,   feet right
 *   top    +1 (left)    : rotate(180deg)           → head left,   feet up
 *   top    -1 (right)   : scaleY(-1)              → head right,  feet up
 *   left   +1 (down)    : rotate(90deg)            → head down,   feet left
 *   left   -1 (up)      : scaleX(-1) rotate(-90deg)→ head up,    feet left
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
    case "right":  return my <= cy ? 1 : -1; // progress↑ = going up = cy↓
    case "top":    return mx <= cx ? 1 : -1; // progress↑ = going left = cx↓
    case "left":   return my >= cy ? 1 : -1; // progress↑ = going down = cy↑
  }
}

function nextSide(s: Side): Side { return SIDES[(SIDES.indexOf(s) + 1) % 4]; }
function prevSide(s: Side): Side { return SIDES[(SIDES.indexOf(s) + 3) % 4]; }

// ── SheepSVG ─────────────────────────────────────────────────────────────────
function SheepSVG() {
  return (
    <svg
      viewBox="0 0 130 88"
      width={SHEEP_W}
      height={SHEEP_H}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ovečka"
    >
      {/* Ground shadow */}
      <ellipse cx="62" cy="87" rx="52" ry="5" fill="rgba(0,0,0,0.18)" />

      {/* Tail — left side */}
      <circle cx="11" cy="44" r="10" fill="white" />
      <circle cx="14" cy="38" r="7" fill="white" />

      {/* ── Back legs (behind wool body) ── */}
      <g className="sheep-leg-b1">
        <rect x="18" y="61" width="8" height="21" rx="4" fill="#3d2210" />
        <ellipse cx="22" cy="84" rx="6" ry="3" fill="#2a1505" />
      </g>
      <g className="sheep-leg-b2">
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
      <circle cx="48" cy="27" r="8" fill="#fffbfb" opacity="0.85" />
      <circle cx="66" cy="23" r="9" fill="#fffbfb" opacity="0.85" />

      {/* ── Front legs ── */}
      <g className="sheep-leg-f1">
        <rect x="62" y="61" width="8" height="21" rx="4" fill="#3d2210" />
        <ellipse cx="66" cy="84" rx="6" ry="3" fill="#2a1505" />
      </g>
      <g className="sheep-leg-f2">
        <rect x="75" y="61" width="8" height="21" rx="4" fill="#4a2e14" />
        <ellipse cx="79" cy="84" rx="6" ry="3" fill="#2a1505" />
      </g>

      {/* ── Head ── */}
      <circle cx="100" cy="41" r="16" fill="white" />
      <ellipse cx="116" cy="30" rx="6" ry="10" fill="#c8956a" transform="rotate(20 116 30)" />
      <ellipse cx="116" cy="30" rx="3.5" ry="6" fill="#ddb090" transform="rotate(20 116 30)" />
      <ellipse cx="116" cy="52" rx="16" ry="14" fill="#c8956a" />
      <circle cx="123" cy="48" r="4.5" fill="#1a0a00" />
      <circle cx="124.5" cy="46.5" r="1.8" fill="white" />
      <path d="M 118.5 46 Q 123 43 127.5 46" fill="none" stroke="#3d2210" strokeWidth="1.2" />
      <circle cx="128" cy="55" r="2" fill="#8B5030" />
      <circle cx="123" cy="57" r="2" fill="#8B5030" />
      <path d="M 122 59 Q 126 63 130 59" stroke="#8B5030" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SheepWalker() {
  const [mounted, setMounted] = useState(false);
  const [showBeee, setShowBeee] = useState(false);
  const [sheepPos, setSheepPos] = useState<{
    left: number;
    top: number;
    transform: string;
  }>({ left: -SHEEP_W, top: 0, transform: "none" });

  const sideRef = useRef<Side>("bottom");
  const progressRef = useRef<number>(-SHEEP_W); // start off-screen left
  const dirRef = useRef<1 | -1>(1);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const beeeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const isClickingRef = useRef(false);

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

  // ── Walking animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    // Initialise starting position (off-screen bottom-left)
    sideRef.current    = "bottom";
    progressRef.current = -SHEEP_W;
    dirRef.current     = 1;

    const loop = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.1);
      lastTsRef.current = ts;

      const side    = sideRef.current;
      const sideLen = sideLenPx(side);
      const progress = progressRef.current;
      const { cx, cy } = toScreenCenter(side, progress);

      let speed  = SPEED;
      let newDir = dirRef.current;

      // Mouse interaction
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

      dirRef.current = newDir;

      let newProgress = progress + speed * dirRef.current * dt;

      // ── Corner handling ─────────────────────────────────────────────────────
      if (dirRef.current === 1 && newProgress >= sideLen) {
        if (Math.random() < CORNER_TURN_PROB) {
          // Turn onto the next clockwise side
          sideRef.current = nextSide(side);
          newProgress = 0;
        } else {
          // Reverse direction
          dirRef.current = -1;
          newProgress = sideLen;
        }
      } else if (dirRef.current === -1 && newProgress <= 0) {
        if (Math.random() < CORNER_TURN_PROB) {
          // Turn onto the previous (counter-clockwise) side
          const ps = prevSide(side);
          newProgress = sideLenPx(ps);
          sideRef.current = ps;
        } else {
          dirRef.current = 1;
          newProgress = 0;
        }
      }

      progressRef.current = newProgress;

      // Update React state for re-render
      const { cx: ncx, cy: ncy } = toScreenCenter(sideRef.current, newProgress);
      const t = sheepTransform(sideRef.current, dirRef.current);
      setSheepPos({ left: ncx - SHEEP_W / 2, top: ncy - SHEEP_H / 2, transform: t });

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
      {/* ── "béé" speech bubble — positioned in sheep's own coordinate space ── */}
      {/* The bubble always sits above the head (right side of SVG), and the    */}
      {/* transform on the parent rotates it into the correct screen position.   */}
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
              left: "89%", // head is always at ~89% from left in SVG coordinate space
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

      {/* ── Sheep body ── */}
      <div className="sheep-body-bob">
        <SheepSVG />
      </div>
    </div>
  );
}
