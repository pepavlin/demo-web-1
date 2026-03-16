/**
 * InventoryModal
 *
 * Full-screen inventory overlay shown when the player opens a chest or crate.
 * Displays all loot items with their icons and amounts. The player can either
 * take everything (Vzít vše) or close without picking anything up.
 */

"use client";

import React from "react";
import type { AirdropLoot } from "@/lib/gameTypes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lootIcon(loot: AirdropLoot): string {
  switch (loot.type) {
    case "coins":  return "🪙";
    case "wood":   return "🪵";
    case "health": return "❤️";
    case "weapon": return "⚔️";
    default:       return "📦";
  }
}

function lootAmountText(loot: AirdropLoot): string {
  switch (loot.type) {
    case "coins":  return `+${loot.amount} mincí`;
    case "wood":   return `+${loot.amount} dřeva`;
    case "health": return `+${loot.amount} HP`;
    case "weapon": return "Nalezena zbraň";
    default:       return String(loot.amount);
  }
}

function lootColor(loot: AirdropLoot): string {
  switch (loot.type) {
    case "coins":  return "#fcd34d";
    case "wood":   return "#86efac";
    case "health": return "#f87171";
    case "weapon": return "#a78bfa";
    default:       return "#e5e7eb";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface InventoryModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Title shown at the top (e.g. "Zásobovací bedna", "Truhla"). */
  title: string;
  /** Emoji / icon for the container type. */
  containerIcon: string;
  /** Items contained in this chest / crate. */
  items: AirdropLoot[];
  /** Called when the player clicks "Vzít vše" or presses E/Enter. */
  onTakeAll: () => void;
  /** Called when the player closes without taking (ESC or close button). */
  onClose: () => void;
}

export default function InventoryModal({
  open,
  title,
  containerIcon,
  items,
  onTakeAll,
  onClose,
}: InventoryModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center select-none"
      style={{ zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        // Close when clicking the backdrop (outside the panel)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rounded-2xl text-white font-bold"
        style={{
          minWidth: 340,
          maxWidth: 480,
          background: "rgba(10,18,10,0.97)",
          border: "1.5px solid rgba(80,200,80,0.45)",
          boxShadow: "0 0 48px rgba(60,200,60,0.25), 0 8px 32px rgba(0,0,0,0.7)",
          padding: "28px 30px 24px",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#aaa",
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: "pointer",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Zavřít (ESC)"
        >
          ×
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>{containerIcon}</div>
          <div style={{ fontSize: 20, color: "#bbf7d0", letterSpacing: 0.5 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontWeight: 400 }}>
            Obsah truhly
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(80,200,80,0.20)", marginBottom: 18 }} />

        {/* Items grid */}
        {items.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "12px 0" }}>
            Prázdné
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 12,
              marginBottom: 22,
            }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${lootColor(item)}44`,
                  borderRadius: 12,
                  padding: "14px 10px",
                  textAlign: "center",
                  boxShadow: `0 0 14px ${lootColor(item)}22`,
                }}
              >
                <div style={{ fontSize: 30, marginBottom: 6 }}>{lootIcon(item)}</div>
                <div
                  style={{
                    fontSize: 13,
                    color: lootColor(item),
                    fontWeight: 700,
                    marginBottom: 3,
                  }}
                >
                  {lootAmountText(item)}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(80,200,80,0.20)", marginBottom: 18 }} />

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#9ca3af",
              borderRadius: 10,
              padding: "10px 22px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Zavřít
          </button>
          <button
            onClick={onTakeAll}
            style={{
              background: "linear-gradient(135deg, rgba(30,100,30,0.9), rgba(20,70,20,0.9))",
              border: "1.5px solid rgba(80,200,80,0.60)",
              color: "#bbf7d0",
              borderRadius: 10,
              padding: "10px 28px",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 700,
              boxShadow: "0 0 18px rgba(60,200,60,0.30)",
              letterSpacing: 0.3,
            }}
          >
            ✅ Vzít vše
          </button>
        </div>

        {/* Hint */}
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#4b5563",
            marginTop: 12,
            fontWeight: 400,
          }}
        >
          [E] Vzít vše · [ESC] Zavřít
        </div>
      </div>
    </div>
  );
}
