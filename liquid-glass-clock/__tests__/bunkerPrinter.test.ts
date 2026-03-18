/**
 * Tests for 3D printer additions to lib/bunkerSystem.ts
 *
 * Covers:
 * - BUNKER_PRINTER_INTERACT_RADIUS is a positive number
 * - buildPrinterMesh() returns a THREE.Group with children
 * - buildBunkerInteriorScene() returns a printerLocalPosition
 * - Printer position is within the bunker bounds (Container 3, Z=24..36)
 */

import * as THREE from "three";
import {
  BUNKER_PRINTER_INTERACT_RADIUS,
  buildPrinterMesh,
  buildBunkerInteriorScene,
} from "@/lib/bunkerSystem";

describe("BUNKER_PRINTER_INTERACT_RADIUS", () => {
  it("is a positive number", () => {
    expect(BUNKER_PRINTER_INTERACT_RADIUS).toBeGreaterThan(0);
  });
});

describe("buildPrinterMesh", () => {
  it("returns a THREE.Group", () => {
    const mesh = buildPrinterMesh();
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  it("has multiple child meshes", () => {
    const mesh = buildPrinterMesh();
    expect(mesh.children.length).toBeGreaterThan(5);
  });
});

describe("buildBunkerInteriorScene - printerLocalPosition", () => {
  it("returns a printerLocalPosition object", () => {
    const result = buildBunkerInteriorScene();
    expect(result.printerLocalPosition).toBeDefined();
    expect(typeof result.printerLocalPosition.localX).toBe("number");
    expect(typeof result.printerLocalPosition.localZ).toBe("number");
    expect(typeof result.printerLocalPosition.rotY).toBe("number");
  });

  it("printer Z is in Container 3 range (24..36)", () => {
    const result = buildBunkerInteriorScene();
    const { localZ } = result.printerLocalPosition;
    expect(localZ).toBeGreaterThanOrEqual(24);
    expect(localZ).toBeLessThanOrEqual(36);
  });

  it("printer X is within container width bounds (-2.5..2.5)", () => {
    const result = buildBunkerInteriorScene();
    const { localX } = result.printerLocalPosition;
    expect(Math.abs(localX)).toBeLessThanOrEqual(2.5);
  });
});
