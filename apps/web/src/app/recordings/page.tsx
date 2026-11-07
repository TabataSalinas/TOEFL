'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge, Card, Spinner } from '@/components/ui';
import { RecordingFeedback } from '@/components/report/feedback';
import { api } from '@/lib/api';
import { Meta } from '@/lib/types';

interface Row {
  id: string;
  createdAt: string;
  attemptId: string;
  examTitle: string;
  type: string | null;
  prompt: string;
  durationSec: number;
  score: number | null;
  transcript: string | null;
  metrics: Meta | null;
}

export default function RecordingsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Meta | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Row[]>('/speaking/recordings').then(setRows).catch((e) => setError((e as Error).message));
  }, []);

  const select = async (id: string) => {
    setOpen(null);
    setOpen(await api.get<Meta>(`/speaking/recordings/${id}`));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">My recordings</h1>
      <p className="muted">Listen again to your Speaking answers, read the transcript and compare delivery metrics over time.</p>
      {error && <p className="mt-3 text-red-500">{error}</p>}
      {!rows && !error && <Spinner label="Loading recordings…" />}

      {open && (
        <div className="mt-6">
          <RecordingFeedback rec={open} index={1} />
        </div>
      )}

      {rows && (
        <Card className="mt-6">
          {rows.length === 0 ? (
            <p className="text-sm muted">No recordings yet. Take a Speaking section from <Link href="/practice" className="text-brand-500 underline">Practice</Link>.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <button className="font-medium hover:underline" onClick={() => void select(r.id)}>
                      {r.type === 'SPEAKING_LISTEN_REPEAT' ? 'Listen and Repeat' : 'Interview'} — {new Date(r.createdAt).toLocaleString()}
                    </button>
                    <div className="truncate text-xs muted">{r.type === 'SPEAKING_INTERVIEW' ? r.prompt : r.transcript}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{r.durationSec}s</Badge>
                    {r.metrics?.wordsPerMinute != null && <Badge>{r.metrics.wordsPerMinute} wpm</Badge>}
                    <Badge tone="good">{r.score ?? 0}/5</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </AppShell>
  );
}
