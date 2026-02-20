"use client";

import { useVersionCheck } from "@/hooks/useVersionCheck";

export default function UpdateNotification() {
  const { updateAvailable } = useVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Dostupná nová verze"
      className="fixed top-5 left-1/2 z-[200] -translate-x-1/2"
      style={{
        width: "min(360px, calc(100vw - 2.5rem))",
        background: "rgba(10, 8, 28, 0.92)",
        backdropFilter: "blur(48px) saturate(200%)",
        WebkitBackdropFilter: "blur(48px) saturate(200%)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: "1.75rem",
        boxShadow:
          "0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(100,80,255,0.18), inset 0 1px 0 rgba(255,255,255,0.14)",
        padding: "1.25rem 1.5rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background:
            "linear-gradient(135deg, rgba(120,80,255,0.9), rgba(80,160,255,0.9))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px rgba(100,80,255,0.45)",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="text-white/90 font-semibold"
          style={{ fontSize: "0.88rem", lineHeight: 1.3 }}
        >
          Dostupná nová verze
        </p>
        <p
          className="text-white/40"
          style={{ fontSize: "0.72rem", marginTop: "2px" }}
        >
          Stránka byla aktualizována
        </p>
      </div>

      {/* Refresh button */}
      <button
        onClick={() => window.location.reload()}
        aria-label="Obnovit stránku"
        className="font-medium transition-all active:scale-95"
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "0.875rem",
          fontSize: "0.82rem",
          background:
            "linear-gradient(135deg, rgba(120,80,255,0.85), rgba(80,160,255,0.85))",
          color: "white",
          border: "1px solid rgba(120,80,255,0.4)",
          boxShadow: "0 4px 16px rgba(100,80,255,0.3)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow =
            "0 4px 24px rgba(100,80,255,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow =
            "0 4px 16px rgba(100,80,255,0.3)";
        }}
      >
        Obnovit
      </button>
    </div>
  );
}
