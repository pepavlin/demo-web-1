/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Framer Motion mock ────────────────────────────────────────────────────────
jest.mock("framer-motion", () => {
  return {
    motion: {
      div: ({
        children,
        style,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        children?: React.ReactNode;
        style?: React.CSSProperties;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
      }) => React.createElement("div", { ...props, style }, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useMotionValue: (initial: number) => {
      let val = initial;
      return {
        get: () => val,
        set: (v: number) => { val = v; },
        on: jest.fn(),
      };
    },
  };
});

import SheepWalker from "../components/SheepWalker";

describe("SheepWalker component", () => {
  let lastRafCallback: FrameRequestCallback | null = null;
  let rafSpy: jest.SpyInstance;
  let cafSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    lastRafCallback = null;

    rafSpy = jest.spyOn(global, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        lastRafCallback = cb;
        return 1;
      }
    );
    cafSpy = jest.spyOn(global, "cancelAnimationFrame").mockImplementation(jest.fn());

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    cafSpy.mockRestore();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<SheepWalker />);
    expect(container).toBeTruthy();
  });

  it("mounts and shows the sheep walker container", () => {
    const { getByTestId } = render(<SheepWalker />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(getByTestId("sheep-walker")).toBeInTheDocument();
  });

  it("renders the SVG sheep with accessible label", () => {
    const { getByLabelText } = render(<SheepWalker />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(getByLabelText("Ovečka")).toBeInTheDocument();
  });

  it("sheep walker has fixed positioning", () => {
    const { getByTestId } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    const el = getByTestId("sheep-walker");
    expect(el).toHaveStyle({ position: "fixed" });
  });

  it("does not show the béé bubble immediately after mount", () => {
    const { queryByTestId } = render(<SheepWalker />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    // Bubble only appears after at least 4s
    expect(queryByTestId("beee-bubble")).toBeNull();
  });

  it("shows béé bubble after the scheduled delay", () => {
    // Fix Math.random so delay = 4000 + 0 * 10000 = 4000ms exactly
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0);
    const { queryByTestId } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });

    // Advance just past 4000ms — bubble should appear but not yet hide
    act(() => { jest.advanceTimersByTime(4001); });
    expect(queryByTestId("beee-bubble")).toBeInTheDocument();

    randSpy.mockRestore();
  });

  it("hides béé bubble after 2.5s display window", () => {
    const randSpy = jest.spyOn(Math, "random").mockReturnValue(0);
    const { queryByTestId } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });

    // Trigger the bubble at T=4000ms
    act(() => { jest.advanceTimersByTime(4001); });
    expect(queryByTestId("beee-bubble")).toBeInTheDocument();

    // Advance past the 2.5s display period (bubble hides at T=6500ms)
    act(() => { jest.advanceTimersByTime(2600); });
    expect(queryByTestId("beee-bubble")).toBeNull();

    randSpy.mockRestore();
  });

  it("starts requestAnimationFrame loop after mounting", () => {
    render(<SheepWalker />);
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(rafSpy).toHaveBeenCalled();
  });

  it("RAF callback fires without throwing", () => {
    render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });

    expect(() => {
      act(() => {
        if (lastRafCallback) lastRafCallback(performance.now());
      });
    }).not.toThrow();
  });

  it("cancels animation frame on unmount", () => {
    const { unmount } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    unmount();
    expect(cafSpy).toHaveBeenCalled();
  });

  it("registers mouse event listeners after mount", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("mousemove");
    expect(events).toContain("mousedown");
    expect(events).toContain("mouseup");
    addSpy.mockRestore();
  });

  it("removes mouse event listeners on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("mousemove");
    expect(events).toContain("mousedown");
    expect(events).toContain("mouseup");
    removeSpy.mockRestore();
  });

  // ── Dynamic animation tests ────────────────────────────────────────────────

  it("renders four leg groups inside the SVG for diagonal gait", () => {
    const { getByLabelText } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    const svg = getByLabelText("Ovečka");
    // b1, b2 (back), f1, f2 (front) — each wraps a rect + ellipse
    const b1 = svg.querySelector(".sheep-leg-b1");
    const b2 = svg.querySelector(".sheep-leg-b2");
    const f1 = svg.querySelector(".sheep-leg-f1");
    const f2 = svg.querySelector(".sheep-leg-f2");
    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    expect(f1).not.toBeNull();
    expect(f2).not.toBeNull();
  });

  it("RAF loop updates position without throwing over multiple frames", () => {
    render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });

    // Simulate several animation frames advancing time
    expect(() => {
      act(() => {
        const now = performance.now();
        if (lastRafCallback) lastRafCallback(now);
        if (lastRafCallback) lastRafCallback(now + 16);
        if (lastRafCallback) lastRafCallback(now + 32);
      });
    }).not.toThrow();
  });

  it("SVG has terrain-lean wrapper group for foot-planting effect", () => {
    const { getByLabelText } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    const svg = getByLabelText("Ovečka");
    // The terrain-lean <g> has a transform attribute containing "rotate"
    const groups = svg.querySelectorAll("g[transform]");
    const leanGroup = Array.from(groups).find((g) =>
      g.getAttribute("transform")?.includes("rotate")
    );
    expect(leanGroup).not.toBeUndefined();
  });

  it("tail wag group exists inside SVG", () => {
    const { getByLabelText } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    const svg = getByLabelText("Ovečka");
    expect(svg.querySelector(".sheep-tail-wag")).not.toBeNull();
  });

  it("head animation group is rendered inside SVG", () => {
    const { getByLabelText } = render(<SheepWalker />);
    act(() => { jest.advanceTimersByTime(0); });
    const svg = getByLabelText("Ovečka");
    // Either head-anim (walking) or head-graze should be present
    const headGroup =
      svg.querySelector(".sheep-head-anim") ||
      svg.querySelector(".sheep-head-graze");
    expect(headGroup).not.toBeNull();
  });
});
