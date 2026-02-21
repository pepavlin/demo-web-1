"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
}

const DOT_COLORS = [
  { dot: "rgba(168, 85, 247, 0.9)", glow: "rgba(168, 85, 247, 0.4)" },
  { dot: "rgba(99, 102, 241, 0.9)", glow: "rgba(99, 102, 241, 0.4)" },
  { dot: "rgba(59, 130, 246, 0.9)", glow: "rgba(59, 130, 246, 0.4)" },
  { dot: "rgba(0, 200, 255, 0.85)", glow: "rgba(0, 200, 255, 0.35)" },
  { dot: "rgba(236, 72, 153, 0.8)", glow: "rgba(236, 72, 153, 0.3)" },
  { dot: "rgba(255, 255, 255, 0.75)", glow: "rgba(255, 255, 255, 0.25)" },
];

const PARTICLE_COUNT = 180;
const CONNECTION_DISTANCE = 120;
const MAX_LINE_OPACITY = 0.45;
const SPEED = 0.4;
const MAX_SPEED = 3;
// Mouse influence — only affects particles within MOUSE_RADIUS, force = K / distance
const MOUSE_RADIUS = 160;        // max distance at which mouse affects particles
const GRAVITY_K_ATTRACT = 3;    // attract constant (default, no click) — reduced so own movement persists
const GRAVITY_K_REPEL = 6;      // repel constant (mouse held down)
const MIN_DIST = 20;             // prevent infinite force at zero distance
// Particle-to-particle repulsion — gentle push so dots spread out naturally
const PARTICLE_REPEL_RADIUS = 60;  // distance within which particles repel each other
const PARTICLE_REPEL_K = 0.8;      // repulsion strength (gentle)

function createParticle(w: number, h: number): Particle {
  const colorEntry = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
  const angle = Math.random() * Math.PI * 2;
  const speed = SPEED * (0.5 + Math.random() * 1.0);
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: Math.random() * 1.5 + 1.0,
    color: colorEntry.dot,
    glowColor: colorEntry.glow,
  };
}

function parseRgba(color: string): { r: number; g: number; b: number } {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: +m[1], g: +m[2], b: +m[3] };
}

export default function GeometricParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const isClickingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(canvas.width, canvas.height)
    );

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouseRef.current = null;
    };
    const onMouseDown = () => {
      isClickingRef.current = true;
    };
    const onMouseUp = () => {
      isClickingRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    // Reusable force accumulator buffers — allocated once to avoid GC pressure
    const forceX = new Float32Array(PARTICLE_COUNT);
    const forceY = new Float32Array(PARTICLE_COUNT);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const clicking = isClickingRef.current;

      // Compute inter-particle repulsion forces (O(n²) over close pairs only)
      forceX.fill(0);
      forceY.fill(0);
      const repelRadiusSq = PARTICLE_REPEL_RADIUS * PARTICLE_REPEL_RADIUS;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 0 && distSq < repelRadiusSq) {
            const dist = Math.sqrt(distSq);
            const effectiveDist = Math.max(dist, MIN_DIST);
            const falloff = 1 - dist / PARTICLE_REPEL_RADIUS;
            const strength = (PARTICLE_REPEL_K / effectiveDist) * falloff;
            const nx = dx / dist;
            const ny = dy / dist;
            // Equal and opposite forces
            forceX[i] += nx * strength;
            forceY[i] += ny * strength;
            forceX[j] -= nx * strength;
            forceY[j] -= ny * strength;
          }
        }
      }

      // Update positions
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Apply accumulated inter-particle repulsion
        p.vx += forceX[i];
        p.vy += forceY[i];

        // Apply mouse force only within MOUSE_RADIUS — own movement persists beyond that
        if (mouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0 && dist < MOUSE_RADIUS) {
            const effectiveDist = Math.max(dist, MIN_DIST);
            // Fade influence near the edge of the radius for smooth transition
            const falloff = 1 - dist / MOUSE_RADIUS;
            if (clicking) {
              // Repel: push away from mouse on click
              const strength = (GRAVITY_K_REPEL / effectiveDist) * falloff;
              p.vx += (dx / dist) * strength;
              p.vy += (dy / dist) * strength;
            } else {
              // Attract: pull towards mouse by default
              const strength = (GRAVITY_K_ATTRACT / effectiveDist) * falloff;
              p.vx -= (dx / dist) * strength;
              p.vy -= (dy / dist) * strength;
            }
          }
        }

        // Clamp speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }

        // Gradually dampen speed towards natural base (friction) — stronger so own velocity recovers quicker
        if (speed > SPEED * 0.9) {
          p.vx *= 0.98;
          p.vy *= 0.98;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) {
          p.x = 0;
          p.vx = Math.abs(p.vx);
        } else if (p.x > w) {
          p.x = w;
          p.vx = -Math.abs(p.vx);
        }
        if (p.y < 0) {
          p.y = 0;
          p.vy = Math.abs(p.vy);
        } else if (p.y > h) {
          p.y = h;
          p.vy = -Math.abs(p.vy);
        }
      }

      // Draw lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const opacity = (1 - dist / CONNECTION_DISTANCE) * MAX_LINE_OPACITY;
            const ca = parseRgba(a.color);
            const cb = parseRgba(b.color);
            const r = Math.round((ca.r + cb.r) / 2);
            const g = Math.round((ca.g + cb.g) / 2);
            const b2 = Math.round((ca.b + cb.b) / 2);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${r},${g},${b2},${opacity.toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (const p of particles) {
        // Glow halo
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.radius * 5
        );
        gradient.addColorStop(0, p.glowColor);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="geometric-particles-canvas"
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.75 }}
    />
  );
}
