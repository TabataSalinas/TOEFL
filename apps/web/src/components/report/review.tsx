'use client';

import { Badge } from '@/components/ui';
import { Meta } from '@/lib/types';

const show = (v: unknown): string => (v == null || v === '' ? '—' : Array.isArray(v) ? v.join(' ') : String(v));

/** Answer review for one module: your answer vs the key, with explanations and (post-exam) transcripts. */
export function ModuleReview({ module: m }: { module: Meta }) {
  const passages: Meta[] = m.passages ?? [];
  const byPassage = new Map<string, Meta[]>();
  for (const it of m.items as Meta[]) byPassage.set(it.passageId, [...(byPassage.get(it.passageId) ?? []), it]);

  return (
    <div className="mt-3 space-y-4">
      {passages
        .filter((p) => byPassage.has(p.id))
        .map((p) => (
          <div key={p.id} className="rounded-xl border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                {p.title ?? 'Stimulus'} <span className="ml-1 text-xs font-normal muted">({String(p.kind).replace(/_/g, ' ')}) — show text{['conversation', 'announcement', 'talk', 'choose_response'].includes(p.kind) ? ' / transcript' : ''}</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.kind === 'complete_words' ? String(p.body).replace(/\{\{\d+\|([^|]*)\|(\d+)\}\}/g, (_x, a, n) => `${a}${'_'.repeat(Number(n))}`) : p.body}</p>
              {Array.isArray(p.sourceRefs) && p.sourceRefs.length > 0 && (
                <p className="mt-2 text-xs muted">
                  Facts grounded on:{' '}
                  {p.sourceRefs.map((s: Meta) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title} ({s.license})</a>
                  ))}
                </p>
              )}
            </details>
            <div className="mt-3 space-y-3">
              {(byPassage.get(p.id) ?? []).map((it, i) => {
                const opts: Array<{ id: string; text: string }> = it.options ?? [];
                const text = (id: unknown) => opts.find((o) => o.id === id)?.text;
                return (
                  <div key={it.questionId} className="rounded-lg bg-black/5 p-3 text-sm dark:bg-white/5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={it.isCorrect ? 'good' : 'bad'}>{it.isCorrect ? 'Correct' : 'Incorrect'}</Badge>
                      <span className="text-xs muted">
                        {i + 1} · {it.skillTag ?? it.type} · {it.timeSpentSec}s
                      </span>
                    </div>
                    <p className="mt-2 font-medium">{it.prompt}</p>
                    <p className="mt-1">
                      <span className="muted">Your answer: </span>
                      {show(it.yourAnswer)}
                      {text(it.yourAnswer) ? ` — ${text(it.yourAnswer)}` : ''}
                    </p>
                    {!it.isCorrect && (
                      <p>
                        <span className="muted">Correct: </span>
                        <strong>{show(it.correctAnswer)}</strong>
                        {text(it.correctAnswer) ? ` — ${text(it.correctAnswer)}` : ''}
                      </p>
                    )}
                    {it.explanation && <p className="mt-2 text-xs muted">{it.explanation}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
