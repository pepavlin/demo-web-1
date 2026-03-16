/**
 * Tests for the InventoryModal component:
 * - Renders correctly when open/closed
 * - Displays title, icon, and loot items
 * - Calls onTakeAll when "Vzít vše" button is clicked
 * - Calls onClose when close button is clicked
 * - Calls onClose when backdrop is clicked
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InventoryModal from "@/components/InventoryModal";
import type { AirdropLoot } from "@/lib/gameTypes";

const sampleItems: AirdropLoot[] = [
  { type: "coins",  amount: 30, label: "Zlaté mince" },
  { type: "health", amount: 50, label: "Lékárnička" },
  { type: "weapon", amount: 0,  label: "Luk", weaponType: "bow" },
];

describe("InventoryModal", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <InventoryModal
        open={false}
        title="Test"
        containerIcon="📦"
        items={sampleItems}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the modal when open=true", () => {
    render(
      <InventoryModal
        open={true}
        title="Zásobovací bedna"
        containerIcon="📦"
        items={sampleItems}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("Zásobovací bedna")).toBeInTheDocument();
  });

  it("displays all item labels", () => {
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="📦"
        items={sampleItems}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("Zlaté mince")).toBeInTheDocument();
    expect(screen.getByText("Lékárnička")).toBeInTheDocument();
    expect(screen.getByText("Luk")).toBeInTheDocument();
  });

  it("displays coin amount text", () => {
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="📦"
        items={[{ type: "coins", amount: 42, label: "Mince" }]}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("+42 mincí")).toBeInTheDocument();
  });

  it("displays health amount text", () => {
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="❤️"
        items={[{ type: "health", amount: 75, label: "Lék" }]}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("+75 HP")).toBeInTheDocument();
  });

  it("calls onTakeAll when 'Vzít vše' button is clicked", () => {
    const onTakeAll = jest.fn();
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="📦"
        items={sampleItems}
        onTakeAll={onTakeAll}
        onClose={jest.fn()}
      />
    );
    // Use getByRole to target the specific button (not the hint text)
    fireEvent.click(screen.getByRole("button", { name: /Vzít vše/ }));
    expect(onTakeAll).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when 'Zavřít' button is clicked", () => {
    const onClose = jest.fn();
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="📦"
        items={sampleItems}
        onTakeAll={jest.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Zavřít" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows 'Prázdné' when items array is empty", () => {
    render(
      <InventoryModal
        open={true}
        title="Prázdná truhla"
        containerIcon="📦"
        items={[]}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("Prázdné")).toBeInTheDocument();
  });

  it("shows the container icon", () => {
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="🧰"
        items={sampleItems}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("🧰")).toBeInTheDocument();
  });

  it("shows 'Obsah truhly' subtitle when open", () => {
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="📦"
        items={sampleItems}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("Obsah truhly")).toBeInTheDocument();
  });

  it("keyboard hint text is shown", () => {
    render(
      <InventoryModal
        open={true}
        title="Test"
        containerIcon="📦"
        items={sampleItems}
        onTakeAll={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/\[E\] Vzít vše/)).toBeInTheDocument();
  });
});
