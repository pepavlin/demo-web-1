/**
 * @jest-environment jsdom
 */

// next/dynamic causes issues in jest — mock the dynamic import wrapper
jest.mock("next/dynamic", () => {
  return function dynamic(importFn: () => Promise<{ default: React.ComponentType }>) {
    const React = jest.requireActual("react") as typeof import("react");
    // Return a simple wrapper that always renders a stub
    const MockedDynamic = () =>
      React.createElement("div", { "data-testid": "mombasa-globe" }, "Globe stub");
    MockedDynamic.displayName = "DynamicMombasaGlobe";
    return MockedDynamic;
  };
});

// Mock next/link
jest.mock("next/link", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const MockLink = ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", { href, ...rest }, children);
  MockLink.displayName = "Link";
  return { __esModule: true, default: MockLink };
});

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MombasaPage from "../app/mombasa/page";

describe("MombasaPage", () => {
  it("renders without crashing", () => {
    expect(() => render(<MombasaPage />)).not.toThrow();
  });

  it("renders the mombasa-page container", () => {
    render(<MombasaPage />);
    expect(screen.getByTestId("mombasa-page")).toBeInTheDocument();
  });

  it("renders the globe component", () => {
    render(<MombasaPage />);
    expect(screen.getByTestId("mombasa-globe")).toBeInTheDocument();
  });

  it("renders a back navigation link to /", () => {
    render(<MombasaPage />);
    const link = screen.getByRole("link", { name: /zpět/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders the page title text", () => {
    render(<MombasaPage />);
    expect(screen.getByText(/MOMBASA/i)).toBeInTheDocument();
  });

  it("renders the map subtitle", () => {
    render(<MombasaPage />);
    expect(screen.getByText(/interaktivní mapa/i)).toBeInTheDocument();
  });
});
