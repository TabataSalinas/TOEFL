'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card, Stat, Progress, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { Dashboard } from '@/lib/types';

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Dashboard>('/dashboard')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

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
