"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { Avatar, ConfirmButton, TextSheet } from "@/components/small";
import { useSync } from "@/components/SyncContext";
import { removeSpaceEntry } from "@/lib/client/storage";

type SheetKind = "rename-space" | "rename-self" | null;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function FamilyView({ code }: { code: string }) {
  const { snap, memberId, mutate } = useSync();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null
  );
  const [standalone, setStandalone] = useState(true);
  const [isIOS, setIsIOS] = useState(false);

  const state = snap.state;
  const me = state?.members.find((m) => m.id === memberId) ?? null;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/s/${encodeURIComponent(code)}`;

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari exposes standalone directly on navigator.
        Boolean((navigator as unknown as { standalone?: boolean }).standalone)
    );
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  async function share() {
    const text = `Join "${state?.space.name ?? "our space"}" on Liszt — our shared grocery & to-do lists. Open ${shareUrl} and pick your name, or enter code ${code}.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join us on Liszt", text, url: shareUrl });
        return;
      } catch (err) {
        // User cancelled: done. Any other failure: fall through to copy.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copy(text, "link");
  }

  if (!state || !me) return null;

  return (
    <div className="view view-family">
      <section className="card family-card invite-card">
        <h2 className="section-title">Invite your people</h2>
        <p className="family-note">
          Anyone with this code can join — no account needed.
        </p>
        <div className="invite-code">{code}</div>
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={() => copy(code, "code")}>
            <Icon name="copy" size={17} />
            {copied === "code" ? "Copied!" : "Copy code"}
          </button>
          <button className="btn btn-primary" onClick={share}>
            <Icon name="share" size={17} />
            {copied === "link" ? "Copied link!" : "Share link"}
          </button>
        </div>
      </section>

      <section className="card family-card">
        <h2 className="section-title">Members</h2>
        {state.members.map((m) => (
          <div key={m.id} className="member-row">
            <Avatar name={m.name} color={m.color} size={30} />
            <span className="member-name">
              {m.name}
              {m.id === memberId && <span className="member-you"> · you</span>}
            </span>
            {m.id === memberId && (
              <button
                className="link-btn"
                onClick={() => setSheet("rename-self")}
              >
                Rename
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="card family-card">
        <h2 className="section-title">Space</h2>
        <div className="member-row">
          <span className="member-name">{state.space.name}</span>
          <button className="link-btn" onClick={() => setSheet("rename-space")}>
            Rename
          </button>
        </div>
      </section>

      {!standalone && (
        <section className="card family-card">
          <h2 className="section-title">Get the app feel</h2>
          {installEvent ? (
            <>
              <p className="family-note">
                Install Liszt for a full-screen app with its own icon.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => void installEvent.prompt()}
              >
                Install app
              </button>
            </>
          ) : isIOS ? (
            <p className="family-note">
              On iPhone: tap the share button in Safari, then{" "}
              <strong>Add to Home Screen</strong>. Liszt becomes a full-screen
              app.
            </p>
          ) : (
            <p className="family-note">
              In your browser&rsquo;s menu, choose <strong>Install app</strong>{" "}
              (or &ldquo;Add to Home screen&rdquo;) to use Liszt full-screen.
            </p>
          )}
        </section>
      )}

      <section className="family-leave">
        <a className="btn btn-secondary btn-block" href="/?home=1">
          Switch space · start another
        </a>
        <ConfirmButton
          label="Leave this space on this device"
          confirmLabel="Tap again to leave"
          className="btn btn-danger btn-block"
          onConfirm={() => {
            removeSpaceEntry(code);
            window.location.href = "/?home=1";
          }}
        />
        <p className="family-note family-note-center">
          Your lists stay put — rejoin any time with the code.
        </p>
      </section>

      {sheet === "rename-space" && (
        <TextSheet
          title="Rename space"
          label="Space name"
          initial={state.space.name}
          onSave={(name) => mutate({ type: "space.rename", name })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "rename-self" && (
        <TextSheet
          title="Your name"
          label="Name"
          initial={me.name}
          onSave={(name) => mutate({ type: "member.rename", name })}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
