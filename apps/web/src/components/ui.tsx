'use client';

import { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card>
      <div className="text-sm muted">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-sm muted">{sub}</div>}
    </Card>
  );
}

export function Progress({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full"
      style={{ background: 'rgb(var(--border))' }}
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const tones: Record<string, string> = {
    default: 'bg-black/5 dark:bg-white/10',
    good: 'bg-green-500/15 text-green-600 dark:text-green-400',
    warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    bad: 'bg-red-500/15 text-red-600 dark:text-red-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 muted">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  );
}
