# 3D Printer System

AI-powered in-game 3D printer located in every bunker's server room. Players describe any item in Czech, Claude generates a Three.js mesh + game logic metadata, and the result is placed as a fully interactive game object.

---

## User Flow

1. Enter any bunker and navigate to the **Server Room** (Container 3, Z = 24–36)
2. Walk within 2.5 units of the printer → `[E] 3D Tiskárna` prompt appears
3. Press **E** → `PrinterModal` opens (pointer unlocked)
4. Type a Czech description (e.g. "magický meč s modrým plamenem")
5. Press **Spustit tisk** or **Ctrl+Enter**
6. Loading screen with animated circular progress + cycling status messages
7. Success card shows item name, type badge, and stats
8. Close modal → item appears near the printer as a floating glowing object
9. Walk within 2.0 units → `[E] Sebrat vytištěný předmět` prompt
10. Press **E** to pick up — effect applied based on item type

---

## Item Types & Effects

| Type | Pickup Effect |
|------|--------------|
| `weapon` | Equips in active weapon slot (sword-tier damage from AI) |
| `consumable` | Immediately heals player by `metadata.healing` HP |
| `tool` | Added to inventory (visual only for now) |
| `decorative` | Added to inventory (no effect) |

---

## Architecture

### Files

| File | Role |
|------|------|
| `lib/bunkerSystem.ts` | `buildPrinterMesh()`, `BUNKER_PRINTER_INTERACT_RADIUS`, `BunkerPrinterPosition` interface, `printerLocalPosition` in result |
| `lib/printedItemSystem.ts` | `PrintedItemData`, `createPrintedItem()`, `updatePrintedItems()`, `pickupPrintedItem()`, `findNearestPrintedItem()`, `executeGeneratedMeshCode()` |
| `app/api/generate-item/route.ts` | POST endpoint — calls `claude-sonnet-4-6`, returns `{ meshCode, metadata }` |
| `components/PrinterModal.tsx` | Retro-futuristic UI modal with idle / loading / success / error states |
| `components/Game3D.tsx` | Refs, state, E-key handlers, game-loop proximity checks |

### Data Flow

```
Player presses E near printer
  → setPrinterModalOpen(true)
  → User types description → POST /api/generate-item
  → Claude generates JS function body + metadata JSON
  → onItemGenerated(result) called
  → createPrintedItem(scene, x, y, z, meshCode, metadata)
      → executeGeneratedMeshCode() runs the AI code with THREE namespace
      → Fallback mesh if code execution fails
      → Floating mesh + glow ring + point light added to scene
  → printedItemsRef.current.push(newItem)

Game loop (inside bunker):
  → updatePrintedItems() — hover, rotation, glow pulse
  → findNearestPrintedItem() — proximity check
  → setNearPrintedItemPrompt(true/false)

Player presses E near item:
  → pickupPrintedItem(scene, item) — removes from scene
  → Apply effect (weapon / consumable / other)
  → Remove from printedItemsRef.current
```

### Code Generation Contract

The API instructs Claude to produce a **JavaScript function body** (not a declaration) that:
- Receives `THREE` as the only argument
- Ends with `return group;` where `group` is a `THREE.Group`
- Uses only built-in Three.js geometry/materials
- Has no external imports or DOM access

The client executes it via `new Function("THREE", meshCode)(THREE)`, wrapped in `try/catch`. Failure → fallback icosahedron mesh with type-appropriate colour.

### Metadata Schema

```typescript
interface PrintedItemMetadata {
  name: string;          // Czech display name (max 48 chars)
  description: string;   // Czech description (max 120 chars)
  type: "weapon" | "tool" | "consumable" | "decorative";
  damage: number;        // 0–200
  healing: number;       // 0–100
  scale: number;         // 0.3–3.0 (applied to THREE.Group.scale)
  properties: Record<string, unknown>;
}
```

---

## Visual Design

### Printer Mesh (`buildPrinterMesh`)

FDM open-frame 3D printer (Ender-inspired):
- **Stand/pedestal** — dark metal, cyan accent stripe
- **Frame posts** — 4 vertical aluminium rods
- **Print bed** — dark gridded surface with cyan grid lines
- **Print head/extruder** — carriage + nozzle
- **Filament spool** — torus on side with glowing cyan filament
- **Front glass panel** — semi-transparent
- **Touchscreen** — blue emissive display on stand front
- **Status LED** — cyan sphere, `printer_light` animated mesh (slow pulse)

### PrinterModal Aesthetic

Industrial retro-futuristic — matches the bunker CRT lab atmosphere:
- Dark background with subtle scanline overlay
- Monospace font (`IBM Plex Mono`)
- Cyan (`#00ffcc`) accent on green-tinted dark panels
- **Loading state**: SVG circular progress arc + outer spinning ring + progress bar strip
- **Success state**: checkmark circle + item card with type colour badge + stat chips
- **Error state**: red accent, retry button

### Printed Item in World

- Floats at 0.65 units above floor, oscillating ±0.08 units at 1.8 Hz
- Rotates continuously at 1.2 rad/s
- Glow ring (torus) on floor, slow-rotating
- Point light pulsing based on item type colour

---

## Tests

| File | Coverage |
|------|---------|
| `__tests__/printedItemSystem.test.ts` | `buildFallbackMesh`, `executeGeneratedMeshCode`, `findNearestPrintedItem`, `PRINTED_ITEM_PICKUP_RADIUS` |
| `__tests__/PrinterModal.test.tsx` | Rendering, idle state, close handler, submit button enable/disable, char counter |
| `__tests__/bunkerPrinter.test.ts` | `BUNKER_PRINTER_INTERACT_RADIUS`, `buildPrinterMesh`, `printerLocalPosition` bounds |
