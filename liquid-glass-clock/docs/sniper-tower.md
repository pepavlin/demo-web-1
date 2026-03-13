# Sniper Tower

## Overview

The Sniper Tower is a tall stone observation tower located in the northeast corner of the map (world coordinates: X=88, Z=-82). It sits on elevated terrain and features a spiral exterior staircase that the player can ascend to reach the top platform, where a sniper rifle pickup awaits.

## World Position

| Constant | Value |
|----------|-------|
| `SNIPER_TOWER_X` | 88 |
| `SNIPER_TOWER_Z` | -82 |
| `SNIPER_TOWER_HEIGHT` | 16 units |

The tower also appears on the minimap as a 🔭 marker.

## Structure (Mesh)

Built by `buildSniperTowerMesh()` in `lib/meshBuilders.ts`. Returns a `SniperTowerResult`:

```typescript
interface SniperTowerResult {
  group: THREE.Group;
  topPlatformY: number;       // Y of top platform surface (relative to group origin)
  towerBodyRadius: number;    // Radius of the solid stone cylinder (2.8 u)
  stairOuterRadius: number;   // Outer radius of the stair ring (5.0 u)
  stairInnerRadius: number;   // Inner radius of stair ring == towerBodyRadius (2.8 u)
}
```

### Visual Components

1. **Stone cylinder** — `CylinderGeometry`, radius 2.8→3.1, height 16, with decorative mortar bands every 2 units.
2. **Spiral staircase** — 32 stone step boxes arranged in a full helix wrapping the exterior (radius 3.0–5.0). Each step is placed at the correct angle and height.
3. **Stair railing** — 20 metal posts at outer stair radius + spiral handrail segments.
4. **Top platform** — Wide stone disc with wooden plank floor.
5. **Battlements (merlons)** — 12 stone crenellations around the top perimeter.
6. **Sniper rifle display** — The rifle sits on a wooden stand at the top, with a glowing scope lens as a visual hint.
7. **Ambient glow** — `PointLight` (purple, intensity 1.2, radius 8 u) at top to draw player attention.

## Staircase Physics

The spiral staircase is implemented as a virtual ramp in `Game3D.tsx` inside the ground-detection loop:

### Algorithm

When the player stands in the stair ring (`stairInnerRadius ≤ distance ≤ stairOuterRadius`):

```
theta = atan2(playerZ - towerZ, playerX - towerX)   // -PI..PI
theta_normalized = theta < 0 ? theta + 2PI : theta   // 0..2PI
ENTRY_RAD = PI/2  (south entry)
stairFraction = ((theta_normalized - ENTRY_RAD + 2PI) % (2PI)) / (2PI)
stairFloorY = terrainBaseY + stairFraction * SNIPER_TOWER_HEIGHT + PLAYER_HEIGHT
```

The player enters from the south side (angle = π/2) at ground level and spirals counterclockwise (west → north → east → south again) to reach the top.

### Collision

- **Tower body:** Cylinder collider radius = `towerBodyRadius + PLAYER_RADIUS` — prevents entering the solid tower core.
- **No walls on staircase:** The open stair ring allows the player to walk freely counterclockwise/clockwise.
- **Top platform:** Additional ground floor at `topPlatformY` radius check for standing on the platform.

## Sniper Rifle Pickup

When the player reaches the top of the tower (`y >= topPlatformY + PLAYER_HEIGHT - 1.0`, within `SNIPER_PICKUP_RADIUS = 6` units horizontally):

1. The HUD shows: **🔭 [E] Sebrat odstřelovačku**
2. Pressing **[E]** equips the sniper rifle (`selectedWeapon = "sniper"`, `swapWeaponMesh("sniper")`)
3. The player can also start with the sniper by selecting **[4]** in the `WeaponSelect` screen before entering the world.

## Scope Mechanic

While holding the sniper:

- **Right-click hold** → `isScopedRef = true`, hides weapon mesh, smoothly interpolates camera FOV: `DEFAULT_FOV (75°) → SNIPER_SCOPE_FOV (12°)`
- **Overlay** renders: vignette, scope circle, crosshair lines, mil-dot marks, center red dot
- **Movement** is unrestricted while scoped
- **Right-click release** → exits scope, restores FOV

Left-click fires a single shot (no auto-fire).

## Constants (Game3D.tsx)

| Constant | Value | Description |
|----------|-------|-------------|
| `SNIPER_TOWER_X` | 88 | World X |
| `SNIPER_TOWER_Z` | -82 | World Z |
| `SNIPER_PICKUP_RADIUS` | 6 u | Proximity for [E] prompt |
| `SNIPER_SCOPE_FOV` | 12° | Zoomed camera FOV |
| `DEFAULT_FOV` | 75° | Normal camera FOV |
