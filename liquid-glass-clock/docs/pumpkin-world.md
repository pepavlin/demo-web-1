# Svět dýní (Pumpkin World)

Interactive Canvas 2D simulation of a self-sustaining pumpkin ecosystem.
Available at **`/pumpkins`**.

---

## Lifecycle

Each pumpkin progresses through four stages:

```
growing → mature → rotting → dead (removed)
```

| Stage     | Description                                              |
|-----------|----------------------------------------------------------|
| `growing` | Size increases at `growthRate` px/s toward `maxSize`     |
| `mature`  | Full size; lasts `matureDuration` seconds before decay   |
| `rotting` | Visually darkens; lasts `rotDuration` seconds            |
| `dead`    | Removed from the simulation on the next tick             |

### Reproduction

While in the `growing` stage, once a pumpkin's size reaches
`spawnThreshold × maxSize` (default 60 %), it spawns **one child pumpkin**
adjacent to it.  Each pumpkin spawns at most once.

Child placement:
- Direction: random angle in [0, 2π)
- Distance: `parent.maxSize × spawnDistanceMultiplier` (default 2.8)
- Clamped to canvas bounds with a margin of `maxMaxSize`

---

## Architecture

### `lib/pumpkinSimulation.ts`

Pure TypeScript simulation engine — no DOM/canvas dependencies.

Key exports:

| Export                | Type       | Description                               |
|-----------------------|------------|-------------------------------------------|
| `Pumpkin`             | interface  | Single pumpkin data record                |
| `PumpkinStage`        | union type | `"growing" \| "mature" \| "rotting" \| "dead"` |
| `SimulationConfig`    | interface  | Full configuration object                 |
| `DEFAULT_CONFIG`      | const      | Default parameter values                  |
| `createPumpkin`       | function   | Factory for a new pumpkin                 |
| `updatePumpkin`       | function   | Immutable single-tick update              |
| `shouldSpawn`         | function   | Spawn predicate                           |
| `spawnChild`          | function   | Create child adjacent to parent           |
| `PumpkinSimulation`   | class      | Manages the full population               |

`PumpkinSimulation` public API:

```ts
new PumpkinSimulation(config?: Partial<SimulationConfig>)

sim.pumpkins   // readonly Pumpkin[]
sim.count      // number
sim.update(dt) // advance by dt seconds
sim.reset()    // restart from initial state
sim.getConfig() // Readonly<SimulationConfig>
```

### `lib/pumpkinRenderer.ts`

Stateless Canvas 2D renderer.

```ts
new PumpkinRenderer(ctx, width, height)
renderer.render(pumpkins, elapsedSeconds)
```

Visual details:
- **5 overlapping ellipses** form the ribbed pumpkin body
- **Radial gradients** per lobe give a 3D highlight/shadow feel
- **Colour shifts** from warm orange → muddy brown as `rotProgress` increases
- **Mold patches** appear after 20 % rot
- **Leaf** at stem base fades out at 70 % rot
- **Background**: dark autumn sky with animated moon, stars, grass tufts
- **HUD**: live counts for growing / mature / rotting pumpkins

### `components/PumpkinWorld.tsx`

React wrapper (`"use client"`):

- Hosts `<canvas>` + `ResizeObserver` for responsive layout
- Runs `requestAnimationFrame` game loop, capped at Δt ≤ 100 ms
- Pauses automatically when the browser tab is hidden
- Exposes a **Restartovat** button (resets simulation to initial state)
- Accepts `config?: Partial<SimulationConfig>` and `className?` props

### `app/pumpkins/page.tsx`

Next.js App Router page; renders `<PumpkinWorld />` full-screen.

---

## Configuration Reference

| Parameter                | Default | Description                                  |
|--------------------------|---------|----------------------------------------------|
| `width`                  | 800     | Canvas width (px) — set from actual canvas   |
| `height`                 | 600     | Canvas height (px) — set from actual canvas  |
| `growthRate`             | 8       | px / second                                  |
| `minMaxSize`             | 30      | Minimum possible max radius (px)             |
| `maxMaxSize`             | 70      | Maximum possible max radius (px)             |
| `spawnThreshold`         | 0.6     | Fraction of maxSize that triggers spawn      |
| `matureDuration`         | 12      | Seconds at full size before rotting          |
| `rotDuration`            | 15      | Seconds for complete rot phase               |
| `maxPumpkins`            | 40      | Hard cap on population                       |
| `initialCount`           | 3       | Pumpkins at start                            |
| `spawnDistanceMultiplier`| 2.8     | Child distance = parent.maxSize × this       |

---

## Population Dynamics

With `initialCount = 3` and `maxPumpkins = 40`:

- Each pumpkin spawns 1 child → population growth is linear per generation
- The cap prevents unbounded growth
- Equilibrium is reached when the rate of new spawns ≈ rate of deaths
- Typical steady-state at ~25–35 simultaneous pumpkins

---

## Testing

Tests live in `__tests__/`:

| File                          | Covers                                          |
|-------------------------------|-------------------------------------------------|
| `pumpkinSimulation.test.ts`   | `createPumpkin`, `updatePumpkin`, `shouldSpawn`, `spawnChild`, `PumpkinSimulation` class |
| `PumpkinWorld.test.tsx`       | Component renders, canvas init, reset button    |

Run with:

```bash
cd liquid-glass-clock
npm test -- --testPathPattern=pumpkin
```
