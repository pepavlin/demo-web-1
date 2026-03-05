# World Items System

Pickable and placeable objects that exist in the 3D world.

## Overview

Players can pick up specific objects (e.g. pumpkins) scattered around the world, carry them in their hand, and place them at any target location. Placements are saved to `localStorage` and restored on reload.

## Architecture

### Data Types (`lib/gameTypes.ts`)

| Type | Description |
|------|-------------|
| `WorldItemType` | Union type of all placeable item types (`"pumpkin"`) |
| `WorldItem` | Runtime item: `id`, `type`, `mesh`, `isHeld` |
| `PlacedWorldItemData` | Serialisable snapshot: `type`, `x`, `y`, `z`, `rotY` |

### Mesh Builder (`lib/meshBuilders.ts`)

`buildPumpkinMesh(scale = 1.0): THREE.Group`

- Builds a pumpkin from primitive geometries: flattened body sphere, 4 rib spheres, cylindrical stem, torus leaf curl.
- Call with `scale = 1.0` for world placements and `scale = 0.55` for the hand-held first-person view.

### Persistence (`lib/buildingSystem.ts`)

| Function | Description |
|----------|-------------|
| `saveWorldItems(items)` | Serialises placed item data to `localStorage` (key `game3d_world_items_v1`) |
| `loadWorldItems()` | Restores saved items; validates type and numeric fields; returns `[]` on missing/invalid data |

### Game Logic (`components/Game3D.tsx`)

**Constants**

| Constant | Value | Description |
|----------|-------|-------------|
| `PICKUP_RADIUS` | 2.8 | Distance within which E key picks up items |
| `PUMPKIN_COUNT` | 6 (desktop) / 3 (mobile) | Default world spawns |
| `HELD_ITEM_POS` | `(0.28, -0.30, -0.55)` | Camera-local position of hand mesh |

**Refs**

| Ref | Type | Description |
|-----|------|-------------|
| `worldItemsRef` | `WorldItem[]` | All items in the scene |
| `heldItemRef` | `WorldItem \| null` | Currently held item |
| `heldItemHandMeshRef` | `THREE.Group \| null` | Camera-attached hand mesh |
| `itemPlacementGhostRef` | `THREE.Group \| null` | Ghost preview for placement |
| `nearestPickableItemRef` | `WorldItem \| null` | Nearest item within pickup radius |

**State**

| State | Type | Description |
|-------|------|-------------|
| `nearItemPrompt` | `WorldItemType \| null` | Drives pickup HUD prompt |
| `heldItemType` | `WorldItemType \| null` | Drives held-item HUD indicator |

## Controls

| Key / Action | Behaviour |
|---|---|
| `E` near item (empty-handed) | Pick up the nearest item |
| `E` while holding | Drop item at player's feet |
| `Left Click` / `F` while holding | Raycast-place item on terrain surface |

## Player State Interactions

- **Cannot attack** while holding an item (`doAttack` guards `heldItemRef.current`).
- **Weapon mesh hidden** while holding; restored when item is placed/dropped.
- **Ghost preview hidden** during build mode, in boat, on rocket, or in space station.
- **Cannot pick up items** while possessing a sheep or aboard a vehicle.

## Initialization

1. Ghost mesh created once and added to scene (invisible by default).
2. Saved items loaded from `localStorage` via `loadWorldItems()`.
3. If no saved items, default spawn positions are used (fixed coordinates near landmarks).

## Saving

Placements are saved after every `placeHeldItem()` call. Only non-held items are serialised. The save includes absolute world position and Y rotation.
