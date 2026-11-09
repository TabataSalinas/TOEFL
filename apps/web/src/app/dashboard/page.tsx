'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card, Stat, Progress, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { Dashboard } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ProgressData {
  trend: string;
  timeline: { date: string; total: number }[];
}
interface SkillRow {
  skillTag: string;
  section: string;
  accuracy: number;
  total: number;
  source: 'items' | 'rubric';
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Dashboard>('/dashboard')
      .then(setData)
      .catch((e) => setError((e as Error).message));
    api.get<ProgressData>('/reports/progress').then(setProgress).catch(() => undefined);
    api.get<SkillRow[]>('/reports/skills').then(setSkills).catch(() => undefined);
  }, []);

  const weakest = skills.filter((s) => s.total >= 2 || s.source === 'rubric').slice(0, 5);
  const chart = (progress?.timeline ?? []).map((t, i) => ({ name: `#${i + 1}`, score: t.total }));

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="muted">Your preparation at a glance.</p>
        </div>
        <Link href="/practice" className="btn-primary">
          Start practice
        </Link>
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {!data && !error && <Spinner label="Loading dashboard…" />}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Current streak"
              value={`${data.streak.current} 🔥`}
              sub={`Longest: ${data.streak.longest} days`}
            />
            <Stat
              label="Total study time"
              value={`${Math.round(data.totals.totalStudyMinutes / 60)}h`}
              sub={`${data.totals.totalStudyMinutes} min total`}
            />
            <Stat
              label="Mocks completed"
              value={data.totals.totalAttempts}
            />
            <Stat
              label="Latest score"
              value={data.score.latest ?? '—'}
              sub={
                data.score.latestBand
                  ? `Band ${data.score.latestBand} / 6`
                  : 'Take a mock to get a score'
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Progress to target</h2>
                <Badge tone={data.score.progressToTargetPercent >= 100 ? 'good' : 'default'}>
                  {data.readiness.level}
                </Badge>
              </div>
              <div className="mt-4 flex items-end justify-between text-sm">
                <span>
                  {data.score.latest ?? 0} / {data.score.target} (0–120)
                </span>
                <span className="muted">{data.score.progressToTargetPercent}%</span>
              </div>
              <div className="mt-2">
                <Progress percent={data.score.progressToTargetPercent} />
              </div>
              <p className="mt-3 text-sm muted">{data.readiness.label}</p>
            </Card>

            <Card>
              <h2 className="font-semibold">Weekly goal</h2>
              {data.goals.weekly ? (
                <>
                  <div className="mt-3 flex justify-between text-sm">
                    <span>
                      {data.goals.weekly.completedMinutes} /{' '}
                      {data.goals.weekly.targetMinutes} min
                    </span>
                    <span className="muted">{data.goals.weekly.percent}%</span>
                  </div>
                  <div className="mt-2">
                    <Progress percent={data.goals.weekly.percent} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm muted">
                  No weekly goal set.{' '}
                  <Link href="/settings" className="text-brand-500 hover:underline">
                    Set one
                  </Link>
                </p>
              )}
              <h2 className="mt-6 font-semibold">Monthly goal</h2>
              {data.goals.monthly ? (
                <>
                  <div className="mt-3 flex justify-between text-sm">
                    <span>
                      {data.goals.monthly.completedMinutes} /{' '}
                      {data.goals.monthly.targetMinutes} min
                    </span>
                    <span className="muted">{data.goals.monthly.percent}%</span>
                  </div>
                  <div className="mt-2">
                    <Progress percent={data.goals.monthly.percent} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm muted">No monthly goal set.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Score evolution</h2>
                {progress && <Badge tone={progress.trend === 'improving' ? 'good' : progress.trend === 'declining' ? 'bad' : 'default'}>{progress.trend}</Badge>}
              </div>
              {chart.length > 1 ? (
                <div className="mt-4" style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 120]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#3b63f6" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-2 text-sm muted">Complete at least two mocks to see your trend.</p>
              )}
            </Card>
            <Card>
              <h2 className="font-semibold">Areas to improve</h2>
              {weakest.length === 0 ? (
                <p className="mt-2 text-sm muted">Not enough data yet.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {weakest.map((w) => (
                    <li key={`${w.section}-${w.skillTag}`}>
                      <div className="flex justify-between text-sm">
                        <span>
                          {w.skillTag.replace(/[-_:]/g, ' ')} <span className="muted">({w.section.toLowerCase()})</span>
                        </span>
                        <span className="muted">{Math.round(w.accuracy * 100)}%</span>
                      </div>
                      <div className="mt-1">
                        <Progress percent={w.accuracy * 100} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/tutor" className="mt-4 inline-block text-sm text-brand-500 hover:underline">
                Open study plan →
              </Link>
            </Card>
          </div>

          <Card>
            <h2 className="font-semibold">Recent mocks</h2>
            {data.recentAttempts.length === 0 ? (
              <p className="mt-2 text-sm muted">
                No attempts yet. Start your first simulation!
              </p>
            ) : (
              <ul className="mt-3 divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {data.recentAttempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link
                        href={`/report/${a.id}`}
                        className="font-medium hover:underline"
                      >
                        {a.title}
                      </Link>
                      <div className="text-xs muted">
                        {a.date ? new Date(a.date).toLocaleString() : ''}
                      </div>
                    </div>
                    <Badge tone="good">{a.total ?? '—'} / 120</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
