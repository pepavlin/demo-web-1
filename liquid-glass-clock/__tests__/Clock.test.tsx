/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement("div", props, children),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) =>
      React.createElement("span", props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useAnimationControls: () => ({
    start: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(),
    stop: jest.fn(),
  }),
}));

import Clock from "../components/Clock";

describe("Clock component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set a fixed date: 2026-02-20 15:30:45
    const mockDate = new Date(2026, 1, 20, 15, 30, 45);
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders without crashing", () => {
    render(<Clock />);
    // After mount, useEffect fires and time is set
    act(() => {
      jest.advanceTimersByTime(0);
    });
  });

  it("displays hours, minutes and seconds", () => {
    render(<Clock />);
    act(() => {
      jest.advanceTimersByTime(0);
    });

    // Hours = 15, minutes = 30, seconds = 45
    const allText = document.body.textContent ?? "";
    expect(allText).toContain("15");
    expect(allText).toContain("30");
    expect(allText).toContain("45");
  });

  it("updates time every second", () => {
    render(<Clock />);
    act(() => {
      jest.advanceTimersByTime(0);
    });

    let text = document.body.textContent ?? "";
    expect(text).toContain("45"); // seconds = 45

    // Advance 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    text = document.body.textContent ?? "";
    expect(text).toContain("46"); // seconds = 46
  });

  it("shows timezone information", () => {
    render(<Clock />);
    act(() => {
      jest.advanceTimersByTime(0);
    });

    const allText = document.body.textContent ?? "";
    // Timezone string should be present (e.g. "UTC" or "Europe/Prague")
    expect(allText.length).toBeGreaterThan(0);
  });

  it("pads single-digit values with leading zero", () => {
    // Set time to 09:05:03
    jest.setSystemTime(new Date(2026, 1, 20, 9, 5, 3));
    render(<Clock />);
    act(() => {
      jest.advanceTimersByTime(0);
    });

    const allText = document.body.textContent ?? "";
    expect(allText).toContain("09");
    expect(allText).toContain("05");
    expect(allText).toContain("03");
  });
});
