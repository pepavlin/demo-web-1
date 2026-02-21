/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement("div", props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

import Sheep from "../components/Sheep";

describe("Sheep component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Stub rAF to be a no-op — avoids infinite loops from the movement loop
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(0 as unknown as ReturnType<typeof requestAnimationFrame>);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    // Make Math.random deterministic: always 0 → delay = MIN_BLEAT_DELAY (8 000 ms)
    jest.spyOn(Math, "random").mockReturnValue(0);
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
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper: flush mount effect so that mounted=true and all dependent effects fire
  function flushMount() {
    act(() => { jest.advanceTimersByTime(0); });
    act(() => { jest.advanceTimersByTime(0); }); // second pass for dependent effects
  }

  it("renders the sheep element after mount", () => {
    render(<Sheep />);
    flushMount();
    expect(screen.getByTestId("sheep")).toBeInTheDocument();
  });

  it("has fixed positioning", () => {
    render(<Sheep />);
    flushMount();
    const el = screen.getByTestId("sheep");
    expect(el).toHaveStyle({ position: "fixed" });
  });

  it("does not show speech bubble initially", () => {
    render(<Sheep />);
    flushMount();
    expect(screen.queryByText("Beee!")).toBeNull();
  });

  it("shows 'Beee!' speech bubble after the bleat delay elapses", () => {
    render(<Sheep />);
    flushMount();

    // With Math.random() === 0, delay = MIN_BLEAT_DELAY = 8 000 ms
    act(() => { jest.advanceTimersByTime(8001); });

    expect(screen.getByText("Beee!")).toBeInTheDocument();
  });

  it("hides speech bubble after bleat duration ends", () => {
    render(<Sheep />);
    flushMount();

    act(() => { jest.advanceTimersByTime(8001); }); // trigger bleat
    expect(screen.getByText("Beee!")).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(3001); }); // wait for bleat to end
    expect(screen.queryByText("Beee!")).toBeNull();
  });

  it("renders SVG with four leg rect elements", () => {
    render(<Sheep />);
    flushMount();
    const rects = document.querySelectorAll("svg rect");
    expect(rects.length).toBe(4);
  });

  it("renders at least one SVG element for the sheep body", () => {
    render(<Sheep />);
    flushMount();
    expect(document.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("does not crash when unmounted during a bleat", () => {
    const { unmount } = render(<Sheep />);
    flushMount();
    act(() => { jest.advanceTimersByTime(8001); }); // trigger bleat
    expect(() => unmount()).not.toThrow();
  });

  it("registers mouse event listeners after mount", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<Sheep />);
    flushMount();
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("mousemove");
    expect(events).toContain("mousedown");
    expect(events).toContain("mouseup");
    addSpy.mockRestore();
  });

  it("removes mouse event listeners on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<Sheep />);
    flushMount();
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("mousemove");
    expect(events).toContain("mousedown");
    expect(events).toContain("mouseup");
    removeSpy.mockRestore();
  });

  it("has pointerEvents auto to allow right-click interaction", () => {
    render(<Sheep />);
    flushMount();
    const el = screen.getByTestId("sheep");
    expect(el).toHaveStyle({ pointerEvents: "auto" });
  });

  it("right-click (contextmenu) on sheep stops it and toggles stopped state", () => {
    render(<Sheep />);
    flushMount();
    const el = screen.getByTestId("sheep");

    // Initially not stopped — cursor is default
    expect(el).toHaveStyle({ cursor: "default" });

    // Right-click stops the sheep
    act(() => { fireEvent.contextMenu(el); });
    expect(el).toHaveStyle({ cursor: "not-allowed" });

    // Right-click again resumes the sheep
    act(() => { fireEvent.contextMenu(el); });
    expect(el).toHaveStyle({ cursor: "default" });
  });

  it("prevents default context menu on right-click", () => {
    render(<Sheep />);
    flushMount();
    const el = screen.getByTestId("sheep");
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const preventDefaultSpy = jest.spyOn(event, "preventDefault");
    act(() => { el.dispatchEvent(event); });
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
