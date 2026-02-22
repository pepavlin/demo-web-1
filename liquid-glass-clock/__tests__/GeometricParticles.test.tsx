/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock canvas context
const mockContext = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  strokeStyle: "",
  fillStyle: "",
  lineWidth: 0,
};

HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext) as jest.Mock;

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallback: FrameRequestCallback | null = null;
const mockRaf = jest.fn((cb: FrameRequestCallback) => {
  rafCallback = cb;
  return 1;
});
const mockCaf = jest.fn();
global.requestAnimationFrame = mockRaf;
global.cancelAnimationFrame = mockCaf;

import GeometricParticles from "../components/GeometricParticles";

describe("GeometricParticles component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rafCallback = null;
  });

  it("renders a canvas element", () => {
    const { getByTestId } = render(<GeometricParticles />);
    expect(getByTestId("geometric-particles-canvas")).toBeInTheDocument();
  });

  it("canvas has pointer-events-none class", () => {
    const { getByTestId } = render(<GeometricParticles />);
    expect(getByTestId("geometric-particles-canvas")).toHaveClass(
      "pointer-events-none"
    );
  });

  it("starts the animation loop via requestAnimationFrame", () => {
    render(<GeometricParticles />);
    expect(mockRaf).toHaveBeenCalled();
  });

  it("calls clearRect on each animation frame", () => {
    render(<GeometricParticles />);
    act(() => {
      if (rafCallback) rafCallback(performance.now());
    });
    expect(mockContext.clearRect).toHaveBeenCalled();
  });

  it("draws dots via arc on each animation frame", () => {
    render(<GeometricParticles />);
    act(() => {
      if (rafCallback) rafCallback(performance.now());
    });
    expect(mockContext.arc).toHaveBeenCalled();
  });

  it("cancels animation frame on unmount", () => {
    const { unmount } = render(<GeometricParticles />);
    unmount();
    expect(mockCaf).toHaveBeenCalled();
  });

  it("adds and removes resize event listener", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const { unmount } = render(<GeometricParticles />);
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("registers mouse event listeners for camera control", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<GeometricParticles />);
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("mousemove");
    expect(events).toContain("mouseleave");
    expect(events).toContain("mousedown");
    expect(events).toContain("mouseup");
    addSpy.mockRestore();
  });

  it("removes mouse event listeners on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<GeometricParticles />);
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("mousemove");
    expect(events).toContain("mouseleave");
    expect(events).toContain("mousedown");
    expect(events).toContain("mouseup");
    removeSpy.mockRestore();
  });

  it("creates radial gradients for glow effect", () => {
    render(<GeometricParticles />);
    act(() => {
      if (rafCallback) rafCallback(performance.now());
    });
    expect(mockContext.createRadialGradient).toHaveBeenCalled();
  });

  it("draws lines between particles via beginPath and stroke", () => {
    render(<GeometricParticles />);
    act(() => {
      if (rafCallback) rafCallback(performance.now());
    });
    // stroke is called for lines
    expect(mockContext.beginPath).toHaveBeenCalled();
  });

  it("renders correctly over multiple frames without throwing", () => {
    render(<GeometricParticles />);
    // Run several frames so 3-D projection and line drawing accumulate
    act(() => {
      for (let frame = 0; frame < 5; frame++) {
        if (rafCallback) rafCallback(performance.now());
      }
    });
    expect(mockContext.clearRect).toHaveBeenCalledTimes(5);
    expect(mockContext.arc).toHaveBeenCalled();
  });

  it("handles mousemove to rotate camera without throwing", () => {
    render(<GeometricParticles />);
    act(() => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 200 })
      );
      if (rafCallback) rafCallback(performance.now());
    });
    // clearRect should still be called — no crash from mouse handling
    expect(mockContext.clearRect).toHaveBeenCalled();
  });

  it("handles mousedown/mouseup without throwing", () => {
    render(<GeometricParticles />);
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 50 }));
      window.dispatchEvent(new MouseEvent("mousedown"));
      if (rafCallback) rafCallback(performance.now());
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    expect(mockContext.clearRect).toHaveBeenCalled();
  });
});
