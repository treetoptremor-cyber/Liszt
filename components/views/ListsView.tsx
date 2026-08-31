"use client";

import { useMemo, useState } from "react";
import { AddBar } from "@/components/AddBar";
import { Icon } from "@/components/Icons";
import { ItemSheet } from "@/components/ItemSheet";
import { Sheet } from "@/components/Sheet";
import { Avatar, ConfirmButton, PersonDot, TextSheet } from "@/components/small";
import { useSync } from "@/components/SyncContext";
import { CATEGORIES, guessCategory } from "@/lib/categories";
import { formatRelative, todayStr } from "@/lib/client/dates";
import { readPlainKey, writePlainKey } from "@/lib/client/storage";
import type { Item, ListType, Member } from "@/lib/types";

type SheetKind = "menu" | "new-list" | "rename-list" | null;

export function ListsView({
  listType,
  code,
}: {
  listType: ListType;
  code: string;
}) {
  const { snap, mutate, memberById } = useSync();
  const state = snap.state;
  const lists = useMemo(
    () => (state?.lists ?? []).filter((l) => l.type === listType),
    [state, listType]
  );

  const storageKey = `liszt:activelist:${code}:${listType}`;
  const [chosenId, setChosenId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readPlainKey(storageKey)
  );
  const active =
    lists.find((l) => l.id === chosenId) ?? (lists.length > 0 ? lists[0] : null);

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(false);

  const members = state?.members ?? [];
  const showAttribution = members.length > 1;

  const unchecked = useMemo(
    () => (active ? active.items.filter((i) => !i.done) : []),
    [active]
  );
  const done = useMemo(
    () =>
      active
        ? active.items
            .filter((i) => i.done)
            .sort(
              (a, b) =>
                new Date(b.doneAt ?? b.createdAt).getTime() -
                new Date(a.doneAt ?? a.createdAt).getTime()
            )
        : [],
    [active]
  );

  /** Category groups (grocery only, when enabled and anything is categorized). */
  const groups = useMemo(() => {
    if (listType !== "grocery" || !active?.groupByCategory) return null;
    if (!unchecked.some((i) => i.category)) return null;
    const byCat = new Map<string, Item[]>();
    for (const item of unchecked) {
      const key = item.category ?? "Other";
      const arr = byCat.get(key) ?? [];
      arr.push(item);
      byCat.set(key, arr);
    }
    const ordered: { category: string; items: Item[] }[] = [];
    for (const c of CATEGORIES) {
      const items = byCat.get(c);
      if (items) {
        ordered.push({ category: c, items });
        byCat.delete(c);
      }
    }
    // Any category we don't know about goes at the end.
    for (const [category, items] of byCat) ordered.push({ category, items });
    return ordered;
  }, [listType, active, unchecked]);

  const existingTexts = useMemo(
    () => new Set(unchecked.map((i) => i.text.toLowerCase())),
    [unchecked]
  );

  const openItem = active?.items.find((i) => i.id === openItemId) ?? null;

  function selectList(id: string) {
    setChosenId(id);
    writePlainKey(storageKey, id);
  }

  function addList(title: string) {
    const id = crypto.randomUUID();
    mutate({ type: "list.add", id, listType, title });
    selectList(id);
  }

  function addItem(text: string, category: string | null) {
    if (!active) return;
    const lower = text.toLowerCase();
    const existing = active.items.find((i) => i.text.toLowerCase() === lower);
    if (existing) {
      // Already listed: if it's checked off, bring it back instead of duplicating.
      if (existing.done) {
        mutate({ type: "item.update", id: existing.id, patch: { done: false } });
      }
      return;
    }
    mutate({
      type: "item.add",
      id: crypto.randomUUID(),
      listId: active.id,
      text,
      qty: null,
      category:
        listType === "grocery" ? (category ?? guessCategory(text)) : null,
    });
  }

  function toggle(item: Item) {
    mutate({ type: "item.update", id: item.id, patch: { done: !item.done } });
  }

  const doneLabel = listType === "grocery" ? "In cart" : "Done";

  return (
    <div className="view">
      <div className="chips-row">
        <div className="chips-scroll">
          {lists.map((l) => (
            <button
              key={l.id}
              className={`chip ${active?.id === l.id ? "chip-active" : ""}`}
              onClick={() => selectList(l.id)}
            >
              {l.title}
              {l.items.filter((i) => !i.done).length > 0 && (
                <span className="chip-count">
                  {l.items.filter((i) => !i.done).length}
                </span>
              )}
            </button>
          ))}
          <button
            className="chip chip-ghost"
            aria-label="New list"
            onClick={() => setSheet("new-list")}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        {active && (
          <button
            className="icon-btn"
            aria-label="List options"
            onClick={() => setSheet("menu")}
          >
            <Icon name="dots" size={20} />
          </button>
        )}
      </div>

      {!active ? (
        <div className="empty">
          <p className="empty-title">No lists yet</p>
          <p className="empty-sub">Create one to get going.</p>
          <button className="btn btn-primary" onClick={() => setSheet("new-list")}>
            New list
          </button>
        </div>
      ) : unchecked.length === 0 && done.length === 0 ? (
        <div className="empty">
          <p className="empty-title">
            {listType === "grocery" ? "Nothing to buy" : "All clear"}
          </p>
          <p className="empty-sub">
            {listType === "grocery"
              ? "Add your first item below — everyone in the family sees it instantly."
              : "Add a shared to-do below."}
          </p>
        </div>
      ) : (
        <>
          {unchecked.length > 0 && (
            <div className="card list-card">
              {groups
                ? groups.map((g) => (
                    <div key={g.category}>
                      <div className="group-header">{g.category}</div>
                      {g.items.map((item) => (
                        <Row
                          key={item.id}
                          item={item}
                          listType={listType}
                          memberById={memberById}
                          showAttribution={showAttribution}
                          onToggle={() => toggle(item)}
                          onDetails={() => setOpenItemId(item.id)}
                        />
                      ))}
                    </div>
                  ))
                : unchecked.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      listType={listType}
                      memberById={memberById}
                      showAttribution={showAttribution}
                      onToggle={() => toggle(item)}
                      onDetails={() => setOpenItemId(item.id)}
                    />
                  ))}
            </div>
          )}

          {done.length > 0 && (
            <section className="done-section">
              <div className="done-header">
                <button
                  className="done-toggle"
                  onClick={() => setDoneCollapsed((c) => !c)}
                  aria-expanded={!doneCollapsed}
                >
                  <span
                    className={`done-chevron ${doneCollapsed ? "done-chevron-closed" : ""}`}
                  >
                    <Icon name="chevron-down" size={16} />
                  </span>
                  {doneLabel} · {done.length}
                </button>
                <ConfirmButton
                  label="Clear"
                  confirmLabel="Really clear?"
                  className="link-btn"
                  onConfirm={() =>
                    mutate({ type: "items.clearDone", listId: active.id })
                  }
                />
              </div>
              {!doneCollapsed && (
                <div className="card list-card list-card-done">
                  {done.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      listType={listType}
                      memberById={memberById}
                      showAttribution={showAttribution}
                      onToggle={() => toggle(item)}
                      onDetails={() => setOpenItemId(item.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {active && (
        <AddBar
          placeholder={
            listType === "grocery" ? "Add an item…" : "Add a to-do…"
          }
          frequent={listType === "grocery" ? (state?.frequent ?? []) : []}
          existingTexts={existingTexts}
          onAdd={addItem}
        />
      )}

      {sheet === "new-list" && (
        <TextSheet
          title={listType === "grocery" ? "New grocery list" : "New to-do list"}
          label="List name"
          placeholder={listType === "grocery" ? "Costco run, Weekly…" : "Chores, Trip prep…"}
          saveLabel="Create"
          onSave={addList}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "rename-list" && active && (
        <TextSheet
          title="Rename list"
          label="List name"
          initial={active.title}
          onSave={(title) =>
            mutate({ type: "list.rename", id: active.id, title })
          }
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "menu" && active && (
        <Sheet title={active.title} onClose={() => setSheet(null)}>
          <div className="sheet-body">
            <button
              className="btn btn-secondary"
              onClick={() => setSheet("rename-list")}
            >
              Rename list
            </button>
            {listType === "grocery" && (
              <button
                className="switch-row"
                role="switch"
                aria-checked={active.groupByCategory}
                onClick={() =>
                  mutate({
                    type: "list.setGroup",
                    id: active.id,
                    groupByCategory: !active.groupByCategory,
                  })
                }
              >
                <span>
                  Group by aisle
                  <span className="switch-hint">
                    Sorts items into produce, dairy, pantry…
                  </span>
                </span>
                <span
                  className={`switch ${active.groupByCategory ? "switch-on" : ""}`}
                />
              </button>
            )}
            {done.length > 0 && (
              <ConfirmButton
                label={`Clear checked (${done.length})`}
                confirmLabel="Tap again to clear"
                className="btn btn-secondary"
                onConfirm={() => {
                  mutate({ type: "items.clearDone", listId: active.id });
                  setSheet(null);
                }}
              />
            )}
            <ConfirmButton
              label="Delete list"
              confirmLabel="Tap again to delete list"
              onConfirm={() => {
                mutate({ type: "list.delete", id: active.id });
                setSheet(null);
              }}
            />
          </div>
        </Sheet>
      )}

      {openItem && (
        <ItemSheet
          item={openItem}
          listType={listType}
          onClose={() => setOpenItemId(null)}
        />
      )}
    </div>
  );
}

function Row({
  item,
  listType,
  memberById,
  showAttribution,
  onToggle,
  onDetails,
}: {
  item: Item;
  listType: ListType;
  memberById: (id: string | null) => Member | null;
  showAttribution: boolean;
  onToggle: () => void;
  onDetails: () => void;
}) {
  const assignee = listType === "todo" ? memberById(item.assignedTo) : null;
  // Active items credit whoever added them; completed items credit whoever
  // checked them off.
  const person = showAttribution
    ? item.done
      ? memberById(item.completedBy)
      : memberById(item.createdBy)
    : null;
  const personLabel = item.done ? "Done by" : "Added by";

  return (
    <div className={`item-row ${item.done ? "item-done" : ""}`}>
      <button
        className={`checkbox ${item.done ? "checkbox-checked" : ""}`}
        onClick={onToggle}
        aria-label={item.done ? `Uncheck ${item.text}` : `Check off ${item.text}`}
      >
        {item.done && <Icon name="check" size={14} />}
      </button>
      <button className="item-main" onClick={onToggle}>
        <span className="item-text">{item.text}</span>
        {item.qty && <span className="item-qty">{item.qty}</span>}
        {item.dueDate && (
          <span
            className={`due-tag ${
              !item.done && item.dueDate < todayStr() ? "due-tag-overdue" : ""
            }`}
          >
            {formatRelative(item.dueDate)}
          </span>
        )}
        {assignee && (
          <Avatar name={assignee.name} color={assignee.color} size={20} />
        )}
      </button>
      {person && (
        <PersonDot member={person} label={`${personLabel} ${person.name}`} />
      )}
      <button
        className="icon-btn item-more"
        onClick={onDetails}
        aria-label={`Edit ${item.text}`}
      >
        <Icon name="dots" size={18} />
      </button>
    </div>
  );
}
