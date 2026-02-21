"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const SHEEP_W = 120;
const SHEEP_H = 85;
const MOVE_SPEED = 280; // px per second along edge
const JUMP_VELOCITY = 520; // px/s away from wall (toward center)
const GRAVITY = 1200; // px/s²
const GROUND_Y_OFFSET = 10; // gap between sheep feet and wall
const HALF_W = SHEEP_W / 2;
// Distance from wall to sheep center when on wall (half height + gap)
const BASE_WALL_DIST = SHEEP_H / 2 + GROUND_Y_OFFSET;

type Edge = "bottom" | "right" | "top" | "left";

interface SheepTransform {
  cx: number; // screen center x
  cy: number; // screen center y
  rot: number; // CSS rotation in degrees
}

/**
 * Clockwise sign: +1 if pressing right arrow increases edgePos, -1 if it decreases.
 * bottom: right=rightward (+x), left: right=downward (+y) → +1
 * right:  right=upward    (-y), top:  right=leftward (-x)  → -1
 */
function cwSign(edge: Edge): number {
  return edge === "bottom" || edge === "left" ? 1 : -1;
}

/**
 * Valid edgePos range for each edge (center of sheep, clamped so sheep stays on screen).
 */
function edgeLimits(
  edge: Edge,
  W: number,
  H: number
): { min: number; max: number } {
  if (edge === "bottom" || edge === "top") return { min: HALF_W, max: W - HALF_W };
  return { min: HALF_W, max: H - HALF_W };
}

/**
 * Compute screen center position and CSS rotation from edge + edgePos + wallDepth.
 * wallDepth=0 means sheep is on the wall; positive means hovering toward center.
 */
function getTransform(
  edge: Edge,
  edgePos: number,
  wallDepth: number,
  W: number,
  H: number
): SheepTransform {
  const d = BASE_WALL_DIST + wallDepth;
  switch (edge) {
    case "bottom": return { cx: edgePos, cy: H - d,    rot: 0   };
    case "right":  return { cx: W - d,   cy: edgePos,  rot: -90 };
    case "top":    return { cx: edgePos, cy: d,         rot: 180 };
    case "left":   return { cx: d,       cy: edgePos,  rot: 90  };
  }
}

/**
 * When the sheep hits a corner, transition to the adjacent edge.
 * clockwise=true  → right arrow direction (bottom→right→top→left→bottom)
 * clockwise=false → left arrow direction  (bottom→left→top→right→bottom)
 */
function cornerTransition(
  edge: Edge,
  clockwise: boolean,
  W: number,
  H: number
): { newEdge: Edge; newEdgePos: number } {
  if (clockwise) {
    switch (edge) {
      case "bottom": return { newEdge: "right",  newEdgePos: H - HALF_W };
      case "right":  return { newEdge: "top",    newEdgePos: W - HALF_W };
      case "top":    return { newEdge: "left",   newEdgePos: HALF_W     };
      case "left":   return { newEdge: "bottom", newEdgePos: HALF_W     };
    }
  } else {
    switch (edge) {
      case "bottom": return { newEdge: "left",   newEdgePos: H - HALF_W };
      case "left":   return { newEdge: "top",    newEdgePos: HALF_W     };
      case "top":    return { newEdge: "right",  newEdgePos: HALF_W     };
      case "right":  return { newEdge: "bottom", newEdgePos: W - HALF_W };
    }
  }
}

// ── Violet-coloured SVG sheep ──────────────────────────────────────────────────
function VioletSheepSVG({ facingRight }: { facingRight: boolean }) {
  return (
    <svg
      viewBox="0 0 130 88"
      width={SHEEP_W}
      height={SHEEP_H}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Violet sheep"
      style={{ transform: facingRight ? "none" : "scaleX(-1)", display: "block" }}
    >
      {/* Ground shadow */}
      <ellipse cx="62" cy="87" rx="52" ry="5" fill="rgba(80,0,120,0.18)" />

      {/* Tail — left side */}
      <circle cx="11" cy="44" r="10" fill="#c084fc" />
      <circle cx="14" cy="38" r="7" fill="#d8b4fe" />

      {/* ── Back legs ── */}
      <g>
        <rect x="18" y="61" width="8" height="21" rx="4" fill="#6d28d9" />
        <ellipse cx="22" cy="84" rx="6" ry="3" fill="#4c1d95" />
      </g>
      <g>
        <rect x="31" y="61" width="8" height="21" rx="4" fill="#7c3aed" />
        <ellipse cx="35" cy="84" rx="6" ry="3" fill="#4c1d95" />
      </g>

      {/* ── Wool body (violet shades) ── */}
      <circle cx="20" cy="49" r="18" fill="#c084fc" />
      <circle cx="36" cy="41" r="22" fill="#a855f7" />
      <circle cx="53" cy="36" r="24" fill="#b77dff" />
      <circle cx="70" cy="34" r="25" fill="#c084fc" />
      <circle cx="86" cy="38" r="22" fill="#a855f7" />
      <circle cx="98" cy="47" r="18" fill="#c084fc" />
      <circle cx="30" cy="33" r="15" fill="#d8b4fe" />
      <circle cx="48" cy="27" r="17" fill="#e9d5ff" />
      <circle cx="66" cy="25" r="17" fill="#e9d5ff" />
      <circle cx="83" cy="29" r="14" fill="#d8b4fe" />
      {/* Highlight sheen */}
      <circle cx="48" cy="27" r="8" fill="#f3e8ff" opacity="0.8" />
      <circle cx="66" cy="23" r="9" fill="#f3e8ff" opacity="0.8" />

      {/* ── Front legs ── */}
      <g>
        <rect x="62" y="61" width="8" height="21" rx="4" fill="#6d28d9" />
        <ellipse cx="66" cy="84" rx="6" ry="3" fill="#4c1d95" />
      </g>
      <g>
        <rect x="75" y="61" width="8" height="21" rx="4" fill="#7c3aed" />
        <ellipse cx="79" cy="84" rx="6" ry="3" fill="#4c1d95" />
      </g>

      {/* ── Head (violet face) ── */}
      <circle cx="100" cy="41" r="16" fill="#e9d5ff" />
      {/* Ear */}
      <ellipse cx="116" cy="30" rx="6" ry="10" fill="#a855f7" transform="rotate(20 116 30)" />
      <ellipse cx="116" cy="30" rx="3.5" ry="6" fill="#c084fc" transform="rotate(20 116 30)" />
      {/* Face/snout */}
      <ellipse cx="116" cy="52" rx="16" ry="14" fill="#c084fc" />
      {/* Eye */}
      <circle cx="123" cy="48" r="4.5" fill="#1a0a00" />
      <circle cx="124.5" cy="46.5" r="1.8" fill="white" />
      {/* Mouth */}
      <path d="M 118.5 46 Q 123 43 127.5 46" fill="none" stroke="#6d28d9" strokeWidth="1.2" />
      {/* Nostrils */}
      <circle cx="128" cy="55" r="2" fill="#7c3aed" />
      <circle cx="123" cy="57" r="2" fill="#7c3aed" />
      <path d="M 122 59 Q 126 63 130 59" stroke="#7c3aed" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VioletSheep() {
  const [mounted, setMounted] = useState(false);
  const [sheepTransform, setSheepTransform] = useState<SheepTransform>({ cx: 200, cy: 0, rot: 0 });
  const [jumping, setJumping] = useState(false);
  const [facingRight, setFacingRight] = useState(true);

  // Physics state (in refs for animation loop)
  const edgeRef = useRef<Edge>("bottom");
  const edgePosRef = useRef(200); // position along current edge (center coordinate)
  const wallDepthRef = useRef(0); // distance from wall (0 = on wall)
  const velNormalRef = useRef(0); // velocity perpendicular to wall
  const jumpingRef = useRef(false);
  const facingRightRef = useRef(true);
  const keysRef = useRef<{ left: boolean; right: boolean; up: boolean }>({
    left: false,
    right: false,
    up: false,
  });
  const rafRef = useRef<number>(0);

  useEffect(() => { setMounted(true); }, []);

  // ── Keyboard tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  { keysRef.current.left  = true; e.preventDefault(); }
      if (e.key === "ArrowRight") { keysRef.current.right = true; e.preventDefault(); }
      if (e.key === "ArrowUp")    { keysRef.current.up    = true; e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  keysRef.current.left  = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
      if (e.key === "ArrowUp")    keysRef.current.up    = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
    };
  }, [mounted]);

  // ── Physics + movement loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    // Initialise on bottom edge
    edgeRef.current = "bottom";
    edgePosRef.current = 200;
    wallDepthRef.current = 0;
    velNormalRef.current = 0;
    setSheepTransform(getTransform("bottom", 200, 0, W, H));

    let prev = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;

      const W = window.innerWidth;
      const H = window.innerHeight;
      const keys = keysRef.current;
      const edge = edgeRef.current;
      const cw = cwSign(edge); // +1 or -1
      const { min, max } = edgeLimits(edge, W, H);

      // ── Movement along current edge ────────────────────────────────────────
      // Right arrow = clockwise: dEdgePos = +cw * speed * dt
      // Left  arrow = counter-clockwise: dEdgePos = -cw * speed * dt
      let dEdgePos = 0;
      if (keys.right) {
        dEdgePos = cw * MOVE_SPEED * dt;
        if (!facingRightRef.current) {
          facingRightRef.current = true;
          setFacingRight(true);
        }
      } else if (keys.left) {
        dEdgePos = -cw * MOVE_SPEED * dt;
        if (facingRightRef.current) {
          facingRightRef.current = false;
          setFacingRight(false);
        }
      }

      let newEdgePos = edgePosRef.current + dEdgePos;
      let newEdge = edge;

      // ── Corner transitions ─────────────────────────────────────────────────
      // dEdgePos>0 with overflow at max, or dEdgePos<0 with overflow at min.
      // Whether it's clockwise depends on the edge's cwSign direction.
      if (dEdgePos > 0 && newEdgePos > max) {
        // Moving in +edgePos direction; overflow at max
        // cw>0 (bottom/left): +edgePos is clockwise → clockwise transition
        // cw<0 (right/top):   +edgePos is counter-clockwise → CCW transition
        const t = cornerTransition(edge, cw > 0, W, H);
        newEdge = t.newEdge;
        newEdgePos = t.newEdgePos;
      } else if (dEdgePos < 0 && newEdgePos < min) {
        // Moving in -edgePos direction; overflow at min
        // cw>0: -edgePos is counter-clockwise → CCW transition
        // cw<0: -edgePos is clockwise → clockwise transition
        const t = cornerTransition(edge, cw < 0, W, H);
        newEdge = t.newEdge;
        newEdgePos = t.newEdgePos;
      } else {
        newEdgePos = Math.max(min, Math.min(max, newEdgePos));
      }

      edgeRef.current = newEdge;
      edgePosRef.current = newEdgePos;

      // ── Jump (perpendicular to wall, toward center) ────────────────────────
      if (keys.up && !jumpingRef.current) {
        velNormalRef.current = JUMP_VELOCITY;
        jumpingRef.current = true;
        setJumping(true);
      }

      // Perpendicular physics (wallDepth increases toward center, gravity pulls back)
      if (jumpingRef.current) {
        velNormalRef.current -= GRAVITY * dt;
        wallDepthRef.current += velNormalRef.current * dt;

        if (wallDepthRef.current <= 0) {
          wallDepthRef.current = 0;
          velNormalRef.current = 0;
          jumpingRef.current = false;
          setJumping(false);
        }
      }

      setSheepTransform(getTransform(newEdge, newEdgePos, wallDepthRef.current, W, H));
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  const handleResize = useCallback(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const edge = edgeRef.current;
    const { min, max } = edgeLimits(edge, W, H);
    edgePosRef.current = Math.max(min, Math.min(max, edgePosRef.current));
    setSheepTransform(getTransform(edge, edgePosRef.current, wallDepthRef.current, W, H));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mounted, handleResize]);

  if (!mounted) return null;

  return (
    <div
      data-testid="violet-sheep"
      style={{
        position: "fixed",
        left: sheepTransform.cx,
        top: sheepTransform.cy,
        width: SHEEP_W,
        height: SHEEP_H,
        zIndex: 45,
        pointerEvents: "none",
        willChange: "transform",
        filter: [
          "drop-shadow(0px 4px 8px rgba(109,40,217,0.5))",
          "drop-shadow(0px 8px 16px rgba(109,40,217,0.3))",
        ].join(" "),
        // Sheep is positioned by its center; rotation makes it stand on any wall
        transform: `translate(-50%, -50%) rotate(${sheepTransform.rot}deg)`,
      }}
    >
      <div
        className={jumping ? "" : "sheep-body-bob"}
        style={{ width: SHEEP_W, height: SHEEP_H }}
      >
        <VioletSheepSVG facingRight={facingRight} />
      </div>
    </div>
  );
}
