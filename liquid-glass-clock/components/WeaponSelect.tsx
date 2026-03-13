"use client";

import React, { useState } from "react";
import type { WeaponType } from "@/lib/gameTypes";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";

// ─── Animated SVG weapons ─────────────────────────────────────────────────────

function SwordSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 50 80"
      width="50"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #fbbf24)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "sword-idle 4s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes sword-idle {
          0%, 100% { transform: rotate(-2deg) translateY(0px); }
          25% { transform: rotate(2deg) translateY(-5px); }
          50% { transform: rotate(-1deg) translateY(-3px); }
          75% { transform: rotate(3deg) translateY(-6px); }
        }
        @keyframes blade-shimmer {
          0%, 100% { opacity: 0.12; }
          50% { opacity: 0.35; }
        }
        @keyframes sword-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes sword-swing {
          0%, 70%, 100% { transform: rotate(0deg); transform-origin: 25px 70px; }
          80% { transform: rotate(-12deg); transform-origin: 25px 70px; }
          88% { transform: rotate(8deg); transform-origin: 25px 70px; }
        }
      `}</style>
      {/* Blade group — swings around the grip/pommel area */}
      <g style={{ animation: "sword-swing 3s ease-in-out infinite" }}>
        {/* Blade — tapers from wide at guard (y=46) to point at tip (y=5) */}
        <polygon points="25,5 19,46 31,46" fill="#c8dff0" />
        {/* Blade highlight (left facet) */}
        <polygon points="25,5 19,46 25,46" fill="#e0f0ff" opacity="0.7" />
        {/* Blade center edge line */}
        <line x1="25" y1="5" x2="25" y2="46" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
        {/* Blade fuller (center groove) */}
        <line x1="25" y1="10" x2="25" y2="44" stroke="#88aacc" strokeWidth="0.6" opacity="0.5" />
        {/* Blade shimmer highlight */}
        <rect x="22" y="12" width="6" height="30" rx="1" fill="white" style={{ animation: "blade-shimmer 2.5s ease-in-out infinite" }} />
        {/* Blade glow */}
        <ellipse cx="25" cy="26" rx="3" ry="20" fill="#88ccff" style={{ animation: "sword-glow 2.5s ease-in-out infinite" }} />
      </g>
      {/* Cross-guard */}
      <rect x="11" y="46" width="28" height="6" rx="2" fill="#c8960c" />
      <ellipse cx="11" cy="49" rx="4" ry="3" fill="#e8b020" />
      <ellipse cx="39" cy="49" rx="4" ry="3" fill="#e8b020" />
      {/* Grip */}
      <rect x="23" y="52" width="4" height="18" rx="2" fill="#5c2a0a" />
      {/* Grip wrapping bands */}
      <line x1="23" y1="55" x2="27" y2="55" stroke="#3d1a06" strokeWidth="1.5" />
      <line x1="23" y1="59" x2="27" y2="59" stroke="#3d1a06" strokeWidth="1.5" />
      <line x1="23" y1="63" x2="27" y2="63" stroke="#3d1a06" strokeWidth="1.5" />
      <line x1="23" y1="67" x2="27" y2="67" stroke="#3d1a06" strokeWidth="1.5" />
      {/* Pommel */}
      <ellipse cx="25" cy="74" rx="6" ry="5" fill="#c8960c" />
      <ellipse cx="25" cy="74" rx="4" ry="3" fill="#e8b020" />
      {/* Pommel gem */}
      <ellipse cx="25" cy="74" rx="2" ry="1.5" fill="#fff8e0" opacity="0.8" />
    </svg>
  );
}

function BowSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 120 80"
      width="120"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #86efac)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "bow-idle 4s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes bow-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          40% { transform: translateY(-4px) rotate(1deg); }
          70% { transform: translateY(-2px) rotate(-0.8deg); }
        }
        @keyframes bow-draw-main {
          0%, 75%, 100% { d: path("M90,10 Q105,40 90,70"); }
          80% { d: path("M86,10 Q104,40 86,70"); }
          88% { d: path("M90,10 Q105,40 90,70"); }
        }
        @keyframes bow-draw-highlight {
          0%, 75%, 100% { d: path("M91,10 Q106,40 91,70"); }
          80% { d: path("M87,10 Q105,40 87,70"); }
          88% { d: path("M91,10 Q106,40 91,70"); }
        }
        @keyframes string-vibrate {
          0%, 70%, 100% { transform: scaleX(1); }
          78% { transform: scaleX(1.04); }
          84% { transform: scaleX(0.97); }
          90% { transform: scaleX(1.02); }
        }
        @keyframes string-draw {
          0%, 72%, 100% { transform: translateX(0); }
          78% { transform: translateX(-6px); }
          85% { transform: translateX(0); }
        }
        @keyframes arrow-fly {
          0%, 72%, 100% { opacity: 1; transform: translateX(0); }
          73% { opacity: 1; transform: translateX(0); }
          80% { opacity: 0; transform: translateX(-55px); }
          82%, 99% { opacity: 0; }
        }
      `}</style>

      {/* Bow limb (curved path) — bow faces LEFT, arrow flies left toward enemy */}
      <path
        d="M90,10 Q105,40 90,70"
        stroke="#7a4a1a"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        style={{ animation: "bow-draw-main 3s ease-in-out infinite" }}
      />
      {/* Bow limb highlight */}
      <path
        d="M91,10 Q106,40 91,70"
        stroke="#a06030"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
        style={{ animation: "bow-draw-highlight 3s ease-in-out infinite" }}
      />

      {/* Bowstring — animates draw + vibration after release */}
      <g style={{ animation: "string-draw 3s ease-in-out infinite" }}>
        <g style={{ animation: "string-vibrate 3s ease-in-out infinite" }}>
          <line x1="90" y1="10" x2="90" y2="70" stroke="#ddd0aa" strokeWidth="1.5" />
        </g>
      </g>

      {/* Arrow — flies LEFT toward the target */}
      <g style={{ animation: "arrow-fly 3s ease-in-out infinite" }}>
        {/* Arrow shaft */}
        <line x1="90" y1="40" x2="30" y2="40" stroke="#8b5e3c" strokeWidth="3" strokeLinecap="round" />
        {/* Arrowhead — tip points LEFT */}
        <polygon points="30,40 40,36 38,40 40,44" fill="#aaaaaa" />
        {/* Fletching — at the nock end near the string (right side) */}
        <polygon points="87,40 90,33 84,40" fill="#cc3333" opacity="0.85" />
        <polygon points="87,40 90,47 84,40" fill="#cc3333" opacity="0.85" />
      </g>

      {/* Grip wrap — on the right side where the hand holds the bow */}
      <rect x="86" y="34" width="9" height="12" rx="2" fill="#4a2a08" />
      <line x1="87" y1="36" x2="94" y2="36" stroke="#3a1a04" strokeWidth="1.2" />
      <line x1="87" y1="39" x2="94" y2="39" stroke="#3a1a04" strokeWidth="1.2" />
      <line x1="87" y1="42" x2="94" y2="42" stroke="#3a1a04" strokeWidth="1.2" />
    </svg>
  );
}

function CrossbowSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 140 80"
      width="140"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #f87171)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "crossbow-idle 5s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes crossbow-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          40% { transform: translateY(-3px) rotate(-0.8deg); }
          70% { transform: translateY(-2px) rotate(0.5deg); }
        }
        @keyframes crossbow-recoil {
          0%, 75%, 100% { transform: translateX(0); }
          78% { transform: translateX(3px); }
          83% { transform: translateX(-1px); }
          88% { transform: translateX(1px); }
        }
        @keyframes crossbow-string {
          0%, 74%, 100% { transform: scaleX(1); }
          76% { transform: scaleX(1.05); }
          82% { transform: scaleX(0.97); }
        }
        @keyframes bolt-fly {
          0%, 73%, 100% { opacity: 1; transform: translateX(0); }
          74% { opacity: 1; }
          80% { opacity: 0; transform: translateX(60px); }
          82%, 99% { opacity: 0; }
        }
      `}</style>

      <g style={{ animation: "crossbow-recoil 4s ease-in-out infinite" }}>
        {/* Stock */}
        <rect x="72" y="36" width="52" height="14" rx="4" fill="#6b3d1a" />
        <rect x="72" y="37" width="52" height="4" rx="2" fill="#8b5a2a" opacity="0.4" />
        {/* Grip */}
        <polygon points="88,50 100,50 96,64 84,64" fill="#2a1a08" />
        {/* Trigger guard */}
        <path d="M87 50 Q83 58 92 55" stroke="#555" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Trigger */}
        <rect x="89" y="49" width="4" height="7" rx="1" fill="#666" />

        {/* Tiller / rail */}
        <rect x="22" y="37" width="54" height="8" rx="2" fill="#1a1a1a" />

        {/* Horizontal bow limbs */}
        <line x1="22" y1="41" x2="6" y2="30" stroke="#2a1a08" strokeWidth="6" strokeLinecap="round" />
        <line x1="22" y1="41" x2="6" y2="52" stroke="#2a1a08" strokeWidth="6" strokeLinecap="round" />
        {/* Limb tips */}
        <circle cx="6" cy="30" r="3.5" fill="#1a0a04" />
        <circle cx="6" cy="52" r="3.5" fill="#1a0a04" />

        {/* Stirrup (metal loop at front) */}
        <ellipse cx="18" cy="41" rx="6" ry="9" stroke="#444" strokeWidth="2.5" fill="none" />

        {/* Bowstring */}
        <g style={{ animation: "crossbow-string 4s ease-in-out infinite" }}>
          <line x1="6" y1="30" x2="22" y2="41" stroke="#ddd0aa" strokeWidth="1.5" />
          <line x1="6" y1="52" x2="22" y2="41" stroke="#ddd0aa" strokeWidth="1.5" />
        </g>

        {/* Loaded bolt */}
        <g style={{ animation: "bolt-fly 4s ease-in-out infinite" }}>
          <line x1="22" y1="40" x2="68" y2="40" stroke="#8b5e3c" strokeWidth="3.5" strokeLinecap="round" />
          <polygon points="68,40 60,37 62,40 60,43" fill="#888888" />
          {/* Bolt fletching */}
          <polygon points="26,40 22,35 30,40" fill="#cc3333" opacity="0.8" />
          <polygon points="26,40 22,45 30,40" fill="#cc3333" opacity="0.8" />
        </g>

        {/* Scope rail */}
        <rect x="42" y="33" width="28" height="4" rx="1" fill="#2a2a2a" />
        {/* Scope (small red dot) */}
        <rect x="48" y="25" width="18" height="9" rx="4" fill="#333" />
        <circle cx="57" cy="29.5" r="3" fill="#1a1a1a" />
        <circle cx="57" cy="29.5" r="1.5" fill="#ff2222" opacity="0.8" />

        {/* Highlight on stock */}
        <rect x="72" y="37" width="52" height="2" rx="1" fill="white" opacity="0.07" />
      </g>
    </svg>
  );
}

function SniperSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 140 80"
      width="140"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #a78bfa)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "sniper-idle 5s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes sniper-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          30% { transform: translateY(-3px) rotate(0.5deg); }
          60% { transform: translateY(-1px) rotate(-0.3deg); }
        }
        @keyframes scope-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1.0; }
        }
        @keyframes sniper-recoil {
          0%, 80%, 100% { transform: translateX(0); }
          83% { transform: translateX(4px); }
          88% { transform: translateX(-2px); }
          93% { transform: translateX(1px); }
        }
      `}</style>
      <g style={{ animation: "sniper-recoil 4s ease-in-out infinite" }}>
        {/* Stock */}
        <rect x="95" y="36" width="38" height="11" rx="3" fill="#6b3d1a" />
        <rect x="95" y="37" width="38" height="3" rx="1" fill="#8b5a2a" opacity="0.4" />
        {/* Cheekrest */}
        <rect x="100" y="30" width="24" height="7" rx="3" fill="#7a4a20" />
        {/* Receiver */}
        <rect x="55" y="35" width="44" height="12" rx="2" fill="#1a1a1a" />
        {/* Long barrel */}
        <rect x="8" y="38" width="50" height="5" rx="2" fill="#1a1a1a" />
        {/* Muzzle */}
        <rect x="4" y="37" width="8" height="7" rx="2" fill="#333" />
        {/* Grip */}
        <polygon points="76,47 86,47 82,63 70,63" fill="#111" />
        {/* Trigger guard */}
        <path d="M74 47 Q70 56 80 53" stroke="#555" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Bipod */}
        <line x1="22" y1="43" x2="16" y2="60" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="26" y1="43" x2="32" y2="60" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
        {/* Scope body */}
        <rect x="45" y="23" width="38" height="10" rx="5" fill="#333" />
        {/* Scope objective (front lens - larger) */}
        <ellipse cx="45" cy="28" rx="7" ry="7" fill="#222" />
        <ellipse cx="45" cy="28" rx="5" ry="5" fill="#1a2a3a" style={{ animation: "scope-pulse 2s ease-in-out infinite" }} />
        <ellipse cx="45" cy="28" rx="3" ry="3" fill="#4488cc" opacity="0.7" style={{ animation: "scope-pulse 2s ease-in-out infinite" }} />
        {/* Scope eyepiece (rear) */}
        <ellipse cx="83" cy="28" rx="5" ry="5" fill="#222" />
        {/* Elevation knob */}
        <rect x="58" y="19" width="6" height="5" rx="2" fill="#444" />
        {/* Windage knob */}
        <rect x="73" y="19" width="6" height="5" rx="2" fill="#444" />
        {/* Scope highlight */}
        <rect x="48" y="24" width="30" height="2" rx="1" fill="white" opacity="0.08" />
      </g>
    </svg>
  );
}

function AxeSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 60 80"
      width="60"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #a3e635)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "axe-idle 4s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes axe-idle {
          0%, 100% { transform: rotate(-3deg) translateY(0px); }
          30% { transform: rotate(3deg) translateY(-6px); }
          60% { transform: rotate(-1deg) translateY(-4px); }
          80% { transform: rotate(4deg) translateY(-7px); }
        }
        @keyframes axe-chop {
          0%, 65%, 100% { transform: rotate(0deg); transform-origin: 30px 72px; }
          72% { transform: rotate(-18deg); transform-origin: 30px 72px; }
          82% { transform: rotate(10deg); transform-origin: 30px 72px; }
          90% { transform: rotate(-4deg); transform-origin: 30px 72px; }
        }
        @keyframes axe-blade-shimmer {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.35; }
        }
        @keyframes axe-edge-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
      `}</style>

      {/* Handle */}
      <rect x="27" y="14" width="6" height="58" rx="3" fill="#7a4a1a" style={{ animation: "axe-chop 3.5s ease-in-out infinite" }} />
      {/* Handle grip bands */}
      <rect x="26" y="55" width="8" height="2.5" rx="1" fill="#3d2008" style={{ animation: "axe-chop 3.5s ease-in-out infinite" }} />
      <rect x="26" y="62" width="8" height="2.5" rx="1" fill="#3d2008" style={{ animation: "axe-chop 3.5s ease-in-out infinite" }} />
      <rect x="26" y="69" width="8" height="2.5" rx="1" fill="#3d2008" style={{ animation: "axe-chop 3.5s ease-in-out infinite" }} />

      {/* Axe head group */}
      <g style={{ animation: "axe-chop 3.5s ease-in-out infinite" }}>
        {/* Head body */}
        <path d="M30,8 L12,20 L10,34 L30,28 Z" fill="#8899aa" />
        {/* Blade highlight */}
        <path d="M30,8 L12,20 L10,34 L30,28 Z" fill="#c0d8e8" opacity="0.55" />
        {/* Cutting edge */}
        <path d="M10,20 Q4,27 10,34" stroke="#e8f4ff" strokeWidth="2.5" fill="none" strokeLinecap="round"
          style={{ animation: "axe-edge-glow 2s ease-in-out infinite" }} />
        {/* Poll (back) */}
        <rect x="28" y="14" width="8" height="14" rx="2" fill="#666e7a" />
        {/* Eye collar */}
        <rect x="26" y="20" width="8" height="8" rx="2" fill="#555e6a" />
        {/* Blade shimmer */}
        <path d="M16,22 L12,30" stroke="white" strokeWidth="1.5" strokeLinecap="round"
          style={{ animation: "axe-blade-shimmer 2.5s ease-in-out infinite" }} />
      </g>

      {/* Pommel cap */}
      <ellipse cx="30" cy="74" rx="5" ry="4" fill="#7a4a1a" style={{ animation: "axe-chop 3.5s ease-in-out infinite" }} />
      <ellipse cx="30" cy="74" rx="3" ry="2.5" fill="#a06030" style={{ animation: "axe-chop 3.5s ease-in-out infinite" }} />
    </svg>
  );
}

function MachineGunSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 140 80"
      width="140"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #f97316)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "mg-idle 3.5s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes mg-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          30% { transform: translateY(-4px) rotate(0.6deg); }
          65% { transform: translateY(-2px) rotate(-0.4deg); }
        }
        @keyframes mg-recoil {
          0%, 78%, 100% { transform: translateX(0); }
          80% { transform: translateX(5px); }
          84% { transform: translateX(-2px); }
          88% { transform: translateX(1px); }
        }
        @keyframes mg-flash {
          0%, 76%, 84%, 100% { opacity: 0; }
          79% { opacity: 1; }
          81% { opacity: 0.4; }
        }
        @keyframes mg-eject {
          0%, 79%, 100% { opacity: 0; transform: translate(0,0) rotate(0deg); }
          80% { opacity: 1; transform: translate(2px,-3px) rotate(20deg); }
          84% { opacity: 0; transform: translate(8px,-10px) rotate(60deg); }
        }
      `}</style>

      <g style={{ animation: "mg-recoil 2.2s ease-in-out infinite" }}>
        {/* Long barrel */}
        <rect x="5" y="37" width="66" height="5" rx="2" fill="#1a1a1a" />

        {/* Perforated cooling jacket rings */}
        <line x1="14" y1="36" x2="14" y2="43" stroke="#3a3a3a" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="22" y1="36" x2="22" y2="43" stroke="#3a3a3a" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="30" y1="36" x2="30" y2="43" stroke="#3a3a3a" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="38" y1="36" x2="38" y2="43" stroke="#3a3a3a" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="46" y1="36" x2="46" y2="43" stroke="#3a3a3a" strokeWidth="2.5" strokeLinecap="round" />

        {/* Muzzle brake */}
        <rect x="2" y="35.5" width="7" height="8" rx="2" fill="#333" />

        {/* Muzzle flash (animates on fire) */}
        <g style={{ animation: "mg-flash 2.2s ease-in-out infinite" }}>
          <polygon points="0,39.5 -10,34 -7,39.5 -10,45" fill="#ff8800" opacity="0.9" />
          <polygon points="0,39.5 -12,39.5 -8,36 -8,43" fill="#ffcc00" opacity="0.7" />
        </g>

        {/* Receiver body */}
        <rect x="65" y="33" width="38" height="14" rx="2" fill="#2a2a2a" />
        <rect x="66" y="34" width="36" height="3" rx="1" fill="white" opacity="0.06" />

        {/* Carry handle / top rail */}
        <rect x="66" y="23" width="27" height="9" rx="3" fill="#222" />
        <rect x="67" y="24" width="25" height="2" rx="1" fill="white" opacity="0.07" />

        {/* Ejection port */}
        <rect x="80" y="34" width="10" height="5" rx="1" fill="#111" />
        {/* Ejected shell casing (animates) */}
        <g style={{ animation: "mg-eject 2.2s ease-in-out infinite" }}>
          <rect x="82" y="33" width="5" height="8" rx="1" fill="#cc9900" opacity="0.9" />
        </g>

        {/* Shoulder stock */}
        <rect x="101" y="33.5" width="32" height="11" rx="3" fill="#5a3010" />
        <rect x="102" y="34.5" width="30" height="3" rx="1" fill="#7a4a20" opacity="0.4" />
        {/* Butt plate */}
        <rect x="130" y="32" width="5" height="14" rx="1" fill="#1a1a1a" />

        {/* Pistol grip */}
        <polygon points="88,47 100,47 96,64 84,64" fill="#111" />

        {/* Box magazine */}
        <rect x="70" y="47" width="17" height="22" rx="2" fill="#1a1a1a" />
        <rect x="71" y="48" width="15" height="3" rx="1" fill="white" opacity="0.05" />
        {/* Magazine feed lips */}
        <rect x="68" y="45" width="21" height="4" rx="1" fill="#333" />

        {/* Trigger */}
        <rect x="91" y="46" width="3" height="7" rx="1" fill="#555" />
        {/* Trigger guard */}
        <path d="M88 47 Q84 56 94 53" stroke="#444" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* Bipod legs */}
        <line x1="17" y1="42" x2="11" y2="60" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="21" y1="42" x2="27" y2="60" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />

        {/* Front sight */}
        <rect x="56" y="32" width="3" height="5" rx="1" fill="#333" />
        <rect x="52" y="35" width="11" height="2" rx="1" fill="#2a2a2a" />

        {/* Orange accent — hot barrel glow */}
        <rect x="5" y="38" width="30" height="1" rx="0.5" fill="#f97316" opacity="0.3" />
      </g>
    </svg>
  );
}


function FlameThrowerSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 130 80"
      width="130"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #ef4444)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "ft-idle 4s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes ft-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          35% { transform: translateY(-4px) rotate(0.7deg); }
          70% { transform: translateY(-2px) rotate(-0.5deg); }
        }
        @keyframes ft-flame1 {
          0%, 100% { opacity: 0.9; transform: scaleX(1) scaleY(1); }
          25% { opacity: 0.7; transform: scaleX(1.25) scaleY(0.88); }
          50% { opacity: 1; transform: scaleX(0.82) scaleY(1.18); }
          75% { opacity: 0.75; transform: scaleX(1.15) scaleY(0.9); }
        }
        @keyframes ft-flame2 {
          0%, 100% { opacity: 0.85; transform: scaleX(1) scaleY(1); }
          35% { opacity: 0.55; transform: scaleX(0.78) scaleY(1.22); }
          65% { opacity: 1; transform: scaleX(1.2) scaleY(0.85); }
        }
        @keyframes ft-core {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.45; }
        }
      `}</style>

      {/* Fuel tank (olive green) */}
      <rect x="6" y="28" width="30" height="22" rx="8" fill="#3a4a1a" />
      <rect x="7" y="29" width="28" height="7" rx="4" fill="#5a6a2a" opacity="0.5" />
      <ellipse cx="6" cy="39" rx="5" ry="11" fill="#4a5a22" />
      <ellipse cx="36" cy="39" rx="5" ry="11" fill="#4a5a22" />
      <rect x="17" y="25" width="4" height="28" rx="2" fill="#2a3412" />

      {/* Pressure gauge */}
      <circle cx="34" cy="39" r="5" fill="#1a1a1a" stroke="#666" strokeWidth="0.8" />
      <circle cx="34" cy="39" r="3" fill="#111" />
      <line x1="34" y1="39" x2="36" y2="37" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" />

      {/* Fuel hose */}
      <path d="M36 39 Q40 38 42 38" stroke="#3a3a3a" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Main receiver body */}
      <rect x="40" y="33" width="50" height="13" rx="3" fill="#2a2a2a" />
      <rect x="41" y="34" width="48" height="4" rx="2" fill="#3a3a3a" opacity="0.5" />
      <rect x="44" y="28" width="34" height="7" rx="2" fill="#1a1a1a" />

      {/* Nozzle barrel */}
      <rect x="88" y="36" width="28" height="6" rx="2" fill="#111" />
      <rect x="113" y="33" width="6" height="12" rx="2" fill="#222" />

      {/* Pistol grip */}
      <polygon points="60,46 72,46 68,64 56,64" fill="#111" />
      <rect x="63" y="46" width="3" height="6" rx="1" fill="#444" />

      {/* Shoulder stock */}
      <rect x="87" y="33.5" width="24" height="11" rx="3" fill="#1a1a1a" />

      {/* Flame burst */}
      <g style={{ transformOrigin: "116px 39px" }}>
        <ellipse cx="125" cy="39" rx="10" ry="7" fill="#ff4400" opacity="0.9"
          style={{ animation: "ft-flame1 0.45s ease-in-out infinite", transformOrigin: "116px 39px" }} />
        <ellipse cx="122" cy="39" rx="7" ry="5" fill="#ff8800"
          style={{ animation: "ft-flame2 0.38s ease-in-out infinite 0.1s", transformOrigin: "116px 39px" }} />
        <ellipse cx="119" cy="39" rx="4" ry="3" fill="#ffee00"
          style={{ animation: "ft-core 0.28s ease-in-out infinite" }} />
      </g>

      {/* Red accent */}
      <rect x="8" y="37" width="26" height="1" rx="0.5" fill="#ef4444" opacity="0.35" />
    </svg>
  );
}

function ShovelSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 60 100"
      width="60"
      height="100"
      style={{
        filter: selected ? "drop-shadow(0 0 10px #a3a3a3)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "shovel-idle 4s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes shovel-idle {
          0%, 100% { transform: rotate(-2deg) translateY(0px); }
          30%  { transform: rotate(2deg) translateY(-5px); }
          60%  { transform: rotate(-1deg) translateY(-3px); }
          80%  { transform: rotate(3deg) translateY(-6px); }
        }
        @keyframes shovel-dig {
          0%, 60%, 100% { transform: rotate(0deg) translateY(0px); transform-origin: 30px 10px; }
          70% { transform: rotate(20deg) translateY(4px); transform-origin: 30px 10px; }
          82% { transform: rotate(-5deg) translateY(-2px); transform-origin: 30px 10px; }
          90% { transform: rotate(8deg) translateY(1px); transform-origin: 30px 10px; }
        }
        @keyframes blade-glint {
          0%, 100% { opacity: 0.15; }
          50%       { opacity: 0.45; }
        }
      `}</style>

      <g style={{ animation: "shovel-dig 3.5s ease-in-out infinite" }}>
        {/* D-grip cross-bar */}
        <rect x="18" y="4" width="24" height="5" rx="2.5" fill="#7a4a1a" />
        {/* D-grip arms */}
        <rect x="18" y="4" width="5" height="11" rx="2.5" fill="#7a4a1a" />
        <rect x="37" y="4" width="5" height="11" rx="2.5" fill="#7a4a1a" />
        {/* D-grip arc (top curve) */}
        <path d="M18,4 Q30,-4 42,4" fill="none" stroke="#7a4a1a" strokeWidth="5" strokeLinecap="round" />

        {/* Shaft */}
        <rect x="27.5" y="9" width="5" height="62" rx="2.5" fill="#8b5e2a" />
        {/* Grip bands */}
        <rect x="27" y="18" width="6" height="3" rx="1" fill="#5c3a14" />
        <rect x="27" y="30" width="6" height="3" rx="1" fill="#5c3a14" />
        <rect x="27" y="42" width="6" height="3" rx="1" fill="#5c3a14" />
        <rect x="27" y="54" width="6" height="3" rx="1" fill="#5c3a14" />

        {/* Metal collar */}
        <rect x="25" y="68" width="10" height="7" rx="2" fill="#606870" />

        {/* Blade body */}
        <path d="M14,75 L46,75 L44,97 L16,97 Z" fill="#8a8f96" />
        {/* Blade shine highlight */}
        <path d="M16,75 L44,75 L42,83 L18,83 Z" fill="#b8c0c8" opacity="0.55" />
        {/* Blade glint — animated */}
        <rect x="18" y="76" width="5" height="18" rx="1" fill="white"
          style={{ animation: "blade-glint 2.5s ease-in-out infinite" }} />
        {/* Cutting edge */}
        <line x1="14" y1="97" x2="46" y2="97" stroke="#d8e0e8" strokeWidth="2.5" strokeLinecap="round" />
        {/* Blade side lips */}
        <line x1="14" y1="75" x2="14" y2="97" stroke="#606870" strokeWidth="3" strokeLinecap="round" />
        <line x1="46" y1="75" x2="46" y2="97" stroke="#606870" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ─── Weapon card ──────────────────────────────────────────────────────────────
interface WeaponCardProps {
  type: WeaponType;
  selected: boolean;
  onSelect: (t: WeaponType) => void;
}

const WEAPON_META: Record<
  WeaponType,
  {
    icon: React.ReactNode;
    stats: Array<{ label: string; value: number; max: number }>;
    description: string;
    key: string;
  }
> = {
  sword: {
    icon: null,
    stats: [
      { label: "Poškození", value: 80, max: 100 },
      { label: "Dostřel", value: 15, max: 100 },
      { label: "Rychlost útoku", value: 90, max: 100 },
    ],
    description: "Ocelový meč pro šermování zblízka. Rychlé výpady — žádné projektily, smrtící na krátkou vzdálenost.",
    key: "1",
  },
  bow: {
    icon: null,
    stats: [
      { label: "Poškození", value: 55, max: 100 },
      { label: "Dostřel", value: 75, max: 100 },
      { label: "Rychlost střelby", value: 60, max: 100 },
    ],
    description: "Dřevěný luk se šípy. Tichá střelba na střední vzdálenost — pomalé nabití, ale přesný zásah.",
    key: "2",
  },
  crossbow: {
    icon: null,
    stats: [
      { label: "Poškození", value: 95, max: 100 },
      { label: "Dostřel", value: 100, max: 100 },
      { label: "Rychlost střelby", value: 25, max: 100 },
    ],
    description: "Kuše se šipkou. Ničivá síla na dálku — pomalé nabití, ale devastující průbojný bolt.",
    key: "3",
  },
  sniper: {
    icon: null,
    stats: [
      { label: "Poškození", value: 100, max: 100 },
      { label: "Dostřel", value: 100, max: 100 },
      { label: "Rychlost střelby", value: 15, max: 100 },
    ],
    description: "Precizní odstřelovačka s optickým zaměřovačem. Pravé tlačítko = přiblížení jako dalekohled. Také na věži na hoře.",
    key: "4",
  },
  axe: {
    icon: null,
    stats: [
      { label: "Poškození", value: 60, max: 100 },
      { label: "Kácení stromů", value: 95, max: 100 },
      { label: "Rychlost útoku", value: 70, max: 100 },
    ],
    description: "Dřevorubecká sekera. Specializovaná na kácení stromů — trojnásobné poškození dřevin. Také účinná v boji zblízka.",
    key: "5",
  },
  machinegun: {
    icon: null,
    stats: [
      { label: "Poškození", value: 22, max: 100 },
      { label: "Dostřel", value: 65, max: 100 },
      { label: "Rychlost střelby", value: 100, max: 100 },
    ],
    description: "Těžký kulomet s bleskovou kadencí. Drž levé tlačítko a seč nepřítele dávkami — nejrychlejší zbraň v arzenálu.",
    key: "6",
  },
  flamethrower: {
    icon: null,
    stats: [
      { label: "Poškození", value: 30, max: 100 },
      { label: "Dostřel", value: 10, max: 100 },
      { label: "Proud ohně", value: 95, max: 100 },
    ],
    description: "Plamenomet s palivovou nádrží. Proud spalující ohně na krátkou vzdálenost — drž levé tlačítko pro nepřetržitý žár.",
    key: "7",
  },
  shovel: {
    icon: null,
    stats: [
      { label: "Kopání terénu", value: 100, max: 100 },
      { label: "Poškození", value: 20, max: 100 },
      { label: "Rychlost kopání", value: 65, max: 100 },
    ],
    description: "Ocelová lopata pro kopání tunelů. Mier na terén a klikni — vyhrabej si cestu skrz marching cubes svět.",
    key: "8",
  },
};

function WeaponCard({ type, selected, onSelect }: WeaponCardProps) {
  const [hovered, setHovered] = useState(false);
  const cfg = WEAPON_CONFIGS[type];
  const meta = WEAPON_META[type];
  const active = selected || hovered;

  const accentColor = cfg.color;

  return (
    <button
      data-testid={`weapon-card-${type}`}
      onClick={() => onSelect(type)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={selected}
      style={{
        position: "relative",
        background: selected
          ? `rgba(255,255,255,0.08)`
          : hovered
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.03)",
        border: `1.5px solid ${active ? accentColor : "rgba(255,255,255,0.1)"}`,
        borderRadius: 16,
        padding: "20px 18px 16px",
        cursor: "pointer",
        transition: "all 0.25s ease",
        transform: selected ? "scale(1.04)" : hovered ? "scale(1.02)" : "scale(1)",
        boxShadow: selected
          ? `0 0 0 2px ${accentColor}55, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)`
          : hovered
          ? `0 0 0 1px ${accentColor}33, 0 4px 20px rgba(0,0,0,0.3)`
          : "0 2px 12px rgba(0,0,0,0.25)",
        width: "100%",
        textAlign: "left",
        color: "white",
        outline: "none",
        minWidth: 0,
      }}
    >
      {/* Keyboard shortcut badge */}
      <span
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 6,
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
          padding: "2px 6px",
          fontFamily: "monospace",
        }}
      >
        [{meta.key}]
      </span>

      {/* Selected indicator */}
      {selected && (
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 12,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
          }}
        />
      )}

      {/* Weapon SVG */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 88,
          marginBottom: 12,
        }}
      >
        {type === "sword" && <SwordSVG selected={selected} />}
        {type === "bow" && <BowSVG selected={selected} />}
        {type === "crossbow" && <CrossbowSVG selected={selected} />}
        {type === "sniper" && <SniperSVG selected={selected} />}
        {type === "axe" && <AxeSVG selected={selected} />}
        {type === "machinegun" && <MachineGunSVG selected={selected} />}
        {type === "flamethrower" && <FlameThrowerSVG selected={selected} />}
        {type === "shovel" && <ShovelSVG selected={selected} />}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: active ? accentColor : "rgba(255,255,255,0.9)",
          marginBottom: 6,
          transition: "color 0.2s",
        }}
      >
        {cfg.label}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          marginBottom: 12,
          lineHeight: 1.5,
          minHeight: 34,
        }}
      >
        {meta.description}
      </div>

      {/* Stat bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {meta.stats.map((stat) => (
          <div key={stat.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "rgba(255,255,255,0.45)",
                marginBottom: 2,
              }}
            >
              <span>{stat.label}</span>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{stat.value}</span>
            </div>
            <div
              style={{
                height: 4,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(stat.value / stat.max) * 100}%`,
                  background: active
                    ? `linear-gradient(90deg, ${accentColor}88, ${accentColor})`
                    : "rgba(255,255,255,0.2)",
                  borderRadius: 2,
                  transition: "background 0.3s, width 0.5s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface WeaponSelectProps {
  onConfirm: (weapon: WeaponType) => void;
}

export default function WeaponSelect({ onConfirm }: WeaponSelectProps) {
  const [selected, setSelected] = useState<WeaponType>("sword");

  // Keyboard shortcuts 1/2/3/4/5 to pick weapon, Enter to confirm
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "1") setSelected("sword");
      if (e.key === "2") setSelected("bow");
      if (e.key === "3") setSelected("crossbow");
      if (e.key === "4") setSelected("sniper");
      if (e.key === "5") setSelected("axe");
      if (e.key === "6") setSelected("machinegun");
      if (e.key === "7") setSelected("flamethrower");
      if (e.key === "8") setSelected("shovel");
      if (e.key === "Enter") onConfirm(selected);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, onConfirm]);

  const cfg = WEAPON_CONFIGS[selected];

  return (
    <div
      data-testid="weapon-select-overlay"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "rgba(8,14,30,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: "36px 36px 32px",
          width: "min(1100px, 96vw)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚔️</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 6 }}>
            Vyber zbraň
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Každá zbraň má jiný styl boje — zvol moudře
          </p>
        </div>

        {/* Weapon cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {(["sword", "bow", "crossbow", "sniper", "axe", "machinegun", "flamethrower", "shovel"] as WeaponType[]).map((t) => (
            <WeaponCard key={t} type={t} selected={selected === t} onSelect={setSelected} />
          ))}
        </div>

        {/* Confirm button */}
        <button
          data-testid="weapon-confirm-btn"
          onClick={() => onConfirm(selected)}
          style={{
            width: "100%",
            padding: "14px 24px",
            borderRadius: 14,
            border: `1.5px solid ${cfg.color}`,
            background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}11)`,
            color: cfg.color,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            letterSpacing: "0.02em",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${cfg.color}44, ${cfg.color}22)`;
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}11)`;
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          }}
        >
          Hrát s {cfg.label} →
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: 10,
            fontSize: 11,
            color: "rgba(255,255,255,0.2)",
          }}
        >
          Klávesy [1] [2] [3] [4] [5] [6] [7] [8] pro výběr · [Enter] pro potvrzení
        </p>
      </div>
    </div>
  );
}
