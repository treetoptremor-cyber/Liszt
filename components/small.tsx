"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/Sheet";

/** Destructive action button: first tap arms it for 3s, second tap fires. */
export function ConfirmButton({
  label,
  confirmLabel,
  className = "btn btn-danger",
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  className?: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <button
      type="button"
      className={`${className} ${armed ? "btn-armed" : ""}`}
      onClick={() => {
        if (armed) {
          if (timer.current) clearTimeout(timer.current);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/** Sheet with a single text input — used for renames and new list names. */
export function TextSheet({
  title,
  label,
  initial = "",
  placeholder = "",
  saveLabel = "Save",
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  saveLabel?: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim();
          if (!v) return;
          onSave(v);
          onClose();
        }}
      >
        <label className="field">
          <span className="field-label">{label}</span>
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={60}
            autoFocus
          />
        </label>
        <button className="btn btn-primary" disabled={!value.trim()}>
          {saveLabel}
        </button>
      </form>
    </Sheet>
  );
}

/** Small round member avatar with their initial. */
export function Avatar({
  name,
  color,
  size = 22,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.5 }}
      title={name}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
