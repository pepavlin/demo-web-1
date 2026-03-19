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

// ─── Helpers ───────────────────────────────────────────────────────────────────
// The component throttles rendering to ~30 fps (one frame every ≥33.3 ms).
// Tests that verify per-frame rendering must supply timestamps spaced ≥34 ms
// apart so each call passes the throttle gate and actually renders.
const FRAME_MS = 34; // just above the 33.3 ms 30-fps budget

// lastFrameTimeRef starts at 0.  A timestamp of 0 produces delta=0 which is
// below the 33.3 ms threshold and skips the frame.  Starting at a large value
// ensures the first call always passes: (10_000 − 0) >> 33.3.
const START_TS = 10_000;

/** Call rafCallback n times, each timestamp 34 ms after the previous. */
function runFrames(n: number, startTs = START_TS): void {
  for (let i = 0; i < n; i++) {
    if (rafCallback) rafCallback(startTs + i * FRAME_MS);
  }
}

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
      runFrames(1);
    });
    expect(mockContext.clearRect).toHaveBeenCalled();
  });

  it("draws dots via arc on each animation frame", () => {
    render(<GeometricParticles />);
    act(() => {
      runFrames(1);
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

  it("registers wheel event listener for zoom", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<GeometricParticles />);
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("wheel");
    // Mouse interaction events are registered for magnetic attraction
    expect(events).toContain("mousemove");
    expect(events).toContain("mouseleave");
    addSpy.mockRestore();
  });

  it("removes wheel event listener on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<GeometricParticles />);
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("wheel");
    removeSpy.mockRestore();
  });

  it("handles wheel event for zoom without throwing", () => {
    render(<GeometricParticles />);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
      runFrames(1);
    });
    expect(mockContext.clearRect).toHaveBeenCalled();
  });

  it("creates radial gradients for glow effect", () => {
    render(<GeometricParticles />);
    act(() => {
      runFrames(1);
    });
    expect(mockContext.createRadialGradient).toHaveBeenCalled();
  });

  it("draws lines between particles via beginPath and stroke", () => {
    render(<GeometricParticles />);
    act(() => {
      runFrames(1);
    });
    expect(mockContext.beginPath).toHaveBeenCalled();
  });

  it("renders correctly over multiple frames without throwing", () => {
    render(<GeometricParticles />);
    act(() => {
      // Pass timestamps spaced 34 ms apart so every frame clears the throttle gate.
      runFrames(5);
    });
    expect(mockContext.clearRect).toHaveBeenCalledTimes(5);
    expect(mockContext.arc).toHaveBeenCalled();
  });

  it("advances breathing animation across frames without throwing", () => {
    render(<GeometricParticles />);
    // Run many frames to let the sine-wave camera Z oscillation progress.
    // Each call receives a timestamp 34 ms after the previous.
    act(() => {
      runFrames(20);
    });
    expect(mockContext.clearRect).toHaveBeenCalledTimes(20);
  });

  it("attracts particles toward cursor on mousemove (no button held)", () => {
    render(<GeometricParticles />);
    // Move mouse to centre of the mocked 0×0 canvas – particles in screen-radius will be pulled
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 300 }));
      runFrames(1);
    });
    // Rendering must complete without errors
    expect(mockContext.clearRect).toHaveBeenCalled();
    expect(mockContext.arc).toHaveBeenCalled();
  });

  it("repels particles when mouse button is held (mousedown)", () => {
    render(<GeometricParticles />);
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 300 }));
      window.dispatchEvent(new MouseEvent("mousedown"));
      // Run several frames while button is held (timestamps spaced 34 ms apart)
      runFrames(3);
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    expect(mockContext.clearRect).toHaveBeenCalledTimes(3);
    expect(mockContext.arc).toHaveBeenCalled();
  });

  it("resets mouse position on mouseleave so no influence is applied", () => {
    render(<GeometricParticles />);
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 300 }));
      window.dispatchEvent(new MouseEvent("mouseleave"));
      runFrames(1);
    });
    // After leave the influence is inactive – rendering still works
    expect(mockContext.clearRect).toHaveBeenCalled();
  });

  it("switches from repulsion back to attraction after mouseup", () => {
    render(<GeometricParticles />);
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 200, clientY: 200 }));
      window.dispatchEvent(new MouseEvent("mousedown"));
      if (rafCallback) rafCallback(START_TS);
      window.dispatchEvent(new MouseEvent("mouseup"));
      if (rafCallback) rafCallback(START_TS + FRAME_MS);
    });
    expect(mockContext.clearRect).toHaveBeenCalledTimes(2);
  });
});
