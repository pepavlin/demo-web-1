"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import type { ChatMessage } from "@/hooks/useMultiplayer";

/** How long a message stays fully visible before starting to fade (ms). */
const MESSAGE_VISIBLE_MS = 6000;
/** Fade-out duration (ms). */
const MESSAGE_FADE_MS = 1500;
/** Total lifespan of a message in the log (ms). */
const MESSAGE_TTL_MS = MESSAGE_VISIBLE_MS + MESSAGE_FADE_MS;
/** Maximum characters in a single message. */
const MAX_MSG_LENGTH = 120;
/** Number of recent messages shown in the floating log. */
const VISIBLE_COUNT = 8;

interface TrackedMessage extends ChatMessage {
  /** Unix timestamp when the message was received (for fade-out). */
  receivedAt: number;
}

interface ChatPanelProps {
  /** All chat messages to display (last N will be shown). */
  messages: ChatMessage[];
  /** Called when the user submits a message. */
  onSend: (text: string) => void;
  /** Whether the chat input is currently open. */
  isOpen: boolean;
  /** Request to open the input (e.g. from parent key handler). */
  onOpen: () => void;
  /** Request to close the input (parent may want to re-lock pointer, etc.). */
  onClose: () => void;
}

/**
 * ChatPanel — floating in-game chat overlay.
 *
 * Features:
 * - Colour-coded player names (using the player's hex colour)
 * - Messages auto-fade after MESSAGE_TTL_MS milliseconds
 * - Scrolls to the newest message when new ones arrive
 * - Unread badge when new messages arrive while the panel is closed
 * - Input accepts up to MAX_MSG_LENGTH characters, submitted with Enter / cancelled
 *   with Escape
 * - "Send" button as an alternative to pressing Enter
 */
export default function ChatPanel({
  messages,
  onSend,
  isOpen,
  onOpen,
  onClose,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(messages.length);

  // Track when each message was received for auto-fade.
  const [tracked, setTracked] = useState<TrackedMessage[]>([]);
  // Force re-renders while messages are fading.
  const [, setTick] = useState(0);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Sync incoming messages → tracked list ─────────────────────────────────
  useEffect(() => {
    const now = Date.now();
    setTracked((prev) => {
      // Only add truly new messages (by timestamp + sender id).
      const prevKeys = new Set(prev.map((m) => `${m.id}-${m.ts}`));
      const newOnes = messages
        .filter((m) => !prevKeys.has(`${m.id}-${m.ts}`))
        .map((m) => ({ ...m, receivedAt: now }));
      if (newOnes.length === 0) return prev;
      const merged = [...prev, ...newOnes];
      // Keep only last 50 tracked messages.
      return merged.length > 50 ? merged.slice(merged.length - 50) : merged;
    });
  }, [messages]);

  // ── Prune expired messages & keep fade animation running ──────────────────
  useEffect(() => {
    tickTimerRef.current = setInterval(() => {
      const now = Date.now();
      setTracked((prev) => {
        const alive = prev.filter((m) => now - m.receivedAt < MESSAGE_TTL_MS);
        return alive.length !== prev.length ? alive : prev;
      });
      setTick((t) => t + 1);
    }, 250);
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, []);

  // ── Auto-scroll log to bottom when new messages arrive ────────────────────
  useEffect(() => {
    const log = logRef.current;
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [tracked.length]);

  // ── Unread count when panel is closed ─────────────────────────────────────
  useEffect(() => {
    const newCount = messages.length;
    const delta = newCount - prevMsgCountRef.current;
    prevMsgCountRef.current = newCount;
    if (!isOpen && delta > 0) {
      setUnreadCount((c) => c + delta);
    }
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [messages.length, isOpen]);

  // ── Focus input when opened ────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  // ── Send helpers ──────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (text) onSend(text);
    setInputValue("");
    onClose();
  }, [inputValue, onSend, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInputValue("");
        onClose();
      }
    },
    [handleSend, onClose]
  );

  // ── Compute which messages to show & their opacity ────────────────────────
  const visibleMessages = tracked.slice(-VISIBLE_COUNT);
  const now = Date.now();

  const hasContent = visibleMessages.length > 0 || isOpen;

  return (
    <div
      data-testid="chat-panel"
      style={{
        position: "fixed",
        bottom: hasContent ? 20 : -220,
        left: 20,
        zIndex: 65,
        width: 380,
        maxWidth: "calc(100vw - 40px)",
        transition: "bottom 0.3s ease",
        pointerEvents: isOpen ? "auto" : "none",
        userSelect: isOpen ? "text" : "none",
      }}
    >
      {/* ── Unread badge (shown when chat is closed and there are unread messages) */}
      {!isOpen && unreadCount > 0 && (
        <button
          data-testid="chat-unread-badge"
          onClick={onOpen}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            padding: "4px 12px",
            borderRadius: 20,
            background: "rgba(74,158,255,0.85)",
            border: "1px solid rgba(74,158,255,0.9)",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            pointerEvents: "auto",
            boxShadow: "0 2px 8px rgba(74,158,255,0.4)",
            animation: "chatBadgePulse 1.5s ease-in-out infinite",
          }}
        >
          {unreadCount} {unreadCount === 1 ? "nová zpráva" : "nové zprávy"}
        </button>
      )}

      {/* ── Message log ───────────────────────────────────────────────────── */}
      {visibleMessages.length > 0 && (
        <div
          ref={logRef}
          data-testid="chat-message-log"
          style={{
            marginBottom: 6,
            maxHeight: 180,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            scrollbarWidth: "none",
          }}
        >
          {visibleMessages.map((msg, i) => {
            const age = now - msg.receivedAt;
            const opacity =
              age < MESSAGE_VISIBLE_MS
                ? 1
                : Math.max(
                    0,
                    1 - (age - MESSAGE_VISIBLE_MS) / MESSAGE_FADE_MS
                  );
            const colorHex = `#${msg.color.toString(16).padStart(6, "0")}`;
            return (
              <div
                key={`${msg.id}-${msg.ts}-${i}`}
                data-testid="chat-message"
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "rgba(5,8,20,0.78)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  backdropFilter: "blur(8px)",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.88)",
                  display: "flex",
                  gap: 6,
                  alignItems: "baseline",
                  opacity,
                  transition: "opacity 0.25s linear",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: colorHex,
                    flexShrink: 0,
                  }}
                >
                  {msg.name}:
                </span>
                <span style={{ wordBreak: "break-word" }}>{msg.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Input row (shown when isOpen) ─────────────────────────────────── */}
      {isOpen && (
        <div
          data-testid="chat-input-row"
          style={{ display: "flex", gap: 6, alignItems: "center" }}
        >
          <input
            ref={inputRef}
            data-testid="chat-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MSG_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Zpráva… (Enter odešle, Esc zruší)"
            maxLength={MAX_MSG_LENGTH}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(5,8,20,0.92)",
              border: "1px solid rgba(74,158,255,0.5)",
              color: "white",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            data-testid="chat-send-button"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: inputValue.trim()
                ? "rgba(74,158,255,0.7)"
                : "rgba(74,158,255,0.2)",
              border: "1px solid rgba(74,158,255,0.5)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: inputValue.trim() ? "pointer" : "default",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            Odeslat
          </button>
        </div>
      )}
    </div>
  );
}

// ── CSS keyframe injected at module level ──────────────────────────────────────
// (Inline styles can't use @keyframes; we inject a <style> tag once.)
if (typeof document !== "undefined") {
  const STYLE_ID = "__chat-panel-styles__";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes chatBadgePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
  }
}
