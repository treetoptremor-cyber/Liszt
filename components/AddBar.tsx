"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import type { FrequentItem } from "@/lib/types";

export function AddBar({
  placeholder,
  frequent,
  existingTexts,
  onAdd,
}: {
  placeholder: string;
  /** Previously-added items for quick re-adding (grocery lists). */
  frequent: FrequentItem[];
  /** Lowercased texts already on the list (to hide from suggestions). */
  existingTexts: Set<string>;
  onAdd: (text: string, category: string | null) => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const query = text.trim().toLowerCase();
    if (!query) return [];
    const starts: FrequentItem[] = [];
    const contains: FrequentItem[] = [];
    for (const f of frequent) {
      const t = f.text.toLowerCase();
      if (t === query || existingTexts.has(t)) continue;
      if (t.startsWith(query)) starts.push(f);
      else if (t.includes(query)) contains.push(f);
    }
    return [...starts, ...contains].slice(0, 5);
  }, [text, frequent, existingTexts]);

  function submit(value: string, category: string | null) {
    const v = value.replace(/\s+/g, " ").trim();
    if (!v) return;
    onAdd(v, category);
    setText("");
    inputRef.current?.focus();
  }

  return (
    <div className="addbar-wrap">
      {suggestions.length > 0 && (
        <div className="suggestions card">
          {suggestions.map((s) => (
            <button
              key={s.text}
              className="suggestion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(s.text, s.category)}
            >
              <span className="suggestion-text">{s.text}</span>
              {s.category && (
                <span className="suggestion-cat">{s.category}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <form
        className="addbar"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text, null);
        }}
      >
        <input
          ref={inputRef}
          className="addbar-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={200}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
        />
        <button
          className="addbar-btn"
          aria-label="Add"
          disabled={!text.trim()}
        >
          <Icon name="plus" size={22} />
        </button>
      </form>
    </div>
  );
}
