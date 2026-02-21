"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const SHEEP_W = 120;
const SHEEP_H = 85;
const MOVE_SPEED = 280; // px per second
const GROUND_Y_OFFSET = 10; // px above bottom edge
const JUMP_VELOCITY = -520; // px/s upward (negative = up)
const GRAVITY = 1200; // px/s²
const MIN_X = 0;

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
  const [posX, setPosX] = useState(200);
  const [posY, setPosY] = useState(0); // will be set on mount
  const [jumping, setJumping] = useState(false);
  const [facingRight, setFacingRight] = useState(true);

  const posXRef = useRef(200);
  const posYRef = useRef(0);
  const velYRef = useRef(0);
  const groundYRef = useRef(0);
  const keysRef = useRef<{ left: boolean; right: boolean; up: boolean }>({
    left: false,
    right: false,
    up: false,
  });
  const jumpingRef = useRef(false);
  const facingRightRef = useRef(true);
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

    // Set ground level: bottom of screen minus sheep height minus a small gap
    const groundY = window.innerHeight - SHEEP_H - GROUND_Y_OFFSET;
    groundYRef.current = groundY;
    posYRef.current = groundY;
    setPosY(groundY);

    let prev = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;

      const keys = keysRef.current;
      const maxX = window.innerWidth - SHEEP_W;
      const ground = groundYRef.current;

      // Horizontal movement
      let dx = 0;
      if (keys.left)  dx -= MOVE_SPEED * dt;
      if (keys.right) dx += MOVE_SPEED * dt;

      let newX = Math.max(MIN_X, Math.min(maxX, posXRef.current + dx));

      if (dx < 0 && facingRightRef.current) {
        facingRightRef.current = false;
        setFacingRight(false);
      } else if (dx > 0 && !facingRightRef.current) {
        facingRightRef.current = true;
        setFacingRight(true);
      }

      // Jump: only when on ground and up key pressed
      if (keys.up && !jumpingRef.current) {
        velYRef.current = JUMP_VELOCITY;
        jumpingRef.current = true;
        setJumping(true);
      }

      // Vertical physics
      let newY = posYRef.current;
      if (jumpingRef.current) {
        velYRef.current += GRAVITY * dt;
        newY = posYRef.current + velYRef.current * dt;

        if (newY >= ground) {
          newY = ground;
          velYRef.current = 0;
          jumpingRef.current = false;
          setJumping(false);
        }
      }

      posXRef.current = newX;
      posYRef.current = newY;

      setPosX(Math.round(newX));
      setPosY(Math.round(newY));

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  const handleResize = useCallback(() => {
    const ground = window.innerHeight - SHEEP_H - GROUND_Y_OFFSET;
    groundYRef.current = ground;
    if (!jumpingRef.current) {
      posYRef.current = ground;
      setPosY(ground);
    }
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
        left: posX,
        top: posY,
        width: SHEEP_W,
        height: SHEEP_H,
        zIndex: 45,
        pointerEvents: "none",
        willChange: "transform, left, top",
        filter: [
          "drop-shadow(0px 4px 8px rgba(109,40,217,0.5))",
          "drop-shadow(0px 8px 16px rgba(109,40,217,0.3))",
        ].join(" "),
        transition: jumping ? "none" : undefined,
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
