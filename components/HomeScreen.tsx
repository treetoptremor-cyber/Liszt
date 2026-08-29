"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { Icon } from "@/components/Icons";
import { normalizeCode } from "@/lib/codes";
import {
  getRegistry,
  removeSpaceEntry,
  upsertSpaceEntry,
  type SpaceEntry,
} from "@/lib/client/storage";

type Mode = "menu" | "create" | "join";

export function HomeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stay = searchParams.get("home") === "1";

  const [ready, setReady] = useState(false);
  const [spaces, setSpaces] = useState<SpaceEntry[]>([]);
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spaceName, setSpaceName] = useState("");
  const [yourName, setYourName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    const reg = getRegistry().sort((a, b) => b.lastUsed - a.lastUsed);
    if (reg.length > 0 && !stay) {
      router.replace(`/s/${encodeURIComponent(reg[0].code)}`);
      return;
    }
    setSpaces(reg);
    setReady(true);
  }, [router, stay]);

  if (!ready) return null;

  async function createSpace(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaceName: spaceName.trim(),
          memberName: yourName.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create the space");
      upsertSpaceEntry({
        code: body.space.code,
        name: body.space.name,
        memberId: body.member.id,
        memberName: body.member.name,
      });
      router.push(`/s/${encodeURIComponent(body.space.code)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  function goToJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(joinCode);
    if (!code) return;
    router.push(`/s/${encodeURIComponent(code)}`);
  }

  function forget(code: string) {
    removeSpaceEntry(code);
    setSpaces(getRegistry().sort((a, b) => b.lastUsed - a.lastUsed));
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <header className="landing-hero">
          <Wordmark className="wordmark-hero" />
          <p className="landing-tagline">
            One shared place for groceries, to-dos and ideas — for your
            household.
          </p>
        </header>

        {spaces.length > 0 && (
          <section className="card landing-card">
            <h2 className="section-title">Your spaces</h2>
            {spaces.map((s) => (
              <div key={s.code} className="space-row">
                <button
                  className="space-row-main"
                  onClick={() => router.push(`/s/${encodeURIComponent(s.code)}`)}
                >
                  <span className="space-row-name">{s.name}</span>
                  <span className="space-row-code">{s.code}</span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Forget ${s.name} on this device`}
                  onClick={() => forget(s.code)}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            ))}
          </section>
        )}

        {mode === "menu" && (
          <div className="landing-actions">
            <button className="btn btn-primary" onClick={() => setMode("create")}>
              Start a family space
            </button>
            <button className="btn btn-secondary" onClick={() => setMode("join")}>
              I have a code
            </button>
          </div>
        )}

        {mode === "create" && (
          <form className="card landing-card" onSubmit={createSpace}>
            <h2 className="section-title">Start a family space</h2>
            <label className="field">
              <span className="field-label">Space name</span>
              <input
                className="input"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                placeholder="The Smiths, Casa Verde…"
                maxLength={60}
                autoFocus
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Your name</span>
              <input
                className="input"
                value={yourName}
                onChange={(e) => setYourName(e.target.value)}
                placeholder="Alex"
                maxLength={40}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode("menu")}
              >
                Back
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Creating…" : "Create space"}
              </button>
            </div>
          </form>
        )}

        {mode === "join" && (
          <form className="card landing-card" onSubmit={goToJoin}>
            <h2 className="section-title">Join with a code</h2>
            <label className="field">
              <span className="field-label">Share code</span>
              <input
                className="input input-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="PLUM-FOX-42"
                autoFocus
                required
              />
            </label>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode("menu")}
              >
                Back
              </button>
              <button className="btn btn-primary">Continue</button>
            </div>
          </form>
        )}

        <footer className="landing-foot">
          Free to use · No accounts · Works offline as an app
        </footer>
      </div>
    </div>
  );
}
