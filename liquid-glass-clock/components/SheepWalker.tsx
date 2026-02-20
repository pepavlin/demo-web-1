"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";

const SHEEP_W = 130;
const SHEEP_H = 88;
const SPEED = 55; // pixels per second

// ── Sheep SVG — cute side-view sheep facing right ───────────────────────────
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

      {/* ── Wool body — overlapping circles for fluffy texture ── */}
      {/* Back/bottom row */}
      <circle cx="20" cy="49" r="18" fill="#f0f0f0" />
      <circle cx="36" cy="41" r="22" fill="#f5f5f5" />
      <circle cx="53" cy="36" r="24" fill="white" />
      <circle cx="70" cy="34" r="25" fill="white" />
      <circle cx="86" cy="38" r="22" fill="#f5f5f5" />
      <circle cx="98" cy="47" r="18" fill="#f0f0f0" />
      {/* Top row — extra fluffiness */}
      <circle cx="30" cy="33" r="15" fill="white" />
      <circle cx="48" cy="27" r="17" fill="white" />
      <circle cx="66" cy="25" r="17" fill="white" />
      <circle cx="83" cy="29" r="14" fill="white" />
      {/* Soft specular highlights */}
      <circle cx="48" cy="27" r="8" fill="#fffbfb" opacity="0.85" />
      <circle cx="66" cy="23" r="9" fill="#fffbfb" opacity="0.85" />

      {/* ── Front legs (in front of wool body) ── */}
      <g className="sheep-leg-f1">
        <rect x="62" y="61" width="8" height="21" rx="4" fill="#3d2210" />
        <ellipse cx="66" cy="84" rx="6" ry="3" fill="#2a1505" />
      </g>
      <g className="sheep-leg-f2">
        <rect x="75" y="61" width="8" height="21" rx="4" fill="#4a2e14" />
        <ellipse cx="79" cy="84" rx="6" ry="3" fill="#2a1505" />
      </g>

      {/* ── Head area ── */}
      {/* Wool puff connecting body to head */}
      <circle cx="100" cy="41" r="16" fill="white" />

      {/* Ear */}
      <ellipse
        cx="116" cy="30" rx="6" ry="10"
        fill="#c8956a"
        transform="rotate(20 116 30)"
      />
      <ellipse
        cx="116" cy="30" rx="3.5" ry="6"
        fill="#ddb090"
        transform="rotate(20 116 30)"
      />

      {/* Head oval */}
      <ellipse cx="116" cy="52" rx="16" ry="14" fill="#c8956a" />

      {/* Eye */}
      <circle cx="123" cy="48" r="4.5" fill="#1a0a00" />
      <circle cx="124.5" cy="46.5" r="1.8" fill="white" />
      {/* Subtle eyelid arc */}
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
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SheepWalker() {
  const [mounted, setMounted] = useState(false);
  const [facingRight, setFacingRight] = useState(true);
  const [showBeee, setShowBeee] = useState(false);

  // Motion value for smooth x position — updates DOM directly, no re-renders
  const x = useMotionValue(-SHEEP_W);

  const dirRef = useRef<1 | -1>(1);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const beeeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydration guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Walking animation loop via requestAnimationFrame ──────────────────────
  useEffect(() => {
    if (!mounted) return;

    const loop = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.1);
      lastTsRef.current = ts;

      const cur = x.get();
      const vw = window.innerWidth;
      let next = cur + SPEED * dirRef.current * dt;

      if (dirRef.current === 1 && next > vw + SHEEP_W) {
        dirRef.current = -1;
        setFacingRight(false);
        next = vw + SHEEP_W;
      } else if (dirRef.current === -1 && next < -SHEEP_W) {
        dirRef.current = 1;
        setFacingRight(true);
        next = -SHEEP_W;
      }

      x.set(next);
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
  }, [mounted, x]);

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

  // Bubble hovers above the sheep's head:
  //   head is at ~89% from left when facing right, ~11% when facing left
  const bubbleLeft = facingRight ? "89%" : "11%";

  return (
    <div
      data-testid="sheep-walker"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: `${SHEEP_H + 40}px`,
        pointerEvents: "none",
        zIndex: 40,
        overflow: "visible",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          x,
          willChange: "transform",
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
                left: bubbleLeft,
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
              {/* Bubble pointer triangle */}
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
        {/* Outer div handles left/right flip */}
        <div
          style={{
            transform: facingRight ? undefined : "scaleX(-1)",
            transformOrigin: "center center",
          }}
        >
          {/* Inner div handles the walking body-bob */}
          <div className="sheep-body-bob">
            <SheepSVG />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
