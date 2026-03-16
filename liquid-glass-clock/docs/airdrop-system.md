# Airdrop System

Every 40 seconds a supply crate drops from the sky on a parachute, lands near the host player, and contains random loot.  The spawn is **server-authoritative**: all connected clients receive the same world coordinates at the same moment so every player sees the identical crate.

## Overview

The airdrop system adds a recurring world event: a military supply crate falls from altitude 200 with a parachute, lands at a random position 35–65 units from the host player, and can be looted by walking up to it.  Multiple crates can be active simultaneously.  An unopened crate despawns after 120 seconds.

### Multiplayer Synchronisation

Periodic airdrop spawning is controlled **entirely by the server** (`server.mjs`):

1. The server runs a `setInterval` at `AIRDROP_INTERVAL_MS = 40 000 ms`.
2. On each tick it picks a landing position relative to the host player's last known coordinates (or map centre if unavailable) and emits `crate:spawn` to **all** clients with the same `{x, z}`.
3. The server also emits `crate:timer { elapsed: 0 }` to reset every client's HUD countdown simultaneously.
4. When a new player joins they receive `crate:timer { elapsed: <seconds since last drop> }` so their countdown immediately shows the correct value.
5. A separate **welcome crate** is dropped for every connecting player (`playerName` set); periodic drops use an empty `playerName`.

Clients never spawn periodic airdrops locally — they only spawn crates in response to `crate:spawn` socket events.

## Files

| File | Role |
|------|------|
| `server.mjs` | **Server-side periodic timer** — emits `crate:spawn` and `crate:timer` to all clients |
| `lib/airdropSystem.ts` | Constants, loot table, `pickRandomLoot()`, `findAirdropLandingPosition()` |
| `lib/gameTypes.ts` | `AirdropData`, `AirdropState`, `AirdropLoot`, `AirdropLootType` types |
| `lib/meshBuilders.ts` | `buildAirdropCrateMesh()`, `buildParachuteMesh()` |
| `components/Game3D.tsx` | Game loop integration: spawn on `crate:spawn` event, descent, loot application |
| `hooks/useMultiplayer.ts` | `onCrateSpawn` and `onCrateTimer` callbacks wired to socket events |
| `__tests__/airdropSystem.test.ts` | Unit tests |
| `__tests__/useMultiplayer.test.tsx` | Socket event tests incl. `crate:timer` |

## Life Cycle

```
[server setInterval fires every 40 s]
        │
        ▼
  server: pick {x,z} 35–65 u from host player
  server: io.emit("crate:spawn", { x, z, playerName: "" })
  server: io.emit("crate:timer", { elapsed: 0 })
        │
        ▼  (every connected client)
  handleCrateSpawn(x, z)
  spawnAirdropCrateAt(x, z)      ← same coords on all clients
  airdropTimerRef.current = 0    ← HUD countdown reset via handleCrateTimer
        │
        ▼
  Spawn crate + parachute at Y=200
  Spawn beacon ring on terrain
  Show "Zásobovací bedna padá z nebe!" notification
        │
        ▼  (falling — ~79 s at 2.5 u/s)
  Crate descends at 2.5 units/s (parachute dampening via physics maxFallSpeed)
  Parachute sways gently
  Beacon pulses
        │
        ▼  (landed)
  Physics body replaced with slide body
  Show "Bedna přistála!" notification
  Beacon pulses slowly
        │
   player within 3.2 u?
   ├─ YES → open crate → apply loot → show loot notification → despawn
   └─ NO  → wait up to 120 s → auto-despawn
```

### Player-Join Welcome Crate (separate from periodic)

```
[player joins]
        │
        ▼
  server: io.emit("crate:spawn", { x, z, playerName: "PlayerName" })
  server: socket.emit("crate:timer", { elapsed: <seconds since last periodic drop> })
        │
        ▼  (every connected client)
  handleCrateSpawn(x, z)
  Show "📦 Zásoby pro PlayerName padají z nebe!"
  (joining player's HUD countdown is synced to current server timer)
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

## Constants

### `lib/airdropSystem.ts` (client-side)

| Constant | Value | Description |
|----------|-------|-------------|
| `AIRDROP_INTERVAL` | 40 s | Must match server `AIRDROP_INTERVAL_MS / 1000` for HUD sync |
| `AIRDROP_SPAWN_HEIGHT` | 200 | Starting Y (sky) |
| `AIRDROP_FALL_SPEED` | 2.5 u/s | Parachute terminal velocity (via physics maxFallSpeed) |
| `AIRDROP_OPEN_RADIUS` | 3.2 u | Player proximity required to open |
| `AIRDROP_DESPAWN_TIME` | 120 s | Auto-despawn if unopened |
| `AIRDROP_SPAWN_DIST_MIN` | 35 u | Minimum distance from reference player (server-side) |
| `AIRDROP_SPAWN_DIST_MAX` | 65 u | Maximum distance from reference player (server-side) |
| `AIRDROP_SPAWN_ATTEMPTS` | 12 | Max tries to find valid land position (client helper only) |

### `server.mjs` (server-side)

| Constant | Value | Description |
|----------|-------|-------------|
| `AIRDROP_INTERVAL_MS` | 40 000 ms | Server interval — drives the synchronized periodic timer |
| `AIRDROP_DIST_MIN` | 35 u | Matches `AIRDROP_SPAWN_DIST_MIN` |
| `AIRDROP_DIST_MAX` | 65 u | Matches `AIRDROP_SPAWN_DIST_MAX` |

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
- `airdropTimerRef` — elapsed seconds since last drop; clamped to `AIRDROP_INTERVAL`.  Used for the HUD countdown display only — **never triggers local spawns**.  Updated by server `crate:timer` events via `handleCrateTimer`.
- `airdropListRef` — list of all active `AirdropData` entries

**Socket callbacks**
- `handleCrateSpawn(data)` — spawns the crate mesh + physics body at `{data.x, data.z}`, shows notification.  `data.playerName` empty = periodic drop; non-empty = welcome crate.
- `handleCrateTimer(elapsed)` — sets `airdropTimerRef.current = elapsed` to sync HUD countdown.

**State (React)**
- `airdropCountdown` — value of `airdropTimerRef`, updated at HUD refresh rate (~2 Hz)
- `airdropPhase` — `'falling' | 'landed' | null`
- `airdropDespawnTimer` — seconds since landing
- `airdropIncoming` / `airdropLandedMsg` / `airdropOpenedMsg` — notifications

**HUD elements**
- `AIRDROP_INTERVAL - airdropCountdown` s countdown to next drop (bottom-left stats panel)
- "Bedna padá!" / "Přistála!" status in stats panel
- "📦 Zásobovací bedna padá z nebe!" announcement notification (top-centre)
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
