"use client";

/**
 * PrinterModal.tsx
 *
 * Full-screen modal UI for the in-bunker 3D printer.
 * Aesthetic: industrial retro-futuristic — CRT green + cyan scanlines,
 * monospace font, dark panels with metallic borders. Matches the bunker lab
 * atmosphere while feeling distinctly "high-tech fabrication".
 *
 * States:
 *   idle      — text input for item description, submit button
 *   loading   — animated circular progress + status messages
 *   success   — shows generated item name/type + "Item added to world" message
 *   error     — shows error message with retry option
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { PrintedItemMetadata } from "@/lib/printedItemSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalState = "idle" | "loading" | "success" | "error";

export interface PrinterResult {
  meshCode: string;
  metadata: PrintedItemMetadata;
}

interface PrinterModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Player name (sent to the API for flavour). */
  playerName: string;
  /** Called when the modal should close (Escape or close button). */
  onClose: () => void;
  /** Called when the item has been successfully generated. */
  onItemGenerated: (result: PrinterResult) => void;
}

// ─── Loading messages cycle ────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  "Inicializuji tiskovou hlavu...",
  "Analyzuji geometrii objektu...",
  "Načítám filament...",
  "Kalibrace tiskové podložky...",
  "Generuji 3D model...",
  "Optimalizuji síť polygonů...",
  "Kompileji herní logiku...",
  "Nanáším vrstvy materiálu...",
  "Ověřuji strukturální integritu...",
  "Finalizuji výtisk...",
];

// ─── TypeBadge helper ─────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  weapon:     "⚔️ Zbraň",
  tool:       "🔧 Nástroj",
  consumable: "💊 Spotřební",
  decorative: "🎨 Dekorativní",
};

const TYPE_COLORS: Record<string, string> = {
  weapon:     "#ff6644",
  tool:       "#ffcc00",
  consumable: "#44ff88",
  decorative: "#8888ff",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrinterModal({
  isOpen,
  playerName,
  onClose,
  onItemGenerated,
}: PrinterModalProps) {
  const [modalState, setModalState] = useState<ModalState>("idle");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [generatedItem, setGeneratedItem] = useState<PrintedItemMetadata | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen && modalState === "idle") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, modalState]);

  // Reset to idle when (re)opened
  useEffect(() => {
    if (isOpen) {
      setModalState("idle");
      setDescription("");
      setErrorMsg("");
      setGeneratedItem(null);
      setProgress(0);
    }
  }, [isOpen]);

  // Cycle loading messages and progress
  useEffect(() => {
    if (modalState === "loading") {
      setLoadingMsgIdx(0);
      setProgress(0);

      intervalRef.current = setInterval(() => {
        setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
      }, 1800);

      progressIntervalRef.current = setInterval(() => {
        setProgress((p) => Math.min(p + 0.8, 92)); // approach 92% — jumps to 100 on success
      }, 150);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [modalState]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalState !== "loading") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, modalState, onClose]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const trimmed = description.trim();
    if (!trimmed || modalState === "loading") return;

    setModalState("loading");

    try {
      const res = await fetch("/api/generate-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed, playerName }),
      });

      const data = await res.json() as {
        success: boolean;
        meshCode?: string;
        metadata?: PrintedItemMetadata;
        error?: string;
      };

      if (!data.success || !data.meshCode || !data.metadata) {
        throw new Error(data.error ?? "Neznámá chyba.");
      }

      setProgress(100);
      setGeneratedItem(data.metadata);
      setModalState("success");

      // Notify Game3D
      onItemGenerated({ meshCode: data.meshCode, metadata: data.metadata });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generování selhalo.";
      setErrorMsg(msg);
      setModalState("error");
    }
  }, [description, modalState, playerName, onItemGenerated]);

  // Ctrl+Enter submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}
    >
      {/* ── Panel ── */}
      <div
        style={{
          width: "min(560px, 96vw)",
          background: "linear-gradient(160deg, #090f0d 0%, #040c0a 100%)",
          border: "1.5px solid #1a4a3a",
          borderRadius: 16,
          boxShadow: "0 0 60px rgba(0,255,180,0.10), 0 0 120px rgba(0,200,150,0.05), inset 0 0 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          position: "relative",
        }}
      >
        {/* ── Scanline overlay ── */}
        <div
          style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,140,0.018) 2px, rgba(0,255,140,0.018) 4px)",
          }}
        />

        {/* ── Header bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px",
          background: "rgba(0,255,180,0.05)",
          borderBottom: "1px solid #1a4a3a",
          position: "relative", zIndex: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Printer icon — animated dot */}
            <span style={{
              display: "inline-block", width: 10, height: 10, borderRadius: "50%",
              background: "#00ffcc",
              boxShadow: "0 0 8px #00ffcc",
              animation: "printerPulse 1.4s ease-in-out infinite",
            }} />
            <span style={{ color: "#00ffcc", fontSize: 13, letterSpacing: "0.12em", fontWeight: 700 }}>
              3D TISKÁRNA <span style={{ color: "#336655", fontWeight: 400 }}>// ONLINE</span>
            </span>
          </div>

          {modalState !== "loading" && (
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#336655", fontSize: 18, lineHeight: 1, padding: "2px 6px",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ff4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#336655")}
              aria-label="Zavřít"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "24px 24px 28px", position: "relative", zIndex: 2 }}>

          {/* ══════════ IDLE STATE ══════════ */}
          {modalState === "idle" && (
            <>
              <p style={{ color: "#4a8a6a", fontSize: 11, letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>
                &gt; Zadejte popis předmětu k tisku
              </p>
              <textarea
                ref={inputRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={200}
                rows={4}
                placeholder="Např: magický meč s modrým plamenem, lékárnička, zlatá koruna, výbušná střela..."
                style={{
                  width: "100%",
                  background: "rgba(0,255,180,0.04)",
                  border: "1px solid #1a4a3a",
                  borderRadius: 8,
                  color: "#aaffdd",
                  fontSize: 14,
                  padding: "12px 14px",
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                  boxSizing: "border-box",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#00ffcc";
                  e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,180,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#1a4a3a";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ color: "#2a5a3a", fontSize: 11 }}>
                  {description.length}/200 znaků &nbsp;·&nbsp; Ctrl+Enter pro odeslání
                </span>
                <span style={{ color: "#2a5a3a", fontSize: 11 }}>
                  Claude AI generátor
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!description.trim()}
                style={{
                  marginTop: 18,
                  width: "100%",
                  padding: "13px 20px",
                  background: description.trim()
                    ? "linear-gradient(90deg, #004433 0%, #006655 100%)"
                    : "rgba(0,255,180,0.03)",
                  border: `1px solid ${description.trim() ? "#00ffcc" : "#1a3a2a"}`,
                  borderRadius: 8,
                  color: description.trim() ? "#00ffcc" : "#2a5a3a",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  cursor: description.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  transition: "all 0.2s",
                  boxShadow: description.trim() ? "0 0 16px rgba(0,255,180,0.15)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (description.trim()) {
                    e.currentTarget.style.background = "linear-gradient(90deg, #006655 0%, #008877 100%)";
                    e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,180,0.25)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (description.trim()) {
                    e.currentTarget.style.background = "linear-gradient(90deg, #004433 0%, #006655 100%)";
                    e.currentTarget.style.boxShadow = "0 0 16px rgba(0,255,180,0.15)";
                  }
                }}
              >
                ▶ SPUSTIT TISK
              </button>

              <p style={{
                marginTop: 16, textAlign: "center",
                color: "#2a4a3a", fontSize: 11, lineHeight: 1.5,
              }}>
                AI vygeneruje 3D model a přidá ho do světa jako plnohodnotný herní předmět.
              </p>
            </>
          )}

          {/* ══════════ LOADING STATE ══════════ */}
          {modalState === "loading" && (
            <div style={{ textAlign: "center" }}>
              {/* Circular progress */}
              <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
                <svg width={100} height={100} viewBox="0 0 100 100">
                  {/* Track */}
                  <circle cx={50} cy={50} r={40} fill="none" stroke="#0a2a1a" strokeWidth={7} />
                  {/* Progress arc */}
                  <circle
                    cx={50} cy={50} r={40}
                    fill="none"
                    stroke="#00ffcc"
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                    transform="rotate(-90 50 50)"
                    style={{ transition: "stroke-dashoffset 0.15s linear", filter: "drop-shadow(0 0 6px #00ffcc)" }}
                  />
                  {/* Centre percent */}
                  <text
                    x={50} y={54}
                    textAnchor="middle"
                    fill="#00ffcc"
                    fontSize={14}
                    fontFamily="'IBM Plex Mono', monospace"
                    fontWeight={700}
                  >
                    {Math.round(progress)}%
                  </text>
                </svg>

                {/* Outer spinning ring */}
                <div style={{
                  position: "absolute", inset: -8,
                  border: "2px solid transparent",
                  borderTopColor: "#00ffcc44",
                  borderRightColor: "#00ffcc22",
                  borderRadius: "50%",
                  animation: "printerSpin 1.5s linear infinite",
                }} />
              </div>

              <p style={{
                color: "#00ffcc",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                marginBottom: 6,
                minHeight: 20,
                transition: "opacity 0.3s",
              }}>
                {LOADING_MESSAGES[loadingMsgIdx]}
              </p>

              <div style={{
                marginTop: 14,
                padding: "8px 14px",
                background: "rgba(0,255,180,0.04)",
                border: "1px solid #1a4a3a",
                borderRadius: 6,
                display: "inline-block",
              }}>
                <span style={{ color: "#2a6a4a", fontSize: 11 }}>
                  &gt; Claude AI &nbsp;·&nbsp; claude-sonnet-4-6 &nbsp;·&nbsp; Generuji herní předmět...
                </span>
              </div>

              {/* Progress bar strip */}
              <div style={{
                marginTop: 18, height: 3,
                background: "#0a2a1a", borderRadius: 2, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #004433, #00ffcc)",
                  boxShadow: "0 0 8px #00ffcc88",
                  transition: "width 0.15s linear",
                }} />
              </div>
            </div>
          )}

          {/* ══════════ SUCCESS STATE ══════════ */}
          {modalState === "success" && generatedItem && (
            <div style={{ textAlign: "center" }}>
              {/* Checkmark */}
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 64, height: 64, borderRadius: "50%",
                border: "2px solid #00ffcc",
                boxShadow: "0 0 24px rgba(0,255,180,0.3)",
                marginBottom: 18,
                fontSize: 28,
                animation: "printerFadeIn 0.4s ease",
              }}>
                ✓
              </div>

              <p style={{
                color: "#00ffcc", fontSize: 12, letterSpacing: "0.15em",
                textTransform: "uppercase", marginBottom: 12,
              }}>
                Tisk dokončen
              </p>

              {/* Item card */}
              <div style={{
                background: "rgba(0,255,180,0.05)",
                border: `1px solid ${TYPE_COLORS[generatedItem.type] ?? "#1a4a3a"}44`,
                borderRadius: 10,
                padding: "16px 18px",
                marginBottom: 18,
                textAlign: "left",
                boxShadow: `0 0 20px ${TYPE_COLORS[generatedItem.type] ?? "#00ffcc"}18`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{
                    color: "#eeffee", fontSize: 16, fontWeight: 700,
                  }}>
                    {generatedItem.name}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: TYPE_COLORS[generatedItem.type] ?? "#aaffdd",
                    background: `${TYPE_COLORS[generatedItem.type] ?? "#00ffcc"}18`,
                    border: `1px solid ${TYPE_COLORS[generatedItem.type] ?? "#00ffcc"}44`,
                    borderRadius: 4,
                    padding: "2px 8px",
                  }}>
                    {TYPE_LABELS[generatedItem.type] ?? generatedItem.type}
                  </span>
                </div>

                <p style={{ color: "#6abba0", fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
                  {generatedItem.description}
                </p>

                {/* Stats row */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {generatedItem.damage > 0 && (
                    <StatChip label="Poškození" value={generatedItem.damage} color="#ff6644" />
                  )}
                  {generatedItem.healing > 0 && (
                    <StatChip label="Léčení" value={generatedItem.healing} color="#44ff88" />
                  )}
                </div>
              </div>

              <p style={{ color: "#4a8a6a", fontSize: 12, marginBottom: 18 }}>
                Předmět byl přidán do světa poblíž tiskárny.<br />
                Stiskni <kbd style={{ color: "#00ffcc", background: "#0a2a1a", border: "1px solid #1a4a3a", borderRadius: 3, padding: "1px 5px", fontSize: 11 }}>E</kbd> pro sebrání.
              </p>

              <button
                onClick={onClose}
                style={{
                  width: "100%", padding: "12px 20px",
                  background: "linear-gradient(90deg, #004433 0%, #006655 100%)",
                  border: "1px solid #00ffcc",
                  borderRadius: 8, color: "#00ffcc",
                  fontSize: 13, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 0 16px rgba(0,255,180,0.12)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,180,0.25)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 16px rgba(0,255,180,0.12)")}
              >
                ✓ Zavřít
              </button>
            </div>
          )}

          {/* ══════════ ERROR STATE ══════════ */}
          {modalState === "error" && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 56, height: 56, borderRadius: "50%",
                border: "2px solid #ff4444",
                boxShadow: "0 0 20px rgba(255,60,60,0.25)",
                marginBottom: 16, fontSize: 24, color: "#ff4444",
              }}>
                !
              </div>

              <p style={{ color: "#ff6655", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Chyba tisku
              </p>
              <p style={{ color: "#aa4444", fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
                {errorMsg}
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { setModalState("idle"); setErrorMsg(""); }}
                  style={{
                    flex: 1, padding: "11px 16px",
                    background: "rgba(0,255,180,0.06)",
                    border: "1px solid #1a4a3a", borderRadius: 8,
                    color: "#4a8a6a", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}
                >
                  ↩ Zpět
                </button>
                <button
                  onClick={handleSubmit}
                  style={{
                    flex: 2, padding: "11px 16px",
                    background: "linear-gradient(90deg, #440000 0%, #661111 100%)",
                    border: "1px solid #ff4444", borderRadius: 8,
                    color: "#ff8877", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}
                >
                  ↻ Zkusit znovu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes printerPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #00ffcc; }
          50% { opacity: 0.4; box-shadow: 0 0 3px #00ffcc; }
        }
        @keyframes printerSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes printerFadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: `${color}18`, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "3px 8px",
    }}>
      <span style={{ color: `${color}aa`, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
