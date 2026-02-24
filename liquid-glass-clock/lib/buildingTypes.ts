/**
 * Building system types and constants.
 * Shared between buildingSystem.ts and Game3D.tsx.
 */

export type BlockMaterial =
  | "wood"
  | "stone"
  | "glass"
  | "dirt"
  | "sand"
  | "brick"
  | "metal"
  | "crystal";

export type BuildMode = "explore" | "build" | "sculpt";

export interface PlacedBlockData {
  /** Grid-snapped world X */
  x: number;
  /** Grid-snapped world Y */
  y: number;
  /** Grid-snapped world Z */
  z: number;
  material: BlockMaterial;
}

export interface BuildingUiState {
  mode: BuildMode;
  selectedMaterial: BlockMaterial;
  blockCount: number;
}

// ─── Material definitions ─────────────────────────────────────────────────────

export interface BlockDef {
  label: string;
  color: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

export const BLOCK_DEFS: Record<BlockMaterial, BlockDef> = {
  wood:    { label: "Dřevo",   color: 0x8B5E3C },
  stone:   { label: "Kámen",   color: 0x888880 },
  glass:   { label: "Sklo",    color: 0x88ddff, transparent: true, opacity: 0.38 },
  dirt:    { label: "Hlína",   color: 0x6B4226 },
  sand:    { label: "Písek",   color: 0xC2B06A },
  brick:   { label: "Cihla",   color: 0x9E4A35 },
  metal:   { label: "Kov",     color: 0xA0A8B8 },
  crystal: {
    label: "Krystal",
    color: 0xaa80ff,
    emissive: 0x5030cc,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.72,
  },
};

export const BLOCK_MATERIAL_ORDER: BlockMaterial[] = [
  "wood", "stone", "glass", "dirt", "sand", "brick", "metal", "crystal",
];

// ─── Game constants ───────────────────────────────────────────────────────────

/** Size of one placed block in world units (1 m). */
export const BLOCK_SIZE = 1;

/** Max raycast distance for block placement / removal. */
export const BUILD_RANGE = 8;

/** Radius of the terrain sculpt brush in world units. */
export const SCULPT_RADIUS = 5;

/** Height change per scroll click in sculpt mode. */
export const SCULPT_STRENGTH = 0.35;

/** Maximum number of placed blocks (performance limit). */
export const MAX_BLOCKS = 500;

/** localStorage key for saving placed blocks. */
export const BLOCKS_STORAGE_KEY = "openworld_placed_blocks";
