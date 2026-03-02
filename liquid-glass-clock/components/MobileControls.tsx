"use client";

import { useEffect, useRef, useCallback, CSSProperties } from "react";

interface MobileControlsProps {
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
  onAttack: () => void;
  onInteract: () => void;
  visible: boolean;
}

const JOYSTICK_RADIUS = 55; // visual radius of the joystick base (px)
const LOOK_SENSITIVITY = 0.004; // radians per pixel

export default function MobileControls({
  keysRef,
  yawRef,
  pitchRef,
  onAttack,
  onInteract,
  visible,
}: MobileControlsProps) {
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);

  // Track active touch IDs to avoid conflicts between joystick and look zones
  const moveTouchIdRef = useRef<number | null>(null);
  const moveTouchBaseRef = useRef<{ x: number; y: number } | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const lookPrevRef = useRef<{ x: number; y: number } | null>(null);

  /** Move the visual knob within the joystick base */
  const setKnobOffset = useCallback((dx: number, dy: number) => {
    const knob = joystickKnobRef.current;
    if (!knob) return;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }, []);

  /** Release movement keys and reset the knob */
  const resetJoystick = useCallback(() => {
    keysRef.current["KeyW"] = false;
    keysRef.current["KeyS"] = false;
    keysRef.current["KeyA"] = false;
    keysRef.current["KeyD"] = false;
    moveTouchIdRef.current = null;
    moveTouchBaseRef.current = null;
    setKnobOffset(0, 0);
  }, [keysRef, setKnobOffset]);

  useEffect(() => {
    if (!visible) return;

    const LEFT_ZONE_FRACTION = 0.45; // left 45% of screen = movement zone
    const DEADZONE = 0.22; // normalised joystick dead-zone

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target;
      // Let buttons handle their own touch events (guard against non-Element targets)
      if (target instanceof Element && target.closest("button")) return;

      const screenW = window.innerWidth;
      const changedTouches = Array.from(e.changedTouches);

      for (const touch of changedTouches) {
        const isLeft = touch.clientX < screenW * LEFT_ZONE_FRACTION;

        if (isLeft && moveTouchIdRef.current === null) {
          moveTouchIdRef.current = touch.identifier;
          moveTouchBaseRef.current = { x: touch.clientX, y: touch.clientY };
        } else if (!isLeft && lookTouchIdRef.current === null) {
          lookTouchIdRef.current = touch.identifier;
          lookPrevRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent the browser from scrolling / bouncing the page
      e.preventDefault();

      const changedTouches = Array.from(e.changedTouches);

      for (const touch of changedTouches) {
        // ── Movement joystick ──────────────────────────────────────────────
        if (
          touch.identifier === moveTouchIdRef.current &&
          moveTouchBaseRef.current
        ) {
          const dx = touch.clientX - moveTouchBaseRef.current.x;
          const dy = touch.clientY - moveTouchBaseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Clamp knob inside base
          const clamped = Math.min(dist, JOYSTICK_RADIUS);
          const angle = Math.atan2(dy, dx);
          setKnobOffset(
            Math.cos(angle) * clamped,
            Math.sin(angle) * clamped
          );

          // Map to key states (normalised direction)
          const nx = dist > 1 ? dx / dist : 0;
          const ny = dist > 1 ? dy / dist : 0;
          keysRef.current["KeyW"] = ny < -DEADZONE;
          keysRef.current["KeyS"] = ny > DEADZONE;
          keysRef.current["KeyA"] = nx < -DEADZONE;
          keysRef.current["KeyD"] = nx > DEADZONE;
        }

        // ── Camera look ────────────────────────────────────────────────────
        if (
          touch.identifier === lookTouchIdRef.current &&
          lookPrevRef.current
        ) {
          const deltaX = touch.clientX - lookPrevRef.current.x;
          const deltaY = touch.clientY - lookPrevRef.current.y;
          yawRef.current -= deltaX * LOOK_SENSITIVITY;
          pitchRef.current -= deltaY * LOOK_SENSITIVITY;
          pitchRef.current = Math.max(
            -Math.PI / 2.2,
            Math.min(Math.PI / 2.2, pitchRef.current)
          );
          lookPrevRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const changedTouches = Array.from(e.changedTouches);
      for (const touch of changedTouches) {
        if (touch.identifier === moveTouchIdRef.current) {
          resetJoystick();
        }
        if (touch.identifier === lookTouchIdRef.current) {
          lookTouchIdRef.current = null;
          lookPrevRef.current = null;
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });
    document.addEventListener("touchcancel", handleTouchEnd, {
      passive: false,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
      resetJoystick();
    };
  }, [visible, keysRef, yawRef, pitchRef, resetJoystick, setKnobOffset]);

  if (!visible) return null;

  return (
    <>
      {/* ── Left joystick ─────────────────────────────────────────────────── */}
      <div
        aria-label="pohybový joystick"
        style={{
          position: "fixed",
          bottom: 30,
          left: 30,
          width: JOYSTICK_RADIUS * 2,
          height: JOYSTICK_RADIUS * 2,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "2px solid rgba(255,255,255,0.20)",
          zIndex: 80,
          pointerEvents: "none", // touch handled by document listener
        }}
      >
        <div
          ref={joystickKnobRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.22)",
            border: "2px solid rgba(255,255,255,0.55)",
            transform: "translate(-50%, -50%)",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Action buttons — bottom right ─────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 30,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 80,
        }}
      >
        {/* Jump */}
        <ActionButton
          color="#4ade80"
          label="↑"
          onPressStart={() => {
            keysRef.current["Space"] = true;
          }}
          onPressEnd={() => {
            keysRef.current["Space"] = false;
          }}
        />

        {/* Attack */}
        <ActionButton
          color="#f87171"
          label="⚔"
          onPressStart={onAttack}
          onPressEnd={() => {}}
        />

        {/* Interact (E key) */}
        <ActionButton
          color="#60a5fa"
          label="E"
          onPressStart={onInteract}
          onPressEnd={() => {}}
        />

        {/* Sprint — hold to sprint */}
        <ActionButton
          color="#fbbf24"
          label="💨"
          onPressStart={() => {
            keysRef.current["ShiftLeft"] = true;
          }}
          onPressEnd={() => {
            keysRef.current["ShiftLeft"] = false;
          }}
        />
      </div>

      {/* ── Hint label for look zone ─────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 8,
          right: 90,
          fontSize: 10,
          color: "rgba(255,255,255,0.25)",
          pointerEvents: "none",
          zIndex: 79,
          userSelect: "none",
        }}
      >
        táhni pro pohled
      </div>
    </>
  );
}

// ─── Reusable action button ────────────────────────────────────────────────────
interface ActionButtonProps {
  color: string;
  label: string;
  onPressStart: () => void;
  onPressEnd: () => void;
}

function ActionButton({
  color,
  label,
  onPressStart,
  onPressEnd,
}: ActionButtonProps) {
  const btnStyle: CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: `${color}1a`,
    border: `2px solid ${color}77`,
    color: color,
    fontSize: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "none",
    cursor: "pointer",
    fontWeight: 700,
    backdropFilter: "blur(6px)",
    boxShadow: `0 2px 10px ${color}33`,
  };

  return (
    <button
      style={btnStyle}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPressStart();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPressEnd();
      }}
      onMouseDown={onPressStart}
      onMouseUp={onPressEnd}
    >
      {label}
    </button>
  );
}
