/**
 * Building system — mesh builders, grid snapping, persistence helpers.
 * Keeps Three.js mesh creation separate from Game3D.tsx game logic.
 */

import * as THREE from "three";
import {
  BlockMaterial,
  BlockDef,
  BLOCK_DEFS,
  BLOCK_SIZE,
  PlacedBlockData,
  BLOCKS_STORAGE_KEY,
} from "./buildingTypes";

// ─── Shared geometry (avoids allocating a new BoxGeometry per block) ──────────
const _boxGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const _ghostGeo = new THREE.BoxGeometry(
  BLOCK_SIZE * 1.03,
  BLOCK_SIZE * 1.03,
  BLOCK_SIZE * 1.03
);

// ─── Block mesh ───────────────────────────────────────────────────────────────

/** Create a solid block mesh for the given material. */
export function buildBlockMesh(material: BlockMaterial): THREE.Mesh {
  const def: BlockDef = BLOCK_DEFS[material];
  const mat = new THREE.MeshLambertMaterial({
    color: def.color,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
    emissive: def.emissive !== undefined ? new THREE.Color(def.emissive) : new THREE.Color(0),
    emissiveIntensity: def.emissiveIntensity ?? 0,
  });
  const mesh = new THREE.Mesh(_boxGeo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isPlacedBlock = true;
  mesh.userData.blockMaterial = material;
  return mesh;
}

/** Create a transparent ghost preview mesh (changes with material). */
export function buildGhostMesh(material: BlockMaterial): THREE.Mesh {
  const def: BlockDef = BLOCK_DEFS[material];
  const mat = new THREE.MeshLambertMaterial({
    color: def.color,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(_ghostGeo, mat);
  mesh.userData.isGhost = true;
  mesh.visible = false;
  return mesh;
}

/** Update ghost mesh colour to match a new material. */
export function updateGhostMaterial(ghost: THREE.Mesh, material: BlockMaterial): void {
  const mat = ghost.material as THREE.MeshLambertMaterial;
  mat.color.setHex(BLOCK_DEFS[material].color);
}

// ─── Sculpt indicator ─────────────────────────────────────────────────────────

/** Torus ring drawn on the terrain surface to show sculpt brush radius. */
export function buildSculptIndicator(radius: number): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, 0.12, 8, 40);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00e8ff,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

// ─── Grid snapping ────────────────────────────────────────────────────────────

/**
 * Snap a world position to the block grid.
 * Y is snapped to multiples of BLOCK_SIZE.
 */
export function snapToGrid(
  x: number,
  y: number,
  z: number
): [number, number, number] {
  return [
    Math.round(x / BLOCK_SIZE) * BLOCK_SIZE,
    Math.round(y / BLOCK_SIZE) * BLOCK_SIZE,
    Math.round(z / BLOCK_SIZE) * BLOCK_SIZE,
  ];
}

/**
 * Given a raycast hit point and the face normal at that point, compute the
 * world-space center of the block that should be placed.
 */
export function getPlacementPosition(
  hitPoint: THREE.Vector3,
  faceNormal: THREE.Vector3
): THREE.Vector3 {
  // Step half a block along the face normal so the new block sits on top/beside
  const candidate = hitPoint
    .clone()
    .addScaledVector(faceNormal, BLOCK_SIZE * 0.51);
  const [sx, sy, sz] = snapToGrid(candidate.x, candidate.y, candidate.z);
  return new THREE.Vector3(sx, sy, sz);
}

/** Unique string key for a grid position (used as Map key). */
export function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/** Serialize placed blocks to localStorage. */
export function saveBlocks(blocks: PlacedBlockData[]): void {
  try {
    // Compact format: each block is [x, y, z, materialIndex]
    const order: BlockMaterial[] = [
      "wood", "stone", "glass", "dirt", "sand", "brick", "metal", "crystal",
    ];
    const compact = blocks.map((b) => [
      b.x,
      b.y,
      b.z,
      order.indexOf(b.material),
    ]);
    localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(compact));
  } catch {
    // localStorage might be unavailable (private mode, quota exceeded)
  }
}

/** Load placed blocks from localStorage. Returns empty array if nothing saved. */
export function loadBlocks(): PlacedBlockData[] {
  const order: BlockMaterial[] = [
    "wood", "stone", "glass", "dirt", "sand", "brick", "metal", "crystal",
  ];
  try {
    const raw = localStorage.getItem(BLOCKS_STORAGE_KEY);
    if (!raw) return [];
    const compact = JSON.parse(raw) as [number, number, number, number][];
    return compact
      .filter((b) => Array.isArray(b) && b.length === 4 && b[3] >= 0 && b[3] < order.length)
      .map(([x, y, z, mi]) => ({
        x,
        y,
        z,
        material: order[mi],
      }));
  } catch {
    return [];
  }
}
