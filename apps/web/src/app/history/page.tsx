'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { AppShell } from '@/components/app-shell';
import { Card, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

interface Attempt {
  id: string;
  status: string;
  startedAt: string;
  kind: string;
  exam: { title: string };
  scoreReport: { totalScore: number; totalBand: number | null } | null;
}

interface Progress {
  attempts: number;
  best: number;
  latest: number | null;
  trend: string;
  timeline: { date: string; total: number; title: string; sections: Record<string, number> }[];
  comparison: {
    total: { previous: number; current: number; delta: number };
    sections: Record<string, { previous: number; current: number; delta: number }>;
  } | null;
}

interface Timing {
  taskKind: string;
  avgSec: number;
  samples: number;
}

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [timings, setTimings] = useState<Timing[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Attempt[]>('/attempts'),
      api.get<Progress>('/reports/progress'),
      api.get<Timing[]>('/reports/timings'),
    ])
      .then(([a, p, t]) => {
        setAttempts(a);
        setProgress(p);
        setTimings(t);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const chartData =
    progress?.timeline.map((t, i) => ({
      name: `#${i + 1}`,
      score: t.total,
      Reading: t.sections.READING != null ? t.sections.READING * 4 : undefined,
      Listening: t.sections.LISTENING != null ? t.sections.LISTENING * 4 : undefined,
      Writing: t.sections.WRITING != null ? t.sections.WRITING * 4 : undefined,
      Speaking: t.sections.SPEAKING != null ? t.sections.SPEAKING * 4 : undefined,
      date: new Date(t.date).toLocaleDateString(),
    })) ?? [];

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">History & progress</h1>
      <p className="muted">Track your score evolution and revisit past mocks.</p>

      {error && <p className="mt-4 text-red-500">{error}</p>}
      {!attempts && !error && <Spinner label="Loading history…" />}

      {progress && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <div className="text-sm muted">Best total</div>
            <div className="text-3xl font-bold">{progress.best || '—'}</div>
          </Card>
          <Card>
            <div className="text-sm muted">Latest</div>
            <div className="text-3xl font-bold">{progress.latest ?? '—'}</div>
          </Card>
          <Card>
            <div className="text-sm muted">Trend</div>
            <div className="mt-1">
              <Badge
                tone={
                  progress.trend === 'improving'
                    ? 'good'
                    : progress.trend === 'declining'
                      ? 'bad'
                      : 'default'
                }
              >
                {progress.trend}
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {chartData.length > 1 && (
        <Card className="mt-6">
          <h2 className="mb-1 font-semibold">Score evolution</h2>
          <p className="mb-4 text-xs muted">Section lines are shown on the 0–120 scale (section score ×4) so they are comparable with the total.</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 120]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" name="Total" stroke="#3b63f6" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Reading" stroke="#10b981" dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Listening" stroke="#f59e0b" dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Writing" stroke="#ef4444" dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Speaking" stroke="#8b5cf6" dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {progress?.comparison && (
        <Card className="mt-6">
          <h2 className="font-semibold">Last two full mocks</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {[['TOTAL', progress.comparison.total], ...Object.entries(progress.comparison.sections)].map(([k, v]) => {
              const d = v as { previous: number; current: number; delta: number };
              return (
                <div key={k as string} className="rounded-xl bg-black/5 p-3 dark:bg-white/10">
                  <div className="text-xs muted">{k as string}</div>
                  <div className="text-lg font-semibold tabular-nums">{d.previous} → {d.current}</div>
                  <Badge tone={d.delta > 0 ? 'good' : d.delta < 0 ? 'bad' : 'default'}>{d.delta > 0 ? '+' : ''}{d.delta}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {timings.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-semibold">Average answer time per task</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {timings.map((t) => <Badge key={t.taskKind}>{t.taskKind.replace(/_/g, ' ').toLowerCase()}: {t.avgSec}s</Badge>)}
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="font-semibold">All attempts</h2>
        {attempts && attempts.length === 0 && (
          <p className="mt-2 text-sm muted">No attempts yet.</p>
        )}
        {attempts && attempts.length > 0 && (
          <ul className="mt-3 divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <Link
                    href={`/report/${a.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.exam.title}
                  </Link>
                  <div className="text-xs muted">
                    {new Date(a.startedAt).toLocaleString()} · {a.status}
                  </div>
                </div>
                <Badge tone={a.scoreReport ? 'good' : 'default'}>
                  {a.scoreReport ? `${a.scoreReport.totalScore} / 120` : a.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
