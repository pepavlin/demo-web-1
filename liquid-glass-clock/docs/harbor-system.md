# Harbor System

The harbor system adds a fully playable coastal port to the 3D open world, complete with a procedurally positioned wooden dock, moored sailboats, and realistic nautical sailing mechanics.

## Architecture

```
lib/harborSystem.ts          — Mesh builders + coastal search algorithm
components/Game3D.tsx        — Integration: refs, init, E-key, game loop, HUD
__tests__/harborSystem.test.ts — Unit tests
```

## Harbour Location

During world initialisation, `findHarborPosition()` scans the terrain in a 360° ring at radius `HARBOR_SEARCH_DIST` (88 units from the world centre) to find a suitable coastline:

| Condition | Requirement |
|-----------|-------------|
| Candidate point | Terrain height ≥ `WATER_LEVEL` (land) |
| Point 18 units further out | Terrain height < `WATER_LEVEL` (open sea) |
| Point 12 units inward | Terrain height ≥ `WATER_LEVEL` (not a narrow spit) |

The first valid angle is used, and the dock is placed there facing seaward.

## Dock Structure (`buildHarborDockMesh`)

The dock is a `THREE.Group` whose **origin sits at the shore end** and whose **local +Z axis faces open water**.

| Component | Description |
|-----------|-------------|
| Main pier | 6 longitudinal planks + cross-beams every 2 units, total 22 units long |
| Support pillars | 12 × CylinderGeometry at 3 depths beneath the waterline |
| Railings | Port and starboard rails with posts every 2 m |
| Mooring bollards | 6 bollards with rope rings at dock sides |
| End platform | 4 m wide loading area at seaward end |
| Harbour master hut | Stone walls, A-frame roof, door and windows |
| Lantern posts | 2 posts at dock entrance with warm PointLights |
| Anchor chain | Decorative chain links at dock edge |

## Sailboat (`buildSailboatMesh`)

Returns `{ group, sailMesh, sailGroup }`.
The boat's **bow points local +Z** (matching `group.rotation.y = 0` → facing +Z).

| Part | Details |
|------|---------|
| Hull | Navy blue keel + port/starboard sides + bow/stern caps; gold waterline stripe |
| Deck | 4 teak planks with trim, ~9.4 × 3 units |
| Cabin | Aft cabin with windows both sides |
| Mast | 9 m CylinderGeometry with crow's nest |
| Main sail | PlaneGeometry (5.4 × 6.8 m), DoubleSide cream material, animated |
| Gaff | Horizontal spar at top of sail |
| Jib | Triangular foresail (BufferGeometry) |
| Boom | Horizontal cylinder at sail base |
| Rigging | 4 stays/shrouds (backstay, forestay, 2 shrouds) |
| Helm | Pedestal + 8-spoke wooden wheel |
| Navigation lights | Port (red) + Starboard (green) + Masthead (white) PointLights |
| Anchor | Stowed at bow |
| Flag | Red flag at masthead |
| Rope coil | Decorative coil on deck |

## Two Sailboats at the Harbour

During init, two sailboats are moored on either side of the dock end:

```
                dock end (seaward)
                      │
       ship-2 ●───────┼───────● ship-1
                      │
              ← dock extends inward
```

Each ship is offset by 5 units perpendicular to the dock direction.
If the computed mooring position is on land, the ship is shifted seaward until it reaches water.

## Sailing Physics

When a player boards a sailboat, sailing uses **proper nautical controls** (separate from the camera-relative first-person movement of the rowboat):

| Key | Action |
|-----|--------|
| `W` | Increase forward speed (up to `SAILBOAT_MAX_SPEED` = 11 u/s) |
| `S` | Reduce speed / slow reverse |
| `A` | Turn ship heading left (rotate yaw +`SAILBOAT_TURN_SPEED` rad/s) |
| `D` | Turn ship heading right |
| `E` | Board / disembark |

### Physics constants

| Constant | Value | Description |
|----------|-------|-------------|
| `SAILBOAT_MAX_SPEED` | 11 u/s | Top speed |
| `SAILBOAT_ACCEL` | 4 u/s² | Throttle acceleration |
| `SAILBOAT_BRAKE` | 7 u/s² | Deceleration (drag + braking) |
| `SAILBOAT_TURN_SPEED` | 1.2 rad/s | Rudder turn rate |
| `SAILBOAT_BOARD_RADIUS` | 6 units | Boarding prompt distance |

### Momentum

Velocity decays at 35% of `SAILBOAT_BRAKE` when no throttle is applied, giving the ship realistic mass and preventing instant stops.

### Grounding

Every frame the target position is checked with `getTerrainHeightSampled`. If the new position would ground the ship (terrain ≥ `WATER_LEVEL`), the ship is halted and velocity reset to 0.

### Camera

While sailing the camera follows from behind the stern:

```
camera = ship.position
       + direction(-yaw) * SAILBOAT_CAM_DIST   (behind)
       + up             * SAILBOAT_CAM_HEIGHT   (above)
```

Camera rotation is locked to the ship's heading, with a slight downward pitch (`-0.22 rad`) so the player can see the deck.

## Sail Animation

| State | Animation |
|-------|-----------|
| Moored / idle | Gentle left-right flutter (`sin(elapsed)`) |
| Sailing | `sailGroup.rotation.y` proportional to speed — sail fills outward |
| Full speed | Maximum fill of ~0.18 rad |

## HUD

| Condition | Element |
|-----------|---------|
| Near an unmanned sailboat | Pulsing blue prompt: `⛵ [E] Nastoupit na plachetnici` |
| Actively sailing | Top banner: `⛵ Plachetnice · W/S Plyn · A/D Kormidlo · [E] Opustit` |

## Interaction Priority (E key)

The E-key handler checks conditions in this order:

1. Enter space station
2. Exit space station
3. Exit rocket
4. Board rocket
5. **Exit harbor sailboat** ← new
6. **Board harbor sailboat** ← new
7. Exit rowboat
8. Board rowboat
9. Drop held item
10. Pick up item
11. Possess / unpossess sheep

## Cleanup

When a player disembarks, `ship.velocity` is reset to 0 and `activeHarborShipRef` is cleared.
The idle bob and sail flutter animations resume automatically on the next frame.
