/**
 * POST /api/generate-item
 *
 * Calls the Claude API to generate a Three.js mesh function body and item
 * metadata for a game object described by the player.
 *
 * Request body: { description: string, playerName?: string }
 * Response:     { success: true, meshCode: string, metadata: PrintedItemMetadata }
 *           or  { success: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { PrintedItemMetadata, PrintedItemType } from "@/lib/printedItemSystem";

export const dynamic = "force-dynamic";

const client = new Anthropic();

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a 3D game object generator for a browser-based Three.js game.
The game is a multiplayer open-world action game with bunkers, weapons, and exploration.
Players can describe any item and you generate it as a usable 3D game object.

You MUST respond with a single valid JSON object and nothing else (no markdown, no explanation).

The JSON must have exactly this shape:
{
  "meshCode": "<JavaScript function body string>",
  "metadata": {
    "name": "<Czech display name, max 32 chars>",
    "description": "<Czech item description, max 80 chars>",
    "type": "<one of: weapon | tool | consumable | decorative>",
    "damage": <integer 0-200>,
    "healing": <integer 0-100>,
    "scale": <float 0.3-2.5>,
    "properties": {}
  }
}

Rules for meshCode:
- It is a JavaScript function BODY (not a declaration) that receives the variable THREE (Three.js namespace)
- It MUST end with: return group;   where group is a THREE.Group
- Use only THREE.js geometry and materials (MeshStandardMaterial, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, ConeGeometry, IcosahedronGeometry, etc.)
- Keep polygon count reasonable (under 800 triangles total)
- Make the model recognisable and creative — it should look like the described item
- Total model bounding box should be roughly 0.2–0.6 units tall (will be scaled by metadata.scale)
- Add emissive glow to materials to make the item visible in the dark bunker
- NEVER import external modules, use fetch, or access window/document/process

Example meshCode for a glowing sword:
const group = new THREE.Group();
const bladeMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: new THREE.Color(0x4488ff), emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.9 });
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.008), bladeMat);
blade.position.y = 0.18;
group.add(blade);
const guardMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: new THREE.Color(0xcc9900), emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 });
const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.018), guardMat);
guard.position.y = 0.0;
group.add(guard);
const gripMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.9 });
const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.12, 8), gripMat);
grip.position.y = -0.09;
group.add(grip);
return group;

metadata rules:
- type: weapon if it can deal damage, consumable if it heals/buffs, tool if it has a utility function, decorative otherwise
- damage: for weapons, a sensible value (sword ~55, pistol ~40, rocket ~120); 0 for non-weapons
- healing: for consumables, amount healed (potion ~30, food ~15); 0 for others
- scale: adjust so the item looks right-sized in-game (sword ~1.2, gem ~0.8, cannon ~2.0)
- name and description MUST be in Czech`;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { description?: string; playerName?: string };
    const description = (body.description ?? "").trim().slice(0, 200);

    if (!description) {
      return NextResponse.json({ success: false, error: "Popis nesmí být prázdný." }, { status: 400 });
    }

    const userMessage = `Hráč ${body.playerName ?? "Hráč"} chce vytisknout: "${description}"

Vygeneruj Three.js mesh kód a metadata pro tento herní předmět.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON — strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned) as {
      meshCode: string;
      metadata: PrintedItemMetadata;
    };

    // Validate metadata fields
    const type: PrintedItemType = (["weapon", "tool", "consumable", "decorative"] as const)
      .includes(parsed.metadata.type as PrintedItemType)
      ? parsed.metadata.type
      : "decorative";

    const metadata: PrintedItemMetadata = {
      name:        (parsed.metadata.name        ?? "Neznámý předmět").slice(0, 48),
      description: (parsed.metadata.description ?? "").slice(0, 120),
      type,
      damage:  Math.max(0, Math.min(200, Number(parsed.metadata.damage)  || 0)),
      healing: Math.max(0, Math.min(100, Number(parsed.metadata.healing) || 0)),
      scale:   Math.max(0.3, Math.min(3.0, Number(parsed.metadata.scale) || 1.0)),
      properties: parsed.metadata.properties ?? {},
    };

    return NextResponse.json({ success: true, meshCode: parsed.meshCode, metadata });
  } catch (err) {
    console.error("[generate-item] Error:", err);
    return NextResponse.json(
      { success: false, error: "Generování selhalo. Zkuste to znovu." },
      { status: 500 },
    );
  }
}
