import type { ReactNode } from "react";

/**
 * Shared backdrop + dialog shell. Closes on a click that starts on the backdrop
 * itself (not on the panel). ESC handling stays with the owner so a single
 * key listener can close whichever modal is open.
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
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <button className="modal-close" onClick={onClose} aria-label={closeLabel} autoFocus>×</button>
        {children}
      </section>
    </div>
  );
}
