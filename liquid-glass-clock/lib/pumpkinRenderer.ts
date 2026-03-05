/**
 * Pumpkin World Renderer
 *
 * Draws the pumpkin simulation onto a Canvas 2D context.
 * Completely stateless — accepts the current pumpkin list and renders each frame.
 */

import type { Pumpkin } from "./pumpkinSimulation";

// ── Color helpers ──────────────────────────────────────────────────────────────

/** HSL string helper */
function hsl(h: number, s: number, l: number, a = 1): string {
  if (a < 1) return `hsla(${h},${s}%,${l}%,${a})`;
  return `hsl(${h},${s}%,${l}%)`;
}

/**
 * Returns the pumpkin body color based on its rot progress.
 * Healthy: warm orange (hue ~25).
 * Rotting: shifts toward muddy brown/dark olive (hue 30→15, desaturated).
 */
function pumpkinBodyColor(rotProgress: number, lightnessMod = 0): string {
  const hue = 25 - rotProgress * 15;
  const sat = 85 - rotProgress * 55;
  const lig = 45 - rotProgress * 20 + lightnessMod;
  return hsl(hue, sat, lig);
}

function pumpkinHighlightColor(rotProgress: number): string {
  const hue = 30 - rotProgress * 12;
  const sat = 80 - rotProgress * 50;
  const lig = 65 - rotProgress * 25;
  return hsl(hue, sat, lig, 0.6);
}

function pumpkinShadowColor(rotProgress: number): string {
  const hue = 20 - rotProgress * 10;
  const sat = 70 - rotProgress * 45;
  const lig = 25 - rotProgress * 10;
  return hsl(hue, sat, lig, 0.8);
}

function stemColor(rotProgress: number): string {
  const hue = 110 - rotProgress * 90;
  const sat = 55 - rotProgress * 40;
  const lig = 28 - rotProgress * 10;
  return hsl(hue, sat, lig);
}

// ── Pumpkin drawing ────────────────────────────────────────────────────────────

/**
 * Draws a single stylised 2D pumpkin at (x, y) with the given radius.
 * The pumpkin has 5 rounded lobes and a stem; colour shifts from orange
 * to muddy brown as `rotProgress` increases from 0 → 1.
 */
function drawPumpkin(
  ctx: CanvasRenderingContext2D,
  pumpkin: Pumpkin,
  time: number
): void {
  const { x, y, size, rotProgress, stage } = pumpkin;

  // Opacity fade during death
  const alpha = stage === "rotting" ? 1 - rotProgress * 0.4 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Subtle breathing animation for living pumpkins
  const breathScale =
    stage !== "rotting" && stage !== "dead"
      ? 1 + Math.sin(time * 0.8 + x * 0.01) * 0.015
      : 1;

  ctx.translate(x, y);
  ctx.scale(breathScale, breathScale);

  // ── Body lobes ──
  const numLobes = 5;
  const lobeW = size * 0.42;
  const lobeH = size * 0.85;
  const spread = size * 0.32;

  for (let i = 0; i < numLobes; i++) {
    // Offset each lobe horizontally; center lobe is at offset 0
    const offsetX = (i - (numLobes - 1) / 2) * spread;

    const grad = ctx.createRadialGradient(
      offsetX - lobeW * 0.15,
      -lobeH * 0.25,
      size * 0.05,
      offsetX,
      0,
      lobeW * 1.2
    );
    grad.addColorStop(0, pumpkinHighlightColor(rotProgress));
    grad.addColorStop(0.4, pumpkinBodyColor(rotProgress));
    grad.addColorStop(1, pumpkinShadowColor(rotProgress));

    ctx.beginPath();
    ctx.ellipse(offsetX, 0, lobeW, lobeH, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ── Vertical rib lines (dark grooves between lobes) ──
  ctx.strokeStyle = hsl(20 - rotProgress * 10, 55, 22, 0.35);
  ctx.lineWidth = size * 0.04;
  for (let i = 1; i < numLobes; i++) {
    const ribX = (i - (numLobes - 1) / 2) * spread - spread * 0.5;
    ctx.beginPath();
    ctx.moveTo(ribX, -lobeH * 0.5);
    ctx.quadraticCurveTo(ribX + size * 0.04, 0, ribX, lobeH * 0.5);
    ctx.stroke();
  }

  // ── Bottom ground shadow ──
  const shadowGrad = ctx.createRadialGradient(0, lobeH * 0.6, 0, 0, lobeH * 0.7, size * 0.9);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.25)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.ellipse(0, lobeH * 0.72, size * 0.9, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadowGrad;
  ctx.fill();

  // ── Stem ──
  const stemH = size * 0.45;
  const stemW = Math.max(2, size * 0.09);
  ctx.beginPath();
  ctx.moveTo(0, -lobeH * 0.82);
  ctx.bezierCurveTo(
    stemW * 2,
    -lobeH * 0.82 - stemH * 0.4,
    stemW * 3,
    -lobeH * 0.82 - stemH * 0.8,
    stemW * 1.5,
    -lobeH * 0.82 - stemH
  );
  ctx.strokeStyle = stemColor(rotProgress);
  ctx.lineWidth = stemW;
  ctx.lineCap = "round";
  ctx.stroke();

  // ── Small leaf at stem base ──
  if (rotProgress < 0.7) {
    const leafAlpha = 1 - rotProgress / 0.7;
    ctx.globalAlpha = alpha * leafAlpha;
    ctx.beginPath();
    ctx.moveTo(0, -lobeH * 0.82);
    ctx.quadraticCurveTo(
      size * 0.25,
      -lobeH * 0.82 - size * 0.3,
      size * 0.5,
      -lobeH * 0.75
    );
    ctx.quadraticCurveTo(
      size * 0.3,
      -lobeH * 0.82 - size * 0.1,
      0,
      -lobeH * 0.82
    );
    ctx.fillStyle = stemColor(rotProgress * 0.5);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  // ── Rotting mold patches ──
  if (rotProgress > 0.2) {
    const patchAlpha = (rotProgress - 0.2) / 0.8;
    ctx.globalAlpha = alpha * patchAlpha * 0.55;
    const numPatches = Math.floor(3 + rotProgress * 4);
    for (let p = 0; p < numPatches; p++) {
      const seed = p * 137.508 + pumpkin.id.charCodeAt(pumpkin.id.length - 1);
      const px = Math.cos(seed) * size * 0.55;
      const py = Math.sin(seed * 2.1) * lobeH * 0.5;
      const pr = size * 0.12 + rotProgress * size * 0.08;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.7, seed, 0, Math.PI * 2);
      ctx.fillStyle = hsl(85 + Math.sin(seed) * 20, 30, 18);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  ctx.restore();
}

// ── Background ─────────────────────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
): void {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  skyGrad.addColorStop(0, "#1a0a00");
  skyGrad.addColorStop(0.5, "#4a2205");
  skyGrad.addColorStop(1, "#7a4010");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Ground gradient
  const groundGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
  groundGrad.addColorStop(0, "#3d2b08");
  groundGrad.addColorStop(0.4, "#2a1d05");
  groundGrad.addColorStop(1, "#1a1203");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);

  // Horizon glow
  const glowGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.55,
    0,
    width * 0.5,
    height * 0.55,
    width * 0.6
  );
  glowGrad.addColorStop(0, "rgba(200,80,10,0.18)");
  glowGrad.addColorStop(0.5, "rgba(150,50,5,0.08)");
  glowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // Animated moon
  const moonX = width * 0.82;
  const moonY = height * 0.14 + Math.sin(time * 0.05) * 3;
  const moonR = 28;
  const moonGrad = ctx.createRadialGradient(
    moonX - moonR * 0.25,
    moonY - moonR * 0.25,
    0,
    moonX,
    moonY,
    moonR
  );
  moonGrad.addColorStop(0, "rgba(255,240,180,0.95)");
  moonGrad.addColorStop(0.5, "rgba(255,210,100,0.7)");
  moonGrad.addColorStop(1, "rgba(255,160,40,0)");
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fillStyle = moonGrad;
  ctx.fill();

  // Stars
  ctx.fillStyle = "rgba(255,240,200,0.8)";
  const starPositions = [
    [0.1, 0.05], [0.22, 0.12], [0.35, 0.04], [0.5, 0.09],
    [0.62, 0.15], [0.73, 0.06], [0.15, 0.2], [0.44, 0.17],
    [0.57, 0.25], [0.68, 0.3], [0.08, 0.3], [0.28, 0.3],
  ];
  for (const [sx, sy] of starPositions) {
    const twinkle = 0.3 + 0.7 * ((Math.sin(time * 1.3 + sx * 100) + 1) / 2);
    ctx.globalAlpha = twinkle * 0.9;
    ctx.beginPath();
    ctx.arc(sx * width, sy * height, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground grass tufts
  ctx.strokeStyle = "rgba(60,110,20,0.4)";
  ctx.lineWidth = 1.5;
  const grassCount = Math.floor(width / 20);
  for (let i = 0; i < grassCount; i++) {
    const gx = (i / grassCount) * width + ((i * 17) % 11) - 5;
    const gy = height * 0.55 - 1;
    const sway = Math.sin(time * 0.6 + i * 0.5) * 2;
    const h = 8 + ((i * 13) % 7);
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + sway, gy - h * 0.5, gx + sway * 2, gy - h);
    ctx.stroke();
  }
}

// ── HUD ────────────────────────────────────────────────────────────────────────

function drawHUD(
  ctx: CanvasRenderingContext2D,
  pumpkins: readonly Pumpkin[],
  width: number
): void {
  const growing = pumpkins.filter((p) => p.stage === "growing").length;
  const mature = pumpkins.filter((p) => p.stage === "mature").length;
  const rotting = pumpkins.filter((p) => p.stage === "rotting").length;
  const total = pumpkins.length;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  // Rounded rectangle (manual, for compatibility)
  const rx = 12, ry = 12, rw = 220, rh = 80;
  ctx.moveTo(rx + ry, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, 8);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, 8);
  ctx.arcTo(rx, ry + rh, rx, ry, 8);
  ctx.arcTo(rx, ry, rx + rw, ry, 8);
  ctx.closePath();
  ctx.fill();

  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,200,100,0.9)";
  ctx.fillText("🎃 Pumpkin World", 22, 32);

  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`Celkem: ${total}`, 22, 50);

  ctx.fillStyle = "rgba(120,220,80,0.85)";
  ctx.fillText(`Rostoucí: ${growing}`, 22, 65);

  ctx.fillStyle = "rgba(255,180,50,0.85)";
  ctx.fillText(`Zralé: ${mature}`, 100, 65);

  ctx.fillStyle = "rgba(140,80,40,0.85)";
  ctx.fillText(`Hnijící: ${rotting}`, 165, 65);

  ctx.restore();
}

// ── Public renderer ────────────────────────────────────────────────────────────

export class PumpkinRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /**
   * Renders one frame.
   * @param pumpkins - Current pumpkin population
   * @param time     - Elapsed seconds (used for animations)
   */
  render(pumpkins: readonly Pumpkin[], time: number): void {
    const { ctx, width, height } = this;

    ctx.clearRect(0, 0, width, height);
    drawBackground(ctx, width, height, time);

    // Sort by Y so pumpkins further down appear on top (depth illusion)
    const sorted = [...pumpkins].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      drawPumpkin(ctx, p, time);
    }

    drawHUD(ctx, pumpkins, width);
  }
}
