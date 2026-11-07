'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, Progress } from '@/components/ui';
import { fetchBlobUrl } from '@/lib/api';
import { Meta } from '@/lib/types';

const pretty = (k: string) => k.replace(/[_-]/g, ' ');

export function DimensionBars({ dims }: { dims: Record<string, { score: number | null; rationale: string; source?: string }> }) {
  return (
    <ul className="space-y-3">
      {Object.entries(dims).map(([k, v]) => (
        <li key={k}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium capitalize">{pretty(k)}</span>
            <span className="flex items-center gap-2">
              {v.source && <Badge>{v.source}</Badge>}
              <span className="tabular-nums">{v.score == null ? 'n/a' : `${v.score}/5`}</span>
            </span>
          </div>
          <div className="mt-1">
            <Progress percent={((v.score ?? 0) / 5) * 100} />
          </div>
          <p className="mt-1 text-xs muted">{v.rationale}</p>
        </li>
      ))}
    </ul>
  );
}

function Errors({ errors }: { errors: Array<{ original: string; correction: string; type: string; explanation: string }> }) {
  if (!errors?.length) return <p className="text-sm muted">No specific errors were flagged.</p>;
  return (
    <ul className="space-y-2">
      {errors.map((e, i) => (
        <li key={i} className="rounded-xl border p-3 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="bad">{e.type}</Badge>
            <span className="line-through opacity-70">{e.original}</span>
            <span>→</span>
            <span className="font-medium text-green-600 dark:text-green-400">{e.correction}</span>
          </div>
          {e.explanation && <p className="mt-1 text-xs muted">{e.explanation}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Citations({ items }: { items?: Array<{ id: string; title: string; kind: string }> }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 text-xs muted">
      <span className="font-medium">Grounded on:</span>{' '}
      {items.map((c) => (
        <Badge key={c.id}>{c.title}</Badge>
      ))}
    </div>
  );
}

/** Rubric-based feedback for one Writing task. */
export function EssayFeedback({ essay }: { essay: { taskType: string | null; content: string; wordCount: number; score: number | null; feedback: Meta } }) {
  const f = essay.feedback ?? {};
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{essay.taskType === 'WRITE_EMAIL' ? 'Write an Email' : 'Academic Discussion'}</h3>
        <div className="flex items-center gap-2">
          <Badge tone="good">{essay.score ?? 0}/5</Badge>
          <Badge>{essay.wordCount} words</Badge>
          <Badge tone={f.method === 'llm' ? 'good' : 'warn'}>{f.method === 'llm' ? `AI rater ×${f.samples}` : 'heuristic'}</Badge>
          <Badge>confidence {Math.round((f.confidence ?? 0) * 100)}%</Badge>
        </div>
      </div>
      {f.note && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{f.note}</p>}

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold">Rubric criteria</h4>
          <DimensionBars dims={f.dimensions ?? {}} />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Why this score</h4>
          <p className="text-sm">{f.justification}</p>
          {f.strengths?.length > 0 && (
            <>
              <h4 className="mb-1 mt-4 text-sm font-semibold">Strengths</h4>
              <ul className="list-disc pl-5 text-sm">{f.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
          {f.improvements?.length > 0 && (
            <>
              <h4 className="mb-1 mt-4 text-sm font-semibold">Do this next</h4>
              <ol className="list-decimal pl-5 text-sm">{f.improvements.map((s: { advice: string }, i: number) => <li key={i}>{s.advice}</li>)}</ol>
            </>
          )}
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-500">Corrections ({f.errors?.length ?? 0})</summary>
        <div className="mt-2"><Errors errors={f.errors ?? []} /></div>
      </details>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-500">Your response</summary>
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">{essay.content || '(empty)'}</p>
      </details>
      {f.improvedVersion && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-brand-500">Improved version</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-green-500/10 p-3 text-sm">{f.improvedVersion}</p>
        </details>
      )}
      <Citations items={f.citations} />
    </Card>
  );
}

function AudioPlayer({ recordingId }: { recordingId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchBlobUrl(`/speaking/recordings/${recordingId}/audio`).then((u) => alive && setUrl(u)).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [recordingId]);
  if (err) return <p className="text-xs text-red-500">Audio unavailable.</p>;
  if (!url) return <p className="text-xs muted">Loading audio…</p>;
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio controls src={url} className="w-full" />;
}

export { AudioPlayer };

const Metric = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
  <div className="rounded-xl bg-black/5 p-3 dark:bg-white/10" title={hint}>
    <div className="text-xs muted">{label}</div>
    <div className="text-lg font-semibold tabular-nums">{value}</div>
  </div>
);

/** Metrics + analysis of one spoken answer. */
export function RecordingFeedback({ rec, index }: { rec: Meta; index: number }) {
  const m = rec.metrics ?? {};
  const a = rec.analysis ?? {};
  const repeat = rec.type === 'SPEAKING_LISTEN_REPEAT';
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          {repeat ? 'Listen and Repeat' : 'Interview'} #{index}
        </h3>
        <div className="flex items-center gap-2">
          <Badge tone="good">{rec.score ?? 0}/5</Badge>
          <Badge>{rec.transcriptSource === 'whisper' ? 'server STT' : rec.transcriptSource === 'client' ? 'browser STT' : 'no transcript'}</Badge>
        </div>
      </div>
      {!repeat && <p className="mt-2 text-sm muted">“{rec.prompt}”</p>}
      <div className="mt-3"><AudioPlayer recordingId={rec.id} /></div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Time used" value={`${m.usedSec ?? '—'}s`} hint="Time until your last word" />
        <Metric label="Time remaining" value={`${m.remainingSec ?? '—'}s`} />
        <Metric label="Speech rate" value={`${m.wordsPerMinute ?? '—'} wpm`} hint="Comfortable range ≈ 110–170" />
        <Metric label="Target compliance" value={`${Math.round((m.timeUseRatio ?? 0) * 100)}%`} />
        <Metric label="Long pauses (≥1.5 s)" value={m.longPauseCount ?? 'n/a'} />
        <Metric label="Silences (≥3 s)" value={m.longSilenceCount ?? 'n/a'} />
        <Metric label="Fillers" value={`${m.fillers?.count ?? 0}`} hint={JSON.stringify(m.fillers?.items ?? {})} />
        <Metric label="Speaking ratio" value={m.speakingRatio != null ? `${Math.round(m.speakingRatio * 100)}%` : 'n/a'} hint="Continuity of speech" />
      </div>

      <h4 className="mb-1 mt-4 text-sm font-semibold">Transcript</h4>
      <p className="rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">{rec.transcript || '(no speech recognised)'}</p>

      {repeat ? (
        <div className="mt-3 text-sm">
          <p><span className="muted">Target: </span>{rec.target}</p>
          <p className="mt-1">
            <span className="muted">Word accuracy: </span><strong>{Math.round((a.accuracy ?? 0) * 100)}%</strong>
          </p>
          {a.missing?.length > 0 && <p className="mt-1"><Badge tone="bad">missing</Badge> {a.missing.join(', ')}</p>}
          {a.substitutions?.length > 0 && <p className="mt-1"><Badge tone="warn">substituted</Badge> {a.substitutions.map((s: { expected: string; heard: string }) => `${s.expected} → ${s.heard}`).join('; ')}</p>}
          {a.extra?.length > 0 && <p className="mt-1"><Badge>extra</Badge> {a.extra.join(', ')}</p>}
        </div>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Rubric and delivery criteria</h4>
            <DimensionBars dims={a.dimensions ?? {}} />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Why this score</h4>
            <p className="text-sm">{a.justification}</p>
            {a.improvements?.length > 0 && (
              <>
                <h4 className="mb-1 mt-4 text-sm font-semibold">Do this next</h4>
                <ol className="list-decimal pl-5 text-sm">{a.improvements.map((s: { advice: string }, i: number) => <li key={i}>{s.advice}</li>)}</ol>
              </>
            )}
            {a.errors?.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-brand-500">Language errors ({a.errors.length})</summary>
                <div className="mt-2"><Errors errors={a.errors} /></div>
              </details>
            )}
          </div>
        </div>
      )}
      {a.notes?.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs muted">{a.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul>}
      {!repeat && <Citations items={a.citations} />}
    </Card>
  );
}
