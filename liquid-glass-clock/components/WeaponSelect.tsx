"use client";

import React, { useState } from "react";
import type { WeaponType } from "@/lib/gameTypes";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";

// ─── Animated SVG weapons ─────────────────────────────────────────────────────

function PistolSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 120 80"
      width="120"
      height="80"
      style={{
        filter: selected ? "drop-shadow(0 0 8px #6ee7b7)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "pistol-idle 3s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes pistol-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          30% { transform: translateY(-4px) rotate(-1.5deg); }
          60% { transform: translateY(-2px) rotate(1deg); }
        }
        @keyframes pistol-slide-back {
          0%, 80%, 100% { transform: translateX(0); }
          40% { transform: translateX(5px); }
        }
        @keyframes barrel-flash {
          0%, 85%, 100% { opacity: 0; }
          87%, 92% { opacity: 1; }
        }
        @keyframes pistol-trigger {
          0%, 100% { transform: rotate(0deg); transform-origin: 70px 55px; }
          50% { transform: rotate(-8deg); transform-origin: 70px 55px; }
        }
      `}</style>
      {/* Grip */}
      <rect x="62" y="44" width="18" height="28" rx="3" fill="#2a2a2a" />
      <rect x="63" y="46" width="16" height="6" rx="1" fill="#1a1a1a" opacity="0.5" />
      {/* Frame */}
      <rect x="30" y="42" width="44" height="14" rx="2" fill="#3a3a3a" />
      {/* Slide (animated) */}
      <g style={{ animation: "pistol-slide-back 4s ease-in-out infinite" }}>
        <rect x="28" y="36" width="46" height="12" rx="2" fill="#282828" />
        {/* Slide serrations */}
        <line x1="60" y1="37" x2="60" y2="47" stroke="#1a1a1a" strokeWidth="1.5" />
        <line x1="64" y1="37" x2="64" y2="47" stroke="#1a1a1a" strokeWidth="1.5" />
        <line x1="68" y1="37" x2="68" y2="47" stroke="#1a1a1a" strokeWidth="1.5" />
      </g>
      {/* Barrel */}
      <rect x="10" y="39" width="22" height="8" rx="3" fill="#1a1a1a" />
      {/* Muzzle flash */}
      <g style={{ animation: "barrel-flash 4s ease-in-out infinite" }}>
        <ellipse cx="9" cy="43" rx="5" ry="3" fill="#ffdd44" opacity="0.9" />
        <ellipse cx="7" cy="43" rx="3" ry="2" fill="#ffffff" opacity="0.8" />
      </g>
      {/* Trigger guard */}
      <path d="M62 56 Q58 64 66 62" stroke="#555" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Trigger */}
      <rect
        x="68" y="52" width="3" height="8" rx="1" fill="#666"
        style={{ animation: "pistol-trigger 2.5s ease-in-out infinite" }}
      />
      {/* Front sight */}
      <rect x="20" y="36" width="4" height="4" rx="1" fill="#444" />
      {/* Rear sight notch */}
      <rect x="68" y="35" width="8" height="3" rx="1" fill="#333" />
      <rect x="70.5" y="35.5" width="3" height="2" rx="0.5" fill="#1a1a1a" />
      {/* Highlight */}
      <rect x="28" y="36.5" width="46" height="2" rx="1" fill="white" opacity="0.08" />
    </svg>
  );
}

function SwordSVG({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 120 80"
      width="120"
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
      `}</style>
      {/* Blade */}
      <polygon points="10,40 22,36 90,40 22,44" fill="#c8dff0" />
      <polygon points="10,40 22,36 90,40" fill="#e0f0ff" opacity="0.7" />
      {/* Blade edge */}
      <line x1="10" y1="40" x2="90" y2="40" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
      {/* Blade center fuller */}
      <line x1="22" y1="39.5" x2="88" y2="39.5" stroke="#88aacc" strokeWidth="0.6" opacity="0.5" />
      {/* Blade shimmer highlight */}
      <rect x="22" y="36.5" width="60" height="3" rx="1" fill="white" style={{ animation: "blade-shimmer 2.5s ease-in-out infinite" }} />
      {/* Blade glow */}
      <ellipse cx="50" cy="40" rx="38" ry="3" fill="#88ccff" style={{ animation: "sword-glow 2.5s ease-in-out infinite" }} />
      {/* Cross-guard */}
      <rect x="84" y="29" width="6" height="22" rx="2" fill="#c8960c" />
      <ellipse cx="87" cy="29" rx="3" ry="4" fill="#e8b020" />
      <ellipse cx="87" cy="51" rx="3" ry="4" fill="#e8b020" />
      {/* Grip */}
      <rect x="88" y="35" width="12" height="10" rx="2" fill="#5c2a0a" />
      {/* Grip wrapping */}
      <line x1="88" y1="37" x2="100" y2="37" stroke="#3d1a06" strokeWidth="1.5" />
      <line x1="88" y1="39.5" x2="100" y2="39.5" stroke="#3d1a06" strokeWidth="1.5" />
      <line x1="88" y1="42" x2="100" y2="42" stroke="#3d1a06" strokeWidth="1.5" />
      <line x1="88" y1="44.5" x2="100" y2="44.5" stroke="#3d1a06" strokeWidth="1.5" />
      {/* Pommel */}
      <ellipse cx="106" cy="40" rx="6" ry="5" fill="#c8960c" />
      <ellipse cx="106" cy="40" rx="4" ry="3" fill="#e8b020" />
      {/* Pommel gem */}
      <ellipse cx="106" cy="40" rx="2" ry="1.5" fill="#fff8e0" opacity="0.8" />
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
        filter: selected ? "drop-shadow(0 0 10px #f87171)" : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        animation: "sniper-idle 5s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes sniper-idle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          40% { transform: translateY(-3px) rotate(-0.8deg); }
          70% { transform: translateY(-2px) rotate(0.5deg); }
        }
        @keyframes scope-pulse {
          0%, 100% { opacity: 0.6; r: 5; }
          50% { opacity: 1; r: 7; }
        }
        @keyframes scope-lens-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes scope-crosshair {
          0%, 100% { opacity: 0.4; }
          30% { opacity: 0.9; }
          60% { opacity: 0.6; }
        }
        @keyframes bipod-sway {
          0%, 100% { transform: rotate(0deg); transform-origin: 35px 50px; }
          50% { transform: rotate(2deg); transform-origin: 35px 50px; }
        }
      `}</style>
      {/* Stock */}
      <rect x="90" y="37" width="38" height="14" rx="4" fill="#6b3d1a" />
      <rect x="90" y="38" width="38" height="4" rx="2" fill="#8b5a2a" opacity="0.4" />
      {/* Cheekrest */}
      <rect x="95" y="32" width="22" height="6" rx="3" fill="#7a4520" />
      {/* Receiver */}
      <rect x="52" y="35" width="42" height="16" rx="3" fill="#1e1e1e" />
      {/* Magazine */}
      <rect x="70" y="51" width="10" height="12" rx="2" fill="#222" />
      {/* Grip */}
      <polygon points="78,51 90,51 86,64 74,64" fill="#1a1a1a" />
      {/* Trigger guard */}
      <path d="M75 51 Q71 60 80 57" stroke="#444" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Barrel (long) */}
      <rect x="6" y="38.5" width="50" height="8" rx="3" fill="#1a1a1a" />
      {/* Muzzle brake / suppressor */}
      <rect x="4" y="37.5" width="7" height="10" rx="2" fill="#2a2a2a" />
      {/* Scope mount rail */}
      <rect x="52" y="33" width="38" height="5" rx="1" fill="#2a2a2a" />
      {/* Scope tube */}
      <rect x="55" y="20" width="36" height="13" rx="6" fill="#333" />
      <rect x="55" y="21" width="36" height="4" rx="3" fill="#444" opacity="0.5" />
      {/* Scope objective (front) */}
      <circle cx="60" cy="26.5" r="7" fill="#2a2a2a" />
      <circle cx="60" cy="26.5" r="5.5" fill="#1a3a5a" />
      <circle
        cx="60" cy="26.5" r="4"
        fill="#88ccff"
        style={{ animation: "scope-lens-glow 2s ease-in-out infinite" }}
      />
      {/* Scope crosshair lines */}
      <g style={{ animation: "scope-crosshair 2s ease-in-out infinite" }}>
        <line x1="57" y1="26.5" x2="63" y2="26.5" stroke="white" strokeWidth="0.8" />
        <line x1="60" y1="23.5" x2="60" y2="29.5" stroke="white" strokeWidth="0.8" />
        <circle cx="60" cy="26.5" r="1.5" stroke="white" strokeWidth="0.6" fill="none" />
      </g>
      {/* Scope eyepiece (rear) */}
      <circle cx="86" cy="26.5" r="5" fill="#2a2a2a" />
      <circle cx="86" cy="26.5" r="3.5" fill="#1a2a3a" />
      <circle cx="86" cy="26.5" r="2"
        fill="#4488cc" opacity="0.8"
        style={{ animation: "scope-pulse 2s ease-in-out infinite" }}
      />
      {/* Scope turret (elevation knob) */}
      <rect x="70" y="13" width="5" height="10" rx="2" fill="#333" />
      <rect x="70.5" y="14" width="4" height="2" rx="1" fill="#555" />
      {/* Bipod */}
      <g style={{ animation: "bipod-sway 3s ease-in-out infinite" }}>
        <line x1="28" y1="46.5" x2="18" y2="62" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="36" y1="46.5" x2="46" y2="62" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
        {/* Bipod feet */}
        <rect x="14" y="61" width="8" height="2.5" rx="1" fill="#2a2a2a" />
        <rect x="42" y="61" width="8" height="2.5" rx="1" fill="#2a2a2a" />
      </g>
      {/* Highlight on barrel */}
      <rect x="6" y="39" width="50" height="2" rx="1" fill="white" opacity="0.06" />
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
  pistol: {
    icon: null,
    stats: [
      { label: "Poškození", value: 25, max: 100 },
      { label: "Dostřel", value: 55, max: 100 },
      { label: "Rychlost střelby", value: 75, max: 100 },
    ],
    description: "Spolehlivá standardní pistole. Dobrá rovnováha poškození a rychlosti.",
    key: "1",
  },
  sword: {
    icon: null,
    stats: [
      { label: "Poškození", value: 80, max: 100 },
      { label: "Dostřel", value: 20, max: 100 },
      { label: "Rychlost útoku", value: 95, max: 100 },
    ],
    description: "Ocelový meč pro boj zblízka. Žádné projektily — ale smrtící na krátkou vzdálenost.",
    key: "2",
  },
  sniper: {
    icon: null,
    stats: [
      { label: "Poškození", value: 95, max: 100 },
      { label: "Dostřel", value: 100, max: 100 },
      { label: "Rychlost střelby", value: 25, max: 100 },
    ],
    description: "Přesná puška s optickým zaměřovačem. Jeden výstřel stačí.",
    key: "3",
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
        {type === "pistol" && <PistolSVG selected={selected} />}
        {type === "sword" && <SwordSVG selected={selected} />}
        {type === "sniper" && <SniperSVG selected={selected} />}
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
  const [selected, setSelected] = useState<WeaponType>("pistol");

  // Keyboard shortcuts 1/2/3 to pick weapon, Enter to confirm
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "1") setSelected("pistol");
      if (e.key === "2") setSelected("sword");
      if (e.key === "3") setSelected("sniper");
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
          width: "min(780px, 94vw)",
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
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {(["pistol", "sword", "sniper"] as WeaponType[]).map((t) => (
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
          Klávesy [1] [2] [3] pro výběr · [Enter] pro potvrzení
        </p>
      </div>
    </div>
  );
}
