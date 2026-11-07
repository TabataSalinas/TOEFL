'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { AttemptState, ExamKind, Section } from '@/lib/types';

const SECTIONS: { key: Section; label: string; desc: string; icon: string; time: string }[] = [
  { key: 'READING', label: 'Reading', desc: 'Complete the Words · Read in Daily Life · Academic Passage — 2 adaptive modules (40 items)', icon: '📖', time: '≈ 28 min' },
  { key: 'LISTENING', label: 'Listening', desc: 'Choose a Response · Conversations · Announcements · Academic Talks — audio plays once (≈ 36 items)', icon: '🎧', time: '≈ 27 min' },
  { key: 'WRITING', label: 'Writing', desc: 'Build a Sentence (10) · Write an Email · Academic Discussion — AI-rated with rubric feedback', icon: '✍️', time: '≈ 23 min' },
  { key: 'SPEAKING', label: 'Speaking', desc: 'Listen and Repeat (7) · Take an Interview (4) — recorded, transcribed and analysed', icon: '🎙️', time: '≈ 8 min' },
];

export default function PracticePage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<'easy' | 'standard' | 'hard'>('standard');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const start = async (kind: ExamKind, section?: Section) => {
    setBusy(section ?? 'FULL');
    setError('');
    try {
      const exam = await api.post<{ id: string }>('/exams/generate', {
        kind,
        section,
        difficulty,
      });
      const attempt = await api.post<AttemptState>('/attempts', { examId: exam.id });
      router.push(`/exam/${attempt.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Practice</h1>
      <p className="muted">
        Every simulation follows the current (2026) TOEFL iBT format and is generated fresh, avoiding topics you saw recently.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium">Difficulty</span>
        {(['easy', 'standard', 'hard'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              difficulty === d ? 'bg-brand-600 text-white' : 'btn-ghost'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Full TOEFL simulation</h2>
              <p className="text-sm muted">
                Reading → Listening → Writing → Speaking in the official order, with adaptive Reading/Listening
                modules, server-side timers, microphone check and an estimated 0–120 score (≈ 1 h 30 min).
              </p>
            </div>
            <button
              className="btn-primary"
              disabled={busy !== null}
              onClick={() => start('FULL')}
            >
              {busy === 'FULL' ? <Spinner label="Generating…" /> : 'Start full mock'}
            </button>
          </div>
        </Card>

        {SECTIONS.map((s) => (
          <Card key={s.key}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  <span className="mr-2">{s.icon}</span>
                  {s.label} <span className="ml-1 text-xs font-normal muted">{s.time}</span>
                </h3>
                <p className="text-sm muted">{s.desc}</p>
              </div>
              <button
                className="btn-ghost"
                disabled={busy !== null}
                onClick={() => start('SECTION', s.key)}
              >
                {busy === s.key ? <Spinner /> : 'Practice'}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
