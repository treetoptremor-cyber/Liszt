"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { upsertSpaceEntry, type SpaceEntry } from "@/lib/client/storage";

interface Preview {
  name: string;
  code: string;
  memberCount: number;
}

export function JoinScreen({
  code,
  onJoined,
}: {
  code: string;
  onJoined: (entry: SpaceEntry) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">(
    "loading"
  );
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/spaces/${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setStatus("notfound");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        setPreview(await res.json());
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not join");
      const entry: SpaceEntry = {
        code: body.space.code,
        name: body.space.name,
        memberId: body.member.id,
        memberName: body.member.name,
        lastUsed: Date.now(),
      };
      upsertSpaceEntry(entry);
      onJoined(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <header className="landing-hero">
          <Wordmark className="wordmark-hero" />
        </header>

        {status === "loading" && <p className="landing-note">Looking up the space…</p>}

        {status === "notfound" && (
          <div className="card landing-card">
            <h2 className="section-title">Space not found</h2>
            <p className="landing-note">
              No space exists with the code <strong>{code}</strong>. Double-check
              the code with whoever shared it.
            </p>
            <Link className="btn btn-secondary" href="/?home=1">
              Back to start
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="card landing-card">
            <h2 className="section-title">Can&apos;t reach Liszt</h2>
            <p className="landing-note">
              Check your connection and try again.
            </p>
            <Link className="btn btn-secondary" href="/?home=1">
              Back to start
            </Link>
          </div>
        )}

        {status === "ready" && preview && (
          <form className="card landing-card" onSubmit={join}>
            <h2 className="section-title">Join “{preview.name}”</h2>
            <p className="landing-note">
              {preview.memberCount === 1
                ? "1 person is"
                : `${preview.memberCount} people are`}{" "}
              already here. Pick a name so everyone knows who added what.
            </p>
            <label className="field">
              <span className="field-label">Your name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                maxLength={40}
                autoFocus
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Joining…" : `Join ${preview.name}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
