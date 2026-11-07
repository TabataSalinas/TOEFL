'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExamTimer } from '@/components/exam-timer';
import { Badge, Card } from '@/components/ui';
import { playStimulus, Turn } from '@/lib/audio';
import { useAnswers } from '@/lib/use-answers';
import { Passage, Question, SectionPayload } from '@/lib/types';
import { StepClock } from './clock';

type Item = { kind: 'audio'; passage: Passage } | { kind: 'question'; passage: Passage; question: Question; number: number };

/**
 * Listening module: each recording plays ONCE (no replay), questions appear one at a
 * time with their own clock, and you cannot go back — answers are locked on Next.
 */
export function ListeningRunner({
  payload,
  attemptId,
  onFinish,
}: {
  payload: SectionPayload;
  attemptId: string;
  onFinish: () => Promise<void>;
}) {
  const { answers, setAnswer, flush, enter } = useAnswers(attemptId, 'LISTENING', payload);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState(0);
  const finishing = useRef(false);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let n = 0;
    for (const step of payload.steps) {
      const passage = payload.passages.find((p) => p.id === step.passageId);
      if (!passage) continue;
      out.push({ kind: 'audio', passage });
      for (const qid of step.questionIds) {
        const question = payload.questions.find((q) => q.id === qid);
        if (question) out.push({ kind: 'question', passage, question, number: ++n });
      }
    }
    return out;
  }, [payload]);

  const item = items[idx];
  const totalQuestions = items.filter((i) => i.kind === 'question').length;

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    await flush();
    await onFinish();
  };

  const advance = async (lockId?: string) => {
    if (lockId) await flush([lockId]);
    if (idx >= items.length - 1) await finish();
    else setIdx(idx + 1);
  };

  // Play each stimulus exactly once.
  useEffect(() => {
    if (!item || item.kind !== 'audio') return;
    setTurn(0);
    let cancelled = false;
    const meta = item.passage.meta as { audioUrls?: string[]; turns?: Turn[] };
    const handle = playStimulus(meta, (i) => !cancelled && setTurn(i));
    handle.done.then(() => {
      if (!cancelled) setIdx((i) => i + 1);
    });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [idx, item]);

  useEffect(() => {
    enter(item?.kind === 'question' ? item.question.id : null);
  }, [idx, item, enter]);

  if (!item) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--background) / 0.92)' }}>
        <div>
          <div className="font-semibold">
            Listening — Module {payload.module} of {payload.moduleCount}
          </div>
          <div className="text-xs muted">Each recording plays once · you cannot return to previous questions</div>
        </div>
        <ExamTimer deadlineIso={payload.deadlineAt} onExpire={finish} />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {item.kind === 'audio' ? (
          <Card className="text-center">
            <p className="text-sm muted">{String(item.passage.meta?.context ?? (item.passage.kind === 'choose_response' ? 'Listen and choose a response.' : 'Listen carefully.'))}</p>
            <div className="my-8 flex items-end justify-center gap-1.5" aria-hidden>
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} className="w-2 animate-pulse rounded bg-brand-500" style={{ height: `${20 + ((i * 17) % 40)}px`, animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            <p className="font-medium" aria-live="polite">
              Playing… {Array.isArray(item.passage.meta?.speakers) && item.passage.meta.speakers.length > 1 ? `(speaker ${Math.min(turn + 1, item.passage.meta.speakers.length)} of ${item.passage.meta.speakers.length})` : ''}
            </p>
            <p className="mt-1 text-xs muted">The recording cannot be paused or replayed.</p>
            {typeof window !== 'undefined' && !('speechSynthesis' in window) && !item.passage.meta?.audioUrls && (
              <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-left text-sm">
                <strong>Audio is not supported in this browser.</strong> Showing the text so you can still practise:
                <p className="mt-2 whitespace-pre-wrap">{(item.passage.meta?.turns as Turn[] | undefined)?.map((t) => `${t.speaker}: ${t.text}`).join('\n')}</p>
                <button className="btn-primary mt-3" onClick={() => setIdx(idx + 1)}>Continue</button>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Badge>
                Question {item.number} of {totalQuestions}
              </Badge>
              <StepClock key={item.question.id} seconds={item.question.timeLimitSec ?? 30} onEnd={() => void advance(item.question.id)} alertAt={5} label="Question clock" />
            </div>
            <p className="font-medium">{item.question.prompt}</p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label={item.question.prompt}>
              {(item.question.options ?? []).map((opt) => {
                const selected = answers[item.question.id] === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${selected ? 'border-brand-500 bg-brand-500/10' : ''}`}
                    style={!selected ? { borderColor: 'rgb(var(--border))' } : {}}
                  >
                    <input type="radio" name={item.question.id} checked={selected} onChange={() => setAnswer(item.question.id, opt.id)} className="mt-0.5" />
                    <span>
                      <strong className="mr-1">({opt.id})</strong>
                      {opt.text}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="btn-primary" disabled={busy} onClick={() => void advance(item.question.id)}>
                {idx >= items.length - 1 ? (busy ? 'Submitting…' : 'Finish module') : 'Next →'}
              </button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
