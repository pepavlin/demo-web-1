"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useAnimationControls,
  useTransform,
} from "framer-motion";
import SlimeJumper from "./SlimeJumper";
import { useMouseParallax } from "@/hooks/useMouseParallax";

interface TimeState {
  hours: string;
  minutes: string;
  seconds: string;
  ampm: string;
  date: string;
  dayOfWeek: string;
  ms: number;
}

function getTime(): TimeState {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  return {
    hours: String(h).padStart(2, "0"),
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
    ampm: h >= 12 ? "PM" : "AM",
    date: now.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    dayOfWeek: now.toLocaleDateString("cs-CZ", { weekday: "long" }),
    ms: now.getMilliseconds(),
  };
}

interface DigitProps {
  value: string;
  label?: string;
}

function AnimatedDigit({ value, label }: DigitProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="digit-glass relative flex items-center justify-center px-10 py-6 md:px-12 md:py-8"
        style={{
          /* Push digit face slightly forward in 3-D space */
          transform: "translateZ(18px)",
          transformStyle: "preserve-3d",
        }}
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 40, opacity: 0, filter: "blur(8px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: -40, opacity: 0, filter: "blur(8px)" }}
            transition={{
              duration: 0.35,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="font-black text-white select-none tabular-nums"
            style={{
              fontSize: "clamp(4rem, 12vw, 10rem)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              /* 3-D extruded text: stacked shadows create depth */
              textShadow: [
                "0 1px 0 rgba(160,110,255,0.85)",
                "0 2px 0 rgba(140,90,240,0.75)",
                "0 3px 0 rgba(120,70,210,0.65)",
                "0 4px 0 rgba(100,55,180,0.55)",
                "0 5px 0 rgba(80,40,150,0.45)",
                "0 6px 0 rgba(60,30,120,0.35)",
                "0 8px 20px rgba(0,0,0,0.6)",
                "0 0 50px rgba(180,140,255,0.45)",
              ].join(", "),
            }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      {label && (
        <span
          className="text-white/40 uppercase tracking-widest"
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.3em",
            transform: "translateZ(8px)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/** 3-D sphere colon dots */
function Colon() {
  return (
    <div
      className="colon-blink flex flex-col justify-center gap-3 pb-6 md:pb-10 self-center"
      style={{ marginTop: "-8px", transform: "translateZ(24px)" }}
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            width: "clamp(8px, 1.4vw, 14px)",
            height: "clamp(8px, 1.4vw, 14px)",
            borderRadius: "50%",
            /* Radial gradient gives a convincing sphere highlight */
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(210,175,255,0.85) 25%, rgba(150,100,255,0.65) 55%, rgba(80,40,200,0.5) 80%, rgba(40,10,140,0.4) 100%)",
            boxShadow: [
              "0 4px 14px rgba(0,0,0,0.7)",
              "0 2px 6px rgba(0,0,0,0.5)",
              "0 0 12px rgba(150,100,255,0.6)",
              "inset 0 -3px 6px rgba(0,0,0,0.4)",
              "inset 0 2px 4px rgba(255,255,255,0.2)",
            ].join(", "),
          }}
        />
      ))}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{
        height: "3px",
        background: "rgba(255,255,255,0.08)",
      }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          background:
            "linear-gradient(90deg, rgba(120,80,255,0.8), rgba(200,140,255,0.9))",
          boxShadow: "0 0 8px rgba(160, 100, 255, 0.6)",
        }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.1, ease: "linear" }}
      />
    </div>
  );
}

export default function Clock() {
  const [time, setTime] = useState<TimeState | null>(null);
  const [shakeSignal, setShakeSignal] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const shakeCtrl = useAnimationControls();

  /* ── 3-D mouse parallax ─────────────────────────────────── */
  const { normX, normY } = useMouseParallax();

  /* Map normalised mouse coords to rotation angles */
  const rotateY = useTransform(normX, (x) => x * 16);
  const rotateX = useTransform(normY, (y) => y * -10);

  /* Shift the specular highlight on the glass panel */
  const lightX = useTransform(normX, (x) => 50 + x * 20);
  const lightY = useTransform(normY, (y) => 50 + y * 20);

  /* Moving specular gradient — derived from lightX / lightY */
  const specularBg = useTransform(
    [lightX, lightY],
    ([lx, ly]: number[]) =>
      `radial-gradient(ellipse 60% 50% at ${lx}% ${ly}%, rgba(255,255,255,0.09) 0%, transparent 70%)`
  );

  useEffect(() => {
    setTime(getTime());
    const interval = setInterval(() => setTime(getTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClockClick = useCallback(async () => {
    setShakeSignal((s) => s + 1);
    await shakeCtrl.start({
      x: [0, -12, 12, -9, 9, -6, 6, -3, 3, 0],
      transition: { duration: 0.55, ease: "easeOut" },
    });
    shakeCtrl.set({ x: 0 });
  }, [shakeCtrl]);

  if (!time) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-16 h-16 rounded-full border-2 border-purple-400/30 border-t-purple-400"
          style={{ animation: "spin 1s linear infinite" }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-8 py-12 gap-10">
      {/* Day */}
      <motion.div
        className="liquid-glass-inner px-12 py-5 text-center"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
      >
        <p
          className="shimmer-text font-semibold"
          style={{
            fontSize: "clamp(0.9rem, 2.5vw, 1.2rem)",
            letterSpacing: "0.15em",
            transform: "translateZ(6px)",
          }}
        >
          {time.dayOfWeek.charAt(0).toUpperCase() + time.dayOfWeek.slice(1)}
        </p>
      </motion.div>

      {/* Main clock container — click to shake off slime */}
      <motion.div
        animate={shakeCtrl}
        style={{ position: "relative", cursor: "pointer" }}
        onClick={handleClockClick}
        title="Klikni pro setřesení slizu"
      >
        {/*
         * Outer wrapper sets the 3-D perspective context.
         * Inner panel receives rotateX/Y from mouse + a dynamic
         * specular highlight that follows the "light source".
         */}
        <motion.div
          style={{
            perspective: "1400px",
            perspectiveOrigin: "50% 50%",
          }}
        >
          <motion.div
            ref={panelRef}
            className="liquid-glass p-10 md:p-16"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              opacity: { duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.1 },
              scale: { duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.1 },
            }}
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
              /* Dynamic box-shadow shifts to simulate point-light reflection */
              boxShadow: [
                "0 30px 80px rgba(0,0,0,0.55)",
                "0 10px 30px rgba(0,0,0,0.4)",
                "inset 0 1px 0 rgba(255,255,255,0.18)",
                "inset 0 -1px 0 rgba(0,0,0,0.25)",
                "0 0 0 0.5px rgba(255,255,255,0.07)",
              ].join(", "),
            }}
          >
            {/* Moving specular highlight — follows mouse */}
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-[2rem]"
              style={{
                background: specularBg,
                zIndex: 1,
              }}
            />

            {/* Time display */}
            <div
              className="flex items-end gap-2 md:gap-4"
              style={{ position: "relative", zIndex: 2 }}
            >
              <AnimatedDigit value={time.hours} label="hod" />
              <Colon />
              <AnimatedDigit value={time.minutes} label="min" />
              <Colon />
              <AnimatedDigit value={time.seconds} label="sek" />
            </div>

            {/* Progress bars */}
            <div
              className="mt-8 flex flex-col gap-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "1rem",
                padding: "1rem 1.25rem",
                position: "relative",
                zIndex: 2,
                transform: "translateZ(10px)",
              }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="text-white/50 uppercase tracking-widest font-semibold w-6 text-center"
                  style={{ fontSize: "0.65rem", letterSpacing: "0.2em" }}
                >
                  H
                </span>
                <ProgressBar value={parseInt(time.hours)} max={23} />
                <span
                  className="text-white/30 tabular-nums text-right"
                  style={{ fontSize: "0.65rem", minWidth: "1.8rem" }}
                >
                  {time.hours}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="text-white/50 uppercase tracking-widest font-semibold w-6 text-center"
                  style={{ fontSize: "0.65rem", letterSpacing: "0.2em" }}
                >
                  M
                </span>
                <ProgressBar value={parseInt(time.minutes)} max={59} />
                <span
                  className="text-white/30 tabular-nums text-right"
                  style={{ fontSize: "0.65rem", minWidth: "1.8rem" }}
                >
                  {time.minutes}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="text-white/50 uppercase tracking-widest font-semibold w-6 text-center"
                  style={{ fontSize: "0.65rem", letterSpacing: "0.2em" }}
                >
                  S
                </span>
                <ProgressBar value={parseInt(time.seconds)} max={59} />
                <span
                  className="text-white/30 tabular-nums text-right"
                  style={{ fontSize: "0.65rem", minWidth: "1.8rem" }}
                >
                  {time.seconds}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <SlimeJumper
          panelRef={panelRef}
          second={parseInt(time.seconds)}
          shakeSignal={shakeSignal}
        />
      </motion.div>

      {/* Date */}
      <motion.div
        className="liquid-glass-inner px-12 py-5 text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
        style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
      >
        <p
          className="text-white/60 font-light"
          style={{
            fontSize: "clamp(0.85rem, 2vw, 1rem)",
            letterSpacing: "0.08em",
            transform: "translateZ(6px)",
          }}
        >
          {time.date}
        </p>
      </motion.div>

      {/* Timezone */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="text-white/25 text-xs tracking-widest uppercase"
      >
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </motion.div>

      {/* Subtle reflection */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
        }}
      />
    </div>
  );
}
