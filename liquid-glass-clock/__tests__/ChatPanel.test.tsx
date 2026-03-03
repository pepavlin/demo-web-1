/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChatPanel from "../components/ChatPanel";
import type { ChatMessage } from "../hooks/useMultiplayer";

// Helper to build a minimal ChatMessage fixture.
function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "player-1",
    name: "Alice",
    color: 0x4a9eff,
    text: "Ahoj!",
    ts: Date.now(),
    ...overrides,
  };
}

// Default props for a quickly-rendered closed panel.
const defaultProps = {
  messages: [] as ChatMessage[],
  onSend: jest.fn(),
  isOpen: false,
  onOpen: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("ChatPanel — rendering", () => {
  it("renders without crashing", () => {
    expect(() => render(<ChatPanel {...defaultProps} />)).not.toThrow();
  });

  it("renders the chat-panel container", () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("does not show the message log when there are no messages", () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.queryByTestId("chat-message-log")).not.toBeInTheDocument();
  });

  it("does not show the input row when isOpen is false", () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.queryByTestId("chat-input-row")).not.toBeInTheDocument();
  });
});

// ─── Message display ──────────────────────────────────────────────────────────

describe("ChatPanel — message display", () => {
  it("shows the message log when messages are present", () => {
    render(<ChatPanel {...defaultProps} messages={[makeMsg()]} />);
    expect(screen.getByTestId("chat-message-log")).toBeInTheDocument();
  });

  it("renders each message with the sender name", () => {
    const msgs = [
      makeMsg({ name: "Alice", text: "Zdravím!" }),
      makeMsg({ id: "player-2", name: "Bob", text: "Servus!", ts: Date.now() + 1 }),
    ];
    render(<ChatPanel {...defaultProps} messages={msgs} />);
    expect(screen.getByText("Alice:")).toBeInTheDocument();
    expect(screen.getByText("Bob:")).toBeInTheDocument();
  });

  it("renders message text", () => {
    render(<ChatPanel {...defaultProps} messages={[makeMsg({ text: "Test zpráva" })]} />);
    expect(screen.getByText("Test zpráva")).toBeInTheDocument();
  });

  it("renders all individual message elements", () => {
    const msgs = Array.from({ length: 3 }, (_, i) =>
      makeMsg({ id: `p-${i}`, name: `Player${i}`, ts: Date.now() + i })
    );
    render(<ChatPanel {...defaultProps} messages={msgs} />);
    expect(screen.getAllByTestId("chat-message")).toHaveLength(3);
  });

  it("only shows last VISIBLE_COUNT (8) messages", () => {
    const msgs = Array.from({ length: 12 }, (_, i) =>
      makeMsg({ id: `p-${i}`, name: `P${i}`, text: `msg${i}`, ts: Date.now() + i })
    );
    render(<ChatPanel {...defaultProps} messages={msgs} />);
    // ChatPanel shows at most 8 at a time
    expect(screen.getAllByTestId("chat-message").length).toBeLessThanOrEqual(8);
  });
});

// ─── Input / open state ───────────────────────────────────────────────────────

describe("ChatPanel — input row", () => {
  it("shows input row when isOpen is true", () => {
    render(<ChatPanel {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId("chat-input-row")).toBeInTheDocument();
  });

  it("shows the text input when isOpen", () => {
    render(<ChatPanel {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  it("shows the send button when isOpen", () => {
    render(<ChatPanel {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId("chat-send-button")).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    render(<ChatPanel {...defaultProps} isOpen={true} />);
    const btn = screen.getByTestId("chat-send-button");
    expect(btn).toBeDisabled();
  });

  it("send button becomes enabled when user types a message", () => {
    render(<ChatPanel {...defaultProps} isOpen={true} />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Hi" } });
    expect(screen.getByTestId("chat-send-button")).not.toBeDisabled();
  });
});

// ─── Sending messages ─────────────────────────────────────────────────────────

describe("ChatPanel — sending messages", () => {
  it("calls onSend with the typed text when Enter is pressed", () => {
    const onSend = jest.fn();
    render(<ChatPanel {...defaultProps} isOpen={true} onSend={onSend} />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Zdravím" } });
    fireEvent.keyDown(screen.getByTestId("chat-input"), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Zdravím");
  });

  it("calls onClose after sending via Enter", () => {
    const onClose = jest.fn();
    render(<ChatPanel {...defaultProps} isOpen={true} onClose={onClose} />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Hi" } });
    fireEvent.keyDown(screen.getByTestId("chat-input"), { key: "Enter" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSend with the typed text when send button is clicked", () => {
    const onSend = jest.fn();
    render(<ChatPanel {...defaultProps} isOpen={true} onSend={onSend} />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Servus" } });
    fireEvent.click(screen.getByTestId("chat-send-button"));
    expect(onSend).toHaveBeenCalledWith("Servus");
  });

  it("calls onClose after sending via button click", () => {
    const onClose = jest.fn();
    render(<ChatPanel {...defaultProps} isOpen={true} onClose={onClose} />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Nazdar" } });
    fireEvent.click(screen.getByTestId("chat-send-button"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onSend when input is only whitespace", () => {
    const onSend = jest.fn();
    render(<ChatPanel {...defaultProps} isOpen={true} onSend={onSend} />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "   " } });
    fireEvent.keyDown(screen.getByTestId("chat-input"), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears the input after sending", () => {
    render(<ChatPanel {...defaultProps} isOpen={true} />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });

  it("calls onClose (not onSend) when Escape is pressed", () => {
    const onSend = jest.fn();
    const onClose = jest.fn();
    render(<ChatPanel {...defaultProps} isOpen={true} onSend={onSend} onClose={onClose} />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Draft" } });
    fireEvent.keyDown(screen.getByTestId("chat-input"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("limits input to 120 characters", () => {
    render(<ChatPanel {...defaultProps} isOpen={true} />);
    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "A".repeat(130) } });
    expect(input.value).toHaveLength(120);
  });
});

// ─── Unread badge ─────────────────────────────────────────────────────────────

describe("ChatPanel — unread badge", () => {
  it("does not show unread badge initially", () => {
    render(<ChatPanel {...defaultProps} />);
    expect(screen.queryByTestId("chat-unread-badge")).not.toBeInTheDocument();
  });

  it("shows unread badge when new messages arrive while closed", () => {
    const { rerender } = render(<ChatPanel {...defaultProps} isOpen={false} />);
    rerender(
      <ChatPanel {...defaultProps} isOpen={false} messages={[makeMsg()]} />
    );
    expect(screen.getByTestId("chat-unread-badge")).toBeInTheDocument();
  });

  it("calls onOpen when unread badge is clicked", () => {
    const onOpen = jest.fn();
    const { rerender } = render(
      <ChatPanel {...defaultProps} isOpen={false} onOpen={onOpen} />
    );
    rerender(
      <ChatPanel
        {...defaultProps}
        isOpen={false}
        onOpen={onOpen}
        messages={[makeMsg()]}
      />
    );
    fireEvent.click(screen.getByTestId("chat-unread-badge"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("hides unread badge when panel is opened", () => {
    const { rerender } = render(
      <ChatPanel {...defaultProps} isOpen={false} messages={[makeMsg()]} />
    );
    rerender(
      <ChatPanel {...defaultProps} isOpen={true} messages={[makeMsg()]} />
    );
    expect(screen.queryByTestId("chat-unread-badge")).not.toBeInTheDocument();
  });
});
