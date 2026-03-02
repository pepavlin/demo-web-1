/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import MobileControls from "../components/MobileControls";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRefs() {
  const keysRef = { current: {} as Record<string, boolean> };
  const yawRef = { current: 0 };
  const pitchRef = { current: 0 };
  return { keysRef, yawRef, pitchRef };
}

function makeTouch(id: number, x: number, y: number): Touch {
  return {
    identifier: id,
    clientX: x,
    clientY: y,
    target: document.body,
    // minimal Touch interface
  } as unknown as Touch;
}

function dispatchTouchEvent(
  type: string,
  touches: Touch[],
  changedTouches: Touch[]
) {
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    changedTouches,
    touches,
  });
  document.dispatchEvent(event);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MobileControls", () => {
  describe("rendering", () => {
    it("renders nothing when visible=false", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      const { container } = render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={false}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders joystick and buttons when visible=true", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );
      // Joystick zone is accessible
      expect(screen.getByLabelText("pohybový joystick")).toBeInTheDocument();
      // Action buttons
      expect(screen.getByText("↑")).toBeInTheDocument(); // jump
      expect(screen.getByText("⚔")).toBeInTheDocument(); // attack
      expect(screen.getByText("E")).toBeInTheDocument();  // interact
      expect(screen.getByText("💨")).toBeInTheDocument(); // sprint
    });
  });

  describe("jump button", () => {
    it("sets Space key on press and clears on release", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );
      const jumpBtn = screen.getByText("↑");

      fireEvent.mouseDown(jumpBtn);
      expect(keysRef.current["Space"]).toBe(true);

      fireEvent.mouseUp(jumpBtn);
      expect(keysRef.current["Space"]).toBe(false);
    });
  });

  describe("attack button", () => {
    it("calls onAttack callback when pressed", () => {
      const onAttack = jest.fn();
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={onAttack}
          onInteract={jest.fn()}
          visible={true}
        />
      );
      const attackBtn = screen.getByText("⚔");
      fireEvent.mouseDown(attackBtn);
      expect(onAttack).toHaveBeenCalledTimes(1);
    });
  });

  describe("interact button", () => {
    it("calls onInteract callback when pressed", () => {
      const onInteract = jest.fn();
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={onInteract}
          visible={true}
        />
      );
      const interactBtn = screen.getByText("E");
      fireEvent.mouseDown(interactBtn);
      expect(onInteract).toHaveBeenCalledTimes(1);
    });
  });

  describe("sprint button", () => {
    it("sets ShiftLeft on press and clears on release", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );
      const sprintBtn = screen.getByText("💨");

      fireEvent.mouseDown(sprintBtn);
      expect(keysRef.current["ShiftLeft"]).toBe(true);

      fireEvent.mouseUp(sprintBtn);
      expect(keysRef.current["ShiftLeft"]).toBe(false);
    });
  });

  describe("movement joystick via touch", () => {
    // jsdom ships a basic TouchEvent support
    const origInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");

    beforeEach(() => {
      // Make the window 800px wide so left zone < 360px
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 800,
      });
    });

    afterEach(() => {
      if (origInnerWidth) {
        Object.defineProperty(window, "innerWidth", origInnerWidth);
      }
    });

    it("sets KeyW when joystick is pushed forward (up)", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );

      // Start touch in left zone (x=100 < 800*0.45=360)
      const t = makeTouch(1, 100, 400);
      act(() => {
        dispatchTouchEvent("touchstart", [t], [t]);
      });

      // Move upward (negative dy)
      const tMove = makeTouch(1, 100, 330); // dy = -70 (> joystick radius, clamped)
      act(() => {
        dispatchTouchEvent("touchmove", [tMove], [tMove]);
      });

      expect(keysRef.current["KeyW"]).toBe(true);
      expect(keysRef.current["KeyS"]).toBe(false);
    });

    it("clears movement keys on touch end", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );

      const t = makeTouch(2, 100, 400);
      act(() => {
        dispatchTouchEvent("touchstart", [t], [t]);
      });
      const tMove = makeTouch(2, 100, 330);
      act(() => {
        dispatchTouchEvent("touchmove", [tMove], [tMove]);
      });

      expect(keysRef.current["KeyW"]).toBe(true);

      const tEnd = makeTouch(2, 100, 330);
      act(() => {
        dispatchTouchEvent("touchend", [], [tEnd]);
      });

      expect(keysRef.current["KeyW"]).toBe(false);
      expect(keysRef.current["KeyS"]).toBe(false);
      expect(keysRef.current["KeyA"]).toBe(false);
      expect(keysRef.current["KeyD"]).toBe(false);
    });
  });

  describe("camera look via touch", () => {
    const origInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");

    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 800,
      });
    });

    afterEach(() => {
      if (origInnerWidth) {
        Object.defineProperty(window, "innerWidth", origInnerWidth);
      }
    });

    it("updates yawRef when dragging in the right zone", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );

      // Start touch in right zone (x=600 > 800*0.45=360)
      const t = makeTouch(10, 600, 400);
      act(() => {
        dispatchTouchEvent("touchstart", [t], [t]);
      });

      // Move right by 50px
      const tMove = makeTouch(10, 650, 400);
      act(() => {
        dispatchTouchEvent("touchmove", [tMove], [tMove]);
      });

      // yaw should decrease (turning right)
      expect(yawRef.current).toBeLessThan(0);
    });

    it("updates pitchRef when dragging up in the right zone (look up)", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );

      const t = makeTouch(11, 600, 400);
      act(() => {
        dispatchTouchEvent("touchstart", [t], [t]);
      });

      // Move up by 40px (negative deltaY → pitch increases)
      const tMove = makeTouch(11, 600, 360);
      act(() => {
        dispatchTouchEvent("touchmove", [tMove], [tMove]);
      });

      // pitchRef -= (-40) * 0.004 → pitchRef should be positive (looking up)
      expect(pitchRef.current).toBeGreaterThan(0);
    });

    it("clamps pitch within allowed range", () => {
      const { keysRef, yawRef, pitchRef } = makeRefs();
      render(
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={jest.fn()}
          onInteract={jest.fn()}
          visible={true}
        />
      );

      const t = makeTouch(12, 600, 200);
      act(() => {
        dispatchTouchEvent("touchstart", [t], [t]);
      });

      // Drag up by an extreme amount
      const tMove = makeTouch(12, 600, -9000);
      act(() => {
        dispatchTouchEvent("touchmove", [tMove], [tMove]);
      });

      expect(pitchRef.current).toBeGreaterThan(-Math.PI / 2);
    });
  });
});
