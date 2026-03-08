"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamically import to avoid SSR issues with Three.js/canvas
const MombasaGlobe = dynamic(() => import("@/components/MombasaGlobe"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000308",
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
      }}
    >
      Načítání globusu…
    </div>
  ),
});

export default function MombasaPage() {
  return (
    <div
      data-testid="mombasa-page"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000308",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: "1px solid rgba(255,144,0,0.12)",
          background: "rgba(4,10,22,0.9)",
          backdropFilter: "blur(12px)",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          style={{
            color: "rgba(255,255,255,0.5)",
            textDecoration: "none",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color =
              "rgba(255,255,255,0.9)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color =
              "rgba(255,255,255,0.5)")
          }
        >
          ← Zpět
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ff9000",
              boxShadow: "0 0 8px 2px rgba(255,144,0,0.9)",
              animation: "pulse-nav 1.5s ease-in-out infinite",
            }}
          />
          <span
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.1em",
            }}
          >
            MOMBASA — INTERAKTIVNÍ MAPA
          </span>
        </div>

        <div style={{ width: 48 }} />
      </nav>

      {/* Globe fills remaining space */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <MombasaGlobe />
      </div>

      <style>{`
        @keyframes pulse-nav {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(255,144,0,0.9); }
          50%       { box-shadow: 0 0 14px 5px rgba(255,144,0,1); }
        }
      `}</style>
    </div>
  );
}
