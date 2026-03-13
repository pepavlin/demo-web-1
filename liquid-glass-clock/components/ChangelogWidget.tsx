"use client";

import { useState } from "react";
import { CHANGELOG } from "@/lib/changelogData";

export default function ChangelogWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Popup panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Changelog — co je nového"
          aria-modal="true"
          className="fixed bottom-20 left-5 z-[100]"
          style={{
            width: "min(360px, calc(100vw - 2.5rem))",
            maxHeight: "70vh",
            display: "flex",
            flexDirection: "column",
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
              flexShrink: 0,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background:
                    "linear-gradient(135deg, rgba(80,200,120,0.9), rgba(40,160,200,0.9))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(80,200,120,0.4)",
                  flexShrink: 0,
                }}
              >
                {/* Scroll / list icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p
                  className="text-sm font-semibold text-white/90"
                  style={{ lineHeight: 1.2 }}
                >
                  Co je nového
                </p>
                <p
                  className="text-white/35"
                  style={{ fontSize: "0.68rem", marginTop: "1px" }}
                >
                  Historie změn ve hře
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Zavřít changelog"
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

          {/* Scrollable entries */}
          <div
            data-testid="changelog-entries"
            style={{
              overflowY: "auto",
              padding: "1rem 1.4rem 1.25rem",
              flex: 1,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.15) transparent",
            }}
          >
            {CHANGELOG.map((entry, idx) => (
              <div
                key={entry.date}
                data-testid="changelog-entry"
                style={{ marginBottom: idx < CHANGELOG.length - 1 ? "1.25rem" : 0 }}
              >
                {/* Date + title */}
                <div
                  className="flex items-baseline gap-2"
                  style={{ marginBottom: "0.45rem" }}
                >
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: "rgba(80,200,120,0.8)",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.date}
                  </span>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.85)",
                      lineHeight: 1.3,
                    }}
                  >
                    {entry.title}
                  </span>
                </div>

                {/* Item list */}
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {entry.items.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.45rem",
                        marginBottom: i < entry.items.length - 1 ? "0.3rem" : 0,
                      }}
                    >
                      <span
                        style={{
                          marginTop: "0.35em",
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          background: "rgba(80,200,120,0.6)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "rgba(255,255,255,0.65)",
                          lineHeight: 1.5,
                        }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating bottom-left toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Zavřít changelog" : "Otevřít changelog"}
        aria-expanded={open}
        className="fixed bottom-5 left-5 z-[100] w-12 h-12 flex items-center justify-center transition-transform active:scale-95"
        style={{
          background: open
            ? "linear-gradient(135deg, rgba(60,180,100,0.95), rgba(40,140,180,0.95))"
            : "linear-gradient(135deg, rgba(80,200,120,0.85), rgba(40,160,200,0.85))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          boxShadow:
            "0 4px 24px rgba(80,200,120,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow =
            "0 4px 32px rgba(80,200,120,0.55), inset 0 1px 0 rgba(255,255,255,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow =
            "0 4px 24px rgba(80,200,120,0.35), inset 0 1px 0 rgba(255,255,255,0.2)";
        }}
      >
        {open ? (
          /* X icon */
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="2" y1="2" x2="16" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="2" x2="2" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          /* Clipboard / changelog icon */
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
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
