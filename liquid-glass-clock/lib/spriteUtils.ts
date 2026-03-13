import * as THREE from "three";
import type { TreeType } from "./meshBuilders";

// ─── Tree Sprite LOD Utilities ──────────────────────────────────────────────
//
// For static objects (trees) that are far from the camera we replace their
// full 3D mesh with a cheap 2D billboard sprite.  The sprite is a simple but
// recognisable silhouette drawn on a canvas and cached per tree type, so we
// allocate at most 4 textures total regardless of how many trees exist.

const SPRITE_TEX_W = 64;
const SPRITE_TEX_H = 128;

// Cached textures – one per TreeType, created lazily on first use.
const _textureCache = new Map<TreeType, THREE.CanvasTexture>();

/** Draw a pine/conifer silhouette onto a canvas context. */
function _drawPine(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  // Trunk
  ctx.fillStyle = "#3a2010";
  const trunkW = w * 0.08;
  const trunkH = h * 0.22;
  ctx.fillRect(cx - trunkW / 2, h - trunkH, trunkW, trunkH);

  // Stacked cone tiers (wide at bottom, narrow at top)
  const tiers = 5;
  const treeTop = h * 0.04;
  const treeBase = h - trunkH + h * 0.04;
  const totalH = treeBase - treeTop;

  ctx.fillStyle = "#1e5210";
  for (let i = 0; i < tiers; i++) {
    const frac = i / tiers;
    const tierY = treeTop + totalH * frac;
    const tierH = (totalH / tiers) * 1.3;
    const tierW = w * (0.85 - frac * 0.55);
    ctx.beginPath();
    ctx.moveTo(cx, tierY);
    ctx.lineTo(cx - tierW / 2, tierY + tierH);
    ctx.lineTo(cx + tierW / 2, tierY + tierH);
    ctx.closePath();
    // Alternate two shades for depth
    ctx.fillStyle = i % 2 === 0 ? "#1e5210" : "#2d6e1c";
    ctx.fill();
  }
}

/** Draw an oak/deciduous silhouette. */
function _drawOak(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  // Trunk
  ctx.fillStyle = "#4a2a10";
  const trunkW = w * 0.12;
  const trunkH = h * 0.30;
  ctx.fillRect(cx - trunkW / 2, h - trunkH, trunkW, trunkH);

  // Rounded crown — several overlapping circles
  const crownCY = h * 0.40;
  const crownR = w * 0.36;
  const blobs = [
    { x: cx,              y: crownCY,          r: crownR,        c: "#2d5a1b" },
    { x: cx - crownR * 0.55, y: crownCY + crownR * 0.2, r: crownR * 0.65, c: "#3a7a20" },
    { x: cx + crownR * 0.50, y: crownCY + crownR * 0.2, r: crownR * 0.65, c: "#1e4012" },
    { x: cx,              y: crownCY - crownR * 0.3, r: crownR * 0.55, c: "#3d6e1a" },
    { x: cx - crownR * 0.3,  y: crownCY - crownR * 0.1, r: crownR * 0.45, c: "#4a9030" },
    { x: cx + crownR * 0.3,  y: crownCY - crownR * 0.1, r: crownR * 0.45, c: "#2d5a1b" },
  ];
  for (const b of blobs) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.c;
    ctx.fill();
  }
}

/** Draw a birch silhouette. */
function _drawBirch(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  // Slender white trunk with dark marks
  const trunkW = w * 0.07;
  const trunkH = h * 0.36;
  ctx.fillStyle = "#e0d8c8";
  ctx.fillRect(cx - trunkW / 2, h - trunkH, trunkW, trunkH);
  // Bark marks
  ctx.fillStyle = "#201818";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(cx - trunkW / 2 - 1, h - trunkH + (trunkH / 4) * i + 4, trunkW + 2, 3);
  }

  // Light oval foliage blobs
  const crownCY = h * 0.38;
  const crownR  = w * 0.28;
  const birchBlobs = [
    { x: cx,              y: crownCY,              r: crownR,        c: "#8ab840" },
    { x: cx - crownR * 0.55, y: crownCY + crownR * 0.2, r: crownR * 0.6, c: "#9ac855" },
    { x: cx + crownR * 0.50, y: crownCY + crownR * 0.2, r: crownR * 0.6, c: "#78a030" },
    { x: cx - crownR * 0.2,  y: crownCY - crownR * 0.4, r: crownR * 0.5, c: "#aac850" },
    { x: cx + crownR * 0.2,  y: crownCY - crownR * 0.4, r: crownR * 0.5, c: "#8ab840" },
  ];
  for (const b of birchBlobs) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.c;
    ctx.fill();
  }
}

/** Draw a dead/bare tree silhouette. */
function _drawDead(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  ctx.strokeStyle = "#252015";
  ctx.lineCap = "round";

  // Main trunk
  ctx.lineWidth = w * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx, h);
  ctx.lineTo(cx, h * 0.25);
  ctx.stroke();

  // Branch arms — gnarled, irregular
  const branches = [
    { ax: cx, ay: h * 0.40, bx: cx - w * 0.30, by: h * 0.22 },
    { ax: cx, ay: h * 0.35, bx: cx + w * 0.28, by: h * 0.18 },
    { ax: cx, ay: h * 0.55, bx: cx - w * 0.20, by: h * 0.42 },
    { ax: cx, ay: h * 0.50, bx: cx + w * 0.22, by: h * 0.38 },
  ];
  ctx.lineWidth = w * 0.04;
  for (const br of branches) {
    ctx.beginPath();
    ctx.moveTo(br.ax, br.ay);
    ctx.lineTo(br.bx, br.by);
    ctx.stroke();
  }
}

/**
 * Returns a cached CanvasTexture for the given tree type.
 * Textures are lazily created and re-used for all sprites of that type.
 */
export function getTreeSpriteTexture(type: TreeType): THREE.CanvasTexture {
  const cached = _textureCache.get(type);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width  = SPRITE_TEX_W;
  canvas.height = SPRITE_TEX_H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SPRITE_TEX_W, SPRITE_TEX_H);

  switch (type) {
    case "pine":  _drawPine(ctx,  SPRITE_TEX_W, SPRITE_TEX_H); break;
    case "oak":   _drawOak(ctx,   SPRITE_TEX_W, SPRITE_TEX_H); break;
    case "birch": _drawBirch(ctx, SPRITE_TEX_W, SPRITE_TEX_H); break;
    case "dead":  _drawDead(ctx,  SPRITE_TEX_W, SPRITE_TEX_H); break;
  }

  const tex = new THREE.CanvasTexture(canvas);
  _textureCache.set(type, tex);
  return tex;
}

/**
 * Creates a THREE.Sprite billboard for a distant tree.
 *
 * The sprite is positioned at the visual centre of the tree (half its height)
 * so it aligns correctly when placed at the terrain surface.  It is hidden by
 * default; the LOD loop in Game3D controls its visibility.
 *
 * @param type       Tree variety (drives which texture is used).
 * @param treeHeight Approximate world-unit height of the tree.
 * @returns          A configured Sprite ready to be added to the scene.
 */
export function createTreeSprite(type: TreeType, treeHeight: number): THREE.Sprite {
  const tex = getTreeSpriteTexture(type);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,       // avoids z-fighting artefacts with terrain
    fog: true,               // integrates with the scene's exponential fog
  });
  const sprite = new THREE.Sprite(mat);

  // Scale so the sprite roughly matches the tree's world footprint.
  // The canvas is 1:2 (w:h) so the sprite width ≈ half the height.
  const aspect = SPRITE_TEX_W / SPRITE_TEX_H; // 0.5
  sprite.scale.set(treeHeight * aspect * 1.1, treeHeight * 1.05, 1);

  // Centre the sprite at half the tree's height so its base aligns with y=0
  // of the tree group (i.e. the terrain surface).
  sprite.position.y = treeHeight * 0.5;

  sprite.visible = false; // hidden until the LOD system switches to sprite mode
  return sprite;
}

/** Dispose all cached textures and sprite materials (call on scene teardown). */
export function disposeTreeSpriteCache(): void {
  _textureCache.forEach((tex) => tex.dispose());
  _textureCache.clear();
}
