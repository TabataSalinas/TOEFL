'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Server-authoritative countdown. `deadlineIso` is the absolute section
 * deadline from the API; the timer counts down to it and calls onExpire once.
 */
export function ExamTimer({
  deadlineIso,
  onExpire,
}: {
  deadlineIso: string;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000)),
  );
  const fired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(
        0,
        Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000),
      );
      setRemaining(r);
      if (r <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineIso, onExpire]);

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');
  const warning = remaining <= 60;
  const caution = remaining <= 300;

  return (
    <div
      className={`rounded-xl px-4 py-2 font-mono text-lg font-semibold ${
        warning
          ? 'animate-pulse bg-red-500/15 text-red-500'
          : caution
            ? 'bg-amber-500/15 text-amber-500'
            : 'bg-black/5 dark:bg-white/10'
      }`}
      aria-live="polite"
    >
      ⏱ {mm}:{ss}
    </div>
  );
}
