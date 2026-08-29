"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icons";

/** Bottom sheet used for item details, list settings, renames, etc. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
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
