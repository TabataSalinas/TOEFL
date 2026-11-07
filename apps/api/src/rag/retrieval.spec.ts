import { Bm25Index, cosine, rrf, tokenize } from './retrieval';
import { KNOWLEDGE_SEED } from './knowledge.seed';
import { DIMENSIONS } from '../writing/writing.heuristics';

describe('RAG retrieval', () => {
  const index = new Bm25Index(KNOWLEDGE_SEED.map((k) => ({ id: k.key, text: `${k.title} ${k.content}` })));

  it('finds the speech-rate guideline for pace/pause queries', () => {
    const ids = index.search('pauses speech rate words per minute fillers', 3).map((r) => r.id);
    expect(ids).toContain('g-pace');
  });

  it('finds scored email anchors for an email-like response', () => {
    const ids = index.search('catering email guests disappointed late cold food', 4).map((r) => r.id);
    expect(ids.some((id) => id.startsWith('a-email'))).toBe(true);
  });

  it('fuses rankings and measures similarity', () => {
    expect(rrf([['a', 'b'], ['b', 'c']])[0].id).toBe('b');
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1, 6);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(tokenize('Writing writes written')[0]).toBe(tokenize('writing')[0]);
  });

  it('knowledge base covers every rubric dimension used by the evaluators', () => {
    const rubrics = KNOWLEDGE_SEED.filter((k) => k.kind === 'rubric');
    const text = (task: string) => rubrics.filter((r) => r.taskType === task).map((r) => r.content).join(' ');
    for (const d of DIMENSIONS.WRITE_EMAIL) expect(text('WRITE_EMAIL')).toContain(d);
    for (const d of DIMENSIONS.ACADEMIC_DISCUSSION) expect(text('ACADEMIC_DISCUSSION')).toContain(d);
    for (const d of ['grammar', 'vocabulary', 'coherence', 'topic_development']) expect(text('INTERVIEW')).toContain(d);
  });

  it('has unique keys and anchors at several score levels', () => {
    const keys = KNOWLEDGE_SEED.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(KNOWLEDGE_SEED.filter((k) => k.kind === 'anchor').length).toBeGreaterThanOrEqual(6);
  });
});
