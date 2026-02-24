# Demo Web

## Open World — Multiplayer 3D Game

A browser-based 3D open-world multiplayer game built with Next.js and Three.js. Players connect from their own computers, choose a name, and explore a procedurally generated world together in real time.

### Multiplayer

- Players connect from any device via a web browser
- Enter your name in the lobby screen and press **Spacebar** or **Enter** to join
- Other players appear as 3D characters with name labels above their heads
- Powered by **Socket.io** — real-time WebSocket communication, same port as the web app

### Game Features

- **3D open world** — procedurally generated terrain, day/night cycle, volumetric lighting
- **200 sheep** — herd them into the pen at the map center (AI-driven)
- **12 foxes** — predators that hunt sheep and attack the player; defeat with `[F]` or click
- **35 coins** — collect them scattered across the world
- **Landmarks** — windmill, farmhouse, ruins, lighthouse to discover
- **Procedural audio** — all sounds generated via Web Audio API (no audio files)
- **Czech locale** — UI in Czech

### Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router, custom server)
- [React 19](https://react.dev/)
- [Three.js](https://threejs.org/) — 3D rendering + post-processing
- [Socket.io](https://socket.io/) — real-time multiplayer
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)

### Getting Started

```bash
cd liquid-glass-clock
npm install
npm run dev        # starts Next.js + Socket.io server on :3000
```

Open [http://localhost:3000](http://localhost:3000) in multiple browser tabs or on different computers on the same network.

**Controls:**
| Key | Action |
|-----|--------|
| WASD / Arrow keys | Move |
| Mouse | Look around |
| Space | Jump |
| Shift | Sprint |
| F / Click | Attack |
| E | Enter / exit sheep body |
| B | Toggle build mode |
| T | Chat (explore) / Sculpt terrain (build) |
| V | Toggle first-person / third-person camera |
| Esc | Pause |

### Docker Compose

```bash
docker compose up -d --build
```

The app (web + Socket.io) will be available on port `3000` (default). Set a custom port via `.env`:

```bash
echo "PORT=8080" > .env
docker compose up -d --build
```

### Testing

```bash
cd liquid-glass-clock
npm test
```

Tests cover: `Game3D`, `LobbyScreen`, `useMultiplayer`, `Sheep`, `FeedbackWidget`, terrain utilities, mesh builders, sound manager, and more.
