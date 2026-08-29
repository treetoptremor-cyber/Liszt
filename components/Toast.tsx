"use client";

import { useEffect, useState } from "react";

export function Toast({
  message,
  onDone,
}: {
  message: string | null;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), 3200);
    const done = setTimeout(onDone, 3600);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className={`toast ${visible ? "toast-visible" : ""}`} role="status">
      {message}
    </div>
  );
}
