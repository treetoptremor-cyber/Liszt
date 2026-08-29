"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { ConfirmButton } from "@/components/small";
import { useSync } from "@/components/SyncContext";
import { timeAgo } from "@/lib/client/time";
import type { Note } from "@/lib/types";

export function NotesView() {
  const { snap, mutate } = useSync();
  const [openId, setOpenId] = useState<string | null>(null);

  const notes = useMemo(
    () =>
      [...(snap.state?.notes ?? [])].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [snap.state]
  );

  const openNote = notes.find((n) => n.id === openId) ?? null;

  function newNote() {
    const id = crypto.randomUUID();
    mutate({ type: "note.add", id });
    setOpenId(id);
  }

  return (
    <div className="view">
      {notes.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No notes yet</p>
          <p className="empty-sub">
            Gift ideas, recipes to try, places to go — jot anything down and
            everyone sees it.
          </p>
          <button className="btn btn-primary" onClick={newNote}>
            Write a note
          </button>
        </div>
      ) : (
        <div className="note-grid">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onOpen={() => setOpenId(n.id)} />
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <button className="fab" aria-label="New note" onClick={newNote}>
          <Icon name="plus" size={24} />
        </button>
      )}

      {openNote && (
        <NoteEditor note={openNote} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const { memberById } = useSync();
  const editor = memberById(note.updatedBy);
  const untitled = !note.title.trim();
  return (
    <button className="note-card card" onClick={onOpen}>
      <span className={`note-title ${untitled ? "note-title-untitled" : ""}`}>
        {untitled ? "Untitled" : note.title}
      </span>
      {note.body.trim() && <span className="note-preview">{note.body}</span>}
      <span className="note-meta">
        {editor ? `${editor.name} · ` : ""}
        {timeAgo(note.updatedAt)}
      </span>
    </button>
  );
}

function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const { mutate, memberById } = useSync();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const noteId = note.id;

  // Debounced autosave of whatever the user typed.
  const dirty = useRef<{ title?: string; body?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useRef(() => {});
  flush.current = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const patch = dirty.current;
    dirty.current = {};
    if (patch.title !== undefined || patch.body !== undefined) {
      mutate({ type: "note.update", id: noteId, patch });
    }
  };

  function scheduleSave(patch: { title?: string; body?: string }) {
    dirty.current = { ...dirty.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush.current(), 600);
  }

  useEffect(() => () => flush.current(), []);

  // If the app is backgrounded or the page is being torn down, save the draft
  // immediately — mutate() persists to the offline queue synchronously, so the
  // text survives even if the tab is killed before the network call finishes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush.current();
    };
    const onPageHide = () => flush.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  const editor = memberById(note.updatedBy);

  return (
    <div className="note-editor">
      <div className="note-editor-head">
        <button
          className="icon-btn"
          aria-label="Back to notes"
          onClick={() => {
            flush.current();
            onClose();
          }}
        >
          <Icon name="chevron-left" size={22} />
        </button>
        <span className="note-editor-meta">
          {editor ? `${editor.name} · ` : ""}
          {timeAgo(note.updatedAt)}
        </span>
        <ConfirmButton
          label="Delete"
          confirmLabel="Really delete?"
          className="link-btn link-danger"
          onConfirm={() => {
            dirty.current = {};
            if (timer.current) clearTimeout(timer.current);
            mutate({ type: "note.delete", id: noteId });
            onClose();
          }}
        />
      </div>
      <input
        className="note-editor-title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave({ title: e.target.value });
        }}
        placeholder="Title"
        maxLength={200}
        autoFocus={!note.title && !note.body}
      />
      <textarea
        className="note-editor-body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          scheduleSave({ body: e.target.value });
        }}
        placeholder="Write something…"
        maxLength={20000}
      />
    </div>
  );
}
