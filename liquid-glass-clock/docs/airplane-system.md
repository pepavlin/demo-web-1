# 3D Flyable Airplane System

## Overview

The airplane is a fully interactive 3D vehicle the player can board and fly freely through the world.
It uses realistic-feeling physics: throttle, pitch, roll, coordinated yaw, stall, and terrain collision.

---

## Files

| File | Role |
|------|------|
| `lib/meshBuilders.ts` | `buildAirplane3DMesh()` – 3D airplane geometry; `buildAirstripMesh()` – runway markings |
| `lib/gameTypes.ts` | `AirplaneData`, `AirplaneState` types |
| `components/Game3D.tsx` | Scene spawning, boarding/exit logic, per-frame flight simulation, camera |
| `__tests__/airplane3D.test.ts` | Unit tests for mesh builders and type compatibility |

---

## Constants (Game3D.tsx)

| Constant | Value | Purpose |
|----------|-------|---------|
| `AIRPLANE_SPAWN_X/Z` | 50 / 20 | World-space airstrip centre |
| `AIRPLANE_BOARD_RADIUS` | 8 u | Proximity for boarding prompt |
| `AIRPLANE_CRUISE_SPEED` | 28 u/s | Normal forward speed |
| `AIRPLANE_MAX_SPEED` | 55 u/s | Speed with Shift (turbo) |
| `AIRPLANE_STALL_SPEED` | 8 u/s | Below this, stall gravity kicks in |
| `AIRPLANE_ACCEL/DECEL` | 12 / 6 u/s² | Speed change rates |
| `AIRPLANE_PITCH/ROLL_RATE` | 0.9 / 1.2 rad/s | Rotation rates |
| `AIRPLANE_YAW_RATE` | 0.5 rad/s | Turn rate from bank |
| `AIRPLANE_START_HEIGHT` | 2.0 u | Altitude offset above terrain at spawn |

---

## AirplaneData

```ts
interface AirplaneData {
  mesh:      THREE.Group;   // root mesh (yaw/pitch/roll applied each frame)
  propeller: THREE.Mesh;    // propeller group — rotation.z incremented per frame
  state:     AirplaneState; // 'idle' | 'boarded' | 'flying'
  position:  THREE.Vector3; // world-space airplane position
  velocity:  THREE.Vector3; // current movement vector (world space)
  pitch:     number;        // radians — nose up = positive
  yaw:       number;        // radians — heading
  roll:      number;        // radians — banking
  speed:     number;        // forward airspeed (u/s)
  groundY:   number;        // terrain Y at spawn (landing reference)
  spawnX/Z:  number;        // spawn position for reset reference
}
```

---

## Controls (while flying)

| Key | Action |
|-----|--------|
| **W** | Throttle (increase speed toward cruise) |
| **Shift+W** | Turbo throttle (increase speed toward max) |
| **S** | Pitch up (climb) |
| **X** | Pitch down (dive) |
| **A / ←** | Roll left (bank left → coordinated left turn) |
| **D / →** | Roll right (bank right → coordinated right turn) |
| **E** | Exit airplane (player parachutes / falls) |

---

## Physics

1. **Throttle** – `speed` is clamped between 0 and cruise/max speed. Decays automatically when no W pressed.
2. **Pitch / Roll** – Angular rates applied each frame; auto-level toward 0 when no input.
3. **Coordinated yaw** – `yaw += -roll * YAW_RATE * dt` produces smooth banking turns without dedicated rudder input.
4. **Velocity from orientation** – Forward vector computed from `(yaw, pitch)` and scaled by `speed`.
5. **Stall** – When `speed < STALL_SPEED`, a downward gravity component proportional to stall depth is added.
6. **Terrain collision** – Position clamped above `getTerrainHeightSampled(x, z) + 1.5`. On touchdown, speed is decayed (braking); at < 1 u/s the airplane transitions to `idle`.

---

## Camera

- **1st-person (cockpit)** – Camera positioned slightly forward of centre, oriented to the airplane's heading (yaw + 180°) with partial pitch/roll coupling.
- **3rd-person (chase cam)** – Camera lerps to a fixed offset behind and above the airplane; `lookAt` keeps the plane centred.

---

## Boarding & Exit

- Press **[E]** within `AIRPLANE_BOARD_RADIUS` (8 u) to board.  Airplane transitions to `flying` state.
- Press **[E]** while flying to exit.  Player is dropped at the airplane's current position with mild downward velocity; gravity takes over.
- Weapons are hidden while on the airplane.

---

## Mesh Structure (buildAirplane3DMesh)

```
group
└── bodyGroup
    ├── fuselage (CylinderGeometry, sky-blue)
    ├── nose cone (CylinderGeometry, yellow)
    ├── tail fuselage (CylinderGeometry, dark blue)
    ├── accent stripes ×2 (BoxGeometry)
    ├── right wing (ExtrudeGeometry from Shape)
    ├── left wing (mirror)
    ├── wing accent stripes ×2
    ├── horizontal stabilisers L/R (ExtrudeGeometry)
    ├── vertical stabiliser / tail fin (ExtrudeGeometry)
    ├── cockpit canopy (SphereGeometry, translucent)
    ├── engine hub (CylinderGeometry)
    ├── exhaust pipes ×2
    ├── propeller group ← rotated each frame
    │   ├── blade 1 (BoxGeometry)
    │   └── blade 2 (BoxGeometry, 90° offset)
    ├── landing struts ×2 + tail strut
    └── wheels ×2 + tail wheel
```

---

## Testing

`__tests__/airplane3D.test.ts` covers:
- Return type and structure of `buildAirplane3DMesh`
- THREE.Group / THREE.Mesh instance checks
- Propeller in bodyGroup subtree
- Shadow caster flag present
- All materials are MeshLambertMaterial
- `buildAirstripMesh` structure
- `AirplaneData` type compatibility and state enum values
