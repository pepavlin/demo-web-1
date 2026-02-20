"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SHEEP_W = 100;
const SHEEP_H = 90; // SVG viewBox height
const SPEED = 90; // px per second
const FLEE_SPEED = 220; // px per second when scared
const ATTRACT_SPEED = 160; // px per second when attracted
const MOUSE_REACT_RADIUS = 220; // px distance to trigger reaction
const BLEAT_DURATION = 3000; // ms
const MIN_BLEAT_DELAY = 8000; // ms
const MAX_BLEAT_DELAY = 22000; // ms

// The sheep SVG, always drawn facing right; the parent div flips it for left-facing.
function SheepSVG({ running }: { running: boolean }) {
  const legA = running ? "sheep-leg-a" : "";
  const legB = running ? "sheep-leg-b" : "";

  return (
    <svg
      width={SHEEP_W}
      height={SHEEP_H}
      viewBox="0 0 100 90"
      aria-hidden="true"
    >
      {/* Back legs — drawn first so the wool body covers their tops */}
      <g className={legB}>
        <rect x="52" y="60" width="8" height="26" rx="4" fill="#1a1a1a" />
      </g>
      <g className={legA}>
        <rect x="64" y="60" width="8" height="26" rx="4" fill="#1a1a1a" />
      </g>

      {/* Wool body — overlapping circles give a fluffy look */}
      <ellipse cx="45" cy="48" rx="35" ry="22" fill="white" />
      <circle cx="22" cy="35" r="16" fill="white" />
      <circle cx="36" cy="27" r="18" fill="white" />
      <circle cx="53" cy="25" r="18" fill="white" />
      <circle cx="68" cy="31" r="15" fill="white" />

      {/* Dark head on the right side */}
      <ellipse cx="81" cy="43" rx="13" ry="12" fill="#333" />
      {/* Eye */}
      <circle cx="85" cy="39" r="2.8" fill="white" />
      <circle cx="85.5" cy="39" r="1.4" fill="#0a0a0a" />
      {/* Ear */}
      <ellipse cx="75" cy="32" rx="5" ry="3" fill="#444" transform="rotate(-15 75 32)" />
      {/* Nostrils */}
      <circle cx="86" cy="48" r="1.2" fill="#555" />
      <circle cx="89" cy="47" r="1.2" fill="#555" />

      {/* Front legs — drawn last so they appear in front of the body */}
      <g className={legA}>
        <rect x="18" y="60" width="8" height="26" rx="4" fill="#1a1a1a" />
      </g>
      <g className={legB}>
        <rect x="30" y="60" width="8" height="26" rx="4" fill="#1a1a1a" />
      </g>
    </svg>
  );
}

export default function Sheep() {
  const [mounted, setMounted] = useState(false);
  const [x, setX] = useState(-SHEEP_W - 20);
  const [facing, setFacing] = useState<"right" | "left">("right");
  const [bleating, setBleating] = useState(false);

  const xRef = useRef(-SHEEP_W - 20);
  const dirRef = useRef<1 | -1>(1); // 1 = right, -1 = left
  const bleatRef = useRef(false);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const isClickingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track mouse globally
  useEffect(() => {
    if (!mounted) return;

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouseRef.current = null;
    };
    const onMouseDown = () => {
      isClickingRef.current = true;
    };
    const onMouseUp = () => {
      isClickingRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [mounted]);

  // Movement animation loop
  useEffect(() => {
    if (!mounted) return;

    let prev = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05); // cap delta to avoid jumps
      prev = now;

      if (!bleatRef.current) {
        const sw = window.innerWidth;
        // Sheep center x for distance calc
        const sheepCenterX = xRef.current + SHEEP_W / 2;
        // Sheep is at fixed bottom, so use window bottom area for y
        const sheepCenterY = window.innerHeight - SHEEP_H / 2;

        const mouse = mouseRef.current;
        const clicking = isClickingRef.current;

        let currentSpeed = SPEED;
        let newDir = dirRef.current;

        if (mouse) {
          const dx = sheepCenterX - mouse.x;
          const dy = sheepCenterY - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOUSE_REACT_RADIUS) {
            if (clicking) {
              // Attract: run towards mouse x position
              currentSpeed = ATTRACT_SPEED;
              newDir = mouse.x > sheepCenterX ? 1 : -1;
            } else {
              // Flee: run away from mouse
              currentSpeed = FLEE_SPEED;
              newDir = dx > 0 ? 1 : -1; // run away: if mouse is to the right, run right
            }
          }
        }

        // Apply direction change with facing update
        if (newDir !== dirRef.current) {
          dirRef.current = newDir;
          setFacing(newDir === 1 ? "right" : "left");
        }

        let nx = xRef.current + dirRef.current * currentSpeed * dt;

        if (nx >= sw + 20 && dirRef.current === 1) {
          dirRef.current = -1;
          setFacing("left");
          nx = sw + 20;
        } else if (nx <= -SHEEP_W - 20 && dirRef.current === -1) {
          dirRef.current = 1;
          setFacing("right");
          nx = -SHEEP_W - 20;
        }

        xRef.current = nx;
        setX(Math.round(nx));
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  // Randomly schedule bleating
  useEffect(() => {
    if (!mounted) return;

    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay =
        MIN_BLEAT_DELAY + Math.random() * (MAX_BLEAT_DELAY - MIN_BLEAT_DELAY);
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
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mounted]);

  if (!mounted) return null;

  const flipped = facing === "left";
  // Position the speech bubble near the head
  const bubbleLeft = flipped ? 0 : Math.floor(SHEEP_W * 0.45);

  return (
    <div
      data-testid="sheep"
      style={{
        position: "fixed",
        left: x,
        bottom: 0,
        zIndex: 40,
        pointerEvents: "none",
        willChange: "left",
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
              boxShadow: "0 2px 12px rgba(0,0,0,0.30)",
              transformOrigin: "bottom left",
              userSelect: "none",
            }}
          >
            Beee!
            {/* Bubble tail */}
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

      {/* Sheep graphic — flipped horizontally when facing left */}
      <div
        className={bleating ? "" : "sheep-running-bounce"}
        style={{ transform: flipped ? "scaleX(-1)" : undefined }}
      >
        <SheepSVG running={!bleating} />
      </div>
    </div>
  );
}
