'use client';

import { Question } from '@/lib/types';

type LayoutPart = { fixed: string } | { slot: true };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One "Build a Sentence" item. The learner taps chunks to fill the empty slots in order;
 * tapping a filled slot returns the chunk to the bank. The response is the list of chunks
 * placed in each slot ('' while empty).
 */
export function BuildSentenceItem({
  question,
  index,
  value,
  onChange,
  disabled,
}: {
  question: Question;
  index: number;
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const chunks: string[] = question.meta?.chunks ?? [];
  const layout: LayoutPart[] = question.meta?.layout ?? [];
  const end: string = question.meta?.end ?? '.';
  const slotCount = layout.filter((p) => 'slot' in p).length;
  const placed = Array.from({ length: slotCount }, (_, i) => value?.[i] ?? '');

  // Chunks still available (handles duplicate words by counting).
  const remaining = [...chunks];
  for (const p of placed) {
    const k = remaining.indexOf(p);
    if (p && k !== -1) remaining.splice(k, 1);
  }

  const place = (chunk: string) => {
    if (disabled) return;
    const first = placed.findIndex((p) => !p);
    if (first === -1) return;
    const next = [...placed];
    next[first] = chunk;
    onChange(next);
  };
  const remove = (slot: number) => {
    if (disabled || !placed[slot]) return;
    const next = [...placed];
    next[slot] = '';
    onChange(next);
  };

  let slotNo = -1;
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
      <p className="mb-3 text-sm">
        <span className="mr-2 font-semibold">{index}.</span>
        <span className="rounded-lg bg-black/5 px-2 py-1 dark:bg-white/10">{question.prompt}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2" aria-label="Sentence being built">
        {layout.map((part, i) => {
          if ('fixed' in part) return <span key={i} className="px-1 font-medium">{part.fixed}</span>;
          slotNo += 1;
          const s = slotNo;
          const word = placed[s];
          return (
            <button
              key={i}
              type="button"
              onClick={() => remove(s)}
              aria-label={word ? `Slot ${s + 1}: ${word}. Press to remove` : `Empty slot ${s + 1}`}
              className={`min-w-16 rounded-lg border-b-2 px-3 py-1.5 text-sm ${word ? 'bg-brand-500/10 font-medium' : 'text-transparent'}`}
              style={{ borderColor: word ? 'rgb(59 99 246)' : 'rgb(var(--border))' }}
            >
              {word ? (i === 0 ? cap(word) : word) : '____'}
            </button>
          );
        })}
        <span className="font-medium">{end}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Available words">
        {remaining.map((c, i) => (
          <button key={`${c}-${i}`} type="button" disabled={disabled} onClick={() => place(c)} className="btn-ghost px-3 py-1 text-sm">
            {c}
          </button>
        ))}
        {remaining.length === 0 && <span className="text-xs muted">All words placed — tap a word in the sentence to change it.</span>}
      </div>
    </div>
  );
}
