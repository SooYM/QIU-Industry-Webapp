"use client";
import { useEffect } from "react";

// Card families that carry the pointer-tracking border glow. Mirrors the selector
// lists in globals.css — add a class in both places, or use `glow-card` in markup.
const GLOW_SELECTOR = ".glow-card,.job-card,.event-card,.ui-card,.stat-card,.rank-card,.trend-card,.activity-card,.market-card,.auth-card,.exhibitor-card";

/** Writes `--mouse-x/--mouse-y` on the hovered card. One delegated listener for the
 *  whole document instead of an `onPointerMove` prop threaded through every card. */
export function CardGlow() {
  useEffect(() => {
    function move(event: PointerEvent) {
      // The glow is off under `@media (hover:none)`; skip the style writes there.
      if (event.pointerType !== "mouse") return;
      const card = (event.target as Element | null)?.closest<HTMLElement>(GLOW_SELECTOR);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
    }
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
  return null;
}
