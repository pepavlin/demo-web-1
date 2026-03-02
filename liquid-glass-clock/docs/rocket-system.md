# Rocket System

A rideable rocket located in the world that allows the player to travel to the Mothership floating high above.

---

## Overview

A single rocket sits on a launch pad near the world center (X=8, Z=-28). The player can approach it, board it, then initiate a launch sequence. The rocket flies up toward the Mothership positioned at Y≈170 above the world.

---

## States

| State | Description |
|-------|-------------|
| `idle` | Rocket is parked on the pad, proximity prompt shown to nearby players |
| `boarded` | Player is inside the rocket; launch banner visible; Space to launch, E to exit |
| `countdown` | 3 → 2 → 1 countdown displayed; engine ignites; rocket shakes |
| `launching` | Rocket moves upward toward Mothership (12-second flight) |
| `arrived` | Rocket docked near Mothership; player exits to space |

---

## Key Constants (Game3D.tsx)

| Constant | Value | Purpose |
|----------|-------|---------|
| `ROCKET_BOARD_RADIUS` | 8 | Distance at which boarding prompt appears |
| `ROCKET_CAM_HEIGHT` | 6.0 | Camera height inside the rocket |
| `ROCKET_SPAWN_X` | 8 | Launch pad world X |
| `ROCKET_SPAWN_Z` | -28 | Launch pad world Z |
| `ROCKET_TARGET_Y` | 165 | Target altitude (Mothership base) |
| `ROCKET_FLIGHT_DURATION` | 12 | Seconds for full ascent |

---

## Architecture

### Data Type (gameTypes.ts)

```typescript
export type RocketState = 'idle' | 'boarded' | 'countdown' | 'launching' | 'arrived';

export interface RocketData {
  mesh: THREE.Group;         // root group
  flameGroup: THREE.Group;   // engine flame — toggled visible on launch
  launchPadMesh: THREE.Group; // launch pad beneath rocket
  state: RocketState;
  launchProgress: number;    // 0–1 during flight
  groundY: number;           // Y coord of launch pad
  countdown: number;         // 3→0 during countdown
  countdownTimer: number;    // accumulates seconds between ticks
  exhaustParticles: THREE.Mesh[]; // animated smoke puffs
}
```

### Mesh Builder (meshBuilders.ts)

`buildRocketMesh()` returns:
- **group** — root `THREE.Group` containing all rocket parts
- **flameGroup** — sub-group for engine flame animation (hidden by default)
- **launchPad** — concrete slab + gantry tower + crossbeams
- **exhaustParticles** — 8 smoke puff meshes for animation

Rocket body anatomy (Y measured from ground):
- `0–0.5` — concrete launch pad slab
- `0.5–9` — cylindrical rocket body with two red accent stripes
- `9–12` — nose cone
- `~12.3` — red tip
- Porthole window at Y≈7.5
- 4 swept fins at base
- Ladder rungs on one side
- Engine nozzle at base
- Flame cone assembly below nozzle (hidden)

### Update Loop (Game3D.tsx)

Handles all rocket state transitions each frame:

1. **idle** — proximity detection, sets `nearRocketForBoardRef` and `nearRocketPrompt`
2. **boarded** — camera locked inside cabin at `groundY + ROCKET_CAM_HEIGHT`
3. **countdown** — 1-second ticks via `countdownTimer`, pre-ignition camera shake
4. **launching** — ease-in-out flight from `groundY` → `ROCKET_TARGET_Y`, flame animation, camera shake during ascent; on arrival: player placed near Mothership, `rocketArrived` shown
5. **arrived** — rocket parked near Mothership with subtle vertical drift

### Controls

| Key | Action |
|-----|--------|
| `E` | Board rocket (when nearby in idle state) |
| `E` | Exit rocket (when in idle/boarded state) |
| `Space` | Initiate countdown (when boarded) |

---

## UI Elements

All UI respects `gameState.isLocked` (only shown when pointer is locked).

| Element | Trigger |
|---------|---------|
| `🚀 [E] Nastoupit do rakety` | `nearRocketPrompt && !onRocket && !onBoat && !isPossessed` |
| `🚀 V raketě · [Space] Odpálit · [E] Vystoupit` | `onRocket && !rocketLaunching && rocketCountdown === null` |
| Large countdown number (3/2/1) | `rocketCountdown !== null` |
| `🔥 Startujeme! Letíme k vesmírné lodi...` | `rocketLaunching` |
| `🛸 Přistáli jste u vesmírné lodi!` | `rocketArrived` |

---

## Tests

Tests live in `__tests__/meshBuilders.test.ts` under `describe("buildRocketMesh")`:

- Verifies returned object structure (`group`, `flameGroup`, `launchPad`, `exhaustParticles`)
- Verifies default position at origin
- Verifies `castShadow` / `receiveShadow`
- Verifies flame group is hidden by default
- Verifies all exhaust particles are hidden by default and are `THREE.Mesh` instances
- Verifies minimum mesh count (≥25 meshes covering all parts)
- Verifies structural relationships (launchPad and flameGroup are children of group)
- Verifies all materials are `MeshLambertMaterial`
- Verifies body has white/light color
- Verifies red accent color is present (relative channel comparison)
- Verifies launch pad has minimum structure (≥7 meshes)
- Verifies exhaust particles are in the group hierarchy

Rocket UI tests live in `__tests__/Game3D.test.tsx` under `describe("Rocket system")`:
- Verifies no rocket prompts are visible in the initial (unlocked) state
