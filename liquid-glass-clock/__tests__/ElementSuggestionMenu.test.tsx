/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import ElementSuggestionMenu, {
  getElementInfo,
  getElementDescription,
} from "../components/ElementSuggestionMenu";

const WEBHOOK_URL = "https://n8n.pavlin.dev/webhook/demo-web-1-create-issue";

describe("ElementSuggestionMenu", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Utility helpers ─────────────────────────────────────────────────────────

  describe("getElementInfo", () => {
    it("returns tag name for a plain element", () => {
      const el = document.createElement("button");
      const info = getElementInfo(el);
      expect(info.tag).toBe("button");
    });

    it("captures element id when present", () => {
      const el = document.createElement("div");
      el.id = "my-id";
      const info = getElementInfo(el);
      expect(info.id).toBe("my-id");
    });

    it("captures classes", () => {
      const el = document.createElement("span");
      el.className = "foo bar baz";
      const info = getElementInfo(el);
      expect(info.classes).toContain("foo");
      expect(info.classes).toContain("bar");
    });

    it("truncates text content to 120 chars", () => {
      const el = document.createElement("p");
      el.textContent = "a".repeat(200);
      const info = getElementInfo(el);
      expect(info.text.length).toBeLessThanOrEqual(120);
    });

    it("returns empty id when no id set", () => {
      const el = document.createElement("div");
      const info = getElementInfo(el);
      expect(info.id).toBeUndefined();
    });
  });

  describe("getElementDescription", () => {
    it("formats tag with id", () => {
      const info = { tag: "button", id: "submit", classes: [], text: "Click me", selector: "" };
      expect(getElementDescription(info)).toContain("button#submit");
    });

    it("formats tag with class when no id", () => {
      const info = { tag: "div", classes: ["card", "active"], text: "", selector: "" };
      expect(getElementDescription(info)).toContain("div.card.active");
    });

    it("includes text preview when present", () => {
      const info = { tag: "p", classes: [], text: "Hello world", selector: "" };
      const desc = getElementDescription(info);
      expect(desc).toContain('"Hello world"');
    });

    it("truncates long text with ellipsis", () => {
      const info = { tag: "p", classes: [], text: "a".repeat(80), selector: "" };
      const desc = getElementDescription(info);
      expect(desc).toContain("…");
    });
  });

  // ─── Component rendering ─────────────────────────────────────────────────────

  it("renders nothing initially (no context menu visible)", () => {
    render(<ElementSuggestionMenu />);
    expect(screen.queryByTestId("element-suggestion-menu")).not.toBeInTheDocument();
  });

  it("shows context menu on right-click anywhere in document", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    const target = screen.getByTestId("target");
    fireEvent.contextMenu(target);

    expect(screen.getByTestId("element-suggestion-menu")).toBeInTheDocument();
    expect(screen.getByText("Napsat návrh")).toBeInTheDocument();
  });

  it("highlights the right-clicked element with an outline", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    const target = screen.getByTestId("target");
    fireEvent.contextMenu(target);

    expect(target.style.outline).toContain("2px solid");
  });

  it("clicking 'Napsat návrh' reveals the suggestion input form", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));

    expect(
      screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /odeslat návrh/i })).toBeInTheDocument();
  });

  it("submit button is disabled when textarea is empty", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));

    expect(screen.getByRole("button", { name: /odeslat návrh/i })).toBeDisabled();
  });

  it("submit button becomes enabled when text is entered", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));

    const textarea = screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i);
    fireEvent.change(textarea, { target: { value: "Větší font" } });

    expect(screen.getByRole("button", { name: /odeslat návrh/i })).not.toBeDisabled();
  });

  it("sends POST to webhook with message, type and element info on submit", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    render(
      <div>
        <ElementSuggestionMenu />
        <p id="hero-text" data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));

    const textarea = screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i);
    fireEvent.change(textarea, { target: { value: "Větší font" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat návrh/i }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      WEBHOOK_URL,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.message).toMatch(/^\[Element: <p#hero-text>/);
    expect(callBody.message).toContain("Větší font");
    expect(callBody.type).toBe("element_suggestion");
    expect(callBody.element).toBeDefined();
    expect(callBody.element.tag).toBe("p");
  });

  it("shows success state after successful submission", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));
    fireEvent.change(
      screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i),
      { target: { value: "Větší font" } }
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat návrh/i }));
    });

    expect(screen.getByText(/návrh odeslán/i)).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));
    fireEvent.change(
      screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i),
      { target: { value: "Návrh" } }
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat návrh/i }));
    });

    expect(screen.getByText(/chyba při odesílání/i)).toBeInTheDocument();
  });

  it("shows error message when server returns non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));
    fireEvent.change(
      screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i),
      { target: { value: "Návrh" } }
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat návrh/i }));
    });

    expect(screen.getByText(/chyba při odesílání/i)).toBeInTheDocument();
  });

  it("submits on Enter key in textarea", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));
    const textarea = screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i);
    fireEvent.change(textarea, { target: { value: "Návrh" } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT submit on Shift+Enter", async () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));
    const textarea = screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i);
    fireEvent.change(textarea, { target: { value: "Návrh" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes menu via close button (×) and removes element highlight", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    const target = screen.getByTestId("target");
    fireEvent.contextMenu(target);
    fireEvent.click(screen.getByText("Napsat návrh"));

    fireEvent.click(screen.getByRole("button", { name: /zavřít návrh/i }));

    expect(screen.queryByTestId("element-suggestion-menu")).not.toBeInTheDocument();
    expect(target.style.outline).toBe("");
  });

  it("closes menu on Escape key press", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    expect(screen.getByTestId("element-suggestion-menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("element-suggestion-menu")).not.toBeInTheDocument();
  });

  it("closes menu when clicking outside", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
        <button data-testid="outside">Outside</button>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    expect(screen.getByTestId("element-suggestion-menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(screen.queryByTestId("element-suggestion-menu")).not.toBeInTheDocument();
  });

  it("does not show the menu when right-clicking inside the menu itself", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    // Open menu
    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));

    // Right-click inside the open menu panel — should NOT close and re-open a new menu
    const textarea = screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i);
    fireEvent.contextMenu(textarea);

    // The input form should still be visible (menu didn't reset)
    expect(screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i)).toBeInTheDocument();
  });

  it("re-opens on a different element and removes previous highlight", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="first">First</p>
        <p data-testid="second">Second</p>
      </div>
    );

    const first = screen.getByTestId("first");
    const second = screen.getByTestId("second");

    fireEvent.contextMenu(first);
    expect(first.style.outline).toContain("2px solid");

    fireEvent.contextMenu(second);
    expect(first.style.outline).toBe("");
    expect(second.style.outline).toContain("2px solid");
  });

  it("does not submit whitespace-only messages", () => {
    render(
      <div>
        <ElementSuggestionMenu />
        <p data-testid="target">Hello</p>
      </div>
    );

    fireEvent.contextMenu(screen.getByTestId("target"));
    fireEvent.click(screen.getByText("Napsat návrh"));
    fireEvent.change(
      screen.getByPlaceholderText(/popiš svůj návrh k tomuto prvku/i),
      { target: { value: "   " } }
    );

    expect(screen.getByRole("button", { name: /odeslat návrh/i })).toBeDisabled();
  });
});
