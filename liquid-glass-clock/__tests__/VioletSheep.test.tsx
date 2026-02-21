/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import VioletSheep from "../components/VioletSheep";

describe("VioletSheep component", () => {
  let rafSpy: jest.SpyInstance;
  let cafSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();

    rafSpy = jest.spyOn(global, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        // Store latest callback but don't auto-invoke to avoid infinite loops
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
    const { container } = render(<VioletSheep />);
    expect(container).toBeTruthy();
  });

  it("mounts and shows the violet sheep container", () => {
    const { getByTestId } = render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByTestId("violet-sheep")).toBeInTheDocument();
  });

  it("has fixed positioning", () => {
    const { getByTestId } = render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    const el = getByTestId("violet-sheep");
    expect(el).toHaveStyle({ position: "fixed" });
  });

  it("renders the SVG with accessible label 'Violet sheep'", () => {
    const { getByLabelText } = render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByLabelText("Violet sheep")).toBeInTheDocument();
  });

  it("starts requestAnimationFrame loop after mounting", () => {
    render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(rafSpy).toHaveBeenCalled();
  });

  it("cancels animation frame on unmount", () => {
    const { unmount } = render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    unmount();
    expect(cafSpy).toHaveBeenCalled();
  });

  it("registers keydown and keyup event listeners after mount", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("keydown");
    expect(events).toContain("keyup");
    addSpy.mockRestore();
  });

  it("removes keydown and keyup listeners on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("keydown");
    expect(events).toContain("keyup");
    removeSpy.mockRestore();
  });

  it("is positioned at the bottom of the screen", () => {
    const { getByTestId } = render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    const el = getByTestId("violet-sheep");
    // top should be near window.innerHeight - SHEEP_H - GROUND_Y_OFFSET
    // innerHeight=800, SHEEP_H=85, GROUND_Y_OFFSET=10 → groundY=705
    const top = parseInt(el.style.top, 10);
    expect(top).toBeGreaterThan(600); // well below centre of screen
    expect(top).toBeLessThanOrEqual(800);
  });

  it("ArrowLeft keydown does not throw", () => {
    render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(() => {
      act(() => {
        fireEvent.keyDown(window, { key: "ArrowLeft" });
      });
    }).not.toThrow();
  });

  it("ArrowRight keydown does not throw", () => {
    render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(() => {
      act(() => {
        fireEvent.keyDown(window, { key: "ArrowRight" });
      });
    }).not.toThrow();
  });

  it("ArrowUp keydown does not throw", () => {
    render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(() => {
      act(() => {
        fireEvent.keyDown(window, { key: "ArrowUp" });
      });
    }).not.toThrow();
  });

  it("SVG uses violet fill colours", () => {
    render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    const svg = document.querySelector("svg[aria-label='Violet sheep']");
    expect(svg).not.toBeNull();
    const svgContent = svg!.innerHTML;
    // Violet/purple hex colours should be present
    expect(svgContent).toMatch(/#c084fc|#a855f7|#7c3aed|#6d28d9/i);
  });

  it("registers resize event listener after mount", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("resize");
    addSpy.mockRestore();
  });

  it("removes resize listener on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<VioletSheep />);
    act(() => { jest.advanceTimersByTime(0); });
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain("resize");
    removeSpy.mockRestore();
  });
});
