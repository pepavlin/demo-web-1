/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import LobbyScreen from "../components/LobbyScreen";

describe("LobbyScreen component", () => {
  it("renders without crashing", () => {
    expect(() => render(<LobbyScreen onJoin={() => {}} />)).not.toThrow();
  });

  it("shows the lobby screen container", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByTestId("lobby-screen")).toBeInTheDocument();
  });

  it("shows the title 'Open World'", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByText("Open World")).toBeInTheDocument();
  });

  it("shows name input field", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows a join button", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByRole("button", { name: /vstoupit/i })).toBeInTheDocument();
  });

  it("calls onJoin with entered name when button is clicked", () => {
    const onJoin = jest.fn();
    render(<LobbyScreen onJoin={onJoin} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "TestPlayer" } });
    fireEvent.click(screen.getByRole("button", { name: /vstoupit/i }));
    expect(onJoin).toHaveBeenCalledWith("TestPlayer");
  });

  it("calls onJoin with default name 'Hráč' when name is empty", () => {
    const onJoin = jest.fn();
    render(<LobbyScreen onJoin={onJoin} />);
    fireEvent.click(screen.getByRole("button", { name: /vstoupit/i }));
    expect(onJoin).toHaveBeenCalledWith("Hráč");
  });

  it("calls onJoin when Enter key is pressed in input", () => {
    const onJoin = jest.fn();
    render(<LobbyScreen onJoin={onJoin} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "TestPlayer" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onJoin).toHaveBeenCalledWith("TestPlayer");
  });

  it("limits name to 20 characters", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "A".repeat(25) } });
    expect((input as HTMLInputElement).value).toHaveLength(20);
  });

  it("shows multiplayer subtitle text", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByText(/multiplayer/i)).toBeInTheDocument();
  });

  it("shows keyboard hint for Spacebar", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByText(/Mezerník/i)).toBeInTheDocument();
  });

  it("shows keyboard hint for Enter", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByText(/Enter/i)).toBeInTheDocument();
  });

  it("shows game objectives (sheep, coins)", () => {
    render(<LobbyScreen onJoin={() => {}} />);
    expect(screen.getByText(/ovce/i)).toBeInTheDocument();
    expect(screen.getByText(/mince/i)).toBeInTheDocument();
  });

  it("does not call onJoin when only whitespace is typed", () => {
    const onJoin = jest.fn();
    render(<LobbyScreen onJoin={onJoin} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /vstoupit/i }));
    // whitespace-only → falls back to "Hráč"
    expect(onJoin).toHaveBeenCalledWith("Hráč");
  });

  it("calls onJoin with spacebar when input is NOT focused", () => {
    const onJoin = jest.fn();
    render(<LobbyScreen onJoin={onJoin} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Test" } });
    // Blur the input so spacebar fires the join
    act(() => { input.blur(); });
    const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true });
    act(() => { window.dispatchEvent(event); });
    expect(onJoin).toHaveBeenCalledWith("Test");
  });

  it("removes keydown listener on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<LobbyScreen onJoin={() => {}} />);
    unmount();
    const calls = removeSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain("keydown");
    removeSpy.mockRestore();
  });
});
