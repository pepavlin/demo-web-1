"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  onJoin: (name: string) => void;
}

export default function LobbyScreen({ onJoin }: Props) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleJoin = useCallback(() => {
    const trimmed = name.trim();
    onJoin(trimmed || "Hráč");
  }, [name, onJoin]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Spacebar to join when input is NOT focused, Enter always joins
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.code === "Space" && !isInput) {
        e.preventDefault();
        handleJoin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleJoin]);

  return (
    <div
      data-testid="lobby-screen"
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgb(4, 9, 31)" }}
    >
      {/* Animated stars background — deterministic pseudo-random based on index */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {Array.from({ length: 80 }, (_, i) => {
          const r = (n: number) => (((i + n) * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
          return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: r(0) * 2 + 1,
              height: r(37) * 2 + 1,
              left: `${r(73) * 100}%`,
              top: `${r(117) * 100}%`,
              background: "white",
              opacity: r(153) * 0.7 + 0.2,
              animation: `pulse ${2 + r(199) * 4}s ease-in-out infinite`,
              animationDelay: `${r(241) * 4}s`,
            }}
          />
          );
        })}
      </div>

      {/* Main card */}
      <div
        className="relative rounded-2xl text-center text-white max-w-md w-full mx-4"
        style={{
          padding: "48px 40px 44px",
          background: "rgba(8, 16, 36, 0.95)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 8px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Globe icon */}
        <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🌍</div>

        <h1
          className="font-bold"
          style={{ fontSize: 28, marginBottom: 6, letterSpacing: "-0.01em" }}
        >
          Open World
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 14,
            marginBottom: 36,
          }}
        >
          Multiplayer — připoj se ke světu
        </p>

        {/* Name input section */}
        <div style={{ marginBottom: 28 }}>
          <label
            htmlFor="player-name"
            className="block text-left text-xs font-semibold uppercase tracking-widest"
            style={{
              color: "rgba(255,255,255,0.35)",
              marginBottom: 10,
              letterSpacing: "0.12em",
            }}
          >
            Tvoje jméno
          </label>
          <input
            id="player-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
            placeholder="Zadej jméno…"
            maxLength={20}
            className="w-full rounded-xl text-white text-center text-lg font-medium outline-none transition-all"
            style={{
              padding: "14px 18px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: 18,
              letterSpacing: "0.01em",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border = "1px solid rgba(74,158,255,0.6)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.15)")
            }
          />
        </div>

        {/* Join button */}
        <button
          onClick={handleJoin}
          className="w-full font-bold rounded-xl text-white transition-colors"
          style={{
            padding: "15px 32px",
            fontSize: 17,
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 4px 20px rgba(37,99,235,0.4)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background =
              "linear-gradient(135deg, #3b82f6, #2563eb)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background =
              "linear-gradient(135deg, #2563eb, #1d4ed8)")
          }
        >
          Vstoupit do světa
        </button>

        {/* Spacebar hint */}
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
          }}
        >
          Stiskni{" "}
          <kbd
            style={{
              padding: "2px 8px",
              borderRadius: 5,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontFamily: "monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Mezerník
          </kbd>{" "}
          nebo{" "}
          <kbd
            style={{
              padding: "2px 8px",
              borderRadius: 5,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontFamily: "monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Enter
          </kbd>{" "}
          pro vstup
        </p>

        {/* Game info */}
        <div
          className="rounded-xl text-left"
          style={{
            marginTop: 28,
            padding: "14px 18px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="grid grid-cols-2 text-xs"
            style={{ gap: "8px 20px", color: "rgba(255,255,255,0.35)" }}
          >
            <div>🐑 Zažeň ovce do ohrady</div>
            <div>🌅 Dynamický den/noc</div>
            <div>🌟 Sesbírej mince</div>
            <div>🦊 Bojuj s liškami</div>
          </div>
        </div>
      </div>
    </div>
  );
}
