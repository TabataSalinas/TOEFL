'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  AttemptState,
  SectionPayload,
  SectionState,
  Section,
} from '@/lib/types';
import { ExamTimer } from '@/components/exam-timer';
import { Card, Spinner, Badge } from '@/components/ui';

type Phase = 'loading' | 'overview' | 'in-section' | 'done';

const SECTION_LABEL: Record<Section, string> = {
  READING: 'Reading',
  LISTENING: 'Listening',
  SPEAKING: 'Speaking',
  WRITING: 'Writing',
};

export default function ExamRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [section, setSection] = useState<SectionPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const loadAttempt = useCallback(async () => {
    const data = await api.get<AttemptState>(`/attempts/${id}`);
    setAttempt(data);
    if (data.status === 'COMPLETED' || data.status === 'ABANDONED') {
      setPhase('done');
    } else {
      setPhase('overview');
    }
  }, [id]);

  useEffect(() => {
    loadAttempt().catch((e) => setError((e as Error).message));
  }, [loadAttempt]);

  const startSection = async (s: Section) => {
    setBusy(true);
    setError('');
    try {
      const payload = await api.post<SectionPayload>(
        `/attempts/${id}/sections/${s}/start`,
        {},
      );
      setSection(payload);
      setAnswers({});
      setText({});
      setPhase('in-section');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const persistAnswers = useCallback(async () => {
    if (!section || savingRef.current) return;
    savingRef.current = true;
    try {
      const objective = Object.entries(answers).map(([questionId, response]) => ({
        questionId,
        response,
      }));
      // Productive responses saved as text in the response field for now.
      const productive = Object.entries(text).map(([questionId, response]) => ({
        questionId,
        response,
      }));
      const all = [...objective, ...productive];
      if (all.length)
        await api.post(`/attempts/${id}/sections/${section.section}/answers`, {
          answers: all,
        });
    } catch {
      /* answers resend on finish */
    } finally {
      savingRef.current = false;
    }
  }, [answers, text, section, id]);

  // Autosave every 10s while in a section.
  useEffect(() => {
    if (phase !== 'in-section') return;
    const t = setInterval(persistAnswers, 10_000);
    return () => clearInterval(t);
  }, [phase, persistAnswers]);

  const finishSection = useCallback(async () => {
    if (!section) return;
    setBusy(true);
    try {
      await persistAnswers();
      await api.post(`/attempts/${id}/sections/${section.section}/finish`, {});
      setSection(null);
      await loadAttempt();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [section, persistAnswers, id, loadAttempt]);

  if (phase === 'loading')
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Preparing exam…" />
      </div>
    );

  if (error && !section)
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <p className="text-red-500">{error}</p>
          <button className="btn-ghost mt-4" onClick={() => router.push('/practice')}>
            Back to practice
          </button>
        </Card>
      </div>
    );

  // ── Exam overview / section selection ──────────────────────────────
  if (phase === 'overview' && attempt) {
    const nextSection = attempt.sections.find(
      (s) => s.status === 'NOT_STARTED' || s.status === 'IN_PROGRESS',
    );
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Exam in progress</h1>
        <p className="muted">
          Sections start one at a time. Once a section&apos;s timer starts, it cannot
          be paused.
        </p>
        <div className="mt-6 space-y-3">
          {attempt.sections.map((s) => (
            <SectionRow
              key={s.section}
              s={s}
              onStart={() => startSection(s.section)}
              disabled={busy}
            />
          ))}
        </div>
        {!nextSection && (
          <Card className="mt-6">
            <p>All sections complete.</p>
            <button
              className="btn-primary mt-3"
              onClick={() => router.push(`/report/${attempt.id}`)}
            >
              View results
            </button>
          </Card>
        )}
      </div>
    );
  }

  // ── Completed ──────────────────────────────────────────────────────
  if (phase === 'done' && attempt) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold">Exam finished</h1>
          <p className="muted mt-1">Your score report is ready.</p>
          <button
            className="btn-primary mt-4"
            onClick={() => router.push(`/report/${attempt.id}`)}
          >
            View results
          </button>
        </Card>
      </div>
    );
  }

  // ── In a section (exam mode) ───────────────────────────────────────
  if (phase === 'in-section' && section) {
    const isProductive =
      section.section === 'SPEAKING' || section.section === 'WRITING';
    return (
      <div className="min-h-screen">
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--background) / 0.9)' }}
        >
          <div>
            <div className="font-semibold">{SECTION_LABEL[section.section]}</div>
            <div className="text-xs muted">
              {section.questions.length} item(s)
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExamTimer deadlineIso={section.deadlineAt} onExpire={finishSection} />
            <button className="btn-primary" disabled={busy} onClick={finishSection}>
              {busy ? 'Submitting…' : 'Finish section'}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6">
          <p className="mb-4 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">
            {section.instructions}
          </p>

          {section.passages.map((p) => (
            <Card key={p.id} className="mb-6">
              <h2 className="font-semibold">{p.title}</h2>
              {section.section === 'LISTENING' && (
                <p className="mb-2 text-xs muted">
                  🎧 Transcript shown here for practice. Audio narration is
                  synthesized in a later release.
                </p>
              )}
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{p.body}</p>
            </Card>
          ))}

          <div className="space-y-5">
            {section.questions.map((q, idx) => (
              <Card key={q.id}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge>Q{idx + 1}</Badge>
                  <span className="text-xs muted">{q.type.replace(/_/g, ' ')}</span>
                </div>
                <p className="font-medium">{q.prompt}</p>

                {isProductive ? (
                  <textarea
                    className="input mt-3 min-h-[160px]"
                    placeholder={
                      section.section === 'WRITING'
                        ? 'Type your response…'
                        : 'Speaking recording is captured in a later release — you may draft notes here.'
                    }
                    value={text[q.id] ?? ''}
                    onChange={(e) =>
                      setText((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                  />
                ) : (
                  <div className="mt-3 space-y-2">
                    {(q.options ?? []).map((opt) => {
                      const selected = answers[q.id] === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                            selected ? 'border-brand-500 bg-brand-500/10' : ''
                          }`}
                          style={!selected ? { borderColor: 'rgb(var(--border))' } : {}}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={selected}
                            onChange={() =>
                              setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <strong className="mr-1">{opt.id}.</strong>
                            {opt.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button className="btn-primary" disabled={busy} onClick={finishSection}>
              {busy ? 'Submitting…' : 'Finish section'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function SectionRow({
  s,
  onStart,
  disabled,
}: {
  s: SectionState;
  onStart: () => void;
  disabled: boolean;
}) {
  const label = SECTION_LABEL[s.section];
  const done = s.status === 'COMPLETED' || s.status === 'EXPIRED';
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs muted">
            {done
              ? `${s.status} · ${Math.round(s.timeSpentSec / 60)} min`
              : s.status === 'IN_PROGRESS'
                ? 'Resume in progress'
                : 'Not started'}
          </div>
        </div>
        {done ? (
          <Badge tone={s.status === 'EXPIRED' ? 'warn' : 'good'}>{s.status}</Badge>
        ) : (
          <button className="btn-primary" disabled={disabled} onClick={onStart}>
            {s.status === 'IN_PROGRESS' ? 'Resume' : 'Start'}
          </button>
        )}
      </div>
    </Card>
  );
}
