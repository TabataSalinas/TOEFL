'use client';

import { useEffect, useRef, useState } from 'react';

/** Local countdown for a task/question. Calls onEnd once; flags "time almost up". */
export function StepClock({
  seconds,
  onEnd,
  alertAt = 10,
  label,
  running = true,
}: {
  seconds: number;
  onEnd: () => void;
  alertAt?: number;
  label?: string;
  running?: boolean;
}) {
  const [left, setLeft] = useState(seconds);
  const fired = useRef(false);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    fired.current = false;
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now() - (seconds - left) * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining <= 0 && !fired.current) {
        fired.current = true;
        endRef.current();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, running]);

  const mm = Math.floor(left / 60).toString().padStart(2, '0');
  const ss = (left % 60).toString().padStart(2, '0');
  const urgent = left <= alertAt;
  return (
    <div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      className={`rounded-xl px-3 py-1.5 font-mono text-base font-semibold ${
        urgent ? 'animate-pulse bg-red-500/15 text-red-500' : 'bg-black/5 dark:bg-white/10'
      }`}
    >
      {label && <span className="mr-2 text-xs font-sans font-medium opacity-70">{label}</span>}
      {mm}:{ss}
      {urgent && left > 0 && <span className="ml-2 text-xs font-sans">Time almost up</span>}
    </div>
  );
}
