"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { Avatar, PersonDot } from "@/components/small";
import { useSync } from "@/components/SyncContext";
import { formatLong, formatRelative, todayStr } from "@/lib/client/dates";
import { entriesForDay, toggleEntryOp, type DayEntry } from "@/lib/client/schedule";
import type { List } from "@/lib/types";

/** Everything on one day, with a quick-add that lands on that same day. */
export function DaySheet({
  date,
  lists,
  listId,
  onOpenItem,
  onOpenRule,
  onNew,
  onClose,
}: {
  date: string;
  lists: List[];
  /** Where a quick-add goes when the space has more than one to-do list. */
  listId: string;
  onOpenItem: (itemId: string) => void;
  onOpenRule: (ruleId: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const { snap, mutate, memberById } = useSync();
  const state = snap.state;
  const [text, setText] = useState("");
  const today = todayStr();

  const entries = useMemo(
    () => (state ? entriesForDay(state, date, today) : []),
    [state, date, today]
  );

  const listTitle = useMemo(() => {
    const map = new Map(lists.map((l) => [l.id, l.title]));
    return (id: string) => map.get(id) ?? "";
  }, [lists]);

  const showList = lists.length > 1;
  const showAttribution = (state?.members.length ?? 0) > 1;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.replace(/\s+/g, " ").trim();
    if (!t || !listId) return;
    mutate({
      type: "item.add",
      id: crypto.randomUUID(),
      listId,
      text: t,
      dueDate: date,
    });
    setText("");
  }

  const relative = formatRelative(date, today);
  const heading = formatLong(date);

  return (
    <Sheet title={heading} onClose={onClose}>
      <div className="sheet-body">
        {relative !== heading && (
          <p className="day-sub">
            {relative}
            {date < today && " · past"}
          </p>
        )}

        {entries.length === 0 ? (
          <p className="day-empty">Nothing scheduled.</p>
        ) : (
          <div className="card list-card">
            {entries.map((entry) => (
              <DayRow
                key={entry.key}
                entry={entry}
                listLabel={showList ? listTitle(entry.listId) : ""}
                showAttribution={showAttribution}
                assignee={memberById(entry.assignedTo)}
                creditMember={memberById(entry.completedBy)}
                onToggle={() => mutate(toggleEntryOp(entry))}
                onDetails={() =>
                  entry.kind === "recur"
                    ? onOpenRule(entry.id)
                    : onOpenItem(entry.id)
                }
              />
            ))}
          </div>
        )}

        <form className="sheet-add" onSubmit={add}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Add to ${relative.toLowerCase()}…`}
            maxLength={200}
            enterKeyHint="done"
            autoComplete="off"
          />
          <button
            className="addbar-btn"
            aria-label="Add to this day"
            disabled={!text.trim() || !listId}
          >
            <Icon name="plus" size={22} />
          </button>
        </form>

        <button className="btn btn-secondary" onClick={onNew}>
          <Icon name="repeat" size={18} />
          Add a repeating to-do
        </button>
      </div>
    </Sheet>
  );
}

function DayRow({
  entry,
  listLabel,
  showAttribution,
  assignee,
  creditMember,
  onToggle,
  onDetails,
}: {
  entry: DayEntry;
  listLabel: string;
  showAttribution: boolean;
  assignee: ReturnType<ReturnType<typeof useSync>["memberById"]>;
  creditMember: ReturnType<ReturnType<typeof useSync>["memberById"]>;
  onToggle: () => void;
  onDetails: () => void;
}) {
  return (
    <div
      className={`item-row ${entry.done ? "item-done" : ""} ${
        entry.overdue ? "item-overdue" : ""
      }`}
    >
      <button
        className={`checkbox ${entry.done ? "checkbox-checked" : ""}`}
        onClick={onToggle}
        aria-label={
          entry.done ? `Uncheck ${entry.text}` : `Check off ${entry.text}`
        }
      >
        {entry.done && <Icon name="check" size={14} />}
      </button>
      <button className="item-main" onClick={onToggle}>
        <span className="item-text">{entry.text}</span>
        {entry.kind === "recur" && (
          <span className="repeat-mark" title="Repeats weekly">
            <Icon name="repeat" size={13} />
          </span>
        )}
        {listLabel && <span className="list-tag">{listLabel}</span>}
        {assignee && (
          <Avatar name={assignee.name} color={assignee.color} size={20} />
        )}
      </button>
      {showAttribution && entry.done && creditMember && (
        <PersonDot
          member={creditMember}
          label={`Done by ${creditMember.name}`}
        />
      )}
      <button
        className="icon-btn item-more"
        onClick={onDetails}
        aria-label={
          entry.kind === "recur"
            ? `Edit repeating to-do ${entry.text}`
            : `Edit ${entry.text}`
        }
      >
        <Icon name="dots" size={18} />
      </button>
    </div>
  );
}
