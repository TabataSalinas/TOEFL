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
  timeline: { date: string; total: number; title: string }[];
}

export default function HistoryPage() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Attempt[]>('/attempts'),
      api.get<Progress>('/reports/progress'),
    ])
      .then(([a, p]) => {
        setAttempts(a);
        setProgress(p);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const chartData =
    progress?.timeline.map((t, i) => ({
      name: `#${i + 1}`,
      score: t.total,
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
          <h2 className="mb-4 font-semibold">Score evolution</h2>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 120]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b63f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
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
