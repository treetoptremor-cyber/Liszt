"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Avatar, ConfirmButton } from "@/components/small";
import { useSync } from "@/components/SyncContext";
import { CATEGORIES } from "@/lib/categories";
import type { Item, ListType } from "@/lib/types";

export function ItemSheet({
  item,
  listType,
  onClose,
}: {
  item: Item;
  listType: ListType;
  onClose: () => void;
}) {
  const { snap, mutate } = useSync();
  const [text, setText] = useState(item.text);
  const [qty, setQty] = useState(item.qty ?? "");
  const members = snap.state?.members ?? [];

  function commitText() {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t || t === item.text) {
      setText(item.text);
      return;
    }
    mutate({ type: "item.update", id: item.id, patch: { text: t } });
  }

  function commitQty() {
    const v = qty.trim();
    if ((v || null) === (item.qty ?? null)) return;
    mutate({ type: "item.update", id: item.id, patch: { qty: v || null } });
  }

  function close() {
    commitText();
    commitQty();
    onClose();
  }

  return (
    <Sheet title="Edit item" onClose={close}>
      <div className="sheet-body">
        <label className="field">
          <span className="field-label">Item</span>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            maxLength={200}
          />
        </label>

        {listType === "grocery" && (
          <>
            <label className="field">
              <span className="field-label">Quantity</span>
              <input
                className="input"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onBlur={commitQty}
                placeholder="2, 1 kg, a bunch…"
                maxLength={40}
              />
            </label>
            <div className="field">
              <span className="field-label">Aisle</span>
              <div className="chips-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip chip-small ${item.category === c ? "chip-active" : ""}`}
                    onClick={() =>
                      mutate({
                        type: "item.update",
                        id: item.id,
                        patch: { category: item.category === c ? null : c },
                      })
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {listType === "todo" && members.length > 0 && (
          <div className="field">
            <span className="field-label">Assigned to</span>
            <div className="chips-wrap">
              <button
                type="button"
                className={`chip chip-small ${item.assignedTo == null ? "chip-active" : ""}`}
                onClick={() =>
                  mutate({
                    type: "item.update",
                    id: item.id,
                    patch: { assignedTo: null },
                  })
                }
              >
                Nobody
              </button>
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`chip chip-small ${item.assignedTo === m.id ? "chip-active" : ""}`}
                  onClick={() =>
                    mutate({
                      type: "item.update",
                      id: item.id,
                      patch: { assignedTo: m.id },
                    })
                  }
                >
                  <Avatar name={m.name} color={m.color} size={18} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <ConfirmButton
          label="Delete item"
          confirmLabel="Tap again to delete"
          onConfirm={() => {
            mutate({ type: "item.delete", id: item.id });
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}
