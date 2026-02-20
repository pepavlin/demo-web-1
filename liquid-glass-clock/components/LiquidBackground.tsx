"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  color: string;
}

const PARTICLE_COLORS = [
  "rgba(139, 92, 246, 0.6)",
  "rgba(99, 102, 241, 0.5)",
  "rgba(59, 130, 246, 0.5)",
  "rgba(168, 85, 247, 0.4)",
  "rgba(236, 72, 153, 0.3)",
  "rgba(255, 255, 255, 0.3)",
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 4 + 1,
    duration: Math.random() * 12 + 6,
    delay: Math.random() * 8,
    drift: (Math.random() - 0.5) * 200,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  }));
}

export default function LiquidBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(generateParticles(25));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Deep space gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, #1a0533 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #0d1b4b 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, #0a0a2e 0%, transparent 60%), #060612",
        }}
      />

      {/* Animated blobs */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "600px",
          height: "600px",
          top: "10%",
          left: "15%",
          background:
            "radial-gradient(circle, rgba(120, 40, 200, 0.35) 0%, rgba(80, 20, 160, 0.15) 50%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          x: [0, 80, -40, 60, 0],
          y: [0, -60, 80, 40, 0],
          scale: [1, 1.15, 0.9, 1.05, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{
          width: "500px",
          height: "500px",
          bottom: "15%",
          right: "10%",
          background:
            "radial-gradient(circle, rgba(40, 80, 220, 0.35) 0%, rgba(20, 50, 180, 0.15) 50%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          x: [0, -70, 50, -40, 0],
          y: [0, 50, -70, 30, 0],
          scale: [1, 1.2, 0.85, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{
          width: "400px",
          height: "400px",
          top: "40%",
          right: "25%",
          background:
            "radial-gradient(circle, rgba(200, 40, 120, 0.2) 0%, rgba(160, 20, 80, 0.08) 50%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{
          x: [0, 60, -50, 30, 0],
          y: [0, -40, 60, -30, 0],
          scale: [1, 0.9, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 6,
        }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{
          width: "350px",
          height: "350px",
          top: "60%",
          left: "30%",
          background:
            "radial-gradient(circle, rgba(60, 160, 255, 0.2) 0%, rgba(30, 100, 200, 0.08) 50%, transparent 70%)",
          filter: "blur(45px)",
        }}
        animate={{
          x: [0, -50, 70, -20, 0],
          y: [0, 60, -40, 50, 0],
          scale: [1, 1.1, 0.92, 1.08, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 10,
        }}
      />

      {/* Center ambient glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "800px",
          height: "400px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(ellipse, rgba(100, 60, 200, 0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          scale: [1, 1.1, 0.95, 1.05, 1],
          opacity: [0.7, 1, 0.8, 0.9, 0.7],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Particles — rendered only on client to avoid hydration mismatch */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={
            {
              left: `${p.x}%`,
              bottom: "-10px",
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              "--duration": `${p.duration}s`,
              "--delay": `${p.delay}s`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Noise texture */}
      <div className="noise-overlay" />
    </div>
  );
}
