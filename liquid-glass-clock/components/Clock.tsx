"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import SlimeJumper from "./SlimeJumper";

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
      <div className="digit-glass relative flex items-center justify-center px-6 py-4 md:px-8 md:py-6">
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
              textShadow:
                "0 0 40px rgba(180, 140, 255, 0.5), 0 0 80px rgba(120, 80, 255, 0.2), 0 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      {label && (
        <span
          className="text-white/40 uppercase tracking-widest"
          style={{ fontSize: "0.6rem", letterSpacing: "0.3em" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function Colon() {
  return (
    <div
      className="colon-blink flex flex-col justify-center gap-3 pb-6 md:pb-10 self-center"
      style={{ marginTop: "-8px" }}
    >
      <div
        className="rounded-full bg-white/70"
        style={{
          width: "clamp(6px, 1.2vw, 12px)",
          height: "clamp(6px, 1.2vw, 12px)",
          boxShadow: "0 0 12px rgba(180, 140, 255, 0.8)",
        }}
      />
      <div
        className="rounded-full bg-white/70"
        style={{
          width: "clamp(6px, 1.2vw, 12px)",
          height: "clamp(6px, 1.2vw, 12px)",
          boxShadow: "0 0 12px rgba(180, 140, 255, 0.8)",
        }}
      />
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
  const [time, setTime]             = useState<TimeState | null>(null);
  const [shakeSignal, setShakeSignal] = useState(0);
  const panelRef    = useRef<HTMLDivElement>(null);
  const shakeCtrl   = useAnimationControls();

  useEffect(() => {
    setTime(getTime());
    const interval = setInterval(() => setTime(getTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClockClick = useCallback(async () => {
    setShakeSignal(s => s + 1);
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
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4 py-8 gap-8">
      {/* Day */}
      <motion.div
        className="liquid-glass-inner px-8 py-3 text-center"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
      >
        <p
          className="shimmer-text font-semibold"
          style={{ fontSize: "clamp(0.9rem, 2.5vw, 1.2rem)", letterSpacing: "0.15em" }}
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
        <motion.div
          ref={panelRef}
          className="liquid-glass p-6 md:p-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
        >
          {/* Time display */}
          <div className="flex items-end gap-2 md:gap-4">
            <AnimatedDigit value={time.hours} label="hod" />
            <Colon />
            <AnimatedDigit value={time.minutes} label="min" />
            <Colon />
            <AnimatedDigit value={time.seconds} label="sek" />
          </div>

          {/* Progress bars */}
          <div className="mt-6 flex flex-col gap-2 px-1">
            <div className="flex items-center gap-3">
              <span className="text-white/30 text-xs uppercase tracking-widest w-8">H</span>
              <ProgressBar value={parseInt(time.hours)} max={23} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/30 text-xs uppercase tracking-widest w-8">M</span>
              <ProgressBar value={parseInt(time.minutes)} max={59} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/30 text-xs uppercase tracking-widest w-8">S</span>
              <ProgressBar value={parseInt(time.seconds)} max={59} />
            </div>
          </div>
        </motion.div>

        <SlimeJumper
          panelRef={panelRef}
          second={parseInt(time.seconds)}
          shakeSignal={shakeSignal}
        />
      </motion.div>

      {/* Date */}
      <motion.div
        className="liquid-glass-inner px-8 py-3 text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
      >
        <p
          className="text-white/60 font-light"
          style={{ fontSize: "clamp(0.85rem, 2vw, 1rem)", letterSpacing: "0.08em" }}
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
