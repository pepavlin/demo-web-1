# Shovel – Terrain Digging System

## Overview

The shovel is a specialised tool (weapon slot [8]) that lets the player excavate
the Marching Cubes voxel terrain in real-time, digging tunnels and holes through
solid ground.

---

## Architecture

### 1. Density Override Map (`lib/voxelTerrain.ts`)

The Marching Cubes terrain computes a signed density value at every voxel grid
point on-the-fly from:

```
density = y - surfaceHeight(x, z)  +  caveNoise(x, y, z)
```

`density < 0` → solid (inside)
`density > 0` → air (outside)

To support digging, a **sparse density override map** is layered on top:

```typescript
const _densityOverrides = new Map<string, number>();
```

The map key encodes the grid point as integer voxel indices:

```typescript
function _densityKey(wx, wy, wz):
  gx = round((wx + WORLD_SIZE/2) / VOXEL_SIZE)
  gy = round((wy - VOXEL_Y_MIN)  / VOXEL_SIZE)
  gz = round((wz + WORLD_SIZE/2) / VOXEL_SIZE)
  return `${gx},${gy},${gz}`
```

In `getVoxelDensity()` the override is applied **before** cave noise:

```typescript
if (_densityOverrides.size > 0) {
  const override = _densityOverrides.get(_densityKey(x, y, z));
  if (override !== undefined) density += override;
}
```

### 2. `digVoxelSphere(cx, cy, cz, radius)`

Iterates over all voxel grid points within `radius` world units of the centre
and sets their override to `DIG_STRENGTH = 40.0`. This large positive value
ensures any solid voxel (even at depth) flips to air.

After calling `digVoxelSphere`, the caller must call
`voxelTerrainResult.refreshChunksAt(cx, cz, radius + 32, mat)` to regenerate
affected chunk meshes.

### 3. Shovel Weapon Config (`lib/gameTypes.ts`)

```typescript
shovel: {
  type:             "shovel",
  label:            "Lopata",
  damage:           20,       // light melee if an enemy is hit
  range:            3.5,      // max raycast reach in world units
  cooldown:         0.7,      // seconds between digs
  bulletSpeed:      0,        // no projectiles
  terrainDigRadius: 2.5,      // sphere radius per dig (world units)
  color:            "#a3a3a3",
}
```

### 4. Dig Flow in `doAttack()` (`components/Game3D.tsx`)

```
1. Player clicks / holds mouse button
2. doAttack() fires (shovel cooldown = 0.7 s)
3. Raycast from camera centre into voxelTerrainResult.chunkMeshes
4. If hit within range × 2:
     digVoxelSphere(hit.x, hit.y, hit.z, terrainDigRadius)
     refreshChunksAt(hit.x, hit.z, terrainDigRadius + 32, mat)
5. Sound: earthy thud + soil scrape
6. Swing animation plays (reuses swordSwingTimerRef)
```

---

## Files Changed

| File | Change |
|------|--------|
| `lib/voxelTerrain.ts` | Added `_densityOverrides`, `_densityKey`, override check in `getVoxelDensity`, exported `digVoxelSphere` + `resetDensityOverrides` |
| `lib/gameTypes.ts` | Added `"shovel"` to `WeaponType`, `terrainDigRadius?` to `WeaponConfig`, shovel entry in `WEAPON_CONFIGS` |
| `lib/meshBuilders.ts` | Added `buildShovelMesh()` — wooden D-grip handle with steel blade |
| `lib/soundManager.ts` | Added `_playShovelDig()` (earthy thud + gritty scrape), dispatched via `playAttack("shovel")` |
| `components/WeaponSelect.tsx` | Added `ShovelSVG`, shovel meta/stats, key `[8]`, 8-column grid |
| `components/Game3D.tsx` | Shovel in FP/TP configs, weapon order, dig logic, HUD slot, swing animation |
| `lib/airdropSystem.ts` | Shovel added to weapon loot table (weight 3) |
| `__tests__/shovelDigging.test.ts` | 20 unit tests for digging mechanics, config, and mesh |

---

## Performance Notes

- The override map is **sparse** — only modified voxel grid points are stored.
  A dig of radius 2.5 affects at most ~4³ ≈ 64 grid points.
- `_densityOverrides.size > 0` guard prevents any hash lookup when no digging
  has occurred yet.
- `refreshChunksAt` only regenerates chunks that overlap the dig area — at most
  2–4 chunks per dig in typical terrain.

---

## Controls

| Key / Action | Effect |
|---|---|
| `[8]` | Equip shovel |
| Scroll wheel (cycle) | Includes shovel in weapon rotation |
| Left click / hold | Dig where you're looking (max range 7 world units) |
| Airdrop loot | Can receive shovel (weight 3) |
