"use client";

import { useEffect, useRef, useState } from "react";

interface FlightState {
  active: boolean;
  yPercent: number;
  direction: "ltr" | "rtl";
  scale: number;
}

const IDLE_MIN_MS = 20_000;
const IDLE_MAX_MS = 45_000;
const FLIGHT_DURATION_MS = 14_000;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function Airplane() {
  const [flight, setFlight] = useState<FlightState>({
    active: false,
    yPercent: 25,
    direction: "ltr",
    scale: 1,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function scheduleFlight() {
      const delay = randomBetween(IDLE_MIN_MS, IDLE_MAX_MS);
      timerRef.current = setTimeout(() => {
        const direction = Math.random() > 0.5 ? "ltr" : "rtl";
        const yPercent = randomBetween(8, 55);
        const scale = randomBetween(0.6, 1.2);
        setFlight({ active: true, yPercent, direction, scale });

        timerRef.current = setTimeout(() => {
          setFlight((prev) => ({ ...prev, active: false }));
          scheduleFlight();
        }, FLIGHT_DURATION_MS);
      }, delay);
    }

    // Short initial delay so it's not instant on load
    timerRef.current = setTimeout(scheduleFlight, 5_000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!flight.active) return null;

  return (
    <div
      className="airplane-wrapper"
      style={{
        top: `${flight.yPercent}%`,
        transform: `scaleX(${flight.direction === "rtl" ? -1 : 1})`,
        "--flight-duration": `${FLIGHT_DURATION_MS}ms`,
        "--flight-dir": flight.direction === "rtl" ? "-1" : "1",
      } as React.CSSProperties}
      aria-hidden="true"
    >
      {/* Contrail */}
      <div className="airplane-contrail" />

      {/* Airplane SVG */}
      <svg
        className="airplane-svg"
        viewBox="0 0 140 54"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `scale(${flight.scale})`, transformOrigin: "center" }}
      >
        <defs>
          <filter id="plane-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* ── Flame turbulence filter ── */}
          <filter id="flame-distort" x="-40%" y="-60%" width="180%" height="220%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.025 0.08"
              numOctaves="4"
              seed="2"
              result="turbNoise"
            >
              <animate attributeName="seed" values="2;8;14;5;11;3;9;2" dur="0.35s" repeatCount="indefinite" />
              <animate attributeName="baseFrequency" values="0.025 0.08;0.03 0.09;0.022 0.075;0.028 0.085;0.025 0.08" dur="0.9s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="turbNoise" scale="5" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="0.6" result="blurred" />
            <feComposite in="blurred" in2="SourceGraphic" operator="over" />
          </filter>

          {/* Flame glow bloom */}
          <filter id="flame-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="bloom" />
            <feMerge>
              <feMergeNode in="bloom" />
              <feMergeNode in="bloom" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Engine 1 flame gradients — horizontal, flame tip points LEFT (x1=100% → x2=0%) */}
          <linearGradient id="flame-outer-1" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,80,0,0.9)" />
            <stop offset="35%" stopColor="rgba(255,50,0,0.65)" />
            <stop offset="70%" stopColor="rgba(200,20,0,0.3)" />
            <stop offset="100%" stopColor="rgba(160,0,0,0)" />
          </linearGradient>
          <linearGradient id="flame-mid-1" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,200,0,0.95)" />
            <stop offset="30%" stopColor="rgba(255,130,0,0.8)" />
            <stop offset="65%" stopColor="rgba(255,60,0,0.4)" />
            <stop offset="100%" stopColor="rgba(220,30,0,0)" />
          </linearGradient>
          <linearGradient id="flame-core-1" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,200,1)" />
            <stop offset="25%" stopColor="rgba(255,240,100,0.95)" />
            <stop offset="55%" stopColor="rgba(255,180,0,0.6)" />
            <stop offset="100%" stopColor="rgba(255,100,0,0)" />
          </linearGradient>

          {/* Engine 2 (smaller) */}
          <linearGradient id="flame-outer-2" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,80,0,0.85)" />
            <stop offset="40%" stopColor="rgba(220,40,0,0.5)" />
            <stop offset="100%" stopColor="rgba(160,0,0,0)" />
          </linearGradient>
          <linearGradient id="flame-mid-2" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,190,0,0.9)" />
            <stop offset="35%" stopColor="rgba(255,110,0,0.65)" />
            <stop offset="100%" stopColor="rgba(220,30,0,0)" />
          </linearGradient>
          <linearGradient id="flame-core-2" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,180,1)" />
            <stop offset="30%" stopColor="rgba(255,220,60,0.9)" />
            <stop offset="100%" stopColor="rgba(255,100,0,0)" />
          </linearGradient>

          <linearGradient id="fuselage-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(220,200,255,0.55)" />
            <stop offset="60%" stopColor="rgba(160,120,255,0.30)" />
            <stop offset="100%" stopColor="rgba(100,80,200,0.20)" />
          </linearGradient>
          <linearGradient id="wing-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(200,170,255,0.45)" />
            <stop offset="100%" stopColor="rgba(120,90,220,0.20)" />
          </linearGradient>
        </defs>

        {/* ══════════════════════════════════════════
            ENGINE 1 FLAME  — nozzle at x≈52, y=34
            Mesh of overlapping elongated flame tongues
            ══════════════════════════════════════════ */}
        <g filter="url(#flame-distort)" style={{ mixBlendMode: "screen" }}>

          {/* Outer halo — widest, coolest, reddish */}
          <g className="flame-outer-layer">
            {/* Wide spread cone */}
            <polygon points="52,30 52,38 24,35.5" fill="url(#flame-outer-1)" opacity="0.55" className="flame-tongue-1" />
            <polygon points="52,31 52,37 20,34"   fill="url(#flame-outer-1)" opacity="0.4"  className="flame-tongue-2" />
            <polygon points="52,29 52,39 22,36.5" fill="url(#flame-outer-1)" opacity="0.35" className="flame-tongue-3" />

            {/* Irregular outer tendrils */}
            <path d="M52,31 Q42,28 26,32 Q20,33 18,34 Q20,35.5 27,35 Q42,36 52,37 Z"
              fill="url(#flame-outer-1)" opacity="0.45" className="flame-tongue-4" />
            <path d="M52,31 Q38,26 22,30 Q15,32 13,34 Q16,36 23,34.5 Q39,38 52,37 Z"
              fill="url(#flame-outer-1)" opacity="0.25" className="flame-tongue-5" />
          </g>

          {/* Mid layer — orange/yellow */}
          <g className="flame-mid-layer">
            <polygon points="52,31.5 52,36.5 30,34.8" fill="url(#flame-mid-1)" opacity="0.75" className="flame-tongue-6" />
            <polygon points="52,31   52,37   27,34.5" fill="url(#flame-mid-1)" opacity="0.6"  className="flame-tongue-7" />
            <polygon points="52,32   52,36   32,34.2" fill="url(#flame-mid-1)" opacity="0.8"  className="flame-tongue-8" />

            {/* Jagged mid tongues — mesh effect */}
            <path d="M52,32 Q44,30 36,31.5 Q30,32.5 26,33.5 Q28,35 33,34.8 Q40,36 52,36 Z"
              fill="url(#flame-mid-1)" opacity="0.65" className="flame-tongue-9" />
            <path d="M52,32.5 Q46,31 40,31.8 Q35,32.5 30,33.8 Q33,35.5 38,35 Q44,36.5 52,35.5 Z"
              fill="url(#flame-mid-1)" opacity="0.55" className="flame-tongue-10" />
            <path d="M52,31.5 Q43,29.5 35,31 Q29,32 25,33 Q27,35.2 32,34.5 Q41,37 52,36.5 Z"
              fill="url(#flame-mid-1)" opacity="0.5"  className="flame-tongue-11" />
          </g>

          {/* Inner core — hot white/yellow, tight cone */}
          <g className="flame-core-layer">
            <polygon points="52,32.5 52,35.5 36,34" fill="url(#flame-core-1)" opacity="0.9"  className="flame-core-1" />
            <polygon points="52,33   52,35   38,34" fill="url(#flame-core-1)" opacity="1.0"  className="flame-core-2" />
            <polygon points="52,33.2 52,34.8 40,34" fill="url(#flame-core-1)" opacity="0.95" className="flame-core-3" />

            {/* Bright needle at nozzle */}
            <path d="M52,33 Q48,33.5 44,33.8 Q48,34.2 52,35 Z"
              fill="rgba(255,255,220,0.95)" opacity="0.9" className="flame-core-4" />
          </g>
        </g>

        {/* Glow bloom around Engine 1 flame */}
        <g filter="url(#flame-glow)" opacity="0.35">
          <polygon points="52,30 52,38 28,34" fill="rgba(255,120,0,1)" className="flame-bloom-1" />
          <polygon points="52,32 52,36 35,34" fill="rgba(255,220,0,1)" className="flame-bloom-2" />
        </g>

        {/* ══════════════════════════════════════════
            ENGINE 2 FLAME  — nozzle at x≈66, y=34
            Smaller secondary engine (inboard)
            ══════════════════════════════════════════ */}
        <g filter="url(#flame-distort)" style={{ mixBlendMode: "screen" }}>

          {/* Outer */}
          <g className="flame-outer-layer">
            <polygon points="66,31 66,37 46,34.5" fill="url(#flame-outer-2)" opacity="0.5"  className="flame-tongue-e2-1" />
            <polygon points="66,30 66,38 42,35"   fill="url(#flame-outer-2)" opacity="0.35" className="flame-tongue-e2-2" />
            <path d="M66,31.5 Q56,29 44,32 Q38,33.5 36,35 Q39,36 45,34.5 Q56,37 66,36.5 Z"
              fill="url(#flame-outer-2)" opacity="0.4" className="flame-tongue-e2-3" />
          </g>

          {/* Mid */}
          <g className="flame-mid-layer">
            <polygon points="66,31.5 66,36.5 50,34.5" fill="url(#flame-mid-2)" opacity="0.7"  className="flame-tongue-e2-4" />
            <polygon points="66,32   66,36   52,34.3" fill="url(#flame-mid-2)" opacity="0.8"  className="flame-tongue-e2-5" />
            <path d="M66,32 Q58,30.5 52,32 Q47,33 44,34 Q47,35.5 52,35 Q58,36 66,36 Z"
              fill="url(#flame-mid-2)" opacity="0.6" className="flame-tongue-e2-6" />
          </g>

          {/* Core */}
          <g className="flame-core-layer">
            <polygon points="66,32.5 66,35.5 54,34" fill="url(#flame-core-2)" opacity="0.9"  className="flame-core-e2-1" />
            <polygon points="66,33   66,35   56,34" fill="url(#flame-core-2)" opacity="1.0"  className="flame-core-e2-2" />
            <path d="M66,33 Q62,33.5 58,33.8 Q62,34.2 66,35 Z"
              fill="rgba(255,255,200,0.9)" opacity="0.85" className="flame-core-e2-3" />
          </g>
        </g>

        {/* Glow bloom around Engine 2 flame */}
        <g filter="url(#flame-glow)" opacity="0.3">
          <polygon points="66,31 66,37 48,34" fill="rgba(255,120,0,1)" className="flame-bloom-e2-1" />
          <polygon points="66,32.5 66,35.5 55,34" fill="rgba(255,220,0,1)" className="flame-bloom-e2-2" />
        </g>

        {/* ── Plane body (rendered ON TOP of flames) ── */}

        {/* Main wing */}
        <polygon
          points="38,24 72,24 85,34 38,34"
          fill="url(#wing-grad)"
          stroke="rgba(200,170,255,0.7)"
          strokeWidth="0.6"
          filter="url(#plane-glow)"
        />

        {/* Fuselage */}
        <path
          d="M10,21 Q18,16 42,20 L100,21 Q110,22 112,24 Q110,26 100,27 L42,28 Q18,32 10,27 Z"
          fill="url(#fuselage-grad)"
          stroke="rgba(220,200,255,0.8)"
          strokeWidth="0.7"
          filter="url(#plane-glow)"
        />

        {/* Fuselage highlight */}
        <path
          d="M15,21 Q30,18 60,20 L95,21"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Vertical tail */}
        <path
          d="M14,21 Q10,14 20,12 L26,20"
          fill="url(#wing-grad)"
          stroke="rgba(200,170,255,0.7)"
          strokeWidth="0.6"
        />

        {/* Horizontal tail (left stabilizer) */}
        <polygon
          points="14,24 28,24 33,28 14,28"
          fill="url(#wing-grad)"
          stroke="rgba(200,170,255,0.65)"
          strokeWidth="0.5"
        />

        {/* Nose cone */}
        <path
          d="M100,22 Q112,23 114,24 Q112,25 100,26 Z"
          fill="rgba(230,215,255,0.6)"
          stroke="rgba(220,200,255,0.9)"
          strokeWidth="0.5"
        />

        {/* Windows row */}
        <g fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.3">
          <ellipse cx="50" cy="23.5" rx="2.2" ry="1.4" />
          <ellipse cx="58" cy="23.5" rx="2.2" ry="1.4" />
          <ellipse cx="66" cy="23.5" rx="2.2" ry="1.4" />
          <ellipse cx="74" cy="23.5" rx="2.2" ry="1.4" />
          <ellipse cx="82" cy="23.5" rx="2.2" ry="1.4" />
          <ellipse cx="90" cy="23.5" rx="2.2" ry="1.4" />
        </g>

        {/* Engine pod under main wing */}
        <ellipse
          cx="60"
          cy="34"
          rx="8"
          ry="2.5"
          fill="rgba(140,110,220,0.35)"
          stroke="rgba(190,160,255,0.6)"
          strokeWidth="0.5"
        />
        <ellipse
          cx="72"
          cy="34"
          rx="6"
          ry="2"
          fill="rgba(140,110,220,0.3)"
          stroke="rgba(190,160,255,0.5)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}
