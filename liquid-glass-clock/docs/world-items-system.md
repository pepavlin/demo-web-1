# World Items System

Pickable and placeable objects that exist in the 3D world.

## Overview

Players can pick up specific objects (e.g. pumpkins) scattered around the world, carry them in their hand, and place them at any target location. Placements are saved to `localStorage` and restored on reload.

## Architecture

### Data Types (`lib/gameTypes.ts`)

| Type | Description |
|------|-------------|
| `WorldItemType` | Union type of all pickable item types (`"pumpkin" \| "bomb" \| "ground_weapon"`) |
| `WorldItem` | Runtime item: `id`, `type`, `mesh`, `isHeld`, optional `weaponType`, optional `onBulletHit` |
| `PlacedWorldItemData` | Serialisable snapshot: `type`, `x`, `y`, `z`, `rotY` |

#### `ground_weapon` items

Items with `type === "ground_weapon"` represent weapons lying on the ground. They:
- Have a `weaponType: WeaponType` field identifying which weapon they are
- Are rendered as the weapon mesh rotated flat + a green glow ring underneath
- Are picked up with `[E]` key into the **active weapon slot** (not held in hand like pumpkins)
- The weapon previously in the active slot is **dropped to the ground** as a new `ground_weapon`
- Are **not persisted** to `localStorage` — fresh spawns every session

#### `WorldItem.onBulletHit`

Optional callback invoked when a projectile (bullet or arrow) hits the item:

```typescript
onBulletHit?: (bullet: BulletData) => boolean;
```

- Return `true` → consume the bullet (it stops at this item).
- Return `false` → bullet continues (pass-through).
- `undefined` (default) → item is not hittable by projectiles.

Held items (`isHeld: true`) are always skipped — the check only runs for items placed in the world.

### Mesh Builder (`lib/meshBuilders.ts`)

`buildPumpkinMesh(scale = 1.0): THREE.Group`

- Builds a pumpkin from primitive geometries: flattened body sphere, 4 rib spheres, cylindrical stem, torus leaf curl.
- Call with `scale = 1.0` for world placements and `scale = 0.55` for the hand-held first-person view.

### Persistence (`lib/worldItemsPersistence.ts`)

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
- **Ghost preview hidden** while in boat, on rocket, or in space station.
- **Cannot pick up items** while possessing a sheep or aboard a vehicle.

## Initialization

1. Ghost mesh created once and added to scene (invisible by default).
2. Saved items loaded from `localStorage` via `loadWorldItems()`.
3. If no saved items, default spawn positions are used (fixed coordinates near landmarks).

## Saving

Placements are saved after every `placeHeldItem()` call. Only non-held items are serialised. The save includes absolute world position and Y rotation.

## Bomb Explosion on Bullet Hit

All bomb `WorldItem`s are created with an `onBulletHit` callback that:

1. Removes the bomb from `worldItemsRef` (prevents double-hit).
2. Removes the bomb mesh from the scene.
3. Calls `spawnBombExplosion(scene, position)` — same explosion as a thrown bomb
   (full blast radius damage, crater deformation, visual effects).
4. Returns `true` — the projectile is consumed.

**Hit radius**: `0.6` world units (checked in the bullet update loop before the
solid-collider checks).
