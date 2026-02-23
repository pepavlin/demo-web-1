"use client";

import { useEffect, useRef } from "react";

interface Particle {
  /** World-space 3-D position – camera sits at (0,0,camZ) looking along +Z */
  wx: number;
  wy: number;
  wz: number;
  /** World-space 3-D velocity */
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  glowColor: string;
}

const DOT_COLORS = [
  { dot: "rgba(168, 85, 247, 0.9)",   glow: "rgba(168, 85, 247, 0.4)" },
  { dot: "rgba(99, 102, 241, 0.9)",   glow: "rgba(99, 102, 241, 0.4)" },
  { dot: "rgba(59, 130, 246, 0.9)",   glow: "rgba(59, 130, 246, 0.4)" },
  { dot: "rgba(0, 200, 255, 0.85)",   glow: "rgba(0, 200, 255, 0.35)" },
  { dot: "rgba(236, 72, 153, 0.8)",   glow: "rgba(236, 72, 153, 0.3)" },
  { dot: "rgba(255, 255, 255, 0.75)", glow: "rgba(255, 255, 255, 0.25)" },
];

// ─── Scene constants ─────────────────────────────────────────────────────────
const PARTICLE_COUNT     = 600;
const WORLD_SIZE         = 2200;  // Half-size of the world cube
const FOV_DEFAULT        = 650;   // Default focal length
const FOV_MIN            = 350;
const FOV_MAX            = 1400;
const NEAR_CLIP          = 18;    // Discard particles this close to camera
const CONNECTION_DIST_3D = 420;
const MAX_LINE_OPACITY   = 0.35;
const PARTICLE_SPEED     = 0.28;
const PARTICLE_WORLD_R   = 4.5;
const FOV_LERP           = 0.06;
const SCROLL_ZOOM_SPEED  = 80;
const BREATHE_AMPLITUDE  = 280;    // Camera moves ±280 world units along Z
const BREATHE_SPEED      = 0.00045; // Slow oscillation (~14 s per cycle at 60 fps)
const CAM_Z_LERP         = 0.018;   // Camera Z smoothing

// ─── Mouse attraction / repulsion constants ───────────────────────────────────
const MOUSE_INFLUENCE_R  = 200;   // Screen-space radius of mouse influence (px)
const ATTRACT_STRENGTH   = 0.022; // Acceleration per frame at max influence (attraction)
const REPULSE_STRENGTH   = 0.040; // Acceleration per frame at max influence (repulsion)
const MOUSE_DAMP         = 0.97;  // Velocity damping applied inside influence radius
const MAX_SPEED_BOOST    = 2.2;   // Speed cap (units/frame) during mouse interaction

function createParticle(): Particle {
  const colorEntry = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const speed = PARTICLE_SPEED * (0.4 + Math.random() * 0.9);
  return {
    wx: (Math.random() - 0.5) * WORLD_SIZE * 2,
    wy: (Math.random() - 0.5) * WORLD_SIZE * 2,
    wz: NEAR_CLIP + Math.random() * WORLD_SIZE * 2, // spawn in front of camera
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
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef       = useRef<number>(0);

  /** Animation time counter (incremented each frame) */
  const timeRef      = useRef(0);

  /** Smoothed camera Z position */
  const camZRef      = useRef(0);

  /** Zoom (focal length) */
  const targetFovRef = useRef(FOV_DEFAULT);
  const fovRef       = useRef(FOV_DEFAULT);

  /** Mouse position in screen-space (−9999 = not on screen) */
  const mousePosRef    = useRef({ x: -9999, y: -9999 });
  /** True while primary mouse button is held (repulsion mode) */
  const isMouseDownRef = useRef(false);

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

    // ── Mouse: position tracking for attraction / repulsion ─────────────
    const onMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mousePosRef.current = { x: -9999, y: -9999 };
    };
    const onMouseDown = () => { isMouseDownRef.current = true; };
    const onMouseUp   = () => { isMouseDownRef.current = false; };


    // ── Scroll wheel: zoom (adjusts FOV / focal length) ──────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetFovRef.current = Math.max(
        FOV_MIN,
        Math.min(FOV_MAX, targetFovRef.current - e.deltaY * (SCROLL_ZOOM_SPEED / 100))
      );
    };

    window.addEventListener("mousemove",  onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown",  onMouseDown);
    window.addEventListener("mouseup",    onMouseUp);
    window.addEventListener("wheel",      onWheel, { passive: false });

    // ─── Perspective projection ───────────────────────────────────────────────
    // Camera at (0, 0, camZ) looking along +Z (no rotation).
    // Depth of a particle: rz = wz − camZ
    // Projection:  scale = FOV / rz
    //              sx = w/2 + wx·scale
    //              sy = h/2 − wy·scale

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      // ── Advance animation time & compute breathing camera Z ───────────────
      timeRef.current += 1;
      const targetCamZ = BREATHE_AMPLITUDE * Math.sin(timeRef.current * BREATHE_SPEED);
      camZRef.current += (targetCamZ - camZRef.current) * CAM_Z_LERP;
      const camZ = camZRef.current;

      // Smooth zoom
      fovRef.current += (targetFovRef.current - fovRef.current) * FOV_LERP;
      const fov = fovRef.current;

      // ── Projection (no camera rotation) ──────────────────────────────────
      const project = (wx: number, wy: number, wz: number) => {
        const rz = wz - camZ;
        if (rz < NEAR_CLIP) return null;
        const scale = fov / rz;
        return { sx: w / 2 + wx * scale, sy: h / 2 - wy * scale, depth: rz, scale };
      };

      // ── Update world positions ────────────────────────────────────────────
      for (const p of particles) {
        p.wx += p.vx;
        p.wy += p.vy;
        p.wz += p.vz;
        if (p.wx >  WORLD_SIZE) { p.wx =  WORLD_SIZE; p.vx = -Math.abs(p.vx); }
        if (p.wx < -WORLD_SIZE) { p.wx = -WORLD_SIZE; p.vx =  Math.abs(p.vx); }
        if (p.wy >  WORLD_SIZE) { p.wy =  WORLD_SIZE; p.vy = -Math.abs(p.vy); }
        if (p.wy < -WORLD_SIZE) { p.wy = -WORLD_SIZE; p.vy =  Math.abs(p.vy); }
        // Wrap Z: when a particle falls behind camera, move it to far side
        if (p.wz < camZ - NEAR_CLIP) {
          p.wz = camZ + WORLD_SIZE * 1.5 + Math.random() * WORLD_SIZE * 0.5;
          p.wx = (Math.random() - 0.5) * WORLD_SIZE * 2;
          p.wy = (Math.random() - 0.5) * WORLD_SIZE * 2;
        }
        if (p.wz > camZ + WORLD_SIZE * 2) { p.wz = camZ + NEAR_CLIP + Math.random() * WORLD_SIZE; }
      }

      // ── Project all particles ─────────────────────────────────────────────
      const projected = particles.map((p) => ({ p, proj: project(p.wx, p.wy, p.wz) }));

      // ── Mouse attraction / repulsion ──────────────────────────────────────
      // Uses screen-space proximity to decide which particles are affected, then
      // converts the 2-D screen direction back into world-space.
      // With no camera rotation: screen-right = (1, 0, 0), screen-down = (0, -1, 0).
      const mx = mousePosRef.current.x;
      const my = mousePosRef.current.y;
      if (mx > -9000) {
        const isRepulsing = isMouseDownRef.current;
        const forceMag    = isRepulsing ? -REPULSE_STRENGTH : ATTRACT_STRENGTH;
        const r2          = MOUSE_INFLUENCE_R * MOUSE_INFLUENCE_R;

        for (let i = 0; i < projected.length; i++) {
          const { p, proj } = projected[i];
          if (!proj) continue;

          const sdx = mx - proj.sx;
          const sdy = my - proj.sy;
          const sd2 = sdx * sdx + sdy * sdy;
          if (sd2 > r2) continue;

          const sd        = Math.sqrt(sd2) + 0.001;
          const influence = 1 - sd / MOUSE_INFLUENCE_R; // 0..1, peaks at cursor
          const nsx       = sdx / sd; // normalised screen-right component
          const nsy       = sdy / sd; // normalised screen-down  component

          // Project screen direction into world space (no rotation: right=(1,0,0), down=(0,-1,0))
          const fsx = forceMag * nsx * influence;
          const fsy = forceMag * nsy * influence;

          p.vx += fsx;
          p.vy -= fsy;
          // No Z component without camera rotation

          // Dampen to prevent runaway acceleration
          p.vx *= MOUSE_DAMP;
          p.vy *= MOUSE_DAMP;
          p.vz *= MOUSE_DAMP;

          // Hard speed cap during mouse interaction
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
          if (spd > MAX_SPEED_BOOST) {
            const sc = MAX_SPEED_BOOST / spd;
            p.vx *= sc;
            p.vy *= sc;
            p.vz *= sc;
          }
        }
      }

      // Depth fade: visible range NEAR_CLIP … WORLD_SIZE
      const maxDepth = WORLD_SIZE;

      // ── Draw connecting lines (3-D distance check) ────────────────────────
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
          const opacity   = (1 - dist3d / CONNECTION_DIST_3D) * MAX_LINE_OPACITY * (0.2 + depthFade * 0.8);

          const ca = parseRgba(a.p.color);
          const cb = parseRgba(b.p.color);
          ctx.beginPath();
          ctx.moveTo(a.proj.sx, a.proj.sy);
          ctx.lineTo(b.proj.sx, b.proj.sy);
          ctx.strokeStyle = `rgba(${Math.round((ca.r + cb.r) / 2)},${Math.round((ca.g + cb.g) / 2)},${Math.round((ca.b + cb.b) / 2)},${opacity.toFixed(3)})`;
          ctx.lineWidth   = Math.max(0.2, depthFade * 1.0);
          ctx.stroke();
        }
      }

      // ── Draw dots – sorted back-to-front ─────────────────────────────────
      const visible = projected
        .filter((item) => item.proj !== null)
        .sort((a, b) => b.proj!.depth - a.proj!.depth);

      for (const { p, proj } of visible) {
        if (!proj) continue;
        const { sx, sy, depth, scale } = proj;
        const depthFade  = Math.max(0, 1 - (depth - NEAR_CLIP) / (maxDepth - NEAR_CLIP));
        const drawRadius = Math.max(0.4, Math.min(10, PARTICLE_WORLD_R * scale));

        // Glow halo
        const glowRadius = drawRadius * 4.5;
        if (glowRadius > 0.8) {
          const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowRadius);
          gradient.addColorStop(0, p.glowColor);
          gradient.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle   = gradient;
          ctx.globalAlpha = depthFade * 0.55;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(sx, sy, drawRadius, 0, Math.PI * 2);
        if (depthFade > 0.45) {
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
        ctx.globalAlpha = Math.max(0.08, depthFade);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize",    resize);
      window.removeEventListener("mousemove",  onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown",  onMouseDown);
      window.removeEventListener("mouseup",    onMouseUp);
      window.removeEventListener("wheel",      onWheel);
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
