'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AttemptState, Section, SectionPayload, SectionState } from '@/lib/types';
import { Badge, Card, Spinner } from '@/components/ui';
import { ReadingRunner } from '@/components/exam/reading-runner';
import { ListeningRunner } from '@/components/exam/listening-runner';
import { WritingRunner } from '@/components/exam/writing-runner';
import { SpeakingRunner } from '@/components/exam/speaking-runner';
import { SystemCheck } from '@/components/exam/system-check';

type Phase = 'loading' | 'overview' | 'check' | 'running' | 'transition' | 'done';

const LABEL: Record<Section, string> = { READING: 'Reading', LISTENING: 'Listening', WRITING: 'Writing', SPEAKING: 'Speaking' };
const BLURB: Record<Section, string> = {
  READING: 'Complete the Words · Read in Daily Life · Read an Academic Passage (2 adaptive modules)',
  LISTENING: 'Listen and Choose a Response · Conversations · Announcements · Academic Talks (2 adaptive modules, audio plays once)',
  WRITING: 'Build a Sentence · Write an Email · Write for an Academic Discussion',
  SPEAKING: 'Listen and Repeat · Take an Interview (recorded automatically)',
};

export default function ExamRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [payload, setPayload] = useState<SectionPayload | null>(null);
  const [pendingSection, setPendingSection] = useState<Section | null>(null);
  const [micChecked, setMicChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);
  const finishing = useRef(false);

  const load = useCallback(async () => {
    const data = await api.get<AttemptState>(`/attempts/${id}`);
    setAttempt(data);
    setPhase(data.status === 'COMPLETED' || data.status === 'ABANDONED' ? 'done' : 'overview');
    return data;
  }, [id]);

  useEffect(() => {
    setMicChecked(sessionStorage.getItem('toefl_mic_ok') === '1');
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  const begin = async (section: Section) => {
    if (section === 'SPEAKING' && !micChecked) {
      setPendingSection(section);
      setPhase('check');
      return;
    }
    await start(section);
  };

  const start = async (section: Section) => {
    setBusy(true);
    setError('');
    try {
      const p = await api.post<SectionPayload>(`/attempts/${id}/sections/${section}/start`, {});
      finishing.current = false;
      setPayload(p);
      setPhase('running');
    } catch (e) {
      setError((e as Error).message);
      setPhase('overview');
    } finally {
      setBusy(false);
    }
  };

  const finishModule = useCallback(async () => {
    if (!payload || finishing.current) return;
    finishing.current = true;
    try {
      const res = await api.post<AttemptState>(`/attempts/${id}/sections/${payload.section}/finish`, {});
      setAttempt(res);
      setPayload(null);
      if (res.nextModule) {
        setCountdown(5);
        setPendingSection(payload.section);
        setPhase('transition');
      } else if (res.status === 'COMPLETED') {
        setPhase('done');
      } else {
        setPhase('overview');
      }
    } catch (e) {
      setError((e as Error).message);
      finishing.current = false;
      await load().catch(() => undefined);
    }
  }, [payload, id, load]);

  // Auto-continue to module 2 like the real test.
  useEffect(() => {
    if (phase !== 'transition' || !pendingSection) return;
    if (countdown <= 0) {
      void begin(pendingSection);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown, pendingSection]);

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Preparing exam…" />
      </div>
    );
  }

  if (error && phase === 'overview' && !attempt) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <p className="text-red-500">{error}</p>
          <button className="btn-ghost mt-4" onClick={() => router.push('/practice')}>Back to practice</button>
        </Card>
      </div>
    );
  }

  if (phase === 'running' && payload) {
    const common = { payload, attemptId: id, onFinish: finishModule };
    switch (payload.section) {
      case 'READING': return <ReadingRunner key={payload.sectionAttemptId} {...common} />;
      case 'LISTENING': return <ListeningRunner key={payload.sectionAttemptId} {...common} />;
      case 'WRITING': return <WritingRunner key={payload.sectionAttemptId} {...common} />;
      case 'SPEAKING': return <SpeakingRunner key={payload.sectionAttemptId} {...common} />;
    }
  }

  if (phase === 'check') {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <SystemCheck
          onDone={() => {
            sessionStorage.setItem('toefl_mic_ok', '1');
            setMicChecked(true);
            if (pendingSection === 'SPEAKING') void start('SPEAKING');
            else setPhase('overview');
          }}
        />
      </div>
    );
  }

  if (phase === 'transition') {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Card className="text-center">
          <h1 className="text-xl font-bold">Module 1 complete</h1>
          <p className="mt-2 text-sm muted">
            Your next module is selected based on how you performed. Module 2 starts automatically — you cannot return to Module 1.
          </p>
          <p className="mt-4 text-3xl font-bold tabular-nums" aria-live="polite">{countdown}</p>
          <button className="btn-primary mt-4" onClick={() => pendingSection && void begin(pendingSection)}>Start Module 2 now</button>
        </Card>
      </div>
    );
  }

  if (phase === 'done' && attempt) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <h1 className="text-xl font-bold">Exam finished</h1>
          <p className="mt-1 text-sm muted">Your score report, feedback and study plan are ready.</p>
          <button className="btn-primary mt-4" onClick={() => router.push(`/report/${attempt.id}`)}>View results</button>
        </Card>
      </div>
    );
  }

  // ── Overview ──
  const full = attempt?.kind === 'FULL';
  const firstOpen = attempt?.sections.findIndex((s) => s.status === 'NOT_STARTED' || s.status === 'IN_PROGRESS') ?? -1;
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Exam in progress</h1>
      <p className="muted">
        Sections follow the official order. A module&apos;s clock cannot be paused, and finished modules cannot be revisited.
      </p>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <div className="mt-6 space-y-3">
        {attempt?.sections.map((s, i) => (
          <SectionRow key={s.section} s={s} blurb={BLURB[s.section]} disabled={busy || (full && i !== firstOpen)} onStart={() => void begin(s.section)} />
        ))}
      </div>
      {!micChecked && attempt?.sections.some((s) => s.section === 'SPEAKING') && (
        <Card className="mt-6">
          <p className="text-sm">Speaking needs your microphone. Run the equipment check now so nothing interrupts the exam.</p>
          <button className="btn-ghost mt-3" onClick={() => { setPendingSection(null); setPhase('check'); }}>Run equipment check</button>
        </Card>
      )}
    </div>
  );
}

function SectionRow({ s, blurb, disabled, onStart }: { s: SectionState; blurb: string; disabled: boolean; onStart: () => void }) {
  const done = s.status === 'COMPLETED' || s.status === 'EXPIRED';
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">
            {LABEL[s.section]}
            {s.moduleCount > 1 && !done && <span className="ml-2 text-xs muted">Module {s.module} of {s.moduleCount}</span>}
          </div>
          <div className="text-xs muted">{done ? `${s.status === 'EXPIRED' ? 'Time expired' : 'Completed'} · ${Math.round(s.timeSpentSec / 60)} min` : blurb}</div>
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
