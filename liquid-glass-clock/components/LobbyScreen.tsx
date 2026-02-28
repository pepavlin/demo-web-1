"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MotherShip from "./MotherShip";

interface Props {
  onJoin: (name: string) => void;
}

interface OnlinePlayer {
  id: string;
  name: string;
  color: number;
}

const STORAGE_KEY = "playerName";

export default function LobbyScreen({ onJoin }: Props) {
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    }
    return "";
  });
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleJoin = useCallback(() => {
    const trimmed = name.trim();
    const finalName = trimmed || "Hráč";
    localStorage.setItem(STORAGE_KEY, finalName);
    onJoin(finalName);
  }, [name, onJoin]);

  // Focus input on mount and select all text so pre-filled name is easy to confirm or replace
  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  // Poll online player list every 4 seconds
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch("/api/players/list");
        if (res.ok) {
          const data = await res.json();
          setOnlinePlayers(data.players ?? []);
        }
      } catch {
        // server might not be ready yet — ignore
      }
    };
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 4000);
    return () => clearInterval(interval);
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

  /** Convert a hex color number to a CSS rgba string */
  const colorDot = (hex: number) =>
    `#${hex.toString(16).padStart(6, "0")}`;

  return (
    <div
      data-testid="lobby-screen"
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgb(4, 9, 31)" }}
    >
      {/* District 9-style alien mothership filling the sky */}
      <MotherShip />

      {/* Main card – elevated z-index above the mothership canvas */}
      <div
        className="relative rounded-2xl text-center text-white max-w-md w-full mx-4"
        style={{
          position: "relative",
          zIndex: 10,
          padding: "48px 40px 44px",
          background: "rgba(6, 12, 28, 0.92)",
          border: "1px solid rgba(255,160,80,0.18)",
          boxShadow:
            "0 8px 64px rgba(0,0,0,0.9), 0 0 40px rgba(255,100,30,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px)",
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

        {/* Live player count */}
        <p
          data-testid="online-count"
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 14,
            marginBottom: 36,
          }}
        >
          Multiplayer —{" "}
          <span
            style={{
              color: onlinePlayers.length > 0 ? "rgba(107,255,138,0.85)" : "rgba(255,255,255,0.4)",
              fontWeight: onlinePlayers.length > 0 ? 600 : 400,
            }}
          >
            {onlinePlayers.length === 0
              ? "připoj se ke světu"
              : onlinePlayers.length === 1
              ? "1 hráč online"
              : `${onlinePlayers.length} hráčů online`}
          </span>
        </p>

        {/* Who's online list (when players are present) */}
        {onlinePlayers.length > 0 && (
          <div
            data-testid="online-players-list"
            style={{
              marginBottom: 24,
              padding: "10px 14px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Ve světě právě hrají
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {onlinePlayers.map((p) => (
                <span
                  key={p.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${colorDot(p.color)}44`,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: colorDot(p.color),
                      flexShrink: 0,
                    }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

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
            <div>💣 Znič katapulty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
