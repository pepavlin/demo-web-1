"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const WEBHOOK_URL = "https://n8n.pavlin.dev/webhook/demo-web-1-create-issue";
const POLL_INTERVAL_MS = 30_000;

type Status = "idle" | "sending" | "sent" | "error";

interface TaskCounts {
  running: number;
  queued: number;
}

function parseTaskCounts(data: unknown): TaskCounts {
  let tasks: Array<{ status?: string }> = [];

  if (Array.isArray(data)) {
    tasks = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.tasks)) tasks = obj.tasks as typeof tasks;
    else if (Array.isArray(obj.data)) tasks = obj.data as typeof tasks;
    else if (Array.isArray(obj.items)) tasks = obj.items as typeof tasks;
  }

  return {
    running: tasks.filter((t) => t?.status === "running").length,
    queued: tasks.filter((t) => t?.status === "queued").length,
  };
}

function useTaskCounts(): TaskCounts {
  const [counts, setCounts] = useState<TaskCounts>({ running: 0, queued: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch(WEBHOOK_URL, { method: "GET" });
      if (!res.ok) return;
      const data: unknown = await res.json();
      setCounts(parseTaskCounts(data));
    } catch {
      // silently ignore — badge just stays at 0
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const id = setInterval(fetchCounts, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCounts]);

  return counts;
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const taskCounts = useTaskCounts();

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

  const hasActiveTasks = taskCounts.running > 0 || taskCounts.queued > 0;

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-[100] w-84"
          style={{
            width: "340px",
            background: "rgba(10, 8, 28, 0.92)",
            backdropFilter: "blur(48px) saturate(200%)",
            WebkitBackdropFilter: "blur(48px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "1.75rem",
            boxShadow:
              "0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(100,80,255,0.15), inset 0 1px 0 rgba(255,255,255,0.14)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: "1.1rem 1.4rem 1rem",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, rgba(120,80,255,0.9), rgba(80,160,255,0.9))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(100,80,255,0.4)",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90" style={{ lineHeight: 1.2 }}>
                  Navrhnout vylepšení
                </p>
                <p className="text-white/35" style={{ fontSize: "0.68rem", marginTop: "1px" }}>
                  Tvůj nápad jde přímo k implementaci
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Zavřít"
              className="flex items-center justify-center transition-colors"
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.45)",
                fontSize: "16px",
                lineHeight: 1,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "1.25rem 1.4rem 1.4rem" }}>
            {status === "sent" ? (
              <div className="text-center" style={{ padding: "1.25rem 0" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(80,200,120,0.3), rgba(80,200,120,0.1))",
                    border: "1px solid rgba(80,200,120,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 0.75rem",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="rgba(80,220,120,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-white/85 text-sm font-semibold mb-1">
                  Nápad byl odeslán k implementaci!
                </p>
                <p className="text-white/40" style={{ fontSize: "0.75rem" }}>
                  Díky, podíváme se na to.
                </p>
                <button
                  onClick={handleReset}
                  className="transition-colors"
                  style={{
                    marginTop: "1.1rem",
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.35)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                >
                  Odeslat další nápad
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
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "1rem",
                    padding: "0.875rem 1rem",
                    fontFamily: "inherit",
                    lineHeight: 1.6,
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(120,80,255,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
                {status === "error" && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "rgba(255,100,100,0.9)" }}>
                    Chyba při odesílání, zkus to znovu.
                  </p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || status === "sending"}
                  className="w-full font-medium transition-all"
                  style={{
                    marginTop: "0.875rem",
                    padding: "0.7rem 1rem",
                    borderRadius: "0.875rem",
                    fontSize: "0.85rem",
                    background:
                      message.trim() && status !== "sending"
                        ? "linear-gradient(135deg, rgba(120,80,255,0.85), rgba(80,160,255,0.85))"
                        : "rgba(255,255,255,0.07)",
                    color:
                      message.trim() && status !== "sending"
                        ? "white"
                        : "rgba(255,255,255,0.25)",
                    cursor:
                      message.trim() && status !== "sending"
                        ? "pointer"
                        : "default",
                    border:
                      message.trim() && status !== "sending"
                        ? "1px solid rgba(120,80,255,0.4)"
                        : "1px solid rgba(255,255,255,0.08)",
                    boxShadow:
                      message.trim() && status !== "sending"
                        ? "0 4px 16px rgba(100,80,255,0.3)"
                        : "none",
                  }}
                >
                  {status === "sending" ? "Odesílám…" : "Odeslat nápad"}
                </button>
                <p
                  className="text-center text-white/25"
                  style={{ marginTop: "0.75rem", fontSize: "0.68rem" }}
                >
                  Enter pro odeslání · Shift+Enter pro nový řádek
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating bottom-right cluster */}
      <div
        className="fixed bottom-5 right-5 z-[100] flex items-center gap-2"
        style={{ alignItems: "center" }}
      >
        {/* Task counts pill — shown only when there are active tasks */}
        {hasActiveTasks && (
          <div
            aria-label={`${taskCounts.running} běžících, ${taskCounts.queued} čekajících`}
            data-testid="task-counts"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(10, 8, 28, 0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "999px",
              padding: "5px 10px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            {taskCounts.running > 0 && (
              <span
                data-testid="running-count"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "rgba(80,220,160,0.95)",
                  lineHeight: 1,
                }}
              >
                {/* Running indicator dot */}
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "rgba(80,220,160,1)",
                    boxShadow: "0 0 6px rgba(80,220,160,0.8)",
                    flexShrink: 0,
                    animation: "pulse 1.4s ease-in-out infinite",
                  }}
                />
                {taskCounts.running}
              </span>
            )}
            {taskCounts.running > 0 && taskCounts.queued > 0 && (
              <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.65rem" }}>|</span>
            )}
            {taskCounts.queued > 0 && (
              <span
                data-testid="queued-count"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "rgba(180,150,255,0.9)",
                  lineHeight: 1,
                }}
              >
                {/* Queued indicator */}
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="4" cy="4" r="3" stroke="rgba(180,150,255,0.9)" strokeWidth="1.5" />
                </svg>
                {taskCounts.queued}
              </span>
            )}
          </div>
        )}

        {/* Floating toggle button */}
        <button
          onClick={handleToggle}
          aria-label={open ? "Zavřít panel nápadů" : "Otevřít panel nápadů"}
          className="w-12 h-12 flex items-center justify-center transition-transform active:scale-95"
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
      </div>

      {/* Pulse animation for running tasks */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </>
  );
}
