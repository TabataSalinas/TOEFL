'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge, Card, Progress, Spinner, Stat } from '@/components/ui';
import { EssayFeedback, RecordingFeedback } from '@/components/report/feedback';
import { ModuleReview } from '@/components/report/review';
import { api } from '@/lib/api';
import { Meta } from '@/lib/types';

interface Report {
  attemptId: string;
  examTitle: string;
  kind: string;
  completedAt: string | null;
  scoreReport: { totalScore: number; totalBand: number | null; confidence: number; methodology: string | null } | null;
  sections: Meta[];
}

const TASK_LABEL: Record<string, string> = {
  COMPLETE_WORDS: 'Complete the Words',
  DAILY_LIFE: 'Read in Daily Life',
  ACADEMIC_PASSAGE: 'Academic Passage',
  CHOOSE_RESPONSE: 'Choose a Response',
  CONVERSATION: 'Conversations',
  ANNOUNCEMENT: 'Announcements',
  ACADEMIC_TALK: 'Academic Talks',
  BUILD_SENTENCE: 'Build a Sentence',
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Report>(`/reports/attempts/${id}`).then(setReport).catch((e) => setError((e as Error).message));
  }, [id]);

  return (
    <AppShell>
      {error && <p className="text-red-500">{error}</p>}
      {!report && !error && <Spinner label="Loading report…" />}
      {report && (
        <div className="space-y-6">
          <div>
            <Link href="/history" className="text-sm text-brand-500 hover:underline">← Back to history</Link>
            <h1 className="mt-1 text-2xl font-bold">{report.examTitle}</h1>
            <p className="muted">{report.completedAt ? new Date(report.completedAt).toLocaleString() : 'In progress'}</p>
          </div>

          {report.scoreReport && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Estimated total" value={report.scoreReport.totalScore} sub="of 120 (internal estimate)" />
              <Stat label="Band" value={report.scoreReport.totalBand ?? '—'} sub="1–6 scale (2026)" />
              <Stat label="Confidence" value={`${Math.round(report.scoreReport.confidence * 100)}%`} sub="how reliable this estimate is" />
              <Stat label="Sections" value={report.sections.length} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {report.sections.map((s) => (
              <Card key={s.section}>
                <div className="text-sm muted">{s.section}</div>
                <div className="mt-1 text-2xl font-bold">{s.scaledScore ?? '—'}<span className="text-sm font-normal muted"> /30</span></div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.band != null && <Badge>Band {s.band}</Badge>}
                  {s.path && s.path !== 'core' && <Badge tone={s.path === 'hard' ? 'good' : 'warn'}>{s.path} path</Badge>}
                  {s.confidence != null && <Badge>conf. {Math.round(s.confidence * 100)}%</Badge>}
                </div>
              </Card>
            ))}
          </div>

          {report.scoreReport?.methodology && (
            <Card>
              <h2 className="font-semibold">How this score was estimated</h2>
              <p className="mt-2 text-sm muted">{report.scoreReport.methodology}</p>
            </Card>
          )}

          {report.sections.map((s) => (
            <section key={s.section} className="space-y-4">
              <h2 className="text-xl font-bold">{s.section}</h2>

              {(s.section === 'READING' || s.section === 'LISTENING') && (
                <>
                  <Card>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(s.modules as Meta[]).map((m) => (
                        <div key={m.module}>
                          <div className="text-sm font-medium">Module {m.module}{m.module > 1 ? ` (${m.variant})` : ''}</div>
                          <div className="text-xs muted">{m.correct}/{m.total} correct · avg {m.avgTimePerQuestionSec}s per question</div>
                          <div className="mt-1"><Progress percent={m.accuracy * 100} /></div>
                        </div>
                      ))}
                    </div>
                    <h3 className="mb-2 mt-5 text-sm font-semibold">Accuracy by task type</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(s.skillBreakdown as Meta).filter(([k]) => k.startsWith('task:')).map(([k, v]) => (
                        <div key={k} className="text-sm">
                          <div className="flex justify-between"><span>{TASK_LABEL[k.slice(5)] ?? k.slice(5)}</span><span className="muted">{(v as Meta).correct}/{(v as Meta).total}</span></div>
                          <Progress percent={(v as Meta).accuracy * 100} />
                        </div>
                      ))}
                    </div>
                    {s.hardestSkills.length > 0 && (
                      <p className="mt-4 text-sm"><span className="muted">Hardest skills: </span>{s.hardestSkills.join(', ')}</p>
                    )}
                  </Card>
                  {(s.modules as Meta[]).map((m) => (
                    <details key={m.module}>
                      <summary className="cursor-pointer text-sm font-medium text-brand-500">Review answers and explanations — Module {m.module} ({m.items.length})</summary>
                      <ModuleReview module={m} />
                    </details>
                  ))}
                </>
              )}

              {s.section === 'WRITING' && (
                <>
                  <Card>
                    <h3 className="font-semibold">Build a Sentence</h3>
                    {(s.modules as Meta[])[0] && (
                      <>
                        <p className="mt-1 text-sm muted">{(s.modules as Meta[])[0].correct}/{(s.modules as Meta[])[0].total} sentences built correctly</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium text-brand-500">Review sentences</summary>
                          <ul className="mt-2 space-y-2 text-sm">
                            {((s.modules as Meta[])[0].items as Meta[]).map((it) => (
                              <li key={it.questionId} className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
                                <Badge tone={it.isCorrect ? 'good' : 'bad'}>{it.isCorrect ? 'Correct' : 'Incorrect'}</Badge>
                                <span className="ml-2 muted">{it.prompt}</span>
                                <p className="mt-1"><span className="muted">You: </span>{Array.isArray(it.yourAnswer) ? it.yourAnswer.filter(Boolean).join(' ') || '—' : '—'}</p>
                                {!it.isCorrect && <p><span className="muted">Correct: </span><strong>{String(it.explanation).replace('Correct sentence: ', '')}</strong></p>}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </>
                    )}
                  </Card>
                  {(s.essays as Meta[]).map((e) => <EssayFeedback key={e.id} essay={e as never} />)}
                </>
              )}

              {s.section === 'SPEAKING' && (
                <>
                  {(s.recordings as Meta[]).length === 0 && <Card><p className="text-sm muted">No recordings were captured.</p></Card>}
                  {(s.recordings as Meta[]).map((r, i) => <RecordingFeedback key={r.id} rec={r} index={i + 1} />)}
                </>
              )}
            </section>
          ))}

          <Card>
            <div className="flex items-center justify-between">
              <p className="muted">Your personalised study plan was refreshed with these results.</p>
              <Link href="/tutor" className="btn-primary">Open AI Coach</Link>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
