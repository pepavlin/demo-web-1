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
  /** Depth layer: -1 = far back, +1 = close to viewer */
  z: number;
  /** Z drift speed */
  vz: number;
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
const MOUSE_RADIUS = 160;
const GRAVITY_K_ATTRACT = 3;
const GRAVITY_K_REPEL = 6;
const MIN_DIST = 20;
const PARTICLE_REPEL_RADIUS = 60;
const PARTICLE_REPEL_K = 0.8;

/** Max canvas tilt angle driven by mouse (degrees) */
const MAX_TILT_DEG = 8;

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
    /* Random depth; near particles rendered larger / brighter */
    z: Math.random() * 2 - 1,
    vz: (Math.random() - 0.5) * 0.002,
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

  /* Smoothed tilt values driven by mouse (deg) */
  const tiltXRef = useRef(0); // rotateY (left-right)
  const tiltYRef = useRef(0); // rotateX (up-down)
  const smoothTiltXRef = useRef(0);
  const smoothTiltYRef = useRef(0);

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
      /* Update target tilt from normalised mouse position */
      tiltXRef.current = ((e.clientX / window.innerWidth) * 2 - 1) * MAX_TILT_DEG;
      tiltYRef.current = ((e.clientY / window.innerHeight) * 2 - 1) * -MAX_TILT_DEG;
    };
    const onMouseLeave = () => {
      mouseRef.current = null;
      tiltXRef.current = 0;
      tiltYRef.current = 0;
    };
    const onMouseDown = () => { isClickingRef.current = true; };
    const onMouseUp   = () => { isClickingRef.current = false; };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    const forceX = new Float32Array(PARTICLE_COUNT);
    const forceY = new Float32Array(PARTICLE_COUNT);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const clicking = isClickingRef.current;

      /* ── Lerp tilt toward target ──────────────────────────────────── */
      const lerpFactor = 0.04;
      smoothTiltXRef.current += (tiltXRef.current - smoothTiltXRef.current) * lerpFactor;
      smoothTiltYRef.current += (tiltYRef.current - smoothTiltYRef.current) * lerpFactor;

      /* Apply CSS 3-D transform to the canvas element */
      canvas.style.transform =
        `perspective(900px) ` +
        `rotateX(${smoothTiltYRef.current.toFixed(3)}deg) ` +
        `rotateY(${smoothTiltXRef.current.toFixed(3)}deg)`;

      /* ── Inter-particle repulsion ─────────────────────────────────── */
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
            forceX[i] += nx * strength;
            forceY[i] += ny * strength;
            forceX[j] -= nx * strength;
            forceY[j] -= ny * strength;
          }
        }
      }

      /* ── Update positions ─────────────────────────────────────────── */
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.vx += forceX[i];
        p.vy += forceY[i];

        if (mouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0 && dist < MOUSE_RADIUS) {
            const effectiveDist = Math.max(dist, MIN_DIST);
            const falloff = 1 - dist / MOUSE_RADIUS;
            if (clicking) {
              const strength = (GRAVITY_K_REPEL / effectiveDist) * falloff;
              p.vx += (dx / dist) * strength;
              p.vy += (dy / dist) * strength;
            } else {
              const strength = (GRAVITY_K_ATTRACT / effectiveDist) * falloff;
              p.vx -= (dx / dist) * strength;
              p.vy -= (dy / dist) * strength;
            }
          }
        }

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }
        if (speed > SPEED * 0.9) {
          p.vx *= 0.98;
          p.vy *= 0.98;
        }

        p.x += p.vx;
        p.y += p.vy;

        /* Slowly oscillate Z depth so particles drift toward / away */
        p.z += p.vz;
        if (p.z > 1) { p.z = 1; p.vz = -Math.abs(p.vz); }
        if (p.z < -1) { p.z = -1; p.vz = Math.abs(p.vz); }

        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        else if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
        else if (p.y > h) { p.y = h; p.vy = -Math.abs(p.vy); }
      }

      /* ── Draw lines ───────────────────────────────────────────────── */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            /* Fade lines for far-back particles */
            const avgZ = (a.z + b.z) / 2;
            const depthFade = (avgZ + 1) / 2; // 0 (far) .. 1 (near)
            const opacity =
              (1 - dist / CONNECTION_DISTANCE) * MAX_LINE_OPACITY * (0.3 + depthFade * 0.7);
            const ca = parseRgba(a.color);
            const cb = parseRgba(b.color);
            const r = Math.round((ca.r + cb.r) / 2);
            const g = Math.round((ca.g + cb.g) / 2);
            const b2 = Math.round((ca.b + cb.b) / 2);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${r},${g},${b2},${opacity.toFixed(3)})`;
            ctx.lineWidth = 0.5 + depthFade * 0.6;
            ctx.stroke();
          }
        }
      }

      /* ── Draw dots — sorted back-to-front so near dots overdraw far ones ── */
      const sorted = [...particles].sort((a, b) => a.z - b.z);

      for (const p of sorted) {
        /* Scale both size and brightness by depth */
        const depthScale = (p.z + 2) / 2; // 0.5 (far) .. 1.5 (near)
        const drawRadius = p.radius * depthScale;

        /* Glow halo */
        const glowRadius = drawRadius * 5;
        const gradient = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, glowRadius
        );
        gradient.addColorStop(0, p.glowColor);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.3 + depthScale * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;

        /* Core dot — near dots get a small highlight circle for sphere look */
        ctx.beginPath();
        ctx.arc(p.x, p.y, drawRadius, 0, Math.PI * 2);

        if (depthScale > 1.1) {
          /* Near particle: radial gradient for 3-D sphere illusion */
          const sphereGrad = ctx.createRadialGradient(
            p.x - drawRadius * 0.3,
            p.y - drawRadius * 0.3,
            0,
            p.x, p.y, drawRadius
          );
          const { r, g, b: bv } = parseRgba(p.color);
          sphereGrad.addColorStop(0, `rgba(255,255,255,0.9)`);
          sphereGrad.addColorStop(0.3, p.color);
          sphereGrad.addColorStop(1, `rgba(${Math.round(r * 0.4)},${Math.round(g * 0.4)},${Math.round(bv * 0.4)},0.8)`);
          ctx.fillStyle = sphereGrad;
        } else {
          ctx.fillStyle = p.color;
        }
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
      className="absolute inset-0 pointer-events-none color-cycle-canvas"
      style={{
        opacity: 0.75,
        transformOrigin: "50% 50%",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    />
  );
}
