'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { AttemptState, ExamKind, Section } from '@/lib/types';

const SECTIONS: { key: Section; label: string; desc: string; icon: string }[] = [
  { key: 'READING', label: 'Reading', desc: 'Academic passages & questions', icon: '📖' },
  { key: 'LISTENING', label: 'Listening', desc: 'Lectures & conversations', icon: '🎧' },
  { key: 'SPEAKING', label: 'Speaking', desc: 'Spoken responses (beta)', icon: '🎙️' },
  { key: 'WRITING', label: 'Writing', desc: 'Typed essays (beta)', icon: '✍️' },
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
        Generate a fresh AI-authored simulation. Choose a full mock or a single section.
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
                All four sections with realistic timing. Reading & Listening are
                auto-graded; Speaking & Writing capture responses (grading in a
                later release).
              </p>
            </div>
            <button
              className="btn-primary"
              disabled={busy !== null}
              onClick={() => start('FULL')}
            >
              {busy === 'FULL' ? <Spinner /> : 'Start full mock'}
            </button>
          </div>
        </Card>

        {SECTIONS.map((s) => (
          <Card key={s.key}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  <span className="mr-2">{s.icon}</span>
                  {s.label}
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
