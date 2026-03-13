/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import WeaponSelect from "../components/WeaponSelect";

describe("WeaponSelect component", () => {
  it("renders without crashing", () => {
    expect(() => render(<WeaponSelect onConfirm={jest.fn()} />)).not.toThrow();
  });

  it("shows the overlay", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    expect(screen.getByTestId("weapon-select-overlay")).toBeInTheDocument();
  });

  it("shows all five weapon cards including axe", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    expect(screen.getByTestId("weapon-card-sword")).toBeInTheDocument();
    expect(screen.getByTestId("weapon-card-bow")).toBeInTheDocument();
    expect(screen.getByTestId("weapon-card-crossbow")).toBeInTheDocument();
    expect(screen.getByTestId("weapon-card-sniper")).toBeInTheDocument();
    expect(screen.getByTestId("weapon-card-axe")).toBeInTheDocument();
  });

  it("shows weapon names in Czech including axe", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    expect(screen.getByText("Meč")).toBeInTheDocument();
    expect(screen.getByText("Luk")).toBeInTheDocument();
    expect(screen.getByText("Kuše")).toBeInTheDocument();
    expect(screen.getByText("Odstřelovačka")).toBeInTheDocument();
    expect(screen.getByText("Sekera")).toBeInTheDocument();
  });

  it("renders a confirm button", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    expect(screen.getByTestId("weapon-confirm-btn")).toBeInTheDocument();
  });

  it("defaults to sword selected and confirm button says Meč", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    const btn = screen.getByTestId("weapon-confirm-btn");
    expect(btn.textContent).toMatch(/Meč/);
  });

  it("clicking bow weapon card selects it", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    const bowCard = screen.getByTestId("weapon-card-bow");
    fireEvent.click(bowCard);
    // After clicking bow, confirm button should say Luk
    const btn = screen.getByTestId("weapon-confirm-btn");
    expect(btn.textContent).toMatch(/Luk/);
  });

  it("clicking the confirm button calls onConfirm with selected weapon", () => {
    const onConfirm = jest.fn();
    render(<WeaponSelect onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("weapon-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("sword");
  });

  it("selecting bow and confirming calls onConfirm with 'bow'", () => {
    const onConfirm = jest.fn();
    render(<WeaponSelect onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("weapon-card-bow"));
    fireEvent.click(screen.getByTestId("weapon-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith("bow");
  });

  it("selecting crossbow and confirming calls onConfirm with 'crossbow'", () => {
    const onConfirm = jest.fn();
    render(<WeaponSelect onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("weapon-card-crossbow"));
    fireEvent.click(screen.getByTestId("weapon-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith("crossbow");
  });

  it("keyboard shortcut '2' selects bow", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    act(() => {
      fireEvent.keyDown(window, { key: "2" });
    });
    const btn = screen.getByTestId("weapon-confirm-btn");
    expect(btn.textContent).toMatch(/Luk/);
  });

  it("keyboard shortcut '3' selects crossbow", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    act(() => {
      fireEvent.keyDown(window, { key: "3" });
    });
    const btn = screen.getByTestId("weapon-confirm-btn");
    expect(btn.textContent).toMatch(/Kuše/);
  });

  it("keyboard shortcut '1' selects sword", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    // First switch to bow, then back to sword
    act(() => {
      fireEvent.keyDown(window, { key: "2" });
    });
    act(() => {
      fireEvent.keyDown(window, { key: "1" });
    });
    const btn = screen.getByTestId("weapon-confirm-btn");
    expect(btn.textContent).toMatch(/Meč/);
  });

  it("Enter key calls onConfirm with currently selected weapon", () => {
    const onConfirm = jest.fn();
    render(<WeaponSelect onConfirm={onConfirm} />);
    act(() => {
      fireEvent.keyDown(window, { key: "3" });
    });
    act(() => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(onConfirm).toHaveBeenCalledWith("crossbow");
  });

  it("shows keyboard shortcut hints [1] through [5]", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    expect(screen.getByText("[1]")).toBeInTheDocument();
    expect(screen.getByText("[2]")).toBeInTheDocument();
    expect(screen.getByText("[3]")).toBeInTheDocument();
    expect(screen.getByText("[4]")).toBeInTheDocument();
    expect(screen.getByText("[5]")).toBeInTheDocument();
  });

  it("keyboard shortcut '5' selects axe", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    act(() => {
      fireEvent.keyDown(window, { key: "5" });
    });
    const btn = screen.getByTestId("weapon-confirm-btn");
    expect(btn.textContent).toMatch(/Sekera/);
  });

  it("selecting axe and confirming calls onConfirm with 'axe'", () => {
    const onConfirm = jest.fn();
    render(<WeaponSelect onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("weapon-card-axe"));
    fireEvent.click(screen.getByTestId("weapon-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith("axe");
  });

  it("axe card is not pressed by default", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    const axeCard = screen.getByTestId("weapon-card-axe");
    expect(axeCard).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking axe card updates aria-pressed", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    const axeCard = screen.getByTestId("weapon-card-axe");
    fireEvent.click(axeCard);
    expect(axeCard).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("weapon-card-sword")).toHaveAttribute("aria-pressed", "false");
  });

  it("keyboard shortcut '4' selects sniper", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    act(() => {
      fireEvent.keyDown(window, { key: "4" });
    });
    const btn = screen.getByTestId("weapon-confirm-btn");
    expect(btn.textContent).toMatch(/Odstřelovačka/);
  });

  it("selecting sniper and confirming calls onConfirm with 'sniper'", () => {
    const onConfirm = jest.fn();
    render(<WeaponSelect onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("weapon-card-sniper"));
    fireEvent.click(screen.getByTestId("weapon-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith("sniper");
  });

  it("shows the header title 'Vyber zbraň'", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    expect(screen.getByText("Vyber zbraň")).toBeInTheDocument();
  });

  it("sword card is initially marked as pressed (selected)", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    const swordCard = screen.getByTestId("weapon-card-sword");
    expect(swordCard).toHaveAttribute("aria-pressed", "true");
  });

  it("bow card is not pressed by default", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    const bowCard = screen.getByTestId("weapon-card-bow");
    expect(bowCard).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking bow card updates aria-pressed", () => {
    render(<WeaponSelect onConfirm={jest.fn()} />);
    const bowCard = screen.getByTestId("weapon-card-bow");
    fireEvent.click(bowCard);
    expect(bowCard).toHaveAttribute("aria-pressed", "true");
    // Sword should be deselected
    expect(screen.getByTestId("weapon-card-sword")).toHaveAttribute("aria-pressed", "false");
  });
});
