"use client";

import { useTransform } from "framer-motion";
import { motion } from "framer-motion";
import GeometricParticles from "./GeometricParticles";
import { useMouseParallax } from "@/hooks/useMouseParallax";

export default function LiquidBackground() {
  const { normX, normY } = useMouseParallax();

  /* Subtle perspective tilt of the whole background */
  const bgRotateX = useTransform(normY, (y) => y * -4);
  const bgRotateY = useTransform(normX, (x) => x * 4);

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{
        perspective: "1200px",
        perspectiveOrigin: "50% 50%",
        rotateX: bgRotateX,
        rotateY: bgRotateY,
        transformStyle: "preserve-3d",
      }}
    >
      {/* ── Theme gradient layers ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 theme-bg-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, #1a0533 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0d1b4b 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, #0a0a2e 0%, transparent 60%), #060612",
        }}
      />
      <div
        className="absolute inset-0 theme-bg-1"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, #003355 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #001a44 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, #001628 0%, transparent 60%), #01090e",
          opacity: 0,
        }}
      />
      <div
        className="absolute inset-0 theme-bg-2"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, #003310 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #001a08 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, #001a00 0%, transparent 60%), #010d03",
          opacity: 0,
        }}
      />
      <div
        className="absolute inset-0 theme-bg-3"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, #330005 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #2a0800 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, #1a0200 0%, transparent 60%), #0e0102",
          opacity: 0,
        }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Geometric particle network */}
      <GeometricParticles />

      {/* Noise texture */}
      <div className="noise-overlay" />
    </motion.div>
  );
}
