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
      overflow="visible"
      style={{
        filter: selected ? "drop-shadow(0 0 12px #ef4444)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "ft-idle 4s ease-in-out infinite",
      }}
    >
      <defs>
        {/* Turbulence displacement for organic flame warping */}
        <filter id="ftFlameWarp" x="-40%" y="-60%" width="180%" height="220%">
          <feTurbulence type="turbulence" baseFrequency="0.045 0.08" numOctaves="4" seed="3" result="turb">
            <animate attributeName="seed" values="3;7;2;9;4;3" dur="0.6s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="turb" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* Soft glow blur */}
        <filter id="ftGlow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Gradient fade — opaque at nozzle (right), transparent at tip (left) */}
        <linearGradient id="ftFadeOuter" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff2200" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#ff4400" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ftFadeMid" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff6600" stopOpacity="1" />
          <stop offset="60%" stopColor="#ff9900" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ffcc00" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ftFadeInner" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ffee00" stopOpacity="1" />
          <stop offset="70%" stopColor="#fff9c4" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ftGradGlow" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff4400" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes ft-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          35% { transform: translateY(-4px) rotate(0.7deg); }
          70% { transform: translateY(-2px) rotate(-0.5deg); }
        }
        /* === OUTER flame shapes === */
        @keyframes ft-o1 {
          0%   { opacity:0.85; d:path("M119,34 C100,28 75,22 50,20 C30,19 12,26 8,33 C6,36 6,42 8,45 C12,52 30,59 50,58 C75,56 100,50 119,44"); }
          28%  { opacity:0.65; d:path("M119,33 C98,26 70,18 44,17 C24,16 9,24 6,32 C4,35 4,43 6,46 C9,54 24,62 44,61 C70,60 98,52 119,45"); }
          55%  { opacity:0.9;  d:path("M119,35 C102,30 78,25 53,23 C33,22 14,28 10,35 C8,37 8,41 10,43 C14,50 33,56 53,55 C78,54 102,48 119,43"); }
          80%  { opacity:0.6;  d:path("M119,34 C96,27 68,20 42,19 C22,18 8,25 5,33 C3,36 3,42 5,45 C8,53 22,61 42,60 C68,59 96,51 119,44"); }
          100% { opacity:0.85; d:path("M119,34 C100,28 75,22 50,20 C30,19 12,26 8,33 C6,36 6,42 8,45 C12,52 30,59 50,58 C75,56 100,50 119,44"); }
        }
        @keyframes ft-o2 {
          0%   { opacity:0.7;  d:path("M119,33 C95,26 65,18 38,17 C18,16 5,24 3,32 C1,36 1,42 3,46 C5,54 18,63 38,62 C65,61 95,52 119,45"); }
          35%  { opacity:0.9;  d:path("M119,35 C103,29 76,23 50,22 C30,21 14,27 10,34 C8,37 8,41 10,44 C14,51 30,57 50,56 C76,55 103,49 119,43"); }
          68%  { opacity:0.55; d:path("M119,34 C97,27 70,20 45,19 C25,18 10,25 7,32 C5,35 5,43 7,46 C10,53 25,60 45,60 C70,59 97,51 119,44"); }
          100% { opacity:0.7;  d:path("M119,33 C95,26 65,18 38,17 C18,16 5,24 3,32 C1,36 1,42 3,46 C5,54 18,63 38,62 C65,61 95,52 119,45"); }
        }
        /* === MID flame shapes === */
        @keyframes ft-m1 {
          0%   { opacity:0.9;  d:path("M119,35 C104,30 82,25 58,24 C40,23 24,28 18,34 C15,37 15,41 18,44 C24,50 40,55 58,54 C82,53 104,48 119,43"); }
          30%  { opacity:0.7;  d:path("M119,36 C107,32 85,27 60,26 C42,25 25,29 19,35 C17,37 17,41 19,43 C25,49 42,54 60,53 C85,52 107,47 119,42"); }
          60%  { opacity:1.0;  d:path("M119,35 C102,29 78,23 54,22 C36,21 21,27 16,33 C14,36 14,42 16,45 C21,51 36,56 54,56 C78,55 102,49 119,43"); }
          100% { opacity:0.9;  d:path("M119,35 C104,30 82,25 58,24 C40,23 24,28 18,34 C15,37 15,41 18,44 C24,50 40,55 58,54 C82,53 104,48 119,43"); }
        }
        @keyframes ft-m2 {
          0%   { opacity:0.8;  d:path("M119,36 C106,31 84,26 59,25 C41,24 25,29 19,35 C17,37 17,41 19,43 C25,49 41,54 59,54 C84,53 106,48 119,42"); }
          40%  { opacity:1.0;  d:path("M119,35 C103,30 80,24 56,23 C38,22 22,27 17,34 C15,37 15,41 17,44 C22,50 38,55 56,55 C80,54 103,49 119,43"); }
          72%  { opacity:0.65; d:path("M119,36 C108,32 86,27 62,26 C44,25 27,30 21,36 C19,38 19,40 21,42 C27,48 44,53 62,52 C86,51 108,46 119,42"); }
          100% { opacity:0.8;  d:path("M119,36 C106,31 84,26 59,25 C41,24 25,29 19,35 C17,37 17,41 19,43 C25,49 41,54 59,54 C84,53 106,48 119,42"); }
        }
        /* === INNER yellow flame === */
        @keyframes ft-inner {
          0%   { opacity:0.95; d:path("M119,37 C110,34 96,31 80,30 C66,29 54,32 48,36 C45,37 45,41 48,43 C54,46 66,49 80,48 C96,47 110,44 119,41"); }
          35%  { opacity:0.75; d:path("M119,37 C112,35 98,32 82,31 C68,30 56,33 50,37 C48,38 48,40 50,42 C56,45 68,48 82,47 C98,46 112,43 119,41"); }
          65%  { opacity:1.0;  d:path("M119,37 C109,34 94,31 78,30 C64,29 52,32 46,36 C44,37 44,41 46,43 C52,46 64,49 78,49 C94,48 109,44 119,41"); }
          100% { opacity:0.95; d:path("M119,37 C110,34 96,31 80,30 C66,29 54,32 48,36 C45,37 45,41 48,43 C54,46 66,49 80,48 C96,47 110,44 119,41"); }
        }
        /* === CORE white-yellow === */
        @keyframes ft-core {
          0%,100% { opacity:1;    d:path("M119,38 C113,36 104,34 94,33 C86,32 79,34 75,37 C73,38 73,40 75,41 C79,44 86,46 94,45 C104,44 113,42 119,40"); }
          45%     { opacity:0.6;  d:path("M119,38 C114,36 105,34 96,33 C88,32 81,35 77,38 C75,39 75,39 77,40 C81,43 88,45 96,44 C105,43 114,41 119,40"); }
        }
        /* === FLAME TONGUES === */
        @keyframes ft-tA {
          0%,100% { opacity:0.85; transform:translate(0,0) skewX(0deg); }
          40%     { opacity:0.5;  transform:translate(-4px,-6px) skewX(-5deg); }
          70%     { opacity:0.9;  transform:translate(-2px,-3px) skewX(3deg); }
        }
        @keyframes ft-tB {
          0%,100% { opacity:0.7; transform:translate(0,0) skewX(0deg); }
          35%     { opacity:1.0; transform:translate(-3px,5px) skewX(4deg); }
          65%     { opacity:0.45; transform:translate(-5px,3px) skewX(-3deg); }
        }
        @keyframes ft-tC {
          0%,100% { opacity:0.9; transform:translate(0,0) skewX(0deg); }
          50%     { opacity:0.55; transform:translate(-6px,-4px) skewX(-6deg); }
        }
        @keyframes ft-tD {
          0%,100% { opacity:0.75; transform:translate(0,0); }
          45%     { opacity:0.4;  transform:translate(-4px,7px); }
          80%     { opacity:0.9;  transform:translate(-2px,4px); }
        }
        @keyframes ft-tE {
          0%,100% { opacity:0.8; transform:translate(0,0) skewX(0deg); }
          30%     { opacity:0.5; transform:translate(-8px,-5px) skewX(-8deg); }
          70%     { opacity:0.95; transform:translate(-3px,-2px) skewX(4deg); }
        }
        /* === SPARKS === */
        @keyframes ft-sp1 {
          0%   { opacity:1;   transform:translate(0,0); }
          80%  { opacity:0.5; transform:translate(-22px,-12px); }
          100% { opacity:0;   transform:translate(-28px,-16px); }
        }
        @keyframes ft-sp2 {
          0%   { opacity:0.9; transform:translate(0,0); }
          75%  { opacity:0.4; transform:translate(-18px,10px); }
          100% { opacity:0;   transform:translate(-24px,14px); }
        }
        @keyframes ft-sp3 {
          0%   { opacity:1;   transform:translate(0,0); }
          70%  { opacity:0.6; transform:translate(-30px,-8px); }
          100% { opacity:0;   transform:translate(-38px,-10px); }
        }
        @keyframes ft-sp4 {
          0%   { opacity:0.8; transform:translate(0,0); }
          80%  { opacity:0.3; transform:translate(-16px,8px); }
          100% { opacity:0;   transform:translate(-20px,12px); }
        }
        /* === HEAT SHIMMER GLOW === */
        @keyframes ft-glow {
          0%,100% { opacity:0.45; transform:scaleY(1); }
          50%     { opacity:0.25; transform:scaleY(1.15); }
        }
      `}</style>

      {/* ── GLOW halo behind the whole flame ── */}
      <ellipse
        cx="75" cy="39" rx="48" ry="22"
        fill="url(#ftGradGlow)"
        filter="url(#ftGlow)"
        style={{ animation: "ft-glow 0.5s ease-in-out infinite", transformOrigin: "119px 39px" }}
      />

      {/* ── FLAME MESH (all warped by turbulence) ── */}
      <g filter="url(#ftFlameWarp)">

        {/* OUTER layer — 2 red-orange shapes */}
        <path
          fill="url(#ftFadeOuter)"
          style={{ animation: "ft-o1 0.52s ease-in-out infinite" }}
        />
        <path
          fill="url(#ftFadeOuter)"
          opacity="0.7"
          style={{ animation: "ft-o2 0.47s ease-in-out infinite", animationDelay: "0.1s" }}
        />

        {/* MID layer — 2 orange shapes */}
        <path
          fill="url(#ftFadeMid)"
          style={{ animation: "ft-m1 0.38s ease-in-out infinite" }}
        />
        <path
          fill="url(#ftFadeMid)"
          opacity="0.8"
          style={{ animation: "ft-m2 0.34s ease-in-out infinite", animationDelay: "0.08s" }}
        />

        {/* INNER layer — yellow */}
        <path
          fill="url(#ftFadeInner)"
          style={{ animation: "ft-inner 0.26s ease-in-out infinite" }}
        />

        {/* CORE — white-yellow brightest */}
        <path
          fill="#fffde7"
          opacity="0.95"
          style={{ animation: "ft-core 0.19s ease-in-out infinite" }}
        />

        {/* FLAME TONGUES — irregular wisps */}
        {/* tongue A — upper mid */}
        <polygon
          points="90,30 75,16 60,28"
          fill="#ff6600"
          opacity="0.7"
          style={{ animation: "ft-tA 0.44s ease-in-out infinite", transformOrigin: "75px 23px" }}
        />
        {/* tongue B — lower mid */}
        <polygon
          points="85,48 68,62 55,50"
          fill="#ff4400"
          opacity="0.65"
          style={{ animation: "ft-tB 0.39s ease-in-out infinite", animationDelay: "0.13s", transformOrigin: "68px 55px" }}
        />
        {/* tongue C — upper near nozzle */}
        <polygon
          points="108,33 96,20 84,31"
          fill="#ff8800"
          opacity="0.6"
          style={{ animation: "ft-tC 0.48s ease-in-out infinite", animationDelay: "0.22s", transformOrigin: "96px 25px" }}
        />
        {/* tongue D — lower near nozzle */}
        <polygon
          points="104,45 92,58 80,47"
          fill="#ff5500"
          opacity="0.55"
          style={{ animation: "ft-tD 0.41s ease-in-out infinite", animationDelay: "0.05s", transformOrigin: "92px 52px" }}
        />
        {/* tongue E — far tip */}
        <polygon
          points="42,32 26,39 42,46"
          fill="#ff9900"
          opacity="0.5"
          style={{ animation: "ft-tE 0.55s ease-in-out infinite", animationDelay: "0.18s", transformOrigin: "30px 39px" }}
        />
      </g>

      {/* SPARKS — outside warp filter so they fly cleanly */}
      <circle cx="100" cy="34" r="1.5" fill="#fff176"
        style={{ animation: "ft-sp1 0.75s linear infinite" }} />
      <circle cx="88" cy="46" r="1.2" fill="#ffd54f"
        style={{ animation: "ft-sp2 0.9s linear infinite", animationDelay: "0.3s" }} />
      <circle cx="72" cy="30" r="1.8" fill="#fff9c4"
        style={{ animation: "ft-sp3 0.65s linear infinite", animationDelay: "0.55s" }} />
      <circle cx="80" cy="49" r="1.0" fill="#ffcc02"
        style={{ animation: "ft-sp4 0.82s linear infinite", animationDelay: "0.12s" }} />

      {/* ── WEAPON BODY ── */}
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

      {/* Red heat accent on tank */}
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
        padding: "16px 14px 14px",
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
            gridTemplateColumns: "repeat(4, 1fr)",
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
