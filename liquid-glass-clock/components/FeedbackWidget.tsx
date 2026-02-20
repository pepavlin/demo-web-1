"use client";

import { useState, useRef, useEffect } from "react";

const WEBHOOK_URL = "https://n8n.pavlin.dev/webhook/demo-web-1-create-issue";

type Status = "idle" | "sending" | "sent" | "error";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && status === "idle" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open, status]);

  const handleToggle = () => {
    setOpen((v) => !v);
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;

    setStatus("sending");
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setMessage("");
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-[100] w-80"
          style={{
            background: "rgba(15, 12, 35, 0.85)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "1.5rem",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-sm font-medium text-white/80">
              Navrhnout vylepšení
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Zavřít"
              className="text-white/40 hover:text-white/80 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            {status === "sent" ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-white/80 text-sm font-medium">
                  Nápad byl odeslán k implementaci
                </p>
                <button
                  onClick={handleReset}
                  className="mt-4 text-xs text-white/40 hover:text-white/70 transition-colors underline"
                >
                  Odeslat další
                </button>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Co by se tu mělo přidat nebo změnit?"
                  rows={4}
                  disabled={status === "sending"}
                  className="w-full resize-none text-sm text-white/90 placeholder-white/30 outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.75rem",
                    padding: "0.625rem 0.75rem",
                    fontFamily: "inherit",
                  }}
                />
                {status === "error" && (
                  <p className="mt-1 text-xs text-red-400">
                    Chyba při odesílání, zkus to znovu.
                  </p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || status === "sending"}
                  className="mt-3 w-full py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background:
                      message.trim() && status !== "sending"
                        ? "linear-gradient(135deg, rgba(120,80,255,0.8), rgba(80,160,255,0.8))"
                        : "rgba(255,255,255,0.08)",
                    color:
                      message.trim() && status !== "sending"
                        ? "white"
                        : "rgba(255,255,255,0.3)",
                    cursor:
                      message.trim() && status !== "sending"
                        ? "pointer"
                        : "default",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {status === "sending" ? "Odesílám…" : "Odeslat nápad"}
                </button>
                <p className="mt-2 text-center text-xs text-white/25">
                  Enter pro odeslání · Shift+Enter pro nový řádek
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={handleToggle}
        aria-label={open ? "Zavřít panel nápadů" : "Otevřít panel nápadů"}
        className="fixed bottom-5 right-5 z-[100] w-12 h-12 flex items-center justify-center transition-transform active:scale-95"
        style={{
          background:
            "linear-gradient(135deg, rgba(120,80,255,0.9), rgba(80,160,255,0.9))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          boxShadow:
            "0 4px 24px rgba(100,80,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        {open ? (
          /* X icon */
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line
              x1="2"
              y1="2"
              x2="16"
              y2="16"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="16"
              y1="2"
              x2="2"
              y2="16"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          /* Chat bubble icon */
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </>
  );
}
