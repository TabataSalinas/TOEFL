'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExamTimer } from '@/components/exam-timer';
import { Badge, Card } from '@/components/ui';
import { useAnswers } from '@/lib/use-answers';
import { Passage, Question, SectionPayload, Step } from '@/lib/types';
import { BuildSentenceItem } from './build-sentence';
import { StepClock } from './clock';

const countWords = (t: string) => (t.trim().match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? []).length;

/**
 * Writing: three timed tasks in order. Each task has its own clock; when it ends the
 * task locks and the next one starts automatically. No going back.
 */
export function WritingRunner({
  payload,
  attemptId,
  onFinish,
}: {
  payload: SectionPayload;
  attemptId: string;
  onFinish: () => Promise<void>;
}) {
  const { answers, setAnswer, flush, enter } = useAnswers(attemptId, 'WRITING', payload);
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const finishing = useRef(false);

  const steps = payload.steps;
  const step = steps[stepIdx];
  const passage = payload.passages.find((p) => p.id === step?.passageId);
  const questions = useMemo(
    () => (step ? step.questionIds.map((id) => payload.questions.find((q) => q.id === id)).filter((q): q is Question => !!q) : []),
    [step, payload.questions],
  );

  useEffect(() => {
    setLocked(false);
    enter(questions[0]?.id ?? null);
  }, [stepIdx, questions, enter]);

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy(true);
    await flush(steps.flatMap((s) => s.questionIds));
    await onFinish();
  };

  const nextStep = async () => {
    setLocked(true);
    await flush(step.questionIds);
    if (stepIdx >= steps.length - 1) await finish();
    else setStepIdx(stepIdx + 1);
  };

  if (!step || !passage) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--background) / 0.92)' }}>
        <div>
          <div className="font-semibold">Writing — {step.title}</div>
          <div className="text-xs muted">
            Task {stepIdx + 1} of {steps.length} · each task has its own clock and cannot be revisited
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step.timeLimitSec && <StepClock key={step.id} seconds={step.timeLimitSec} onEnd={() => void nextStep()} alertAt={60} label="Task clock" running={!locked} />}
          <ExamTimer deadlineIso={payload.deadlineAt} onExpire={finish} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <p className="mb-4 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">{step.instructions}</p>

        {step.kind === 'BUILD_SENTENCE' && (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <BuildSentenceItem key={q.id} question={q} index={i + 1} value={answers[q.id] as string[] | undefined} onChange={(v) => setAnswer(q.id, v)} disabled={locked} />
            ))}
          </div>
        )}

        {step.kind === 'WRITE_EMAIL' && <EmailTask passage={passage} question={questions[0]} value={String(answers[questions[0].id] ?? '')} onChange={(v) => setAnswer(questions[0].id, v)} disabled={locked} />}

        {step.kind === 'ACADEMIC_DISCUSSION' && <DiscussionTask passage={passage} question={questions[0]} value={String(answers[questions[0].id] ?? '')} onChange={(v) => setAnswer(questions[0].id, v)} disabled={locked} />}

        <div className="mt-6 flex justify-end">
          <button className="btn-primary" disabled={busy || locked} onClick={() => void nextStep()}>
            {stepIdx >= steps.length - 1 ? (busy ? 'Submitting…' : 'Submit writing section') : 'Submit task and continue →'}
          </button>
        </div>
      </main>
    </div>
  );
}

function Editor({ value, onChange, disabled, min }: { value: string; onChange: (v: string) => void; disabled?: boolean; min?: number }) {
  const wc = countWords(value);
  return (
    <div>
      <textarea
        className="input min-h-[280px] leading-relaxed"
        placeholder="Type your response here…"
        value={value}
        disabled={disabled}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Your response"
      />
      <div className="mt-1 flex justify-between text-xs muted">
        <span>
          {wc} words{min ? ` · at least ${min} recommended` : ''}
        </span>
        {min && <span className={wc >= min ? 'text-green-500' : ''}>{wc >= min ? 'Length goal reached' : `${min - wc} to go`}</span>}
      </div>
    </div>
  );
}

function EmailTask({ passage, question, value, onChange, disabled }: { passage: Passage; question: Question; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const meta = passage.meta ?? {};
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm leading-relaxed">{passage.body}</p>
        <p className="mt-3 text-sm font-medium">{question.prompt}</p>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {(meta.bullets as string[] | undefined)?.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p className="mt-3 text-xs muted">Write as much as you can and in complete sentences.</p>
      </Card>
      <Card>
        <div className="mb-2 text-sm">
          <strong>To:</strong> {meta.to} <span className="mx-2">·</span>
          <strong>Subject:</strong> {meta.subject}
        </div>
        <Editor value={value} onChange={onChange} disabled={disabled} min={60} />
      </Card>
    </div>
  );
}

function DiscussionTask({ passage, question, value, onChange, disabled }: { passage: Passage; question: Question; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const meta = passage.meta ?? {};
  const students = (meta.students as Array<{ name: string; post: string }> | undefined) ?? [];
  return (
    <div className="space-y-4">
      <Card>
        <Badge>Professor</Badge>
        <p className="mt-2 text-sm leading-relaxed">{String(meta.professor ?? passage.body)}</p>
        <div className="mt-4 space-y-3">
          {students.map((s) => (
            <div key={s.name} className="rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">
              <strong>{s.name}:</strong> {s.post}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="mb-2 text-sm font-medium">{question.prompt} Express and support your opinion, and contribute to the discussion in your own words (at least 100 words).</p>
        <Editor value={value} onChange={onChange} disabled={disabled} min={100} />
      </Card>
    </div>
  );
}

export type { Step };
