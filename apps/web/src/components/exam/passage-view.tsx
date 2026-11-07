'use client';

import { Passage } from '@/lib/types';

/** Renders a reading stimulus: email, notice/flyer, or academic passage (with highlighted word). */
export function PassageView({ passage, highlight }: { passage: Passage; highlight?: string }) {
  const body = passage.body ?? '';
  const meta = passage.meta ?? {};

  if (passage.kind === 'daily_life' && meta.format === 'email') {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
        <dl className="mb-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
          {(['to', 'from', 'date', 'subject'] as const).map((k) =>
            meta[k] ? (
              <div key={k} className="contents">
                <dt className="font-semibold capitalize">{k}:</dt>
                <dd className="truncate">{String(meta[k])}</dd>
              </div>
            ) : null,
          )}
        </dl>
        <div className="whitespace-pre-wrap border-t pt-3 leading-relaxed" style={{ borderColor: 'rgb(var(--border))' }}>
          {body}
        </div>
      </div>
    );
  }

  if (passage.kind === 'daily_life') {
    return (
      <div className="rounded-xl border-2 border-dashed p-4 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="whitespace-pre-wrap leading-relaxed">{body}</div>
      </div>
    );
  }

  const paragraphs = body.split(/\n\s*\n/);
  let highlighted = false;
  const mark = (text: string) => {
    if (!highlight || highlighted) return text;
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return text;
    highlighted = true;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded bg-yellow-300/70 px-0.5 text-black">{text.slice(idx, idx + highlight.length)}</mark>
        {text.slice(idx + highlight.length)}
      </>
    );
  };
  return (
    <article className="space-y-3 text-[15px] leading-relaxed">
      {passage.title && <h2 className="text-base font-semibold">{passage.title}</h2>}
      {paragraphs.map((p, i) => (
        <p key={i}>
          <span className="mr-1 select-none text-xs font-semibold opacity-50">{paragraphs.length > 1 ? `(${i + 1})` : ''}</span>
          {mark(p)}
        </p>
      ))}
    </article>
  );
}
