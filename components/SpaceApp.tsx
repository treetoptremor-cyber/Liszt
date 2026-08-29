"use client";

import { useEffect, useState } from "react";
import { normalizeCode } from "@/lib/codes";
import { getSpaceEntry, type SpaceEntry } from "@/lib/client/storage";
import { JoinScreen } from "@/components/JoinScreen";
import { MainApp } from "@/components/MainApp";

export function SpaceApp({ code: rawCode }: { code: string }) {
  const code = normalizeCode(rawCode);
  const [entry, setEntry] = useState<SpaceEntry | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setEntry(getSpaceEntry(code));
    setChecked(true);
  }, [code]);

  if (!checked) return null;

  if (!entry) {
    return <JoinScreen code={code} onJoined={setEntry} />;
  }

  return <MainApp code={code} entry={entry} />;
}
