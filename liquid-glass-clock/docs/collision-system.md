# 3D Collision System

## Overview

The collision system provides **3D primitive colliders** for all major world objects.
Before this upgrade, colliders were 2D (XZ plane only), so players could walk through the vertical extent of buildings and could not stand on top of structures.

The new system supports:
- **3D height-aware horizontal push-out** – players are only pushed sideways if their vertical extent overlaps the collider; standing on top triggers no sideways push.
- **Walkable top surfaces** – flat-roofed buildings, wall tops, and platforms can be marked `walkable: true` so the player can land and stand on them.
- **Terrain mesh collider reference** – the terrain `THREE.Mesh` is stored in `terrainMeshRef` for precise raycasting when needed.
- **City** – `buildCity` is now placed in the world (northeast area) with full 3D building colliders.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `lib/collisionSystem.ts` | 3D collider type definitions + pure resolution functions |
| `lib/meshBuilders.ts` | Extended `RuinsBoxCollider` / `RuinsCylCollider` with height fields |
| `components/Game3D.tsx` | Collision loop + ground detection using the new system |
| `__tests__/collisionSystem.test.ts` | Unit tests for all collision helpers |

---

## Collider Types

### `BoxCollider3D` (`lib/collisionSystem.ts`)

```typescript
interface BoxCollider3D {
  cx: number; cy: number; cz: number;  // world-space centre
  halfW: number; halfH: number; halfD: number;  // half-extents
  rotY: number;     // Y-rotation of the box
  walkable: boolean; // true → player can stand on the top face
}
```

### `CylinderCollider3D`

```typescript
interface CylinderCollider3D {
  x: number; baseY: number; z: number;  // centre at base
  radius: number;   // includes PLAYER_RADIUS (legacy convention)
  height: number;   // full height
  walkable: boolean;
}
```

### `SphereCollider3D`

```typescript
interface SphereCollider3D {
  x: number; y: number; z: number;  // centre
  radius: number;  // includes PLAYER_RADIUS
}
```

---

## Collision Resolution Functions

All functions are **pure** (no side effects, no Three.js dependency) and return a new `{x, z}` position after push-out.

| Function | Description |
|----------|-------------|
| `testOBBXZ(px, pz, cx, cz, halfW, halfD, rotY)` | Tests XZ overlap with an oriented box; returns inside flag + overlap depths |
| `resolveBoxCollision3D(px, py, pz, playerRadius, playerHeight, box)` | Push-out from a 3D box; skips if player is above/below the box |
| `resolveCylinderCollision3D(px, py, pz, playerRadius, playerHeight, cyl)` | Push-out from a 3D cylinder; skips if no vertical overlap |
| `resolveSphereCollision3D(px, py, pz, playerRadius, playerHeight, sphere)` | Push-out from a sphere |
| `getWalkableSurfaceY(px, pz, playerY, playerHeight, playerRadius, boxes, cyls)` | Returns highest walkable surface camera-Y beneath the player, or −∞ |

### Vertical Overlap Check

Horizontal push-out only fires when:
```
playerFeetY (= py - playerHeight)  <  colliderTop - 0.02
  AND
py  >  colliderBottom + 0.02
```

This means a player **standing on top** of a box (feet at box top) is **not** pushed sideways, enabling smooth landing and walking on rooftops.

---

## Ground Detection

The land-physics section in `Game3D.tsx` computes `groundY` as the maximum of:

1. **Terrain** – `getTerrainHeightSampled(x, z) + PLAYER_HEIGHT`
2. **Placed blocks** – `block.y + 0.5 + PLAYER_HEIGHT` (for any block within 0.5 units XZ)
3. **3D walkable colliders** – `getWalkableSurfaceY(...)` from all `BoxCollider3D` and `CylinderCollider3D` with `walkable: true`
4. **Sniper tower staircase** – special-cased angular staircase (unchanged)
5. **Sniper tower top platform** – special-cased platform (unchanged)

If `cam.position.y ≤ groundY` the player snaps to `groundY` and is considered `onGround`.

---

## World Structures and Their Colliders

| Structure | Type | walkable | Notes |
|-----------|------|----------|-------|
| Trees (large) | Cylinder | false | Trunk only, height ≈ 8m |
| Rocks | Cylinder | false | Low, h ≈ 1.5m |
| Windmill | Cylinder | false | h ≈ 10m |
| House | Box | false | Pitched roof — not walkable |
| Ruins walls | Box | **true** | Players can stand on wall tops |
| Ruins columns/arches | Cylinder | false | |
| Lighthouse | Cylinder | false | h ≈ 18m |
| Sniper tower | Cylinder | false | Staircase + platform handled separately |
| Mountain (core) | Cylinder | false | h ≈ 65m |
| Mountain (pool) | Cylinder | false | Low barrier |
| City skyscrapers | Box | **true** | Flat roofs, h = 28–38m |
| City office buildings | Box | **true** | Flat roofs, h = 6–18m |
| City fountain | Cylinder | false | Low barrier |

---

## City Placement

The procedural city (`buildCity`) is placed at **world position (60, 65)** (northeast area).

It uses terrain adaptation (`CityTerrainOptions`) so each building's foundation follows the terrain slope.  All main building bodies are registered with `walkable: true` — the player can jump onto and walk across rooftops.

---

## Mesh Builders: `RuinsBoxCollider` / `RuinsCylCollider`

Both interfaces now carry optional 3D extension fields:

```typescript
interface RuinsBoxCollider {
  lx: number; lz: number; halfW: number; halfD: number; rotY: number;
  ly?: number;       // local Y centre  (default 0)
  halfH?: number;    // half-height     (default 0)
  walkable?: boolean;                   // default false
}

interface RuinsCylCollider {
  lx: number; lz: number; radius: number;
  height?: number;    // full height   (default 0)
  walkable?: boolean; // default false
}
```

When registering in `Game3D.tsx`, defaults are applied with `?? fallback`.

---

## Terrain Collider Mesh

`terrainMeshRef` (a `useRef<THREE.Mesh | null>`) stores the main terrain mesh.
This was already present in the codebase and is used for raycasting in the build/sculpt system.  The terrain height for player physics continues to use `getTerrainHeightSampled(x, z)` (bilinear interpolation on the noise grid), which is equivalent to querying the mesh vertices.  `terrainMeshRef` is available for future slope-normal queries via `THREE.Raycaster`.

---

## Testing

`__tests__/collisionSystem.test.ts` covers:
- `testOBBXZ` – inside/outside detection, overlap values, rotated box
- `resolveBoxCollision3D` – push-out, standing-on-top no-push, below-box no-push
- `resolveCylinderCollision3D` – push-out, vertical skip conditions
- `resolveSphereCollision3D` – push-out
- `getWalkableSurfaceY` – single/multiple boxes, cylinders, non-walkable exclusion, player-below skip
