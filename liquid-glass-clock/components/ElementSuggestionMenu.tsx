"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const WEBHOOK_URL = "https://n8n.pavlin.dev/webhook/demo-web-1-create-issue";

type MenuStatus = "idle" | "sending" | "sent" | "error";

export interface ElementInfo {
  tag: string;
  id?: string;
  classes: string[];
  text: string;
  selector: string;
}

export function getElementInfo(el: HTMLElement): ElementInfo {
  const tag = el.tagName.toLowerCase();
  const id = el.id || undefined;
  const classes = Array.from(el.classList).filter((c) => c.length < 60);
  const text = (el.innerText || el.textContent || "").trim().slice(0, 120);

  const parts: string[] = [];
  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && current.tagName !== "BODY" && depth < 5) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${current.id}`;
    } else if (current.classList.length > 0) {
      part += `.${Array.from(current.classList).slice(0, 2).join(".")}`;
    }
    parts.unshift(part);
    current = current.parentElement;
    depth++;
  }

  return { tag, id, classes, text, selector: parts.join(" > ") };
}

export function getElementDescription(info: ElementInfo): string {
  let desc = `<${info.tag}`;
  if (info.id) desc += `#${info.id}`;
  else if (info.classes.length > 0) desc += `.${info.classes.slice(0, 2).join(".")}`;
  desc += ">";
  if (info.text) {
    const short = info.text.slice(0, 60);
    desc += ` "${short}${info.text.length > 60 ? "…" : ""}"`;
  }
  return desc;
}

export default function ElementSuggestionMenu() {
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<MenuStatus>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const highlightedElRef = useRef<HTMLElement | null>(null);

  const removeHighlight = useCallback(() => {
    if (highlightedElRef.current) {
      highlightedElRef.current.style.outline = "";
      highlightedElRef.current.style.outlineOffset = "";
      highlightedElRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    removeHighlight();
    setVisible(false);
    setShowInput(false);
    setMessage("");
    setStatus("idle");
    setElementInfo(null);
  }, [removeHighlight]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && menuRef.current.contains(target)) return;

      e.preventDefault();
      removeHighlight();

      target.style.outline = "2px solid rgba(120,80,255,0.85)";
      target.style.outlineOffset = "2px";
      highlightedElRef.current = target;

      setElementInfo(getElementInfo(target));
      setMenuPos({ x: e.clientX, y: e.clientY });
      setVisible(true);
      setShowInput(false);
      setMessage("");
      setStatus("idle");
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, [removeHighlight]);

  useEffect(() => {
    if (!visible) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [visible, close]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, close]);

  useEffect(() => {
    if (showInput && status === "idle" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showInput, status]);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;

    setStatus("sending");

    const elementContext = elementInfo
      ? `[Element: ${getElementDescription(elementInfo)}]\n`
      : "";

    const payload: Record<string, unknown> = {
      message: `${elementContext}${trimmed}`,
      type: "element_suggestion",
    };

    if (elementInfo) {
      payload.element = {
        description: getElementDescription(elementInfo),
        selector: elementInfo.selector,
        tag: elementInfo.tag,
        ...(elementInfo.id ? { id: elementInfo.id } : {}),
        classes: elementInfo.classes,
        text: elementInfo.text,
      };
    }

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") close();
  };

  const menuWidth = showInput ? 320 : 200;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
  const left = Math.min(menuPos.x, vw - menuWidth - 8);
  const top = Math.min(menuPos.y, vh - (showInput ? 360 : 60));

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      data-testid="element-suggestion-menu"
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 9999,
      }}
    >
      {!showInput ? (
        /* Compact context menu */
        <div
          style={{
            background: "rgba(10, 8, 28, 0.96)",
            backdropFilter: "blur(24px) saturate(200%)",
            WebkitBackdropFilter: "blur(24px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "0.75rem",
            padding: "0.25rem",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(100,80,255,0.2)",
            minWidth: "180px",
          }}
        >
          <button
            onClick={() => setShowInput(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.85)",
              fontSize: "0.83rem",
              cursor: "pointer",
              transition: "background 0.15s",
              textAlign: "left",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(120,80,255,0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                stroke="rgba(160,120,255,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                stroke="rgba(160,120,255,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Napsat návrh
          </button>
        </div>
      ) : (
        /* Suggestion input panel */
        <div
          style={{
            width: "320px",
            background: "rgba(10, 8, 28, 0.96)",
            backdropFilter: "blur(48px) saturate(200%)",
            WebkitBackdropFilter: "blur(48px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "1.25rem",
            boxShadow:
              "0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(100,80,255,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.9rem 1.1rem 0.75rem",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  background:
                    "linear-gradient(135deg, rgba(120,80,255,0.9), rgba(80,160,255,0.9))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(100,80,255,0.4)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    lineHeight: 1.2,
                  }}
                >
                  Napsat návrh
                </p>
                {elementInfo && (
                  <p
                    style={{
                      fontSize: "0.64rem",
                      color: "rgba(160,120,255,0.75)",
                      marginTop: "1px",
                      fontFamily: "monospace",
                    }}
                  >
                    {`<${elementInfo.tag}${
                      elementInfo.id
                        ? `#${elementInfo.id}`
                        : elementInfo.classes.length > 0
                        ? `.${elementInfo.classes[0]}`
                        : ""
                    }>`}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={close}
              aria-label="Zavřít návrh"
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.45)",
                fontSize: "14px",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.85)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.45)")
              }
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "1rem 1.1rem 1.1rem" }}>
            {status === "sent" ? (
              <div style={{ textAlign: "center", padding: "1rem 0" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, rgba(80,200,120,0.3), rgba(80,200,120,0.1))",
                    border: "1px solid rgba(80,200,120,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 0.6rem",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17L4 12"
                      stroke="rgba(80,220,120,0.9)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  Návrh odeslán!
                </p>
                <p
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.4)",
                    marginTop: "0.25rem",
                  }}
                >
                  Díky, podíváme se na to.
                </p>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Popiš svůj návrh k tomuto prvku…"
                  rows={3}
                  disabled={status === "sending"}
                  style={{
                    width: "100%",
                    resize: "none",
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.9)",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "0.75rem",
                    padding: "0.7rem 0.875rem",
                    fontFamily: "inherit",
                    lineHeight: 1.6,
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(120,80,255,0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.1)")
                  }
                />
                {status === "error" && (
                  <p
                    style={{
                      marginTop: "0.4rem",
                      fontSize: "0.7rem",
                      color: "rgba(255,100,100,0.9)",
                    }}
                  >
                    Chyba při odesílání, zkus to znovu.
                  </p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || status === "sending"}
                  style={{
                    width: "100%",
                    marginTop: "0.75rem",
                    padding: "0.6rem 1rem",
                    borderRadius: "0.75rem",
                    fontSize: "0.8rem",
                    fontWeight: 500,
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
                    transition: "all 0.2s",
                  }}
                >
                  {status === "sending" ? "Odesílám…" : "Odeslat návrh"}
                </button>
                <p
                  style={{
                    textAlign: "center",
                    marginTop: "0.5rem",
                    fontSize: "0.64rem",
                    color: "rgba(255,255,255,0.25)",
                  }}
                >
                  Enter pro odeslání · Shift+Enter pro nový řádek
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
