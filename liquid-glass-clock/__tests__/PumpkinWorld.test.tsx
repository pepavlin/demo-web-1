/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Canvas mock ────────────────────────────────────────────────────────────────

const mockGetContext = jest.fn(() => ({
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  ellipse: jest.fn(),
  quadraticCurveTo: jest.fn(),
  bezierCurveTo: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn(() => ({ width: 50 })),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arcTo: jest.fn(),
  closePath: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  strokeStyle: "",
  fillStyle: "",
  lineWidth: 1,
  lineCap: "butt",
  globalAlpha: 1,
  font: "",
}));

HTMLCanvasElement.prototype.getContext = mockGetContext as never;

// ── ResizeObserver mock ────────────────────────────────────────────────────────

class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
global.ResizeObserver = MockResizeObserver as never;

// ── requestAnimationFrame mock ─────────────────────────────────────────────────

let rafId = 0;
global.requestAnimationFrame = jest.fn((cb) => {
  // Schedule callback via setTimeout so tests can control timing
  setTimeout(() => cb(performance.now()), 0);
  return ++rafId;
});
global.cancelAnimationFrame = jest.fn();

// ── Tests ──────────────────────────────────────────────────────────────────────

import PumpkinWorld from "@/components/PumpkinWorld";

describe("PumpkinWorld", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rafId = 0;
  });

  it("renders without crashing", () => {
    render(<PumpkinWorld />);
    expect(screen.getByTestId("pumpkin-world-container")).toBeInTheDocument();
  });

  it("renders a canvas element", () => {
    render(<PumpkinWorld />);
    expect(screen.getByTestId("pumpkin-world-canvas")).toBeInTheDocument();
  });

  it("renders a reset button", () => {
    render(<PumpkinWorld />);
    expect(
      screen.getByRole("button", { name: /restartovat/i })
    ).toBeInTheDocument();
  });

  it("accepts a custom className", () => {
    render(<PumpkinWorld className="my-custom-class" />);
    const container = screen.getByTestId("pumpkin-world-container");
    expect(container.className).toContain("my-custom-class");
  });

  it("clicking reset does not throw", async () => {
    render(<PumpkinWorld />);
    const btn = screen.getByRole("button", { name: /restartovat/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    // If it doesn't throw the test passes
    expect(btn).toBeInTheDocument();
  });

  it("initialises the canvas 2d context", async () => {
    render(<PumpkinWorld />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockGetContext).toHaveBeenCalledWith("2d");
  });

  it("accepts partial config overrides without crashing", () => {
    render(<PumpkinWorld config={{ initialCount: 5, growthRate: 15 }} />);
    expect(screen.getByTestId("pumpkin-world-canvas")).toBeInTheDocument();
  });
});
