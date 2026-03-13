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

  // Player count API — used by lobby to show online count
  if (parsedUrl.pathname === "/api/players/count") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ count: players.size }));
    return;
  }

  // Player list API — used by lobby and in-game UI
  if (parsedUrl.pathname === "/api/players/list") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    const list = Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
    }));
    res.end(JSON.stringify({ players: list }));
    return;
  }

  await handle(req, res, parsedUrl);
});

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── Player state ─────────────────────────────────────────────────────────────
// Map<socketId, { id, name, x, y, z, rotY, pitch, color, hp, joinTime }>
const players = new Map();

// ── Host tracking ─────────────────────────────────────────────────────────────
// The host is the first connected player.  They are responsible for simulating
// shared NPC entities (sheep, foxes, etc.) and broadcasting their states.
// When the host disconnects the next player in join-order becomes host.
let hostId = null;

/** Assign a new host (the next player in insertion order). Notifies all clients. */
function reassignHost() {
  const nextPlayer = players.values().next().value;
  hostId = nextPlayer ? nextPlayer.id : null;
  if (hostId) {
    console.log(`[Host] New host: ${players.get(hostId).name} (${hostId})`);
    io.emit("host:changed", { hostId });
  }
}

// ── PvP constants ────────────────────────────────────────────────────────────
const PLAYER_MAX_HP = 100;
/** Milliseconds of spawn protection after joining or respawning. */
const SPAWN_PROTECTION_MS = 3000;
/** Milliseconds before a killed player auto-respawns. */
const RESPAWN_DELAY_MS = 5000;
/** Maximum damage per hit (sanity clamp against cheating). */
const MAX_HIT_DAMAGE = 200;

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
      hp: PLAYER_MAX_HP,
      joinTime: Date.now(),
    };
    players.set(socket.id, player);

    // First player to join becomes host
    const isFirstPlayer = players.size === 1;
    if (isFirstPlayer) {
      hostId = socket.id;
      console.log(`[Host] Initial host: ${player.name} (${socket.id})`);
    }

    // Send existing players + host info to the newly joined player
    const others = {};
    players.forEach((p, id) => {
      if (id !== socket.id) others[id] = p;
    });
    socket.emit("players:init", { players: others, hostId });

    // Broadcast new player to everyone else
    socket.broadcast.emit("player:joined", player);

    console.log(`[WS] ${player.name} joined (total: ${players.size}, host: ${hostId === socket.id ? "YES" : "no"})`);
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
    // Include hp so remote clients can show health bars
    socket.broadcast.emit("player:update", { id: socket.id, ...data, hp: player.hp });
  });

  // ── PvP: player hit ───────────────────────────────────────────────────────
  socket.on("player:hit", ({ targetId, damage, weaponType }) => {
    const attacker = players.get(socket.id);
    const target = players.get(targetId);
    if (!attacker || !target) return;

    // Spawn protection: ignore hits on recently spawned players
    if (Date.now() - target.joinTime < SPAWN_PROTECTION_MS) return;

    // Dead players cannot be hit
    if (target.hp <= 0) return;

    const clampedDamage = Math.max(1, Math.min(MAX_HIT_DAMAGE, Math.round(damage)));
    target.hp = Math.max(0, target.hp - clampedDamage);

    // Notify the target about the incoming damage
    io.to(targetId).emit("player:damaged", {
      damage: clampedDamage,
      attackerId: socket.id,
      attackerName: attacker.name,
    });

    // Broadcast updated HP to all clients so health bars stay in sync
    io.emit("player:hp_update", { id: targetId, hp: target.hp });

    if (target.hp <= 0) {
      // Notify target they were killed
      io.to(targetId).emit("player:killed_by", { killerName: attacker.name });
      // Notify attacker of the kill
      socket.emit("player:got_kill", { victimName: target.name });

      console.log(`[PvP] ${attacker.name} killed ${target.name}`);

      // Auto-respawn after delay
      setTimeout(() => {
        if (!players.has(targetId)) return; // disconnected before respawn
        target.hp = PLAYER_MAX_HP;
        target.joinTime = Date.now(); // reset spawn protection
        io.to(targetId).emit("player:respawn");
        io.emit("player:hp_update", { id: targetId, hp: PLAYER_MAX_HP });
      }, RESPAWN_DELAY_MS);
    }
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  socket.on("player:chat", ({ text }) => {
    const player = players.get(socket.id);
    if (!player) return;
    const msg = String(text || "").trim().slice(0, 120);
    if (!msg) return;
    io.emit("chat:message", {
      id: socket.id,
      name: player.name,
      color: player.color,
      text: msg,
      ts: Date.now(),
    });
    console.log(`[Chat] ${player.name}: ${msg}`);
  });

  // ── Entity sync: batch state broadcast (host → all others) ───────────────
  // The host periodically sends compact batches of NPC entity states.
  // The server simply relays them to all other connected clients.
  socket.on("entity:batch", (batch) => {
    if (socket.id !== hostId) return; // Only accept from the current host
    socket.broadcast.emit("entity:batch", batch);
  });

  // ── Entity sync: discrete events (host → all others) ─────────────────────
  // Used for state-change events that must not be missed (e.g. entity death).
  socket.on("entity:event", (event) => {
    if (socket.id !== hostId) return; // Only accept from the current host
    socket.broadcast.emit("entity:event", event);
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    players.delete(socket.id);
    io.emit("player:left", { id: socket.id });
    if (player) {
      console.log(`[WS] ${player.name} left (total: ${players.size})`);
    }

    // If the host disconnected, assign the next player as host
    if (socket.id === hostId) {
      reassignHost();
    }
  });
});

httpServer.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
