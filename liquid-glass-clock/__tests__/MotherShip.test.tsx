/**
 * @jest-environment jsdom
 */

// Mock THREE.js WebGL renderer – requires a real browser context
jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return {
    ...actual,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: document.createElement("canvas"),
      shadowMap: { enabled: false, type: null },
      toneMapping: null,
      toneMappingExposure: 1,
    })),
  };
});

// Stub requestAnimationFrame – return an id but never invoke the callback
// so the animation loop doesn't spin in JSDOM.
jest
  .spyOn(window, "requestAnimationFrame")
  .mockImplementation(() => 1);

import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import MotherShip, { createShipRooms, ROOM_ILLUMINATION } from "../components/MotherShip";

describe("MotherShip component", () => {
  it("renders without crashing", () => {
    expect(() =>
      act(() => { render(<MotherShip />); })
    ).not.toThrow();
  });

  it("renders a canvas element with the correct test id", async () => {
    await act(async () => { render(<MotherShip />); });
    expect(screen.getByTestId("mothership-canvas")).toBeInTheDocument();
  });

  it("canvas is positioned fixed and fills the viewport", async () => {
    await act(async () => { render(<MotherShip />); });
    const canvas = screen.getByTestId("mothership-canvas");
    expect(canvas.style.position).toBe("fixed");
    expect(canvas.style.width).toBe("100%");
    expect(canvas.style.height).toBe("100%");
  });

  it("canvas has zIndex 0 so UI can sit above it", async () => {
    await act(async () => { render(<MotherShip />); });
    const canvas = screen.getByTestId("mothership-canvas");
    expect(canvas.style.zIndex).toBe("0");
  });

  it("disposes renderer on unmount (no memory leaks)", async () => {
    const THREE = await import("three");
    const disposeSpy = jest.fn();
    (THREE.WebGLRenderer as jest.Mock).mockImplementationOnce(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      render: jest.fn(),
      dispose: disposeSpy,
      shadowMap: { enabled: false },
      toneMapping: null,
      toneMappingExposure: 1,
    }));

    let unmount: () => void;
    await act(async () => {
      const result = render(<MotherShip />);
      unmount = result.unmount;
    });
    act(() => { unmount(); });
    expect(disposeSpy).toHaveBeenCalled();
  });

  it("cancels animation frame on unmount", async () => {
    const cancelSpy = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(jest.fn());
    let unmount: () => void;
    await act(async () => {
      const result = render(<MotherShip />);
      unmount = result.unmount;
    });
    act(() => { unmount(); });
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  it("adds and removes resize event listener", async () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");
    let unmount: () => void;
    await act(async () => {
      const result = render(<MotherShip />);
      unmount = result.unmount;
    });
    expect(addSpy.mock.calls.map((c) => c[0])).toContain("resize");
    act(() => { unmount(); });
    expect(removeSpy.mock.calls.map((c) => c[0])).toContain("resize");
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

// ── createShipRooms unit tests ──────────────────────────────────────────────

describe("createShipRooms", () => {
  it("returns exactly 5 room names", () => {
    const { roomNames } = createShipRooms();
    expect(roomNames).toHaveLength(5);
  });

  it("contains all expected room names", () => {
    const { roomNames } = createShipRooms();
    expect(roomNames).toContain("bridge");
    expect(roomNames).toContain("medicalBay");
    expect(roomNames).toContain("crewQuarters");
    expect(roomNames).toContain("engineRoom");
    expect(roomNames).toContain("cargoBay");
  });

  it("returns 5 lights, one per room", () => {
    const { lights } = createShipRooms();
    expect(lights).toHaveLength(5);
  });

  it("returns meshes (hull, glow shell, windows, trim, details) – at least 5 per room", () => {
    const { meshes } = createShipRooms();
    // 5 rooms × ≥5 meshes each (hull + inner + ≥1 window + trim + 1 detail)
    expect(meshes.length).toBeGreaterThanOrEqual(25);
  });

  it("ROOM_ILLUMINATION bridge is the brightest room", () => {
    const intensities = Object.values(ROOM_ILLUMINATION).map((r) => r.intensity);
    expect(ROOM_ILLUMINATION.bridge.intensity).toBe(Math.max(...intensities));
  });

  it("ROOM_ILLUMINATION cargoBay is the dimmest room", () => {
    const intensities = Object.values(ROOM_ILLUMINATION).map((r) => r.intensity);
    expect(ROOM_ILLUMINATION.cargoBay.intensity).toBe(Math.min(...intensities));
  });

  it("all room lights have distinct intensities matching ROOM_ILLUMINATION", () => {
    const { lights } = createShipRooms();
    const expectedIntensities = Object.values(ROOM_ILLUMINATION)
      .map((r) => r.intensity)
      .sort((a, b) => b - a);
    const actualIntensities = lights.map((l) => l.intensity).sort((a, b) => b - a);
    expect(actualIntensities).toEqual(expectedIntensities);
  });

  it("bridge light has the highest intensity among room lights", () => {
    const { lights, roomNames } = createShipRooms();
    const bridgeIdx = roomNames.indexOf("bridge");
    const bridgeIntensity = lights[bridgeIdx].intensity;
    lights.forEach((l, i) => {
      if (i !== bridgeIdx) {
        expect(bridgeIntensity).toBeGreaterThan(l.intensity);
      }
    });
  });

  it("cargo bay light has the lowest intensity among room lights", () => {
    const { lights, roomNames } = createShipRooms();
    const cargoIdx = roomNames.indexOf("cargoBay");
    const cargoIntensity = lights[cargoIdx].intensity;
    lights.forEach((l, i) => {
      if (i !== cargoIdx) {
        expect(cargoIntensity).toBeLessThan(l.intensity);
      }
    });
  });
});
