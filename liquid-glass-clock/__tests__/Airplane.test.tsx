/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Airplane from "../components/Airplane";

describe("Airplane component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Make Math.random deterministic so we control direction/position
    jest.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders nothing initially (airplane is idle)", () => {
    const { container } = render(<Airplane />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render airplane before the initial delay elapses", () => {
    const { container } = render(<Airplane />);
    act(() => {
      // Advance just under the initial 5s boot delay
      jest.advanceTimersByTime(4_999);
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders the airplane wrapper after boot + idle delays pass", () => {
    const { container } = render(<Airplane />);
    act(() => {
      // 5s boot + up to 45s idle (Math.random = 0.5 → ~32.5s idle)
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const wrapper = container.querySelector(".airplane-wrapper");
    expect(wrapper).not.toBeNull();
  });

  it("renders SVG inside the wrapper when flying", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("renders the contrail element when flying", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const contrail = container.querySelector(".airplane-contrail");
    expect(contrail).not.toBeNull();
  });

  it("hides the airplane after the flight duration ends", () => {
    const { container } = render(<Airplane />);
    act(() => {
      // Trigger the flight
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    expect(container.querySelector(".airplane-wrapper")).not.toBeNull();

    act(() => {
      // Flight duration is 14s
      jest.advanceTimersByTime(14_001);
    });
    expect(container.querySelector(".airplane-wrapper")).toBeNull();
  });

  it("airplane wrapper has aria-hidden for accessibility", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const wrapper = container.querySelector(".airplane-wrapper");
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  it("SVG has a viewBox attribute", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBeTruthy();
  });

  it("SVG viewBox is extended to accommodate flame mesh", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 140 54");
  });

  it("SVG contains window ellipses (passenger windows)", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const ellipses = container.querySelectorAll("svg ellipse");
    // 6 windows + 2 engine pods = 8 ellipses
    expect(ellipses.length).toBeGreaterThanOrEqual(6);
  });

  // ── Flame mesh tests ──────────────────────────────────────────────────

  it("renders flame outer layer group when flying", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const outerLayers = container.querySelectorAll(".flame-outer-layer");
    expect(outerLayers.length).toBeGreaterThanOrEqual(2); // one per engine
  });

  it("renders flame mid layer group when flying", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const midLayers = container.querySelectorAll(".flame-mid-layer");
    expect(midLayers.length).toBeGreaterThanOrEqual(2);
  });

  it("renders flame core layer group when flying", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const coreLayers = container.querySelectorAll(".flame-core-layer");
    expect(coreLayers.length).toBeGreaterThanOrEqual(2);
  });

  it("renders flame turbulence filter in SVG defs", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const filter = container.querySelector("#flame-distort");
    expect(filter).not.toBeNull();
  });

  it("renders flame glow filter in SVG defs", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const filter = container.querySelector("#flame-glow");
    expect(filter).not.toBeNull();
  });

  it("renders at least 8 flame tongue polygon/path elements", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    // Flame tongues are polygon and path elements within .flame-outer-layer/.flame-mid-layer
    const flamePolygons = container.querySelectorAll(
      ".flame-outer-layer polygon, .flame-outer-layer path, .flame-mid-layer polygon, .flame-mid-layer path"
    );
    expect(flamePolygons.length).toBeGreaterThanOrEqual(8);
  });

  it("renders flame core polygons for both engines", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const corePolygons = container.querySelectorAll(".flame-core-layer polygon");
    expect(corePolygons.length).toBeGreaterThanOrEqual(4); // min 2 per engine
  });

  it("renders flame gradient defs with engine-specific IDs", () => {
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    expect(container.querySelector("#flame-outer-1")).not.toBeNull();
    expect(container.querySelector("#flame-mid-1")).not.toBeNull();
    expect(container.querySelector("#flame-core-1")).not.toBeNull();
    expect(container.querySelector("#flame-outer-2")).not.toBeNull();
    expect(container.querySelector("#flame-mid-2")).not.toBeNull();
    expect(container.querySelector("#flame-core-2")).not.toBeNull();
  });

  it("flame elements do not appear when airplane is not flying", () => {
    const { container } = render(<Airplane />);
    // No timers advanced — airplane is idle and returns null
    const flames = container.querySelectorAll(".flame-core-layer");
    expect(flames.length).toBe(0);
  });

  it("does not throw on unmount while flying", () => {
    const { unmount } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    expect(() => unmount()).not.toThrow();
  });

  it("does not throw on unmount while idle", () => {
    const { unmount } = render(<Airplane />);
    expect(() => unmount()).not.toThrow();
  });

  it("cleans up timer on unmount (no pending timer warning)", () => {
    const clearSpy = jest.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(<Airplane />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("applies a top style based on random Y position when flying", () => {
    // Math.random = 0.5 → yPercent = 8 + 0.5 * (55 - 8) = 8 + 23.5 = 31.5
    const { container } = render(<Airplane />);
    act(() => {
      jest.advanceTimersByTime(5_000 + 40_000);
    });
    const wrapper = container.querySelector<HTMLElement>(".airplane-wrapper");
    expect(wrapper?.style.top).toBeTruthy();
    expect(wrapper?.style.top).toMatch(/%$/);
  });
});
