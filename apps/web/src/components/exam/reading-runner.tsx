'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExamTimer } from '@/components/exam-timer';
import { Badge, Card } from '@/components/ui';
import { useAnswers } from '@/lib/use-answers';
import { Passage, Question, SectionPayload } from '@/lib/types';
import { PassageView } from './passage-view';
import { CompleteWords } from './complete-words';

interface Screen {
  passage: Passage;
  questions: Question[];
  kind: string;
  title: string;
}

/**
 * Reading module: free navigation (Next/Back) inside the module, a question navigator,
 * and a hard stop when the module deadline passes. Once finished you cannot return.
 */
export function ReadingRunner({
  payload,
  attemptId,
  onFinish,
}: {
  payload: SectionPayload;
  attemptId: string;
  onFinish: () => Promise<void>;
}) {
  const { answers, setAnswer, flush, enter } = useAnswers(attemptId, 'READING', payload);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const screens = useMemo<Screen[]>(() => {
    const out: Screen[] = [];
    for (const step of payload.steps) {
      const passage = payload.passages.find((p) => p.id === step.passageId);
      if (!passage) continue;
      const qs = step.questionIds.map((id) => payload.questions.find((q) => q.id === id)).filter((q): q is Question => !!q);
      if (step.kind === 'COMPLETE_WORDS') out.push({ passage, questions: qs, kind: step.kind, title: step.title });
      else qs.forEach((q) => out.push({ passage, questions: [q], kind: step.kind, title: step.title }));
    }
    return out;
  }, [payload]);

  const screen = screens[idx];

  useEffect(() => {
    enter(screen?.questions[0]?.id ?? null);
  }, [idx, screen, enter]);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    await flush();
    await onFinish();
  };

  const answered = (s: Screen) => s.questions.every((q) => answers[q.id] != null && answers[q.id] !== '');

  if (!screen) return null;
  const q = screen.questions[0];
  const isLast = idx === screens.length - 1;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--background) / 0.92)' }}>
        <div>
          <div className="font-semibold">
            Reading — Module {payload.module} of {payload.moduleCount}
          </div>
          <div className="text-xs muted">
            {screen.title} · screen {idx + 1} of {screens.length} · you can go back within this module
          </div>
        </div>
        <ExamTimer deadlineIso={payload.deadlineAt} onExpire={finish} />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {screen.kind === 'COMPLETE_WORDS' ? (
          <Card>
            <p className="mb-4 text-sm font-medium">Fill in the missing letters in the paragraph. (Questions 1–{screen.questions.length})</p>
            <CompleteWords passage={screen.passage} questions={screen.questions} answers={answers} onChange={(id, v) => setAnswer(id, v)} />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="max-h-[70vh] overflow-auto">
              <PassageView passage={screen.passage} highlight={q.meta?.highlight} />
            </Card>
            <Card>
              <Badge>Question {idx + (screens[0].kind === 'COMPLETE_WORDS' ? 10 : 1)}</Badge>
              <p className="mt-3 font-medium">{q.prompt}</p>
              <div className="mt-4 space-y-2" role="radiogroup" aria-label={q.prompt}>
                {(q.options ?? []).map((opt) => {
                  const selected = answers[q.id] === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${selected ? 'border-brand-500 bg-brand-500/10' : ''}`}
                      style={!selected ? { borderColor: 'rgb(var(--border))' } : {}}
                    >
                      <input type="radio" name={q.id} checked={selected} onChange={() => setAnswer(q.id, opt.id)} className="mt-0.5" />
                      <span>
                        <strong className="mr-1">({opt.id})</strong>
                        {opt.text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        <nav aria-label="Question navigator" className="mt-6 flex flex-wrap gap-1.5">
          {screens.map((s, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-current={i === idx}
              className={`h-8 min-w-8 rounded-lg border px-2 text-xs ${i === idx ? 'bg-brand-600 text-white' : answered(s) ? 'bg-green-500/15' : ''}`}
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              {s.kind === 'COMPLETE_WORDS' ? '1–10' : i + (screens[0].kind === 'COMPLETE_WORDS' ? 10 : 1)}
            </button>
          ))}
        </nav>

        <div className="mt-6 flex items-center justify-between">
          <button className="btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            ← Back
          </button>
          {!isLast ? (
            <button className="btn-primary" onClick={() => setIdx(idx + 1)}>
              Next →
            </button>
          ) : confirm ? (
            <div className="flex items-center gap-2 text-sm">
              <span>You will not be able to return to this module.</span>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>
                Keep reviewing
              </button>
              <button className="btn-primary" disabled={busy} onClick={finish}>
                {busy ? 'Submitting…' : 'Finish module'}
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => setConfirm(true)}>
              Finish module
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
