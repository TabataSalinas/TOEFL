'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

interface Chunk {
  id: string;
  kind: string;
  taskType: string;
  title: string;
  content: string;
  tags: string[];
}

const TASKS = [
  ['', 'All tasks'],
  ['WRITE_EMAIL', 'Write an Email'],
  ['ACADEMIC_DISCUSSION', 'Academic Discussion'],
  ['INTERVIEW', 'Interview'],
  ['LISTEN_REPEAT', 'Listen and Repeat'],
  ['GENERAL', 'General guidelines'],
];

export default function RubricsPage() {
  const [task, setTask] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [chunks, setChunks] = useState<Chunk[] | null>(null);

  useEffect(() => {
    setChunks(null);
    const params = new URLSearchParams();
    if (task) params.set('taskType', task);
    if (kind) params.set('kind', kind);
    if (q.trim()) params.set('q', q.trim());
    const path = q.trim() ? `/rag/search?${params}` : `/rag/chunks?${params}`;
    const t = setTimeout(() => api.get<Chunk[]>(path).then(setChunks).catch(() => setChunks([])), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [task, kind, q]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Rubrics and reference examples</h1>
      <p className="muted">
        These are the criteria and scored examples the AI rater is given (RAG) before evaluating your Writing and Speaking, so scoring stays consistent. Search them to understand what each score means.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search (e.g. “pauses”, “development”)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input w-52" value={task} onChange={(e) => setTask(e.target.value)} aria-label="Task type">
          {TASKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input w-44" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
          <option value="">All kinds</option>
          <option value="rubric">Rubrics</option>
          <option value="anchor">Scored examples</option>
          <option value="guideline">Guidelines</option>
        </select>
      </div>
      {!chunks && <div className="mt-6"><Spinner label="Loading…" /></div>}
      <div className="mt-6 space-y-4">
        {chunks?.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{c.title}</h2>
              <Badge tone={c.kind === 'rubric' ? 'good' : c.kind === 'anchor' ? 'warn' : 'default'}>{c.kind}</Badge>
              <Badge>{c.taskType.replace(/_/g, ' ').toLowerCase()}</Badge>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
          </Card>
        ))}
        {chunks?.length === 0 && <p className="text-sm muted">No results.</p>}
      </div>
    </AppShell>
  );
}
