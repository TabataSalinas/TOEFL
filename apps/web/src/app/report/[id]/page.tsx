'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card, Stat, Badge, Spinner, Progress } from '@/components/ui';
import { api } from '@/lib/api';

interface ReportItem {
  questionId: string;
  prompt: string;
  type: string;
  skillTag: string | null;
  yourAnswer: unknown;
  correctAnswer: unknown;
  isCorrect: boolean | null;
  explanation: string | null;
  timeSpentSec: number;
  passageTitle: string | null;
}

interface ReportSection {
  section: string;
  status: string;
  timeSpentSec: number;
  scaledScore: number | null;
  band: number | null;
  confidence: number | null;
  rawCorrect: number;
  rawTotal: number;
  avgTimePerQuestionSec: number;
  hardestSkills: string[];
  items: ReportItem[];
}

interface Report {
  attemptId: string;
  examTitle: string;
  kind: string;
  status: string;
  completedAt: string | null;
  scoreReport: {
    totalScore: number;
    totalBand: number | null;
    confidence: number;
    methodology: string | null;
  } | null;
  sections: ReportSection[];
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Report>(`/reports/attempts/${id}`)
      .then(setReport)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  return (
    <AppShell>
      {error && <p className="text-red-500">{error}</p>}
      {!report && !error && <Spinner label="Loading report…" />}

      {report && (
        <div className="space-y-6">
          <div>
            <Link href="/history" className="text-sm text-brand-500 hover:underline">
              ← Back to history
            </Link>
            <h1 className="mt-1 text-2xl font-bold">{report.examTitle}</h1>
            <p className="muted">
              {report.completedAt
                ? new Date(report.completedAt).toLocaleString()
                : 'In progress'}
            </p>
          </div>

          {report.scoreReport && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Estimated total"
                value={`${report.scoreReport.totalScore}`}
                sub="of 120"
              />
              <Stat
                label="Band"
                value={report.scoreReport.totalBand ?? '—'}
                sub="1–6 scale (2026)"
              />
              <Stat
                label="Confidence"
                value={`${Math.round(report.scoreReport.confidence * 100)}%`}
              />
              <Stat
                label="Sections"
                value={report.sections.length}
              />
            </div>
          )}

          {report.scoreReport?.methodology && (
            <Card>
              <h2 className="font-semibold">How this score was estimated</h2>
              <p className="mt-2 text-sm muted">{report.scoreReport.methodology}</p>
            </Card>
          )}

          {report.sections.map((s) => (
            <Card key={s.section}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{s.section}</h2>
                <div className="flex items-center gap-2">
                  {s.scaledScore != null && (
                    <Badge tone="good">{s.scaledScore}/30</Badge>
                  )}
                  {s.band != null && <Badge>Band {s.band}</Badge>}
                  <Badge tone={s.status === 'EXPIRED' ? 'warn' : 'default'}>
                    {s.status}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="muted">Correct: </span>
                  {s.rawCorrect}/{s.rawTotal}
                </div>
                <div>
                  <span className="muted">Avg time/question: </span>
                  {s.avgTimePerQuestionSec}s
                </div>
                <div>
                  <span className="muted">Time spent: </span>
                  {Math.round(s.timeSpentSec / 60)} min
                </div>
              </div>

              {s.rawTotal > 0 && (
                <div className="mt-3">
                  <Progress percent={(s.rawCorrect / s.rawTotal) * 100} />
                </div>
              )}

              {s.hardestSkills.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="muted">Hardest skills: </span>
                  {s.hardestSkills.join(', ')}
                </p>
              )}

              {s.items.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-brand-500">
                    Review answers & explanations ({s.items.length})
                  </summary>
                  <div className="mt-3 space-y-3">
                    {s.items.map((it, i) => (
                      <div
                        key={it.questionId}
                        className="rounded-xl border p-3 text-sm"
                        style={{ borderColor: 'rgb(var(--border))' }}
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone={it.isCorrect ? 'good' : 'bad'}>
                            {it.isCorrect ? 'Correct' : 'Incorrect'}
                          </Badge>
                          <span className="muted">
                            Q{i + 1} · {it.skillTag ?? it.type}
                          </span>
                        </div>
                        <p className="mt-2 font-medium">{it.prompt}</p>
                        <p className="mt-1">
                          <span className="muted">Your answer: </span>
                          {renderAns(it.yourAnswer)}
                          {!it.isCorrect && (
                            <>
                              {' · '}
                              <span className="muted">Correct: </span>
                              {renderAns(it.correctAnswer)}
                            </>
                          )}
                        </p>
                        {it.explanation && (
                          <p className="mt-2 muted">{it.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </Card>
          ))}

          <Card>
            <div className="flex items-center justify-between">
              <p className="muted">Get a personalized study plan from your coach.</p>
              <Link href="/tutor" className="btn-primary">
                Open AI Coach
              </Link>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function renderAns(v: unknown): string {
  if (v == null) return '—';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}
