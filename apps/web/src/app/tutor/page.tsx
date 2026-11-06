'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, Badge, Spinner, Progress } from '@/components/ui';
import { api } from '@/lib/api';

interface SkillAccuracy {
  skillTag: string;
  section: string;
  accuracy: number;
  total: number;
}

interface Analysis {
  estimatedTotal: number;
  targetScore: number;
  gap: number;
  summary: string;
  weakestSkills: SkillAccuracy[];
  strongestSkills: SkillAccuracy[];
  estimatedWeeksToTarget: number;
}

interface PlanItem {
  id: string;
  order: number;
  section: string | null;
  skillTag: string | null;
  title: string;
  description: string | null;
  estMinutes: number;
  estPointsGain: number | string;
  status: string;
}

interface Plan {
  id: string;
  title: string;
  summary: string | null;
  items: PlanItem[];
}

export default function TutorPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get<Analysis>('/tutor/analysis').then(setAnalysis).catch((e) => setError((e as Error).message));
    api.get<Plan | null>('/tutor/plan').then(setPlan).catch(() => undefined);
  };

  useEffect(load, []);

  const generatePlan = async () => {
    setBusy(true);
    try {
      const p = await api.post<Plan>('/tutor/plan', {});
      setPlan(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (itemId: string, status: string) => {
    const updated = await api.patch<PlanItem>(`/tutor/plan/items/${itemId}`, { status });
    setPlan((prev) =>
      prev
        ? { ...prev, items: prev.items.map((it) => (it.id === itemId ? updated : it)) }
        : prev,
    );
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">AI Coach</h1>
      <p className="muted">
        Your personal TOEFL tutor analyzes your results and builds an adaptive plan.
      </p>

      {error && <p className="mt-4 text-red-500">{error}</p>}
      {!analysis && !error && <Spinner label="Analyzing your performance…" />}

      {analysis && (
        <div className="mt-6 space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Coaching summary</h2>
                <p className="mt-2 max-w-3xl text-sm">{analysis.summary}</p>
              </div>
              <div className="text-right">
                <div className="text-sm muted">Estimated → Target</div>
                <div className="text-2xl font-bold">
                  {analysis.estimatedTotal} → {analysis.targetScore}
                </div>
                <div className="text-sm muted">
                  Gap: {analysis.gap} pts · ~{analysis.estimatedWeeksToTarget} wks
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="font-semibold">Priority weaknesses</h2>
              {analysis.weakestSkills.length === 0 ? (
                <p className="mt-2 text-sm muted">
                  Complete a mock to build your profile.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {analysis.weakestSkills.map((s) => (
                    <li key={s.skillTag}>
                      <div className="flex justify-between text-sm">
                        <span>
                          {s.skillTag}{' '}
                          <span className="muted">({s.section.toLowerCase()})</span>
                        </span>
                        <span className="muted">{Math.round(s.accuracy * 100)}%</span>
                      </div>
                      <div className="mt-1">
                        <Progress percent={s.accuracy * 100} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="font-semibold">Strengths</h2>
              {analysis.strongestSkills.length === 0 ? (
                <p className="mt-2 text-sm muted">Not enough data yet.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.strongestSkills.map((s) => (
                    <Badge key={s.skillTag} tone="good">
                      {s.skillTag} · {Math.round(s.accuracy * 100)}%
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Study plan</h2>
              <button className="btn-primary" disabled={busy} onClick={generatePlan}>
                {busy ? 'Generating…' : plan ? 'Regenerate plan' : 'Generate plan'}
              </button>
            </div>

            {!plan && (
              <p className="mt-3 text-sm muted">
                No active plan yet. Generate one based on your latest results.
              </p>
            )}

            {plan && (
              <div className="mt-4 space-y-3">
                {plan.items.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-xl border p-3"
                    style={{ borderColor: 'rgb(var(--border))' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{it.title}</div>
                        {it.description && (
                          <p className="mt-1 text-sm muted">{it.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <Badge>~{it.estMinutes} min</Badge>
                          <Badge tone="good">
                            +{Number(it.estPointsGain).toFixed(1)} pts
                          </Badge>
                          {it.section && <Badge>{it.section}</Badge>}
                        </div>
                      </div>
                      <select
                        className="input w-36"
                        value={it.status}
                        onChange={(e) => setStatus(it.id, e.target.value)}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="DONE">Done</option>
                        <option value="SKIPPED">Skipped</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
