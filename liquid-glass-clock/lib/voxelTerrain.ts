/**
 * voxelTerrain.ts
 *
 * Marching Cubes voxel terrain system.
 *
 * Replaces the flat PlaneGeometry terrain with a fully volumetric isosurface
 * mesh generated from a 3D density field.  The density field is derived from:
 *   - The existing 2D height-map (getTerrainHeight) which defines the landscape shape
 *   - 3D simplex noise that carves cave tunnels through the underground
 *
 * This allows for true overhangs, arches, and interconnected cave systems.
 *
 * Architecture
 * ──────────────
 * • The world is subdivided into axis-aligned chunks of CHUNK_SIZE voxels on
 *   each axis (each voxel = VOXEL_SIZE world units).
 * • For every chunk the Marching Cubes algorithm is run to produce a triangle
 *   mesh at the density=0 isosurface.
 * • Chunks that are completely solid or completely empty are skipped.
 * • Vertex colours are computed per-vertex from height to match the existing
 *   biome palette used by the terrain shader.
 */

import { createNoise3D } from "simplex-noise";
import * as THREE from "three";
import { getTerrainHeight, WORLD_SIZE, modifyTerrainHeight } from "./terrainUtils";

// ─── Public constants ──────────────────────────────────────────────────────────

/** World-space size of one voxel (each voxel = 2×2×2 world units). */
export const VOXEL_SIZE = 2.0;

/** Number of voxels per chunk side. Chunk covers CHUNK_SIZE×VOXEL_SIZE world units. */
export const CHUNK_SIZE = 16;

/** World-space extent of one chunk (32 world units). */
export const CHUNK_WORLD = CHUNK_SIZE * VOXEL_SIZE;

/** Minimum Y (world units) for the voxel volume — below the deepest ocean floor. */
export const VOXEL_Y_MIN = -32;

/** Maximum Y (world units) for the voxel volume — above the highest mountain. */
export const VOXEL_Y_MAX = 64;

// ─── Cave generation tunables ─────────────────────────────────────────────────

/** Horizontal frequency of cave noise (lower → bigger caves). */
const CAVE_SCALE_H = 0.038;

/** Vertical frequency of cave noise (lower → more horizontal tunnels). */
const CAVE_SCALE_V = 0.055;

/** 3D noise value above which rock is carved away. Range 0–1. */
const CAVE_THRESHOLD = 0.60;

/** Metres below the terrain surface where cave carving may begin. */
const CAVE_MIN_DEPTH = 4.0;

/** Maximum carving strength added to density (larger = wider caves). */
const CAVE_CARVE_STRENGTH = 10.0;

// ─── Marching Cubes lookup tables ─────────────────────────────────────────────
//
// Standard tables from Paul Bourke's canonical implementation.
// edgeTable: 256 values, each a bitmask of the 12 edges intersected by the
//            isosurface for that corner configuration.
// triTable: 256 entries × up to 16 values; each group of 3 is a triangle
//           using edge indices 0–11; -1 terminates the entry.

/* eslint-disable @typescript-eslint/no-explicit-any */
const edgeTable: readonly number[] = [
  0x000,0x109,0x203,0x30a,0x406,0x50f,0x605,0x70c,
  0x80c,0x905,0xa0f,0xb06,0xc0a,0xd03,0xe09,0xf00,
  0x190,0x099,0x393,0x29a,0x596,0x49f,0x795,0x69c,
  0x99c,0x895,0xb9f,0xa96,0xd9a,0xc93,0xf99,0xe90,
  0x230,0x339,0x033,0x13a,0x636,0x73f,0x435,0x53c,
  0xa3c,0xb35,0x83f,0x936,0xe3a,0xf33,0xc39,0xd30,
  0x3a0,0x2a9,0x1a3,0x0aa,0x7a6,0x6af,0x5a5,0x4ac,
  0xbac,0xaa5,0x9af,0x8a6,0xfaa,0xea3,0xda9,0xca0,
  0x460,0x569,0x663,0x76a,0x066,0x16f,0x265,0x36c,
  0xc6c,0xd65,0xe6f,0xf66,0x86a,0x963,0xa69,0xb60,
  0x5f0,0x4f9,0x7f3,0x6fa,0x1f6,0x0ff,0x3f5,0x2fc,
  0xdfc,0xcf5,0xfff,0xef6,0x9fa,0x8f3,0xbf9,0xaf0,
  0x650,0x759,0x453,0x55a,0x256,0x35f,0x055,0x15c,
  0xe5c,0xf55,0xc5f,0xd56,0xa5a,0xb53,0x859,0x950,
  0x7c0,0x6c9,0x5c3,0x4ca,0x3c6,0x2cf,0x1c5,0x0cc,
  0xfcc,0xec5,0xdcf,0xcc6,0xbca,0xac3,0x9c9,0x8c0,
  0x8c0,0x9c9,0xac3,0xbca,0xcc6,0xdcf,0xec5,0xfcc,
  0x0cc,0x1c5,0x2cf,0x3c6,0x4ca,0x5c3,0x6c9,0x7c0,
  0x950,0x859,0xb53,0xa5a,0xd56,0xc5f,0xf55,0xe5c,
  0x15c,0x055,0x35f,0x256,0x55a,0x453,0x759,0x650,
  0xaf0,0xbf9,0x8f3,0x9fa,0xef6,0xfff,0xcf5,0xdfc,
  0x2fc,0x3f5,0x0ff,0x1f6,0x6fa,0x7f3,0x4f9,0x5f0,
  0xb60,0xa69,0x963,0x86a,0xf66,0xe6f,0xd65,0xc6c,
  0x36c,0x265,0x16f,0x066,0x76a,0x663,0x569,0x460,
  0xca0,0xda9,0xea3,0xfaa,0x8a6,0x9af,0xaa5,0xbac,
  0x4ac,0x5a5,0x6af,0x7a6,0x0aa,0x1a3,0x2a9,0x3a0,
  0xd30,0xc39,0xf33,0xe3a,0x936,0x83f,0xb35,0xa3c,
  0x53c,0x435,0x73f,0x636,0x13a,0x033,0x339,0x230,
  0xe90,0xf99,0xc93,0xd9a,0xa96,0xb9f,0x895,0x99c,
  0x69c,0x795,0x49f,0x596,0x29a,0x393,0x099,0x190,
  0xf00,0xe09,0xd03,0xc0a,0xb06,0xa0f,0x905,0x80c,
  0x70c,0x605,0x50f,0x406,0x30a,0x203,0x109,0x000,
];

const triTable: readonly (readonly number[])[] = [
  [-1],
  [0,8,3,-1],
  [0,1,9,-1],
  [1,8,3,9,8,1,-1],
  [1,2,10,-1],
  [0,8,3,1,2,10,-1],
  [9,2,10,0,2,9,-1],
  [2,8,3,2,10,8,10,9,8,-1],
  [3,11,2,-1],
  [0,11,2,8,11,0,-1],
  [1,9,0,2,3,11,-1],
  [1,11,2,1,9,11,9,8,11,-1],
  [3,10,1,11,10,3,-1],
  [0,10,1,0,8,10,8,11,10,-1],
  [3,9,0,3,11,9,11,10,9,-1],
  [9,8,10,10,8,11,-1],
  [4,7,8,-1],
  [4,3,0,7,3,4,-1],
  [0,1,9,8,4,7,-1],
  [4,1,9,4,7,1,7,3,1,-1],
  [1,2,10,8,4,7,-1],
  [3,4,7,3,0,4,1,2,10,-1],
  [9,2,10,9,0,2,8,4,7,-1],
  [2,10,9,2,9,7,2,7,3,7,9,4,-1],
  [8,4,7,3,11,2,-1],
  [11,4,7,11,2,4,2,0,4,-1],
  [9,0,1,8,4,7,2,3,11,-1],
  [4,7,11,9,4,11,9,11,2,9,2,1,-1],
  [3,10,1,3,11,10,7,8,4,-1],
  [1,11,10,1,4,11,1,0,4,7,11,4,-1],
  [4,7,8,9,0,11,9,11,10,11,0,3,-1],
  [4,7,11,4,11,9,9,11,10,-1],
  [9,5,4,-1],
  [9,5,4,0,8,3,-1],
  [0,5,4,1,5,0,-1],
  [8,5,4,8,3,5,3,1,5,-1],
  [1,2,10,9,5,4,-1],
  [3,0,8,1,2,10,4,9,5,-1],
  [5,2,10,5,4,2,4,0,2,-1],
  [2,10,5,3,2,5,3,5,4,3,4,8,-1],
  [9,5,4,2,3,11,-1],
  [0,11,2,0,8,11,4,9,5,-1],
  [0,5,4,0,1,5,2,3,11,-1],
  [2,1,5,2,5,8,2,8,11,4,8,5,-1],
  [10,3,11,10,1,3,9,5,4,-1],
  [4,9,5,0,8,1,8,10,1,8,11,10,-1],
  [5,4,0,5,0,11,5,11,10,11,0,3,-1],
  [5,4,8,5,8,10,10,8,11,-1],
  [9,7,8,5,7,9,-1],
  [9,3,0,9,5,3,5,7,3,-1],
  [0,7,8,0,1,7,1,5,7,-1],
  [1,5,3,3,5,7,-1],
  [9,7,8,9,5,7,10,1,2,-1],
  [10,1,2,9,5,0,5,3,0,5,7,3,-1],
  [8,0,2,8,2,5,8,5,7,10,5,2,-1],
  [2,10,5,2,5,3,3,5,7,-1],
  [7,9,5,7,8,9,3,11,2,-1],
  [9,5,7,9,7,2,9,2,0,2,7,11,-1],
  [2,3,11,0,1,8,1,7,8,1,5,7,-1],
  [11,2,1,11,1,7,7,1,5,-1],
  [9,5,8,8,5,7,10,1,3,10,3,11,-1],
  [5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1],
  [11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1],
  [11,10,5,7,11,5,-1],
  [10,6,5,-1],
  [0,8,3,5,10,6,-1],
  [9,0,1,5,10,6,-1],
  [1,8,3,1,9,8,5,10,6,-1],
  [1,6,5,2,6,1,-1],
  [1,6,5,1,2,6,3,0,8,-1],
  [9,6,5,9,0,6,0,2,6,-1],
  [5,9,8,5,8,2,5,2,6,3,2,8,-1],
  [2,3,11,10,6,5,-1],
  [11,0,8,11,2,0,10,6,5,-1],
  [0,1,9,2,3,11,5,10,6,-1],
  [5,10,6,1,9,2,9,11,2,9,8,11,-1],
  [6,3,11,6,5,3,5,1,3,-1],
  [0,8,11,0,11,5,0,5,1,5,11,6,-1],
  [3,11,6,0,3,6,0,6,5,0,5,9,-1],
  [6,5,9,6,9,11,11,9,8,-1],
  [5,10,6,4,7,8,-1],
  [4,3,0,4,7,3,6,5,10,-1],
  [1,9,0,5,10,6,8,4,7,-1],
  [10,6,5,1,9,7,1,7,3,7,9,4,-1],
  [6,1,2,6,5,1,4,7,8,-1],
  [1,2,5,5,2,6,3,0,4,3,4,7,-1],
  [8,4,7,9,0,5,0,6,5,0,2,6,-1],
  [7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1],
  [3,11,2,7,8,4,10,6,5,-1],
  [5,10,6,4,7,2,4,2,0,2,7,11,-1],
  [0,1,9,4,7,8,2,3,11,5,10,6,-1],
  [9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1],
  [8,4,7,3,11,5,3,5,1,5,11,6,-1],
  [5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1],
  [0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1],
  [6,5,9,6,9,11,4,7,9,7,11,9,-1],
  [10,4,9,6,4,10,-1],
  [4,10,6,4,9,10,0,8,3,-1],
  [10,0,1,10,6,0,6,4,0,-1],
  [8,3,1,8,1,6,8,6,4,6,1,10,-1],
  [1,4,9,1,2,4,2,6,4,-1],
  [3,0,8,1,2,9,2,4,9,2,6,4,-1],
  [0,2,4,4,2,6,-1],
  [8,3,2,8,2,4,4,2,6,-1],
  [10,4,9,10,6,4,11,2,3,-1],
  [0,8,2,2,8,11,4,9,10,4,10,6,-1],
  [3,11,2,0,1,6,0,6,4,6,1,10,-1],
  [6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1],
  [9,6,4,9,3,6,9,1,3,11,6,3,-1],
  [8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1],
  [3,11,6,3,6,0,0,6,4,-1],
  [6,4,8,11,6,8,-1],
  [7,10,6,7,8,10,8,9,10,-1],
  [0,7,3,0,10,7,0,9,10,6,7,10,-1],
  [10,6,7,1,10,7,1,7,8,1,8,0,-1],
  [10,6,7,10,7,1,1,7,3,-1],
  [1,2,6,1,6,8,1,8,9,8,6,7,-1],
  [2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1],
  [7,8,0,7,0,6,6,0,2,-1],
  [7,3,2,6,7,2,-1],
  [2,3,11,10,6,8,10,8,9,8,6,7,-1],
  [2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1],
  [1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1],
  [11,2,1,11,1,7,10,6,1,6,7,1,-1],
  [8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1],
  [0,9,1,11,6,7,-1],
  [7,8,0,7,0,6,3,11,0,11,6,0,-1],
  [7,11,6,-1],
  [7,6,11,-1],
  [3,0,8,11,7,6,-1],
  [0,1,9,11,7,6,-1],
  [8,1,9,8,3,1,11,7,6,-1],
  [10,1,2,6,11,7,-1],
  [1,2,10,3,0,8,6,11,7,-1],
  [2,9,0,2,10,9,6,11,7,-1],
  [6,11,7,2,10,3,10,8,3,10,9,8,-1],
  [7,2,3,6,2,7,-1],
  [7,0,8,7,6,0,6,2,0,-1],
  [2,7,6,2,3,7,0,1,9,-1],
  [1,6,2,1,8,6,1,9,8,8,7,6,-1],
  [10,7,6,10,1,7,1,3,7,-1],
  [10,7,6,1,7,10,1,8,7,1,0,8,-1],
  [0,3,7,0,7,10,0,10,9,6,10,7,-1],
  [7,6,10,7,10,8,8,10,9,-1],
  [6,8,4,11,8,6,-1],
  [3,6,11,3,0,6,0,4,6,-1],
  [8,6,11,8,4,6,9,0,1,-1],
  [9,4,6,9,6,3,9,3,1,11,3,6,-1],
  [6,8,4,6,11,8,2,10,1,-1],
  [1,2,10,3,0,11,0,6,11,0,4,6,-1],
  [4,11,8,4,6,11,0,2,9,2,10,9,-1],
  [10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1],
  [8,2,3,8,4,2,4,6,2,-1],
  [0,4,2,4,6,2,-1],
  [1,9,0,2,3,4,2,4,6,4,3,8,-1],
  [1,9,4,1,4,2,2,4,6,-1],
  [8,1,3,8,6,1,8,4,6,6,10,1,-1],
  [10,1,0,10,0,6,6,0,4,-1],
  [4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1],
  [10,9,4,6,10,4,-1],
  [4,9,5,7,6,11,-1],
  [0,8,3,4,9,5,11,7,6,-1],
  [5,0,1,5,4,0,7,6,11,-1],
  [11,7,6,8,3,4,3,5,4,3,1,5,-1],
  [9,5,4,10,1,2,7,6,11,-1],
  [6,11,7,1,2,10,0,8,3,4,9,5,-1],
  [7,6,11,5,4,10,4,2,10,4,0,2,-1],
  [3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1],
  [7,2,3,7,6,2,5,4,9,-1],
  [9,5,4,0,8,6,0,6,2,6,8,7,-1],
  [3,6,2,3,7,6,1,5,0,5,4,0,-1],
  [6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1],
  [9,5,4,10,1,6,1,7,6,1,3,7,-1],
  [1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1],
  [4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1],
  [7,6,10,7,10,8,5,4,10,4,8,10,-1],
  [6,9,5,6,11,9,11,8,9,-1],
  [3,6,11,0,6,3,0,5,6,0,9,5,-1],
  [0,11,8,0,5,11,0,1,5,5,6,11,-1],
  [6,11,3,6,3,5,5,3,1,-1],
  [1,2,10,9,5,11,9,11,8,11,5,6,-1],
  [0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1],
  [11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1],
  [6,11,3,6,3,5,2,10,3,10,5,3,-1],
  [5,8,9,5,2,8,5,6,2,3,8,2,-1],
  [9,5,6,9,6,0,0,6,2,-1],
  [1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1],
  [1,5,6,2,1,6,-1],
  [1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1],
  [10,1,0,10,0,6,9,5,0,5,6,0,-1],
  [0,3,8,5,6,10,-1],
  [10,5,6,-1],
  [11,5,10,7,5,11,-1],
  [11,5,10,11,7,5,8,3,0,-1],
  [5,11,7,5,10,11,1,9,0,-1],
  [10,7,5,10,11,7,9,8,1,8,3,1,-1],
  [11,1,2,11,7,1,7,5,1,-1],
  [0,8,3,1,2,7,1,7,5,7,2,11,-1],
  [9,7,5,9,2,7,9,0,2,2,11,7,-1],
  [7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1],
  [2,5,10,2,3,5,3,7,5,-1],
  [8,2,0,8,5,2,8,7,5,10,2,5,-1],
  [9,0,1,2,3,5,2,5,10,5,3,7,-1],
  [9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1],
  [1,3,5,3,7,5,-1],
  [0,8,7,0,7,1,1,7,5,-1],
  [9,0,3,9,3,5,5,3,7,-1],
  [9,8,7,5,9,7,-1],
  [5,8,4,5,10,8,10,11,8,-1],
  [5,0,4,5,11,0,5,10,11,11,3,0,-1],
  [0,1,9,8,4,10,8,10,11,10,4,5,-1],
  [10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1],
  [2,5,1,2,8,5,2,11,8,4,5,8,-1],
  [0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1],
  [0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1],
  [9,4,5,2,11,3,-1],
  [2,5,10,3,5,2,3,4,5,3,8,4,-1],
  [5,10,2,5,2,4,4,2,0,-1],
  [3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1],
  [5,10,2,5,2,4,1,9,2,9,4,2,-1],
  [8,4,5,8,5,3,3,5,1,-1],
  [0,4,5,1,0,5,-1],
  [8,4,5,8,5,3,9,0,5,0,3,5,-1],
  [9,4,5,-1],
  [4,11,7,4,9,11,9,10,11,-1],
  [0,8,3,4,9,7,9,11,7,9,10,11,-1],
  [1,10,11,1,11,4,1,4,0,7,4,11,-1],
  [3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1],
  [4,11,7,9,11,4,9,2,11,9,1,2,-1],
  [9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1],
  [11,7,4,11,4,2,2,4,0,-1],
  [11,7,4,11,4,2,8,3,4,3,2,4,-1],
  [2,9,10,2,7,9,2,3,7,7,4,9,-1],
  [9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1],
  [3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1],
  [1,10,2,8,7,4,-1],
  [4,9,1,4,1,7,7,1,3,-1],
  [4,9,1,4,1,7,0,8,1,8,7,1,-1],
  [4,0,3,7,4,3,-1],
  [4,8,7,-1],
  [9,10,8,10,11,8,-1],
  [3,0,9,3,9,11,11,9,10,-1],
  [0,1,10,0,10,8,8,10,11,-1],
  [3,1,10,11,3,10,-1],
  [1,2,11,1,11,9,9,11,8,-1],
  [3,0,9,3,9,11,1,2,9,2,11,9,-1],
  [0,2,11,8,0,11,-1],
  [3,2,11,-1],
  [2,3,8,2,8,10,10,8,9,-1],
  [9,10,2,0,9,2,-1],
  [2,3,8,2,8,10,0,1,8,1,10,8,-1],
  [1,10,2,-1],
  [1,3,8,9,1,8,-1],
  [0,9,1,-1],
  [0,3,8,-1],
  [-1],
];
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Edge vertex offsets ──────────────────────────────────────────────────────
//
// Each entry gives the two corner indices connected by that edge.
const edgeVertexPairs: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

// Corner offsets within a voxel (indices 0-7, matching the bit positions above)
const cornerOffsets: readonly [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 0, 1],
  [0, 0, 1],
  [0, 1, 0],
  [1, 1, 0],
  [1, 1, 1],
  [0, 1, 1],
];

// ─── Module state ─────────────────────────────────────────────────────────────

let _noise3D: ReturnType<typeof createNoise3D> | null = null;

/**
 * Initialise the 3D noise generator used for cave carving.
 * Uses a different seed from the 2D terrain noise to keep caves independent
 * of the surface height-map.
 */
export function initVoxelNoise(seed = 42): void {
  // Offset seed so caves differ from the surface noise
  const caveSeed = seed ^ 0xdeadbeef;
  const prng = (() => {
    let s = caveSeed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  })();
  _noise3D = createNoise3D(prng);
}

// ─── Density field ────────────────────────────────────────────────────────────

/**
 * Compute the signed density at world position (x, y, z).
 *
 * Convention (standard Marching Cubes):
 *   negative → solid rock/ground  (inside, cubeIndex bit SET)
 *   positive → air / void         (outside, cubeIndex bit CLEAR)
 *   zero     → the terrain surface (isosurface)
 *
 * Using density = y - surfaceY ensures normals generated by MC point
 * from solid (negative) toward air (positive), i.e. upward/outward,
 * so the terrain surface is visible when viewed from above.
 */
export function getVoxelDensity(x: number, y: number, z: number): number {
  const surfaceY = getTerrainHeight(x, z);

  // Base density: y - surfaceY so that:
  //   y < surfaceY (underground) → density < 0 → solid (inside)
  //   y > surfaceY (above ground) → density > 0 → air  (outside)
  let density = y - surfaceY;

  // Cave carving — only applies below the surface with a safety margin so that
  // we never accidentally remove the terrain surface itself.
  // depthBelow is always positive when underground.
  const depthBelow = surfaceY - y;
  if (depthBelow > CAVE_MIN_DEPTH && _noise3D) {
    // Primary cave network — large, winding tunnels
    // Adding a positive value to a negative density pushes it toward 0 (and
    // beyond) — effectively carving air into the solid rock.
    const n1 = (_noise3D(x * CAVE_SCALE_H, y * CAVE_SCALE_V, z * CAVE_SCALE_H) + 1) * 0.5;
    if (n1 > CAVE_THRESHOLD) {
      const t = (n1 - CAVE_THRESHOLD) / (1 - CAVE_THRESHOLD);
      density += t * CAVE_CARVE_STRENGTH;
    }

    // Secondary passages — smaller galleries that branch off the main tunnels
    const n2 = (
      _noise3D(
        x * CAVE_SCALE_H * 2.3 + 47.3,
        y * CAVE_SCALE_V * 2.1 + 13.7,
        z * CAVE_SCALE_H * 2.3 + 93.1
      ) + 1
    ) * 0.5;
    const threshold2 = CAVE_THRESHOLD + 0.06;
    if (n2 > threshold2) {
      const t = (n2 - threshold2) / (1 - threshold2);
      density += t * (CAVE_CARVE_STRENGTH * 0.45);
    }
  }

  return density;
}

// ─── Biome vertex colour ──────────────────────────────────────────────────────

const _c = {
  deepWater:    [0.12, 0.22, 0.50],
  shallowWater: [0.22, 0.44, 0.68],
  sand:         [0.74, 0.68, 0.44],
  brightGrass:  [0.40, 0.68, 0.22],
  midGrass:     [0.30, 0.54, 0.17],
  darkGrass:    [0.23, 0.43, 0.13],
  rockBrown:    [0.50, 0.42, 0.30],
  rockGray:     [0.62, 0.59, 0.56],
  cave:         [0.28, 0.24, 0.20],
} as const;

function _lerp3(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  const tc = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * tc,
    a[1] + (b[1] - a[1]) * tc,
    a[2] + (b[2] - a[2]) * tc,
  ];
}

function getBiomeColor(worldY: number, isCave: boolean): [number, number, number] {
  if (isCave) {
    // Cave walls get darker rock tones based on depth
    const darkness = Math.max(0.5, Math.min(1.0, 1.0 + worldY * 0.015));
    return [
      _c.cave[0] * darkness,
      _c.cave[1] * darkness,
      _c.cave[2] * darkness,
    ];
  }

  const h = worldY;
  if (h < -3)        return _lerp3(_c.deepWater, _c.deepWater, 0);
  if (h < -0.5)      return _lerp3(_c.deepWater, _c.shallowWater, (h + 3) / 2.5);
  if (h < 0.4)       return _lerp3(_c.shallowWater, _c.sand, (h + 0.5) / 0.9);
  if (h < 2.5)       return _lerp3(_c.sand, _c.brightGrass, (h - 0.4) / 2.1);
  if (h < 7)         return _lerp3(_c.brightGrass, _c.midGrass, (h - 2.5) / 4.5);
  if (h < 17)        return _lerp3(_c.midGrass, _c.darkGrass, (h - 7) / 10);
  if (h < 28)        return _lerp3(_c.darkGrass, _c.rockBrown, (h - 17) / 11);
  return _lerp3(_c.rockBrown, _c.rockGray, Math.min(1, (h - 28) / 12));
}

// ─── Marching Cubes mesh generation ──────────────────────────────────────────

/**
 * Linear interpolation of a vertex position along an edge.
 * Returns the world-space XYZ position where density = isolevel (0).
 */
function interpolateVertex(
  p1x: number, p1y: number, p1z: number, v1: number,
  p2x: number, p2y: number, p2z: number, v2: number,
): [number, number, number] {
  if (Math.abs(v1) < 1e-5) return [p1x, p1y, p1z];
  if (Math.abs(v2) < 1e-5) return [p2x, p2y, p2z];
  if (Math.abs(v1 - v2) < 1e-5) return [p1x, p1y, p1z];
  const t = -v1 / (v2 - v1);   // solve  v1 + t*(v2-v1) = 0
  return [
    p1x + t * (p2x - p1x),
    p1y + t * (p2y - p1y),
    p1z + t * (p2z - p1z),
  ];
}

/**
 * Generate a THREE.BufferGeometry for a single chunk using Marching Cubes.
 *
 * @param originX  World X of the chunk's minimum corner
 * @param originY  World Y of the chunk's minimum corner
 * @param originZ  World Z of the chunk's minimum corner
 * @returns  BufferGeometry with position, normal, and color attributes, or
 *           null if the chunk is entirely empty or entirely solid.
 */
export function generateChunkGeometry(
  originX: number,
  originY: number,
  originZ: number,
): THREE.BufferGeometry | null {
  const VS = VOXEL_SIZE;
  const CS = CHUNK_SIZE;

  // Pre-sample density at every grid point (CS+1)³ to avoid redundant evaluations
  const dim = CS + 1;
  const densityGrid = new Float32Array(dim * dim * dim);
  const idx = (xi: number, yi: number, zi: number) => xi + yi * dim + zi * dim * dim;

  let allPositive = true;
  let allNegative = true;

  for (let zi = 0; zi <= CS; zi++) {
    for (let yi = 0; yi <= CS; yi++) {
      for (let xi = 0; xi <= CS; xi++) {
        const wx = originX + xi * VS;
        const wy = originY + yi * VS;
        const wz = originZ + zi * VS;
        const d = getVoxelDensity(wx, wy, wz);
        densityGrid[idx(xi, yi, zi)] = d;
        if (d <= 0) allPositive = false;
        if (d >= 0) allNegative = false;
      }
    }
  }

  // Early-out: skip fully solid or fully empty chunks
  if (allPositive || allNegative) return null;

  // Accumulate vertices and colors for the mesh
  const posArr: number[] = [];
  const colArr: number[] = [];

  for (let zi = 0; zi < CS; zi++) {
    for (let yi = 0; yi < CS; yi++) {
      for (let xi = 0; xi < CS; xi++) {

        // Sample densities at the 8 corners of this voxel
        const cornerDensities: number[] = [];
        const cornerWorld: [number, number, number][] = [];

        for (let c = 0; c < 8; c++) {
          const [dx, dy, dz] = cornerOffsets[c];
          const cxi = xi + dx, cyi = yi + dy, czi = zi + dz;
          cornerDensities.push(densityGrid[idx(cxi, cyi, czi)]);
          cornerWorld.push([
            originX + cxi * VS,
            originY + cyi * VS,
            originZ + czi * VS,
          ]);
        }

        // Build the lookup index: bit i set if corner i is below the isosurface
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          if (cornerDensities[c] < 0) cubeIndex |= (1 << c);
        }

        if (edgeTable[cubeIndex] === 0) continue;

        // Compute edge intersection vertices
        const edgeVerts: ([number, number, number] | null)[] = new Array(12).fill(null);
        for (let e = 0; e < 12; e++) {
          if (edgeTable[cubeIndex] & (1 << e)) {
            const [c1, c2] = edgeVertexPairs[e];
            const [p1x, p1y, p1z] = cornerWorld[c1];
            const [p2x, p2y, p2z] = cornerWorld[c2];
            edgeVerts[e] = interpolateVertex(
              p1x, p1y, p1z, cornerDensities[c1],
              p2x, p2y, p2z, cornerDensities[c2],
            );
          }
        }

        // Emit triangles
        const tris = triTable[cubeIndex];
        for (let t = 0; t < tris.length; t += 3) {
          if (tris[t] === -1) break;

          const v0 = edgeVerts[tris[t]]!;
          const v1 = edgeVerts[tris[t + 1]]!;
          const v2 = edgeVerts[tris[t + 2]]!;

          posArr.push(v0[0], v0[1], v0[2]);
          posArr.push(v1[0], v1[1], v1[2]);
          posArr.push(v2[0], v2[1], v2[2]);

          // Determine if this triangle face is a cave interior.
          // A face is considered cave if its average Y is clearly below the
          // local surface height (more than 3 units underground).
          for (let vi = 0; vi < 3; vi++) {
            const vx = [v0, v1, v2][vi];
            const surfY = getTerrainHeight(vx[0], vx[2]);
            const isCave = vx[1] < surfY - 3;
            const col = getBiomeColor(vx[1], isCave);
            colArr.push(col[0], col[1], col[2]);
          }
        }
      }
    }
  }

  if (posArr.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute("color",    new THREE.Float32BufferAttribute(colArr, 3));
  geo.computeVertexNormals();

  return geo;
}

// ─── VoxelTerrain class ───────────────────────────────────────────────────────

/** Result of the terrain generation — wraps the scene group and per-chunk data. */
export interface VoxelTerrainResult {
  /** THREE.Group containing all chunk meshes; add to the scene. */
  group: THREE.Group;
  /**
   * Regenerate the chunk(s) overlapping the given world-space circle.
   * Call this after modifyTerrainHeight to keep the mesh in sync.
   */
  refreshChunksAt: (worldX: number, worldZ: number, radius: number, material: THREE.Material) => void;
}

interface ChunkRecord {
  key: string;
  mesh: THREE.Mesh | null;
  originX: number;
  originY: number;
  originZ: number;
}

/** Compute world-space origin X for a chunk column index. */
function chunkOriginX(cx: number): number {
  const halfWorld = WORLD_SIZE / 2;
  return -halfWorld + cx * CHUNK_WORLD;
}

/** Compute world-space origin Y for a chunk row index. */
function chunkOriginY(cy: number): number {
  return VOXEL_Y_MIN + cy * CHUNK_WORLD;
}

/** Compute world-space origin Z for a chunk column index. */
function chunkOriginZ(cz: number): number {
  const halfWorld = WORLD_SIZE / 2;
  return -halfWorld + cz * CHUNK_WORLD;
}

/**
 * Generate the entire voxel terrain and return a VoxelTerrainResult.
 *
 * This function runs synchronously and may take ~1–2 seconds on large worlds.
 * It replaces the PlaneGeometry terrain in Game3D.tsx.
 *
 * @param material  The ShaderMaterial to apply to all chunk meshes.
 *                  Must declare `attribute vec3 color` in its vertex shader
 *                  to read the embedded biome vertex colours.
 */
export function generateVoxelTerrain(material: THREE.Material): VoxelTerrainResult {
  // Vertex colours are embedded directly in the MC geometry and read via the
  // explicit `attribute vec3 color` declaration in the custom vertex shader.
  // We do NOT set material.vertexColors = true here because Three.js would
  // then inject its own `in vec3 color` declaration into the shader preamble,
  // causing a GLSL "redefinition" compilation error alongside our explicit
  // attribute declaration.  The custom ShaderMaterial reads the color buffer
  // attribute directly, so no Three.js vertexColors handling is required.

  const group = new THREE.Group();
  group.name = "voxelTerrain";

  const halfWorld = WORLD_SIZE / 2;
  const chunksH = Math.ceil(WORLD_SIZE / CHUNK_WORLD) + 1;
  const chunksV = Math.ceil((VOXEL_Y_MAX - VOXEL_Y_MIN) / CHUNK_WORLD);

  const chunkMap = new Map<string, ChunkRecord>();

  // Generate all chunks
  for (let cy = 0; cy < chunksV; cy++) {
    for (let cz = 0; cz < chunksH; cz++) {
      for (let cx = 0; cx < chunksH; cx++) {
        const ox = chunkOriginX(cx);
        const oy = chunkOriginY(cy);
        const oz = chunkOriginZ(cz);

        // Broad-phase: skip if chunk is entirely outside the world square
        if (ox > halfWorld + CHUNK_WORLD || ox + CHUNK_WORLD < -halfWorld) continue;
        if (oz > halfWorld + CHUNK_WORLD || oz + CHUNK_WORLD < -halfWorld) continue;

        const key = `${cx},${cy},${cz}`;
        const geo = generateChunkGeometry(ox, oy, oz);

        let mesh: THREE.Mesh | null = null;
        if (geo) {
          mesh = new THREE.Mesh(geo, material);
          mesh.receiveShadow = true;
          mesh.name = `voxelChunk_${key}`;
          group.add(mesh);
        }

        chunkMap.set(key, { key, mesh, originX: ox, originY: oy, originZ: oz });
      }
    }
  }

  /**
   * Regenerate chunk meshes that overlap the given world circle.
   * Called after bomb craters or terrain sculpting.
   */
  function refreshChunksAt(
    worldX: number,
    worldZ: number,
    radius: number,
    mat: THREE.Material,
  ): void {
    for (const record of chunkMap.values()) {
      const { originX, originY, originZ, key } = record;
      // Cheap AABB-circle overlap test (XZ only)
      const closestX = Math.max(originX, Math.min(worldX, originX + CHUNK_WORLD));
      const closestZ = Math.max(originZ, Math.min(worldZ, originZ + CHUNK_WORLD));
      const dx = worldX - closestX;
      const dz = worldZ - closestZ;
      if (dx * dx + dz * dz > (radius + CHUNK_WORLD) * (radius + CHUNK_WORLD)) continue;

      // Regenerate this chunk
      const newGeo = generateChunkGeometry(originX, originY, originZ);

      if (record.mesh) {
        group.remove(record.mesh);
        record.mesh.geometry.dispose();
        record.mesh = null;
      }

      if (newGeo) {
        const newMesh = new THREE.Mesh(newGeo, mat);
        newMesh.receiveShadow = true;
        newMesh.name = `voxelChunk_${key}`;
        group.add(newMesh);
        record.mesh = newMesh;
      }
    }
  }

  return { group, refreshChunksAt };
}

/**
 * Return all chunk meshes in a VoxelTerrainResult's group.
 * Useful for building a raycasting target list.
 */
export function getVoxelChunkMeshes(group: THREE.Group): THREE.Mesh[] {
  return group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
}
