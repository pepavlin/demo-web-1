"use client";

import { useEffect, useRef } from "react";

interface Particle {
  /** World-space 3-D position – camera sits at origin inside this cloud */
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
const PARTICLE_COUNT     = 600;   // Dense cloud surrounds the camera
const WORLD_SIZE         = 2200;  // Half-size of the 3-D world cube (camera at origin, vast space)
const FOV_DEFAULT        = 650;   // Default focal length (perspective strength)
const FOV_MIN            = 350;   // Widest zoom-out
const FOV_MAX            = 1400;  // Narrowest zoom-in
const NEAR_CLIP          = 18;    // Discard geometry this close to camera
const CONNECTION_DIST_3D = 420;   // 3-D distance threshold for connecting lines
const MAX_LINE_OPACITY   = 0.35;
const PARTICLE_SPEED     = 0.28;
const MAX_CAMERA_ROT     = 0.22;  // Max camera yaw/pitch in radians (~12.6°) – gentle
const PARTICLE_WORLD_R   = 4.5;   // Physical dot radius in world units
const CAM_LERP           = 0.04;  // Camera smoothing factor (lower = smoother/slower)
const FOV_LERP           = 0.06;  // Zoom smoothing factor
const SCROLL_ZOOM_SPEED  = 80;    // FOV units per scroll tick

function createParticle(): Particle {
  const colorEntry = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const speed = PARTICLE_SPEED * (0.4 + Math.random() * 0.9);
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
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef       = useRef<number>(0);

  /** Target camera angles driven by mouse (radians) */
  const targetRotYRef = useRef(0);  // yaw   – left / right
  const targetRotXRef = useRef(0);  // pitch – up   / down

  /** Smoothed camera angles */
  const camRotYRef = useRef(0);
  const camRotXRef = useRef(0);

  /** Zoom (focal length) */
  const targetFovRef = useRef(FOV_DEFAULT);
  const fovRef       = useRef(FOV_DEFAULT);

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

    // ── Mouse: gentle camera rotation ────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      targetRotYRef.current = ((e.clientX / window.innerWidth)  * 2 - 1) *  MAX_CAMERA_ROT;
      targetRotXRef.current = ((e.clientY / window.innerHeight) * 2 - 1) * -MAX_CAMERA_ROT;
    };
    const onMouseLeave = () => {
      targetRotYRef.current = 0;
      targetRotXRef.current = 0;
    };
    const onMouseDown = () => { /* reserved */ };
    const onMouseUp   = () => { /* reserved */ };

    // ── Scroll wheel: zoom (adjusts FOV / focal length) ──────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Scroll up (negative deltaY) → zoom in → larger FOV value
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
    // Camera is at the ORIGIN (0, 0, 0), looking along +z.
    // Particles are distributed in a ±WORLD_SIZE cube in all directions.
    // Mouse drives yaw (rotY) and pitch (rotX) of the camera view.
    // We apply the inverse camera rotation to each world point, then project.
    //
    //   Yaw   R_Y(rotY):  rx1 = wx·cosY − wz·sinY
    //                      rz1 = wx·sinY + wz·cosY
    //   Pitch R_X(rotX):  ry  = wy·cosX − rz1·sinX
    //                      rz2 = wy·sinX + rz1·cosX
    //   Perspective:       scale = FOV / rz2
    //                      sx = w/2 + rx1·scale
    //                      sy = h/2 − ry ·scale
    //   Near clip:         rz2 < NEAR_CLIP → skip

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      // Smooth camera & zoom toward targets
      camRotYRef.current += (targetRotYRef.current - camRotYRef.current) * CAM_LERP;
      camRotXRef.current += (targetRotXRef.current - camRotXRef.current) * CAM_LERP;
      fovRef.current     += (targetFovRef.current  - fovRef.current)     * FOV_LERP;

      const cosY = Math.cos(camRotYRef.current);
      const sinY = Math.sin(camRotYRef.current);
      const cosX = Math.cos(camRotXRef.current);
      const sinX = Math.sin(camRotXRef.current);
      const fov  = fovRef.current;

      // Camera at origin – no CAMERA_DIST translation needed
      const project = (wx: number, wy: number, wz: number) => {
        // Yaw (Y-axis rotation)
        const rx1 = wx * cosY - wz * sinY;
        const rz1 = wx * sinY + wz * cosY;
        // Pitch (X-axis rotation)
        const ry  = wy * cosX - rz1 * sinX;
        const rz2 = wy * sinX + rz1 * cosX;
        if (rz2 < NEAR_CLIP) return null;
        const scale = fov / rz2;
        return { sx: w / 2 + rx1 * scale, sy: h / 2 - ry * scale, depth: rz2, scale };
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
        if (p.wz >  WORLD_SIZE) { p.wz =  WORLD_SIZE; p.vz = -Math.abs(p.vz); }
        if (p.wz < -WORLD_SIZE) { p.wz = -WORLD_SIZE; p.vz =  Math.abs(p.vz); }
      }

      // ── Project all particles ─────────────────────────────────────────────
      const projected = particles.map((p) => ({ p, proj: project(p.wx, p.wy, p.wz) }));

      // Depth fade: camera is at origin, visible range NEAR_CLIP … WORLD_SIZE
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

      // ── Draw dots – sorted back-to-front so near dots overdraw far ones ───
      const visible = projected
        .filter((item) => item.proj !== null)
        .sort((a, b) => b.proj!.depth - a.proj!.depth);

      for (const { p, proj } of visible) {
        if (!proj) continue;
        const { sx, sy, depth, scale } = proj;
        const depthFade  = Math.max(0, 1 - (depth - NEAR_CLIP) / (maxDepth - NEAR_CLIP));
        const drawRadius = Math.max(0.4, Math.min(10, PARTICLE_WORLD_R * scale));

        // Glow halo – more intense for nearby particles
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

        // Core dot – near particles get sphere-shading gradient
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
      window.removeEventListener("resize",     resize);
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
