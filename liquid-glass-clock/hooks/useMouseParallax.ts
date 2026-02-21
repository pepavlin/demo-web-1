"use client";

import { useEffect } from "react";
import { useMotionValue, useSpring, MotionValue } from "framer-motion";

export interface MouseParallax {
  /** Normalised X: -1 (left edge) … +1 (right edge), spring-smoothed */
  normX: MotionValue<number>;
  /** Normalised Y: -1 (top edge) … +1 (bottom edge), spring-smoothed */
  normY: MotionValue<number>;
}

/**
 * Tracks mouse position and returns spring-smoothed normalised coordinates.
 * normX / normY are MotionValues so they can be used directly with
 * framer-motion's `useTransform` for 3-D tilt effects.
 */
export function useMouseParallax(): MouseParallax {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const normX = useSpring(rawX, { stiffness: 70, damping: 18, mass: 0.6 });
  const normY = useSpring(rawY, { stiffness: 70, damping: 18, mass: 0.6 });

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      rawX.set((e.clientX / window.innerWidth) * 2 - 1);
      rawY.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, [rawX, rawY]);

  return { normX, normY };
}
