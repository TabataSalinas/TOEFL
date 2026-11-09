'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExamTimer } from '@/components/exam-timer';
import { Badge, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { beep, playUrls, speakText } from '@/lib/audio';
import { useRecorder } from '@/lib/use-recorder';
import { Passage, Question, SectionPayload } from '@/lib/types';

interface Item {
  passage: Passage;
  question: Question;
  kind: 'LISTEN_REPEAT' | 'INTERVIEW';
}

type Phase = 'intro' | 'listen' | 'record' | 'processing' | 'done';

/**
 * Speaking: the system plays each prompt, beeps, and starts recording automatically;
 * the recording stops by itself when the clock ends (or when you press "I'm done").
 * Answers upload in the background and are transcribed + analysed on the server.
 */
export function SpeakingRunner({
  payload,
  attemptId,
  onFinish,
}: {
  payload: SectionPayload;
  attemptId: string;
  onFinish: () => Promise<void>;
}) {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>('intro');
  const [current, setCurrent] = useState(0);
  const [left, setLeft] = useState(0);
  const [uploads, setUploads] = useState({ ok: 0, failed: 0 });
  const stopEarly = useRef<(() => void) | null>(null);
  const cancelAudio = useRef<(() => void) | null>(null);
  const aborted = useRef(false);
  const pending = useRef<Promise<void>[]>([]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const step of payload.steps) {
      const passage = payload.passages.find((p) => p.id === step.passageId);
      if (!passage) continue;
      for (const qid of step.questionIds) {
        const question = payload.questions.find((q) => q.id === qid);
        if (question) out.push({ passage, question, kind: step.kind as Item['kind'] });
      }
    }
    return out;
  }, [payload]);

  useEffect(
    () => () => {
      aborted.current = true;
      cancelAudio.current?.();
    },
    [],
  );

  const playPrompt = async (q: Question, kind: Item['kind']) => {
    const speaker = kind === 'LISTEN_REPEAT' ? 'Trainer' : 'Interviewer';
    const handle = q.audioUrl ? playUrls([q.audioUrl]) : speakText(String(q.meta?.audioText ?? q.prompt), speaker);
    cancelAudio.current = handle.cancel;
    await handle.done;
  };

  const record = async (limit: number): Promise<void> => {
    const started = await recorder.start();
    if (!started) throw new Error('Microphone unavailable');
    await new Promise<void>((resolve) => {
      const t0 = Date.now();
      const id = setInterval(() => {
        const remaining = Math.max(0, limit - (Date.now() - t0) / 1000);
        setLeft(remaining);
        if (remaining <= 0 || aborted.current) {
          clearInterval(id);
          resolve();
        }
      }, 100);
      stopEarly.current = () => {
        clearInterval(id);
        resolve();
      };
    });
  };

  const upload = (q: Question, result: NonNullable<Awaited<ReturnType<typeof recorder.stop>>>) => {
    const form = new FormData();
    const ext = result.mimeType.includes('mp4') ? 'm4a' : result.mimeType.includes('ogg') ? 'ogg' : 'webm';
    form.append('audio', result.blob, `answer.${ext}`);
    form.append('questionId', q.id);
    form.append('durationSec', String(result.durationSec));
    form.append('clientTranscript', result.transcript);
    if (result.confidence) form.append('clientConfidence', String(result.confidence));
    form.append('speechSegments', JSON.stringify(result.segments));
    const p = api
      .upload(`/attempts/${attemptId}/speaking/recordings`, form)
      .then(() => setUploads((u) => ({ ...u, ok: u.ok + 1 })))
      .catch(() => setUploads((u) => ({ ...u, failed: u.failed + 1 })));
    pending.current.push(p);
  };

  const run = async () => {
    for (let i = 0; i < items.length && !aborted.current; i++) {
      const { question, kind } = items[i];
      setCurrent(i);
      setPhase('listen');
      await playPrompt(question, kind);
      if (aborted.current) return;
      setPhase('record');
      await beep();
      const limit = question.timeLimitSec ?? 45;
      setLeft(limit);
      try {
        await record(limit);
      } catch {
        break;
      }
      const result = await recorder.stop();
      if (result) upload(question, result);
    }
    setPhase('processing');
    await Promise.allSettled(pending.current);
    setPhase('done');
    await onFinish();
  };

  const item = items[current];
  const limit = item?.question.timeLimitSec ?? 45;
  const alertAt = limit <= 15 ? 3 : 10;
  const pct = item ? ((limit - left) / limit) * 100 : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--background) / 0.92)' }}>
        <div>
          <div className="font-semibold">Speaking</div>
          <div className="text-xs muted">Recording starts and stops automatically · no preparation time</div>
        </div>
        <ExamTimer deadlineIso={payload.deadlineAt} onExpire={() => { aborted.current = true; stopEarly.current?.(); void onFinish(); }} />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {phase === 'intro' && (
          <Card>
            <h2 className="text-lg font-semibold">Before you begin</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              <li><strong>Listen and Repeat:</strong> {items.filter((i) => i.kind === 'LISTEN_REPEAT').length} sentences. Repeat each one exactly, once.</li>
              <li><strong>Take an Interview:</strong> {items.filter((i) => i.kind === 'INTERVIEW').length} questions, up to 45 seconds each. Say as much as you can.</li>
              <li>Each prompt plays once. A beep means recording has started. A warning appears when time is almost up.</li>
              <li>You cannot re-record an answer. Find a quiet place and speak naturally.</li>
            </ul>
            {recorder.micError && <p className="mt-3 text-sm text-red-500">{recorder.micError}</p>}
            <div className="mt-5 flex justify-end">
              <button className="btn-primary" onClick={() => void run()}>
                Start speaking section
              </button>
            </div>
          </Card>
        )}

        {(phase === 'listen' || phase === 'record') && item && (
          <Card>
            <div className="flex items-center justify-between">
              <Badge>
                {item.kind === 'LISTEN_REPEAT' ? 'Listen and Repeat' : 'Interview'} · {current + 1} of {items.length}
              </Badge>
              <Badge tone={phase === 'record' ? 'bad' : 'default'}>{phase === 'record' ? '● Recording' : 'Listening…'}</Badge>
            </div>

            {item.passage.meta?.context && current === 0 && <p className="mt-4 text-sm muted">{String(item.passage.meta.context)}</p>}
            {item.kind === 'INTERVIEW' && <p className="mt-4 text-base font-medium" aria-live="polite">{item.question.prompt}</p>}
            {item.kind === 'LISTEN_REPEAT' && <p className="mt-4 text-sm muted">{phase === 'listen' ? 'Listen carefully…' : 'Now repeat what you heard.'}</p>}

            <div className="mt-6 h-3 w-full overflow-hidden rounded-full" style={{ background: 'rgb(var(--border))' }} role="meter" aria-label="Microphone level" aria-valuenow={Math.round(recorder.level * 100)}>
              <div className="h-full bg-green-500 transition-all" style={{ width: `${phase === 'record' ? recorder.level * 100 : 0}%` }} />
            </div>

            {phase === 'record' && (
              <>
                <div className="mt-6 flex items-end justify-between">
                  <div className="text-4xl font-bold tabular-nums">{Math.ceil(left)}s</div>
                  <div className="text-sm muted">Used {Math.round(limit - left)}s of {limit}s</div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgb(var(--border))' }}>
                  <div className={`h-full transition-all ${left <= alertAt ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                </div>
                {left <= alertAt && left > 0 && (
                  <p role="alert" className="mt-3 animate-pulse rounded-lg bg-red-500/10 p-2 text-center text-sm font-medium text-red-500">
                    Time almost up — finish your thought!
                  </p>
                )}
                <div className="mt-5 flex justify-end">
                  <button className="btn-ghost" disabled={limit - left < 2} onClick={() => stopEarly.current?.()}>
                    I’m done
                  </button>
                </div>
              </>
            )}
          </Card>
        )}

        {phase === 'processing' && (
          <Card className="text-center">
            <p className="font-medium">Transcribing and analysing your answers…</p>
            <p className="mt-1 text-sm muted">
              {uploads.ok} uploaded{uploads.failed ? `, ${uploads.failed} failed` : ''}
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
