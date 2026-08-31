"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icons";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Bottom sheet used for item details, list settings, renames, etc.
 *  Manages focus: moves it inside on open, keeps Tab cycling within the
 *  dialog, and hands it back to the opener on close.
 *
 *  Pass `onBack` when the sheet was drilled into from another one — the
 *  calendar shows a single sheet at a time and steps back to the day. */
export function Sheet({
  title,
  onClose,
  onBack,
  children,
}: {
  title?: string;
  onClose: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first field if there is one, else the panel itself.
    const first = panel?.querySelector<HTMLElement>("input, textarea");
    (first ?? panel)?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (onBack ?? onClose)();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onBack]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          {onBack && (
            <button className="icon-btn" onClick={onBack} aria-label="Back">
              <Icon name="chevron-left" size={20} />
            </button>
          )}
          {title ? <h2 className="sheet-title">{title}</h2> : <span />}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
