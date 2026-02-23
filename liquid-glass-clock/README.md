# Open World — 3D Browser Game

A browser-based 3D open-world game built with [Three.js](https://threejs.org/) and [Next.js](https://nextjs.org). Explore a procedurally generated landscape, herd sheep, collect coins, outsmart foxes, and discover hidden landmarks.

## Gameplay

You are an explorer in a living open world. The day/night cycle advances in real time, foxes hunt your sheep, and the landscape is filled with secrets to find.

**Objectives:**
- 🐑 Herd all **20 sheep** into the **pen** at the centre of the map
- 🌟 Collect **35 gold coins** hidden across the terrain
- 🦊 Watch out for **4 foxes** that actively chase your sheep!
- 🏚 Discover the **ancient ruins**, **farmhouse**, **windmill**, and **lighthouse**

## Controls

| Key / Input | Action |
|---|---|
| `W A S D` / Arrow keys | Move |
| Mouse | Look around |
| `Space` | Jump |
| `Shift` | Sprint (depletes stamina) |
| `Esc` | Release mouse / pause |
| Click on canvas | Lock mouse & start playing |

## Features

### World
- **Procedural terrain** — simplex-noise heightmap with hills, valleys, and a flat spawn zone
- **Vertex-coloured terrain** — colour varies by height (grass, slopes, rocky peaks, water areas)
- **Water plane** — fills low-lying areas
- **Procedural trees & rocks** — randomly placed with size/colour variation
- **Cloud field** — 30 volumetric puff clouds drifting at altitude

### Day / Night Cycle
- **Dynamic sun** — moves across the sky over a 5-minute real-time cycle
- **Moon & starfield** — 2 500 stars and cool moonlight appear at night
- **Sky colour palette** — smooth dawn → day → dusk → night transitions
- **Dynamic lighting** — ambient and sun intensity track the time of day

### Entities
- **20 sheep** with wander AI, flee-from-player behaviour, and random bleating
- **4 foxes** that stalk the nearest sheep; scare sheep into frantic retreat
- **35 spinning coins** that float and bob, collected on contact

### Player
- **First-person controls** with gravity, jumping, and pointer-lock mouse look
- **Stamina system** — sprinting drains stamina (shown as a coloured bar)
- **Fox proximity warning** — alert appears when a fox is nearby

### HUD & Navigation
- **Top-left HUD** — sheep count, coin count, elapsed time, clock, compass direction
- **Mini-map** (top-right) — live 160×160 canvas showing player (green ▲), sheep (white), foxes (orange), coins (yellow), and the pen
- **Stamina bar** — colour shifts green → yellow → red as stamina depletes

### Structures
- **Farmhouse** with roof, windows, door, and chimney
- **Windmill** with rotating blades
- **Ancient ruins** — broken walls, arch, toppled columns, scattered debris
- **Lighthouse** — striped tower with glowing lantern room

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — click **"Hrát!"** to start.

## Running Tests

```bash
npm test
```

Test suites (282 tests total):
- `__tests__/terrainUtils.test.ts` — terrain generation and spawn points
- `__tests__/meshBuilders.test.ts` — all 3D mesh builder functions
- `__tests__/soundManager.test.ts` — audio manager initialization and playback
- `__tests__/Game3D.test.tsx` — Game3D component render and intro screen
- `__tests__/Clock.test.tsx` — clock display and time formatting
- `__tests__/Sheep.test.tsx` — sheep component rendering
- `__tests__/SheepWalker.test.tsx` — sheep walker component
- `__tests__/VioletSheep.test.tsx` — violet sheep wall-walking component
- `__tests__/SlimeJumper.test.tsx` — slime jumper component
- `__tests__/GeometricParticles.test.tsx` — particle system component
- `__tests__/LiquidBackground.test.tsx` — liquid background effect
- `__tests__/FeedbackWidget.test.tsx` — feedback widget with task polling
- `__tests__/ElementSuggestionMenu.test.tsx` — context-menu suggestion component
- `__tests__/UpdateNotification.test.tsx` — version update notification
- `__tests__/useVersionCheck.test.tsx` — version check hook

## Project Structure

```
liquid-glass-clock/
├── app/                    # Next.js App Router
│   ├── api/version/        # Version API endpoint
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main page
├── components/             # React components
│   ├── Clock.tsx           # Animated clock with parallax
│   ├── ElementSuggestionMenu.tsx  # Right-click suggestion menu
│   ├── FeedbackWidget.tsx  # Feedback panel with task tracking
│   ├── Game3D.tsx          # 3D open-world game (Three.js)
│   ├── GeometricParticles.tsx     # Canvas particle system
│   ├── LiquidBackground.tsx       # Volumetric light background
│   ├── Sheep.tsx           # Autonomous sheep character
│   ├── SheepWalker.tsx     # Mouse-following sheep
│   ├── SlimeJumper.tsx     # Slime physics character
│   ├── UpdateNotification.tsx     # App update banner
│   └── VioletSheep.tsx    # Keyboard-controlled wall-walker
├── hooks/                  # Custom React hooks
│   ├── useMouseParallax.ts # Mouse-based 3D tilt
│   ├── useTasks.ts         # Task polling hook (polls webhook)
│   └── useVersionCheck.ts  # Build version checker
├── lib/                    # Shared utilities
│   ├── gameTypes.ts        # TypeScript types for the game
│   ├── meshBuilders.ts     # Three.js mesh factory functions
│   ├── soundManager.ts     # Web Audio API manager
│   └── terrainUtils.ts     # Procedural terrain helpers
└── __tests__/              # Jest test suites
```

## Tech Stack

- **Next.js 16** (App Router, standalone output)
- **Three.js** — 3D rendering, shadows, fog
- **simplex-noise** — procedural terrain generation
- **framer-motion** — UI animations and parallax
- **Tailwind CSS v4** — HUD and overlay styling
- **TypeScript** — fully typed throughout
- **Jest + Testing Library** — unit and component tests
