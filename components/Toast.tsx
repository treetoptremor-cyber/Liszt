"use client";

import { useEffect, useRef, useState } from "react";

export function Toast({
  message,
  onDone,
}: {
  message: string | null;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);
  // Keep the callback in a ref so timer lifetime is keyed on the message
  // alone — re-renders must not restart the dismiss countdown.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), 3200);
    const done = setTimeout(() => onDoneRef.current(), 3600);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [message]);

  if (!message) return null;
  return (
    <div className={`toast ${visible ? "toast-visible" : ""}`} role="status">
      {message}
    </div>
  );
}
