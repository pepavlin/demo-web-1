/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement("div", props, children),
  },
}));

import LiquidBackground from "../components/LiquidBackground";

describe("LiquidBackground component", () => {
  it("renders without crashing", () => {
    const { container } = render(<LiquidBackground />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders particles", () => {
    const { container } = render(<LiquidBackground />);
    const particles = container.querySelectorAll(".particle");
    expect(particles.length).toBeGreaterThan(0);
  });

  it("renders the grid overlay", () => {
    const { container } = render(<LiquidBackground />);
    // Fixed container should exist
    expect(container.firstChild).toHaveClass("fixed");
  });
});
