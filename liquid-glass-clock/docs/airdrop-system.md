# Airdrop System

Every 5 minutes a supply crate drops from the sky on a parachute, lands near the player, and contains random loot.

## Overview

The airdrop system adds a recurring world event: a military supply crate falls from altitude 80 with a parachute, lands at a random position 35–65 units from the player, and can be looted by walking up to it.  Only one airdrop is active at a time.  An unopened crate despawns after 120 seconds.

## Files

| File | Role |
|------|------|
| `lib/airdropSystem.ts` | Constants, loot table, `pickRandomLoot()`, `findAirdropLandingPosition()` |
| `lib/gameTypes.ts` | `AirdropData`, `AirdropState`, `AirdropLoot`, `AirdropLootType` types |
| `lib/meshBuilders.ts` | `buildAirdropCrateMesh()`, `buildParachuteMesh()` |
| `components/Game3D.tsx` | Game loop integration: timer, spawn, descent, loot application |
| `__tests__/airdropSystem.test.ts` | Unit tests |

## Life Cycle

```
[timer reaches 300 s]
        │
        ▼
   findAirdropLandingPosition()   ← random pos near player, above water
        │
        ▼
  Spawn crate + parachute at Y=80
  Spawn beacon ring on terrain
  Show "Zásobovací bedna!" notification
        │
        ▼  (falling — ~11 s)
  Crate descends at 7 units/s
  Parachute sways gently
  Beacon pulses
        │
        ▼  (landed)
  Parachute settles sideways
  Show "Bedna přistála!" notification
  Beacon pulses slowly
        │
   player within 3.2 u?
   ├─ YES → open crate → apply loot → show loot notification → despawn
   └─ NO  → wait up to 120 s → auto-despawn
```

## Loot System — Guaranteed Weapon + Resource Bonus

Every crate **always** contains **two** loot items:
1. **A weapon** (guaranteed) — goes into the player's active weapon slot (previous weapon drops to ground)
2. **A resource** (bonus) — random coins, wood, or health

### Weapon Loot Pool (randomly selected)

| Weapon | Czech | Weight |
|--------|-------|--------|
| Luk | Bow | 5 |
| Kuše | Crossbow | 4 |
| Kulomet | Machine Gun | 4 |
| Odstřelovačka | Sniper | 3 |
| Sekera | Axe | 2 |
| Lopata | Shovel | 3 |
| Plamenomet | Flamethrower | 2 |

### Resource Bonus Pool (randomly selected)

| Type | Czech label | Reward | Weight |
|------|-------------|--------|--------|
| Coins | Zásobník nábojů | +25–60 mincí | 18 |
| Coins | Bedna nábojů | +60–100 mincí | 14 |
| Wood | Zásoby dřeva | +15–30 dřeva | 18 |
| Wood | Hromada dřeva | +30–55 dřeva | 10 |
| Health | Lékárnička | +40–70 HP | 15 |
| Health | Velká lékárnička | +70–100 HP | 8 |

### API

```typescript
// Always returns [weapon_loot, resource_loot] — 2 items guaranteed
export function pickAirdropLootArray(rng?: () => number): AirdropLoot[]

// Legacy: returns single loot item (used for backward-compatible code paths)
export function pickRandomLoot(rng?: () => number): AirdropLoot
```

### AirdropData type change

`AirdropData.loot` is now `AirdropLoot[]` (array) instead of a single `AirdropLoot`.
The game loop iterates over all loot items and applies each one.

## Constants (`lib/airdropSystem.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `AIRDROP_INTERVAL` | 300 s | Seconds between airdrops |
| `AIRDROP_SPAWN_HEIGHT` | 80 | Starting Y (sky) |
| `AIRDROP_FALL_SPEED` | 7 u/s | Parachute descent speed |
| `AIRDROP_OPEN_RADIUS` | 3.2 u | Player proximity required to open |
| `AIRDROP_DESPAWN_TIME` | 120 s | Auto-despawn if unopened |
| `AIRDROP_SPAWN_DIST_MIN` | 35 u | Minimum distance from player |
| `AIRDROP_SPAWN_DIST_MAX` | 65 u | Maximum distance from player |
| `AIRDROP_SPAWN_ATTEMPTS` | 12 | Max tries to find valid land position |

## Data Types (`lib/gameTypes.ts`)

### `AirdropState`
```typescript
type AirdropState = 'falling' | 'landed' | 'opened';
```

### `AirdropLootType`
```typescript
type AirdropLootType = "coins" | "wood" | "health" | "weapon";
```

### `AirdropLoot`
```typescript
interface AirdropLoot {
  type: AirdropLootType;
  amount: number;          // 0 for weapon
  weaponType?: WeaponType; // set only for weapon type
  label: string;           // Czech display name
}
```

### `AirdropData`
```typescript
interface AirdropData {
  mesh: THREE.Group;         // crate mesh (parachute is a child)
  parachuteMesh: THREE.Group;// parented to crate
  beaconMesh: THREE.Mesh;   // flashing ring on terrain
  state: AirdropState;
  x: number;                 // landing X
  z: number;                 // landing Z
  targetY: number;           // terrain Y at landing
  despawnTimer: number;      // seconds after landing
  beaconAge: number;         // animation accumulator
  loot: AirdropLoot;         // pre-rolled at spawn time
}
```

## Mesh Design (`lib/meshBuilders.ts`)

### `buildAirdropCrateMesh()`
- Olive-green wooden box (1.2 × 1.2 × 1.2 units)
- Dark plank lines on each face
- 8 chrome L-bracket corners (3 arms each)
- 4 yellow nylon straps wrapping the box

### `buildParachuteMesh(ropeLength = 3.0)`
- 8 canopy panels in alternating military green / tan
- Dark vent circle at the apex
- 8 suspension lines from canopy rim to attachment point
- Parented to crate — offset upward by crate height (1.2 u)

## Game Loop Integration (`components/Game3D.tsx`)

**Refs**
- `airdropTimerRef` — accumulates `delta` each frame; resets at spawn
- `airdropRef` — active `AirdropData | null`

**State (React)**
- `airdropCountdown` — elapsed seconds, updated at HUD refresh rate (~2 Hz)
- `airdropPhase` — `'falling' | 'landed' | null`
- `airdropDespawnTimer` — seconds since landing
- `airdropIncoming` / `airdropLandedMsg` / `airdropOpenedMsg` — notifications

**HUD elements**
- Countdown to next drop (bottom-left stats panel)
- "Bedna padá!" / "Přistála!" status in stats panel
- "Zásobovací bedna!" announcement banner (top-centre)
- "Přijdi blíž a otevři zásobovací bednu" proximity prompt (bottom-centre)
- "Bedna otevřena!" loot reward overlay (centre)

## Spawn Position Algorithm

```
for attempt in 0..AIRDROP_SPAWN_ATTEMPTS:
    angle ← random * 2π
    dist  ← AIRDROP_SPAWN_DIST_MIN + random * (MAX - MIN)
    x     ← playerX + cos(angle) * dist
    z     ← playerZ + sin(angle) * dist
    h     ← getTerrainHeight(x, z)
    if h >= WATER_LEVEL + 1.0: return {x, z, terrainY: h}
return null  // player may be surrounded by ocean
```
