# Chat System

Real-time in-game chat between players, built on top of the existing Socket.io multiplayer infrastructure.

## Architecture

```
Browser (ChatPanel component)
    ↕  Socket.io
Server (server.mjs)  — in-memory broadcast
    ↕  Socket.io
All connected clients (ChatPanel component)
```

## Data Flow

1. Player presses **T** (desktop) or taps **💬** (mobile) → `setChatOpen(true)` in `Game3D`
2. `Game3D` renders `<ChatPanel isOpen={true} …>` → input is focused automatically
3. Player types → presses **Enter** or clicks **Odeslat**
4. `ChatPanel.onSend(text)` → `sendChatRef.current(text)` → `socket.emit("player:chat", { text })`
5. Server validates & truncates to 120 chars, then broadcasts `chat:message` to **all** connected sockets
6. `useMultiplayer` `onChatMessage` callback fires in each client
7. `Game3D.handleChatMessage` appends message to `chatMessages` state (capped at 50)
8. `ChatPanel` receives updated `messages` prop, syncs to its internal `TrackedMessage[]` list with `receivedAt` timestamp

## Components

### `components/ChatPanel.tsx`

Self-contained floating overlay. Stateless with respect to messages (receives them via props).

| Prop | Type | Description |
|------|------|-------------|
| `messages` | `ChatMessage[]` | All chat messages (parent owns the array) |
| `onSend` | `(text: string) => void` | Called when user submits a message |
| `isOpen` | `boolean` | Controls input visibility & focus |
| `onOpen` | `() => void` | Notification to parent to open chat |
| `onClose` | `() => void` | Notification to parent to close & re-lock pointer |

Features:
- **Auto-fade** — messages start fading after 6 s and disappear at 7.5 s
- **Auto-scroll** — log scrolls to the newest message when messages change
- **Unread badge** — animated badge shows unread count when panel is closed and new messages arrive; clicking it calls `onOpen`
- **Send button** — visible alternative to Enter key; disabled when input is empty
- **Character limit** — enforces 120-character maximum, matching the server-side cap
- **Keyboard shortcuts** — Enter sends, Escape cancels without sending

### `hooks/useMultiplayer.ts`

Already exposes `sendChat(text)` and `onChatMessage` callback. No changes required.

### `server.mjs`

Handles `player:chat` event, sanitises the message, and broadcasts `chat:message` to all sockets.

```js
socket.on("player:chat", ({ text }) => {
  const msg = String(text).trim().slice(0, 120);
  if (!msg) return;
  io.emit("chat:message", { id, name, color, text: msg, ts: Date.now() });
});
```

## Mobile Support

`MobileControls` accepts an optional `onChatOpen?: () => void` prop. When provided, a **💬** button is rendered in the action-button column (bottom-right). Tapping it calls `onChatOpen`, which sets `chatOpen = true` in `Game3D`.

## Keyboard Shortcut (Desktop)

| Key | Action |
|-----|--------|
| `T` | Open chat (explore mode only; pointer lock is released) |
| `Enter` | Send message & close input |
| `Escape` | Cancel & close input |

## Message Lifecycle

```
receivedAt + 0 ms     → opacity 1   (fully visible)
receivedAt + 6000 ms  → begin fade
receivedAt + 7500 ms  → opacity 0
receivedAt + 7500 ms  → pruned from tracked list by cleanup interval (250 ms)
```

Max 50 messages are kept in memory; the panel renders at most the last 8.

## Testing

Tests are located in `__tests__/ChatPanel.test.tsx` and cover:
- Rendering (container, empty state)
- Message display (names, text, 8-message cap)
- Input row visibility
- Sending via Enter and button click
- Whitespace-only message rejection
- Character limit enforcement
- Escape cancels without sending
- Unread badge appearance and click behaviour
