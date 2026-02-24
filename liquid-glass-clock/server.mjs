// Custom Next.js server with Socket.io for multiplayer support
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);
  await handle(req, res, parsedUrl);
});

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── Player state ─────────────────────────────────────────────────────────────
// Map<socketId, { id, name, x, y, z, rotY, pitch }>
const players = new Map();

// ── Player color palette (assigned by join order) ────────────────────────────
const PLAYER_COLORS = [
  0x4a9eff, // blue
  0xff6b6b, // red
  0x6bff8a, // green
  0xffd700, // gold
  0xff8c00, // orange
  0xda70d6, // orchid
  0x00ced1, // dark turquoise
  0xff1493, // deep pink
];
let colorIndex = 0;

io.on("connection", (socket) => {
  console.log(`[WS] Player connected: ${socket.id}`);

  // ── Join ──────────────────────────────────────────────────────────────────
  socket.on("player:join", ({ name }) => {
    const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    colorIndex++;

    const player = {
      id: socket.id,
      name: (name || "Hráč").slice(0, 20),
      x: 0,
      y: 2,
      z: 0,
      rotY: 0,
      pitch: 0,
      color,
    };
    players.set(socket.id, player);

    // Send existing players to the newly joined player
    const others = {};
    players.forEach((p, id) => {
      if (id !== socket.id) others[id] = p;
    });
    socket.emit("players:init", others);

    // Broadcast new player to everyone else
    socket.broadcast.emit("player:joined", player);

    console.log(`[WS] ${player.name} joined (total: ${players.size})`);
  });

  // ── Position update ───────────────────────────────────────────────────────
  socket.on("player:update", (data) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.x = data.x;
    player.y = data.y;
    player.z = data.z;
    player.rotY = data.rotY;
    player.pitch = data.pitch;
    socket.broadcast.emit("player:update", { id: socket.id, ...data });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    players.delete(socket.id);
    io.emit("player:left", { id: socket.id });
    if (player) {
      console.log(`[WS] ${player.name} left (total: ${players.size})`);
    }
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
