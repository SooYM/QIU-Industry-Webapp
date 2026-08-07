import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Shared backdrop + dialog shell. Closes on a click that starts on the backdrop
 * itself (not on the panel). ESC handling stays with the owner so a single
 * key listener can close whichever modal is open.
 *
 * Tab is cycled within the panel: `aria-modal="true"` tells a screen reader the
 * page behind is inert, but it does not make it so — without this, Tab walks
 * straight out of the dialog into a page that is still rendered and focusable.
 * Trapping here fixes every modal in the app at once.
 */
export function Modal({
  className,
  labelledBy,
  closeLabel,
  onClose,
  children,
}: {
  className: string;
  labelledBy: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panelRef.current) return;
      const targets = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!targets.length) return;

      const first = targets[0];
      const last = targets[targets.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has already escaped.
      if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="modal-close" onClick={onClose} aria-label={closeLabel} autoFocus>×</button>
        {children}
      </section>
    </div>
  );
}
