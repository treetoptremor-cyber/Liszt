"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Avatar, ConfirmButton } from "@/components/small";
import { useSync } from "@/components/SyncContext";
import {
  WEEKDAY_INITIALS,
  WEEKDAY_NAMES,
  addDays,
  dayOfWeek,
  describeMask,
  formatRelative,
  maskHasDay,
  toggleMaskDay,
  todayStr,
} from "@/lib/client/dates";
import type { List, Recurrence } from "@/lib/types";

const EVERY_DAY = 0b1111111;
const WEEKDAYS = 0b0111110; // Mon–Fri
const WEEKEND = 0b1000001; // Sat + Sun

/** Seven toggles, Sunday-first, mirroring the calendar's column order. */
export function WeekdayPicker({
  mask,
  onChange,
}: {
  mask: number;
  onChange: (mask: number) => void;
}) {
  return (
    <div className="dow-picker" role="group" aria-label="Repeat on">
      {WEEKDAY_INITIALS.map((letter, d) => {
        const on = maskHasDay(mask, d);
        return (
          <button
            key={d}
            type="button"
            className={`dow-btn ${on ? "dow-btn-on" : ""}`}
            aria-pressed={on}
            aria-label={WEEKDAY_NAMES[d]}
            onClick={() => onChange(toggleMaskDay(mask, d))}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

function RepeatPresets({
  mask,
  onChange,
}: {
  mask: number;
  onChange: (mask: number) => void;
}) {
  const presets: [string, number][] = [
    ["Every day", EVERY_DAY],
    ["Weekdays", WEEKDAYS],
    ["Weekends", WEEKEND],
  ];
  return (
    <div className="chips-wrap chips-wrap-gap">
      {presets.map(([label, value]) => (
        <button
          key={label}
          type="button"
          className={`chip chip-small ${mask === value ? "chip-active" : ""}`}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ListPicker({
  lists,
  listId,
  onChange,
}: {
  lists: List[];
  listId: string;
  onChange: (id: string) => void;
}) {
  if (lists.length < 2) return null;
  return (
    <div className="field">
      <span className="field-label">List</span>
      <div className="chips-wrap">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`chip chip-small ${l.id === listId ? "chip-active" : ""}`}
            onClick={() => onChange(l.id)}
          >
            {l.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssigneePicker({
  assignedTo,
  onChange,
}: {
  assignedTo: string | null;
  onChange: (id: string | null) => void;
}) {
  const { snap } = useSync();
  const members = snap.state?.members ?? [];
  if (members.length < 2) return null;
  return (
    <div className="field">
      <span className="field-label">Assigned to</span>
      <div className="chips-wrap">
        <button
          type="button"
          className={`chip chip-small ${assignedTo == null ? "chip-active" : ""}`}
          onClick={() => onChange(null)}
        >
          Nobody
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`chip chip-small ${assignedTo === m.id ? "chip-active" : ""}`}
            onClick={() => onChange(m.id)}
          >
            <Avatar name={m.name} color={m.color} size={18} />
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Create a to-do that lands on the calendar: either once on a date, or on
 *  chosen weekdays forever. `date` seeds both — the date field and, for a
 *  repeat, the weekday that's preselected. */
export function ScheduleSheet({
  date,
  lists,
  listId,
  onListChange,
  onBack,
  onClose,
}: {
  date: string;
  lists: List[];
  listId: string;
  onListChange: (id: string) => void;
  onBack?: () => void;
  onClose: () => void;
}) {
  const { mutate } = useSync();
  const [text, setText] = useState("");
  const [repeats, setRepeats] = useState(false);
  const [when, setWhen] = useState(date);
  const [mask, setMask] = useState(() => 1 << dayOfWeek(date));
  const [assignedTo, setAssignedTo] = useState<string | null>(null);

  const clean = text.replace(/\s+/g, " ").trim();
  const valid = Boolean(clean) && (repeats ? mask > 0 : Boolean(when));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    if (repeats) {
      mutate({
        type: "recur.add",
        id: crypto.randomUUID(),
        listId,
        text: clean,
        daysMask: mask,
        // Start where the user is looking, so a rule added today doesn't
        // retroactively populate every past week.
        startDate: date,
        assignedTo,
      });
    } else {
      mutate({
        type: "item.add",
        id: crypto.randomUUID(),
        listId,
        text: clean,
        dueDate: when,
        assignedTo,
      });
    }
    onClose();
  }

  return (
    <Sheet title="New to-do" onBack={onBack} onClose={onClose}>
      <form className="sheet-body" onSubmit={submit}>
        <label className="field">
          <span className="field-label">To-do</span>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Take the bins out…"
            maxLength={200}
            autoFocus
          />
        </label>

        <div className="seg" role="group" aria-label="How often">
          <button
            type="button"
            className={`seg-btn ${repeats ? "" : "seg-btn-on"}`}
            aria-pressed={!repeats}
            onClick={() => setRepeats(false)}
          >
            Once
          </button>
          <button
            type="button"
            className={`seg-btn ${repeats ? "seg-btn-on" : ""}`}
            aria-pressed={repeats}
            onClick={() => setRepeats(true)}
          >
            Repeats
          </button>
        </div>

        {repeats ? (
          <div className="field">
            <span className="field-label">Repeat on</span>
            <WeekdayPicker mask={mask} onChange={setMask} />
            <p className="field-hint">
              {mask > 0
                ? `${describeMask(mask)}, starting ${formatRelative(date)}`
                : "Pick at least one day."}
            </p>
            <RepeatPresets mask={mask} onChange={setMask} />
          </div>
        ) : (
          <div className="field">
            <span className="field-label">Date</span>
            <div className="chips-wrap chips-wrap-gap">
              {(
                [
                  ["Today", todayStr()],
                  ["Tomorrow", addDays(todayStr(), 1)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  className={`chip chip-small ${when === value ? "chip-active" : ""}`}
                  onClick={() => setWhen(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className="input"
              type="date"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="Date"
            />
          </div>
        )}

        <ListPicker lists={lists} listId={listId} onChange={onListChange} />
        <AssigneePicker assignedTo={assignedTo} onChange={setAssignedTo} />

        <button className="btn btn-primary" disabled={!valid}>
          Add
        </button>
      </form>
    </Sheet>
  );
}

/** Edit or delete a repeating rule. Changes apply to every day it lands on,
 *  past ticks included — this is the rule itself, not one occurrence. */
export function RecurrenceSheet({
  rule,
  lists,
  onBack,
  onClose,
}: {
  rule: Recurrence;
  lists: List[];
  onBack?: () => void;
  onClose: () => void;
}) {
  const { mutate } = useSync();
  const [text, setText] = useState(rule.text);
  const list = lists.find((l) => l.id === rule.listId);

  function commitText() {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t || t === rule.text) {
      setText(rule.text);
      return;
    }
    mutate({ type: "recur.update", id: rule.id, patch: { text: t } });
  }

  return (
    <Sheet title="Repeating to-do" onBack={onBack} onClose={onClose}>
      <div className="sheet-body">
        <label className="field">
          <span className="field-label">To-do</span>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            maxLength={200}
          />
        </label>

        <div className="field">
          <span className="field-label">Repeat on</span>
          <WeekdayPicker
            mask={rule.daysMask}
            onChange={(daysMask) => {
              // A rule with no days would vanish from the calendar with no way
              // back — deleting it is the way to stop it.
              if (daysMask === 0) return;
              mutate({ type: "recur.update", id: rule.id, patch: { daysMask } });
            }}
          />
          <p className="field-hint">
            {describeMask(rule.daysMask)}
            {list ? ` · in ${list.title}` : ""}
          </p>
        </div>

        <AssigneePicker
          assignedTo={rule.assignedTo}
          onChange={(assignedTo) =>
            mutate({ type: "recur.update", id: rule.id, patch: { assignedTo } })
          }
        />

        <ConfirmButton
          label="Delete repeating to-do"
          confirmLabel="Tap again to delete every day"
          onConfirm={() => {
            mutate({ type: "recur.delete", id: rule.id });
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}
