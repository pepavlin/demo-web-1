/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      onAnimationComplete,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode;
      onAnimationComplete?: () => void;
    }) => React.createElement("div", props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useAnimationControls: () => ({
    start: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(),
    stop: jest.fn(),
  }),
}));

jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  createPortal: (node: React.ReactNode) => node,
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

import SlimeJumper from "../components/SlimeJumper";

describe("SlimeJumper component", () => {
  const makePanelRef = (w = 300, h = 200) => {
    const div = document.createElement("div");
    Object.defineProperty(div, "offsetWidth",  { get: () => w });
    Object.defineProperty(div, "offsetHeight", { get: () => h });
    div.parentElement; // ensure parentElement exists via DOM
    const ref = { current: div } as React.RefObject<HTMLDivElement>;
    return ref;
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders without crashing", () => {
    const panelRef = makePanelRef();
    render(
      <div style={{ position: "relative" }}>
        <SlimeJumper panelRef={panelRef} second={0} shakeSignal={0} />
      </div>
    );
  });

  it("returns null while not yet visible", () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>;
    const { container } = render(
      <div>
        <SlimeJumper panelRef={ref} second={0} shakeSignal={0} />
      </div>
    );
    // With null panelRef the slime stays hidden, so the container has only the wrapper
    expect(container.querySelector("[data-slime]")).toBeNull();
  });

  it("does not crash when shakeSignal changes", () => {
    const panelRef = makePanelRef();
    const { rerender } = render(
      <div>
        <SlimeJumper panelRef={panelRef} second={0} shakeSignal={0} />
      </div>
    );
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(() =>
      rerender(
        <div>
          <SlimeJumper panelRef={panelRef} second={1} shakeSignal={1} />
        </div>
      )
    ).not.toThrow();
  });

  it("does not crash when second increments multiple times", () => {
    const panelRef = makePanelRef();
    const { rerender } = render(
      <div>
        <SlimeJumper panelRef={panelRef} second={0} shakeSignal={0} />
      </div>
    );
    for (let s = 1; s <= 5; s++) {
      expect(() =>
        rerender(
          <div>
            <SlimeJumper panelRef={panelRef} second={s} shakeSignal={0} />
          </div>
        )
      ).not.toThrow();
    }
  });
});
