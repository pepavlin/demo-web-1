# Bunker System

Underground laboratory bunkers built from multiple shipping containers. Accessible from the open world via hatch entrances; load as a fully separate interior scene.

---

## Overview

Three bunkers are scattered across the open world. Each has:

- A **partially buried shipping container** entrance visible above ground (corrugated metal top, open hatch, entry ladder, warning markings)
- Access to a **shared interior lab** built from 3 shipping containers arranged in a linear sequence

The interior system follows the same two-scene separation architecture as the Space Station: the `earthGroup` (all exterior world objects) is hidden when inside a bunker, and the `bunkerGroup` is made visible.

---

## World Positions

| Bunker | ID | World X | World Z | Name |
|--------|-----|---------|---------|------|
| 1 | `bunker-alpha` | 95 | -55 | Alfa |
| 2 | `bunker-beta` | -35 | 25 | Beta |
| 3 | `bunker-gamma` | 15 | 110 | Gamma |

All three are shown as green squares on the minimap.

---

## Interior Layout

The interior group is positioned at **Y=1500** in world space (far above the exterior, hidden by fog at the standard density of 0.006).

```
[Container 1: Entry]       Z = 0  → 12   Entry ladder, workbench, CRT monitor, test tube rack
[Container 2: Lab]         Z = 12 → 24   Long workbench, beakers, centrifuge, microscope, chemical cabinet
[Container 3: Server Room] Z = 24 → 36   Server racks, cabling, UPS unit, 3D printer, exit ladder
```

Containers are connected by doorway openings (no wall panel at junction, door-frame accent light).

### Interior Coordinates (local, relative to `bunkerGroup.position`)

| Point | X | Z |
|-------|---|---|
| Spawn (entry ladder) | 0 | 1.5 |
| Exit ladder | 0 | 35.0 |
| Lab workbench | +2.5 | ~18 |

---

## Player Flow

1. Walk near a bunker entrance → `[E] Vstoupit do bunkru` prompt
2. Press **E** → fade to black background, `earthGroup.visible = false`, `bunkerGroup.visible = true`, teleport to `(0, 1500 + 1.8, 1.5)`
3. Navigate 3 containers using WASD
4. Walk to exit ladder at Z≈35 → `[E] Vylézt z bunkru` prompt
5. Press **E** → restore Earth world, teleport back to the bunker entrance in the surface world

---

## Key Constants (`lib/bunkerSystem.ts`)

| Constant | Value | Description |
|----------|-------|-------------|
| `BUNKER_ENTRY_RADIUS` | 3.5 units | Distance to show entry prompt |
| `BUNKER_EXIT_RADIUS` | 3.0 units | Distance to exit ladder to show exit prompt |
| `BUNKER_PRINTER_INTERACT_RADIUS` | 2.5 units | Distance to show 3D printer prompt |
| `BUNKER_INTERIOR_WORLD_Y` | 1500 | Y offset of interior in world space |
| `CONTAINER_W` | 5 | Interior container width |
| `CONTAINER_H` | 2.8 | Interior container height |
| `CONTAINER_L` | 12 | Length per container |
| `NUM_CONTAINERS` | 3 | Number of containers per bunker |

---

## Architecture

### Files

| File | Role |
|------|------|
| `lib/bunkerSystem.ts` | All bunker logic: configs, exterior mesh, interior scene, proximity helpers |
| `components/Game3D.tsx` | Integration: refs, state, E key handler, movement loop, AI skip, UI prompts, minimap |
| `__tests__/bunkerSystem.test.ts` | 39 unit tests |

### Scene Graph

```
THREE.Scene
├── camera (always direct child – weapon mesh stays visible in any scene)
├── earthGroup  ← contains all exterior world objects; toggled invisible inside bunker
├── bunkerGroup ← interior scene; starts invisible; shown when player is inside
└── spaceStationGroup ← unchanged; starts invisible
```

### Integration Pattern

Mirrors the Space Station system exactly:

```typescript
// Entering a bunker
earthSceneGroupRef.current.visible = false;
bunkerGroupRef.current.visible = true;
scene.fog = null;
scene.background = new THREE.Color(0x080808);

// Exiting a bunker
earthSceneGroupRef.current.visible = true;
bunkerGroupRef.current.visible = false;
scene.fog = new THREE.FogExp2(0x87ceeb, 0.006);
```

### Movement Inside Bunker

Uses the same `isInRoom` box-containment check as the Space Station. The walkable rooms are the 3 `THREE.Box3` objects returned by `buildBunkerInteriorScene()`.

### AI Skip

While `_inBunker` is true, Fox AI and Sheep AI forEach loops `return` early (same as `_inStation`), avoiding wasted CPU on 200+ hidden entities.

---

## Visual Style

### Exterior
- Dark green/gray corrugated metal
- Rust accents at corners
- Open hatch tilted back (~20°)
- Dirt mound around entrance
- Yellow warning stripes near hatch
- Identification plate with emissive indicator

### Interior
- **Walls:** Dark corrugated green-gray (`#3a4a38`) with rust ridges
- **Floor:** Near-black metal grate (`#2a2a2a`)
- **Lighting:**
  - Container 1: Fluorescent strip (cool green-white) + emergency red point light
  - Container 2: Two fluorescent strips
  - Container 3: Cold blue/white (data center feel)
  - All lights flicker slightly via sine formula
- **Equipment:**
  - CRT monitors (green phosphor screen, animated flicker)
  - Test tube racks with coloured glass cylinders
  - Centrifuge (animated rotation via `vent` type)
  - Beakers/flasks (transparent, colour-coded)
  - Microscope
  - Storage cabinet with biohazard symbol
  - Server racks with blinking LEDs (`server_led` animated type)
  - Overhead pipe conduits
  - Emergency exit sign (green emissive)
