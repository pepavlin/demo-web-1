# Open World — 3D Browser Game

A browser-based 3D open-world game built with [Three.js](https://threejs.org/) and [Next.js](https://nextjs.org). Explore a procedurally generated landscape, herd sheep, collect coins, outsmart foxes, and discover hidden landmarks.

## Gameplay

You are an explorer in a living open world. The day/night cycle advances in real time, foxes hunt your sheep, and the landscape is filled with secrets to find.

**Objectives:**
- 🐑 Herd all **200 sheep** into the **pen** at the centre of the map
- 🌟 Collect **35 gold coins** hidden across the terrain
- 🦊 Watch out for **12 foxes** that actively chase you!
- 🏚 Discover the **ancient ruins**, **farmhouse**, **windmill**, and **lighthouse**
- 🧱 **Build structures** using 8 materials — press `B` to enter build mode
- ⛏ **Sculpt the terrain** — raise and lower hills with the scroll wheel

## Weapon Selection

Before starting, you choose one of three animated weapons:

| Weapon | Type | Damage | Style |
|---|---|---|---|
| **Pistole** | Ranged | 25 | Balanced — bullet + close melee |
| **Meč** | Melee only | 50 | High damage, short range, very fast |
| **Sniperka** | Ranged | 90 | One-shot power, long range, slow reload |

Keys `[1]` `[2]` `[3]` select a weapon; `[Enter]` or the confirm button starts the game.

## Controls

### Exploration
| Key / Input | Action |
|---|---|
| `W A S D` / Arrow keys | Move |
| Mouse | Look around |
| `Space` | Jump |
| `Shift` | Sprint (depletes stamina) |
| `E` | **Possess nearby sheep** (within 3.5 units) / exit possession |
| `F` / Click | Attack (weapon-dependent) |
| `Esc` | Release mouse / pause |
| Click on canvas | Lock mouse & start playing |

### Building Mode (`B` to toggle)
| Key / Input | Action |
|---|---|
| `B` | Toggle build mode on/off |
| Left click | Place block at ghost preview |
| Right click | Remove block under crosshair |
| Scroll wheel | Cycle through 8 materials |
| `1` – `8` | Select material by number |
| `T` | Switch to terrain sculpt sub-mode |

### Terrain Sculpt Mode (`B` then `T`)
| Key / Input | Action |
|---|---|
| Scroll up | Raise terrain under crosshair |
| Scroll down | Lower terrain under crosshair |
| `T` | Return to block placement |
| `B` | Exit build mode entirely |

**Block materials:** Wood · Stone · Glass · Dirt · Sand · Brick · Metal · Crystal
**Max blocks:** 500 (saved to localStorage automatically)

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
- **Entity possession** — press `E` when close to a sheep to swap into its body and control it directly; press `E` again to return to human form

### HUD & Navigation
- **Top-left HUD** — sheep count, coin count, elapsed time, clock, compass direction
- **Mini-map** (top-right) — live 160×160 canvas showing player (green ▲), sheep (white), foxes (orange), coins (yellow), and the pen
- **Stamina bar** — colour shifts green → yellow → red as stamina depletes

### Structures
- **Farmhouse** with roof, windows, door, and chimney
- **Windmill** with rotating blades
- **Ancient ruins** — broken walls, arch, toppled columns, scattered debris
- **Lighthouse** — striped tower with glowing lantern room

### Building System
- **Build mode** (`B`) — place and remove blocks in 3D
- **8 materials** with distinct colours: Wood, Stone, Glass, Dirt, Sand, Brick, Metal, Crystal
- **Ghost block preview** — translucent preview snapped to the terrain/block grid before placement
- **Right-click removal** — instantly remove any placed block within range
- **Scroll-to-cycle** materials; **digit keys 1–8** for direct selection
- **Persistence** — blocks saved to `localStorage` and restored on reload (up to 500)
- **Terrain sculpt mode** (`T` while in build mode) — raise/lower terrain with the scroll wheel using a smooth cosine-falloff brush; vertex colours update live

## Multiplayer

The game is fully multiplayer. Any number of players can join from their own browsers and see each other in real time.

### Joining

1. Open the game URL in your browser.
2. Type your name (or leave it blank to use the default "Hráč").
3. Press **Mezerník** (Spacebar) or **Enter** — or click **"Vstoupit do světa"**.

### Hosting a local session

```bash
npm install
npm run dev
```

Share your local IP address (e.g. `http://192.168.1.x:3000`) with other players on the same network. They open that URL, pick a name, and press Spacebar to join.

### What you see

- **Lobby** shows a live list of players already in the world.
- **In-game** shows a small *Online* panel (bottom-left) with all connected players and their assigned colours.
- A toast notification appears whenever someone joins or leaves.
- Remote players are rendered as 3D coloured characters with their name floating above their head.

### Server API

| Endpoint | Description |
|---|---|
| `GET /api/players/count` | `{ count: N }` — number of players currently online |
| `GET /api/players/list` | `{ players: [{id, name, color}] }` — full player list |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in one or more browser tabs (or on different computers) and press **Mezerník** to enter the world.

## Running Tests

```bash
npm test
```

Test suites (344+ tests total):
- `__tests__/buildingSystem.test.ts` — block mesh builders, grid snapping, persistence
- `__tests__/terrainUtils.test.ts` — terrain generation, spawn points, sculpt modification
- `__tests__/meshBuilders.test.ts` — all 3D mesh builder functions (including sword & sniper)
- `__tests__/soundManager.test.ts` — audio manager initialization and playback
- `__tests__/Game3D.test.tsx` — Game3D component render, intro screen, and weapon select flow
- `__tests__/WeaponSelect.test.tsx` — weapon selection UI, keyboard shortcuts, confirm callback
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
├── server.mjs              # Custom HTTP + Socket.io multiplayer server
├── components/             # React components
│   ├── Clock.tsx           # Animated clock with parallax
│   ├── ElementSuggestionMenu.tsx  # Right-click suggestion menu
│   ├── FeedbackWidget.tsx  # Feedback panel with task tracking
│   ├── Game3D.tsx          # 3D open-world game (Three.js)
│   ├── GeometricParticles.tsx     # Canvas particle system
│   ├── LiquidBackground.tsx       # Volumetric light background
│   ├── LobbyScreen.tsx     # Multiplayer lobby with name input
│   ├── Sheep.tsx           # Autonomous sheep character
│   ├── SheepWalker.tsx     # Mouse-following sheep
│   ├── SlimeJumper.tsx     # Slime physics character
│   ├── UpdateNotification.tsx     # App update banner
│   ├── VioletSheep.tsx    # Keyboard-controlled wall-walker
│   └── WeaponSelect.tsx    # Weapon selection screen
├── hooks/                  # Custom React hooks
│   ├── useMouseParallax.ts # Mouse-based 3D tilt
│   ├── useMultiplayer.ts   # Socket.io multiplayer hook
│   ├── useTasks.ts         # Task polling hook (polls webhook)
│   └── useVersionCheck.ts  # Build version checker
├── lib/                    # Shared utilities
│   ├── buildingSystem.ts   # Block mesh builders, grid snapping, save/load
│   ├── buildingTypes.ts    # Block material types and building constants
│   ├── gameTypes.ts        # TypeScript types for the game
│   ├── meshBuilders.ts     # Three.js mesh factory functions
│   ├── soundManager.ts     # Web Audio API manager
│   └── terrainUtils.ts     # Procedural terrain + sculpt modification helpers
└── __tests__/              # Jest test suites
```

## Tech Stack

- **Next.js 16** (App Router, standalone output)
- **Three.js** — 3D rendering, shadows, fog
- **Socket.io** — real-time multiplayer (WebSocket with polling fallback)
- **simplex-noise** — procedural terrain generation
- **framer-motion** — UI animations and parallax
- **Tailwind CSS v4** — HUD and overlay styling
- **TypeScript** — fully typed throughout
- **Jest + Testing Library** — unit and component tests
