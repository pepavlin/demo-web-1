"use client";

import { useEffect, useRef } from "react";

interface Particle {
  /** World space 3D position – centred at origin in a ±WORLD_SIZE cube */
  wx: number;
  wy: number;
  wz: number;
  /** World space 3D velocity */
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  glowColor: string;
}

const DOT_COLORS = [
  { dot: "rgba(168, 85, 247, 0.9)",  glow: "rgba(168, 85, 247, 0.4)" },
  { dot: "rgba(99, 102, 241, 0.9)",  glow: "rgba(99, 102, 241, 0.4)" },
  { dot: "rgba(59, 130, 246, 0.9)",  glow: "rgba(59, 130, 246, 0.4)" },
  { dot: "rgba(0, 200, 255, 0.85)",  glow: "rgba(0, 200, 255, 0.35)" },
  { dot: "rgba(236, 72, 153, 0.8)",  glow: "rgba(236, 72, 153, 0.3)" },
  { dot: "rgba(255, 255, 255, 0.75)", glow: "rgba(255, 255, 255, 0.25)" },
];

const PARTICLE_COUNT      = 250;
const WORLD_SIZE          = 450;   // Half-size of the 3-D world cube
const CAMERA_DIST         = 800;   // Camera sits at z = -CAMERA_DIST looking toward +z
const FOV                 = 550;   // Perspective focal length (pixels)
const NEAR_CLIP           = 100;   // Discard geometry closer than this to camera
const CONNECTION_DIST_3D  = 175;   // 3-D distance threshold for connecting lines
const MAX_LINE_OPACITY    = 0.45;
const PARTICLE_SPEED      = 0.35;
const MAX_CAMERA_ROT      = 0.45;  // Maximum camera rotation in radians (~26°)
const PARTICLE_WORLD_R    = 3.5;   // Physical particle radius in world units

function createParticle(): Particle {
  const colorEntry = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
  // Uniform random direction on the unit sphere
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const speed = PARTICLE_SPEED * (0.5 + Math.random() * 0.8);
  return {
    wx: (Math.random() - 0.5) * WORLD_SIZE * 2,
    wy: (Math.random() - 0.5) * WORLD_SIZE * 2,
    wz: (Math.random() - 0.5) * WORLD_SIZE * 2,
    vx: Math.sin(phi) * Math.cos(theta) * speed,
    vy: Math.cos(phi) * speed,
    vz: Math.sin(phi) * Math.sin(theta) * speed,
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
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef      = useRef<number>(0);

  /** Target camera angles driven by mouse (radians) */
  const targetRotYRef = useRef(0);  // yaw   – left / right
  const targetRotXRef = useRef(0);  // pitch – up   / down

  /** Smoothed camera angles */
  const camRotYRef = useRef(0);
  const camRotXRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle());

    const onMouseMove = (e: MouseEvent) => {
      // Map mouse position to camera rotation angles
      targetRotYRef.current = ((e.clientX / window.innerWidth)  * 2 - 1) *  MAX_CAMERA_ROT;
      targetRotXRef.current = ((e.clientY / window.innerHeight) * 2 - 1) * -MAX_CAMERA_ROT;
    };
    const onMouseLeave = () => {
      targetRotYRef.current = 0;
      targetRotXRef.current = 0;
    };
    const onMouseDown = () => { /* reserved for future interaction */ };
    const onMouseUp   = () => { /* reserved for future interaction */ };

    window.addEventListener("mousemove",  onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown",  onMouseDown);
    window.addEventListener("mouseup",    onMouseUp);

    // ─── Perspective projection ──────────────────────────────────────────────
    // Camera sits at (0, 0, -CAMERA_DIST) looking along +z.
    // Mouse drives yaw (rotY) and pitch (rotX) of the camera.
    // We apply the inverse camera rotation to each world point, then project.
    //
    //   Step 1 – translate to camera space:        tz = wz + CAMERA_DIST
    //   Step 2 – yaw   R_Y(−rotY):   rx1 = wx·cosY − tz·sinY
    //                                rz1 = wx·sinY + tz·cosY
    //   Step 3 – pitch R_X(+rotX):   ry  = wy·cosX − rz1·sinX
    //                                rz2 = wy·sinX + rz1·cosX
    //   Step 4 – perspective divide: sx = w/2 + rx1·(FOV/rz2)
    //                                sy = h/2 − ry ·(FOV/rz2)

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      // Smooth camera rotation toward target
      const lerp = 0.04;
      camRotYRef.current += (targetRotYRef.current - camRotYRef.current) * lerp;
      camRotXRef.current += (targetRotXRef.current - camRotXRef.current) * lerp;

      const cosY = Math.cos(camRotYRef.current);
      const sinY = Math.sin(camRotYRef.current);
      const cosX = Math.cos(camRotXRef.current);
      const sinX = Math.sin(camRotXRef.current);

      const project = (wx: number, wy: number, wz: number) => {
        const tz  = wz + CAMERA_DIST;
        const rx1 = wx * cosY - tz  * sinY;
        const rz1 = wx * sinY + tz  * cosY;
        const ry  = wy * cosX - rz1 * sinX;
        const rz2 = wy * sinX + rz1 * cosX;
        if (rz2 < NEAR_CLIP) return null;
        const scale = FOV / rz2;
        return { sx: w / 2 + rx1 * scale, sy: h / 2 - ry * scale, depth: rz2, scale };
      };

      // ── Update world positions ───────────────────────────────────────────
      for (const p of particles) {
        p.wx += p.vx;
        p.wy += p.vy;
        p.wz += p.vz;
        if (p.wx >  WORLD_SIZE) { p.wx =  WORLD_SIZE; p.vx = -Math.abs(p.vx); }
        if (p.wx < -WORLD_SIZE) { p.wx = -WORLD_SIZE; p.vx =  Math.abs(p.vx); }
        if (p.wy >  WORLD_SIZE) { p.wy =  WORLD_SIZE; p.vy = -Math.abs(p.vy); }
        if (p.wy < -WORLD_SIZE) { p.wy = -WORLD_SIZE; p.vy =  Math.abs(p.vy); }
        if (p.wz >  WORLD_SIZE) { p.wz =  WORLD_SIZE; p.vz = -Math.abs(p.vz); }
        if (p.wz < -WORLD_SIZE) { p.wz = -WORLD_SIZE; p.vz =  Math.abs(p.vz); }
      }

      // ── Project all particles ────────────────────────────────────────────
      const projected = particles.map((p) => ({ p, proj: project(p.wx, p.wy, p.wz) }));

      const maxDepth = CAMERA_DIST + WORLD_SIZE; // furthest possible depth

      // ── Draw connecting lines (3-D distance check) ───────────────────────
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        if (!a.proj) continue;
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j];
          if (!b.proj) continue;
          const dx = a.p.wx - b.p.wx;
          const dy = a.p.wy - b.p.wy;
          const dz = a.p.wz - b.p.wz;
          const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist3d >= CONNECTION_DIST_3D) continue;

          const avgDepth  = (a.proj.depth + b.proj.depth) / 2;
          const depthFade = Math.max(0, 1 - (avgDepth - NEAR_CLIP) / (maxDepth - NEAR_CLIP));
          const opacity   = (1 - dist3d / CONNECTION_DIST_3D) * MAX_LINE_OPACITY * (0.3 + depthFade * 0.7);

          const ca = parseRgba(a.p.color);
          const cb = parseRgba(b.p.color);
          ctx.beginPath();
          ctx.moveTo(a.proj.sx, a.proj.sy);
          ctx.lineTo(b.proj.sx, b.proj.sy);
          ctx.strokeStyle = `rgba(${Math.round((ca.r + cb.r) / 2)},${Math.round((ca.g + cb.g) / 2)},${Math.round((ca.b + cb.b) / 2)},${opacity.toFixed(3)})`;
          ctx.lineWidth   = Math.max(0.3, depthFade * 1.2);
          ctx.stroke();
        }
      }

      // ── Draw dots – sorted back-to-front so near dots overdraw far ones ──
      const visible = projected
        .filter((item) => item.proj !== null)
        .sort((a, b) => b.proj!.depth - a.proj!.depth);

      for (const { p, proj } of visible) {
        if (!proj) continue;
        const { sx, sy, depth, scale } = proj;
        const drawRadius = Math.max(0.5, Math.min(8, PARTICLE_WORLD_R * scale));
        const depthFade  = Math.max(0, 1 - (depth - NEAR_CLIP) / (maxDepth - NEAR_CLIP));

        // Glow halo
        const glowRadius = drawRadius * 5;
        if (glowRadius > 1) {
          const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
          gradient.addColorStop(0, p.glowColor);
          gradient.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle  = gradient;
          ctx.globalAlpha = depthFade * 0.6;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Core dot – near particles get a sphere-shading gradient
        ctx.beginPath();
        ctx.arc(sx, sy, drawRadius, 0, Math.PI * 2);
        if (depthFade > 0.5) {
          const sphereGrad = ctx.createRadialGradient(
            sx - drawRadius * 0.3, sy - drawRadius * 0.3, 0,
            sx, sy, drawRadius
          );
          const { r, g, b: bv } = parseRgba(p.color);
          sphereGrad.addColorStop(0, "rgba(255,255,255,0.9)");
          sphereGrad.addColorStop(0.3, p.color);
          sphereGrad.addColorStop(1, `rgba(${Math.round(r * 0.4)},${Math.round(g * 0.4)},${Math.round(bv * 0.4)},0.8)`);
          ctx.fillStyle = sphereGrad;
        } else {
          ctx.fillStyle = p.color;
        }
        ctx.globalAlpha = Math.max(0.15, depthFade);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize",     resize);
      window.removeEventListener("mousemove",  onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown",  onMouseDown);
      window.removeEventListener("mouseup",    onMouseUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="geometric-particles-canvas"
      className="absolute inset-0 pointer-events-none color-cycle-canvas"
      style={{ opacity: 0.75 }}
    />
  );
}
