# Space Station Interior

An explorable interior scene accessible after arriving at the Mothership via rocket.

---

## Overview

When the rocket reaches the Mothership (`state = 'arrived'`), the player is prompted to press `[E]` to enter the space station. This transitions the player into a fully walkable multi-room interior rendered as a Three.js group positioned at `Y = 2000` (above the exterior world, completely occluded by fog).

Pressing `[E]` near the Airlock returns the player to the exterior world.

---

## Layout

```
[Airlock] ──── [Main Corridor] ──── [Bridge]
                     │
          ┌──────────┴──────────┐
   [Crew Quarters]    [Engineering Bay]
```

| Room | Local X range | Local Z range | Floor Y |
|------|---------------|---------------|---------|
| Airlock | -5 .. 5 | -5 .. 5 | 0 |
| Main Corridor | 5 .. 35 | -3 .. 3 | 0 |
| Bridge | 35 .. 58 | -12 .. 12 | 0 |
| Crew Quarters | 10 .. 28 | 3 .. 20 | 0 |
| Engineering Bay | 8 .. 32 | -22 .. -3 | 0 |

All coordinates are in the station group's local space.

---

## World Position

The station group is placed at `(SPACE_STATION_WORLD_X, SPACE_STATION_WORLD_Y, SPACE_STATION_WORLD_Z)` = `(0, 2000, 0)` in world space. At this altitude, the exterior world (Y ≈ 0–170) is ≈ 99.9% occluded by the scene's `FogExp2` (density 0.003), making it invisible to the player.

---

## Key Rooms

### Airlock
- Entry and exit point for the station
- Outer door visual with warning stripe on floor
- Control panel on wall
- Status light (green = safe)

### Main Corridor
- 30-unit long passage connecting all wings
- Ceiling pipe network with glowing blue nodes
- Storage lockers along right wall
- Windows to space along left wall (star fields visible)

### Bridge
- Command centre at far end of corridor
- Panoramic window showing stars and planet
- Captain's chair in centre
- Semicircle of consoles facing the window
- Central holographic display (spinning planet projection)
- Multiple wall display panels

### Crew Quarters
- 4 bunk beds (upper and lower bunks)
- Personal lockers with status screens
- Round porthole window
- Reading lights above bunks

### Engineering Bay
- Central reactor column with glowing core
- 3 animated energy rings around reactor
- Pipe network radiating from reactor
- Equipment racks with LED indicators
- 4 engineering consoles

---

## Implementation

### Mesh Builder (`lib/meshBuilders.ts`)

`buildSpaceStationInterior()` returns:

```typescript
interface SpaceStationInteriorResult {
  group: THREE.Group;         // root group (positioned at station world origin)
  rooms: THREE.Box3[];        // walkable AABB boxes in group-local space
  spawnPosition: THREE.Vector3; // player spawn point in local space (0, 1.8, 0)
  lights: {                   // point lights for flicker animation
    light: THREE.PointLight;
    baseIntensity: number;
    phase: number;
  }[];
  animatedMeshes: {           // meshes driven each frame
    mesh: THREE.Mesh;
    type: 'hologram' | 'reactor' | 'panel';
  }[];
  doors: StationDoor[];       // interactive sliding doors between rooms
}

interface StationDoor {
  panels: [THREE.Mesh, THREE.Mesh];      // left/right sliding panels
  closedPos: [THREE.Vector3, THREE.Vector3]; // panel positions when closed
  openPos: [THREE.Vector3, THREE.Vector3];   // panel positions when open
  localPos: THREE.Vector3;               // door centre in group-local space
  axis: 'x' | 'z';                      // axis player crosses through door
}
```

### Sliding Doors

Four interactive doors separate the rooms at their boundaries. Each door consists of two metallic panels with blue glowing edge stripes that slide apart into the door-frame pillars when opened.

| Door | Position (local) | Axis | Connects |
|------|-----------------|------|---------|
| Airlock → Corridor | X=5, Z=0 | x | Airlock ↔ Main Corridor |
| Corridor → Bridge | X=35, Z=0 | x | Main Corridor ↔ Bridge |
| Corridor → Crew Quarters | X=19, Z=3 | z | Main Corridor ↔ Crew Quarters |
| Corridor → Engineering | X=19, Z=-3 | z | Main Corridor ↔ Engineering Bay |

**Interaction:** Press `[E]` within 2.5 units of a door to toggle it open/closed.
A green glowing button panel is mounted on the wall beside each door.

**Animation:** Panels lerp between closed and open positions at 3× lerp speed per second (smooth ~0.33 s open/close).

### Game State (`components/Game3D.tsx`)

New refs and state:

| Name | Type | Purpose |
|------|------|---------|
| `spaceStationGroupRef` | `THREE.Group \| null` | Interior root group |
| `spaceStationRoomsRef` | `THREE.Box3[]` | Room collision volumes |
| `spaceStationLightsRef` | array | Light references for animation |
| `spaceStationAnimMeshesRef` | array | Mesh references for animation |
| `spaceStationDoorsRef` | `StationDoor[]` | Door mesh references |
| `stationDoorStateRef` | `{ isOpen, progress }[]` | Per-door animation state |
| `nearStationDoorIdxRef` | `number` | Index of closest door (-1 = none) |
| `inSpaceStationRef` | `boolean` ref | True while player is inside |
| `rocketArrivedRef` | `boolean` ref | Synced with `rocketArrived` state |
| `inSpaceStation` | `boolean` state | Drives UI visibility |
| `nearAirlockExit` | `boolean` state | Drives exit prompt |
| `nearStationDoor` | `'open' \| 'close' \| null` | Drives door interaction prompt |

### Movement & Collision

When `inSpaceStationRef.current` is true, a dedicated movement block replaces normal terrain-based movement:

1. Apply WASD movement vector
2. Convert camera position to station-local space: `localX = cam.x - SPACE_STATION_WORLD_X`
3. Check if player is inside at least one room (XZ AABB check)
4. If movement leaves all rooms, attempt axis-separated sliding (X-only, then Z-only)
5. Apply gravity; floor clamped at `SPACE_STATION_WORLD_Y + PLAYER_HEIGHT`
6. Ceiling clamped at `SPACE_STATION_WORLD_Y + 5.8`
7. Jump allowed from floor

### Animation

Each frame while in the station:
- **Lights**: flicker via `sin()` curve with per-light phase offset
- **Hologram meshes**: slow Y-axis rotation + subtle scale pulse
- **Reactor meshes**: faster rotation + emissive intensity pulsing with `sin()`
- **Panel meshes**: random rare blink effect simulating indicator activity

### Entry / Exit Flow

**Enter:**
1. Player presses `[E]` while `rocketArrivedRef.current === true`
2. `inSpaceStationRef.current = true`, `setInSpaceStation(true)`
3. `setRocketArrived(false)`, `rocketArrivedRef.current = false`
4. Camera teleported to `(SPACE_STATION_WORLD_X + 0, SPACE_STATION_WORLD_Y + 1.8, SPACE_STATION_WORLD_Z + 0)`
5. Weapon mesh hidden

**Exit (Airlock):**
1. Player is in Airlock area (local |X| ≤ 5.5, |Z| ≤ 5.5) — `nearAirlockExit = true`
2. Player presses `[E]`
3. `inSpaceStationRef.current = false`, `setInSpaceStation(false)`
4. Camera returned to rocket vicinity at Mothership
5. `rd.state = 'arrived'`, `setRocketArrived(true)` — player can re-enter or re-launch

---

## Tests

### `__tests__/spaceStation.test.ts`

Covers:
- `RocketState` type includes `'docked'` (6 valid states)
- Room collision helper correctly identifies positions inside/outside each room
- Spawn position is inside the Airlock room
- Station world Y ensures exterior is ≈ 99.9% fogged
- Light flicker formula stays within reasonable intensity bounds
- All animated mesh types are valid (`hologram | reactor | panel`)
- Hologram and reactor mesh lists are non-empty

### `__tests__/meshBuilders.test.ts` — `describe("buildSpaceStationInterior")`

Covers:
- Return type shape (group, rooms, spawnPosition, lights, animatedMeshes)
- At least 5 rooms defined
- All rooms are non-empty `THREE.Box3` with positive size in all axes
- Spawn position is inside the Airlock room XZ footprint
- Spawn Y is in standing-height range (1.5 – 4.0)
- Group has > 50 mesh children
- All lights reference `THREE.PointLight` with positive base intensity
- All lights are descendants of the group
- All animated meshes are `THREE.Mesh` instances with valid type strings
- At least one mesh of each type (`hologram`, `reactor`, `panel`)
- All animated meshes are descendants of the group
- Airlock room centre is near origin
- Bridge room extends to X ≥ 50

### `__tests__/spaceStation.test.ts` — sliding doors

Covers:
- Exactly 4 doors returned by builder
- Each door has exactly 2 panel meshes (THREE.Mesh instances)
- Valid `closedPos` and `openPos` arrays (THREE.Vector3)
- Door axis is `'x'` or `'z'`
- Open positions are farther apart than closed positions
- Door `localPos` matches expected room boundary coordinates
- Animation lerp at progress=0 yields closed position
- Animation lerp at progress=1 yields open position
- Proximity detection: at door centre → within interact radius
- Proximity detection: 5 units away → outside interact radius

### `__tests__/Game3D.test.tsx` — space station UI

Covers:
- Station entry prompt not visible at game start
- Station active banner not visible at game start
- Airlock exit prompt not visible at game start
