"use client";

import React, { useState } from "react";
import type { WeaponType } from "@/lib/gameTypes";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";

// ─── Animated SVG weapons ─────────────────────────────────────────────────────

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
        @keyframes sword-swing {
          0%, 70%, 100% { transform: rotate(0deg); transform-origin: 100px 40px; }
          80% { transform: rotate(-12deg); transform-origin: 100px 40px; }
          88% { transform: rotate(8deg); transform-origin: 100px 40px; }
        }
      `}</style>
      <g style={{ animation: "sword-swing 3s ease-in-out infinite" }}>
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
      </g>
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
        @keyframes bow-draw {
          0%, 75%, 100% { d: path("M30,12 Q18,40 30,68"); }
          80% { d: path("M34,12 Q16,40 34,68"); }
          88% { d: path("M30,12 Q18,40 30,68"); }
        }
        @keyframes string-vibrate {
          0%, 70%, 100% { transform: scaleX(1); }
          78% { transform: scaleX(1.04); }
          84% { transform: scaleX(0.97); }
          90% { transform: scaleX(1.02); }
        }
        @keyframes arrow-fly {
          0%, 72%, 100% { opacity: 1; transform: translateX(0); }
          73% { opacity: 1; transform: translateX(0); }
          80% { opacity: 0; transform: translateX(50px); }
          82%, 99% { opacity: 0; }
        }
      `}</style>

      {/* Bow limb (curved path) */}
      <path d="M30,10 Q15,40 30,70" stroke="#7a4a1a" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Bow limb highlight */}
      <path d="M29,10 Q14,40 29,70" stroke="#a06030" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />

      {/* Bowstring */}
      <g style={{ animation: "string-vibrate 3s ease-in-out infinite" }}>
        <line x1="30" y1="10" x2="30" y2="70" stroke="#ddd0aa" strokeWidth="1.5" />
      </g>

      {/* Arrow */}
      <g style={{ animation: "arrow-fly 3s ease-in-out infinite" }}>
        {/* Arrow shaft */}
        <line x1="30" y1="40" x2="90" y2="40" stroke="#8b5e3c" strokeWidth="3" strokeLinecap="round" />
        {/* Arrowhead */}
        <polygon points="90,40 80,36 82,40 80,44" fill="#aaaaaa" />
        {/* Fletching */}
        <polygon points="33,40 30,33 36,40" fill="#cc3333" opacity="0.85" />
        <polygon points="33,40 30,47 36,40" fill="#cc3333" opacity="0.85" />
      </g>

      {/* Grip wrap */}
      <rect x="25" y="34" width="9" height="12" rx="2" fill="#4a2a08" />
      <line x1="26" y1="36" x2="33" y2="36" stroke="#3a1a04" strokeWidth="1.2" />
      <line x1="26" y1="39" x2="33" y2="39" stroke="#3a1a04" strokeWidth="1.2" />
      <line x1="26" y1="42" x2="33" y2="42" stroke="#3a1a04" strokeWidth="1.2" />
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

  // Keyboard shortcuts 1/2/3 to pick weapon, Enter to confirm
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "1") setSelected("sword");
      if (e.key === "2") setSelected("bow");
      if (e.key === "3") setSelected("crossbow");
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
          {(["sword", "bow", "crossbow"] as WeaponType[]).map((t) => (
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
