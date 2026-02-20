"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import GeometricParticles from "./GeometricParticles";

interface RisingParticle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  color: string;
}

interface TwinkleStar {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  glow: number;
  color: string;
}

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  length: number;
  duration: number;
  delay: number;
  shootX: number;
  shootY: number;
  color: string;
}

interface PulseOrb {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

interface EnergySpark {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  sparkY: number;
  color: string;
}

const PARTICLE_COLORS = [
  "rgba(139, 92, 246, 0.7)",
  "rgba(99, 102, 241, 0.6)",
  "rgba(59, 130, 246, 0.6)",
  "rgba(168, 85, 247, 0.5)",
  "rgba(236, 72, 153, 0.4)",
  "rgba(255, 255, 255, 0.35)",
  "rgba(0, 200, 255, 0.45)",
  "rgba(100, 255, 200, 0.3)",
];

const STAR_COLORS = [
  "rgba(255, 255, 255, 0.95)",
  "rgba(210, 190, 255, 0.9)",
  "rgba(190, 210, 255, 0.85)",
  "rgba(255, 230, 230, 0.8)",
  "rgba(210, 250, 255, 0.85)",
];

const SHOOT_COLORS = [
  "rgba(255, 255, 255, 0.95)",
  "rgba(180, 210, 255, 0.9)",
  "rgba(210, 170, 255, 0.9)",
];

const SPARK_COLORS = [
  "rgba(255, 200, 100, 0.9)",
  "rgba(200, 150, 255, 0.9)",
  "rgba(100, 220, 255, 0.9)",
  "rgba(255, 100, 180, 0.8)",
];

function generateRisingParticles(count: number): RisingParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 5 + 1,
    duration: Math.random() * 14 + 6,
    delay: Math.random() * 12,
    drift: (Math.random() - 0.5) * 260,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  }));
}

function generateTwinkleStars(count: number): TwinkleStar[] {
  return Array.from({ length: count }, (_, i) => ({
    id: 1000 + i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    duration: Math.random() * 5 + 2,
    delay: Math.random() * 10,
    glow: Math.random() * 5 + 2,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  }));
}

function generateShootingStars(count: number): ShootingStar[] {
  return Array.from({ length: count }, (_, i) => ({
    id: 2000 + i,
    x: Math.random() * 70 + 15,
    y: Math.random() * 55 + 5,
    length: Math.random() * 100 + 70,
    duration: Math.random() * 1.2 + 0.7,
    delay: Math.random() * 30 + i * 6,
    shootX: -(Math.random() * 180 + 120),
    shootY: Math.random() * 110 + 60,
    color: SHOOT_COLORS[Math.floor(Math.random() * SHOOT_COLORS.length)],
  }));
}

function generatePulseOrbs(count: number): PulseOrb[] {
  return Array.from({ length: count }, (_, i) => ({
    id: 3000 + i,
    x: Math.random() * 90 + 5,
    y: Math.random() * 80 + 10,
    size: Math.random() * 10 + 6,
    duration: Math.random() * 7 + 4,
    delay: Math.random() * 12,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  }));
}

function generateEnergySparks(count: number): EnergySpark[] {
  return Array.from({ length: count }, (_, i) => ({
    id: 4000 + i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1.5,
    duration: Math.random() * 2 + 1.5,
    delay: Math.random() * 15,
    sparkY: -(Math.random() * 60 + 20),
    color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
  }));
}

export default function LiquidBackground() {
  const [risingParticles, setRisingParticles] = useState<RisingParticle[]>([]);
  const [twinkleStars, setTwinkleStars] = useState<TwinkleStar[]>([]);
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);
  const [pulseOrbs, setPulseOrbs] = useState<PulseOrb[]>([]);
  const [energySparks, setEnergySparks] = useState<EnergySpark[]>([]);

  useEffect(() => {
    setRisingParticles(generateRisingParticles(65));
    setTwinkleStars(generateTwinkleStars(110));
    setShootingStars(generateShootingStars(10));
    setPulseOrbs(generatePulseOrbs(20));
    setEnergySparks(generateEnergySparks(30));
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

      {/* Twinkling star field */}
      {twinkleStars.map((star) => (
        <div
          key={star.id}
          className="particle-twinkle"
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              background: star.color,
              "--duration": `${star.duration}s`,
              "--delay": `${star.delay}s`,
              "--glow": `${star.glow}px`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Shooting stars */}
      {shootingStars.map((ss) => (
        <div
          key={ss.id}
          className="particle-shoot"
          style={
            {
              left: `${ss.x}%`,
              top: `${ss.y}%`,
              width: `${ss.length}px`,
              background: `linear-gradient(90deg, transparent, ${ss.color}, transparent)`,
              "--duration": `${ss.duration}s`,
              "--delay": `${ss.delay}s`,
              "--shoot-x": `${ss.shootX}px`,
              "--shoot-y": `${ss.shootY}px`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Pulse orbs */}
      {pulseOrbs.map((orb) => (
        <div
          key={orb.id}
          className="particle-orb"
          style={
            {
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: `${orb.size}px`,
              height: `${orb.size}px`,
              background: orb.color,
              "--duration": `${orb.duration}s`,
              "--delay": `${orb.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Energy sparks */}
      {energySparks.map((spark) => (
        <div
          key={spark.id}
          className="particle-spark"
          style={
            {
              left: `${spark.x}%`,
              top: `${spark.y}%`,
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              background: spark.color,
              "--duration": `${spark.duration}s`,
              "--delay": `${spark.delay}s`,
              "--spark-y": `${spark.sparkY}px`,
            } as React.CSSProperties
          }
        />
      ))}

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

      {/* Extra blobs for richer depth */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "320px",
          height: "320px",
          top: "20%",
          right: "40%",
          background:
            "radial-gradient(circle, rgba(0, 200, 180, 0.18) 0%, rgba(0, 150, 140, 0.07) 50%, transparent 70%)",
          filter: "blur(55px)",
        }}
        animate={{
          x: [0, 50, -30, 40, 0],
          y: [0, 40, -55, 25, 0],
          scale: [1, 1.25, 0.88, 1.1, 1],
        }}
        transition={{
          duration: 27,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{
          width: "280px",
          height: "280px",
          bottom: "30%",
          left: "10%",
          background:
            "radial-gradient(circle, rgba(255, 150, 50, 0.15) 0%, rgba(200, 80, 20, 0.06) 50%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{
          x: [0, -40, 55, -30, 0],
          y: [0, -50, 35, -45, 0],
          scale: [1, 0.88, 1.18, 0.95, 1],
        }}
        transition={{
          duration: 23,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 14,
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

      {/* Rising particles */}
      {risingParticles.map((p) => (
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

      {/* Geometric particle network */}
      <GeometricParticles />

      {/* Noise texture */}
      <div className="noise-overlay" />
    </div>
  );
}
