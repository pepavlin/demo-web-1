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

  const flipX = flight.direction === "rtl" ? "scaleX(-1)" : undefined;

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
        viewBox="0 0 120 48"
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
