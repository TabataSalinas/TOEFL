'use client';

import { Passage, Question } from '@/lib/types';

const TOKEN = /\{\{(\d+)\|([^|]*)\|(\d+)\}\}/g;

/** "Complete the Words": the paragraph with inline boxes for the missing letters. */
export function CompleteWords({
  passage,
  questions,
  answers,
  onChange,
}: {
  passage: Passage;
  questions: Question[];
  answers: Record<string, unknown>;
  onChange: (qid: string, value: string) => void;
}) {
  const byN = new Map(questions.map((q) => [Number(q.meta?.n), q]));
  const body = passage.body ?? '';
  const parts: Array<string | { n: number; prefix: string; len: number }> = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    parts.push(body.slice(last, m.index));
    parts.push({ n: Number(m[1]), prefix: m[2], len: Number(m[3]) });
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(body.slice(last));

  return (
    <p className="text-[15px] leading-10">
      {parts.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>;
        const q = byN.get(p.n);
        const value = q ? String(answers[q.id] ?? '') : '';
        return (
          <span key={i} className="whitespace-nowrap">
            <span className="font-semibold">{p.prefix}</span>
            <input
              aria-label={`Blank ${p.n}: missing ${p.len} letters after "${p.prefix}"`}
              className="mx-0.5 inline-block rounded border-b-2 bg-black/5 px-1 text-center font-mono outline-none focus:border-brand-500 dark:bg-white/10"
              style={{ width: `${Math.max(2.2, p.len * 0.95 + 1)}ch`, borderColor: 'rgb(var(--border))' }}
              maxLength={p.len + 2}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={value}
              onChange={(e) => q && onChange(q.id, e.target.value.replace(/[^A-Za-z]/g, ''))}
            />
          </span>
        );
      })}
    </p>
  );
}
